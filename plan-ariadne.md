# Ariadne. Plan wykonawczy

Warstwa pamieci dla LLM coderow. Nic ariadny: wychodzisz z sesji i wracasz dokladnie tam, gdzie skonczyles. Baza Postgres + pgvector jako jedyne zrodlo prawdy (Neon, sekcja 12), aplikacja desktopowa Tauri 2 + Next.js jako klient, komunikacja coderow przez MCP, wyszukiwanie przez RAG z cytowaniem.

## 0. Gdzie jestesmy, stan na 11.08.2026

Na main sa zmergowane kroki 1 do 5g razem z oboma redesignami UI (PR #1 do #12). MVP z sekcji 11 jest kompletne. Liczba ekranow: patrz nizej i sekcja 11.

Zrobione i sprawdzone:
- Kroki 1 do 4 zamkniete. Krok 4 potwierdzony na prawdziwym repo portfolio: coder laduje boot context, zapisuje decyzje, podsumowuje sesje, a nastepna sesja odpowiada z tego podsumowania i siega po search_context dzieki indexowi.
- Krok 5a: 16 endpointow REST, auth na argon2id i JWT HS256, tokeny, projekty, feed do zatwierdzenia. scripts/verify-rest.ts, 58 sprawdzen przez app.request() Hono. REST i MCP na jednym porcie.
- Krok 5a.1: cztery endpointy czytania i poprawiania wpisow, zmergowane. verify-rest.ts urosl do 97 sprawdzen.
- Krok 5b, ekrany 1 i 2: logowanie, rejestracja, trzy kroki onboardingu (czwarty, klucz Gemini, doszedl w kroku 5f). Przejscie od rejestracji do skopiowanego polecenia przeklikane w przegladarce, a token z tego przejscia autoryzuje sie na /mcp i zwraca wpisany profil oraz zalozona karte. Kryterium 5b w tej czesci spelnione.
- Projekt wizualny z Claude Design zaimportowany: PRODUCT.md i DESIGN.md w korzeniu, spec w design/. Tokeny przepisane do @theme, fonty w paczce lokalnie.
- Krok 5b, powloka: src-tauri stoi, okno bez dekoracji z wlasnym paskiem tytulu. Przeciaganie, minimalizacja i maksymalizacja sprawdzone w oknie. Caly przebieg od logowania do skopiowanego polecenia MCP przeklikany juz nie w przegladarce, tylko w aplikacji.

Jak uruchomic: docker compose up -d dla bazy, npm run dev w backend (port 3000), npm run tauri dev w frontend (podnosi Next na 3001 i otwiera okno; samo npm run dev daje ten sam frontend w przegladarce, tylko bez przyciskow okna). Konto lokalne zaklada scripts/seed-account.ts, haslo podaje sie mu argumentem; ustawione tak omija walidacje osmiu znakow z rejestracji.

- Ekran 3 (glowny): data ostatniego wejscia, zmiany w projekcie najnowsze na gorze, lista projektow z licznikami. GET /projects dowozi teraz nodeCount i pendingCount jednym zapytaniem. Nadpisywanie profilu przez powtorny onboarding naprawione: pusta lista projektow to warunek pierwszego uruchomienia, sprawdzany i na ekranie wejscia, i w samym onboardingu.
- Fonty wymienione na trzy glosy: Marcellus na trzy stopnie naglowkowe (skanowane), Geist na wszystko czytane zdanie po zdaniu, Martian Mono bez zmian na dane. Literata wypadla, a z nia grecki subset, ktorego zaden ekran nie renderowal. Nieaktualne od redesignu 2: Marcellus i Martian Mono tez wypadly, obowiazujace kroje sa w DESIGN.md.

- Kroki 5c i 5d: GET /projects/:id/graph, POST /chat/query (streaming NDJSON), POST /chat/edit. Ekrany 4, 5, 6 i 7 stoja, plus kolumna nawigacji i wylogowanie. Caly lancuch przeklikany w oknie: pytanie do asystenta dostaje odpowiedz z cytowaniami, rozmowa z baza tworzy propozycje, a ekran zatwierdzania je rozstrzyga.

Czego brakuje w 5b: nic. Krok domkniety.

- Redesign UI (planUI.md): karty zamiast ciaglych hairline'ow, prawdziwy project switcher, czytelny active state, composer na dashboardzie oddajacy pytanie asystentowi, zwijane zrodla, kolejka grupowana po projekcie, projekt jako profil do czytania, split screen na logowaniu z obrazem z public/. Doszly toasty po kazdym zapisie i empty states mowiace co dalej. DESIGN.md przepisany: Paper Rule (zero radius powyzej 2px, zadnych kart) zastapiona Card Rule.

- Tryb zespolowy (dawny krok 7, wyciagniety przed MVP na prosbe usera): wlascicielem archiwum jest workspace, nie osoba. Dochodza tabele workspaces, memberships i invites, a projects, nodes, pending_actions i api_tokens przechodza z user_id na workspace_id. Kazde konto dostaje przy rejestracji prywatny workspace, wiec praca w pojedynke to workspace z jednym czlonkiem i w kodzie nie ma dwoch sciezek. Zaproszenie to kod do skopiowania, opcjonalnie zwiazany z adresem. Token MCP nalezal wtedy do workspace; od kroku 5h nalezy do maszyny i siega wszystkich archiwow swojego wlasciciela, wiec coder kolegi czyta ten sam kontekst i widzi, kto co zapisal. verify-rest.ts urosl ze 105 do 155 sprawdzen.
- Ekran 8 (ustawienia): konto z profilem, zmiana hasla, przelacznik jezyka, automatyczne zatwierdzanie, tokeny z lista i odwolywaniem, zespol z czlonkami i zaproszeniami. GET /tokens i DELETE /tokens/:id istnialy od 5a i do teraz nie mialy w aplikacji zadnego wywolania.
- Doszly tez: limit prob logowania (licznik w pamieci procesu, 10 na 15 minut na adres) i PUT /me/password.

Zostaje z MVP: nic. Ekranow numerowanych jest siedem, nie osiem: chat RAG przestal
byc osobnym ekranem i mieszka na przegladzie (sekcja 11). W powloce aplikacji zyje
szesc tras, bo logowanie i onboarding stoja poza powloka - stad szesc w DESIGN.md
i siedem tutaj, przy tym samym produkcie.

- Redesign 2 (branch feature/ui-redesign-2, po merge'u #11 i #12): nowy jezyk
  wizualny - ciepla kosc zamiast chlodnej szarosci, Bodoni Moda na naglowkach
  (Marcellus wypadl; Bodoni utrzymal sie jedno popoludnie i ustapil Playfair
  Display, patrz DESIGN.md), Geist Mono tylko dla outputu maszyny (Martian Mono
  wypadl), jeden akcent marki: madderowa nic (przyciski primary sa atramentowe).
  Powloka przeniesiona do route group (shell) z trwalym layoutem i AppProviderem:
  zero window.location.reload, zmiana projektu dzieje sie w miejscu, marker
  nawigacji plynie. Graf przepisany na d3-force (jedyna nowa zaleznosc) z
  ksztaltami statusow i legenda; nieaktualne, graf stoi dzis na React Flow
  (sekcja 12). Naprawione wieczne "Wczytuje..." na /project
  (konto z jednym projektem nie zapisywalo activeProject) i na /settings przy
  padnietym fetchu - oba maja stany bledu z retry. DESIGN.md przepisany.
  Druga fala tego samego brancha, 09.08.2026, juz z klikania: pole z pytaniem
  stoi na srodku okna z pytaniem nad nim, kolumna nawigacji chowa sie i wraca na
  zblizenie kursora (wjazd z lewej, 200ms na krzywej enter), naglowki sekcji
  poszly o krok skali w gore, a to, co jest pod zgieciem, wystaje na tyle, zeby
  bylo widac, ze ekran ma ciag dalszy. Wysokosci zyja w dwoch narzedziach w
  globals.css: screen-content to cale widoczne okno, screen-opening to okno bez
  jednego kroku skali.

- Krok 5f, branch feature/ui-redesign-2, 09.08.2026. Trzy rzeczy naraz, wszystkie
  wyszly z klikania po gotowej aplikacji, nie z planu. Streszczenia wpisow pisane
  przez model przy zapisie (kolumna nodes.summary): karta prowadzi dziesiecioma
  slowami, a to, co user napisal, czeka pod "pokaz wiecej". Wlasny klucz Gemini
  per konto, zapieczetowany AES-256-GCM kluczem wyprowadzonym z JWT_SECRET, z
  polem w ustawieniach i osobnym krokiem w onboardingu, zeby nikt nie zgadywal,
  czemu czat milczy. Wykrywanie sprzecznosci przy zapisie: wektory zawezaja do
  kilku sasiadow, model czyta pare i mowi, czy to kolizja, a czlowiek rozstrzyga
  jednym klikiem na gotowym juz superseded_by. Do tego status z kanalu (sekcja 4)
  i scalenie ekranu 5 z ekranem 3 (sekcja 11).

- Krok 5g, branch feature/rls-and-boot-index, 11.08.2026. Dwie rzeczy wyciagniete
  z kroku 6 przed hostingiem. Row-Level Security: druga rola w bazie, polityki na
  pieciu tabelach archiwum, tozsamosc wstrzykiwana na transakcje zadania, wiec
  zapomniany where-clause nie jest juz wyciekiem. Spis tresci w boot contextcie
  przestal klamac, ze jest kompletem: mowi ile wpisow jest naprawde i o ktorych
  plikach, zamiast pokazywac dziesiec najnowszych i milczec o reszcie.
  Instrukcja postawienia tego na serwerze siedzi w setup.md, poza gitem, bo
  trzyma adresy i hasla.

  Hosting przestawiony z VPS-a na uslugi zarzadzane (Render plus Neon, oba za
  zero). Wymusilo to trzy drobiazgi w kodzie: skrypty build i start, czyli
  kompilacja przez tsc zamiast tsx w locie, engines na Node 22 oraz trasa
  /healthz. Ta ostatnia jest jedyna, ktora nie dotyka bazy, i to nie jest
  kosmetyka: Render usypia darmowa usluge po pietnastu minutach, wiec potrzebny
  jest budzik, a Neon rozlicza godziny rozbudzonej bazy, wiec budzik pukajacy w
  cokolwiek innego zjadlby jej miesieczny limit w polowie miesiaca. Osobna
  pulapka, opisana w setup.md: role aplikacyjnej nie wolno zakladac z panelu
  Neona, bo takie role dostaja neon_superuser wraz z BYPASSRLS i cicho przechodza
  przez wszystkie polityki z migracji 0008. Musi powstac z SQL, czyli tak, jak
  robi to migracja.

Decyzja, ktora czekala na usera, zostala podjeta:
1. Logowanie przez Google: ZROBIONE, razem z GitHubem. Backend ma oauth.ts, tabele oauth_accounts (migracja 0009) i cztery trasy wyliczone w sekcji 10. Haslo zostalo jako droga rownorzedna, wiec users.password_hash jest od tej pory nullowalny.

Czego swiadomie nie ma po redesignie: przycisku "Zatwierdz wszystkie" (brak endpointu wsadowego, a hurtowe zatwierdzanie nieprzeczytanej wiedzy kloci sie z zasada, ze nic nie trafia do pamieci bez swiadomej zgody). Sekcja "ostatnia aktywnosc" zlozona z updatedAt i createdAt, bez tabeli zdarzen.

## 1. Problem i cel

- Sesje LLM sie urywaja, kontekst nie zapisuje sie automatycznie, kolejna sesja marnuje tokeny na domyslanie sie, gdzie skonczono.
- Brak jednego miejsca z kontekstem o userze i projektach, LLM nie uczy sie na bledach.
- Szczegolny bol dla osob nietechnicznych, ktore widza tylko output.
- Cel: Ariadne pamieta decyzje, podsumowania sesji i kontekst projektu, jest dostepna dla Claude Code, Codex i innych coderow przez MCP, odpowiada na pytania przez RAG z cytowaniem, pozwala edytowac baze rozmowa.

Czym Ariadne NIE jest: nie mapuje codebase (AST, call graph). Kod czyta coder z repo. Ariadne trzyma warstwe "dlaczego": decyzje, podsumowania, kontekst. Punkt odniesienia: Graphify robi mape "co i gdzie" w kodzie, Ariadne robi warstwe "dlaczego".

## 2. Architektura

```
Claude Code / Codex          Aplikacja Tauri (klient)
        |                            |
   MCP (streamable HTTP)        REST API (email+haslo, JWT)
        |                            |
        +-------------+--------------+
                      |
              Backend na Render (Node/TS)
              jedna warstwa serwisowa,
              dwa transporty (MCP + REST)
                      |
        +-------------+--------------+
        |                            |
  Postgres + pgvector          Gemini API
  (zrodlo prawdy)              (embeddingi: gemini-embedding-001 (output_dimensionality: 768),
                                tani LLM: gemini-3.5-flash-lite)
```

Zasady architektoniczne:
- Logika biznesowa istnieje raz, w warstwie serwisowej. Narzedzia MCP i endpointy REST to cienkie wrappery na te same funkcje.
- Embeddingi liczy zawsze serwer. Klient (coder, aplikacja) przysyla czysty tekst.
- Tauri: Next.js w trybie static export (output: "export"). Zero SSR, zero API routes w aplikacji. Wszystkie dane przez REST do backendu.
- Kod projektu nigdy nie laduje w bazie. Baza trzyma notatki, decyzje, podsumowania i wskazniki (sciezki, symbole, SHA).

## 3. Schemat bazy (gotowy SQL)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text,                       -- argon2id; NULL na koncie z samego OAuth
  profile       text NOT NULL DEFAULT '',   -- lekki profil: kim jest, jak lubi pracowac
  all_permission boolean NOT NULL DEFAULT false,
  gemini_key    text,                       -- wlasny klucz do Google, zapieczetowany AES-256-GCM
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Ktora tozsamosc zewnetrzna otwiera ktore konto. Wiersz na dostawce, nie para
-- kolumn na users, bo jedna osoba moze miec haslo, Google i GitHuba naraz.
CREATE TABLE oauth_accounts (
  provider         text NOT NULL CHECK (provider IN ('google','github')),
  provider_user_id text NOT NULL,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_user_id)
);

-- Wlasciciel archiwum. Kazde konto dostaje swoj prywatny przy rejestracji,
-- wiec praca w pojedynke to workspace z jednym czlonkiem.
CREATE TABLE workspaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  owner_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Cala regula dostepu. Kazda bramka w warstwie serwisowej to join przez ta tabele.
CREATE TABLE memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Kod do skopiowania, nie mail: nie ma nadawcy ani publicznego adresu, w ktory
-- odbiorca mialby kliknac. email jest opcjonalny i wiaze kod z jednym adresem.
CREATE TABLE invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  code         text UNIQUE NOT NULL,
  email        text,
  created_by   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   timestamptz NOT NULL,
  accepted_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  accepted_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,      -- kto wygenerowal
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,          -- martwe od kroku 5h, patrz nizej
  token_hash text UNIQUE NOT NULL,           -- sha256 tokenu; token pokazany raz przy generacji
  label      text NOT NULL DEFAULT '',      -- np. "laptop praca"
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            text NOT NULL,
  repo_ref        text NOT NULL,            -- URL git remote origin, znormalizowany (bez .git, lowercase host)
  opis            text NOT NULL DEFAULT '', -- jedno zdanie: co to i po co
  stack           text NOT NULL DEFAULT '', -- wysokopoziomowo, bez wersji
  dla_kogo        text NOT NULL DEFAULT '', -- dla siebie / dla kogos
  grupa_odbiorcza text,                     -- tylko jesli dla kogos
  konwencje_ref   text,                     -- ODNOSNIK do pliku w repo, nie kopia
  ograniczenia    text NOT NULL DEFAULT '', -- twarde granice, czego NIE robic
  etap            text NOT NULL DEFAULT 'prototyp'
                    CHECK (etap IN ('prototyp','produkcja','utrzymanie')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, repo_ref)
);

