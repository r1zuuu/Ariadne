// Step-5a and 5a.1 "done when" check (plan section 13). Drives the REST app
// through Hono's app.request(), so it needs no listening port and no curl.
// Run from backend/: npx tsx scripts/verify-rest.ts
// Idempotent: drops both check users (cascade wipes their data) before starting.
// Needs Gemini: /search and a content edit compute a real embedding, which is the
// point of those two - a stale vector is invisible until a search goes wrong.
import assert from "node:assert/strict";

process.loadEnvFile("../.env");

const { db } = await import("../src/db/client.js");
const { codeAnchors, nodes, pendingActions, projects, users, workspaces } = await import(
  "../src/db/schema.js"
);
const { eq, inArray } = await import("drizzle-orm");
const { createRestApp } = await import("../src/rest.js");

const MINE = "rest-mine@ariadne.local";
const THEIRS = "rest-theirs@ariadne.local";
const PASSWORD = "verify-password-123";

await db.delete(users).where(inArray(users.email, [MINE, THEIRS]));

const app = createRestApp();

let passed = 0;
function check(label: string, actual: unknown, expected: unknown) {
  assert.deepStrictEqual(actual, expected, `${label}: got ${JSON.stringify(actual)}`);
  console.log(`ok  ${label}`);
  passed++;
}

type Options = { method?: string; token?: string; body?: unknown };
async function call(path: string, { method = "GET", token, body }: Options = {}) {
  const res = await app.request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  // Falls back to the raw text: a response that is not JSON is a finding, and
  // swallowing it in a parse error would hide which request produced it.
  try {
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, body: text };
  }
}

// --- Auth ---

const registered = await call("/auth/register", {
  method: "POST",
  body: { email: MINE, password: PASSWORD },
});
check("register returns 201", registered.status, 201);
const token: string = registered.body.token;
assert.ok(token?.length > 20, "register returns a jwt");

check(
  "same email twice is rejected",
  (await call("/auth/register", { method: "POST", body: { email: MINE, password: PASSWORD } }))
    .status,
  400,
);
check(
  "short password is rejected",
  (await call("/auth/register", { method: "POST", body: { email: "x@y.pl", password: "short" } }))
    .status,
  400,
);
check(
  "malformed email is rejected",
  (await call("/auth/register", { method: "POST", body: { email: "nope", password: PASSWORD } }))
    .status,
  400,
);
check(
  "wrong password is 401",
  (await call("/auth/login", { method: "POST", body: { email: MINE, password: "wrong" } })).status,
  401,
);
check(
  "unknown email is 401 too, same as a wrong password",
  (await call("/auth/login", { method: "POST", body: { email: "ghost@x.pl", password: PASSWORD } }))
    .status,
  401,
);
const loggedIn = await call("/auth/login", {
  method: "POST",
  body: { email: MINE, password: PASSWORD },
});
check("login returns 200", loggedIn.status, 200);

// --- Every protected route rejects a request with no token ---

// Read off the router itself rather than a hand-kept list: a route added later
// without its prefix in PROTECTED_PREFIXES fails here instead of shipping open.
const ANY_UUID = "00000000-0000-4000-8000-000000000000";
const guarded = app.routes.filter((r) => r.method !== "ALL" && !r.path.startsWith("/auth"));
assert.ok(guarded.length >= 13, `expected the full route table, saw ${guarded.length}`);
for (const route of guarded) {
  const path = route.path.replace(/:\w+/g, ANY_UUID);
  const { status } = await call(path, {
    method: route.method,
    body: route.method === "GET" ? undefined : {},
  });
  check(`${route.method} ${route.path} without a token is 401`, status, 401);
}

// --- Every error a client can hit is JSON, including the ones Hono answers itself ---

const missing = await call("/nope", { token });
check("an unknown route is 404", missing.status, 404);
check("and says so as JSON, not text", missing.body.error, "not_found");
const unauthorized = await call("/me");
check("a missing token is JSON too", unauthorized.body.error, "unauthorized");
const huge = await call("/me/profile", {
  method: "PUT",
  token,
  body: { profile: "x".repeat(70_000) },
});
check("an oversized body is 413", huge.status, 413);
check("and JSON as well", huge.body.error, "too_large");

// --- Account ---

