# Ariadne. Plan wykonawczy

Warstwa pamieci dla LLM coderow. Nic ariadny: wychodzisz z sesji i wracasz dokladnie tam, gdzie skonczyles. Baza Postgres + pgvector na VPS jako jedyne zrodlo prawdy, aplikacja desktopowa Tauri 2 + Next.js jako klient, komunikacja coderow przez MCP, wyszukiwanie przez RAG z cytowaniem.

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
              Backend na VPS (Node/TS)
              jedna warstwa serwisowa,
              dwa transporty (MCP + REST)
                      |
        +-------------+--------------+
        |                            |
  Postgres + pgvector          Gemini API
  (zrodlo prawdy)              (embeddingi: gemini-embedding-001 (output_dimensionality: 768),
                                tani LLM: gemini-2.5-flash-lite)
```

Zasady architektoniczne:
- Logika biznesowa istnieje raz, w warstwie serwisowej. Narzedzia MCP i endpointy REST to cienkie wrappery na te same funkcje.
- Embeddingi liczy zawsze serwer. Klient (coder, aplikacja) przysyla czysty tekst.
- Tauri: Next.js w trybie static export (output: "export"). Zero SSR, zero API routes w aplikacji. Wszystkie dane przez REST do VPS.
- Kod projektu nigdy nie laduje w bazie. Baza trzyma notatki, decyzje, podsumowania i wskazniki (sciezki, symbole, SHA).

## 3. Schemat bazy (gotowy SQL)

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,              -- argon2id
  profile       text NOT NULL DEFAULT '',   -- lekki profil: kim jest, jak lubi pracowac
  all_permission boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,                 -- sha256 tokenu; token pokazany raz przy generacji
  label      text NOT NULL DEFAULT '',      -- np. "laptop praca"
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE TABLE projects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  UNIQUE (user_id, repo_ref)
);

CREATE TABLE nodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('session_summary','decision','note')),
  content    text NOT NULL,                 -- jedna mysl po ludzku; to idzie do embeddingu
  status     text NOT NULL DEFAULT 'proposed'
               CHECK (status IN ('proposed','confirmed','contradicted','archived')),
  source     jsonb NOT NULL DEFAULT '{}',   -- patrz format nizej
  embedding  vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX nodes_lookup ON nodes (user_id, project_id, status, created_at DESC);
CREATE INDEX nodes_embedding_hnsw ON nodes
  USING hnsw (embedding vector_cosine_ops);

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
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id      uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  action       text NOT NULL CHECK (action IN ('update','delete')),
  payload      jsonb NOT NULL DEFAULT '{}', -- dla update: { "content": "...", "anchors": [...] }
  requested_by text NOT NULL CHECK (requested_by IN ('coder','app_agent')),
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','rejected')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
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
| contradicted | archived | klik usera w feedzie ALBO automatycznie po 7 dniach bez reakcji |
| dowolny | archived | zatwierdzone delete_context |

Zasady:
- Zapis nigdy nie jest blokowany. Wszystko wchodzi od razu, status niesie zaufanie.
- Nic nie kasujemy fizycznie. archived znika z wynikow RAG (filtr w zapytaniu), ale zostaje w bazie.
- Odczyt RAG zwraca status przy kazdym wezle, a instrukcja w snippecie (sekcja 6) kaze coderowi traktowac proposed jako rewidowalne, confirmed jako pewnik.
- Awansowanie "przez przezycie" (proposed starsze niz N sesji -> confirmed automatycznie): PO MVP, na start tylko klik.

## 5. Dwie drogi wejscia

Droga 1, coder przez MCP: oddaje gotowe, jednomyslowe wezly. Bez taniego LLM po drodze (slabszy model nie moze psuc outputu mocniejszego). Kontrakt wymusza schema narzedzia; odrzucony input wraca z konkretnym bledem i coder ponawia.

Droga 2, user w aplikacji: surowy tekst dowolnej jakosci trafia do taniego LLM (gemini-2.5-flash-lite), ktory:
1. najpierw wola search_context, zeby wiedziec co juz jest w bazie,
2. rozbija wpis na jednomyslowe wezly,
3. dla kazdego proponuje: type, project, anchors, oraz operacje (dodaj nowy / edytuj istniejacy / usun),
4. dodania wykonuje od razu (laduja jako proposed), edycje i usuniecia wrzuca do pending_actions,
5. oryginalny wpis zawsze laduje w source.raw_input.

Brama walidacji (kod, nie LLM), wspolna dla obu drog: pola wypelnione, content niepusty i krotszy niz 4000 znakow, project istnieje i nalezy do usera z tokena, status wymuszony na proposed, anchors maja poprawny format sciezki.

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

Sufit tego rozwiazania (oznaczony `ponytail:` w service.ts): dziesiec najnowszych naglowkow. Przy okolo stu wezlach przestaje to byc spis tresci, a staje sie losowa probka i problem wraca w gorszej formie, bo index bedzie wygladal na komplet. Wtedy: wybor po anchors pasujacych do plikow w biezacej rozmowie, albo klastrowanie tematyczne. Nie zwiekszac samego limitu, to tylko przesuwa sciane.

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
- Wyniki search_context ze statusem proposed traktuj jako rewidowalne,
  confirmed jako pewnik.

Przed zakonczeniem sesji: zapisz przez add_context krotkie podsumowanie
(type=session_summary): co zrobiono, gdzie skonczono, co dalej.
```

