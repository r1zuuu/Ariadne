// Measures what each half of search contributes. Run from backend/ after
// eval-corpus.ts has built the corpus: npx tsx scripts/eval-search.ts
//
// Same corpus, same questions, three searches: meaning alone, names alone, and
// the two fused by rank. The only thing that varies is which arm answers, which
// is the only way the second one can be shown to have paid for itself.
//
// Writes eval/results.md and prints the summary table.
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

const { readFileSync, writeFileSync } = await import("node:fs");
const service = await import("../src/service.js");
const { patiently, sleep } = await import("./eval-retry.js");

type Arm = "vector" | "lexical";
type Kind = "proza" | "identyfikator";
type Question = { question: string; kind: Kind; node_id: string; doc: string; answer: string };

// Rodzaje pytan, kazdy liczony osobno. Jedna liczba na wymieszanym zestawie
// zalezy od proporcji prozy do nazw, ktorej nikt tu nie zmierzyl: aplikacja nie
// ma jeszcze ruchu, z ktorego dalo by sie ja odczytac. Rozbite tabele sa od tej
// proporcji niezalezne, a srednia wazona dowolnym podzialem liczy sie z nich
// pozniej, bez wydawania ani jednego embeddingu.
const KINDS: { kind: Kind; title: string }[] = [
  { kind: "proza", title: "Pytania proza, nie nazywajace niczego po imieniu" },
  { kind: "identyfikator", title: "Pytania nazywajace rzecz po imieniu" },
];

const VARIANTS: { name: string; arms: Arm[] }[] = [
  { name: "wektor", arms: ["vector"] },
  { name: "nazwy", arms: ["lexical"] },
  { name: "hybryda", arms: ["vector", "lexical"] },
];

// The ceiling searchNodes allows, and every recall@k below it reads off the one
// ranked list: asking four times for four cutoffs would cost four embeddings
// and return prefixes of the same answer.
const K = 10;
const CUTOFFS = [1, 3, 5, 10];

const set = JSON.parse(readFileSync("eval/questions.json", "utf8")) as {
  user_id: string;
  project_id: string;
  corpus: number;
  questions: Question[];
};
if (!set.questions.length) throw new Error("eval/questions.json has no questions");

/** Where the right entry landed, 0 when it never came back. */
type Hit = { rank: number; returned: number; ms: number };

async function ask(question: Question, arms: Arm[]): Promise<Hit> {
  const started = Date.now();
  const results = await service.searchNodes({
    userId: set.user_id,
    projectId: set.project_id,
    query: question.question,
    k: K,
    channel: "app",
    arms,
  });
  return {
    rank: results.findIndex((row) => row.id === question.node_id) + 1,
    returned: results.length,
    ms: Date.now() - started,
  };
}

const runs = new Map<string, Hit[]>(VARIANTS.map((v) => [v.name, []]));

/**
 * Odstep miedzy pytaniami. Tempo, nie ponowienie, i to jest jedyny powod, dla
 * ktorego ten skrypt sam z siebie czeka.
 *
 * searchNodes wola dwa rozne modele: embedding pytania i tani model wyciagajacy
 * z niego nazwy wlasne. Kazdy ma wlasny limit na minute. Embedding przy limicie
 * rzuca bledem, ktory patiently zlapie i ponowi. Tani model jest w service.ts
 * owiniety w literalsOrNothing, ktore polyka kazdy blad, zeby wyszukiwanie nie
 * padalo przez nieudane rozpoznanie nazwy. W produkcji to zachowanie sluszne, w
 * pomiarze zabojcze: przy limicie ramie leksykalne dostaje pusta liste nazw,
 * wypada gorzej niz jest naprawde, a w wyniku nie ma po tym ani sladu.
 *
 * Jedno pytanie to trzy embeddingi i dwa wywolania taniego modelu, wiec dziewiec
 * sekund trzyma oba pod najciasniejszym z limitow darmowego progu. Cena to okolo
 * dziesieciu minut przebiegu, ktora placi sie raz.
 */
const PACE_MS = 9_000;

console.log(`${set.questions.length} pytan x ${VARIANTS.length} warianty na ${set.corpus} wpisach\n`);
for (const [i, question] of set.questions.entries()) {
  for (const variant of VARIANTS) {
    // Limit zamieniony w nietrafienie bylby zla liczba podana jako dobra.
    runs.get(variant.name)!.push(await patiently(() => ask(question, variant.arms)));
  }
  console.log(`  ${i + 1}/${set.questions.length} ${question.question.slice(0, 70)}`);
  if (i < set.questions.length - 1) await sleep(PACE_MS);
}

const share = (hits: Hit[], test: (hit: Hit) => boolean) =>
  hits.filter(test).length / hits.length;
const recallAt = (hits: Hit[], k: number) => share(hits, (h) => h.rank > 0 && h.rank <= k);
// A miss contributes 0, which is what "the answer never reached the model" is
// worth. Averaging over the hits only would score a search that answers one
// question in ten above one that answers nine.
const mrr = (hits: Hit[]) => hits.reduce((sum, h) => sum + (h.rank ? 1 / h.rank : 0), 0) / hits.length;
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const pct = (value: number) => (value * 100).toFixed(0) + "%";

