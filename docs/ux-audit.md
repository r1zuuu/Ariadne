# Audyt UX/UI Ariadne

Dokument roboczy. Aktualizowany w trakcie, żeby postęp przetrwał skrócenie kontekstu.

Branch: `feature/ux-audit`. Stan: **środowisko i seed gotowe, audyt na 1920px wykonany, macierz viewportów zablokowana.**

---

## 1. Środowisko testowe

| Element | Gdzie | Stan |
|---|---|---|
| Postgres z pgvector | kontener `ariadne-db-1`, `localhost:5432` | zdrowy, 15 migracji |
| Backend | `localhost:3000`, `--env-file=../.env.test` | odpowiada na `/healthz` |
| Frontend | `localhost:3001`, `next dev` | woła `localhost:3000` |
| Przeglądarka | claude-in-chrome, tab `1792803632` | potwierdzona interakcją |

### Dowód, że backend nie dotyka produkcji

1. Backend wystartowany z `--env-file=../.env.test`.
2. `POST /auth/register` z adresem `ux-probe-1788701887@test.local` → token wydany.
3. Baza **lokalna**: sonda obecna, kont razem 4.
4. Baza **produkcyjna** (odczyt tylko): ta sama sonda → `0` trafień, kont razem 8, bez zmian.

### Pułapka

`backend/drizzle.config.ts` ma na sztywno `process.loadEnvFile("../.env")`, czyli plik produkcyjny. `npm run db:migrate` celuje w Neona, nie w kontener. Sprawdzone empirycznie: `loadEnvFile` **nie nadpisuje** zmiennej już obecnej w środowisku, więc eksport w powłoce też by zadziałał, ale po cichu. Stąd `backend/drizzle.config.test.ts`, którego nie da się uruchomić przez pomyłkę.

### Odtworzenie od zera

```bash
docker compose up -d
```

Rola aplikacyjna (migracja 0008 tworzy ją bez prawa logowania):

```bash
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ariadne_app') THEN CREATE ROLE ariadne_app LOGIN PASSWORD 'ariadne_app_local'; ELSE ALTER ROLE ariadne_app LOGIN PASSWORD 'ariadne_app_local'; END IF; END \$\$;"
```

```bash
cd backend && npx drizzle-kit migrate --config drizzle.config.test.ts
```

```bash
cd backend && npx tsx --env-file=../.env.test src/index.ts
```

```bash
cd frontend && npx next dev -p 3001
```

### Powrót do produkcji

```bash
cp frontend/.env.local.production-backup frontend/.env.local
```

Potem restart serwera deweloperskiego. `.env` jest nietknięty. Pliki `.env.test`, `.env.production-backup` i `frontend/.env.local.production-backup` są w `.gitignore`.

---

## 2. Korekta wcześniejszej obserwacji

Postawiłem tezę, że na ekranie logowania brakuje przycisków Google i GitHub, i wyjaśniłem to usypianiem Rendera. **Teza była błędna.**

| Sprawdzenie | Wynik |
|---|---|
| Zrzut pełnej skali | oba przyciski widoczne |
| `find` po drzewie dostępności | `button "Dalej przez Google"`, `button "Dalej przez GitHub"` |
| `read_page` po nawigacji | 6 kontrolek, oba przyciski w tym |
| `read_network_requests` | `GET /auth/providers` → **200** |

Kontrolki istnieją, są widoczne i mają poprawne nazwy dostępne. Pierwszy `read_page` poszedł w jednej paczce zaraz po `navigate`, zanim odpowiedź wróciła, i wziąłem migawkę pomiaru za stan produktu. Błąd interpretacji odczytu narzędzia, nie usterka aplikacji.

---

## 3. Dane testowe

`backend/scripts/seed-ux.ts`, powtarzalny: drugi przebieg czyści swój poprzedni i odtwarza ten sam stan. Odmawia startu, gdy `DATABASE_URL` nie wskazuje na localhost.

```bash
cd backend && npx tsx scripts/seed-ux.ts
```

Konta, hasło `ux-audit-2026`:

| Konto | Rola i wariant |
|---|---|
| `owner@ux.test` | właściciel archiwum prywatnego i zespołowego |
| `member@ux.test` | członek cudzego archiwum, własne prywatne |
| `invited@ux.test` | ma otwarte zaproszenie, jeszcze nie odpowiedział |
| `fresh@ux.test` | zero projektów: stany puste i pierwsze uruchomienie |

Zawartość: 3 projekty (pusty, mały, gęsty), 62 wpisy (proposed 16, confirmed 18, contradicted 14, archived 14; kanały coder / app_chat / app_form, tytuły od jednego słowa po 200 znaków, blok kodu, lista), 7 zadań we wszystkich stanach, 2 rozmowy.