CREATE TABLE nodes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Kto zapisal i kto zatwierdzil. SET NULL, nie CASCADE: wspolne archiwum
  -- przezywa osobe, ktora je wypelniala.
  author_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  type       text NOT NULL CHECK (type IN ('session_summary','decision','note')),
  content    text NOT NULL,                 -- jedna mysl po ludzku; to idzie do embeddingu
  summary    text NOT NULL DEFAULT '',      -- dziesiec slow od modelu; linijka, ktora prowadzi karte
  -- Wpisy, ktorym ten zaprzecza. Podejrzenie, nie werdykt: czlowiek mowi, ktory
  -- zostaje, i wtedy ta lista pustoszeje, a odpowiedz niesie superseded_by.
  conflicts_with uuid[] NOT NULL DEFAULT '{}',
  status     text NOT NULL DEFAULT 'proposed'
               CHECK (status IN ('proposed','confirmed','contradicted','archived')),
  source     jsonb NOT NULL DEFAULT '{}',   -- patrz format nizej
  -- Wpis, ktory ten uniewaznil. Ustawiany razem ze statusem contradicted; bez
  -- niego status mowi "juz nieprawda" i nie mowi, co weszlo na jego miejsce.
  superseded_by uuid REFERENCES nodes(id) ON DELETE SET NULL,
  embedding  vector(768) NOT NULL,
  -- Leksykalna polowa wyszukiwania (sekcja 7). Kolumna generowana, konfiguracja
  -- 'simple': zero stemmingu i zero stopwordow, bo archiwum jest dwujezyczne, a
  -- do tego indeksu trafiaja wylacznie nazwy wlasne.
  search_text tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX nodes_lookup ON nodes (workspace_id, project_id, status, created_at DESC);
CREATE INDEX nodes_embedding_hnsw ON nodes
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX nodes_search_gin ON nodes USING gin (search_text);

CREATE TABLE code_anchors (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  path    text NOT NULL,                    -- sciezka wzgledna od korzenia repo
  symbol  text,                             -- funkcja / klasa, opcjonalnie
  sha     text                              -- commit SHA, opcjonalnie
);
CREATE INDEX code_anchors_by_path ON code_anchors (path);
CREATE INDEX code_anchors_by_node ON code_anchors (node_id);

CREATE TABLE pending_actions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  node_id      uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  action       text NOT NULL CHECK (action IN ('update','delete')),
  payload      jsonb NOT NULL DEFAULT '{}', -- dla update: { "content": "...", "anchors": [...] }
  requested_by text NOT NULL CHECK (requested_by IN ('coder','app_agent')), -- kanal
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,        -- osoba
  resolved_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

-- Historia rozmow, obu rodzajow (sekcja 11b). Zostaje przy user_id, bo rozmowa
-- jest wlasnoscia osoby, nie zespolu.
CREATE TABLE conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('ask','memory')),
  title      text NOT NULL DEFAULT '',
  messages   jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- KROK 2, nie MVP:
