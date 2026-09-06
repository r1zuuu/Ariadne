// Repeatable fixture for the UX audit. Fills the local test database with every
// shape the interface has to survive: both roles, all four node statuses, both
// write channels, empty and dense projects, titles of one word and of two
// hundred characters, and tasks in every state including live agent runs.
//
// Run from backend/:  npx tsx scripts/seed-ux.ts
//
// SAFETY. This script writes a lot and deletes what it wrote before. It refuses
// to run against anything but a local database, and it only ever removes rows
// belonging to its own accounts, which all end in @ux.test. Nothing else in the
// database is touched.
//
// Two things here are SIMULATED and must be read as such in any report:
//
//   1. Embeddings are deterministic pseudo-random vectors, not model output.
//      Lexical search works properly; vector similarity is meaningless, so the
//      order of "sources" under an answer proves nothing about retrieval.
//   2. Active task runs are rows written directly into task_active_runs. No
//      Claude Code or Codex session is behind them. They prove the interface
//      renders a live lease; they prove nothing about the real integration.

process.loadEnvFile("../.env.test");

// Admin script: it needs to write across workspaces, which the policies of
// migration 0008 forbid to the app role. Hard assignment, not `??=`: the env
// file already carries the app URL, so a polite default would leave this script
// running under the policies and failing on WITH CHECK.
process.env.DATABASE_URL_APP = process.env.DATABASE_URL;

const target = process.env.DATABASE_URL ?? "";
const host = target.replace(/^.*@/, "");
if (!/^(localhost|127\.0\.0\.1|\[::1\]|db):/.test(host)) {
  console.error(`REFUSING TO SEED. DATABASE_URL points at ${host}, which is not local.`);
  console.error("This script only runs against the docker-compose container.");
  process.exit(1);
}
console.log(`seeding ${host}`);

const { hash } = await import("@node-rs/argon2");
const { db } = await import("../src/db/client.js");
const { and, eq, inArray, like } = await import("drizzle-orm");
const {
  apiTokens,
  conversations,
  invites,
  memberships,
  nodes,
  projects,
  taskActiveRuns,
  taskEvents,
  taskMemoryLinks,
  tasks,
  users,
  workspaces,
} = await import("../src/db/schema.js");

const PASSWORD = "ux-audit-2026";
const DOMAIN = "@ux.test";

/**
 * A 768-value unit vector derived from the text. Same text, same vector, so a
 * re-run does not reshuffle the graph; different texts land in different places
 * so the screens have something to draw. It is not a language model and the
 * neighbours it produces mean nothing.
 */
function fakeEmbedding(seedText: string): number[] {
  let state = 2166136261;
  for (const ch of seedText) {
    state ^= ch.charCodeAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  }
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < 768; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const v = state / 4294967295 - 0.5;
    out.push(v);
    sum += v * v;
  }
  const norm = Math.sqrt(sum) || 1;
  return out.map((v) => v / norm);
}

const days = (n: number) => new Date(Date.now() - n * 86400000);

// --- Wipe what a previous run left, and nothing else ---

const previous = await db
  .select({ id: users.id })
  .from(users)
  .where(like(users.email, `%${DOMAIN}`));

if (previous.length) {
  const ids = previous.map((u) => u.id);
  const owned = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(inArray(workspaces.ownerId, ids));
  // Everything below a workspace cascades from it, and the accounts cascade
  // their memberships. Two deletes are the whole cleanup.
  if (owned.length) {
    await db.delete(workspaces).where(inArray(workspaces.id, owned.map((w) => w.id)));
  }
  await db.delete(users).where(inArray(users.id, ids));
  console.log(`cleared ${previous.length} account(s) from a previous run`);
}

// --- Accounts ---

const passwordHash = await hash(PASSWORD);

async function account(email: string, profile: string) {
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash, profile })
    .returning({ id: users.id });
  return row.id;
}