check("profile is empty on a fresh account", (await call("/me", { token })).body.profile, "");
check(
  "profile can be set",
  (await call("/me/profile", { method: "PUT", token, body: { profile: "Stas, junior dev" } })).body,
  { profile: "Stas, junior dev" },
);
check(
  "all-permission can be flipped",
  (await call("/me/all-permission", { method: "PUT", token, body: { allPermission: true } })).body,
  { allPermission: true },
);
check(
  "all-permission rejects a non-boolean",
  (await call("/me/all-permission", { method: "PUT", token, body: { allPermission: "yes" } }))
    .status,
  400,
);

// --- MCP tokens ---

const minted = await call("/tokens", { method: "POST", token, body: { label: "laptop" } });
check("minting a token returns 201", minted.status, 201);
assert.ok(minted.body.token?.length > 20, "the raw token comes back once");

// Minted and revoked right here, so the later token checks still see one row.
const unlabelled = await call("/tokens", { method: "POST", token });
check("a token can be minted with no body at all", unlabelled.status, 201);
check("its label falls back to empty", unlabelled.body.label, "");
await call(`/tokens/${unlabelled.body.id}`, { method: "DELETE", token });

const listed = await call("/tokens", { token });
check("the list holds one token", listed.body.length, 1);
check("the list never carries the hash", "tokenHash" in listed.body[0], false);
check("the list never carries the raw token", "token" in listed.body[0], false);

// --- Projects ---

const created = await call("/projects", {
  method: "POST",
  token,
  body: { name: "Check", repoRef: "git@github.com:r1zuuu/Check.git", stack: "TS" },
});
check("creating a project returns 201", created.status, 201);
check("the ssh remote is normalized", created.body.repoRef, "github.com/r1zuuu/Check");
check(
  "the same repo in https form is a duplicate",
  (await call("/projects", {
    method: "POST",
    token,
    body: { name: "Other", repoRef: "https://github.com/r1zuuu/Check" },
  })).status,
  400,
);
check(
  "an unknown etap is rejected",
  (await call("/projects", {
    method: "POST",
    token,
    body: { name: "X", repoRef: "github.com/x/y", etap: "zombie" },
  })).status,
  400,
);
const projectId: string = created.body.id;
check(
  "a project can be edited",
  (await call(`/projects/${projectId}`, { method: "PUT", token, body: { etap: "produkcja" } })).body
    .etap,
  "produkcja",
);

// --- Review feed ---

// Nodes are inserted straight into the table: this checks the feed query and the
// lifecycle routes, and going through add_context would call Gemini for nothing.
const [{ id: userId }] = await db.select({ id: users.id }).from(users).where(eq(users.email, MINE));
// The private workspace registration made. Nodes belong to it, not to the user.
const [{ id: workspaceId }] = await db
  .select({ id: workspaces.id })
  .from(workspaces)
  .where(eq(workspaces.ownerId, userId));
const embedding = Array.from({ length: 768 }, () => 0.01);
const [proposed] = await db
  .insert(nodes)
  .values({
    workspaceId,
    authorId: userId,
    projectId,
    type: "decision",
    content: "Kolejnosc kart ustalamy recznie",
    embedding,
  })
  .returning({ id: nodes.id });
await db.insert(pendingActions).values({
  workspaceId,
  requestedByUserId: userId,
  nodeId: proposed.id,
  action: "update",
  payload: { content: "Kolejnosc kart ustalamy data" },
  requestedBy: "coder",
});

const feed = (await call("/pending", { token })).body;
check("the queued action shows up", feed.pendingActions.length, 1);
check("with the project name joined on", feed.pendingActions[0].projectName, "Check");
check(
  "and the stored content, to diff against",
  feed.pendingActions[0].nodeContent,
  "Kolejnosc kart ustalamy recznie",
);
check("the unsettled node shows up", feed.nodesToReview.length, 1);

check(
  "confirming a node returns 204",
  (await call(`/nodes/${proposed.id}/confirm`, { method: "POST", token })).status,
  204,
);
check(
  "a confirmed node leaves the feed",
  (await call("/pending", { token })).body.nodesToReview.length,
  0,
);
check(
  "confirming twice is rejected",
  (await call(`/nodes/${proposed.id}/confirm`, { method: "POST", token })).status,
  400,
);
check(
  "approving the queued update returns 204",
  (await call(`/pending/${feed.pendingActions[0].id}/approve`, { method: "POST", token })).status,
  204,
);
check(
  "an approved action leaves the feed",
  (await call("/pending", { token })).body.pendingActions.length,
  0,
);

