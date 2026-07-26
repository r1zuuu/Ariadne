import { createHash, randomBytes } from "node:crypto";
import { hash as hashPassword, verify as verifyArgon2 } from "@node-rs/argon2";
import { and, cosineDistance, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import { apiTokens, codeAnchors, nodes, pendingActions, projects, users } from "./db/schema.js";
import { embed } from "./gemini.js";

// Business logic lives here once; MCP tools and REST endpoints are thin
// wrappers over these functions (plan section 2).

export class ServiceError extends Error {
  constructor(
    public code: "validation" | "unknown_repo" | "not_found" | "unauthorized",
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export type NodeType = "session_summary" | "decision" | "note";
export type Anchor = { path: string; symbol?: string; sha?: string };
export type SourceMeta = {
  session_id: string;
  commit_sha?: string;
  raw_input?: string;
  channel: "coder" | "app_chat" | "app_form";
};

const MAX_CONTENT_LENGTH = 4000;
const NODE_TYPES = ["session_summary", "decision", "note"] as const;
const INDEX_SIZE = 10;
const HEADLINE_LENGTH = 120;
const CHANNELS = ["coder", "app_chat", "app_form"] as const;
const ETAPY = ["prototyp", "produkcja", "utrzymanie"] as const;
const MIN_PASSWORD_LENGTH = 8;
const MAX_LABEL_LENGTH = 100;
const FEED_LIMIT = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContent(raw: string): string {
  const content = raw?.trim() ?? "";
  if (!content) throw new ServiceError("validation", "content must not be empty");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new ServiceError(
      "validation",
      `content has ${content.length} chars, max is ${MAX_CONTENT_LENGTH}; split it into single thoughts`,
    );
  }
  return content;
}

function assertUuid(value: string, field: string) {
  if (!UUID_RE.test(value)) {
    throw new ServiceError("validation", `${field} must be a uuid`);
  }
}

function assertAnchors(anchors: Anchor[]) {
  for (const a of anchors) {
    const path = a.path ?? "";
    const looksAbsolute = path.startsWith("/") || /^[a-z]:/i.test(path);
    const escapesRepo = path.split("/").includes("..");
    if (!path || path.includes("\\") || looksAbsolute || escapesRepo) {
      throw new ServiceError(
        "validation",
        `invalid anchor path "${path}": expected a repo-relative path like "src/db/schema.ts"`,
      );
    }
  }
}

// Postgres unique_violation. Needed where onConflict is not available, i.e. on
// UPDATE: changing a project's repo_ref can collide with another of its own.
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

async function assertProjectOwned(userId: string, projectId: string) {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  if (!project) {
    throw new ServiceError("not_found", "project not found for this user");
  }
}

export async function createNode(input: {
  userId: string;
  projectId: string;
  type: NodeType;
  content: string;
  anchors?: Anchor[];
  source: SourceMeta;
  replacesNodeId?: string;
}): Promise<{ nodeId: string; status: "proposed"; contradictedNodeId?: string }> {
  // Validation gate (plan section 5), shared by both entry paths.
  assertUuid(input.userId, "userId");
  assertUuid(input.projectId, "projectId");
  if (input.replacesNodeId) assertUuid(input.replacesNodeId, "replacesNodeId");
  if (!NODE_TYPES.includes(input.type)) {
    throw new ServiceError("validation", `type must be one of: ${NODE_TYPES.join(", ")}`);
  }
  const content = validateContent(input.content);
  if (!input.source?.session_id) {
    throw new ServiceError("validation", "source.session_id is required");
  }
  if (!CHANNELS.includes(input.source.channel)) {
    throw new ServiceError("validation", `source.channel must be one of: ${CHANNELS.join(", ")}`);
  }
  const anchors = input.anchors ?? [];
  assertAnchors(anchors);
  await assertProjectOwned(input.userId, input.projectId);

  // Network call stays outside the transaction.
  const embedding = await embed(content, "RETRIEVAL_DOCUMENT");

  return db.transaction(async (tx) => {
    let contradictedNodeId: string | undefined;
    if (input.replacesNodeId) {
      const [previous] = await tx
        .update(nodes)
        .set({ status: "contradicted", updatedAt: new Date() })
        .where(
          and(
            eq(nodes.id, input.replacesNodeId),
            eq(nodes.userId, input.userId),
            eq(nodes.projectId, input.projectId),
          ),
        )
        .returning({ id: nodes.id });
      if (!previous) {
        throw new ServiceError("not_found", "replaces_node_id not found in this project");
      }
      contradictedNodeId = previous.id;
    }

    const [node] = await tx
      .insert(nodes)
      .values({
        userId: input.userId,
        projectId: input.projectId,
        type: input.type,
        content,
        status: "proposed", // always forced, never taken from input
        source: input.source,
        embedding,
      })
      .returning({ id: nodes.id });

    if (anchors.length) {
      await tx.insert(codeAnchors).values(
        anchors.map((a) => ({ nodeId: node.id, path: a.path, symbol: a.symbol, sha: a.sha })),
      );
    }

    return { nodeId: node.id, status: "proposed", contradictedNodeId };
  });
}

// "https://github.com/User/Repo.git" and "git@github.com:User/Repo" both
// normalize to "github.com/User/Repo" (host lowercased, plan section 3).
export function normalizeRepoRef(raw: string): string {
  let ref = raw.trim();
  ref = ref.replace(/^git@([^:]+):/, "$1/"); // ssh form -> host/path
  ref = ref.replace(/^[a-z+]+:\/\//i, ""); // strip scheme
  ref = ref.replace(/^[^@/]+@/, ""); // strip user@ before host
  ref = ref.replace(/\.git$/i, "").replace(/\/+$/, "");
  const slash = ref.indexOf("/");
  if (slash === -1) return ref.toLowerCase();
  return ref.slice(0, slash).toLowerCase() + ref.slice(slash);
}

export async function resolveProjectByRepoRef(userId: string, repoRef: string) {
  const normalized = normalizeRepoRef(repoRef);
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.userId, userId), eq(projects.repoRef, normalized)));
  if (!project) {
    throw new ServiceError(
      "unknown_repo",
      `Zaloz projekt w aplikacji Ariadne i podaj repo_ref: ${normalized}`,
    );
  }
  return project;
}