CREATE TABLE edges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node_id   uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('replaces','related')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_node_id, to_node_id, type)
);
```

Kto co widzi: conversations zostaje przy user_id, bo rozmowa jest wlasnoscia osoby, nie zespolu. Wszystko inne nalezy do workspace. Migracje 0003 do 0005 przeniosly istniejace dane: kazdy user dostal prywatny workspace nazwany swoim adresem, a jego projekty, wezly, kolejka i tokeny trafily do niego. Sprawdzone na prawdziwej bazie: 2 konta, 4 projekty, 18 wezlow, zero wierszy bez wlasciciela.

Format kolumny source (jsonb):
```json
{
  "session_id": "uuid wygenerowany przez codera na start sesji",
  "commit_sha": "opcjonalnie, SHA powiazanego commita",
  "raw_input": "opcjonalnie, oryginalny surowy wpis usera przed obrobka przez tani LLM",
  "channel": "coder | app_chat | app_form"
}
```

## 4. Statusy: pelny automat

| Z | Do | Wyzwalacz |
|---|----|-----------|
| proposed | confirmed | klik "potwierdz" w feedzie aplikacji |
| proposed | archived | klik "odrzuc" w feedzie aplikacji |
| proposed | contradicted | nowy add_context z replaces_node_id wskazujacym ten wezel |
| confirmed | contradicted | jak wyzej (potwierdzone tez mozna odwrocic nowa decyzja) |
| proposed lub confirmed | contradicted | rozstrzygniecie wykrytej sprzecznosci: czlowiek mowi, ktory wpis zostaje |
| contradicted | archived | klik usera w feedzie |
| dowolny | archived | zatwierdzone delete_context |

Wpis napisany w aplikacji nie zaczyna od proposed. Status bierze sie z kanalu:
kanal coder laduje jako proposed i czeka w kolejce, bo coder pisze bez nadzoru,
a app_chat i app_form laduja od razu jako confirmed z podpisem tego, kto je
napisal. Kolejka istnieje dla wpisow powstalych, gdy nikogo nie bylo przy
ekranie; proszenie czlowieka o zatwierdzenie zdania, ktore sam wlasnie napisal i
przeczytal na ekranie, bylo tym samym klikiem dwa razy. To samo dotyczy zmian i
usuniec proponowanych przez czat pamieci: dzieja sie od razu.

Zasady:
- Zapis nigdy nie jest blokowany. Wszystko wchodzi od razu, status niesie zaufanie.
- Nic nie kasujemy fizycznie. archived znika z wynikow RAG (filtr w zapytaniu), ale zostaje w bazie.
- Odczyt RAG zwraca status przy kazdym wezle. Coder nie dostaje wpisow proposed w ogole: search_context zawezony do confirmed, wiec wszystko, co coder czyta, przeszlo juz przez czlowieka albo przez all_permission.
- Awansowanie "przez przezycie" (proposed starsze niz N sesji -> confirmed automatycznie): PO MVP, na start tylko klik. Zadnego automatu czasowego w bazie nie ma, w zadna strone.

## 5. Dwie drogi wejscia

Droga 1, coder przez MCP: oddaje gotowe, jednomyslowe wezly. Bez taniego LLM po drodze (slabszy model nie moze psuc outputu mocniejszego). Kontrakt wymusza schema narzedzia; odrzucony input wraca z konkretnym bledem i coder ponawia.

Droga 2, user w aplikacji: surowy tekst dowolnej jakosci trafia do taniego LLM (gemini-3.5-flash-lite), ktory:
1. najpierw wola search_context, zeby wiedziec co juz jest w bazie,
2. rozbija wpis na jednomyslowe wezly,
3. dla kazdego proponuje: type, project, anchors, oraz operacje (dodaj nowy / edytuj istniejacy / usun),
4. dodania, edycje i usuniecia wykonuje od razu: user czyta je na ekranie w chwili, gdy powstaja (sekcja 4),
5. oryginalny wpis zawsze laduje w source.raw_input.

Brama walidacji (kod, nie LLM), wspolna dla obu drog: pola wypelnione, content niepusty i krotszy niz 4000 znakow, project istnieje i nalezy do przestrzeni z tokena, status bierze sie z kanalu (sekcja 4), anchors maja poprawny format sciezki.

## 6. Petla sesji codera i snippet

Definicja sesji: jedno uruchomienie codera. Coder generuje session_id (uuid) na starcie i przekazuje go w source kazdego zapisu.

Petla: start -> get_project_context (boot context: profil + karta projektu + ostatnie session_summary + index; gdy brak podsumowania, sama karta i profil) -> praca (add_context na biezaco po waznych decyzjach, search_context gdy potrzebny kontekst historyczny) -> koniec (add_context z type=session_summary).

### Index w boot context: dlaczego istnieje (NIE USUWAC bez zamiennika)

Zweryfikowane na zywo w kroku 4, na prawdziwym repo portfolio, dwie sesje Claude Code.

Objaw: coder wolal get_project_context i na tym konczyl kontakt z pamiecia. search_context nie poszedl ANI RAZU, w zadnej sesji, mimo instrukcji w CLAUDE.md ("gdy potrzebujesz kontekstu z przeszlosci, uzyj search_context") i mimo pytania skrojonego pod wyszukiwanie ("dodaje nowy projekt, o czym pamietac"). Odpowiedzi model dorabial z czytania kodu.

Wyszukiwarka byla sprawna przez caly czas. To samo pytanie puszczone recznie przez curl zwrocilo wlasciwa notatke na pierwszym miejscu, similarity 0.759, z trescia bogatsza niz odpowiedz modelu (wniosek operacyjny "sprawdz /pl recznie, nie ufaj zielonemu buildowi", ktorego model nie podal, bo nigdy tej notatki nie zobaczyl).

Przyczyna: boot context wyglada na komplet. Trzy pola, wszystkie wypelnione, zero sygnalu ze pod spodem lezy graf. Model nie szuka, bo nie wie, ze jest czego szukac. Caly graf jest niewidzialny.

Wniosek ogolny, wazniejszy od samego fixa: proza w CLAUDE.md to prosba, ktora model spelnia albo nie. Odpowiedz narzedzia to fakt, ktorego nie da sie przeoczyc. Co ma dzialac zawsze, ma byc w odpowiedzi narzedzia, nie w instrukcji.

Fix: get_project_context zwraca index, czyli naglowki wszystkich decision i note (bez tresci). Model widzi ze cos jest i o czym, po tresc siega przez search_context. Naglowek to pierwsza linia content uciete do 120 znakow, bez nowej kolumny w schemacie.

Sufit tego rozwiazania: dziesiec najnowszych naglowkow. Przy okolo stu wezlach przestaje to byc spis tresci, a staje sie losowa probka i problem wraca w gorszej formie, bo index bedzie wygladal na komplet. Zdjety 11.08.2026, branch feature/rls-and-boot-index, bez zwiekszania limitu (zwiekszenie tylko przesuwa sciane). Index nie jest juz tablica, tylko obiektem z czterema polami:

- `total`: ile wpisow jest naprawde, liczone `count(*) over ()` na tym samym zapytaniu, wiec za darmo,
- `showing`: ile naglowkow ponizej. Roznica miedzy tymi dwoma liczbami jest calym fixem, bo zamienia "to jest archiwum" w "to jest probka",
- `by_file`: agregat po `code_anchors.path`, dwadziescia plikow z najwieksza liczba wpisow. To jest ta czesc, ktora nie starzeje sie z rozmiarem archiwum. "O service.ts mamy cztery wpisy" jest prawda przy stu i przy tysiacu wezlow, a coder i tak zaraz otworzy jakis plik,
- `headlines`: to, co bylo.

Wybrana zostala wiec pierwsza z dwoch sciezek zapisanych wyzej (anchors), tylko jako agregat calego projektu, a nie dopasowanie do biezacej rozmowy: boot context jest wolany na starcie sesji, kiedy nie ma jeszcze zadnej rozmowy, po ktorej mozna dopasowywac. Klastrowanie tematyczne odpada na tym etapie, bo to wywolanie modelu przy kazdym starcie sesji.

Nowy sufit, oznaczony `ponytail:` przy `BY_FILE_SIZE`: dwadziescia plikow. Archiwum rozlane na wiecej ma ogon, ktorego ta lista nie nazwie, i wtedy wlasciwym ruchem jest wybor plikow po tym, czego sesja dotyka, a nie podniesienie liczby.

Snippet generowany przy setupie (user wybiera codera, dostaje plik docelowy i tresc). Wersja dla CLAUDE.md:

```markdown
## Ariadne (pamiec miedzy sesjami)

Na poczatku sesji: wywolaj get_project_context z repo_ref tego repo,
zeby wiedziec kim jest user, czym jest projekt i gdzie skonczylismy.

W trakcie pracy:
- Po kazdej waznej decyzji (wybor podejscia, biblioteki, architektury,
  zalozenie przyjete bez pytania usera) zapisz ja przez add_context
  jako type=decision, jedna decyzja = jeden wpis, z anchors do plikow
  ktorych dotyczy.
- Jesli nowa decyzja odwraca wczesniejsza, podaj replaces_node_id.
- Gdy potrzebujesz kontekstu z przeszlosci, uzyj search_context
  zamiast zgadywac.

Przed zakonczeniem sesji: zapisz przez add_context krotkie podsumowanie
(type=session_summary): co zrobiono, gdzie skonczono, co dalej.
```

Plik docelowy per coder: Claude Code -> CLAUDE.md, Codex -> AGENTS.md, inne -> ich odpowiednik. Instrukcja w pliku to best effort; dla Claude Code setup proponuje dodatkowo hook konca sesji (deterministyczny zapis podsumowania). Tresc hooka: skrypt wolajacy add_context przez MCP z transkryptem ostatnich commitow sesji jako materialem.

## 7. RAG: dokladny przeplyw

Zapis wezla:
1. walidacja (sekcja 5),
2. serwer liczy embedding content przez gemini-embedding-001 z output_dimensionality: 768,
3. INSERT do nodes + anchors w jednej transakcji.

Odczyt (search_context) pyta dwa razy o to samo, bo wektory i nazwy wlasne
psuja sie na odwrotnych rzeczach. Embedding czyta sens i zaciera tozsamosc:
notatka, ktora nigdy nie pada nazwy funkcji, lezy tak samo blisko pytania o nia
jak ta, ktora ja wymienia. Dopasowanie doslowne jest lustrzanym odbiciem, nigdy
nie pomyli tych dwoch i nigdy nie zobaczy, ze "ktory ORM" i "wybralismy Drizzle"
to jedno pytanie.

1. rownolegle: embedding pytania tym samym modelem oraz wyciagniecie nazw
   wlasnych z pytania (regex na ksztalt: snake_case, sciezki, camelCase, pliki,
   hash commita; plus tani LLM na to, czego ksztalt nie zdradza, jak "Hono"),

   Tani LLM wypadl 26.08.2026, po pomiarze opisanym w docs/rag-case-study.md.
   Lapal nazwy bez charakterystycznego ksztaltu (React Flow, CORS, RLS) i to
   dzialalo, ale dokladal okolo 500 ms do kazdego wyszukiwania, takze do tych
   czterech na piec, ktore nie nazywaja niczego i nic z tego czekania nie mialy.
   Zostaje sam regex, a razem z LLM znika rownoleglosc: nie ma juz drugiego
   wywolania, na ktore trzeba czekac. Nazwy, ktorych ksztalt nie zdradza, nie sa
   dzis znajdowane wcale i jest to swiadomie przyjeta polowa tej wymiany.

2. ramie znaczeniowe: dwadziescia kandydatow po cosine distance,
3. ramie doslowne: dwadziescia kandydatow po search_text, przez
   websearch_to_tsquery('simple', ...) laczone przez OR i sortowane ts_rank_cd.
   Pytanie bez ani jednej nazwy wlasnej pomija ten krok i wtedy calosc jest
   dokladnie tym wyszukiwaniem, ktorym byla przed dolozeniem drugiego ramienia,
4. scalenie po pozycji, nie po wyniku (RRF, damping 60): cosine jest ograniczone
   i sciesnione przy gornym koncu, ts_rank_cd nieograniczone i wykalibrowane
   wzgledem niczego, wiec zadne wazenie ich nie pogodzi. Pozycja to jedyna
   rzecz, ktora obie listy rozumieja tak samo,
5. przyciecie do k, dociagniecie anchors dla tego, co zostalo, jednym zapytaniem,
6. zwrotka per wezel: { id, type, content, summary, status, similarity, source,
   author, anchors[], created_at }. Dla kanalu coder author jest zawsze null.

Oba ramiona sa zawezone tym samym filtrem: workspace z tokena, projekt, nie
archived, a dla kanalu coder dodatkowo tylko confirmed i tylko typy decision
oraz note.

Zasady:
- Filtr metadanych zawsze PRZED podobienstwem. Metadane zawezaja, wektory trafiaja.
- k = 5 domyslnie, parametr narzedzia pozwala 1..10. Kandydatow kazde ramie zbiera dwadziescia: scalanie dwoch piatek to nie scalanie, tylko przeciecie.
- archived nigdy w wynikach.
- Cytowanie robi konsument (coder / LLM w aplikacji) z pola source i created_at ("to z sesji z wtorku, commit abc123").

Chunking: jedna mysl na wezel zalatwia niemal wszystko. Dluzsze teksty tnie tani LLM po granicach znaczenia. Awaryjne ciecie po rozmiarze z zakladka (overlap ok. 15 procent) tylko gdy pojedyncza mysl przekracza limit 4000 znakow. Nigdy slepe ciecie co X znakow.

## 8. Graf polaczen

MVP:
- Krawedzie ze wspolnych code_anchors, liczone w locie:
```sql
SELECT a1.node_id AS from_id, a2.node_id AS to_id, a1.path
FROM code_anchors a1
JOIN code_anchors a2 ON a1.path = a2.path AND a1.node_id < a2.node_id
JOIN nodes n1 ON n1.id = a1.node_id
JOIN nodes n2 ON n2.id = a2.node_id
WHERE n1.project_id = $project_id AND n2.project_id = $project_id
  AND n1.status != 'archived' AND n2.status != 'archived';