// --- Listing, search, edit and contradict (plan step 5a.1) ---

// Its own project, so the counts below depend on this seed alone and not on what
// an earlier section happened to leave in the first one.
const listProjectId: string = (
  await call("/projects", {
    method: "POST",
    token,
    body: { name: "Lista", repoRef: "github.com/r1zuuu/Lista" },
  })
).body.id;

// Explicit timestamps, so "newest first" and the cursor have a known order to
// prove. Left to defaultNow() every row of one insert shares a timestamp.
const day = (n: number) => new Date(Date.UTC(2026, 0, n));
const seeded = await db
  .insert(nodes)
  .values([
    {
      workspaceId,
      authorId: userId,
      projectId: listProjectId,
      type: "decision",
      content: "Drizzle zamiast Prismy",
      embedding,
      createdAt: day(1),
    },
    {
      workspaceId,
      authorId: userId,
      projectId: listProjectId,
      type: "note",
      content: "Hono trzyma REST i MCP na jednym porcie",
      status: "confirmed",
      embedding,
      createdAt: day(2),
    },
    {
      workspaceId,
      authorId: userId,
      projectId: listProjectId,
      type: "note",
      content: "Stary wybor: Express",
      status: "archived",
      embedding,
      createdAt: day(3),
    },
    {
      workspaceId,
      authorId: userId,
      projectId: listProjectId,
      type: "session_summary",
      content: "Sesja: skonczylismy na kursorze",
      embedding,
      createdAt: day(4),
    },
    {
      workspaceId,
      authorId: userId,
      projectId: listProjectId,
      type: "decision",
      content: "Migracje generuje drizzle-kit",
      embedding,
      createdAt: day(5),
    },
    {
      workspaceId,
      authorId: userId,
      projectId: listProjectId,
      type: "note",
      content: "Tokeny MCP trzymamy jako sha256",
      embedding,
      createdAt: day(6),
    },
  ])
  .returning({ id: nodes.id, content: nodes.content });
const [decision, , archived, summary, superseder] = seeded;
await db.insert(codeAnchors).values({ nodeId: decision.id, path: "src/db/schema.ts" });

const listedNodes = await call(`/projects/${listProjectId}/nodes`, { token });
check("listing skips archived by default", listedNodes.body.nodes.length, 5);
check("newest first", listedNodes.body.nodes[0].content, "Tokeny MCP trzymamy jako sha256");
check("one page holds everything, so no cursor", listedNodes.body.nextCursor, null);
check(
  "archived is reachable when asked for by name",
  (await call(`/projects/${listProjectId}/nodes?status=archived`, { token })).body.nodes[0].id,
  archived.id,
);
check(
  "filtering by type",
  (await call(`/projects/${listProjectId}/nodes?type=decision`, { token })).body.nodes.length,
  2,
);
const byFile = await call(`/projects/${listProjectId}/nodes?file=src/db/schema.ts`, { token });
check("filtering by anchored file", byFile.body.nodes.length, 1);
check("and the anchor travels with the node", byFile.body.nodes[0].anchors[0].path, "src/db/schema.ts");
check(
  "an unknown status is rejected",
  (await call(`/projects/${listProjectId}/nodes?status=zombie`, { token })).status,
  400,
);
check(
  "a cursor from nowhere is rejected",
  (await call(`/projects/${listProjectId}/nodes?cursor=not-a-cursor`, { token })).status,
  400,
);
check(
  "a limit outside the range is rejected",
  (await call(`/projects/${listProjectId}/nodes?limit=500`, { token })).status,
  400,
);

const first = await call(`/projects/${listProjectId}/nodes?limit=2`, { token });
check("a page stops at the limit", first.body.nodes.length, 2);
assert.ok(first.body.nextCursor, "a full page hands out a cursor");
const second = await call(
  `/projects/${listProjectId}/nodes?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`,
  { token },
);
check("the next page picks up where it stopped", second.body.nodes.length, 2);
check(
  "and repeats nothing",
  second.body.nodes.some((n: { id: string }) =>
    first.body.nodes.some((f: { id: string }) => f.id === n.id),
  ),
  false,
);
const third = await call(
  `/projects/${listProjectId}/nodes?limit=2&cursor=${encodeURIComponent(second.body.nextCursor)}`,
  { token },
);
check("the last page holds the remainder", third.body.nodes.length, 1);
check("and hands out no cursor", third.body.nextCursor, null);

