<p align="center">
  <img src="frontend/src-tauri/icons/128x128.png" width="80" height="80" alt="Ariadne icon">
</p>

<h1 align="center">Ariadne</h1>

<p align="center">
  <strong>Keep the thread between coding sessions.</strong><br>
  Shared project memory and tasks for you, your team, and your AI coding agents.
</p>

<p align="center">
  <a href="https://github.com/r1zuuu/Ariadne/releases/latest"><strong>Download for Windows</strong></a>
  · <a href="#guides">Polski / English</a>
  · <a href="#developer-reference">Developer reference</a>
  · <a href="LICENSE">MIT license</a>
</p>

---

A new chat should not mean explaining your project all over again. Ariadne keeps the decisions, rejected approaches, constraints, and unfinished work that would otherwise stay in yesterday’s conversation.

**You manage the project in a desktop app. Your coding agents read and update the same archive through MCP.** Move from Claude Code to Codex, return after a week, or bring in a teammate: the recorded context stays with the project.

| What you want to do | How Ariadne helps |
| --- | --- |
| **Pick up where you left off** | Gives an agent a project overview, the latest session summary, an index of recorded decisions, and a summary of tasks. |
| **Stop revisiting settled decisions** | Retrieves the reasoning behind a choice, including rejected approaches and notes tied to files or symbols. |
| **Hand work to another agent** | Keeps a shared task list with priorities, blockers, links to memory, and visible agent activity. |
| **Keep control of project knowledge** | Lets you review agent proposals, inspect authorship, and track decisions that have been replaced. |
| **Ask your project a question** | Answers from retrieved archive entries, with references you can open and inspect. |
| **Reuse skills across coding tools** | Links local skill folders across Claude Code, Codex, and the shared agents directory from the desktop app. |

<sub>Early release · Windows 10/11 x64 installer · Polish and English interface · Hosted backend or your own instance</sub>

## Guides

<details>
<summary><strong>🇵🇱 Polski — co możesz z tym zrobić i jak zacząć</strong></summary>

### Pamięć projektu, która zostaje po zamknięciu czatu

Kończysz sesję z Claude Code. Macie wybrane rozwiązanie, dwa odrzucone podejścia i poprawkę do zrobienia później. Następnego dnia otwierasz Codex — albo projekt przejmuje druga osoba.

Ariadne daje kolejnemu agentowi dostęp do tego, co zapisaliście: **dlaczego wybraliście to rozwiązanie, czego nie próbować ponownie i co zostało do zrobienia.** W aplikacji widzisz te same wpisy i zadania, z informacją o ich autorach i statusie.

### Przykład jednej sesji

1. **Na początku:** agent pobiera kontekst projektu i sprawdza zadania.
2. **Przed zmianą:** wyszukuje wcześniejsze ustalenia dotyczące danego pliku lub rozwiązania.
3. **W trakcie:** zapisuje podjętą decyzję wraz z uzasadnieniem, a odłożoną pracę dodaje jako zadanie.
4. **W aplikacji:** przeglądasz propozycje agenta i zatwierdzasz wiedzę, która ma służyć w kolejnych sesjach.
5. **Przy powrocie:** ty, współpracownik lub inny agent korzystacie z tego samego archiwum.

To przepływ oparty na wywołaniach narzędzi MCP: agent musi z nich korzystać. Ariadne nie importuje automatycznie całej rozmowy.

### Co możesz robić

**Zachowywać uzasadnienia decyzji.** Zapisuj wybory technologii, ograniczenia, odrzucone pomysły i podsumowania sesji. Powiąż wpis z plikiem, symbolem lub commitem, żeby agent mógł odnaleźć go przed kolejną zmianą.

**Przekazywać konkretne zadania.** Ty i agenci korzystacie ze wspólnej listy: priorytety, statusy, powód blokady i powiązane ustalenia. Aktywność agenta przy zadaniu jest zgłaszana osobno, więc widać, nad czym właśnie pracuje. To informacja o pracy, a nie blokada uniemożliwiająca innemu agentowi edycję kodu.

