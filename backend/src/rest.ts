import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { jwt, sign } from "hono/jwt";
import * as z from "zod/v4";
import { answerQuestion, proposeEdits } from "./chat.js";
import { asUser } from "./db/client.js";
import {
  type NodeStatus,
  type NodeType,
  type TaskPriority,
  type TaskStatus,
  ServiceError,
  acceptInvite,
  approvePending,
  archiveNode,
  changePassword,
  clearGeminiKey,
  confirmNode,
  contradictNode,
  appendToConversation,
  createApiToken,
  createConversation,
  createInvite,
  createProject,
  createTask,
  createWorkspace,
  declineInvite,
  deleteApiToken,
  deleteConversation,
  deleteProject,
  editNode,
  getAccount,
  getConversation,
  getGraph,
  getReviewFeed,
  getTask,
  heartbeatTaskWork,
  listApiTokens,
  listConversations,
  listInvites,
  listMembers,
  listMyInvites,
  listNodes,
  listProjects,
  listTasks,
  listWorkspaces,
  login,
  moveProject,
  registerUser,
  rejectPending,
  removeMember,
  resolveConflict,
  revokeInvite,
  searchNodes,
  setAllPermission,
  setGeminiKey,
  signInWithProvider,
  startTaskWork,
  stopTaskWork,
  updateProfile,
  updateProject,
  updateTask,
} from "./service.js";
import {
  authorizeUrl,
  collect,
  configured,
  identify,
  isHandoff,
  isProvider,
  issueState,
  park,
  readState,
} from "./oauth.js";

// The REST API of plan section 10. Same shape as mcp.ts: schema in, service
// call, result out. No business logic here.
//
// Responses are camelCase, unlike the snake_case MCP contract: the only client
// is the TypeScript app, so a conversion layer would cost code and buy nothing.

// ponytail: a 30-day token with no refresh and no revocation list, so a stolen
// one stays valid until it expires. Fine while the only client is a desktop app
// on the owner's machine; add refresh plus a jti denylist before anything else
// holds a token.
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
// Pinned on both sides. A verifier that accepts whatever the token's header
// claims is how alg-confusion attacks get in.
const JWT_ALG = "HS256";
// Nothing legitimate comes close: node content caps at 4000 chars and a project
// card is a handful of short fields. Without a cap the adapter buffers whatever
// arrives into memory.
const MAX_BODY_BYTES = 64 * 1024;
// The app is a different origin from the API even on one machine: Next dev serves
// 3001 and the packaged Tauri window serves a custom protocol. An allowlist rather
// than "*", because these responses carry a bearer token and the set of callers is
// known and small.
const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ?? "http://localhost:3001,http://tauri.localhost,tauri://localhost"
).split(",");

// Everything except /auth/* needs a token, listed one prefix at a time. A single
// catch-all would have covered login too and locked everyone out of the one thing
// they need before they have a token.
const PROTECTED_PREFIXES = [
  "/me",
  "/me/*",
  "/tokens",
  "/tokens/*",
  "/projects",
  "/projects/*",
  "/tasks/*",
  "/task-runs/*",
  "/pending",
  "/pending/*",
  "/nodes/*",
  "/search",
  "/chat/*",
  "/conversations",
  "/conversations/*",
  "/workspaces",
  "/workspaces/*",
  "/invites/*",
];

type Env = { Variables: { jwtPayload: { sub: string } } };

// Argon2 alone slows guessing to a few tries a second, which is plenty of tries
// over a night. Keyed by email rather than by address: behind a desktop app on
// one machine every request carries the same IP, so an IP counter would either
// lock out the only user or count nothing.
//
// ponytail: one Map in one process. A restart forgets the counters and a second
// instance keeps its own; both stop being acceptable the day this runs more than
// once, and that is the day it wants Redis or a column.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS = 10;
const ATTEMPTS_BEFORE_SWEEP = 1000;
const attempts = new Map<string, { count: number; until: number }>();

function assertNotRateLimited(key: string) {
  const seen = attempts.get(key);
  if (seen && seen.until > Date.now() && seen.count >= LOGIN_ATTEMPTS) {
    throw new ServiceError("rate_limited", "too many attempts, wait a few minutes");
  }
}