const searched = await call("/search", {
  method: "POST",
  token,
  body: { projectId: listProjectId, query: "czym zastapilismy Prisme", k: 3 },
});
check("search returns 200", searched.status, 200);
check("no more hits than asked for", searched.body.length, 3);
check("every hit carries its similarity", typeof searched.body[0].similarity, "number");
check(
  "and no archived node is among them",
  searched.body.some((n: { status: string }) => n.status === "archived"),
  false,
);
check(
  "an empty query is rejected",
  (await call("/search", { method: "POST", token, body: { projectId: listProjectId, query: "  " } }))
    .status,
  400,
);

const [{ embedding: beforeEdit }] = await db
  .select({ embedding: nodes.embedding })
  .from(nodes)
  .where(eq(nodes.id, decision.id));
const edited = await call(`/nodes/${decision.id}`, {
  method: "PUT",
  token,
  body: {
    content: "Drizzle zamiast Prismy, bo migracje sa czytelne",
    anchors: [{ path: "backend/src/db/schema.ts" }],
  },
});
check(
  "an edit returns the stored node",
  edited.body.content,
  "Drizzle zamiast Prismy, bo migracje sa czytelne",
);
check("stamped with the channel that edited it", edited.body.source.edited_via, "app_form");
check("anchors are replaced, not added to", edited.body.anchors.length, 1);
check("with the new path", edited.body.anchors[0].path, "backend/src/db/schema.ts");
const [{ embedding: afterEdit }] = await db
  .select({ embedding: nodes.embedding })
  .from(nodes)
  .where(eq(nodes.id, decision.id));
check("a content edit recomputes the embedding", afterEdit![0] === beforeEdit![0], false);
check(
  "an edit with nothing in it is rejected",
  (await call(`/nodes/${decision.id}`, { method: "PUT", token, body: {} })).status,
  400,
);

check(
  "contradicting returns 204",
  (await call(`/nodes/${decision.id}/contradict`, {
    method: "POST",
    token,
    body: { supersededBy: superseder.id },
  })).status,
  204,
);
const contradicted = await call(`/projects/${listProjectId}/nodes?status=contradicted`, { token });
check("the node now says what overruled it", contradicted.body.nodes[0].supersededBy, superseder.id);
check(
  "contradicting the same node twice is rejected",
  (await call(`/nodes/${decision.id}/contradict`, {
    method: "POST",
    token,
    body: { supersededBy: superseder.id },
  })).status,
  400,
);
check(
  "a node cannot supersede itself",
  (await call(`/nodes/${summary.id}/contradict`, {
    method: "POST",
    token,
    body: { supersededBy: summary.id },
  })).status,
  400,
);

// A reference across projects would render as a dead link on the record screen.
const otherProject = await call("/projects", {
  method: "POST",
  token,
  body: { name: "Other", repoRef: "github.com/r1zuuu/Other" },
});
const [elsewhere] = await db
  .insert(nodes)
  .values({
    workspaceId,
    authorId: userId,
    projectId: otherProject.body.id,
    type: "note",
    content: "Wpis z innego projektu",
    embedding,
  })
  .returning({ id: nodes.id });
check(
  "the superseding node must sit in the same project",
  (await call(`/nodes/${summary.id}/contradict`, {
    method: "POST",
    token,
    body: { supersededBy: elsewhere.id },
  })).status,
  400,
);

// --- Nothing of one user is reachable with another user's token ---

const theirToken: string = (
  await call("/auth/register", { method: "POST", body: { email: THEIRS, password: PASSWORD } })
).body.token;
check(
  "another user sees no projects of mine",
  (await call("/projects", { token: theirToken })).body.length,
  0,
);
check(
  "another user cannot edit my project",
  (await call(`/projects/${projectId}`, {
    method: "PUT",
    token: theirToken,
    body: { name: "Hijacked" },
  })).status,
  404,
);
check(
  "another user cannot revoke my token",
  (await call(`/tokens/${listed.body[0].id}`, { method: "DELETE", token: theirToken })).status,
  404,
);
check(
  "another user cannot archive my node",
  (await call(`/nodes/${proposed.id}/archive`, { method: "POST", token: theirToken })).status,
  404,
);
check(
  "another user cannot list my project's nodes",
  (await call(`/projects/${projectId}/nodes`, { token: theirToken })).status,
  404,
);
check(
  "another user cannot search my project",
  (await call("/search", {
    method: "POST",
    token: theirToken,
    body: { projectId, query: "cokolwiek" },
  })).status,
  404,
);
check(
  "another user cannot edit my node",
  (await call(`/nodes/${summary.id}`, {
    method: "PUT",
    token: theirToken,
    body: { content: "Przejete" },
  })).status,
  404,
);
check(
  "another user cannot contradict my node",
  (await call(`/nodes/${summary.id}/contradict`, {
    method: "POST",
    token: theirToken,
    body: { supersededBy: superseder.id },
  })).status,
  404,
);
// Sorted rather than indexed: the list comes back newest-touched first, which is
// an ordering this check has no business depending on.
check(
  "and everything of mine is still mine",
  (await call("/projects", { token })).body.map((p: { name: string }) => p.name).sort(),
  ["Check", "Lista", "Other"],
);