Plik docelowy per coder: Claude Code -> CLAUDE.md, Codex -> AGENTS.md, inne -> ich odpowiednik. Instrukcja w pliku to best effort; dla Claude Code setup proponuje dodatkowo hook konca sesji (deterministyczny zapis podsumowania). Tresc hooka: skrypt wolajacy add_context przez MCP z transkryptem ostatnich commitow sesji jako materialem.

## 7. RAG: dokladny przeplyw

Zapis wezla:
1. walidacja (sekcja 5),
2. serwer liczy embedding content przez gemini-embedding-001 z output_dimensionality: 768,
3. INSERT do nodes + anchors w jednej transakcji.

Odczyt (search_context):
1. embedding pytania tym samym modelem,
2. zapytanie:
```sql
SELECT n.id, n.type, n.content, n.status, n.source, n.created_at,
       1 - (n.embedding <=> $query_vec) AS similarity
FROM nodes n
WHERE n.user_id = $user_id
  AND n.project_id = $project_id
  AND n.status != 'archived'
ORDER BY n.embedding <=> $query_vec
LIMIT 5;
```
3. dociagniecie anchors dla znalezionych wezlow jednym zapytaniem,
4. zwrotka per wezel: { id, type, content, status, similarity, source, anchors[], created_at }.

Zasady:
- Filtr metadanych zawsze PRZED podobienstwem. Metadane zawezaja, wektory trafiaja.
- k = 5 domyslnie, parametr narzedzia pozwala 1..10.
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
- Podobienstwo embeddingow liczone w locie do wizualizacji, tylko pary powyzej progu 0.75, max 3 najblizszych sasiadow na wezel (bez progu graf robi sie klebkiem).
- Wizualizacja w aplikacji: react-force-graph albo d3-force, kolor wezla = status, klik = podglad tresci i anchors.

Krok 2:
- Tabela edges, typ replaces tworzony automatycznie przy add_context z replaces_node_id.
- Graph RAG: po znalezieniu top-k wezlow dociagnij sasiadow po krawedziach (1 skok) i dolacz do zwrotki z oznaczeniem "powiazane". Laczy rzeczy napisane innymi slowami, ktorych czysty vector search nie znajdzie.

## 9. Kontrakt MCP (pelne schematy)

Serwer: MCP streamable HTTP na VPS, endpoint /mcp. Auth: naglowek Authorization: Bearer <token>; serwer haszuje token i szuka w api_tokens; user_id z tokena scopuje kazda operacje.

get_project_context
- input: { repo_ref: string }
- output: { profile: string, project: { name, opis, stack, dla_kogo, grupa_odbiorcza, konwencje_ref, ograniczenia, etap }, last_summary: { content, created_at } | null, index: [ { node_id, type, headline } ] }
- index: naglowki (pierwsza linia content, max 120 znakow) dziesieciu najnowszych wezlow typu decision i note, bez tresci. Powod istnienia i sufit: sekcja 6. Bez tego coder nie wola search_context w ogole.
- blad gdy repo nieznane: { error: "unknown_repo", message: "Zaloz projekt w aplikacji Ariadne i podaj repo_ref: <znormalizowany url>" }

search_context
- input: { repo_ref: string, query: string, k?: number (1..10, default 5) }
- output: { results: [ { id, type, content, status, similarity, source, anchors: [{path, symbol, sha}], created_at } ] }

add_context
- input: { repo_ref: string, type: "decision"|"note"|"session_summary", content: string (max 4000), anchors?: [{path, symbol?, sha?}], source: { session_id: string, commit_sha?: string }, replaces_node_id?: uuid }
- source.channel nie jest polem wejsciowym: wejscie przez MCP oznacza codera, wiec serwer wpisuje "coder" sam
- output: { node_id: uuid, status: "proposed", contradicted_node_id?: uuid }
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
- POST /tokens                generacja tokenu MCP (zwrocony raz), GET /tokens lista, DELETE /tokens/:id
- GET  /projects              lista projektow usera
- POST /projects              zalozenie projektu (karta)
- PUT  /projects/:id          edycja karty
- GET  /projects/:id/graph    wezly + krawedzie wyliczone (sekcja 8) do wizualizacji
- GET  /pending               feed pending_actions + wezly proposed/contradicted do przejrzenia
- POST /pending/:id/approve   wykonuje operacje (dla update: przeliczenie embeddingu)
- POST /pending/:id/reject
- POST /nodes/:id/confirm     proposed -> confirmed
- POST /nodes/:id/archive     odrzucenie / archiwizacja
- POST /chat/query            pytanie do asystenta RAG (streaming odpowiedzi)
- POST /chat/edit             konwersacyjny edytor bazy (tani LLM z narzedziami)