export async function searchNodes(input: {
  userId: string;
  projectId: string;
  query: string;
  k?: number;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.projectId, "projectId");
  const k = input.k ?? 5;
  if (!Number.isInteger(k) || k < 1 || k > 10) {
    throw new ServiceError("validation", "k must be an integer between 1 and 10");
  }
  if (!input.query?.trim()) {
    throw new ServiceError("validation", "query must not be empty");
  }

  const queryVector = await embed(input.query, "RETRIEVAL_QUERY");
  const distance = cosineDistance(nodes.embedding, queryVector);

  // Metadata filters BEFORE similarity: they narrow, vectors rank (plan section 7).
  const found = await db
    .select({
      id: nodes.id,
      type: nodes.type,
      content: nodes.content,
      status: nodes.status,
      source: nodes.source,
      createdAt: nodes.createdAt,
      similarity: sql<number>`1 - (${distance})`,
    })
    .from(nodes)
    .where(
      and(
        eq(nodes.userId, input.userId),
        eq(nodes.projectId, input.projectId),
        ne(nodes.status, "archived"),
      ),
    )
    .orderBy(distance)
    .limit(k);

  const anchorRows = found.length
    ? await db
        .select()
        .from(codeAnchors)
        .where(inArray(codeAnchors.nodeId, found.map((n) => n.id)))
    : [];

  return found.map((node) => ({
    ...node,
    anchors: anchorRows
      .filter((a) => a.nodeId === node.id)
      .map(({ path, symbol, sha }) => ({ path, symbol, sha })),
  }));
}

// Nodes have no title column: the first line of content already reads as one,
// because that is how a summary of a decision naturally starts.
function headline(content: string) {
  const firstLine = content.split("\n", 1)[0].trim();
  return firstLine.length > HEADLINE_LENGTH
    ? `${firstLine.slice(0, HEADLINE_LENGTH)}...`
    : firstLine;
}