// --- Workspaces, invitations and one archive read by two people ---

const [{ id: theirUserId }] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, THEIRS));

const myWorkspaces = await call("/workspaces", { token });
check("registration leaves exactly one workspace", myWorkspaces.body.length, 1);
check("owned by the person who registered", myWorkspaces.body[0].isOwner, true);
check("with one member in it", myWorkspaces.body[0].memberCount, 1);

const team = await call("/workspaces", { method: "POST", token, body: { name: "Zespol" } });
check("creating a workspace returns 201", team.status, 201);
const teamId: string = team.body.id;
check(
  "a nameless workspace is rejected",
  (await call("/workspaces", { method: "POST", token, body: { name: "  " } })).status,
  400,
);
check(
  "someone outside cannot read the member list",
  (await call(`/workspaces/${teamId}/members`, { token: theirToken })).status,
  404,
);
check(
  "nor invite anyone into it",
  (await call(`/workspaces/${teamId}/invites`, { method: "POST", token: theirToken, body: {} }))
    .status,
  404,
);

const invite = await call(`/workspaces/${teamId}/invites`, { method: "POST", token, body: {} });
check("an invitation comes back with a code", typeof invite.body.code, "string");
check(
  "and sits on the open list",
  (await call(`/workspaces/${teamId}/invites`, { token })).body.length,
  1,
);
check(
  "a made-up code opens nothing",
  (await call("/invites/not-a-real-code/accept", { method: "POST", token: theirToken })).status,
  404,
);

const joined = await call(`/invites/${invite.body.code}/accept`, {
  method: "POST",
  token: theirToken,
});
check("accepting hands back the workspace", joined.body.name, "Zespol");
check(
  "a code works once and only once",
  (await call(`/invites/${invite.body.code}/accept`, { method: "POST", token: theirToken })).status,
  404,
);
check(
  "the workspace now holds two people",
  (await call(`/workspaces/${teamId}/members`, { token })).body.length,
  2,
);
check(
  "and the used code is off the open list",
  (await call(`/workspaces/${teamId}/invites`, { token })).body.length,
  0,
);

const bound = await call(`/workspaces/${teamId}/invites`, {
  method: "POST",
  token,
  body: { email: "somebody-else@ariadne.local" },
});
check("an invitation can be written for one address", bound.body.email, "somebody-else@ariadne.local");
check(
  "and refuses anyone else",
  (await call(`/invites/${bound.body.code}/accept`, { method: "POST", token: theirToken })).status,
  401,
);
check(
  "without burning the code on the refusal",
  (await call(`/workspaces/${teamId}/invites`, { token })).body.length,
  1,
);

const teamProject = await call("/projects", {
  method: "POST",
  token,
  body: { name: "Wspolny", repoRef: "github.com/r1zuuu/Wspolny", workspaceId: teamId },
});
check("a project can be filed under the shared workspace", teamProject.status, 201);
const teamProjectId: string = teamProject.body.id;
check("and says which archive it belongs to", teamProject.body.workspaceId, teamId);
check(
  "the other member finds it in their own list",
  (await call("/projects", { token: theirToken })).body.some(
    (p: { id: string }) => p.id === teamProjectId,
  ),
  true,
);

const [shared] = await db
  .insert(nodes)
  .values({
    workspaceId: teamId,
    authorId: userId,
    projectId: teamProjectId,
    type: "decision",
    content: "Zespolowa decyzja: trzymamy sie Drizzle",
    embedding,
  })
  .returning({ id: nodes.id });

