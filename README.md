# Ariadne

Ariadne stores the *why* of a project, so an LLM coding agent stops paying for
the same context twice.

An agent reads the repository for what the code does and where it lives. Ariadne
holds the layer no repository contains: which approaches were rejected and why,
which constraints are real, which trap someone already fell into. Decisions,
notes and end-of-session summaries, each one a single thought with its
provenance attached, retrieved by meaning rather than by keyword, and handed
back to whichever agent opens the next session.

It is a desktop app for the person, and an MCP server for their coder. Both read
and write the same archive.

## Install

Windows 10 or 11, 64-bit. [**Download the installer**](https://github.com/r1zuuu/Ariadne/releases/latest)
(`Ariadne_0.1.0_x64-setup.exe`, 2.6 MB). There is also an `.msi` in the same
release if you prefer it. Nothing else to set up: the app talks to a hosted
backend, so there is no database to install and no server to start.

**Windows will warn you, and here is why.** The installer is not code-signed:
a certificate costs several hundred dollars a year, which this project does not
have. SmartScreen judges a file by the reputation of its signature, so an
unsigned one from a small project gets a blue "Windows protected your PC"
screen. Click **More info**, then **Run anyway**.

If you would rather verify than trust, compare the checksum before running it:

```powershell
Get-FileHash Ariadne_0.1.0_x64-setup.exe -Algorithm SHA256
```

```
413c99cd5d641767c30f68022dc4a7a68e9264c1f13dd79d505fcb532b35e360  Ariadne_0.1.0_x64-setup.exe
f70a00a367a8e35c021768a68f64910cb45ae2218ae9d6cb6fd7e5bb580e71b1  Ariadne_0.1.0_x64_en-US.msi
```

No macOS or Linux build yet. Tauri builds only for the system it runs on, and
this was built on Windows. Both are possible and neither is done.

### Two things to know before you start

**Sign in with Google or GitHub.** There is no password reset yet, so an account
made with an email and a forgotten password cannot be recovered.

**Bring your own Gemini key.** Search and the assistant run on Gemini, and the
server has no key of its own: every call is billed to the account that asked.
Get a key at [aistudio.google.com](https://aistudio.google.com/apikey), which
has a free tier, and paste it into Settings on first run. Without it the app
still records and shows everything, but the assistant and search by meaning stay
switched off.

The backend runs on a free plan that sleeps when nobody uses it. If the first
screen takes a while, it is waking up.

## How it works

```
Claude Code / Codex ──MCP──┐
                           ├──> Node backend ──> Postgres + pgvector
Desktop app (Tauri) ──REST─┘
```

- **Backend** (`backend/`) is Hono on Node 22, Drizzle over Postgres, and an MCP
  streamable-HTTP endpoint at `/mcp`. Agents authenticate with a bearer token
  that says who is calling; the workspaces that token belongs to decide what it
  can reach.
- **Database** is Postgres 17 with pgvector. Isolation between workspaces has
  two locks, not one: the service layer filters, and row-level security
  (migration `0008`) refuses anyway. Even with the filter deleted from
  `service.ts`, one workspace cannot read another.
- **Search** is hybrid: pgvector for meaning, Postgres full-text for the exact
  word (migration `0010`). `docs/rag-case-study.md` records what that changed
  and what it did not.
- **Frontend** (`frontend/`) is a Next.js static export running inside a Tauri
  window, with Polish and English copy through next-intl.
- **Gemini** does the embeddings and the assistant's answers, paid for by the
  account that asked, using the key it saved in settings. The server has no key
  of its own.

## Running it locally

Needs Node 22+, Docker, and Rust if you want to build the desktop window.

```bash
cp .env.example .env          # fill in the passwords
docker compose up -d          # Postgres 17 with pgvector on :5432
cd backend && npm install && npx drizzle-kit migrate && npm run dev
```

Migration `0008` creates the `ariadne_app` role without a password. Give it one
in psql before the server can connect as it:

```sql
ALTER ROLE ariadne_app LOGIN PASSWORD 'the password from your .env';
```

The frontend, in a second terminal:

```bash
cd frontend && npm install && npm run tauri dev
```

The API address is compiled into the static export, so it is a build-time
variable. For a build pointing anywhere but `localhost:3000`, set
`NEXT_PUBLIC_ARIADNE_URL` in `frontend/.env.local` and rebuild.

### Connecting a coder

Generate a token in the app under Settings, then:

```bash
claude mcp add --transport http ariadne http://localhost:3000/mcp --header "Authorization: Bearer <token>"
```

## Verifying it

There is no test framework here. Each layer has one runnable script that asserts
its way through the real thing and fails loudly:

```bash
cd backend
npx tsx scripts/verify-service.ts   # service layer against a live database
npx tsx scripts/verify-rest.ts      # every REST route, both roles, RLS included
npx tsx scripts/verify-tasks.ts     # task leases and their state machine
```

`scripts/seed-ux.ts` fills a local database with every interface state worth
looking at. It refuses to run against anything but localhost.

## Status

Version 0.1.0, built by one person while learning. It works end to end: two
people in one workspace, each with their own agent, reading and writing the same
archive. What it does not have yet is email (so invitations are codes you copy,
and there is no password reset), a rate limit that survives a restart, and any
monitoring beyond the hosting provider's log tab.

The hosted backend this release points at runs on free tiers, maintained by one
person as a side project. Treat it as somewhere to try the thing, not as a
service with an uptime promise: your archive is worth keeping, so anything you
would hate to lose should live somewhere else too. Running your own is the
section above, and the app is a build flag away from pointing at it.

`PRODUCT.md` explains who it is for. `DESIGN.md` is the interface spec.
`docs/ux-audit.md` is an audit of the app as it stands, including what is still
wrong with it.

## License

MIT. See [LICENSE](LICENSE).