function countAttempt(key: string) {
  const now = Date.now();
  const seen = attempts.get(key);
  if (seen && seen.until > now) {
    seen.count += 1;
    return;
  }
  // Expired entries are only ever overwritten, so the map needs one sweep to
  // stop a stream of made-up addresses from growing it without end.
  if (attempts.size > ATTEMPTS_BEFORE_SWEEP) {
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
  }
  attempts.set(key, { count: 1, until: now + LOGIN_WINDOW_MS });
}

const credentials = z.object({
  email: z.string(),
  password: z.string(),
});

const cardSchema = z.object({
  name: z.string(),
  repoRef: z.string(),
  opis: z.string().optional(),
  stack: z.string().optional(),
  dlaKogo: z.string().optional(),
  grupaOdbiorcza: z.string().nullable().optional(),
  konwencjeRef: z.string().nullable().optional(),
  ograniczenia: z.string().optional(),
  etap: z.string().optional(),
});

// Which workspace to file it under. Absent means the private one, which is what
// onboarding sends and what a person with a single archive always means.
const newProjectSchema = cardSchema.extend({ workspaceId: z.string().optional() });

const anchorSchema = z.object({
  path: z.string(),
  symbol: z.string().optional(),
  sha: z.string().optional(),
});

// Both fields optional, and "neither was sent" is left to the service: it owns
// that rule for the MCP path too, and its message says what to do about it.
const editSchema = z.object({
  content: z.string().optional(),
  anchors: z.array(anchorSchema).optional(),
});

const searchSchema = z.object({
  projectId: z.string(),
  query: z.string(),
  k: z.number().optional(),
});

// Length and emptiness are the service's rule, shared with the other caller, so
// these only say what the field is.
const chatQuerySchema = z.object({
  projectId: z.string(),
  question: z.string(),
});

// The shape of a message is the service's rule (it owns the same check for the
// create and the update path), so this layer only says that it is an array.
const conversationQuery = z.object({
  projectId: z.string(),
  kind: z.string(),
});

const conversationSchema = z.object({
  projectId: z.string(),
  kind: z.string(),
  messages: z.array(z.unknown()),
});

const transcriptSchema = z.object({
  messages: z.array(z.unknown()),
});

const chatEditSchema = z.object({
  projectId: z.string(),
  message: z.string(),
  sessionId: z.string().optional(),
});

// A query string carries text or nothing, so limit is coerced here. status and
// type stay strings: the service owns the allowed values and names them in the
// error, which beats this layer repeating the list to say "invalid".
const listQuery = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  file: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().optional(),
  // Enumerated here rather than in the service, unlike status and type: there
  // are exactly two orderings and neither is a domain value the service owns.
  sort: z.enum(["created", "updated"]).optional(),
});

const taskQuery = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  creator: z.string().optional(),
  active: z.enum(["true", "false"]).optional(),
  completed: z.enum(["true", "false"]).optional(),
  query: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().optional(),
});

const taskCreateSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  blockedReason: z.string().nullable().optional(),
  relatedMemoryIds: z.array(z.string()).optional(),
});

const taskPatchSchema = taskCreateSchema.partial().extend({
  revision: z.number().optional(),
});

const taskRunSourceSchema = z.object({
  client: z.string().optional(),
  sessionId: z.string(),
  commitSha: z.string().optional(),
});

const taskRunStopSchema = z.object({
  outcome: z.string().nullable().optional(),
  source: taskRunSourceSchema.optional(),
});

const taskRunHeartbeatSchema = z.object({
  source: taskRunSourceSchema.optional(),
});

function restTaskRunSource(source: z.infer<typeof taskRunSourceSchema>) {
  return {
    channel: "app_form" as const,
    client: source.client,
    session_id: source.sessionId,
    commit_sha: source.commitSha,
  };
}

// Reading the body and validating it fail the same way for the caller: a 400
// with a reason, never a 500 on malformed JSON.
async function readBody<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const text = await c.req.text();
  let raw: unknown;
  try {
    // An omitted body is an empty object, not a parse error: a route whose every
    // field is optional should not demand a literal "{}" from the caller.
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ServiceError("validation", "body must be valid JSON");
  }
  return schema.parse(raw);
}

const STATUS_BY_CODE: Record<ServiceError["code"], 400 | 401 | 404 | 409 | 429> = {
  validation: 400,
  no_gemini_key: 400,
  unauthorized: 401,
  rate_limited: 429,
  unknown_repo: 404,
  // Only the MCP path can raise it, but the map is exhaustive by type, so a new
  // code cannot be added without answering what the REST side would say. 409:
  // the address is not missing, it names two projects and the caller must pick.
  ambiguous_repo: 409,
  conflict: 409,
  not_found: 404,
};