const owner = await account(
  `owner${DOMAIN}`,
  "Zofia, senior frontend. Prowadzi dwa archiwa: swoje prywatne i wspolne z zespolem. Chce widziec, kto co zatwierdzil.",
);
const member = await account(
  `member${DOMAIN}`,
  "Marek, backend. Nalezy do cudzego archiwum jako czlonek, wlasnego zespolu nie zaklada.",
);
const invited = await account(
  `invited${DOMAIN}`,
  "Ktos, kto dostal zaproszenie i jeszcze na nie nie odpowiedzial.",
);
// Deliberately left with nothing: this is the account that sees every empty
// state and the first-run onboarding.
const fresh = await account(`fresh${DOMAIN}`, "");

console.log("accounts: owner, member, invited, fresh");

// --- Workspaces and membership ---

async function workspace(name: string, ownerId: string) {
  const [row] = await db.insert(workspaces).values({ name, ownerId }).returning({ id: workspaces.id });
  await db.insert(memberships).values({ workspaceId: row.id, userId: ownerId, role: "owner" });
  return row.id;
}

// Every account gets the private workspace registration would have made.
const soloWs = await workspace("Prywatne archiwum Zofii", owner);
const teamWs = await workspace("Nic Ariadny", owner);
await workspace("Prywatne archiwum Marka", member);
await workspace("Prywatne archiwum", invited);
await workspace("Prywatne archiwum", fresh);

await db.insert(memberships).values({ workspaceId: teamWs, userId: member, role: "member" });

// One invitation still open, so the teams screen has something waiting.
await db.insert(invites).values({
  workspaceId: teamWs,
  code: "ux-audit-zaproszenie",
  email: `invited${DOMAIN}`,
  createdBy: owner,
  expiresAt: new Date(Date.now() + 7 * 86400000),
});

console.log("workspaces: solo + team (owner + member), one open invite");

// --- Projects: empty, small, dense ---

async function project(input: {
  workspaceId: string;
  name: string;
  repoRef: string;
  opis: string;
  stack: string;
  ograniczenia: string;
  etap: "prototyp" | "produkcja" | "utrzymanie";
}) {
  const [row] = await db
    .insert(projects)
    .values({ ...input, dlaKogo: "dla zespolu" })
    .returning({ id: projects.id });
  return row.id;
}

const emptyProject = await project({
  workspaceId: soloWs,
  name: "Swiezy projekt",
  repoRef: "https://github.com/ux/swiezy",
  opis: "Zalozony przed chwila, nie ma w nim jeszcze ani jednego wpisu.",
  stack: "nic jeszcze nie wybrane",
  ograniczenia: "",
  etap: "prototyp",
});

const smallProject = await project({
  workspaceId: soloWs,
  name: "Portfolio",
  repoRef: "https://github.com/ux/portfolio",
  opis: "Statyczna strona portfolio. Kilka wpisow, zeby ekran nie byl ani pusty, ani gesty.",
  stack: "Next.js, TypeScript, Tailwind",
  ograniczenia: "Zero backendu. Teksty wylacznie przez i18n.",
  etap: "produkcja",
});

const denseProject = await project({
  workspaceId: teamWs,
  name: "Ariadne",
  repoRef: "https://github.com/ux/ariadne",
  opis:
    "Warstwa pamieci miedzy sesjami agentow kodujacych. Repozytorium odpowiada, co robi kod; to archiwum trzyma powody: ktore decyzje zapadly, co zostalo odrzucone i ktore ograniczenia sa prawdziwe.",
  stack:
    "Tauri 2, Next.js 16 jako statyczny eksport, Hono na Node 22, Postgres 17 z pgvector, drizzle, Row-Level Security, MCP przez Streamable HTTP, Render plus Neon",
  ograniczenia:
    "Nie mapujemy kodu, od tego jest Graphify. Kazdy rekord niesie metryczke: kto, kiedy, z jakiego kanalu. Status nigdy nie jest niesiony samym kolorem. Zaden wpis nie trafia do pamieci bez swiadomej zgody czlowieka.",
  etap: "produkcja",
});

console.log("projects: empty, small, dense");

// --- Memory entries ---

