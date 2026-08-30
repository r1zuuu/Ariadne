// Step-2 "done when" check (plan section 13): write 10 nodes, run 3 different
// queries, eyeball the ranking. Run from backend/: npx tsx scripts/verify-service.ts
// Idempotent: recreates the verify user (cascade wipes old data) on each run.
process.loadEnvFile("../.env");
// Admin script: runs as the owner role, which the policies of migration 0008 do
// not apply to. It calls the service layer directly, with no request to scope by.
process.env.DATABASE_URL_APP = process.env.DATABASE_URL;

const { db } = await import("../src/db/client.js");
const { apiTokens, memberships, nodes, users, projects, workspaces } = await import("../src/db/schema.js");
const { eq } = await import("drizzle-orm");
const service = await import("../src/service.js");
const { seal } = await import("../src/crypto.js");

// The tidying every project card goes through on the way in. Pure and cheap,
// so it runs first, before anything here needs a database or a key.
const messy = "  Pierwszy akapit.  \r\n\r\n\r\n\r\n  Drugi\tz  tabem.  \r\n";
if (service.normalizeProse(messy) !== "Pierwszy akapit.\n\nDrugi z tabem.")
  throw new Error("normalizeProse should collapse CRLF, blank-line runs and inner whitespace");
// A single break inside a paragraph is a list or a deliberate line, not spacing.
if (service.normalizeProse("a\nb") !== "a\nb") throw new Error("a single newline should survive");
if (service.normalizeProse("\n \n\t\n") !== "") throw new Error("whitespace-only prose should come out empty");
console.log("  normalizeProse: OK");


// The service reads the key off the account, not off the environment: without
// this the first createNode below throws no_gemini_key.
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) throw new Error("GEMINI_API_KEY is not set (add it to ../.env)");

const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, "verify@ariadne.local"));
if (existing) await db.delete(users).where(eq(users.id, existing.id));

const [user] = await db
  .insert(users)
  .values({
    email: "verify@ariadne.local",
    passwordHash: "not-a-real-hash",
    profile: "Stas, junior dev, uczy sie budujac; preferuje proste rozwiazania",
    geminiKey: seal(geminiKey),
  })
  .returning({ id: users.id });

// Inserted rather than registered, so the private workspace is made by hand.
const [workspace] = await db
  .insert(workspaces)
  .values({ name: "verify@ariadne.local", ownerId: user.id })
  .returning({ id: workspaces.id });
await db.insert(memberships).values({ workspaceId: workspace.id, userId: user.id, role: "owner" });

const [project] = await db
  .insert(projects)
  .values({
    workspaceId: workspace.id,
    name: "Ariadne",
    repoRef: "github.com/r1zuuu/Ariadne",
    opis: "Warstwa pamieci dla LLM coderow",
    stack: "Node/TS, Postgres+pgvector, Drizzle, Hono, Tauri",
  })
  .returning({ id: projects.id });

const source = { session_id: crypto.randomUUID(), channel: "coder" as const };

const seedNodes: Array<{ type: "decision" | "note" | "session_summary"; content: string; anchors?: { path: string; symbol?: string }[] }> = [
  { type: "decision", content: "Wybralismy Hono zamiast Fastify, bo jest lzejszy i ma fetch-style handlery pasujace do MCP streamable HTTP", anchors: [{ path: "backend/package.json" }] },
  { type: "decision", content: "Embeddingi liczy zawsze serwer modelem gemini-embedding-001 z output_dimensionality 768 i normalizacja wektora", anchors: [{ path: "backend/src/gemini.ts", symbol: "embed" }] },
  { type: "decision", content: "Statusy wezlow trzymamy jako text z CHECK constraint zamiast pg_enum, bo zmiana wartosci to jedna migracja", anchors: [{ path: "backend/src/db/schema.ts" }] },
  { type: "decision", content: "Nic nie kasujemy fizycznie: delete ustawia status archived, a RAG filtruje archived w zapytaniu", anchors: [{ path: "backend/src/service.ts", symbol: "archiveNode" }] },
  { type: "decision", content: "Jeden plik .env w korzeniu repo wspolny dla docker compose i drizzle, ladowany przez process.loadEnvFile" },
  { type: "note", content: "Haslo Postgresa ustawia sie tylko przy pierwszym starcie na pustym wolumenie; zmiana hasla wymaga docker compose down -v" },
  { type: "note", content: "Drizzle Studio (npx drizzle-kit studio) to UI do przegladania tabel bazy, nie trzeba instalowac pgAdmina" },
  { type: "note", content: "Obraz pgvector/pgvector:pg17 ma wkompilowane rozszerzenie vector, healthcheck pg_isready pozwala na up --wait" },
  { type: "session_summary", content: "Sesja 1: postawilismy baze - Docker Compose z pgvector, schemat Drizzle z 6 tabelami, migracja przechodzi na swiezej bazie" },
  { type: "session_summary", content: "Sesja 2: warstwa serwisowa - createNode z walidacja i embeddingiem, searchNodes, boot context, pending actions i cykl zycia statusow" },
];

