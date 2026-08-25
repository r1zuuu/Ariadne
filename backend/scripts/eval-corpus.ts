// Builds the corpus the search evaluation runs against, and draws the question
// set from it. Run from backend/: npx tsx scripts/eval-corpus.ts
//
// Not the ten nodes of verify-service.ts: at ten entries and k=5 half the
// archive fits in the results, every variant scores near 1.0 and the comparison
// says nothing. The project's own documents are the nearest thing to a real
// archive that already exists, and they are about this project, which is what
// the search was built to hold.
//
// Idempotent: recreates the eval user, whose cascade wipes the previous corpus.
process.loadEnvFile("../.env");
// Nigdy produkcja. DATABASE_URL w .env tego repo wskazuje na Neona, a ten skrypt
// kasuje konto kaskada i pisze kilkaset wpisow: wycelowany w prawdziwa baze
// zrobilby to prawdziwym danym. Korpus pomiarowy mieszka w lokalnym kontenerze,
// wiec adres powstaje z tych samych zmiennych POSTGRES_*, ktorych uzywa docker
// compose, a DATABASE_URL nie jest tu czytany w ogole.
const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env;
if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
  throw new Error("brak POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB w ../.env");
}
process.env.DATABASE_URL_APP = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}`;

const { readFileSync } = await import("node:fs");
const { db } = await import("../src/db/client.js");
const { memberships, nodes, users, projects, workspaces } = await import("../src/db/schema.js");
const { eq } = await import("drizzle-orm");
const { embed } = await import("../src/gemini.js");
const { seal } = await import("../src/crypto.js");

const EMAIL = "eval@ariadne.local";
// setup.md is deliberately absent. It is in .gitignore because it carries a
// database password in plain text, and this script copies whole entries into
// eval/questions.json as the answer key: a corpus built from it turns the
// benchmark into a place secrets leak from. Every document here is tracked in
// git, which is also what makes the measurement reproducible by someone else.
const DOCS = ["../plan-ariadne.md", "../DESIGN.md", "../PRODUCT.md"];

// Under this a block is a heading leftover or a one-line aside, and no question
// has it as an answer. Over it, an entry stops being one thought, and 1500
// characters is already generous next to what a person writes by hand.
const MIN_CHARS = 120;
const MAX_CHARS = 1500;

/**
 * Anything past the cap, cut at the best boundary that fits.
 *
 * A sentence end first, but only when it lands late enough to be worth taking.
 * SQL and YAML have no sentence ends, so on them ". " either misses entirely or
 * matches a decimal point, and the piece then starts in the middle of a word -
 * the first run produced a chunk opening with "adline steps only". A line break
 * is the fallback, because every block here has them and none of them cut a token.
 */
function split(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const dot = text.lastIndexOf(". ", MAX_CHARS);
  const line = text.lastIndexOf("\n", MAX_CHARS);
  const at = dot > MAX_CHARS * 0.6 ? dot + 1 : line > MIN_CHARS ? line : MAX_CHARS;
  return [text.slice(0, at).trim(), ...split(text.slice(at).trim())];
}

/**
 * Markdown into entry-sized pieces.
 *
 * Blank lines separate blocks, and a block of bullets is split again: each
 * bullet in these documents is its own fact, and fifteen of them embedded as
 * one vector mean nothing in particular. The nearest heading is carried into
 * every piece, because "the index is a sample" is unanswerable on its own and
 * answerable under "6. Petla sesji codera".
 */
function chunk(markdown: string, doc: string): string[] {
  const chunks: string[] = [];
  let heading = "";
  let block: string[] = [];
  let fenced = false;

  const flush = () => {
    const text = block.join("\n").trim();
    block = [];
    if (!text) return;
    const bullets = text.startsWith("- ") ? text.split(/\n(?=- )/) : [text];
    for (const bullet of bullets) {
      for (const piece of split(bullet.trim())) {
        if (piece.length < MIN_CHARS) continue;
        chunks.push((heading ? doc + " / " + heading : doc) + "\n\n" + piece);
      }
    }
  };

  for (const line of markdown.split("\n")) {
    // A fenced block is atomic: it holds blank lines, and the paragraph split
    // would otherwise shred a SQL schema into fragments that answer nothing.
    if (line.startsWith("```")) {
      fenced = !fenced;
      block.push(line);
      continue;
    }
    if (fenced) {
      block.push(line);
      continue;
    }
    const found = /^#+\s+(.*)/.exec(line);
    if (found) {
      flush();
      heading = found[1].trim();
      continue;
    }
    if (!line.trim()) flush();
    else block.push(line);
  }
  flush();
  return chunks;
}