const table = (head: string[], body: string[][]) =>
  [head, head.map(() => "---"), ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");

/** Jedna tabela, liczona na tych pytaniach, ktore przejda przez `keep`. */
const summaryFor = (keep: (question: Question) => boolean) =>
  table(
    ["wariant", ...CUTOFFS.map((k) => `recall@${k}`), "MRR", "pusty wynik", "mediana czasu"],
    VARIANTS.map((variant) => {
      const hits = runs.get(variant.name)!.filter((_, i) => keep(set.questions[i]));
      return [
        variant.name,
        ...CUTOFFS.map((k) => pct(recallAt(hits, k))),
        mrr(hits).toFixed(3),
        pct(share(hits, (h) => h.returned === 0)),
        median(hits.map((h) => h.ms)) + " ms",
      ];
    }),
  );

const summary = summaryFor(() => true);
const counted = (kind: Kind) => set.questions.filter((q) => q.kind === kind).length;

/**
 * Kontrola rzetelnosci pomiaru, nie wynik.
 *
 * Pytanie niosace identyfikator, na ktore ramie nazw nie zwrocilo ani jednego
 * wiersza, ma dwa mozliwe zrodla: nazwa nie wystepuje w archiwum, albo tani
 * model zostal uciszony limitem i lista nazw przyszla pusta. Pierwsze jest
 * wynikiem, drugie bledem pomiaru, a rozroznic ich w samej tabeli nie sposob.
 * Liczba stoi wiec w raporcie i ma byc czytana przed kazda inna.
 */
const silentOnNamed = set.questions.filter(
  (question, i) => question.kind === "identyfikator" && runs.get("nazwy")![i].returned === 0,
).length;

const detail = table(
  ["pytanie", "rodzaj", "dokument", ...VARIANTS.map((v) => v.name)],
  set.questions.map((question, i) => [
    // A pipe or a newline in a cell would break the table it is printed into.
    question.question.replace(/[|\n]/g, " "),
    question.kind,
    question.doc,
    ...VARIANTS.map((v) => {
      const { rank } = runs.get(v.name)![i];
      return rank ? String(rank) : "-";
    }),
  ]),
);

const report = [
  "# Wyniki: co wnosi kazde ramie wyszukiwania",
  "",
  `Korpus: ${set.corpus} wpisow. Pytan: ${set.questions.length}, w tym ${counted("proza")} proza`,
  `i ${counted("identyfikator")} nazywajacych rzecz po imieniu. k = ${K}.`,
  "Kazde pytanie zadane trzy razy, roznica tylko w tym, ktore ramie odpowiada.",
  "",
  "## Podsumowanie, caly zestaw",
  "",
  summary,
  "",
  `Ta tabela wazy proze do identyfikatorow jak ${counted("proza")} do ${counted("identyfikator")}, bo tyle ich`,
  "napisano, a nie dlatego, ze tak wyglada ruch. Ruchu nie ma czym zmierzyc: aplikacja",
  "nie ma jeszcze uzytkownikow. Liczby ponizej, rozbite na rodzaje, sa od tej proporcji",
  "niezalezne i to z nich nalezy czytac wniosek. Sredniej wazonej dowolnym innym",
  "podzialem nie trzeba mierzyc, wystarczy policzyc z dwoch tabel.",
  "",
  "recall@k to odsetek pytan, w ktorych wlasciwy wpis znalazl sie w pierwszych k wynikach.",
  "MRR to srednia z odwrotnosci pozycji: miejsce 1 daje 1.0, miejsce 4 daje 0.25, brak daje 0.",
  "Pusty wynik to pytania, na ktore wariant nie zwrocil niczego. Dla ramienia nazw",
  "oznacza pytanie bez ani jednej nazwy wlasnej, czyli miejsce, gdzie ono z zasady milczy.",
  "Czas obejmuje wywolania do Google, wiec mowi o calym zapytaniu, nie o samej bazie.",
  "Kazdy wariant liczy wektor pytania, takze ten po samych nazwach: kolumna similarity",
  "jest czescia wyniku niezaleznie od tego, ktore ramie wiersz znalazlo. Wiersz nazw",
  "niesie wiec koszt, ktorego w produkcji by nie mial.",
  "",
  ...KINDS.flatMap(({ kind, title }) => [
    `## ${title}: ${counted(kind)} pytan`,
    "",
    summaryFor((question) => question.kind === kind),
    "",
  ]),
  "## Kontrola rzetelnosci",
  "",
  `Pytan z identyfikatorem, na ktore ramie nazw nie zwrocilo niczego: ${silentOnNamed}`,
  `z ${counted("identyfikator")}. Kazde takie pytanie to albo nazwa nieobecna w archiwum,`,
  "albo tani model wyciagajacy nazwy uciszony limitem Google, bo service.ts polyka jego",
  "bledy, zeby wyszukiwanie nie padalo przez nieudane rozpoznanie nazwy. Liczba wyraznie",
  "wieksza od zera podwaza wszystko, co stoi w wierszu nazw i w wierszu hybrydy.",
  "",
  "## Pozycja wlasciwego wpisu, pytanie po pytaniu",
  "",
  detail,
  "",
].join("\n");

// Every variant at zero is not a result, it is a corpus rebuilt after the
// questions were drawn: the ids in the file point at rows that no longer exist.
if (VARIANTS.every((v) => recallAt(runs.get(v.name)!, K) === 0)) {
  console.log("\nUWAGA: zero trafien w kazdym wariancie. questions.json wskazuje na wpisy,");
  console.log("ktorych nie ma w bazie. Odpal eval-corpus.ts i eval-search.ts po kolei.");
}

writeFileSync("eval/results.md", report);
for (const { kind, title } of KINDS) {
  console.log(`\n${title}: ${counted(kind)} pytan`);
  console.log(summaryFor((question) => question.kind === kind));
}
console.log("\nCaly zestaw");
console.log(summary);
console.log("\neval/results.md");
process.exit(0);