// Boot context for a coder session start: user profile + project card +
// last session summary + an index of what else is recorded (plan section 6).
export async function getBootContext(input: { userId: string; repoRef: string }) {
  assertUuid(input.userId, "userId");
  const project = await resolveProjectByRepoRef(input.userId, input.repoRef);

  const [user] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!user) throw new ServiceError("not_found", "user not found");

  const [lastSummary] = await db
    .select({ content: nodes.content, createdAt: nodes.createdAt })
    .from(nodes)
    .where(
      and(
        eq(nodes.projectId, project.id),
        eq(nodes.type, "session_summary"),
        ne(nodes.status, "archived"),
      ),
    )
    .orderBy(desc(nodes.createdAt))
    .limit(1);

  // Without this the graph is invisible: the boot payload looks complete, so the
  // coder never calls search_context and answers from the code instead.
  // ponytail: newest 10 headlines. Past roughly a hundred nodes that is a random
  // sample rather than an index - then pick by anchors matching the files in play,
  // or cluster by topic.
  const index = await db
    .select({ node_id: nodes.id, type: nodes.type, content: nodes.content })
    .from(nodes)
    .where(
      and(
        eq(nodes.projectId, project.id),
        inArray(nodes.type, ["decision", "note"]),
        // Contradicted ones are out too, not just archived: a headline carries no
        // status, so a superseded one would read as current and get acted on
        // without ever being opened. Its replacement is in the index anyway.
        inArray(nodes.status, ["proposed", "confirmed"]),
      ),
    )
    .orderBy(desc(nodes.createdAt))
    .limit(INDEX_SIZE);

  return {
    profile: user.profile,
    project: {
      name: project.name,
      opis: project.opis,
      stack: project.stack,
      dla_kogo: project.dlaKogo,
      grupa_odbiorcza: project.grupaOdbiorcza,
      konwencje_ref: project.konwencjeRef,
      ograniczenia: project.ograniczenia,
      etap: project.etap,
    },
    last_summary: lastSummary ?? null,
    // Headlines only. The coder reads a relevant one and calls search_context.
    index: index.map(({ node_id, type, content }) => ({
      node_id,
      type,
      headline: headline(content),
    })),
  };
}

// --- Node lifecycle (plan section 4) ---

export type RequestedBy = "coder" | "app_agent";
type UpdatePayload = { content?: string; anchors?: Anchor[] };

async function assertNodeOwned(userId: string, nodeId: string) {
  assertUuid(userId, "userId");
  assertUuid(nodeId, "nodeId");
  const [node] = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(and(eq(nodes.id, nodeId), eq(nodes.userId, userId)));
  if (!node) throw new ServiceError("not_found", "node not found for this user");
}

async function hasAllPermission(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ allPermission: users.allPermission })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new ServiceError("not_found", "user not found");
  return user.allPermission;
}

// Applies an update to a node's content and/or anchors. Content change
// recomputes the embedding - otherwise RAG keeps searching stale meaning.
async function applyNodeUpdate(nodeId: string, payload: UpdatePayload) {
  const updates: Partial<typeof nodes.$inferInsert> = { updatedAt: new Date() };
  if (payload.content !== undefined) {
    updates.content = validateContent(payload.content);
    updates.embedding = await embed(updates.content, "RETRIEVAL_DOCUMENT");
  }
  await db.transaction(async (tx) => {
    await tx.update(nodes).set(updates).where(eq(nodes.id, nodeId));
    if (payload.anchors) {
      assertAnchors(payload.anchors);
      await tx.delete(codeAnchors).where(eq(codeAnchors.nodeId, nodeId));
      if (payload.anchors.length) {
        await tx.insert(codeAnchors).values(
          payload.anchors.map((a) => ({ nodeId, path: a.path, symbol: a.symbol, sha: a.sha })),
        );
      }
    }
  });
}

async function archiveNodeById(nodeId: string) {
  await db
    .update(nodes)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(nodes.id, nodeId));
}

export async function requestUpdate(input: {
  userId: string;
  nodeId: string;
  content?: string;
  anchors?: Anchor[];
  requestedBy: RequestedBy;
}): Promise<{ applied: true } | { applied: false; pendingActionId: string }> {
  if (input.content === undefined && input.anchors === undefined) {
    throw new ServiceError("validation", "nothing to update: provide content and/or anchors");
  }
  // Fail fast on bad payload even when it only goes to the pending queue.
  if (input.content !== undefined) validateContent(input.content);
  if (input.anchors) assertAnchors(input.anchors);
  await assertNodeOwned(input.userId, input.nodeId);

  const payload: UpdatePayload = { content: input.content, anchors: input.anchors };
  if (await hasAllPermission(input.userId)) {
    await applyNodeUpdate(input.nodeId, payload);
    return { applied: true };
  }
  const [pending] = await db
    .insert(pendingActions)
    .values({
      userId: input.userId,
      nodeId: input.nodeId,
      action: "update",
      payload,
      requestedBy: input.requestedBy,
    })
    .returning({ id: pendingActions.id });
  return { applied: false, pendingActionId: pending.id };
}

