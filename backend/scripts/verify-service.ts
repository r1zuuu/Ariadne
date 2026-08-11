// Step-2 "done when" check (plan section 13): write 10 nodes, run 3 different
// queries, eyeball the ranking. Run from backend/: npx tsx scripts/verify-service.ts
// Idempotent: recreates the verify user (cascade wipes old data) on each run.
process.loadEnvFile("../.env");
// Admin script: runs as the owner role, which the policies of migration 0008 do
// not apply to. It calls the service layer directly, with no request to scope by.
process.env.DATABASE_URL_APP = process.env.DATABASE_URL;

const { db } = await import("../src/db/client.js");
const { memberships, nodes, users, projects, workspaces } = await import("../src/db/schema.js");
const { eq } = await import("drizzle-orm");
const service = await import("../src/service.js");

const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, "verify@ariadne.local"));
if (existing) await db.delete(users).where(eq(users.id, existing.id));

const [user] = await db
  .insert(users)
  .values({
    email: "verify@ariadne.local",
    passwordHash: "not-a-real-hash",
    profile: "Stas, junior dev, uczy sie budujac; preferuje proste rozwiazania",
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
  await service.createNode({ userId: user.id, projectId: project.id, type: n.type, content: n.content, anchors: n.anchors, source });
}

const queries = [
  "jaki framework http wybralismy i dlaczego",
  "jak dziala liczenie embeddingow",
  "gdzie skonczylismy ostatnia sesje",
];

for (const query of queries) {
  console.log(`\n=== "${query}"`);
  const results = await service.searchNodes({ userId: user.id, projectId: project.id, query, k: 3 });
  for (const r of results) {
    console.log(`  ${r.similarity.toFixed(3)} [${r.type}] ${r.content.slice(0, 90)}...`);
  }
}

console.log("\n=== boot context");
const boot = await service.getBootContext({
  userId: user.id,
  workspaceId: workspace.id,
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
const search = await service.searchNodes({ userId: user.id, projectId: project.id, query: "hono", k: 1 });
const nodeId = search[0].id;
const pendingUpdate = await service.requestUpdate({
  userId: user.id,
  nodeId,
  content: "Hono wybrane zamiast Fastify; dodatkowo: middleware auth tez w Hono",
  requestedBy: "coder",
});
if (pendingUpdate.applied) throw new Error("expected pending, allPermission=false");
await service.approvePending({ userId: user.id, pendingActionId: pendingUpdate.pendingActionId });
const after = await service.searchNodes({ userId: user.id, projectId: project.id, query: "middleware auth", k: 1 });
if (after[0].id !== nodeId) throw new Error("updated node should match its new content best");
await service.confirmNode({ userId: user.id, nodeId });
await service.archiveNode({ userId: user.id, nodeId });
const archived = await service.searchNodes({ userId: user.id, projectId: project.id, query: "hono", k: 10 });
if (archived.some((r) => r.id === nodeId)) throw new Error("archived node must not appear in search");
console.log("  update->approve->recompute, confirm, archive: OK");

// The replaces path, which the REST script cannot reach: nodes are only ever
// written through MCP. It runs one transaction that inserts the new node and
// points the old one at it, and nothing else proves that order holds.
const [replaced] = await service.searchNodes({ userId: user.id, projectId: project.id, query: "drizzle studio", k: 1 });
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

console.log("\nDONE - oceń kolejność wyników powyżej");
process.exit(0);