```
- Podobienstwo embeddingow liczone w locie do wizualizacji, tylko pary powyzej progu krawedzi 0.75, max 3 najblizszych sasiadow na wezel (bez progu graf robi sie klebkiem). To inna liczba niz prog wykrywania sprzecznosci przy zapisie, ktory wynosi 0.7 (krok 5f).
- Wizualizacja w aplikacji: React Flow (@xyflow/react), status niesiony ksztaltem markera, nie samym kolorem (DESIGN.md), klik = podglad tresci i anchors.

Krok 2:
- Tabela edges, typ replaces tworzony automatycznie przy add_context z replaces_node_id.
- Graph RAG: po znalezieniu top-k wezlow dociagnij sasiadow po krawedziach (1 skok) i dolacz do zwrotki z oznaczeniem "powiazane". Laczy rzeczy napisane innymi slowami, ktorych czysty vector search nie znajdzie.

## 9. Kontrakt MCP (pelne schematy)

Serwer: MCP streamable HTTP na Render, endpoint /mcp. Auth: naglowek Authorization: Bearer <token>; serwer haszuje token i szuka w api_tokens. Token mowi kto dzwoni i nic o tym gdzie (krok 5h): scope wybiera repo_ref sposrod archiwow, do ktorych wlasciciel tokena nalezy, a user_id z tokena sluzy do podpisania wpisu.

get_project_context
- input: { repo_ref: string }
- output: { profile: string, project: { name, opis, stack, dla_kogo, grupa_odbiorcza, konwencje_ref, ograniczenia, etap }, last_summary: { content, created_at } | null, index: { total, showing, by_file: [ { path, entries } ], headlines: [ { node_id, type, headline } ] } }
- index: od 11.08.2026 obiekt, nie tablica. Naglowki (pierwsza linia content, max 120 znakow) dziesieciu najnowszych wezlow confirmed typu decision i note, plus total i showing, ktore mowia wprost, ze to probka, plus by_file z dwudziestoma plikami o najwiekszej liczbie wpisow. Powod istnienia i sufit: sekcja 6. Bez tego coder nie wola search_context w ogole.
- blad gdy repo nieznane: { error: "unknown_repo", message: "Zaloz projekt w aplikacji Ariadne i podaj repo_ref: <znormalizowany url>" }
- blad gdy ten sam adres jest w dwoch archiwach czytelnika: { error: "ambiguous_repo" } z nazwami projektow i archiwow, HTTP 409 po stronie REST. Coder odmawia zamiast zgadywac: zgadniecie rozdziela archiwum jednego projektu na pol.

search_context
- input: { repo_ref: string, query: string, k?: number (1..10, default 5) }
- output: { results: [ { id, type, content, summary, status, similarity, source, author, anchors: [{path, symbol, sha}], created_at } ] }
- coder widzi wylacznie wpisy confirmed typu decision i note, a author wraca do niego jako null: adresy zespolu nie maja po co wchodzic do promptu

add_context
- input: { repo_ref: string, type: "decision"|"note"|"session_summary", content: string (max 4000), anchors?: [{path, symbol?, sha?}], source: { session_id: string, commit_sha?: string }, replaces_node_id?: uuid }
- source.channel nie jest polem wejsciowym: wejscie przez MCP oznacza codera, wiec serwer wpisuje "coder" sam
- output: { node_id: uuid, status: "proposed" | "confirmed", conflicts_with: uuid[], contradicted_node_id?: uuid }
- status "confirmed" wraca tylko na koncie z wlaczonym all_permission; domyslnie wpis codera czeka w kolejce
- efekt replaces_node_id: wskazany wezel dostaje status contradicted (w kroku 2 dodatkowo krawedz replaces)

update_context
- input: { node_id: uuid, content?: string, anchors?: [...] }
- output przy all_permission=false: { pending_action_id: uuid, status: "pending", message: "Czeka na zatwierdzenie w aplikacji" }
- output przy all_permission=true: { node_id, status: "updated" }
- TWARDY WYMOG: wykonanie edycji (od razu lub po zatwierdzeniu) przelicza embedding, bo tresc sie zmienila. Bez tego RAG szuka po nieaktualnym znaczeniu.
- Bez historii wersji w MVP; source.raw_input zostaje jako oryginal.

delete_context
- input: { node_id: uuid }
- output: analogicznie do update (pending albo wykonane)
- wykonanie = status archived, nigdy fizyczny DELETE

## 10. REST API aplikacji

Auth: POST /auth/register (email, haslo), POST /auth/login -> JWT, haslo hashowane argon2id. Rejestracja otwarta w MVP.

- GET  /me                    profil + flaga all_permission
- PUT  /me/profile            edycja profilu
- PUT  /me/all-permission     przelacznik trybu
- POST /tokens                generacja tokenu MCP (zwrocony raz, sama etykieta w body), GET /tokens lista, DELETE /tokens/:id
- GET  /projects              lista projektow przestrzeni
- POST /projects              zalozenie projektu (karta)
- PUT  /projects/:id          edycja karty
- POST /projects/:id/workspace  przeniesienie projektu do innego archiwum, wlasciciel zrodla i czlonek celu
- GET  /projects/:id/graph    wezly + krawedzie wyliczone (sekcja 8) do wizualizacji
- GET  /pending               feed pending_actions + wezly proposed/contradicted do przejrzenia
- POST /pending/:id/approve   wykonuje operacje (dla update: przeliczenie embeddingu)
- POST /pending/:id/reject
- POST /nodes/:id/confirm     proposed -> confirmed
- POST /nodes/:id/archive     odrzucenie / archiwizacja
- POST /nodes/:id/conflicts/resolve  rozstrzygniecie sprzecznosci: new, old albo both
- PUT  /me/gemini-key         wlasny klucz do Gemini (sprawdzany jednym embed przed zapisem)
- DELETE /me/gemini-key       usuniecie klucza; nie ma zadnego klucza serwerowego pod spodem, wiec konto bez wlasnego nie zapisze wpisu ani nie zada pytania
- POST /chat/query            pytanie do asystenta RAG (streaming odpowiedzi)
- POST /chat/edit             konwersacyjny edytor bazy (tani LLM z narzedziami)
- PUT  /me/password           zmiana hasla (obecne + nowe)
- GET  /workspaces            przestrzenie, do ktorych naleze, z rola i liczba osob
- POST /workspaces            zalozenie kolejnej
- GET  /workspaces/:id/members
- DELETE /workspaces/:id/members/:userId   usuniecie przez wlasciciela albo wyjscie wlasne
- GET  /workspaces/:id/invites             otwarte zaproszenia
- POST /workspaces/:id/invites             nowy kod, opcjonalnie zwiazany z adresem
- DELETE /invites/:id                      uniewaznienie
- POST /invites/:code/accept               dolaczenie zalogowanego konta
- GET  /auth/providers                     ktore logowania zewnetrzne sa wlaczone
- GET  /auth/:provider/start               poczatek OAuth (google | github)
- GET  /auth/:provider/callback            powrot od dostawcy
- GET  /auth/handoff/:id                   odbior sesji przez aplikacje
- GET  /projects/:id/nodes                 listowanie z filtrami i kursorem (5a.1)
- POST /search                             to samo co search_context, dla aplikacji (5a.1)
- PUT  /nodes/:id                          poprawka tresci przez czlowieka (5a.1)
- POST /nodes/:id/contradict               uniewaznienie wpisu nastepca (5a.1)
- GET/POST /conversations, GET/PUT/DELETE /conversations/:id   historie rozmow (11b)
- GET  /healthz                            jedyna trasa nietykajaca bazy

Wszystkie endpointy poza /auth/* wymagaja JWT. Scope idzie po workspace przez join do memberships, nie po user_id: projekt widzi kazdy czlonek przestrzeni, do ktorej projekt nalezy. Wyjatkiem sa /me/*, /tokens i /conversations, ktore sa osobiste.

Ustalenia z realizacji (krok 5a):
- Odpowiedzi REST sa camelCase, w przeciwienstwie do snake_case w kontrakcie MCP. Jedynym klientem jest aplikacja w TypeScript, wiec warstwa konwersji byla by kodem bez odbiorcy.
- Kazdy blad ma jeden kształt: { error, message }. Dotyczy tez odpowiedzi generowanych przez sam framework (401 z middleware JWT, 404 na nieznana sciezke, 413 na za duze body) - domyslnie sa plain text, co zmusza klienta do osobnego przypadku na status, ktory trafia najczesciej.
- Ciało zapytania ograniczone do 64 kB. Limit jest wpiety tylko na prefiksy REST, nie na "*": /mcp oddaje surowy strumien transportowi SDK, a middleware czytajace body pierwsze zostawiloby transportowi puste wejscie.
- JWT: HS256 przypiety po obu stronach (weryfikator ufajacy naglowkowi tokenu to droga do ataku na podmiane alg), waznosc 30 dni, bez refresh tokenow i bez listy odwolan.
- GET /projects/:id nie istnieje. Lista zwraca pelne karty, wiec osobny odczyt jednego projektu byl by endpointem na zapas. Wroci w 5d razem z ekranem grafu, jesli okaze sie potrzebny.
- REST i MCP dziela jeden port i jeden proces: /mcp jest trasa tej samej aplikacji Hono. Jedna rzecz do wystawienia.

## 11. Ekrany aplikacji (komplet MVP)

1. Logowanie / rejestracja.
2. Onboarding (tylko pierwszy raz): (a) kreator profilu, 3-4 pytania, wynik jako tekst edytowalny; (b) zalozenie pierwszego projektu, formularz karty; (c) podpiecie codera: wybor z listy (Claude Code / Codex / inny), wygenerowany token, gotowy snippet do skopiowania i dokladna instrukcja gdzie go wkleic, krok po kroku dla nietechnicznych; (d) klucz Gemini, dodany w kroku 5f, zeby nikt nie zgadywal, czemu czat milczy.
3. Ekran glowny: lista projektow + 4 akcje: wybierz projekt, zapytaj asystenta, rozmawiaj z baza, do potwierdzenia (z licznikiem oczekujacych).
4. Widok projektu: karta projektu (edytowalna) + graf (sekcja 8) + lista ostatnich wezlow.
5. Chat RAG: NIE JEST OSOBNYM EKRANEM od 09.08.2026. Rozmowa zyje na ekranie 3, bo composer na przegladzie i tak tylko przerzucal pytanie na ekran 5 przez sessionStorage: jeden silnik, dwoje drzwi, dwa naglowki i dwa zestawy podpowiedzi do trzymania w zgodzie. Pytanie, odpowiedz z cytowaniami i historia rozmow sa teraz w components/ask.tsx, osadzonym w ekranie 3. Cytowane sa wylacznie te wpisy, na ktore odpowiedz sie powolala, jedna cicha linijka na wpis; piec kart pod kazda odpowiedzia mowilo "to dotyczy wszystkich pieciu", co bylo nieprawda.
6. Dodaj do pamieci: chat z tanim LLM, ktory dodaje, poprawia i usuwa wpisy. Wszystkie trzy operacje wykonuja sie od razu (sekcja 4), a historia rozmowy pokazuje, co z nich powstalo.
7. Do potwierdzenia: feed pending_actions oraz wezlow proposed i contradicted; przyciski potwierdz / odrzuc; nieblokujacy, mozna ignorowac.
8. Ustawienia: konto (profil, zmiana hasla, jezyk), klucz Gemini, automatyczne zatwierdzanie, tokeny MCP z lista i odwolywaniem, zespol (przestrzenie, czlonkowie, zaproszenia, wyjscie, wpisanie kodu).

Nietechniczny user zyje w ekranach 3 i 6, czyli w przegladzie z asystentem i w dodawaniu do pamieci. Techniczny dodatkowo w 4 i 7. Nic wiecej w wersji pierwszej.

Zespol nie dostal osobnego ekranu. Jest sekcja ekranu 8, bo to ustawienie zmieniane dwa razy i zapominane, a osobna pozycja w kolumnie mowilaby, ze to miejsce, w ktorym sie pracuje. Osoba zaproszona do cudzej przestrzeni nie ma wlasnego projektu, wiec ekran wejscia wysyla ja do onboardingu; krok z karta projektu ma odnosnik do ustawien, inaczej zaproszenie konczy sie na formularzu zakladania projektu, ktorego ta osoba nie zamierzala zakladac.

## 11a. First-run onboarding (product education)

Problem: model Ariadne jest nietypowy. Nowy user nie wie, co produkt zapamietuje,
czym rozni sie pytanie od dodawania wiedzy, ani dlaczego cokolwiek trzeba
zatwierdzac. Copy na ekranach tego nie udzwignelo, bo tlumaczy pojedynczy ekran,
a nie caly obieg.

Cel: po pierwszym uruchomieniu user umie powiedziec wlasnymi slowami, ze mowi
Ariadne o decyzjach, ze pyta ja pozniej, i ze nic nie wchodzi do pamieci bez jego
zgody.

Flow: trzy ekrany o modelu (pamieta / odpowiada / ty decydujesz), nic wiecej.
Konczy sie realna akcja (pierwsze pytanie), nie przyciskiem "Gotowe". Po nich
jednorazowa podpowiedz przy pierwszym wejsciu na Zapytaj, Dodaj do pamieci i Do
zatwierdzenia, mowiaca czym ten ekran rozni sie od sasiada.

Dlaczego nie tour po ekranach z tooltipami: NN/g ("Onboarding Tutorials vs.
Contextual Help") pokazuje, ze tutorial na starcie zwykle szkodzi, bo podaje
informacje bez kontekstu. Wyjatkiem jest nowy paradygmat interakcji, i to
uzasadnia trzy ekrany o modelu, ale nie oprowadzanie po menu. Ich rekomendacja to
"pull revelations": pomoc tam, gdzie jest potrzebna.

Persistence: localStorage, nie baza. To preferencja tego okna, nie wiedza o
projekcie, a kolumna w users dla flagi bylaby zmiana schematu dla jednego boola.
Restart przez pozycje "Oprowadz mnie po Ariadne" w kolumnie.

Gotowe gdy: pierwsze uruchomienie na czystym localStorage pokazuje trzy ekrany;
Pomin dziala i nie wraca; podpowiedz na kazdym z trzech ekranow pokazuje sie raz;
restart z menu odtwarza caly przebieg.

## 11b. Historia rozmow i historia dodawania do pamieci

Problem: zamkniecie ekranu Zapytaj kasowalo rozmowe, a Dodaj kontekst byl
formularzem, po ktorym interakcja znikala. User nie mial gdzie wrocic po to, co
sam napisal, ani sprawdzic, co sie stalo z jego propozycja.

Rozwiazanie: tabela `conversations` (jedna, `kind` = ask / memory), bo obie
historie to ta sama rzecz i roznia sie tylko tym, co Ariadne z odpowiedzia robi.
Wiadomosci w jsonb, bo rozmowa jest zawsze czytana w calosci. Tytul z pierwszego
zdania, bez wolania modelu.

Statusy propozycji nie sa duplikowane w rozmowie: wiadomosc trzyma `nodeId` i
`pendingActionId`, a biezacy status doczytuje sie z feedu. Kopia bylaby nieaktualna
w chwili zatwierdzenia.

Endpointy: GET/POST /conversations, GET/PUT/DELETE /conversations/:id. PUT, nie
PATCH, bo cialem jest caly transkrypt: ekran wie, co pokazuje, a doklejanie
wymagaloby indeksu tury, ktorego klient nie prowadzi.

Gotowe gdy: rozmowa przezywa przejscie na inny ekran i powrot; druga rozmowa nie
nadpisuje pierwszej; lista pokazuje tytuly z datami; historia dodawania pokazuje
co user napisal, co Ariadne zaproponowala i biezacy status.

## 11c. Jezyk wizualny, druga iteracja

Metadane (typ, data, kanal, technologie) to jedna linia rozdzielona kropka
srodkowa, nie kolorowe pigulki. Powod produktowy: cztery lozenges obok siebie
daly metadanym te sama wage co zdaniu, ktore opisuja.

Nieaktualny jest tylko glos tej linii. Ta iteracja stawiala ja w mono w
wersalikach za systemem Geist ("developer console voice"); trzecia zdjela mono,
bo data nie jest wyjsciem maszyny i w wersalikach czytala sie jak debug.
Obowiazuje DESIGN.md: 13px Geist zwyklymi literami, mono wylacznie dla tego, co
naprawde wypisala maszyna.

Karta oznacza jednostke dzialania. Wpis z przyciskami jest karta, wpis do samego
czytania to sekcja miedzy hairline'ami. Dziesiec bialych prostokatow, w ktorych
nie ma nic do klikniecia, to opakowanie wokol tekstu.

Radius: label 3px, kontrolka 6px, karta 8px. Pill wylacznie dla rzeczy, ktore
naprawde sa okragle (dwie kropki statusu).

## 11d. Motion system

Trzy tokeny czasu, te same co w CSS: state 120ms (zmiana koloru), enter 200ms
(cos pojawia sie na ekranie), thread 420ms (jedyny dluzszy ruch, gdzie sens polega
na zobaczeniu polaczenia). Czwarta wartosc wymyslona w komponencie to koniec
systemu.

Biblioteka: `motion` (nastepca framer-motion), z LazyMotion i komponentem `m`,
zeby paczka zostala przy okolo 6 kB zamiast 34 kB.

Animujemy tylko to, co odpowiada na pytanie "skad to przyszlo" albo "gdzie to
poszlo": wskaznik aktywnej pozycji wedrujacy miedzy pozycjami menu, rozwijanie
zrodel jako czesc odpowiedzi, wejscie wiadomosci i propozycji, oraz karta w
kolejce, ktora najpierw potwierdza decyzje, a dopiero potem znika.

`prefers-reduced-motion` zdejmuje ruch i zostawia zmiane stanu.

Gotowe gdy: nawigacja miedzy ekranami nie wyglada jak przeladowanie; zadna
animacja nie przekracza 450ms; wlaczenie reduced motion nie psuje zrozumienia
zadnego przeplywu.

## 12. Decyzje techniczne

- Embeddingi: gemini-embedding-001 z output_dimensionality: 768 (MRL, pelny wymiar 3072 sciety bez straty jakosci), zamrozone w vector(768). Koszt: 0.15 USD za 1M tokenow wejsciowych. Zmiana modelu = przeliczenie wszystkich wektorow skryptem (jedyna kosztowna zmiana, zaakceptowana swiadomie).
- Tani LLM: gemini-3.5-flash-lite. Plan zakladal gemini-2.5-flash-lite, ale API odmawia go nowym kluczom ("no longer available to new users"), choc nadal wymienia go na liscie modeli. Przypiety do wersji, nie do aliasu -latest, zeby odpowiedzi nie zmienialy ksztaltu w terminie Google. Ponizsze koszty sa z 2.5 i nie byly przeliczane.
- Stary zapis kosztow: gemini-2.5-flash-lite (0.10 USD wejscie, 0.40 USD wyjscie za 1M tokenow), ten sam klucz. Szacowany laczny koszt Gemini przy codziennym uzyciu: rzad 1-1.5 USD miesiecznie; istnieje darmowy tier Flash (tresci z darmowego tieru Google wykorzystuje do ulepszania produktow - decyzja swiadoma).
- Indeks: HNSW vector_cosine_ops.
- Backend: Node/TS. ORM: Drizzle (znany userowi stack). Framework HTTP: Hono (wybrane w kroku 5a). Fastify odrzucony: system pluginow, dekoratorow i wlasny walidator schematow to wiecej pojec do nauki na te same kilkanascie endpointow. Hono ma JWT i obsluge bledow w standardzie, a walidacja idzie przez zoda, ktory juz jest w projekcie, wiec nie doszedl zaden validator middleware.
- Hasla: @node-rs/argon2, nie pakiet argon2. Ten sam argon2id, ale z prebuildami na Windows, wiec setup nie wymaga node-gyp ani Visual Studio Build Tools.
- MCP: oficjalne SDK @modelcontextprotocol/sdk, transport streamable HTTP.
- Hasla: argon2id. Tokeny MCP: 32 bajty losowe, w bazie sha256.
- Tauri 2 + Next.js static export. Graf: React Flow (@xyflow/react); react-force-graph i d3-force byly po drodze i oba wypadly.
- Deploy: backend na Render, baza na Neon, oba na darmowym planie. Migracje Drizzle ida z laptopa po polaczeniu bezposrednim, nie z serwera. Docker Compose na VPS byl planem do 11.08.2026 i odpadl: Oracle Always Free nie wydal maszyny ARM ("Out of capacity"), a firewall, systemd i Caddy to godzina konfiguracji za efekt, ktory obie uslugi zarzadzane daja bez niej. Docker zostaje tam, gdzie byl przydatny, czyli jako lokalna baza deweloperska.

## 13. Kolejnosc budowy z kryteriami "gotowe gdy"

Krok 1. Baza. [ZROBIONE 2026-07-23, branch feature/step-1-database]
- Docker Compose z Postgresem, rozszerzenie vector, migracje Drizzle wg sekcji 3.
- Gotowe gdy: migracja przechodzi czysto na swiezej bazie, INSERT i SELECT wektora dziala z psql.
- Powstalo: docker-compose.yml (pgvector/pgvector:pg17, healthcheck), backend/src/db/schema.ts
  (6 tabel, bez edges - krok 2 planu), migracja backend/drizzle/0000_*.sql z CREATE EXTENSION vector.
  Jeden .env w korzeniu wspolny dla compose i drizzle. Kryterium sprawdzone: down -v + up + migrate
  przechodzi czysto, INSERT/SELECT wektora 768d dziala, CHECK constrainty odrzucaja zle wartosci.

Krok 2. Warstwa serwisowa + embeddingi. [ZROBIONE 2026-07-23, branch feature/step-2-service-layer]
- Funkcje: createNode (walidacja + embedding + transakcja), searchNodes (sekcja 7), getBootContext, requestUpdate/Delete (pending), approve/reject, confirm/archive.
- Gotowe gdy: testowy skrypt zapisuje 10 wezlow i search zwraca sensowna kolejnosc dla 3 roznych pytan.
- Powstalo: backend/src/gemini.ts (embed przez natywny fetch, taskType RETRIEVAL_DOCUMENT/QUERY,
  normalizacja wektora - przy output_dimensionality 768 Gemini zwraca wektory nieznormalizowane),
  backend/src/db/client.ts (pool pg + drizzle), backend/src/service.ts (cala logika z sekcji 4, 5, 7:
  brama walidacji, wymuszony status proposed, normalizeRepoRef, update przelicza embedding),
  skrypty: scripts/check-embedding.ts, scripts/verify-service.ts (idempotentny, seed 10 wezlow).
- Kryterium sprawdzone: 3 pytania trafiaja we wlasciwe wezly (similarity 0.69-0.81), cykl
  pending -> approve -> przeliczony embedding -> confirm -> archive dziala, archived znika z searcha.
- Lekcja z weryfikacji: vector search nie zna pojecia "ostatnia sesja" (podobienstwo to "o czym",
  nie "kiedy") - boot context slusznie bierze session_summary po dacie, nie po similarity.
- Decyzje po drodze: Gemini przez goly fetch zamiast SDK (jeden POST, SDK najwczesniej w kroku 5),
  branch kroku 2 wychodzi z brancha kroku 1 (oba czekaja na merge do main za zgoda).

Krok 3. Serwer MCP. [ZROBIONE 2026-07-25, branch feature/step-3-mcp-server]
- 5 narzedzi wg sekcji 9, auth tokenem, bledy z czytelnymi komunikatami.
- Gotowe gdy: MCP Inspector przechodzi wszystkie narzedzia, w tym sciezke unknown_repo i pending.
- Powstalo: backend/src/mcp.ts (5 narzedzi jako cienkie wrappery na service.ts, konwersja
  camelCase -> snake_case w jednym miejscu, bledy serwisowe wracaja jako isError zamiast
  wywrotki protokolu), backend/src/index.ts (node:http, jeden endpoint POST /mcp, transport
  stateless), auth w service.ts (generateToken / hashToken / resolveUserByToken),
  skrypt scripts/mint-token.ts, skrypt npm "dev".
- Kryterium sprawdzone: MCP Inspector w trybie --cli przeszedl wszystkie 5 narzedzi,
  sciezke unknown_repo i obie sciezki pending. Dodatkowo: 401 na zly i na brakujacy token,
  405 na GET, 404 na inna sciezke, repo_ref podany jako https i jako git@ trafia w ten sam
  projekt.
- Decyzje po drodze: gole node:http zamiast Hono/Fastify (endpoint jest jeden, a transport
  z SDK i tak chce surowe req/res; wybor frameworka wraca w kroku 5 razem z REST), transport
  stateless ze swiezym serwerem per request (userId domkniety w narzedziach, wiec scope nie
  ma jak wyciec miedzy userami), SDK v1.29 zamiast bety v2 pod spec 2026-07-28.
- Odstepstwo od sekcji 9: source.channel nie jest polem wejsciowym add_context, serwer
  wymusza "coder". Kto puka przez MCP, ten jest coderem, wiec nie ma tu czego deklarowac.

Krok 4. Podpiecie Claude Code (pierwszy prawdziwy test).
- Token wygenerowany recznie w bazie, snippet w CLAUDE.md realnego projektu.
- Gotowe gdy: pelna petla na zywo: nowa sesja laduje boot context, w trakcie zapisuje decyzje, na koncu podsumowanie, kolejna sesja startuje z tym podsumowaniem i odpowiada poprawnie na "gdzie skonczylismy".
- To jest moment nauki RAG: tu sie eksperymentuje z trescia wezlow i jakoscia wynikow.
- Zrobione: token, .mcp.json i snippet w repo portfolio, seed konta i karty projektu, petla zapis -> podsumowanie -> nowa sesja odpowiada z last_summary.
- Znalezione i naprawione po drodze: coder nie wolal search_context ani razu, bo boot context wygladal na komplet. Stad index w get_project_context, pelny opis w sekcji 6.
- Potwierdzone po dodaniu indexu: to samo pytanie, ktore wczesniej konczylo sie na boot contextcie, poszlo teraz get_project_context -> search_context -> weryfikacja w kodzie. Coder wzial z pamieci "gdzie patrzec i na co uwazac", a aktualny stan policzyl z repo (parytet kluczy i18n, lista slugow). Ten podzial rol jest docelowy: graf trzyma dlaczego, repo trzyma jak jest teraz.
- KROK 4 GOTOWY.

Krok 5. REST + aplikacja Tauri. Rozbity na cztery czesci, bo jako jeden branch to wiecej niz kroki 1-4 razem i decyzje przestaja byc widoczne.
- Gotowe gdy (caly krok 5): nietechniczna osoba przechodzi onboarding bez pomocy i zadaje pierwsze pytanie asystentowi.

Krok 5a. Backend REST bez czatow. GOTOWY.
- Auth (rejestracja, login, argon2id, JWT), /me, tokeny MCP, projekty, feed do potwierdzenia. Bez /projects/:id/graph i bez /chat/*.
- Gotowe gdy: przejscie rejestracja -> login -> token -> projekt dziala bez recznego dotykania bazy. Spelnione: scripts/verify-rest.ts, 58 sprawdzen przez app.request() Hono, bez portu i bez curla.
- Dwa sprawdzenia sa tam z konkretnego powodu, nie dla liczby. Pierwsze czyta tablice tras z routera i wola kazda bez tokenu: trasa dopisana kiedys bez swojego prefiksu w PROTECTED_PREFIXES wywali sie tutaj, zamiast pojechac otwarta. Drugie dobija sie do kazdego zasobu tokenem drugiego uzytkownika i oczekuje 404, bo scope w warstwie serwisowej byl wtedy jedyna rzecza miedzy dwoma kontami. RLS doszedl w kroku 5g i jest dzis drugim zamkiem.
- Znalezione w self-review: brak limitu rozmiaru body, plain text w bledach generowanych przez framework, POST /tokens odrzucajacy puste body, middleware JWT wpiete w srodku pliku (w Hono middleware owija tylko trasy zarejestrowane po nim, wiec trasa dopisana w luce pojechala by bez autoryzacji), oraz argon2 liczony przed sprawdzeniem czy email jest zajety.

Krok 5a.1. Endpointy, ktorych sekcja 10 nie przewidziala. Znalezione przez audyt projektowy, nie przez implementacje.
- GET /projects/:id/nodes: filtr po statusie, typie i pliku, kursor. Filtrowanie i sortowanie po stronie serwera, bo 40 pozycji w kolejce to nie gorna granica.
- POST /search: to samo co search_context w MCP, ale dla aplikacji, ze similarity w zwrotce.
- POST /nodes/:id/contradict z polem supersededBy. Status contradicted istnieje w modelu i nic go nie nadaje, a bez odnosnika do wpisu, ktory odwolal, ten status jest nieczytelny.
- PUT /nodes/:id: czlowiek musi moc poprawic literowke. Proszenie o to modelu jest absurdem. Bez historii wersji, ale z data modyfikacji i kanalem edycji.
- Dlaczego to blokuje: piec z siedmiu ekranow zyje z listowania i szukania wpisow, a API ma tylko confirm i archive. Ekrany 3, 4, 5, 6 i 7 nie maja z czego zyc.

Krok 5b. Powloka Tauri, logowanie, onboarding.
- Ekrany 1 i 2 sekcji 11.
- Gotowe gdy: przechodzisz od rejestracji do skopiowanego snippetu bez terminala.
- Ekrany 1 i 2 GOTOWE i przejsciowo sprawdzone w przegladarce: rejestracja, cztery pytania profilu, karta projektu, token, polecenie. Token z tego przejscia autoryzuje sie na /mcp i get_project_context zwraca wpisany profil oraz zalozona karte. Kryterium spelnione.
- Powloka Tauri GOTOWA. Okno bez dekoracji, wlasny pasek tytulu z trzema przyciskami, caly przebieg przeklikany w aplikacji az do polecenia claude mcp add.
- Czego nie widac z kodu, a zjadlo czas: domyslny zbior uprawnien core:window daje same gettery. Minimalizacja, maksymalizacja, zamkniecie i przeciaganie okna wymagaja czterech osobnych wpisow w capabilities, inaczej przyciski rzucaja "not allowed" dopiero na kliknieciu. Do tego isTauri() wolane w renderze rozjezdza hydracje, bo statyczny eksport prerenderuje sie w Node, gdzie powloki nie ma.
- Zostaje decyzja o logowaniu przez Google. Spec zaprojektowal je jako druga rownorzedna droge na ekranie 01, ale nie ma tego ani w sekcji 10, ani w backendzie, a OAuth w Tauri wymaga loopbacku albo deep linku plus endpointu po stronie serwera. Ekran zbudowany bez tego.
- Znalezione przez otwarcie aplikacji, nie przez czytanie kodu: brak CORS (front na 3001 wola API na 3000, wiec kazde zapytanie bylo cross-origin i ekran mowil, ze serwer nie odpowiada), etykiety monospace lamiace sie na dwie linie w kolumnie 132 px, oraz stykajace sie dywizy w owczesnym Martian Mono, przez ktore --scope czytalo sie jak -scope.
- Uwaga z kroku 4, do przemyslenia zanim powstanie ekran 2c: token w zmiennej srodowiskowej to najtrudniejszy moment calego onboardingu. setx nie dziala na juz otwarte procesy, terminal w VS Code dziedziczy env z chwili startu edytora, a serwery MCP z .mcp.json wymagaja jednorazowej zgody, ktorej brak nie daje zadnego bledu, tylko brak serwera. Alternatywa: token wpisany wprost do .mcp.json, kosztem sekretu w pliku projektu.

Krok 5c. Chat RAG.
- POST /chat/query ze streamingiem, ekran 5.
- Gotowe gdy: pytanie o przeszlosc projektu dostaje odpowiedz z cytowaniami (zrodlo, data, anchors).

Krok 5d. Graf i rozmawiaj z baza.
- GET /projects/:id/graph (sekcja 8), POST /chat/edit, ekrany 4, 6 i 7.
- Gotowe gdy: widzisz wezly projektu jako graf i poprawiasz wpis rozmowa.

Krok 5e. Ekran 8 i tryb zespolowy. ZROBIONE 2026-08-08, branche feature/workspaces-backend i feature/screen-8-settings.
- Gotowe gdy: druga osoba dostaje kod, dolacza i czyta ten sam projekt, a jej coder siega po ten sam kontekst przez MCP.
- Spelnione: verify-rest.ts, 155 sprawdzen (bylo 105), w tym pelny obieg zaproszenia, 404 dla osoby spoza przestrzeni na projekt, wezly, kolejke i graf, podpis przy zatwierdzonym wpisie, zmiana hasla i limit logowania. Do tego przeklikane w przegladarce na dwoch kontach: A tworzy zaproszenie, B je przyjmuje i widzi projekt A.
- Znalezione przez klikanie, nie przez czytanie kodu: kod zaproszenia wyswietlal sie pod ostrzezeniem "ten token widzisz raz" (CommandBlock mial to zdanie zaszyte, wbrew wlasnemu komentarzowi), przyjecie zaproszenia nie odswiezalo kolumny, a osoba zaproszona nie miala jak dojsc do pola na kod, bo onboarding nie ma menu.
- Odstepstwo od sekcji 13 w wersji sprzed tej zmiany: tryb zespolowy byl krokiem 7 "kierunek, nie zadanie". User zdecydowal inaczej i wszedl przed MVP. Wycena z tamtego akapitu okazala sie trafna co do zakresu: przepisany scope w warstwie serwisowej i przepisany blok cross-user w verify-rest.ts.

Krok 5f. Streszczenia, wlasny klucz Gemini, sprzecznosci. ZROBIONE 2026-08-09, branch feature/ui-redesign-2.
- Gotowe gdy: karta wpisu prowadzi zdaniem, ktore da sie przeczytac jednym rzutem oka; konto bez klucza wie, czego mu brakuje i gdzie to wpisac; dwa wpisy, ktore nie moga byc naraz prawdziwe, nie leza w bazie po cichu.
- Spelnione: verify-rest.ts 159 sprawdzen (bylo 158), migracje 0006 i 0007 na prawdziwej bazie, plus dwa jednorazowe skrypty na przypadku ze zgloszenia ("portfolio jednojezyczne" kontra "portfolio trojjezyczne"): wykrywa te pare, nie wykrywa wpisu o innym temacie ani wpisu o tym samym temacie, ktory niczemu nie przeczy, a po rozstrzygnieciu stary wpis ma status contradicted i link do nastepcy.
- Prog podobienstwa to jedna liczba dla wszystkich projektow (0.7, komentarz ponytail: w service.ts). Sama bliskosc wektorow nie wystarcza i nigdy nie wystarczy: "portfolio trojjezyczne" i "teksty portfolio prostym jezykiem" sa blisko siebie, a tylko pierwsza para to sprzecznosc. Model jest tu filtrem, prog tylko brama.
- Wykrywanie dziala od zapisu w przod. Pary lezace juz w bazie zostaja niewykryte, decyzja usera; przemial istniejacych wpisow to jeden skrypt, gdy zajdzie potrzeba.
- Streszczenia tez licza sie tylko przy zapisie i przy edycji tresci. Wpisy sprzed tej zmiany maja puste summary i karta wraca dla nich do pierwszego zdania, wiec nic nie znika.
- Znalezione przez klikanie, nie przez czytanie kodu: wpis napisany w panelu wracal do wlasnego autora jako "do zatwierdzenia" (stad status z kanalu), a piec kart zrodel pod kazda odpowiedzia twierdzilo, ze odpowiedz dotyczy wszystkich pieciu wpisow.
- Prompt streszczenia poprawiany dwa razy, oba razy z powodu widocznego dopiero na wyniku: proszony o zdanie model pisal zdanie podrzedne, na ktore nie mial miejsca, a twardy limit ucinal je w polowie ("...ze wzgledu na"); regula jezyka nazywajaca polski z nazwy byla czytana jako preferencja polskiego i tytulowala angielskie wpisy po polsku. Teraz prosi o fraze i nie nazywa zadnego jezyka.

Krok 5g. Row-Level Security i sufit spisu tresci. ZROBIONE 2026-08-11, branch feature/rls-and-boot-index.
- Wyciagniete z kroku 6 przed hostingiem, bo obie rzeczy psuja sie dokladnie wtedy, gdy produkt zaczyna dzialac: RLS przy drugim zespole w bazie, spis tresci przy setnym wezle w projekcie.
- Gotowe gdy: polaczenie rola aplikacyjna bez ustawionej tozsamosci nie widzi zadnego wpisu, z cudza tozsamoscia nie widzi cudzego projektu, a proba zapisu do cudzej przestrzeni konczy sie bledem bazy, nie samym 404 z warstwy serwisowej.
- Spelnione: verify-rest.ts 164 sprawdzenia (bylo 159), z czego piec ostatnich chodzi po bazie jako `ariadne_app`, czyli rola, ktorej polityki dotycza. Migracja 0008 na prawdziwej bazie.
- Dwie role zamiast jednej, bo Postgres nie stosuje polityk do wlasciciela tabel. `DATABASE_URL` zostaje wlascicielem i nalezy do migracji oraz skryptow administracyjnych, ktore maja widziec wszystko; `DATABASE_URL_APP` to rola serwera. Rola powstaje w migracji bez prawa logowania, haslo dostaje recznie raz (setup.md), wiec przebieg migracji nigdy nie otwiera po cichu nowej drogi do bazy.
- Tozsamosc idzie do bazy przez `set_config('app.user_id', ..., true)` w transakcji na zadanie, a `db` w client.ts jest proxy nad AsyncLocalStorage, wiec zadna z okolo szesciudziesieciu funkcji w service.ts nie musiala sie uczyc przekazywac transakcji. Brak ustawionej tozsamosci polityki czytaja jako "zero wierszy", nigdy jako "wszystko": odwrotna domyslnosc zamienialaby kazde zapomniane owiniecie w ciche pelne czytanie archiwum.
- Polityki obejmuja projects, nodes, code_anchors, pending_actions i conversations. Swiadomie poza nimi zostaja users, workspaces, memberships, invites i api_tokens: kazda z tych tabel jest czytana, zanim jest po kim scope'owac (logowanie po mailu, zaproszenie po kodzie, token po hashu), a polityki na archiwum sa napisane w terminach memberships, wiec polityka na niej samej bylaby rekurencja.
- Znalezione po drodze: `??=` przy nadpisywaniu `DATABASE_URL_APP` w skryptach administracyjnych nie dziala, bo .env te zmienna juz ma. Skrypt seedujacy szedl wiec jako rola pod politykami i wywracal sie na WITH CHECK. Twarde przypisanie, nie uprzejme.
- Sufit spisu tresci: opisany przy sekcji 6.

Krok 5h. Archiwum przy zakladaniu projektu, token per maszyna. ZROBIONE 2026-08-30, branch feature/workspace-split-brain.
- Powod: aplikacja i coder wybieraly archiwum niezaleznie od siebie. Formularz nowego projektu nie wysylal workspace_id, wiec projekt szedl do najstarszego czlonkostwa, a token siegal tego, dla ktorego powstal. Gdy te dwa sie rozjechaly, coder odpowiadal unknown_repo, czyli "zaloz projekt", a projekt byl na ekranie. Kto tej odpowiedzi posluchal, mial jedno repozytorium w dwoch archiwach i polowe wpisow tam, gdzie druga polowa ich nie widzi.
- Dwa konce tej samej naprawy, robione w dwoch rownoleglych sesjach i scalone w jednym drzewie:
  - Formularz pyta o archiwum, gdy jest wiecej niz jedno. Pole odpowiada na inne pytanie niz przedtem: nie ktory coder znajdzie projekt, tylko kto jeszcze go czyta.
  - Token przestal nalezec do przestrzeni. api_tokens.workspace_id nullable i nieczytane (migracja 0012), Actor to { userId, tokenId }, a repo_ref wybiera projekt sposrod wszystkich archiwow wlasciciela tokena. Jedno trafienie rozwiazuje, zero to unknown_repo, wiecej niz jedno to ambiguous_repo.
- Slad nieudanego pukania: api_tokens.last_unknown_repo i last_unknown_repo_at (migracja 0011). Odpowiedz o nietrafionym adresie szla wylacznie do codera, wiec aplikacja wygladala zdrowo, kiedy kazda sesja wracala pusta. Ekran glowny pokazuje ostatnie takie pytanie i otwiera formularz z wpisanym adresem. Nic nie czysci kolumny: baner znika sam, gdy projekt pod tym adresem istnieje.
- Przenoszenie projektu miedzy archiwami: POST /projects/:id/workspace, wlasciciel zrodla i czlonek celu, tak jak przy usuwaniu. Wpisy i kolejka do zatwierdzenia ida razem z projektem. Wczesniej jedynym lekiem na projekt w zlym archiwum bylo usuniecie go razem z tym, co pod nim stalo.
- repo_ref w opisie narzedzia MCP mowi teraz o local/<nazwa projektu>: repozytorium bez remote nie mialo zadnej odpowiedzi, a coder nie odczyta tej konwencji z katalogu.
- Copy obiecywalo token per archiwum na czterech ekranach, a onboarding rownoczesnie "raz na komputer". Poprawione w obu jezykach, klucz settings.forWorkspace usuniety razem z pickerem.
- Gotowe gdy: verify-rest.ts przechodzi przenoszenie (czlonek odrzucony, wpisy podazaja za projektem, kolizja repo_ref to 400), a verify-service.ts unknown_repo, ambiguous_repo i slad na tokenie. Asercje dopisane, przebieg czeka na migracje 0011 i 0012 na bazie.

Krok 6 (po MVP). Edges + replaces + graph RAG, awansowanie statusow przez przezycie, hook konca sesji dla Claude Code, obsluga coderow bez MCP (cienkie CLI).

Dlaczego to jest prawdopodobnie wlasciwy produkt, a wersja jednoosobowa prototypem: solo Ariadne konkuruje z wlasna pamiecia usera, ktory polowe decyzji z zeszlego tygodnia i tak pamieta. W zespole ta konkurencja znika, bo decyzja kolegi z wtorku nie jest w polowie zapamietana, ona jest calkowicie niewidzialna. CLAUDE.md w repo trzyma reguly, nie powody, i nikt go nie aktualizuje po rozmowie na Slacku. Do tego kazda osoba ma wlasnego agenta, a kazdy agent startuje od zera: piec osob to piec agentow codziennie odgadujacych ten sam kontekst. Oszczednosc mnozy sie przez liczbe ludzi.

Czego to kosztuje, zeby nie wygladalo na dolozenie tabelki:
- Model danych stal na zalozeniu "wszystko nalezy do jednego usera": projects mial unikalnosc na (user_id, repo_ref), nodes mialy user_id, kazda funkcja w service.ts filtrowala po user_id. Wlasciciel projektu przeniosl sie z usera na zespol, doszly czlonkostwa i zaproszenia, a kazde zapytanie poszlo do przepisania. To nie byla zmiana dodajaca, to przepisanie modelu bezpieczenstwa. Wykonane w kroku 5e.
- scripts/verify-rest.ts ma blok, ktory dobija sie do kazdego zasobu tokenem drugiego usera i wymaga 404. Tryb zespolowy odwraca to twierdzenie, wiec ten blok tez idzie do przepisania. To dobre miejsce, zeby zobaczyc skale zmiany.
- Row-Level Security przestalo byc "miloby bylo" z kroku 6 i stalo sie wymogiem (zrobione w kroku 5g). Przy jednym userze blad w scope przecieka jego dane do niego samego. W zespole przecieka miedzy ludzmi, przy wielu zespolach miedzy firmami.
- Hosting przestal byc lokalnym Dockerem: Render plus Neon, a dalej zaproszenia, mail, reset hasla i w koncu rozliczenia.

Najtrudniejszy problem nie jest techniczny, jest znaczeniowy. Statusy zakladaja jedna osobe decydujaca: proposed to "nikt tego nie ocenil", confirmed to "ja potwierdzilem". W zespole natychmiast pada pytanie, kto potwierdza. Jesli kazdy, to confirmed nic nie znaczy, bo junior potwierdzi decyzje architektoniczna, ktorej nie rozumie. Jesli tylko wlasciciel, to jest waskim gardlem i kolejka rosnie do stu pozycji. Do tego dwie osoby zapisza tego samego dnia dwie sprzeczne decyzje, obie proposed, obie szczere, i nie ma automatu, ktory to rozstrzygnie. Bez odpowiedzi na to pytanie tryb zespolowy nie ma sensu, choćby cala schema byla gotowa.

Odpowiedz z 08.08.2026, decyzja usera: zatwierdza kazdy czlonek, a wpis zapamietuje kto i kiedy (nodes.confirmed_by, confirmed_at). Podpis jest tym, co ratuje status przed znaczeniem "ktos kiedys sie zgodzil": czytelnik widzi, czyja to byla ocena, i moze ja zakwestionowac przez contradicted. Waskie gardlo u wlasciciela bylo drozsze niz ryzyko, ze junior potwierdzi cos, czego nie rozumie. Dwie sprzeczne decyzje tego samego dnia rozstrzyga czlowiek, przez supersededBy. Automatu rozstrzygajacego nadal nie ma i nie bedzie, ale od 09.08.2026 jest automat WYKRYWAJACY, opisany nizej przy kroku 5f: model tylko podnosi reke, decyzja zostaje po stronie czlowieka.

Czego w trybie zespolowym NIE robimy na start: uprawnien per rola. Wartosc siedzi we wspolnym czytaniu i w przypisanym zapisie, nie w macierzy uprawnien. Role to osobna warstwa i typowo pierwsza rzecz, ktora niepotrzebnie zabija projekt na tym etapie.

Uboczny skutek: spis treści w boot contextcie (sekcja 6) ma sufit przy okolo stu wezlach. Solo dobije sie do niego po miesiacach, w piecioosobowym zespole po tygodniu. Tryb zespolowy przyspiesza problem, ktory jest juz zapisany.

Co zrobiono na zapas: w kodzie nic, swiadomie. Jedna rzecz w projekcie wizualnym: uklad rekordu pokazuje autora wpisu obok zrodla, daty i projektu. Dopisanie tego teraz jest darmowe, doklejanie kolumny "kto" do siedmiu gotowych ekranow pozniej nie jest. I nie jest to projektowanie na zapas, bo PRODUCT.md juz stanowi, ze kazdy rekord nosi swoja metryczke, a autor jest brakujacym elementem tej metryczki.

## 14. Swiadomie odlozone

- Mapowanie codebase (AST, call graph): nigdy, to inny projekt (Graphify).
- Graph RAG, typy krawedzi, tabela edges: krok 6.
- Ocena wagi decyzji (blaha vs nosna) i auto-awans statusow: krok 6.
- Row-Level Security: ZROBIONE 11.08.2026, patrz krok 5g. Scope stoi teraz na dwoch zamkach: warstwa serwisowa filtruje, a baza odmawia niezaleznie od tego, czy filtr byl. Zapomniany where-clause przestal byc wyciekiem.
- Historia wersji tresci wezla: gdy okaze sie potrzebna.
- Coderzy bez MCP: gdy zajdzie potrzeba.
- Wlasny klucz Gemini per user: ZROBIONE 09.08.2026, patrz krok 5f. Klucza serwerowego pod spodem nie ma i nie bedzie: kazde wywolanie do Google placi konto, ktore o nie poprosilo. Bez klucza konta zapis wpisu i oba czaty zwracaja no_gemini_key, a aplikacja tlumaczy to na zdanie z odnosnikiem do ustawien.
- Wysylka zaproszen mailem: dopiero z publicznym adresem. Zaproszenie to dzis kod do skopiowania, kolumna invites.email juz jest i wiaze kod z adresem, wiec dolozenie nadawcy to jeden endpoint na gotowej kolumnie. Bez publicznego adresu link z maila nie ma dokad prowadzic.
- Usuniecie przestrzeni i przekazanie wlasnosci: nie ma. Wlasciciel nie moze wyjsc z wlasnej przestrzeni, a zalozonej nie da sie skasowac z aplikacji. Do zrobienia, gdy ktos zalozy druga przez pomylke.
- Nazwa wyswietlana usera: autora pokazujemy mailem, a scislej czescia przed malpa. Kolumna dojdzie, gdy adresy przestana wystarczac.
- Uniewaznienie JWT po zmianie hasla: nie ma denylisty, token wygasa po 30 dniach.

## 15. Frontend, pozniej

Labirynt z ekranu wejscia usuniety razem z redesignem UI. Ekran logowania to teraz split screen z obrazem (dlon i zlota nic) w public/, a rozswietlanie kursorem nie ma juz nosnika. Gdyby kiedys wrocil: warunkiem wstepnym byla prawdziwa topologia labiryntu kretenskiego, bo rozswietlanie zaprasza do wodzenia wzrokiem, a falszywy meander wtedy klamie.

Inne pozycje frontendu, ktore czekaja na decyzje albo na dane:
- Logowanie przez Google: ZROBIONE, razem z GitHubem, patrz sekcja 10. Loopback odpadl na rzecz handoffu: aplikacja otwiera przegladarke, a potem odbiera sesje przez GET /auth/handoff/:id.
- Przelacznik motywu: spec go zabrania i po redesignie 2 aplikacja jest ciemna zawsze, wiec dawny argument (jasne okno na ciemnym systemie razi) sam sie odwrocil. Pytanie zostaje otwarte dla odwrotnego przypadku i nie jest pilne.
- Zachowanie na bardzo szerokim oknie: tekst jest ograniczony do 68 znakow, wiec przy 3440 px zostaje duzo pustego tynku. Spec nie mowi, co ma sie tam dziac.
- Przelacznik jezyka: zrobiony, siedzi w ekranie 8 nad sekcja automatycznego zatwierdzania. Dalej trzyma wybor w localStorage, bo to preferencja tego okna, nie konta.