console.log("Seeding 10 nodes...");
for (const n of seedNodes) {
  const created = await service.createNode({ userId: user.id, projectId: project.id, type: n.type, content: n.content, anchors: n.anchors, source });
  // The seed arrives over the coder channel, so it lands as a proposal on an
  // account with all_permission off, and the boot index only carries confirmed
  // entries. Approving here is what a person would do before opening a session;
  // without it the index section below would report an empty archive and prove
  // nothing.
  await service.confirmNode({ userId: user.id, nodeId: created.nodeId });
}

const queries = [
  "jaki framework http wybralismy i dlaczego",
  "jak dziala liczenie embeddingow",
  "gdzie skonczylismy ostatnia sesje",
];

for (const query of queries) {
  console.log(`\n=== "${query}"`);
  const results = await service.searchNodes({ userId: user.id, projectId: project.id, query, k: 3, channel: "app" });
  for (const r of results) {
    console.log(`  ${r.similarity.toFixed(3)} [${r.type}] ${r.content.slice(0, 90)}...`);
  }
}

console.log("\n=== boot context");
const boot = await service.getBootContext({
  userId: user.id,
  repoRef: "https://github.com/r1zuuu/Ariadne.git",
});
console.log(`  profile: ${boot.profile.slice(0, 60)}`);
console.log(`  project: ${boot.project.name} (${boot.project.stack.slice(0, 40)})`);
console.log(`  last summary: ${boot.last_summary?.content.slice(0, 70)}`);
// The index is a sample and has to say so, otherwise ten headlines read as the
// whole archive. by_file is the part that stays useful as the archive grows.
console.log(`  index: ${boot.index.showing} of ${boot.index.total} entries`);
console.log(`  by file: ${boot.index.by_file.map((f) => `${f.path} (${f.entries})`).join(", ")}`);

console.log("\n=== lifecycle smoke");
const search = await service.searchNodes({ userId: user.id, projectId: project.id, query: "hono", k: 1, channel: "app" });
const nodeId = search[0].id;
const pendingUpdate = await service.requestUpdate({
  userId: user.id,
  nodeId,
  content: "Hono wybrane zamiast Fastify; dodatkowo: middleware auth tez w Hono",
  requestedBy: "coder",
});
if (pendingUpdate.applied) throw new Error("expected pending, allPermission=false");
await service.approvePending({ userId: user.id, pendingActionId: pendingUpdate.pendingActionId });
const after = await service.searchNodes({ userId: user.id, projectId: project.id, query: "middleware auth", k: 1, channel: "app" });
if (after[0].id !== nodeId) throw new Error("updated node should match its new content best");
await service.confirmNode({ userId: user.id, nodeId });
await service.archiveNode({ userId: user.id, nodeId });
const archived = await service.searchNodes({ userId: user.id, projectId: project.id, query: "hono", k: 10, channel: "app" });
if (archived.some((r) => r.id === nodeId)) throw new Error("archived node must not appear in search");
console.log("  update->approve->recompute, confirm, archive: OK");