**Oznaczone jako symulacja:**

1. **Embeddingi** to deterministyczne wektory pseudolosowe, nie wyjście modelu. Wyszukiwanie leksykalne działa normalnie; podobieństwo wektorowe nic nie znaczy, więc kolejność źródeł pod odpowiedzią niczego nie dowodzi.
2. **Aktywne wykonania zadań** to wiersze wpisane wprost do `task_active_runs` z `source.simulated = true`. Żadna sesja Claude ani Codex za nimi nie stoi. Dowodzą, że interfejs rysuje żywy lease; nie dowodzą niczego o prawdziwej integracji.

---

## 4. Znalezione problemy

Priorytety: **P0** blokada działania, **P1** poważny problem czytelności lub użyteczności, **P2** hierarchia i spójność, **P3** dopracowanie.

### U1 — miara wiersza chybiała o 38%. P1. NAPRAWIONE

- **Ekran / rola:** cały system, obie role. Viewport 1920.
- **Problem:** limity szerokości pisane w `ch`. `1ch` to szerokość cyfry zero, a w Geist ten glif jest 1,38 razy szerszy od średniego znaku prozy: przy 15px zero ma 9,95px, średni znak 7,21px.
- **Skutek:** `max-w-[68ch]` prosił o 68 znaków i dawał **94**. Akapity bez limitu dochodziły do **111 znaków**. Norma czytelności to 45–75.
- **Dowód:** pomiar prawdziwym tekstem w wyrenderowanej stronie. Przed: 72 / 82 / 90 / 108 / 111 znaków na `/settings`.
- **Poprawka:** trzy narzędzia w `em` w `globals.css` (`measure` ~66, `measure-wide` ~75, `measure-tight` ~52), 36 miejsc przepiętych, plus limit w `FieldNote` i `Banner`, które nie miały żadnego.
- **Weryfikacja:** po zmianie każdy akapit prozy na `/settings` ma **66 znaków** przy 15px (480px) i przy 17px (544px). Zero akapitów ponad 78 znaków.
- Limity nagłówków (`14ch`, `16ch`, `24ch`, `34ch`) zostały nietknięte: siedzą na Playfair i sterują łamaniem wiersza display, a nie długością czytania.

### U2 — przeglądarka malowała swoje elementy jak dla białej strony. P2. NAPRAWIONE

- **Problem:** `color-scheme` nigdzie nie zadeklarowane, przy tle `#090b0f`.
- **Skutek:** jasny pasek przewijania 15px przy każdym ekranie, jasna lista rozwijana `<select>`, jasne autouzupełnianie.
- **Dowód:** `colorScheme === "normal"`, `main.offsetWidth - main.clientWidth === 15`, zero reguł `scrollbar` w arkuszach.
- **Poprawka:** `color-scheme: dark` na `html`. **Weryfikacja:** `colorScheme === "dark"`, pasek ciemny na zrzucie.

### U3 — tytuł karty i etykieta pola nie do odróżnienia. P2. NAPRAWIONE

- **Problem:** oba używały `text-small font-medium text-ink`, czyli 15px/500.
- **Skutek:** karta hasła czytała się jak trzy równe etykiety: „Hasło", „Obecne hasło", „Nowe hasło".
- **Dowód:** pomiar stopni typograficznych na `/settings`: 16 odrębnych stylów, `15/500` w 10 miejscach obejmujących nawigację, przyciski i etykiety pól.
- **Poprawka:** `CardTitle` w `ui.tsx`, 17px/500. **Weryfikacja:** tytuł karty 17px/500, etykieta pola 15px/500.

### U4 — licznik sklejony z nagłówkiem w nazwie dostępnej. P3. NAPRAWIONE

- **Dowód:** nazwa `h2` liczyła się jako `Tokeny agentów1`; odstęp rysuje flex `gap`, a odstępy CSS nie wchodzą do nazwy dostępnej.
- **Poprawka:** `aria-label` na nagłówku. **Weryfikacja:** `Tokeny agentów 1`.

### U5 — grupa przełączników języka bez nazwy. P3. NAPRAWIONE

- **Poprawka:** `role="group"` plus `aria-labelledby`. **Weryfikacja:** atrybut obecny w DOM.

### U6 — lista ostatnich rozmów obcina 100% tytułów. P3. OTWARTE, zablokowane