**Kontrolować, co staje się wiedzą projektu.** Domyślnie nowe wpisy codera trafiają jako propozycje, a jego poprawki i archiwizacje czekają na zatwierdzenie. Możesz włączyć szersze uprawnienia. Wyszukiwanie MCP zwraca zatwierdzone wpisy; aplikacja pozwala też obejrzeć propozycje, sprzeczności i historię zastąpionych decyzji.

**Pytać bez otwierania terminala.** Na przykład: „Dlaczego wybraliśmy ten sposób logowania?” albo „Jakie ograniczenia zapisaliśmy dla eksportu PDF?”. Asystent odpowiada na podstawie odnalezionych wpisów i wskazuje źródła. Możesz również dodawać i poprawiać pamięć zwykłym językiem.

**Pracować z zespołem.** Zaproś drugą osobę do przestrzeni i udostępnij jej projekty. Każdy korzysta ze swojego konta i tokenu agenta, a wpisy zachowują autorstwo. Graf pozwala przeglądać powiązania między zapisanymi ustaleniami.

**Udostępniać lokalne skills między narzędziami.** W ustawieniach sprawdzisz, które skills widzą Claude Code i Codex, i utworzysz brakujące dowiązania do tych samych folderów. Bez utrzymywania osobnych kopii. Ta funkcja działa na danym komputerze, nie synchronizuje skills w chmurze.

### Zacznij od aplikacji