/**
 * Google liczy zapytania na minute, osobno dla kazdego modelu, a korpus to
 * kilkaset wywolan pod rzad. Odmierzanie tempa z gory wymagaloby jednej
 * zgadnietej liczby na model; odpowiedz 429 niesie czas, ktory sam sobie zyczy,
 * wiec taniej jest zapytac raz i poczekac tyle, ile kazano.
 */
async function patiently<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      const message = (err as Error).message;
      if (attempt >= 5 || !message.includes("429")) throw err;
      const asked = /"retryDelay": "(d+)s"/.exec(message);
      const wait = (asked ? Number(asked[1]) : 30) + 2;
      console.log(`  limit Gemini, czekam ${wait}s`);
      await new Promise((done) => setTimeout(done, wait * 1000));
    }
  }
}

const corpus = DOCS.flatMap((path) => {
  const doc = path.replace("../", "");
  // CRLF na LF przed cieciem: pliki sa CRLF, a chunker dzieli po "\n", wiec bez
  // tego kazda linia kawalka konczylaby sie osieroconym \r.
  const text = readFileSync(path, "utf8").split("\r\n").join("\n");
  return chunk(text, doc).map((content) => ({ doc, content }));
});
console.log(`${corpus.length} wpisow z ${DOCS.length} dokumentow`);

const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY is not set (add it to .env)");

const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, EMAIL));
if (existing.length) await db.delete(users).where(eq(users.id, existing[0].id));

const [user] = await db
  .insert(users)
  .values({
    email: EMAIL,
    passwordHash: "not-a-real-hash",
    profile: "Konto pomiarowe: korpus i pytania do oceny wyszukiwania",
    // The service reads the key off the account and never off the environment,
    // so a script calling it has to put one there the way settings does.
    geminiKey: seal(key),
  })
  .returning({ id: users.id });

const [workspace] = await db
  .insert(workspaces)
  .values({ name: EMAIL, ownerId: user.id })
  .returning({ id: workspaces.id });
await db.insert(memberships).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });

const [project] = await db
  .insert(projects)
  .values({
    workspaceId: workspace.id,
    name: "Ariadne (eval)",
    repoRef: "github.com/r1zuuu/Ariadne",
    opis: "Korpus pomiarowy zlozony z dokumentow projektu",
    stack: "Node/TS, Postgres+pgvector, Drizzle, Hono, Tauri",
  })
  .returning({ id: projects.id });

// Written straight to the table rather than through createNode, which would add
// a summary call and a conflict check per entry: a few hundred model calls that
// change nothing measured here. Retrieval reads content, the embedding computed
// from it and search_text generated from it, and nothing else.
const source = { session_id: crypto.randomUUID(), channel: "app" as const };
const written: { id: string; doc: string; content: string }[] = [];
for (const [i, entry] of corpus.entries()) {
  const embedding = await patiently(() => embed(key, entry.content, "RETRIEVAL_DOCUMENT"));
  const [row] = await db
    .insert(nodes)
    .values({
      workspaceId: workspace.id,
      authorId: user.id,
      projectId: project.id,
      type: "note",
      content: entry.content,
      status: "confirmed",
      confirmedBy: user.id,
      confirmedAt: new Date(),
      source,
      embedding,
    })
    .returning({ id: nodes.id });
  written.push({ id: row.id, doc: entry.doc, content: entry.content });
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${corpus.length}`);
}

const perDoc: Record<string, number> = {};
for (const entry of written) perDoc[entry.doc] = (perDoc[entry.doc] ?? 0) + 1;

console.log(`\nGOTOWE: ${written.length} wpisow, rozklad ${JSON.stringify(perDoc)}`);
console.log("Pytania: npx tsx scripts/eval-questions.ts");
process.exit(0);