- **Ekran:** `/home`. `<aside>` pozycjonowany absolutnie obok komponera, `w-[140px]`, po najechaniu `w-[200px]`, ukryty poniżej 1280px.
- **Dowód:** tytuł „Czemu skille nie ida przez MCP?" ma 193px treści w 140px widoku. Każda pozycja listy jest ucięta.
- **Dlaczego nie naprawione:** element jest pozycjonowany względem krawędzi kontenera i przy 1280px ma około 86px zapasu, więc poszerzenie może go wypchnąć poza obszar. Zmiana szerokości bez możliwości sprawdzenia przy 1280 i 1536 byłaby zmianą niezweryfikowaną. Czeka na odblokowanie viewportów.

### U7 - wyszukiwanie bez trafien klamalo, ze nic tu nie ma. P2. NAPRAWIONE

- **Ekran / rola:** `/tasks`, owner i member. Viewport 1920.
- **Problem:** lista przefiltrowana do zera pokazywala komunikat pustego archiwum: „Nie ma tu zadan. Kiedy czlowiek albo agent zostawi konkretna prace na pozniej, pojawi sie tutaj."
- **Skutek:** komu wpisal slowo w wyszukiwarke, temu aplikacja odpowiadala, ze nikt jeszcze nic nie zapisal. Zadan bylo siedem. Do tego zadnej drogi powrotu.
- **Dowod:** zapytanie `qqqxyz-nic-takiego`, zrzut z komunikatem pustego archiwum przy siedmiu istniejacych zadaniach.
- **Poprawka:** osobny stan dla listy przefiltrowanej, z przyciskiem czyszczacym naraz zapytanie i zakladke.
- **Weryfikacja:** to samo zapytanie daje teraz „Nic nie pasuje do tego filtra" plus „Wyczysc filtry"; przycisk przywraca wszystkie siedem.

### U8 - formularza nowego zadania nie dalo sie zatwierdzic. **P0.** NAPRAWIONE

Najpowazniejsze znalezisko audytu.

- **Ekran / rola:** `/tasks`, obie role. Viewport 1920.
- **Problem:** `Collapse` animowal `height` do `auto`, co oznacza zmierzenie zawartosci raz i wpisanie tej liczby w styl. Liczba przestaje byc prawdziwa, gdy cokolwiek w srodku sie zmieni albo ekran przerysuje sie w trakcie animacji. Ekran zadan odswieza sie sam co 15 sekund i przy powrocie fokusu do okna, wiec animacja byla przerywana.
- **Skutek:** panel trzymal **335px wokol 463px tresci**. Pole priorytetu i oba przyciski lezaly ponizej obcietej krawedzi: obecne w DOM, niewidoczne na ekranie. **Nie bylo zadnej drogi, zeby utworzyc zadanie z interfejsu.**
- **Dowod:**

```
clientHeight panelu:            335
scrollHeight panelu:            463
"Utworz zadanie" ponizej krawedzi: 79px
elementFromPoint w srodku przycisku: BUTTON "Do zrobienia"   <- zakladka pod spodem
```

- **Poprawka:** wiersze siatki od `0fr` do `1fr` zamiast animowanej wysokosci. Wiersz `1fr` jest z definicji wielkosci tresci, wiec nie ma pomiaru, ktory moglby sie zdezaktualizowac.
- **Weryfikacja funkcjonalna:** `elementFromPoint` nad przyciskiem zwraca teraz `BUTTON "Utworz zadanie"`; zadanie wpisane w formularz zostalo utworzone, toast potwierdzil, wiersz pojawil sie na liscie.
- **Regresje na ekranach dzielacych komponent:** `/pending` sprawdzony, panel wpisu rozwija sie z pelna trescia i przyciskami. `/teams`, `/database`, `ask` i `entry-card` uzywaja tego samego komponentu; sprawdzone wizualnie przez `/pending`, przebieg klikany niepelny.

### U9 - kreator prosil o kod zaproszenia, ktory serwer juz mial. P1. NAPRAWIONE

- **Ekran / rola:** `/onboarding`, konto `invited@ux.test`. Viewport 1920.
- **Problem:** konto zaproszone do zespolu, logujac sie pierwszy raz, trafia do kreatora. Kreator ma sciezke dolaczania, ale lezy ona za obowiazkowym kluczem Gemini na kroku trzecim i prosi o **wklejenie kodu**. Kod jest juz zwiazany z adresem tej osoby i serwer wydaje go na zadanie. Kreator stoi poza powloka, wiec `AppProvider`, jedyne miejsce wolajace `/me/invites`, nigdy tam nie dziala.
- **Dowod przed zmiana:** `/me/invites` zwrocilo zaproszenie do „Nic Ariadny", a jedyna kontrolka na ekranie kreatora to przycisk „Dalej". Ekran `/teams` byl osiagalny tylko przez recznie wpisany adres i pokazywal to samo zaproszenie z odznaka „1 zaproszenie".
- **Poprawka:** `JoinStep` pobiera `myInvites()` i wypisuje czekajace zaproszenia z przyciskiem „Dolacz" na jedno nacisniecie, a kreator domyslnie wchodzi w sciezke dolaczania, gdy cos czeka. Pole na kod przekazany z reki zostaje, pod linia. Ekran zespolow dziala tak od poczatku; ten krok nie dzialal.
- **Weryfikacja:** typecheck i build przechodza. **Przebieg w przegladarce niedokonczony** - patrz bloker drugi. Nie deklaruje tego jako sprawdzone klikaniem.