const LONG_TITLE_CONTENT =
  "Odrzucilismy pomysl, zeby skille byly serwowane przez MCP jako tekst, poniewaz skill jest katalogiem z bundlem, a nie pojedynczym plikiem, i SKILL.md odwoluje sie do scripts/ oraz references/ sciezkami wzglednymi, ktorych na dysku agenta po prostu nie ma, wiec instrukcja wskazywalaby na nicosc i psulaby sie po cichu zamiast zglosic blad, co jest najgorszym mozliwym trybem awarii dla czegos, co ma zwiekszac zaufanie do archiwum.";

const CODE_CONTENT = `Junction, nie symlink, i to nie jest kwestia gustu.

    // symlink_dir wymaga uprawnien administratora albo trybu dewelopera
    Command::new("cmd").args(["/C", "mklink", "/J"]).arg(link).arg(target)

Powody, po kolei:
- junction nie wymaga zadnych uprawnien;
- dziala tylko na lokalnym wolumenie, co nam wystarcza;
- fs::remove_dir_all na junctionie kasuje zawartosc CELU, wiec w tym module nie ma funkcji usuwajacej w ogole.`;

type NodeSeed = {
  projectId: string;
  workspaceId: string;
  type: "decision" | "note" | "session_summary";
  status: "proposed" | "confirmed" | "contradicted" | "archived";
  channel: "coder" | "app_chat" | "app_form";
  authorId: string | null;
  content: string;
  summary: string;
  confirmedBy?: string | null;
  ageDays: number;
};

const nodeSeeds: NodeSeed[] = [
  {
    projectId: denseProject,
    workspaceId: teamWs,
    type: "decision",
    status: "confirmed",
    channel: "coder",
    authorId: owner,
    confirmedBy: owner,
    content: LONG_TITLE_CONTENT,
    summary: "Skille zostaja na dysku, MCP nie serwuje ich jako tekstu",
    ageDays: 1,
  },
  {
    projectId: denseProject,
    workspaceId: teamWs,
    type: "decision",
    status: "confirmed",
    channel: "coder",
    authorId: member,
    confirmedBy: owner,
    content: CODE_CONTENT,
    summary: "Dowiazania katalogow robimy junctionem, nie symlinkiem",
    ageDays: 2,
  },
  {
    projectId: denseProject,
    workspaceId: teamWs,
    type: "note",
    status: "proposed",
    channel: "app_chat",
    authorId: owner,
    content:
      "Render usypia darmowa usluge po pietnastu minutach, wiec pierwsze zadanie po przerwie idzie 30 do 60 sekund i wyglada jak zawieszona aplikacja.",
    summary: "Zimny start Rendera wyglada jak zawieszenie",
    ageDays: 3,
  },
  {
    projectId: denseProject,
    workspaceId: teamWs,
    type: "note",
    status: "contradicted",
    channel: "coder",
    authorId: member,
    content:
      "Token MCP nalezy do archiwum, wiec kazde archiwum potrzebuje wlasnego tokena na kazdej maszynie.",
    summary: "Token nalezy do archiwum",
    ageDays: 30,
  },
  {
    projectId: denseProject,
    workspaceId: teamWs,
    type: "decision",
    status: "archived",
    channel: "app_form",
    authorId: owner,
    content: "Graf polaczen stoi na d3-force z wlasnym ukladem sil.",
    summary: "Graf na d3-force",
    ageDays: 60,
  },
  {
    projectId: denseProject,
    workspaceId: teamWs,
    type: "session_summary",
    status: "confirmed",
    channel: "coder",
    authorId: null, // author account gone: the archive outlives the person
    confirmedBy: member,
    content:
      "Sesja zamknieta na przepiciu tokena z archiwum na maszyne. Zostalo: przebieg verify-rest po migracjach 0011 i 0012.",
    summary: "Token przepiety z archiwum na maszyne",
    ageDays: 5,
  },
  {
    projectId: smallProject,
    workspaceId: soloWs,
    type: "decision",
    status: "confirmed",
    channel: "app_form",
    authorId: owner,
    confirmedBy: owner,
    content: "Zero backendu. Strona jest statyczna i ma taka zostac.",
    summary: "Portfolio zostaje statyczne",
    ageDays: 10,
  },
  {
    projectId: smallProject,
    workspaceId: soloWs,
    type: "note",
    status: "proposed",
    channel: "coder",
    authorId: owner,
    content: "Krotki.",
    summary: "",
    ageDays: 0,
  },
];