export async function requestDelete(input: {
  userId: string;
  nodeId: string;
  requestedBy: RequestedBy;
}): Promise<{ applied: true } | { applied: false; pendingActionId: string }> {
  await assertNodeOwned(input.userId, input.nodeId);

  if (await hasAllPermission(input.userId)) {
    await archiveNodeById(input.nodeId); // never a physical DELETE
    return { applied: true };
  }
  const [pending] = await db
    .insert(pendingActions)
    .values({
      userId: input.userId,
      nodeId: input.nodeId,
      action: "delete",
      requestedBy: input.requestedBy,
    })
    .returning({ id: pendingActions.id });
  return { applied: false, pendingActionId: pending.id };
}

export async function approvePending(input: { userId: string; pendingActionId: string }) {
  assertUuid(input.userId, "userId");
  assertUuid(input.pendingActionId, "pendingActionId");
  const [pending] = await db
    .select()
    .from(pendingActions)
    .where(
      and(
        eq(pendingActions.id, input.pendingActionId),
        eq(pendingActions.userId, input.userId),
        eq(pendingActions.status, "pending"),
      ),
    );
  if (!pending) throw new ServiceError("not_found", "pending action not found");

  // ponytail: apply-then-flip is not atomic; two concurrent approves can
  // double-apply. Fine for a single user clicking a feed; add a conditional
  // status flip if this ever runs multi-client.
  if (pending.action === "update") {
    await applyNodeUpdate(pending.nodeId, pending.payload as UpdatePayload);
  } else {
    await archiveNodeById(pending.nodeId);
  }
  await db
    .update(pendingActions)
    .set({ status: "approved", resolvedAt: new Date() })
    .where(eq(pendingActions.id, pending.id));
}

export async function rejectPending(input: { userId: string; pendingActionId: string }) {
  assertUuid(input.userId, "userId");
  assertUuid(input.pendingActionId, "pendingActionId");
  const [rejected] = await db
    .update(pendingActions)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(
      and(
        eq(pendingActions.id, input.pendingActionId),
        eq(pendingActions.userId, input.userId),
        eq(pendingActions.status, "pending"),
      ),
    )
    .returning({ id: pendingActions.id });
  if (!rejected) throw new ServiceError("not_found", "pending action not found");
}

export async function confirmNode(input: { userId: string; nodeId: string }) {
  await assertNodeOwned(input.userId, input.nodeId);
  const [confirmed] = await db
    .update(nodes)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(
      and(
        eq(nodes.id, input.nodeId),
        eq(nodes.userId, input.userId),
        eq(nodes.status, "proposed"), // only proposed can be confirmed (plan section 4)
      ),
    )
    .returning({ id: nodes.id });
  if (!confirmed) {
    throw new ServiceError("validation", "only a node with status proposed can be confirmed");
  }
}

export async function archiveNode(input: { userId: string; nodeId: string }) {
  await assertNodeOwned(input.userId, input.nodeId);
  await archiveNodeById(input.nodeId);
}

// --- Accounts and auth (plan section 10) ---

// Emails are compared lowercased, otherwise "Stas@x.pl" and "stas@x.pl" become
// two accounts and the unique index does not stop it.
function normalizeEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

export async function registerUser(input: {
  email: string;
  password: string;
}): Promise<{ userId: string }> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) {
    throw new ServiceError("validation", "email does not look like an email address");
  }
  if ((input.password ?? "").length < MIN_PASSWORD_LENGTH) {
    throw new ServiceError(
      "validation",
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }

  // Checked before hashing, not after: argon2 is deliberately expensive, and an
  // unauthenticated caller should not be able to spend 19 MiB and a CPU burst per
  // request just by resending an address that is already taken.
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (taken) throw new ServiceError("validation", "email already registered");

  // @node-rs/argon2 defaults to argon2id with the OWASP-recommended cost
  // (19 MiB, 2 iterations), so there is nothing to tune here.
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    // The check above races; this is what actually keeps the address unique.
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (!user) throw new ServiceError("validation", "email already registered");
  return { userId: user.id };
}