// The last thing a person sees in the browser before going back to the window
// they started in. Deliberately one sentence and no styling: it exists so the
// tab is not blank, and anything more would be a second front end to maintain.
function closingPage(message: string): string {
  const safe = message.replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch,
  );
  return `<!doctype html><meta charset="utf-8"><title>Ariadne</title><body style="font:16px/1.6 system-ui;max-width:34rem;margin:20vh auto;padding:0 1.5rem;color:#1a1a1a"><p>${safe}</p></body>`;
}

export function createRestApp() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set (add it to ../.env)");

  const app = new Hono<Env>();
  const issueToken = (userId: string) =>
    sign({ sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS }, secret, JWT_ALG);
  const userId = (c: Context<Env>) => c.get("jwtPayload").sub;

  app.onError((error, c) => {
    if (error instanceof ServiceError) {
      return c.json({ error: error.code, message: error.message }, STATUS_BY_CODE[error.code]);
    }
    if (error instanceof z.ZodError) {
      const where = error.issues.map((i) => i.path.join(".") || "body").join(", ");
      return c.json({ error: "validation", message: `invalid or missing: ${where}` }, 400);
    }
    // The jwt middleware throws this for a missing or expired token, and Hono's
    // own response body is plain text. Reshaped to the same JSON as every other
    // error, so a client needs one parser rather than a special case for 401.
    if (error instanceof HTTPException) {
      const code = error.status === 401 ? "unauthorized" : "http_error";
      return c.json({ error: code, message: error.message }, error.status);
    }
    console.error("[rest] unexpected error:", error);
    return c.json({ error: "internal", message: "internal error, check the server logs" }, 500);
  });

  // Same reason as the HTTPException branch above: a typo in a URL should not be
  // the one response a client cannot parse.
  app.notFound((c) => c.json({ error: "not_found", message: `no route for ${c.req.path}` }, 404));

  // All middleware goes here, above every route, because Hono only wraps what is
  // registered after it. Sprinkled further down, one route added in the wrong
  // place would quietly ship without a token check.
  const limit = bodyLimit({
    maxSize: MAX_BODY_BYTES,
    // Hono's default 413 body is plain text, same trap as the two above.
    onError: (c) =>
      c.json({ error: "too_large", message: `body must be under ${MAX_BODY_BYTES} bytes` }, 413),
  });
  // Scoped to the REST prefixes, not "*": /mcp is added on this same app in
  // index.ts and hands its raw request stream to the SDK transport, which would
  // read an empty body if anything here consumed it first.
  // Ahead of the token check, so a rejected preflight does not come back as a 401
  // the browser then hides behind an opaque CORS error.
  for (const prefix of ["/auth/*", ...PROTECTED_PREFIXES]) {
    app.use(
      prefix,
      cors({
        origin: ALLOWED_ORIGINS,
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      }),
    );
  }
  for (const prefix of ["/auth/*", ...PROTECTED_PREFIXES]) app.use(prefix, limit);
  for (const prefix of PROTECTED_PREFIXES) app.use(prefix, jwt({ secret, alg: JWT_ALG }));
  // Below the token check, because before it there is nobody to run as. Every
  // protected route runs inside one transaction with app.user_id set, which is
  // what the policies of migration 0008 filter by; without this wrapper they see
  // no identity and hand back nothing.
  //
  // The transaction ends when the handler returns. /chat/query returns a stream
  // that keeps producing afterwards, and that is safe only because everything it
  // reads from the database happens before the first chunk. A query added inside
  // that stream would run on a closed transaction and say so loudly.
  for (const prefix of PROTECTED_PREFIXES) {
    app.use(prefix, (c, next) => asUser(c.get("jwtPayload").sub, next));
  }

  // --- Health ---

  // What an uptime pinger hits, and deliberately the one route that never opens a
  // database connection. Managed Postgres bills by the hour its compute is awake
  // and puts itself to sleep after a few idle minutes, so a ping that read one row
  // every ten minutes would keep it awake around the clock and spend the month's
  // quota by the middle of it. Outside PROTECTED_PREFIXES on purpose: a pinger
  // carries no token, and this answers before there is anyone to be.
  app.get("/healthz", (c) => c.text("ok"));

  // --- Public: auth (plan section 10) ---

  app.post("/auth/register", async (c) => {
    const { email, password } = await readBody(c, credentials);
    const { userId } = await registerUser({ email, password });
    // Logged in straight away: onboarding starts on the next screen, not on a
    // second form asking for the password just typed.
    return c.json({ token: await issueToken(userId) }, 201);
  });

  // --- Public: sign-in through Google and GitHub ---
  //
  // Three routes, and only the first is called by the app's own code. The other
  // two are visited by a browser window, so neither may answer with JSON: a
  // person looking at a raw error object has nothing to click. Every failure
  // goes back to where it came from with a reason in the fragment.

  // Which buttons to draw. A server deployed without GitHub credentials should
  // not show a GitHub button that can only fail.
  app.get("/auth/providers", (c) => c.json({ providers: configured() }));

  app.get("/auth/:provider/start", async (c) => {
    const provider = c.req.param("provider");
    if (!isProvider(provider)) throw new ServiceError("not_found", "unknown sign-in provider");
    // The app made this up before opening the browser and is already polling for
    // it. It is not a secret the server keeps, it is the name of the shelf the
    // answer goes on.
    const handoff = c.req.query("handoff");
    if (!isHandoff(handoff)) throw new ServiceError("validation", "handoff is missing or malformed");
    return c.redirect(authorizeUrl(provider, await issueState(provider, handoff)));
  });

  app.get("/auth/:provider/callback", async (c) => {
    const provider = c.req.param("provider");
    if (!isProvider(provider)) throw new ServiceError("not_found", "unknown sign-in provider");

    // Reading the state comes first, because it names the shelf. Failing it is
    // the one case with nowhere to leave an answer, so it is also the one case
    // that reports in the browser instead of to the app.
    let handoff: string;
    try {
      handoff = await readState(c.req.query("state"), provider);
    } catch {
      return c.html(closingPage("This sign-in link is no longer valid."), 400);
    }

    try {
      // The person pressed cancel on the provider's consent screen. Not an error
      // worth a stack trace, but the app has to stop waiting.
      const denied = c.req.query("error");
      const code = c.req.query("code");
      if (denied || !code) {
        park(handoff, { error: denied === "access_denied" ? "cancelled" : (denied ?? "no_code") });
        return c.html(closingPage("Sign-in was cancelled."));
      }

      const identity = await identify(provider, code);
      const { userId } = await signInWithProvider({ provider, ...identity });
      park(handoff, { token: await issueToken(userId) });
      return c.html(closingPage("You are signed in. You can close this tab and go back to Ariadne."));
    } catch (caught) {
      // The app shows this string, so a ServiceError's message is the copy the
      // person reads. Anything else is a bug and says nothing useful.
      const reason = caught instanceof ServiceError ? caught.message : "sign_in_failed";
      park(handoff, { error: reason });
      return c.html(closingPage(reason));
    }
  });

  // What the app polls. 204 means "nothing on that shelf yet", which is also the
  // honest answer for an id that never existed: the two are the same to a caller
  // who is entitled to neither.
  app.get("/auth/handoff/:id", (c) => {
    const id = c.req.param("id");
    if (!isHandoff(id)) throw new ServiceError("validation", "handoff is malformed");
    const result = collect(id);
    return result ? c.json(result) : c.body(null, 204);
  });

  app.post("/auth/login", async (c) => {
    const { email, password } = await readBody(c, credentials);
    const key = (email ?? "").trim().toLowerCase();
    assertNotRateLimited(key);
    try {
      const { userId } = await login({ email, password });
      attempts.delete(key); // a correct password clears the run of wrong ones
      return c.json({ token: await issueToken(userId) });
    } catch (error) {
      if (error instanceof ServiceError && error.code === "unauthorized") countAttempt(key);
      throw error;
    }
  });

  // --- Account ---

  app.get("/me", async (c) => c.json(await getAccount(userId(c))));

  app.put("/me/profile", async (c) => {
    const { profile } = await readBody(c, z.object({ profile: z.string() }));
    return c.json(await updateProfile({ userId: userId(c), profile }));
  });

  app.put("/me/password", async (c) => {
    const { currentPassword, newPassword } = await readBody(
      c,
      z.object({ currentPassword: z.string(), newPassword: z.string() }),
    );
    await changePassword({ userId: userId(c), currentPassword, newPassword });
    return c.body(null, 204);
  });

  app.put("/me/all-permission", async (c) => {
    const { allPermission } = await readBody(c, z.object({ allPermission: z.boolean() }));
    return c.json(await setAllPermission({ userId: userId(c), allPermission }));
  });

  // The key goes in and never comes back out: both routes answer with whether
  // this account now has one, which is all a screen can honestly show.
  app.put("/me/gemini-key", async (c) => {
    const { key } = await readBody(c, z.object({ key: z.string() }));
    return c.json(await setGeminiKey({ userId: userId(c), key }));
  });

  app.delete("/me/gemini-key", async (c) => c.json(await clearGeminiKey(userId(c))));

  // --- MCP tokens ---

  app.post("/tokens", async (c) => {
    // Label only. A token names a machine and reaches every archive its owner
    // belongs to, so there is no archive to pick when minting one.
    const { label } = await readBody(c, z.object({ label: z.string().optional() }));
    // The only response that ever carries the raw token.
    return c.json(await createApiToken({ userId: userId(c), label }), 201);
  });

  app.get("/tokens", async (c) => c.json(await listApiTokens(userId(c))));

  app.delete("/tokens/:id", async (c) => {
    await deleteApiToken({ userId: userId(c), tokenId: c.req.param("id") });
    return c.body(null, 204);
  });

  // --- Workspaces and invitations ---

  app.get("/workspaces", async (c) => c.json(await listWorkspaces(userId(c))));

  app.post("/workspaces", async (c) => {
    const { name } = await readBody(c, z.object({ name: z.string() }));
    return c.json(await createWorkspace({ userId: userId(c), name }), 201);
  });

  app.get("/workspaces/:id/members", async (c) =>
    c.json(await listMembers({ userId: userId(c), workspaceId: c.req.param("id") })),
  );

  // One route for being removed and for walking out: the service decides which
  // of the two this is from who is asking.
  app.delete("/workspaces/:id/members/:memberId", async (c) => {
    await removeMember({
      userId: userId(c),
      workspaceId: c.req.param("id"),
      memberId: c.req.param("memberId"),
    });
    return c.body(null, 204);
  });

  app.get("/workspaces/:id/invites", async (c) =>
    c.json(await listInvites({ userId: userId(c), workspaceId: c.req.param("id") })),
  );

  app.post("/workspaces/:id/invites", async (c) => {
    const { email } = await readBody(c, z.object({ email: z.string().nullable().optional() }));
    return c.json(
      await createInvite({ userId: userId(c), workspaceId: c.req.param("id"), email }),
      201,
    );
  });

  // Invitations written to this account, which is the question listInvites
  // cannot answer: that one reports what a workspace has sent, and only to its
  // members. Under /me because it is about the reader, not about an archive.
  app.get("/me/invites", async (c) => c.json(await listMyInvites(userId(c))));

  app.post("/invites/:id/decline", async (c) => {
    await declineInvite({ userId: userId(c), inviteId: c.req.param("id") });
    return c.body(null, 204);
  });

  app.delete("/invites/:id", async (c) => {
    await revokeInvite({ userId: userId(c), inviteId: c.req.param("id") });
    return c.body(null, 204);
  });

  // The code travels in the path rather than a body: it is base64url, which is
  // url-safe by construction, and the client has nothing else to send.
  app.post("/invites/:code/accept", async (c) =>
    c.json(await acceptInvite({ userId: userId(c), code: c.req.param("code") })),
  );

  // --- Projects ---

  app.get("/projects", async (c) => c.json(await listProjects(userId(c))));

  app.post("/projects", async (c) => {
    const { workspaceId, ...card } = await readBody(c, newProjectSchema);
    return c.json(await createProject({ userId: userId(c), workspaceId, card }), 201);
  });

  // No soft delete and no undo. The confirmation is the app's job; by the time
  // this is called the decision has been made.
  app.delete("/projects/:id", async (c) => {
    await deleteProject({ userId: userId(c), projectId: c.req.param("id") });
    return c.body(null, 204);
  });

  app.put("/projects/:id", async (c) => {
    const card = await readBody(c, cardSchema.partial());
    return c.json(
      await updateProject({ userId: userId(c), projectId: c.req.param("id"), card }),
    );
  });

  // Its own route rather than a field on the card. Editing a card changes what a
  // project says about itself; this changes who can read it and which token
  // reaches it, and it answers to the owner alone.
  app.post("/projects/:id/workspace", async (c) => {
    const { workspaceId } = await readBody(c, z.object({ workspaceId: z.string() }));
    return c.json(
      await moveProject({ userId: userId(c), projectId: c.req.param("id"), workspaceId }),
    );
  });

  // --- Tasks: shared operational state ---

  app.get("/projects/:id/tasks", async (c) => {
    const { status, priority, creator, active, completed, query, cursor, limit } = taskQuery.parse(
      c.req.query(),
    );
    return c.json(
      await listTasks({
        userId: userId(c),
        projectId: c.req.param("id"),
        status: status as TaskStatus | undefined,
        priority: priority as TaskPriority | undefined,
        creator,
        active: active === undefined ? undefined : active === "true",
        completed: completed === undefined ? undefined : completed === "true",
        query,
        cursor,
        limit,
      }),
    );
  });

  app.post("/projects/:id/tasks", async (c) => {
    const body = await readBody(c, taskCreateSchema);
    return c.json(
      await createTask({
        userId: userId(c),
        projectId: c.req.param("id"),
        title: body.title,
        description: body.description,
        status: body.status as TaskStatus | undefined,
        priority: body.priority as TaskPriority | undefined,
        blockedReason: body.blockedReason,
        relatedMemoryIds: body.relatedMemoryIds,
        source: { channel: "app_form" },
      }),
      201,
    );
  });

  app.get("/tasks/:id", async (c) =>
    c.json(await getTask({ userId: userId(c), taskId: c.req.param("id") })),
  );

  app.patch("/tasks/:id", async (c) => {
    const { revision, ...patch } = await readBody(c, taskPatchSchema);
    return c.json(
      await updateTask({
        userId: userId(c),
        taskId: c.req.param("id"),
        revision,
        patch: {
          title: patch.title,
          description: patch.description,
          status: patch.status as TaskStatus | undefined,
          priority: patch.priority as TaskPriority | undefined,
          blockedReason: patch.blockedReason,
          relatedMemoryIds: patch.relatedMemoryIds,
        },
        source: { channel: "app_form" },
      }),
    );
  });

  app.post("/tasks/:id/runs", async (c) => {
    const body = await readBody(c, taskRunSourceSchema);
    return c.json(
      await startTaskWork({
        userId: userId(c),
        taskId: c.req.param("id"),
        source: restTaskRunSource(body),
      }),
      201,
    );
  });

  app.post("/task-runs/:id/heartbeat", async (c) => {
    const body = await readBody(c, taskRunHeartbeatSchema);
    return c.json(
      await heartbeatTaskWork({
        userId: userId(c),
        runId: c.req.param("id"),
        source: body.source ? restTaskRunSource(body.source) : undefined,
      }),
    );
  });

  app.delete("/task-runs/:id", async (c) => {
    const body = await readBody(c, taskRunStopSchema);
    await stopTaskWork({
      userId: userId(c),
      runId: c.req.param("id"),
      outcome: body.outcome,
      source: body.source ? restTaskRunSource(body.source) : undefined,
    });
    return c.body(null, 204);
  });

  // --- Nodes: what the listing screens read (plan step 5a.1) ---

  app.get("/projects/:id/nodes", async (c) => {
    const { status, type, file, cursor, limit, sort } = listQuery.parse(c.req.query());
    return c.json(
      await listNodes({
        userId: userId(c),
        projectId: c.req.param("id"),
        status: status as NodeStatus | undefined,
        type: type as NodeType | undefined,
        file,
        cursor,
        limit,
        sort,
      }),
    );
  });

  // The app's half of search_context, with similarity in the response: the screen
  // shows how close a hit is, a coder reading prose does not need the number.
  app.post("/search", async (c) => {
    const { projectId, query, k } = await readBody(c, searchSchema);
    return c.json(await searchNodes({ userId: userId(c), projectId, query, k, channel: "app" }));
  });

  app.put("/nodes/:id", async (c) => {
    const { content, anchors } = await readBody(c, editSchema);
    return c.json(
      await editNode({ userId: userId(c), nodeId: c.req.param("id"), content, anchors }),
    );
  });

  app.post("/nodes/:id/contradict", async (c) => {
    const { supersededBy } = await readBody(c, z.object({ supersededBy: z.string() }));
    await contradictNode({ userId: userId(c), nodeId: c.req.param("id"), supersededBy });
    return c.body(null, 204);
  });

  // One route for the whole answer to a clash, rather than the app calling
  // contradict and then a second thing to clear the flag: half of that pair
  // failing leaves a question on screen that has already been answered.
  app.post("/nodes/:id/conflicts/resolve", async (c) => {
    const { otherId, verdict } = await readBody(
      c,
      z.object({ otherId: z.string(), verdict: z.enum(["new", "old", "both"]) }),
    );
    await resolveConflict({ userId: userId(c), nodeId: c.req.param("id"), otherId, verdict });
    return c.body(null, 204);
  });

  // --- Review feed (plan section 11, screen 7) ---

  app.get("/pending", async (c) => c.json(await getReviewFeed(userId(c))));

  app.post("/pending/:id/approve", async (c) => {
    await approvePending({ userId: userId(c), pendingActionId: c.req.param("id") });
    return c.body(null, 204);
  });

  app.post("/pending/:id/reject", async (c) => {
    await rejectPending({ userId: userId(c), pendingActionId: c.req.param("id") });
    return c.body(null, 204);
  });

  app.post("/nodes/:id/confirm", async (c) => {
    await confirmNode({ userId: userId(c), nodeId: c.req.param("id") });
    return c.body(null, 204);
  });

  app.post("/nodes/:id/archive", async (c) => {
    await archiveNode({ userId: userId(c), nodeId: c.req.param("id") });
    return c.body(null, 204);
  });

  // --- Conversation history (both chats keep a transcript) ---

  app.get("/conversations", async (c) => {
    const { projectId, kind } = conversationQuery.parse(c.req.query());
    return c.json(await listConversations({ userId: userId(c), projectId, kind }));
  });

  app.get("/conversations/:id", async (c) =>
    c.json(await getConversation({ userId: userId(c), conversationId: c.req.param("id") })),
  );

  app.post("/conversations", async (c) => {
    const { projectId, kind, messages } = await readBody(c, conversationSchema);
    // 201 like /projects and /tokens. It was the one create in the API that
    // answered 200, for no reason anybody wrote down.
    return c.json(await createConversation({ userId: userId(c), projectId, kind, messages }), 201);
  });

  // PUT, not PATCH: the body is the whole transcript, not a delta.
  app.put("/conversations/:id", async (c) => {
    const { messages } = await readBody(c, transcriptSchema);
    return c.json(
      await appendToConversation({
        userId: userId(c),
        conversationId: c.req.param("id"),
        messages,
      }),
    );
  });

  app.delete("/conversations/:id", async (c) => {
    await deleteConversation({ userId: userId(c), conversationId: c.req.param("id") });
    return c.body(null, 204);
  });

  // --- Graph and the two chats (plan section 11, screens 4, 5 and 6) ---

  app.get("/projects/:id/graph", async (c) =>
    c.json(await getGraph({ userId: userId(c), projectId: c.req.param("id") })),
  );

  // NDJSON, not SSE: one JSON object per line is the whole protocol, the browser
  // needs no EventSource (which cannot carry an Authorization header anyway),
  // and the client reads it with a split on newline.
  app.post("/chat/query", async (c) => {
    const { projectId, question } = await readBody(c, chatQuerySchema);
    const stream = answerQuestion({ userId: userId(c), projectId, question });

    // The first chunk is awaited before the response starts, so a failure in
    // retrieval still arrives as a normal JSON error with a status code rather
    // than as a 200 that dies mid-body.
    const first = await stream.next();

    return c.body(
      new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const write = (value: unknown) =>
            controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
          try {
            if (!first.done) write(first.value);
            for await (const chunk of stream) write(chunk);
          } catch (caught) {
            // The status line is long gone by now, so the only honest place left
            // to report a mid-stream failure is inside the stream.
            write({ type: "error", message: caught instanceof Error ? caught.message : "stream failed" });
          } finally {
            controller.close();
          }
        },
      }),
      200,
      { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
    );
  });

  app.post("/chat/edit", async (c) => {
    const { projectId, message, sessionId } = await readBody(c, chatEditSchema);
    return c.json(
      await proposeEdits({
        userId: userId(c),
        projectId,
        message,
        // One conversation is one session, so entries created from it group the
        // way a coder's session does. The client owns the id; the server has no
        // conversation table to look one up in.
        sessionId: sessionId ?? randomUUID(),
      }),
    );
  });

  return app;
}