// Bulk filler, so the dense project has a list worth scrolling and the boot
// index has something to be honest about.
for (let i = 0; i < 54; i++) {
  const statuses = ["proposed", "confirmed", "contradicted", "archived"] as const;
  const types = ["decision", "note", "session_summary"] as const;
  const channels = ["coder", "app_chat", "app_form"] as const;
  nodeSeeds.push({
    projectId: denseProject,
    workspaceId: teamWs,
    type: types[i % 3],
    status: statuses[i % 4],
    channel: channels[i % 3],
    authorId: i % 2 ? owner : member,
    confirmedBy: statuses[i % 4] === "confirmed" ? (i % 2 ? member : owner) : null,
    content: `Wpis wypelniajacy numer ${i + 1}. Trzymany po to, zeby lista miala dlugosc, ktora ujawnia problemy z odstepami, paginacja i czytelnoscia metryczki przy wielu wierszach naraz.`,
    summary: `Wpis wypelniajacy numer ${i + 1}`,
    ageDays: 6 + i,
  });
}

for (const seed of nodeSeeds) {
  await db.insert(nodes).values({
    workspaceId: seed.workspaceId,
    projectId: seed.projectId,
    authorId: seed.authorId,
    confirmedBy: seed.confirmedBy ?? null,
    confirmedAt: seed.confirmedBy ? days(seed.ageDays - 0.5) : null,
    type: seed.type,
    content: seed.content,
    summary: seed.summary,
    status: seed.status,
    source: { session_id: `ux-seed-${seed.ageDays}`, channel: seed.channel },
    embedding: fakeEmbedding(seed.content),
    createdAt: days(seed.ageDays),
    updatedAt: days(seed.ageDays),
  });
}

console.log(`nodes: ${nodeSeeds.length} (all four statuses, all three channels)`);

// --- Tasks, including two simulated live runs ---

type TaskSeed = {
  title: string;
  description: string;
  status: "backlog" | "todo" | "in_progress" | "blocked" | "done" | "archived";
  priority: "low" | "medium" | "high" | "critical";
  blockedReason?: string;
  channel: "coder" | "app_form";
  live?: { client: string; kind: "claude" | "codex" };
};

const taskSeeds: TaskSeed[] = [
  {
    title: "Dac request() timeout i przekazac AbortSignal",
    description:
      "signInWithProvider odpytuje /auth/handoff/:id w petli, ktorej limit trzech minut sprawdzany jest wylacznie MIEDZY odpytaniami.",
    status: "in_progress",
    priority: "high",
    channel: "coder",
    live: { client: "Claude Code", kind: "claude" },
  },
  {
    title: "Przeklikac sekcje Skille na prawdziwym katalogu domowym",
    description: "Testy chodza po katalogu tymczasowym, wiec nie dowodza niczego o prawdziwych korzeniach.",
    status: "in_progress",
    priority: "high",
    channel: "coder",
    live: { client: "Codex", kind: "codex" },
  },
  {
    title:
      "Rozstrzygnac, co zrobic z wpisami, ktore powstaly przed dodaniem kolumny summary, poniewaz karta wraca dla nich do pierwszego zdania tresci i przy dlugim wpisie wyglada to na uciety tekst zamiast na swiadomy fallback",
    description: "Tytul celowo bardzo dlugi: sprawdza zawijanie i ucinanie w wierszu listy.",
    status: "todo",
    priority: "medium",
    channel: "app_form",
  },
  { title: "Odswiezyc README", description: "", status: "backlog", priority: "low", channel: "app_form" },
  {
    title: "Wyslac zaproszenia mailem",
    description: "Czeka na publiczny adres, bo link z maila nie ma dokad prowadzic.",
    status: "blocked",
    priority: "medium",
    blockedReason: "Brak publicznego adresu i nadawcy poczty.",
    channel: "coder",
  },
  {
    title: "Wyrownac skille miedzy Claude a Codeksem",
    description: "Zrobione przyciskiem w ustawieniach.",
    status: "done",
    priority: "medium",
    channel: "coder",
  },
  {
    title: "Stary pomysl na wlasny scheme ariadne://",
    description: "Odlozone na rzecz handoffu przez przegladarke.",
    status: "archived",
    priority: "low",
    channel: "app_form",
  },
];