// A stored hash that argon2 cannot parse (the seed script writes a placeholder)
// makes verify throw; that is a failed login, not a server error.
async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verifyArgon2(storedHash, password);
  } catch {
    return false;
  }
}

// ponytail: no rate limiting, so guessing against a known address is only slowed
// by argon2 itself. Enough while this listens on localhost; put a per-IP limiter
// in front of /auth before it faces the internet.
export async function login(input: {
  email: string;
  password: string;
}): Promise<{ userId: string }> {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, normalizeEmail(input.email)));

  // One message for both unknown email and wrong password. Not to hide which is
  // which - open registration already reveals taken emails - but so no caller can
  // branch on the difference and turn the login form into an enumeration endpoint.
  const rejected = new ServiceError("unauthorized", "invalid email or password");
  if (!user) throw rejected;
  if (!(await verifyPassword(user.passwordHash, input.password))) throw rejected;
  return { userId: user.id };
}

export async function getAccount(userId: string) {
  assertUuid(userId, "userId");
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      profile: users.profile,
      allPermission: users.allPermission,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new ServiceError("not_found", "user not found");
  return user;
}

export async function updateProfile(input: { userId: string; profile: string }) {
  assertUuid(input.userId, "userId");
  // Unlike node content an empty profile is allowed: it is the default for a
  // fresh account and onboarding fills it in later.
  const profile = (input.profile ?? "").trim();
  if (profile.length > MAX_CONTENT_LENGTH) {
    throw new ServiceError(
      "validation",
      `profile has ${profile.length} chars, max is ${MAX_CONTENT_LENGTH}`,
    );
  }
  const [updated] = await db
    .update(users)
    .set({ profile })
    .where(eq(users.id, input.userId))
    .returning({ profile: users.profile });
  if (!updated) throw new ServiceError("not_found", "user not found");
  return updated;
}

export async function setAllPermission(input: { userId: string; allPermission: boolean }) {
  assertUuid(input.userId, "userId");
  const [updated] = await db
    .update(users)
    .set({ allPermission: input.allPermission })
    .where(eq(users.id, input.userId))
    .returning({ allPermission: users.allPermission });
  if (!updated) throw new ServiceError("not_found", "user not found");
  return updated;
}

// --- MCP tokens (plan section 9) ---

// The raw token is shown once at generation; only its sha256 reaches the DB,
// so a database leak does not hand out working tokens.
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

// Every MCP call scopes to the user behind the bearer token.
export async function resolveUserByToken(rawToken: string): Promise<string> {
  const [token] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hashToken(rawToken)));
  if (!token) throw new ServiceError("unauthorized", "invalid token");
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, token.id));
  return token.userId;
}

// The only place the raw token exists after generation is this return value.
// Whoever calls it has one chance to show it to the user.
export async function createApiToken(input: { userId: string; label?: string }) {
  assertUuid(input.userId, "userId");
  const label = (input.label ?? "").trim().slice(0, MAX_LABEL_LENGTH);
  const token = generateToken();
  const [row] = await db
    .insert(apiTokens)
    .values({ userId: input.userId, tokenHash: hashToken(token), label })
    .returning({ id: apiTokens.id, label: apiTokens.label, createdAt: apiTokens.createdAt });
  return { ...row, token };
}

export async function listApiTokens(userId: string) {
  assertUuid(userId, "userId");
  // No tokenHash in the projection: nothing downstream has a use for it, and a
  // hash that never leaves this module cannot leak through a response.
  return db
    .select({
      id: apiTokens.id,
      label: apiTokens.label,
      createdAt: apiTokens.createdAt,
      lastUsedAt: apiTokens.lastUsedAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
}

// Revoking is a physical delete, unlike nodes: a token has no history worth
// keeping and a revoked-but-present row is one bug away from still working.
export async function deleteApiToken(input: { userId: string; tokenId: string }) {
  assertUuid(input.userId, "userId");
  assertUuid(input.tokenId, "tokenId");
  const [deleted] = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, input.tokenId), eq(apiTokens.userId, input.userId)))
    .returning({ id: apiTokens.id });
  if (!deleted) throw new ServiceError("not_found", "token not found for this user");
}