const theirView = await call(`/projects/${teamProjectId}/nodes`, { token: theirToken });
check("they read an entry they did not write", theirView.body.nodes.length, 1);
check("and it says who wrote it", theirView.body.nodes[0].author, MINE);
check(
  "any member can confirm",
  (await call(`/nodes/${shared.id}/confirm`, { method: "POST", token: theirToken })).status,
  204,
);
check(
  "and the entry keeps whose judgement it was",
  (await call(`/projects/${teamProjectId}/nodes`, { token })).body.nodes[0].confirmedBy,
  THEIRS,
);

check(
  "the owner cannot walk out of their own workspace",
  (await call(`/workspaces/${teamId}/members/${userId}`, { method: "DELETE", token })).status,
  400,
);
check(
  "a member cannot remove anyone but themselves",
  (await call(`/workspaces/${teamId}/members/${userId}`, {
    method: "DELETE",
    token: theirToken,
  })).status,
  401,
);
check(
  "but can leave",
  (await call(`/workspaces/${teamId}/members/${theirUserId}`, {
    method: "DELETE",
    token: theirToken,
  })).status,
  204,
);
check(
  "after which the shared project is gone from their list",
  (await call("/projects", { token: theirToken })).body.length,
  0,
);
check(
  "and its entries answer 404 again",
  (await call(`/projects/${teamProjectId}/nodes`, { token: theirToken })).status,
  404,
);

// --- A conversation belongs to the person, not to the workspace ---

const conversation = await call("/conversations", {
  method: "POST",
  token,
  body: { projectId, kind: "ask", messages: [{ role: "user", text: "Dlaczego Drizzle?" }] },
});
check("a conversation is created", conversation.status, 200);
check(
  "another account cannot read it",
  (await call(`/conversations/${conversation.body.id}`, { token: theirToken })).status,
  404,
);
check(
  "nor overwrite the transcript",
  (await call(`/conversations/${conversation.body.id}`, {
    method: "PUT",
    token: theirToken,
    body: { messages: [{ role: "user", text: "Przejete" }] },
  })).status,
  404,
);
check(
  "nor delete it",
  (await call(`/conversations/${conversation.body.id}`, { method: "DELETE", token: theirToken }))
    .status,
  404,
);
check(
  "and it is still there for whoever wrote it",
  (await call(`/conversations/${conversation.body.id}`, { token })).body.title,
  "Dlaczego Drizzle?",
);

// --- Changing a password ---

const NEW_PASSWORD = "verify-password-456";
check(
  "changing a password needs the current one",
  (await call("/me/password", {
    method: "PUT",
    token,
    body: { currentPassword: "wrong", newPassword: NEW_PASSWORD },
  })).status,
  401,
);
check(
  "a short new password is rejected",
  (await call("/me/password", {
    method: "PUT",
    token,
    body: { currentPassword: PASSWORD, newPassword: "short" },
  })).status,
  400,
);
check(
  "changing it returns 204",
  (await call("/me/password", {
    method: "PUT",
    token,
    body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
  })).status,
  204,
);
check(
  "the old password stops working",
  (await call("/auth/login", { method: "POST", body: { email: MINE, password: PASSWORD } })).status,
  401,
);
check(
  "and the new one works",
  (await call("/auth/login", { method: "POST", body: { email: MINE, password: NEW_PASSWORD } }))
    .status,
  200,
);

// --- Guessing at a password runs out ---

const LOCKED = "locked-out@ariadne.local";
for (let attempt = 0; attempt < 10; attempt++) {
  await call("/auth/login", { method: "POST", body: { email: LOCKED, password: "wrong" } });
}
check(
  "the eleventh wrong password in a row is refused outright",
  (await call("/auth/login", { method: "POST", body: { email: LOCKED, password: "wrong" } })).status,
  429,
);
check(
  "and another address is unaffected by it",
  (await call("/auth/login", { method: "POST", body: { email: MINE, password: NEW_PASSWORD } }))
    .status,
  200,
);

// --- Revoking a token ---

check(
  "revoking returns 204",
  (await call(`/tokens/${listed.body[0].id}`, { method: "DELETE", token })).status,
  204,
);
check("the token list is empty", (await call("/tokens", { token })).body.length, 0);
check(
  "revoking the same token again is 404",
  (await call(`/tokens/${listed.body[0].id}`, { method: "DELETE", token })).status,
  404,
);

await db.delete(users).where(inArray(users.email, [MINE, THEIRS]));
console.log(`\n${passed} checks passed`);
process.exit(0);