// One token, so a live run has something to hang its provenance on.
const [seedToken] = await db
  .insert(apiTokens)
  .values({ userId: owner, tokenHash: `ux-seed-${Date.now()}`, label: "maszyna audytowa" })
  .returning({ id: apiTokens.id });

let live = 0;
for (const seed of taskSeeds) {
  const [task] = await db
    .insert(tasks)
    .values({
      workspaceId: teamWs,
      projectId: denseProject,
      title: seed.title,
      description: seed.description,
      status: seed.status,
      priority: seed.priority,
      blockedReason: seed.blockedReason ?? null,
      createdBy: seed.channel === "coder" ? owner : member,
      completedBy: seed.status === "done" ? owner : null,
      completedAt: seed.status === "done" ? days(1) : null,
      source: { channel: seed.channel, client: seed.channel === "coder" ? "Codex" : undefined },
    })
    .returning({ id: tasks.id });

  await db.insert(taskEvents).values({
    workspaceId: teamWs,
    projectId: denseProject,
    taskId: task.id,
    action: "created",
    actorId: owner,
    source: { channel: seed.channel },
    payload: { title: seed.title, status: seed.status, priority: seed.priority },
  });

  if (seed.live) {
    // SIMULATED. No agent session exists behind this row. The lease is written
    // far enough into the future that the audit has time to look at it.
    await db.insert(taskActiveRuns).values({
      workspaceId: teamWs,
      projectId: denseProject,
      taskId: task.id,
      actorId: owner,
      tokenId: seedToken.id,
      agentClient: seed.live.client,
      agentKind: seed.live.kind,
      sessionId: `ux-seed-simulated-${seed.live.kind}`,
      source: { channel: "coder", client: seed.live.client, simulated: true },
      expiresAt: new Date(Date.now() + 12 * 3600000),
    });
    live++;
  }
}

// One task carrying a memory link, so the relation has a row somewhere.
const [firstNode] = await db
  .select({ id: nodes.id })
  .from(nodes)
  .where(and(eq(nodes.projectId, denseProject), eq(nodes.status, "confirmed")));
const [firstTask] = await db
  .select({ id: tasks.id })
  .from(tasks)
  .where(eq(tasks.projectId, denseProject));
if (firstNode && firstTask) {
  await db.insert(taskMemoryLinks).values({
    taskId: firstTask.id,
    nodeId: firstNode.id,
    workspaceId: teamWs,
    projectId: denseProject,
  });
}

console.log(`tasks: ${taskSeeds.length}, of which ${live} carry a SIMULATED live run`);

// --- One saved conversation on each side ---

await db.insert(conversations).values([
  {
    userId: owner,
    projectId: denseProject,
    kind: "ask",
    title: "Czemu skille nie ida przez MCP?",
    messages: [
      { role: "user", text: "Czemu skille nie ida przez MCP?" },
      {
        role: "assistant",
        text: "Skill jest katalogiem z bundlem, nie tekstem. Odkrywanie skilli jest katalogowe, wiec narzedzie MCP nie wchodzi w ten mechanizm.",
      },
    ],
  },
  {
    userId: owner,
    projectId: denseProject,
    kind: "memory",
    title: "Zapisz decyzje o junctionach",
    messages: [{ role: "user", text: "Zapisz decyzje o junctionach" }],
  },
]);

console.log("conversations: one ask, one memory");

console.log("");
console.log("--- seed done ---");
console.log(`sign in with any of: owner${DOMAIN}, member${DOMAIN}, invited${DOMAIN}, fresh${DOMAIN}`);
console.log(`password: ${PASSWORD}`);
console.log("SIMULATED: embeddings are pseudo-random; live task runs are rows, not agents.");

process.exit(0);