// --- Projects (plan section 10) ---

export type ProjectCard = {
  name: string;
  repoRef: string;
  opis?: string;
  stack?: string;
  dlaKogo?: string;
  grupaOdbiorcza?: string | null;
  konwencjeRef?: string | null;
  ograniczenia?: string;
  etap?: string;
};

function validateCard(card: Partial<ProjectCard>) {
  if (card.name !== undefined && !card.name.trim()) {
    throw new ServiceError("validation", "name must not be empty");
  }
  if (card.repoRef !== undefined && !card.repoRef.trim()) {
    throw new ServiceError("validation", "repo_ref must not be empty");
  }
  if (card.etap !== undefined && !ETAPY.includes(card.etap as (typeof ETAPY)[number])) {
    throw new ServiceError("validation", `etap must be one of: ${ETAPY.join(", ")}`);
  }
}

export async function listProjects(userId: string) {
  assertUuid(userId, "userId");
  return db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt));
}

export async function createProject(input: { userId: string; card: ProjectCard }) {
  assertUuid(input.userId, "userId");
  validateCard(input.card);
  const repoRef = normalizeRepoRef(input.card.repoRef);
  const [project] = await db
    .insert(projects)
    .values({ ...input.card, userId: input.userId, repoRef })
    .onConflictDoNothing({ target: [projects.userId, projects.repoRef] })
    .returning();
  if (!project) {
    throw new ServiceError("validation", `you already have a project for repo_ref ${repoRef}`);
  }
  return project;
}

export async function updateProject(input: {
  userId: string;
  projectId: string;
  card: Partial<ProjectCard>;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.projectId, "projectId");
  validateCard(input.card);
  const patch = { ...input.card, updatedAt: new Date() };
  if (input.card.repoRef !== undefined) patch.repoRef = normalizeRepoRef(input.card.repoRef);

  try {
    const [project] = await db
      .update(projects)
      .set(patch)
      .where(and(eq(projects.id, input.projectId), eq(projects.userId, input.userId)))
      .returning();
    if (!project) throw new ServiceError("not_found", "project not found for this user");
    return project;
  } catch (error) {
    // A repo_ref edit can land on another project of the same user.
    if (isUniqueViolation(error)) {
      throw new ServiceError("validation", "another project of yours already uses this repo_ref");
    }
    throw error;
  }
}

// --- Review feed (plan section 10) ---

// Everything waiting for a human: queued update/delete requests, plus nodes
// whose status was never settled. Cross-project on purpose, it is one inbox.
export async function getReviewFeed(userId: string) {
  assertUuid(userId, "userId");

  const queued = await db
    .select({
      id: pendingActions.id,
      action: pendingActions.action,
      payload: pendingActions.payload,
      requestedBy: pendingActions.requestedBy,
      createdAt: pendingActions.createdAt,
      nodeId: nodes.id,
      nodeType: nodes.type,
      // The current content travels with the request so the app can show the
      // change against what is stored, without a second round trip per row.
      nodeContent: nodes.content,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(pendingActions)
    .innerJoin(nodes, eq(nodes.id, pendingActions.nodeId))
    .innerJoin(projects, eq(projects.id, nodes.projectId))
    .where(and(eq(pendingActions.userId, userId), eq(pendingActions.status, "pending")))
    .orderBy(desc(pendingActions.createdAt))
    .limit(FEED_LIMIT);

  const unsettled = await db
    .select({
      id: nodes.id,
      type: nodes.type,
      content: nodes.content,
      status: nodes.status,
      source: nodes.source,
      createdAt: nodes.createdAt,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(nodes)
    .innerJoin(projects, eq(projects.id, nodes.projectId))
    .where(and(eq(nodes.userId, userId), inArray(nodes.status, ["proposed", "contradicted"])))
    .orderBy(desc(nodes.createdAt))
    .limit(FEED_LIMIT);

  // ponytail: both lists capped at FEED_LIMIT with no paging. The screen is
  // explicitly ignorable, so a long tail is not worth a cursor yet; add one when
  // the count stops fitting on a screen.
  return { pendingActions: queued, nodesToReview: unsettled };
}