### Sprawdzone i bez zarzutu

Nie każde sprawdzenie kończy się znaleziskiem. Te wypadły czysto i nic w nich nie zmieniam.

| Kontrola | Wynik | Dowód |
|---|---|---|
| Kontrast tekstu | 0 naruszeń na `/tasks` i `/settings` | obliczone WCAG dla każdego węzła tekstowego względem realnego tła |
| Pierścień fokusu | 2px w kolorze nici, offset 2px | prawdziwy Tab, `matches(':focus-visible') === true`, `outlineColor rgb(91,140,255)` |
| Nazwy dostępne kontrolek | 0 bez nazwy z 30 | skan `button, a, input, select, textarea` |
| Kolejność nagłówków | `h1` + `h2`, bez przeskoków | `/settings`, `/tasks` |
| Przewijanie poziome | 0px | `/home`, `/tasks`, `/settings` |

---

## 5. Blokery

| Bloker | Dowód | Czego potrzebuję | Wpływ |
|---|---|---|---|
| Okno Chrome nie przyjmuje zmiany rozmiaru **ani wejscia z klawiatury i myszy** | `resize_window` raportuje sukces, `innerWidth` zostaje 1920, `outerWidth` spada do 0. Rozstrzygajacy pomiar: `document.visibilityState === "hidden"`, a klikniecie w pole, ktore `elementFromPoint` potwierdza jako trafialne, zostawia `activeElement === BODY` i wpisany tekst nigdzie nie ladu.<br><br>**Korekta wczesniejszej diagnozy:** pisalem, ze okno jest zmaksymalizowane. Dowod mowi co innego - okno jest **zminimalizowane albo w tle**. | przywroc okno Chrome z paska zadan na wierzch i zostaw je w trybie okienkowym, nie zmaksymalizowanym | **macierz 360/390/768/1280/1536 niewykonana**, U6 nie do naprawienia, U9 niedokonczone w przegladarce |
| Logowanie przez Google i GitHub lokalnie | konsole dostawców nie znają `http://localhost:3000/auth/*/callback` | rejestracja adresu zwrotnego albo audyt tego przepływu na produkcji | przepływ OAuth **niesprawdzony**, nie „sprawdzony i działa" |

---

## 6. Macierz pokrycia

Stan obecny: **wyłącznie 1920px**, rola `owner`, jeden motyw. Aplikacja nie ma przełącznika motywu ani reguł `prefers-color-scheme`, więc kolumna motywu ma jedną wartość.

| Ekran | 1920 / owner | 360 | 390 | 768 | 1280 | 1536 |
|---|---|---|---|---|---|---|
| Wejście (logowanie) | sprawdzony | blokada | blokada | blokada | blokada | blokada |
| Przegląd `/home` | sprawdzony | blokada | blokada | blokada | blokada | blokada |
| Projekt `/project` | sprawdzony | blokada | blokada | blokada | blokada | blokada |
| Zadania `/tasks` | sprawdzony | blokada | blokada | blokada | blokada | blokada |
| Dodaj do pamięci `/database` | sprawdzony | blokada | blokada | blokada | blokada | blokada |
| Do zatwierdzenia `/pending` | sprawdzony | blokada | blokada | blokada | blokada | blokada |
| Zespoły `/teams` | sprawdzony | blokada | blokada | blokada | blokada | blokada |
| Ustawienia `/settings` | sprawdzony | blokada | blokada | blokada | blokada | blokada |
| Onboarding `/onboarding` | niesprawdzony | blokada | blokada | blokada | blokada | blokada |

Role `member`, `invited` i `fresh`: konta gotowe, przebieg niewykonany.

## 7. Wyniki kontroli repozytorium

| Kontrola | Polecenie | Wynik |
|---|---|---|
| Typy frontendu | `npx tsc --noEmit` | przechodzi |
| Build frontendu | `npm run build` | przechodzi, 12 stron |
| Testy Rust | `cargo test --lib` | 4 testy, przechodzą |
| Linter | — | **nie istnieje w tym repozytorium**, nie raportuję jako zaliczony |