// The replaces path, which the REST script cannot reach: nodes are only ever
// written through MCP. It runs one transaction that inserts the new node and
// points the old one at it, and nothing else proves that order holds.
const [replaced] = await service.searchNodes({ userId: user.id, projectId: project.id, query: "drizzle studio", k: 1, channel: "app" });
const successor = await service.createNode({
  userId: user.id,
  projectId: project.id,
  type: "note",
  content: "Drizzle Studio odpalamy przez npx, nie instalujemy go globalnie",
  source,
  replacesNodeId: replaced.id,
});
if (successor.contradictedNodeId !== replaced.id) throw new Error("replaces should report what it contradicted");
const [old] = await db.select().from(nodes).where(eq(nodes.id, replaced.id));
if (old.status !== "contradicted") throw new Error("the replaced node should end up contradicted");
if (old.supersededBy !== successor.nodeId) throw new Error("the replaced node should point at its successor");
console.log("  replaces -> contradicted with a link to the successor: OK");

// How an address fails to resolve, which is two different answers now that a
// token reaches every archive its owner belongs to. Neither path is reachable
// from the REST script: only MCP resolves a repository address.
console.log("\n=== repo_ref resolution");
const coderToken = await service.createApiToken({ userId: user.id, label: "verify" });

const bootFails = (repoRef: string) =>
  service.getBootContext({ userId: user.id, tokenId: coderToken.id, repoRef }).then(
    () => null,
    (error: unknown) => error,
  );

const nowhere = await bootFails("github.com/r1zuuu/Nieznane");
if (!(nowhere instanceof service.ServiceError) || nowhere.code !== "unknown_repo")
  throw new Error(`an address filed nowhere should be unknown_repo, got ${nowhere}`);

// The miss is answered to the coder and nowhere else, so the app reads it off
// the token or nobody ever learns their sessions are coming back empty.
const [tokenRow] = await db
  .select({ repo: apiTokens.lastUnknownRepo })
  .from(apiTokens)
  .where(eq(apiTokens.id, coderToken.id));
if (tokenRow.repo !== "github.com/r1zuuu/Nieznane")
  throw new Error("the miss should be recorded on the token, for the app to show");
console.log("  unknown address, recorded on the token: OK");

// One address in two archives is the case a coder must not guess at: picking
// either files half a project where the other half cannot see it.
const [team] = await db
  .insert(workspaces)
  .values({ name: "verify-team", ownerId: user.id })
  .returning({ id: workspaces.id });
await db.insert(memberships).values({ workspaceId: team.id, userId: user.id, role: "owner" });
const [twin] = await db
  .insert(projects)
  .values({ workspaceId: team.id, name: "Ariadne (kopia)", repoRef: "github.com/r1zuuu/Ariadne" })
  .returning({ id: projects.id });

const ambiguous = await bootFails("git@github.com:r1zuuu/Ariadne.git");
if (!(ambiguous instanceof service.ServiceError) || ambiguous.code !== "ambiguous_repo")
  throw new Error(`one address in two archives should refuse, got ${ambiguous}`);
if (!ambiguous.message.includes("verify-team"))
  throw new Error("the refusal should name the archives holding it");

await service.deleteProject({ userId: user.id, projectId: twin.id });
const resolved = await service.getBootContext({
  userId: user.id,
  tokenId: coderToken.id,
  repoRef: "git@github.com:r1zuuu/Ariadne.git",
});
if (resolved.project.name !== "Ariadne")
  throw new Error("with one copy left the address should resolve again");
console.log("  two archives refuse, one resolves: OK");

// Moving is the other way out of that pair, and the entries have to follow or
// the archive splits in half.
await service.moveProject({ userId: user.id, projectId: project.id, workspaceId: team.id });
const [movedNode] = await db
  .select({ workspaceId: nodes.workspaceId })
  .from(nodes)
  .where(eq(nodes.projectId, project.id))
  .limit(1);
if (movedNode.workspaceId !== team.id)
  throw new Error("the entries should travel with the project");
const afterMove = await service.getBootContext({
  userId: user.id,
  tokenId: coderToken.id,
  repoRef: "https://github.com/r1zuuu/Ariadne.git",
});
if (afterMove.project.name !== "Ariadne")
  throw new Error("the same token should still resolve it from its new archive");
console.log("  move -> entries followed, the same token still finds it: OK");

console.log("\nDONE - oceń kolejność wyników powyżej");
process.exit(0);
