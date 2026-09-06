# Audyt UX/UI Ariadne

Dokument roboczy. Aktualizowany w trakcie, żeby postęp przetrwał skrócenie kontekstu.

Branch: `feature/ux-audit`. Stan: **środowisko testowe gotowe, audyt nierozpoczęty.**

---

## 1. Środowisko testowe

### Co stoi

| Element | Gdzie | Stan |
|---|---|---|
| Postgres z pgvector | kontener `ariadne-db-1`, `localhost:5432` | zdrowy, 15 migracji |
| Backend | `localhost:3000`, `npx tsx --env-file=../.env.test src/index.ts` | odpowiada na `/healthz` |
| Frontend | `localhost:3001`, `npx next dev -p 3001` | odpowiada, woła localhost:3000 |
| Przeglądarka | claude-in-chrome, tab `1792803632` | potwierdzona interakcją |

### Dowód, że backend nie dotyka produkcji

Wymóg postawiony wprost przed migracjami i seedem. Przebieg:

1. Backend wystartowany z `--env-file=../.env.test`.
2. `POST /auth/register` z adresem `ux-probe-1788701887@test.local` → token wydany.
3. Baza **lokalna**: `select email from users where email like 'ux-probe-%'` → wiersz jest, kont razem 4.
4. Baza **produkcyjna** (odczyt tylko): ta sama sonda → `0` trafień, kont razem 8, bez zmian.

Konto sondy zostaje w bazie lokalnej do czasu seeda, który ustala docelowy zestaw kont.

### Pułapka, na którą trzeba uważać

`backend/drizzle.config.ts` ma na sztywno `process.loadEnvFile("../.env")`, czyli **plik produkcyjny**. `npm run db:migrate` celuje więc w Neona, nie w kontener.

Sprawdzone empirycznie: `process.loadEnvFile` **nie nadpisuje** zmiennej, którą środowisko już niesie, więc `DATABASE_URL=... npm run db:migrate` też by zadziałało. Ale działa po cichu, a migracja puszczona w złą bazę nie zgłasza się sama.

Stąd `backend/drizzle.config.test.ts`: ten sam config, wskazujący `../.env.test`. Nie da się go uruchomić przez pomyłkę.

### Odtworzenie od zera

```bash
docker compose up -d
```

Rola aplikacyjna (migracja 0008 tworzy ją bez prawa logowania, hasło nadaje się ręcznie):

```bash
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ariadne_app') THEN CREATE ROLE ariadne_app LOGIN PASSWORD 'ariadne_app_local'; ELSE ALTER ROLE ariadne_app LOGIN PASSWORD 'ariadne_app_local'; END IF; END \$\$;"
```

Migracje, backend, frontend:

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

Konfiguracja produkcyjna jest nietknięta w `.env` i `frontend/.env.local.production-backup`. Przywrócenie:

```bash
cp frontend/.env.local.production-backup frontend/.env.local
```

Potem restart `next dev` albo `npm run tauri dev`. Backend produkcyjny stoi na Renderze i nic z tej pracy go nie dotyczy. Pliki `.env.test`, `.env.production-backup` i `frontend/.env.local.production-backup` są w `.gitignore`.

### Czego to środowisko nie obejmuje

- **Logowanie przez Google i GitHub nie działa lokalnie.** Konsole obu dostawców nie znają `http://localhost:3000/auth/*/callback`. Konta testowe mają hasła i wchodzą przez formularz. Przepływ OAuth jest tu **zablokowany**, nie „sprawdzony".
- Klucz Gemini jest przeniesiony z konfiguracji produkcyjnej, więc czat i zapis wpisów płacą prawdziwym kontem Google.

---

## 2. Korekta wcześniejszej obserwacji

**Twierdzenie, które postawiłem i które było błędne:** „na ekranie logowania nie ma przycisków Google ani GitHub", z wyjaśnieniem przez usypianie Rendera i propozycją priorytetu P1.

**Co pokazują dowody:**

| Sprawdzenie | Wynik |
|---|---|
| Zrzut ekranu, pełna skala | oba przyciski widoczne, przekładka „albo" nad nimi |
| `find` po drzewie dostępności | `button "Dalej przez Google"`, `button "Dalej przez GitHub"` |
| `read_page` bezpośrednio po nawigacji | 6 kontrolek, w tym oba przyciski |
| `read_network_requests` | `GET /auth/providers` → **200** |

**Ustalenie:** kontrolki istnieją, są widoczne i **mają poprawne nazwy dostępne**. Żądanie kończy się sukcesem. To nie jest ani brak funkcji, ani luka w dostępności.

**Co się naprawdę wydarzyło po mojej stronie:** pierwszy `read_page` poszedł w jednej paczce zaraz po `navigate`, zanim odpowiedź `/auth/providers` wróciła. Zobaczyłem cztery kontrolki zamiast sześciu i **wziąłem migawkę pomiaru za stan produktu**. To błąd interpretacji odczytu narzędzia, nie usterka aplikacji.

**Co z tego zostaje jako obserwacja do audytu, bez priorytetu do czasu weryfikacji:** ekran nie rezerwuje miejsca na rząd dostawców, dopóki lista się nie wczyta. Czy to daje widoczne przeskoczenie układu i przy jakim opóźnieniu odpowiedzi, trzeba zmierzyć na sztucznie spowolnionym żądaniu. Do tego czasu jest to hipoteza, nie problem.

---

## 3. Zakres audytu

Do uzupełnienia po `/goal`.

- Macierz pokrycia: ekran × rola × viewport.
- Role: `owner` i `member` (w schemacie nie ma innych), plus warianty członkostwa: solo, właściciel zespołu, członek zespołu, zaproszony.
- Viewporty: 360, 390, 768, 1280, 1536.
- Motywy: **jeden**. `globals.css` nie zawiera `prefers-color-scheme` ani `data-theme`; aplikacja jest wyłącznie jasna, zgodnie z DESIGN.md.

## 4. Dane testowe

Do uzupełnienia po `/goal`.

## 5. Znalezione problemy

Do uzupełnienia. Format: ID | ekran i rola | viewport | problem | skutek | dowód | priorytet | proponowana poprawka.

## 6. Blokery

| Bloker | Stan |
|---|---|
| Logowanie przez Google i GitHub lokalnie | otwarty, wynika z konfiguracji konsoli dostawców |