1. [Pobierz wydanie dla Windows](https://github.com/r1zuuu/Ariadne/releases/latest) — instalator `.exe` lub `.msi`.
2. Zaloguj się przez **Google lub GitHub**. Reset hasła konta e-mail nie jest jeszcze dostępny.
3. Dodaj własny [klucz Gemini](https://aistudio.google.com/apikey) w ustawieniach. Jest potrzebny do funkcji AI, w tym tworzenia embeddingów przy zapisie pamięci, wyszukiwania i asystenta. Wywołania korzystają z limitów i rozliczeń twojego konta Google.
4. Utwórz projekt i powiąż go z repozytorium. Projekt bez remote może używać identyfikatora `local/<nazwa projektu>`.
5. Podłącz codera zgodnie z instrukcją w aplikacji, używając swojego tokenu. Poproś go o pobranie kontekstu i listy zadań z Ariadne.

Instalator korzysta z hostowanego backendu — nie musisz lokalnie stawiać bazy ani serwera. Kod na `main` może być nowszy niż ostatni instalator; informacje o paczce znajdziesz w wydaniu.

### Obecny etap

Ariadne jest rozwijanym, otwartym projektem. Dostępny instalator to **v0.1.1 dla Windows**; nie ma jeszcze gotowych paczek dla macOS i Linuksa.

Instalator nie jest podpisany cyfrowo, więc Windows może wyświetlić ostrzeżenie SmartScreen. Sumy SHA-256 i instrukcja ich sprawdzenia znajdują się w [opisie wydania](https://github.com/r1zuuu/Ariadne/releases/tag/v0.1.1).

Hostowany backend działa na darmowym planie, może się wybudzać przy pierwszym połączeniu i nie ma gwarancji dostępności. Ważne ustalenia zachowuj również poza nim lub uruchom własną instancję. Zaproszenia do przestrzeni używają kodów; nie ma jeszcze wysyłki e-maili, resetu hasła ani limitu logowań utrzymującego się po restarcie.

Poniżej znajdziesz zwijaną instrukcję uruchomienia u siebie, opis MCP i architektury.

</details>

<details>
<summary><strong>🇬🇧 English — workflows, features, and getting started</strong></summary>

### Project memory that outlives the chat

You finish a session with Claude Code: one approach chosen, two rejected, and a fix left for later. Tomorrow you open Codex — or a teammate takes over.

Ariadne gives the next agent access to what you recorded: **why that approach was chosen, what not to repeat, and what still needs doing.** You see the same entries and tasks in the app, with their authors and status.

### A session with Ariadne

1. **Start:** the agent retrieves project context and checks the task list.
2. **Before a change:** it searches for earlier decisions about the relevant file or approach.
3. **During work:** it records a settled decision with its reasoning and creates tasks for concrete work left undone.
4. **Review:** you inspect the agent’s proposals in the app and confirm the knowledge future sessions should use.
5. **Return:** you, a teammate, or another agent pick up from the same archive.

This workflow depends on the agent calling the MCP tools. Ariadne does not automatically import the entire conversation.

### What you can do

**Keep the reasoning.** Record technology choices, constraints, rejected ideas, and session summaries. Attach files, symbols, or commits so an agent can find relevant context before changing something.

**Hand off actionable work.** People and agents share tasks with priorities, statuses, blocker reasons, and links to recorded decisions. Agents report live work separately, making current activity visible. These activity leases are not exclusive locks on tasks or code.

**Review what becomes project knowledge.** By default, new coder entries are proposals, and coder edits and archival requests require approval. Broader permissions are optional. MCP search returns confirmed entries; the app also lets you inspect proposals, conflicts, and superseded decisions.

**Ask the archive.** “Why did we choose this authentication flow?” or “What constraints did we record for PDF export?” The assistant answers from retrieved entries and includes source references. You can also add or revise memory in plain language.

**Share context with a team.** Invite someone into a workspace and share its projects. Each member uses their own account and agent token; records retain their authorship. Explore connections between recorded entries in the graph.

**Share local skills across tools.** Settings shows which skills Claude Code and Codex can see and creates missing directory links to the same skill folders. There are no separate copies to keep in sync. This is local to the computer, not cloud skill synchronization.

### Get started

1. [Download the Windows release](https://github.com/r1zuuu/Ariadne/releases/latest) — choose the `.exe` or `.msi` installer.
2. Sign in with **Google or GitHub**. Email-account password reset is not available yet.
3. Add your own [Gemini API key](https://aistudio.google.com/apikey) in Settings. AI features require it, including embedding new memory entries, search, and the assistant. Calls use your Google account’s quotas and billing.
4. Create a project and associate it with its repository. Projects without a remote can use `local/<project name>`.
5. Follow the in-app instructions to connect your coder with your token. Ask it to retrieve Ariadne’s project context and tasks.

The installer connects to a hosted backend, so there is no local database or server to set up. Code on `main` may be newer than the latest installer; consult the release notes for the packaged build.

### Current status

Ariadne is an actively developed open-source project. The available installer is **v0.1.1 for Windows**. There are no packaged macOS or Linux builds yet.

The installer is unsigned, so Windows may show a SmartScreen warning. SHA-256 checksums and verification instructions are in the [release notes](https://github.com/r1zuuu/Ariadne/releases/tag/v0.1.1).

The hosted backend runs on a free tier, may need to wake on first access, and has no uptime guarantee. Keep another copy of important decisions or run your own instance. Workspace invitations use codes; email delivery, password reset, and login rate limits that survive a restart are not implemented yet.

</details>

## Developer reference

<details>
<summary><strong>MCP — context, memory, and task tools</strong></summary>

Ariadne exposes a Streamable HTTP MCP endpoint at `/mcp`, authenticated with a bearer token created in the app. Project lookup uses `repo_ref`, usually the repository’s Git remote URL.

For a **local backend**, connect Claude Code with:

```bash
claude mcp add --scope user --transport http ariadne http://localhost:3000/mcp --header "Authorization: Bearer <token>"
```

For the hosted backend or another deployment, use that instance’s URL instead of localhost. The app’s onboarding provides connection instructions. Other compatible MCP clients need the same endpoint and bearer authentication.

| Purpose | Tools |
| --- | --- |
| Open a session | `get_project_context` |
| Retrieve recorded knowledge | `search_context` |
| Record or revise memory | `add_context`, `update_context`, `delete_context` |
| Read and manage tasks | `get_tasks`, `create_task`, `update_task` |
| Report current work | `start_task_work`, `heartbeat_task_work`, `stop_task_work` |

The boot context includes a sampled decision index with total counts and file references, rather than the entire archive. Agents should search for the full entries relevant to their work.

Task updates can include a `revision` to reject stale writes. Live work uses renewable leases; the MCP instructions ask agents to send a heartbeat every 45 seconds and stop the run when finished, paused, blocked, or handed off.

The [tool definitions](backend/src/mcp.ts) contain the full input schemas and agent instructions.

</details>

<details>
<summary><strong>Architecture and retrieval</strong></summary>

The desktop app uses REST and coding agents use MCP. Both call the same service layer and read the same workspace archive.

| Layer | Implementation |
| --- | --- |
| Desktop | Tauri 2, Next.js static export, React, Polish/English interface |
| API and MCP | Node.js 22+, Hono, MCP SDK |
| Storage | PostgreSQL 17, pgvector, Drizzle |
| Retrieval | Vector similarity + identifier-aware PostgreSQL full-text search, merged with Reciprocal Rank Fusion |
| AI | Gemini embeddings and assistant responses using each user’s API key |
| Workspace access | Service-layer authorization and PostgreSQL row-level security |
| Local skills | Tauri/Rust filesystem commands; Windows junctions or Unix symlinks |

Memory entries retain their source and can carry code anchors. Their lifecycle distinguishes proposed, confirmed, contradicted, and archived knowledge. Tasks track operational work separately from those knowledge statuses.

**Retrieval has an accompanying case study.** It compares vector and hybrid search across 62 questions over 180 fragments, explains why identifier queries behave differently from prose, and documents the decision to remove LLM-based identifier extraction.

The published benchmark measures the earlier hybrid variant with that extra model call; it is not a benchmark of the final regex-only implementation. [Read the methodology, results, and trade-offs →](docs/rag-case-study.md)

</details>

<details>
<summary><strong>Run locally / uruchom u siebie</strong></summary>

Requirements: **Node.js 22+**, **Docker with Compose**, and **Rust plus the platform build prerequisites** for the Tauri desktop app. For browser development, use the Next.js dev server; local skill sharing requires the desktop app.

Po polsku: skopiuj konfigurację, ustaw hasła, uruchom bazę i migracje, a następnie nadaj hasło roli aplikacyjnej. Backend i frontend uruchom w osobnych terminalach. Wersja przeglądarkowa nie obsługuje lokalnych skills.

**1. Database and dependencies — from the repository root**

```bash
cp .env.example .env
# Set your database passwords and matching connection URLs in .env.
docker compose up -d

cd backend
npm install
npx drizzle-kit migrate
```

**2. Give the application role its password**

Migration `0008` creates `ariadne_app` without a password. Connect to the database as the owner and run:

```sql
ALTER ROLE ariadne_app LOGIN PASSWORD 'replace-with-your-app-role-password';
```

Use the same password in `DATABASE_URL_APP` in the root `.env`. `DATABASE_URL` is the owner connection for migrations; `DATABASE_URL_APP` is the restricted runtime connection used for row-level security.

**3. Start the backend — from `backend/`**

```bash
npm run dev
```

**4. Start the frontend — in a second terminal, from the repository root**

```bash
cd frontend
npm install
npm run tauri dev
```

For browser development, run `npm run dev` instead and open `http://localhost:3001`.

The API defaults to `http://localhost:3000`. For a different backend, set `NEXT_PUBLIC_ARIADNE_URL` in `frontend/.env.local` before building. It is compiled into the static export, so changing a packaged app’s target requires a rebuild.

Each user supplies their Gemini key in the app. The root `GEMINI_API_KEY` variable is for the embedding-check script, not a shared server key. Google/GitHub sign-in on your own instance also requires provider configuration; see [the OAuth implementation](backend/src/oauth.ts).

**Verification**

The backend has integration verification scripts that exercise a running local setup. Consult each script for its setup requirements:

```bash
cd backend
npx tsx scripts/verify-service.ts
npx tsx scripts/verify-rest.ts
npx tsx scripts/verify-tasks.ts
```

The [UX seed script](backend/scripts/seed-ux.ts) populates interface states for local inspection and refuses non-localhost databases.

</details>

---

[Product](PRODUCT.md) · [Interface design](DESIGN.md) · [Retrieval case study](docs/rag-case-study.md) · [UX audit](docs/ux-audit.md)

Released under the [MIT License](LICENSE).
