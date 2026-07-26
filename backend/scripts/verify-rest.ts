// Step-5a "done when" check (plan section 13). Drives the REST app through
// Hono's app.request(), so it needs no listening port and no curl.
// Run from backend/: npx tsx scripts/verify-rest.ts
// Idempotent: drops both check users (cascade wipes their data) before starting.
import assert from "node:assert/strict";

process.loadEnvFile("../.env");

const { db } = await import("../src/db/client.js");
const { nodes, pendingActions, projects, users } = await import("../src/db/schema.js");
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
const embedding = Array.from({ length: 768 }, () => 0.01);
const [proposed] = await db
  .insert(nodes)
  .values({
    userId,
    projectId,
    type: "decision",
    content: "Kolejnosc kart ustalamy recznie",
    embedding,
  })
  .returning({ id: nodes.id });
await db.insert(pendingActions).values({
  userId,
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
check("my project is still mine", (await call("/projects", { token })).body[0].name, "Check");

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
