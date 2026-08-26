// Zestaw pytan do pomiaru wyszukiwania, pisany recznie. Uruchamiac z backend/
// po eval-corpus.ts: npx tsx scripts/eval-questions.ts
//
// Recznie, nie modelem, i to jest decyzja metodologiczna, nie wygoda. Model pisze
// kazde pytanie w izolacji, nie widzac pozostalych, wiec bliznieta produkuje z
// koniecznosci i trzeba je potem odsiewac progiem cosinusowym, ktory jest
// zgadywanka. Kto widzi caly zestaw naraz, tych bliznat po prostu nie pisze.
//
// Cena jest realna i nalezy ja wpisac do ograniczen pomiaru: pytania uklada ten
// sam autor, ktory pisal wyszukiwarke i porzadkowal korpus. Zabezpieczenie jest
// takie, ze kazde pytanie powstalo z tresci swojego wpisu, bez sprawdzania, jak
// poradzi sobie z nim ktorekolwiek z ramion, a nazwy wlasne pojawiaja sie tam,
// gdzie czlowiek naprawde by ich uzyl.
//
// Pary pytanie-wpis sa spisane przez tresc, nie przez id: id zmienia sie przy
// kazdym przebiegu eval-corpus.ts, a tresc jest stabilna, dopoki dokumenty i
// chunker sie nie zmienia. Wpis, ktorego nie da sie odnalezc, zatrzymuje skrypt,
// bo cicho pominiete pytanie to pomiar na innym zestawie niz opisany.
process.loadEnvFile("../.env");
// Nigdy produkcja, z tego samego powodu co w eval-corpus.ts.
const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env;
if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
  throw new Error("brak POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB w ../.env");
}
process.env.DATABASE_URL_APP = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}`;

const { writeFileSync, mkdirSync } = await import("node:fs");
const { db } = await import("../src/db/client.js");
const { nodes, users, projects } = await import("../src/db/schema.js");
const { and, eq } = await import("drizzle-orm");

const EMAIL = "eval@ariadne.local";

/**
 * Pytanie i fragment tresci wpisu, ktory jest na nie odpowiedzia.
 *
 * `czego szukac` to kawalek tekstu wystepujacy w dokladnie jednym wpisie
 * korpusu. Nie jest to fraza z pytania i nie ma prawa nia byc: sluzy tylko do
 * odnalezienia wiersza, a wyszukiwarka nigdy go nie oglada.
 *
 * Zestaw dzieli sie na dwa rodzaje i to jest cala metodologia tego pomiaru.
 * Proza to pytania, ktore nie nazywaja niczego po imieniu, wiec ramie
 * leksykalne z zasady na nie milczy. Nazwy to pytania, w ktorych pada
 * identyfikator: kolumna, tabela, plik, narzedzie MCP, biblioteka. Osobno
 * liczone daja dwie liczby niezalezne od tego, jak czesto uzytkownik naprawde
 * pisze jedne albo drugie. Wymieszane w jedna liczbe daja odpowiedz na pytanie
 * o proporcje, ktorej nikt tu nie zmierzyl.
 */
const PARY_PROZA: { pytanie: string; czegoSzukac: string }[] = [
  // --- plan-ariadne.md ---
  {
    pytanie: "Na czym stoi klient desktopowy Ariadne i co jest w tym systemie jedynym zrodlem prawdy?",
    czegoSzukac: "aplikacja desktopowa Tauri 2 + Next.js jako klient",
  },
  {
    pytanie: "Ktory krój pisma wypadl z projektu razem z greckim subsetem, ktorego i tak zaden ekran nie renderowal?",
    czegoSzukac: "Literata wypadla, a z nia grecki subset",
  },
  {
    pytanie: "Ktore endpointy do obslugi tokenow lezaly w API od dawna, ale zaden ekran ich nie wolal az do ustawien?",
    czegoSzukac: "istnialy od 5a i do teraz nie mialy w aplikacji zadnego wywolania",
  },
  {
    pytanie: "Po co darmowej usludze na Renderze budzik i dlaczego nie moze on pukac w zwykla trase aplikacji?",
    czegoSzukac: "Render usypia darmowa usluge po pietnastu minutach",
  },
  {
    pytanie: "Co uzytkownik moze zrobic ze swoim archiwum rozmowa, poza samym zadawaniem pytan?",
    czegoSzukac: "pozwala edytowac baze rozmowa",
  },
  {
    pytanie: "Jak zbudowany jest klucz glowny tabeli czlonkostw i dlaczego zaproszenie ma adres e-mail jako pole opcjonalne?",
    czegoSzukac: "PRIMARY KEY (workspace_id, user_id)",
  },
  {
    pytanie: "Co konkretnie policzono na prawdziwej bazie, zeby uznac przeniesienie danych do przestrzeni za udane?",
    czegoSzukac: "2 konta, 4 projekty, 18 wezlow, zero wierszy bez wlasciciela",
  },
  {
    pytanie: "Dlaczego coder nie dostaje wpisow, ktore czekaja jeszcze na zatwierdzenie przez czlowieka?",
    czegoSzukac: "Coder nie dostaje wpisow proposed w ogole",
  },
  {
    pytanie: "Czym powinna konczyc sie sesja i co coder ma wtedy zapisac?",
    czegoSzukac: "koniec (add_context z type=session_summary)",
  },
  {
    pytanie: "Dlaczego zdanie wpisane do CLAUDE.md nie wystarcza, zeby model robil cos za kazdym razem?",
    czegoSzukac: "proza w CLAUDE.md to prosba, ktora model spelnia albo nie",
  },
  {
    pytanie: "Dlaczego spis w kontekscie startowym podsumowuje caly projekt, zamiast dobierac wpisy pod to, o czym akurat jest rozmowa?",
    czegoSzukac: "boot context jest wolany na starcie sesji, kiedy nie ma jeszcze zadnej rozmowy",
  },
  {
    pytanie: "Jakie trzy kroki wykonuje serwer, kiedy przyjmuje nowy wpis do archiwum?",
    czegoSzukac: "INSERT do nodes + anchors w jednej transakcji",
  },
  {
    pytanie: "Kiedy wolno pociac tekst po samym rozmiarze i jak duza zakladke wtedy zostawiamy?",
    czegoSzukac: "overlap ok. 15 procent",
  },
  {
    pytanie: "Ktore pole wyniku wyszukiwania wraca do codera puste, mimo ze aplikacja dostaje je wypelnione?",
    czegoSzukac: "author wraca do niego jako null",
  },
  {
    pytanie: "Co dzieje sie z kontem, ktore skasuje swoj wlasny klucz do Google?",
    czegoSzukac: "nie ma zadnego klucza serwerowego pod spodem",
  },
  {
    pytanie: "Na ktorych ekranach zyje osoba nietechniczna, a ktore dochodza osobie technicznej?",
    czegoSzukac: "Techniczny dodatkowo w 4 i 7",
  },
  {
    pytanie: "Czym ma sie konczyc pierwsze uruchomienie aplikacji zamiast przyciskiem konczacym samouczek?",
    czegoSzukac: "Konczy sie realna akcja (pierwsze pytanie)",
  },
  {
    pytanie: "Dlaczego historia pytan i historia dodawania do pamieci mieszkaja w jednej tabeli, a nie w dwoch?",
    czegoSzukac: "= ask / memory",
  },
  {
    pytanie: "Dlaczego data przestala byc skladana wersalikami w kroju maszynowym?",
    czegoSzukac: "bo data nie jest wyjsciem maszyny",
  },
  {
    pytanie: "Ile wazy paczka animacji po zastosowaniu leniwego ladowania i ile wazylaby bez niego?",
    czegoSzukac: "okolo 6 kB zamiast 34 kB",
  },
  {
    pytanie: "Jakiego rzedu miesieczny rachunek za Gemini zakladalismy przy codziennym uzywaniu?",
    czegoSzukac: "rzad 1-1.5 USD miesiecznie",
  },
  {
    pytanie: "Dlaczego odpadl pomysl postawienia tego na wlasnej maszynie od Oracle?",
    czegoSzukac: "Oracle Always Free nie wydal maszyny ARM",
  },
  {
    pytanie: "Jaki jest warunek uznania calego piatego kroku budowy za domkniety?",
    czegoSzukac: "nietechniczna osoba przechodzi onboarding bez pomocy",
  },
  {
    pytanie: "Co musi znalezc sie w odpowiedzi asystenta, zeby uznac etap czatu za skonczony?",
    czegoSzukac: "odpowiedz z cytowaniami (zrodlo, data, anchors)",
  },
  {
    pytanie: "Dlaczego prompt do pisania streszczen byl poprawiany dwa razy i co konkretnie za kazdym razem psul?",
    czegoSzukac: "regula jezyka nazywajaca polski z nazwy byla czytana jako preferencja",
  },
  {
    pytanie: "Dlaczego przejscie na prace zespolowa nie bylo zwyklym dolozeniem tabeli, tylko przepisaniem?",
    czegoSzukac: "To nie byla zmiana dodajaca, to przepisanie modelu bezpieczenstwa",
  },
  {
    pytanie: "Po jakim czasie piecioosobowy zespol dobija do sufitu spisu tresci, a po jakim osoba pracujaca sama?",
    czegoSzukac: "Solo dobije sie do niego po miesiacach",
  },
  {
    pytanie: "Czego wlasciciel nie moze dzis zrobic z przestrzenia, ktora sam zalozyl?",
    czegoSzukac: "Wlasciciel nie moze wyjsc z wlasnej przestrzeni",
  },

  // --- DESIGN.md ---
  {
    pytanie: "What are the type scale steps and the corner radius tokens this interface is allowed to use?",
    czegoSzukac: "radius: [0, 3, 6, 8, 999]",
  },
  {
    pytanie: "Which invalidation strategy is forbidden when the user switches projects, and what holds the shared state instead?",
    czegoSzukac: "as an invalidation strategy is banned",
  },
  {
    pytanie: "Which three steps may the display serif set, and what is it never allowed to typeset?",
    czegoSzukac: "It never goes below the section step",
  },
  {
    pytanie: "When does a piece of content earn a card, and when should it be a section over a hairline instead?",
    czegoSzukac: "Content you can only read is a section over a hairline",
  },
  {
    pytanie: "How is the side navigation split into groups, and why does this document count fewer screens than the build plan?",
    czegoSzukac: "why this counts six screens where the plan counts seven",
  },
  {
    pytanie: "How many animation durations does the system permit, and what happened to the single exception that once existed?",
    czegoSzukac: "was the one exception",
  },
  {
    pytanie: "What should be done with a label or a number that someone opening the app for the first time could read the wrong way?",
    czegoSzukac: "spell it out in a sentence instead",
  },

  // --- PRODUCT.md ---
  {
    pytanie: "What does Ariadne hand over to whichever agent opens the following session?",
    czegoSzukac: "handed back to whichever agent opens the next session",
  },
  {
    pytanie: "What are the three things the product's voice must never do?",
    czegoSzukac: "Never sells, never congratulates, never apologises",
  },
  {
    pytanie: "Which four pieces of information have to travel with an entry everywhere it is displayed?",
    czegoSzukac: "Source, date, project and status travel with the content",
  },
  {
    pytanie: "Where is the labyrinth metaphor allowed to shape the product, and where is it explicitly forbidden?",
    czegoSzukac: "They may not become ornament, texture or a font choice",
  },
  {
    pytanie: "Which typographic requirement disqualifies a typeface for this interface no matter how good it looks?",
    czegoSzukac: "Polish diacritics are a hard typographic constraint",
  },
];

/**
 * Ten sam korpus, pytania nazywajace rzecz po imieniu.
 *
 * Kazde z nich niesie identyfikator, ktory naprawde wystepuje we wpisie
 * bedacym odpowiedzia: kolumne, tabele, plik, narzedzie MCP albo biblioteke.
 * To jest zapytanie, dla ktorego drugie ramie w ogole powstalo, i jedyne
 * miejsce, w ktorym da sie sprawdzic, czy sie do czegos przydaje.
 *
 * Ksztalty sa tu wymieszane celowo, bo `literalsByShape` w service.ts lapie
 * tylko czesc z nich: snake_case i sciezka po znaku, camelCase po zmianie
 * wielkosci liter, plik po rozszerzeniu. Nazwy takie jak React Flow czy CORS
 * przechodza wylacznie przez tani model, wiec zestaw mierzy obie drogi naraz.
 */
const PARY_NAZWY: { pytanie: string; czegoSzukac: string }[] = [
  // --- plan-ariadne.md, schemat bazy ---
  {
    pytanie: "Dlaczego kolumna search_text uzywa konfiguracji simple, a nie slownika jezykowego?",
    czegoSzukac: "zero stemmingu i zero stopwordow",
  },
  {
    pytanie: "Dlaczego password_hash w tabeli users dopuszcza NULL i czym sa te hasla hashowane?",
    czegoSzukac: "argon2id; NULL na koncie z samego OAuth",
  },
  {
    pytanie: "Dlaczego author_id i confirmed_by maja ON DELETE SET NULL zamiast CASCADE?",
    czegoSzukac: "przezywa osobe, ktora je wypelniala",
  },
  {
    pytanie: "Jakie pola trzyma kolumna source w formacie jsonb, poza session_id i commit_sha?",
    czegoSzukac: "oryginalny surowy wpis usera przed obrobka przez tani LLM",
  },
  {
    pytanie: "W ktorej migracji doszla tabela oauth_accounts i co poza nia ma backend w oauth.ts?",
    czegoSzukac: "tabele oauth_accounts (migracja 0009)",
  },
  // --- plan-ariadne.md, kontrakt MCP ---
  {
    pytanie: "Jakie pola projektu zwraca get_project_context: dla_kogo, grupa_odbiorcza i co jeszcze?",
    czegoSzukac: "dla_kogo, grupa_odbiorcza, konwencje_ref",
  },
  {
    pytanie: "Co add_context przyjmuje na wejsciu i po co jest tam replaces_node_id?",
    czegoSzukac: "source: { session_id: string, commit_sha?: string }, replaces_node_id?: uuid",
  },
  {
    pytanie: "Co zwraca update_context, kiedy all_permission jest ustawione na false?",
    czegoSzukac: "update_context",
  },
  {
    pytanie: "Dlaczego tani model wola search_context, zanim rozbije wpis usera na wezly?",
    czegoSzukac: "najpierw wola search_context, zeby wiedziec co juz jest w bazie",
  },
  // --- plan-ariadne.md, reszta ---
  {
    pytanie: "Jakie ksztalty tokenow lapie regex wyciagajacy nazwy wlasne: snake_case, camelCase i co dalej?",
    czegoSzukac: "regex na ksztalt: snake_case, sciezki, camelCase, pliki",
  },
  {
    pytanie: "Jak liczone sa krawedzie grafu ze wspolnych code_anchors?",
    czegoSzukac: "JOIN code_anchors a2 ON a1.path = a2.path",
  },
  {
    pytanie: "Jaki sufit oznaczono komentarzem ponytail przy BY_FILE_SIZE i co robic po jego przekroczeniu?",
    czegoSzukac: "BY_FILE_SIZE",
  },
  {
    pytanie: "Dlaczego wiadomosc trzyma nodeId i pendingActionId, zamiast kopiowac status propozycji?",
    czegoSzukac: "pendingActionId",
  },
  {
    pytanie: "Dlaczego stan onboardingu siedzi w localStorage, a nie w kolumnie tabeli users?",
    czegoSzukac: "kolumna w users dla flagi bylaby zmiana schematu dla jednego boola",
  },
  {
    pytanie: "Ktora biblioteka rysuje graf i ktore dwie odpadly: react-force-graph oraz co jeszcze?",
    czegoSzukac: "react-force-graph i d3-force byly po drodze",
  },
  {
    pytanie: "Dlaczego loopback odpadl przy logowaniu przez Google i co przyjmuje sesje zamiast niego?",
    czegoSzukac: "GET /auth/handoff/:id",
  },
  {
    pytanie: "Co musialo przejsc w MCP Inspector, zeby krok 3 uznac za zrobiony?",
    czegoSzukac: "MCP Inspector przechodzi wszystkie narzedzia",
  },
  {
    pytanie: "Ktore tabele obejmuja polityki RLS i dlaczego brak ustawionej tozsamosci daje zero wierszy?",
    czegoSzukac: "Brak ustawionej tozsamosci polityki czytaja jako",
  },
  {
    pytanie: "Dlaczego brakowalo CORS, skoro front stal na 3001, a API na 3000?",
    czegoSzukac: "front na 3001 wola API na 3000",
  },
  // --- DESIGN.md ---
  {
    pytanie: "Which primitives live in components/ui.tsx, and which pieces get their own file instead?",
    czegoSzukac: "components/ui.tsx",
  },
  {
    // Nie samo "MotionConfig": ta nazwa stoi takze w bloku tokenow na poczatku
    // DESIGN.md, ktory jest odpowiedzia na inne pytanie z tego zestawu. Klucz
    // celuje w sekcje Motion, a pytanie dopyta o to, co dzieje sie mimo wylaczonego
    // ruchu, czego blok tokenow nie mowi.
    pytanie: "What does prefers-reduced-motion stop, and what still happens once MotionConfig has turned motion off per component?",
    czegoSzukac: "globally in CSS, per-component via",
  },
  {
    pytanie: "What is explained at /onboarding-tour, and what does the Two Explanations Rule allow a screen to do?",
    czegoSzukac: "/onboarding-tour",
  },
];

/**
 * Oba rodzaje w jednym zestawie, kazdy z etykieta, ktora niesie sie az do tabel.
 *
 * Etykieta brzmi "identyfikator", a nie "nazwy", bo "nazwy" nazywa sie juz jeden
 * z trzech mierzonych wariantow. Tabela z wierszem "nazwy" pod naglowkiem
 * "nazwy" nie mowi, ktore z dwoch znaczen ma sie czytac.
 */
const PARY = [
  ...PARY_PROZA.map((para) => ({ ...para, rodzaj: "proza" as const })),
  ...PARY_NAZWY.map((para) => ({ ...para, rodzaj: "identyfikator" as const })),
];

const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, EMAIL));
if (!user) throw new Error(`brak konta ${EMAIL} - odpal najpierw scripts/eval-corpus.ts`);
const [project] = await db
  .select({ id: projects.id })
  .from(projects)
  .where(eq(projects.name, "Ariadne (eval)"));
if (!project) throw new Error("brak projektu 'Ariadne (eval)' - odpal najpierw scripts/eval-corpus.ts");

const corpus = await db
  .select({ id: nodes.id, content: nodes.content })
  .from(nodes)
  .where(and(eq(nodes.projectId, project.id), eq(nodes.status, "confirmed")));

const questions = PARY.map(({ pytanie, czegoSzukac, rodzaj }) => {
  const found = corpus.filter((row) => row.content.includes(czegoSzukac));
  if (found.length === 0) {
    throw new Error(`zaden wpis nie zawiera "${czegoSzukac}" (pytanie: ${pytanie})`);
  }
  // Wieloznaczny odnosnik to wieloznaczny klucz odpowiedzi, czyli dokladnie ta
  // wada, ktorej ten zestaw ma nie miec. Lepiej zatrzymac sie tutaj.
  if (found.length > 1) {
    throw new Error(`"${czegoSzukac}" pasuje do ${found.length} wpisow (pytanie: ${pytanie})`);
  }
  return {
    question: pytanie,
    kind: rodzaj,
    node_id: found[0].id,
    doc: found[0].content.split("\n")[0],
    answer: found[0].content,
  };
});

const seen = new Set(questions.map((q) => q.node_id));
if (seen.size !== questions.length) throw new Error("dwa pytania wskazuja ten sam wpis");

mkdirSync("eval", { recursive: true });
writeFileSync(
  "eval/questions.json",
  JSON.stringify(
    { user_id: user.id, project_id: project.id, corpus: corpus.length, questions },
    null,
    2,
  ),
);

const perDoc: Record<string, number> = {};
for (const q of questions) {
  const doc = q.doc.split(" / ")[0];
  perDoc[doc] = (perDoc[doc] ?? 0) + 1;
}
const perKind: Record<string, number> = {};
for (const q of questions) perKind[q.kind] = (perKind[q.kind] ?? 0) + 1;

console.log(`${questions.length} pytan na korpusie ${corpus.length} wpisow`);
console.log(`rodzaje: ${JSON.stringify(perKind)}`);
console.log(`rozklad: ${JSON.stringify(perDoc)}`);
console.log("eval/questions.json");
process.exit(0);