Wszystkie endpointy poza /auth/* wymagaja JWT i scopuja po user_id.

## 11. Ekrany aplikacji (komplet MVP)

1. Logowanie / rejestracja.
2. Onboarding (tylko pierwszy raz): (a) kreator profilu, 3-4 pytania, wynik jako tekst edytowalny; (b) zalozenie pierwszego projektu, formularz karty; (c) podpiecie codera: wybor z listy (Claude Code / Codex / inny), wygenerowany token, gotowy snippet do skopiowania i dokladna instrukcja gdzie go wkleic, krok po kroku dla nietechnicznych.
3. Ekran glowny: lista projektow + 4 akcje: wybierz projekt, zapytaj asystenta, rozmawiaj z baza, do potwierdzenia (z licznikiem oczekujacych).
4. Widok projektu: karta projektu (edytowalna) + graf (sekcja 8) + lista ostatnich wezlow.
5. Chat RAG: pytanie, odpowiedz z cytowaniami (zrodlo + data + anchors jako linki do plikow).
6. Rozmawiaj z baza: chat z tanim LLM, ktory dodaje / proponuje edycje / proponuje usuniecia; propozycje destrukcyjne widoczne od razu jako karty do zatwierdzenia.
7. Do potwierdzenia: feed pending_actions oraz wezlow proposed i contradicted; przyciski potwierdz / odrzuc; nieblokujacy, mozna ignorowac.
8. Ustawienia: profil, tokeny, all-permission, klucz Gemini (jesli user daje wlasny).

Nietechniczny user zyje w ekranach 3, 5, 6. Techniczny dodatkowo w 4 i 7. Nic wiecej w wersji pierwszej.

## 12. Decyzje techniczne

- Embeddingi: gemini-embedding-001 z output_dimensionality: 768 (MRL, pelny wymiar 3072 sciety bez straty jakosci), zamrozone w vector(768). Koszt: 0.15 USD za 1M tokenow wejsciowych. Zmiana modelu = przeliczenie wszystkich wektorow skryptem (jedyna kosztowna zmiana, zaakceptowana swiadomie).
- Tani LLM: gemini-2.5-flash-lite (0.10 USD wejscie, 0.40 USD wyjscie za 1M tokenow), ten sam klucz. Szacowany laczny koszt Gemini przy codziennym uzyciu: rzad 1-1.5 USD miesiecznie; istnieje darmowy tier Flash (tresci z darmowego tieru Google wykorzystuje do ulepszania produktow - decyzja swiadoma).
- Indeks: HNSW vector_cosine_ops.
- Backend: Node/TS. ORM: Drizzle (znany userowi stack). Framework HTTP: Hono albo Fastify.
- MCP: oficjalne SDK @modelcontextprotocol/sdk, transport streamable HTTP.
- Hasla: argon2id. Tokeny MCP: 32 bajty losowe, w bazie sha256.
- Tauri 2 + Next.js static export. Graf: react-force-graph.
- Deploy backendu: Docker Compose na VPS (postgres + backend), migracje Drizzle.

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
- Zostaje do sprawdzenia: czy z indexem coder faktycznie siega po search_context. Do tego pytanie, na ktore odpowiedz lezy TYLKO w wezle, nie w karcie projektu i nie w ostatnim podsumowaniu.

Krok 5. REST + aplikacja Tauri.
- Endpointy sekcji 10, ekrany sekcji 11 w kolejnosci: auth -> onboarding -> ekran glowny -> chat RAG -> do potwierdzenia -> rozmawiaj z baza -> widok projektu z grafem.
- Gotowe gdy: nietechniczna osoba przechodzi onboarding bez pomocy i zadaje pierwsze pytanie asystentowi.

Krok 6 (po MVP). Edges + replaces + graph RAG, awansowanie statusow przez przezycie, Row-Level Security, hook konca sesji dla Claude Code, obsluga coderow bez MCP (cienkie CLI).

## 14. Swiadomie odlozone

- Mapowanie codebase (AST, call graph): nigdy, to inny projekt (Graphify).
- Graph RAG, typy krawedzi, tabela edges: krok 6.
- Ocena wagi decyzji (blaha vs nosna) i auto-awans statusow: krok 6.
- Row-Level Security: krok 6 (na start scope po user_id w warstwie serwisowej).
- Historia wersji tresci wezla: gdy okaze sie potrzebna.
- Coderzy bez MCP: gdy zajdzie potrzeba.
- Wlasny klucz Gemini per user vs wspolny klucz aplikacji: MVP na wspolnym, przelacznik w ustawieniach pozniej.
