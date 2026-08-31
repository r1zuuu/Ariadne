import { createHash, randomBytes } from "node:crypto";
import { hash as hashPassword, verify as verifyArgon2 } from "@node-rs/argon2";
import {
  and,
  cosineDistance,
  countDistinct,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQLWrapper,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./db/client.js";
import {
  apiTokens,
  codeAnchors,
  conversations,
  invites,
  memberships,
  nodes,
  oauthAccounts,
  pendingActions,
  projects,
  taskEvents,
  taskMemoryLinks,
  tasks,
  users,
  workspaces,
} from "./db/schema.js";
import { open, seal } from "./crypto.js";
import { embed, findConflicts, summarize } from "./gemini.js";

// Business logic lives here once; MCP tools and REST endpoints are thin
// wrappers over these functions (plan section 2).

export class ServiceError extends Error {
  constructor(
    public code:
      | "validation"
      | "unknown_repo"
      // One repository address, two archives, and nothing in the call to say
      // which was meant. The only case where a coder must not guess.
      | "ambiguous_repo"
      | "not_found"
      | "unauthorized"
      | "rate_limited"
      | "conflict"
      // Its own code, not a validation error: nothing about the request is
      // wrong, the account simply has no key to Google and neither has the
      // server. The app turns this one into "add your key in settings".
      | "no_gemini_key",
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export type NodeType = "session_summary" | "decision" | "note";
export type NodeStatus = "proposed" | "confirmed" | "contradicted" | "archived";
export type Anchor = { path: string; symbol?: string; sha?: string };
export type SourceMeta = {
  session_id: string;
  commit_sha?: string;
  raw_input?: string;
  channel: "coder" | "app_chat" | "app_form";
};

const MAX_CONTENT_LENGTH = 4000;
const NODE_TYPES = ["session_summary", "decision", "note"] as const;
const NODE_STATUSES = ["proposed", "confirmed", "contradicted", "archived"] as const;
const LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const INDEX_SIZE = 10;
// ponytail: the twenty files with the most entries. An archive spread over more
// files than that has a tail this does not name, and the fix then is to pick the
// files from what the session is actually touching rather than to raise the
// number. Raising it only moves the wall, same as it would for INDEX_SIZE.
const BY_FILE_SIZE = 20;
const HEADLINE_LENGTH = 120;
const CHANNELS = ["coder", "app_chat", "app_form"] as const;
const ETAPY = ["prototyp", "produkcja", "utrzymanie"] as const;
const MIN_PASSWORD_LENGTH = 8;
const MAX_LABEL_LENGTH = 100;
const MAX_NAME_LENGTH = 80;
const FEED_LIMIT = 100;
const INVITE_TTL_DAYS = 7;
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
// Both shapes, because drizzle wraps what the driver threw: the pg error with
// its SQLSTATE sits under .cause, and reading only the top level made every
// collision a 500 with a stack trace. It cost the repo_ref check on the move
// path and, silently for longer, the same check on a card edit.
function isUniqueViolation(error: unknown): boolean {
  const sqlstate = (value: unknown) => (value as { code?: string } | null)?.code;
  return (
    sqlstate(error) === "23505" || sqlstate((error as { cause?: unknown } | null)?.cause) === "23505"
  );
}

// --- Access (plan section 3) ---
//
// A workspace owns the archive; a person reaches it by being a member. These
// three helpers are the whole access rule, and each one hands back the workspace
// it just proved, so the caller writes with a tenant it did not have to guess.

/** Workspaces this user reaches, for statements that cannot carry a join. */
function reachableWorkspaces(userId: string) {
  return db
    .select({ id: memberships.workspaceId })
    .from(memberships)
    .where(eq(memberships.userId, userId));
}

/**
 * The caller's own account is gone.
 *
 * Every site below arrives with a userId taken from a verified token, so a
 * missing row cannot mean "look somewhere else" - it means the account this
 * session names no longer exists. Reported as an authentication failure because
 * that is what it is, and because 404 leaves the dead session in place: the app
 * only drops a token on 401, so every screen fails, nothing logs out, and the
 * copy blames a server that answered perfectly well.
 */
function noSuchAccount(): ServiceError {
  return new ServiceError(
    "unauthorized",
    "this session belongs to an account that no longer exists; sign in again",
  );
}

async function assertMember(userId: string, workspaceId: string): Promise<"owner" | "member"> {
  assertUuid(userId, "userId");
  assertUuid(workspaceId, "workspaceId");
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));
  if (!row) throw new ServiceError("not_found", "workspace not found for this user");
  return row.role as "owner" | "member";
}

async function workspaceOfProject(userId: string, projectId: string): Promise<string> {
  assertUuid(userId, "userId");
  assertUuid(projectId, "projectId");
  const [project] = await db
    .select({ workspaceId: projects.workspaceId })
    .from(projects)
    .innerJoin(memberships, eq(memberships.workspaceId, projects.workspaceId))
    .where(and(eq(projects.id, projectId), eq(memberships.userId, userId)));
  if (!project) {
    throw new ServiceError("not_found", "project not found for this user");
  }
  return project.workspaceId;
}

/**
 * Whose key pays for a call to Gemini: the account that asked, and nobody else.
 *
 * One place decides this, because the alternative is every call site inventing
 * its own rule and the answer to "which key just got billed" being "depends".
 */
export async function geminiKey(userId: string): Promise<string> {
  const [user] = await db
    .select({ sealed: users.geminiKey })
    .from(users)
    .where(eq(users.id, userId));
  // A key that no longer opens (the server secret was rotated, the row was
  // edited) is treated as absent rather than fatal: the fallback still works
  // and settings will show the account as having none.
  const own = user?.sealed ? open(user.sealed) : null;
  // No server-wide fallback, deliberately. Every call to Google is paid for by
  // the account that asked for it: an instance key would be spent by whoever
  // registered last, on every entry written and every question asked, with
  // nothing between an open sign-up form and the person holding the bill.
  if (!own) {
    throw new ServiceError("no_gemini_key", "no Gemini key: add one in settings");
  }
  return own;
}

/** Whether this account can pay for a call to Google, for a screen that says so. */
export type GeminiKeySource = "user" | "none";

/**
 * The summary is decoration over the entry, so it never decides whether the
 * entry gets written. A refused model call, a rate limit, a malformed answer:
 * the card falls back to the first sentence and the archive is unharmed.
 */
async function summarizeOrNothing(key: string, content: string): Promise<string> {
  try {
    return await summarize(key, content);
  } catch {
    return "";
  }
}

// How close an existing entry has to be before the model is asked whether it
// clashes with the new one. Cosine similarity over normalized 768-dimension
// vectors: below this the two are not even about the same thing, so paying for
// a reading of the pair buys nothing.
//
// ponytail: one number for every project. If this turns out to be noisy on a
// large archive, the fix is a per-project setting, not a cleverer formula.
const CONFLICT_SIMILARITY = 0.7;
const CONFLICT_CANDIDATES = 4;

/**
 * Entries the new one appears to contradict. Two stages, because neither works
 * alone: the vector search narrows thousands of entries to a handful about the
 * same subject, and the model decides which of those actually clash. A wrong
 * answer here costs a person one dismissed suggestion, so a failure is silence.
 */
async function conflictsFor(input: {
  key: string;
  workspaceId: string;
  projectId: string;
  content: string;
  embedding: number[];
}): Promise<string[]> {
  try {
    const distance = cosineDistance(nodes.embedding, input.embedding);
    const near = await db
      .select({ id: nodes.id, content: nodes.content, similarity: sql<number>`1 - (${distance})` })
      .from(nodes)
      .where(
        and(
          eq(nodes.workspaceId, input.workspaceId),
          eq(nodes.projectId, input.projectId),
          // Only what still claims to be true. An archived entry was put away
          // and a contradicted one has already lost an argument; neither can be
          // contradicted again, so neither is worth a reading.
          inArray(nodes.status, ["proposed", "confirmed"]),
        ),
      )
      .orderBy(distance)
      .limit(CONFLICT_CANDIDATES);

    const candidates = near.filter((row) => row.similarity >= CONFLICT_SIMILARITY);
    if (!candidates.length) return [];

    const clashing = await findConflicts(
      input.key,
      input.content,
      candidates.map((row) => row.content),
    );
    return clashing.map((i: number) => candidates[i].id);
  } catch {
    // A write is never held up by this: an entry with an undetected conflict is
    // exactly what the archive did before the check existed.
    return [];
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
}): Promise<{
  nodeId: string;
  status: "proposed" | "confirmed";
  /** Entries the new one appears to contradict, for the screen that wrote it. */
  conflictsWith: string[];
  contradictedNodeId?: string;
}> {
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
  const workspaceId = await workspaceOfProject(input.userId, input.projectId);

  // Written from the app, or written by a coder on an account that has said it
  // does not want to be asked. all_permission already meant that for edits and
  // deletions; it means it for new entries too, which is the only reading under
  // which the review screen is a gate rather than a list.
  //
  // Nobody watches which tools a coder calls mid-session, so the default has to
  // be that nothing it writes counts until a person has seen it.
  const settled =
    input.source.channel !== "coder" || (await hasAllPermission(input.userId));

  // Network calls stay outside the transaction. The embedding goes first
  // because the conflict search needs the vector to find anything; the summary
  // and the search then run side by side, since neither waits on the other.
  const key = await geminiKey(input.userId);
  const embedding = await embed(key, content, "RETRIEVAL_DOCUMENT");
  const [summary, conflictsWith] = await Promise.all([
    summarizeOrNothing(key, content),
    conflictsFor({ key, workspaceId, projectId: input.projectId, content, embedding }),
  ]);

  return db.transaction(async (tx) => {
    const [node] = await tx
      .insert(nodes)
      .values({
        workspaceId,
        authorId: input.userId,
        projectId: input.projectId,
        type: input.type,
        content,
        summary,
        conflictsWith,
        status: settled ? "confirmed" : "proposed", // never taken from input
        confirmedBy: settled ? input.userId : null,
        confirmedAt: settled ? new Date() : null,
        source: input.source,
        embedding,
      })
      .returning({ id: nodes.id });

    // Insert first, then point the old node at the new one: superseded_by needs an
    // id that does not exist until the insert runs. A throw below rolls both back.
    let contradictedNodeId: string | undefined;
    if (input.replacesNodeId) {
      const [previous] = await tx
        .update(nodes)
        .set({ status: "contradicted", supersededBy: node.id, updatedAt: new Date() })
        .where(
          and(
            eq(nodes.id, input.replacesNodeId),
            eq(nodes.workspaceId, workspaceId),
            eq(nodes.projectId, input.projectId),
          ),
        )
        .returning({ id: nodes.id });
      if (!previous) {
        throw new ServiceError("not_found", "replaces_node_id not found in this project");
      }
      contradictedNodeId = previous.id;
    }

    if (anchors.length) {
      await tx.insert(codeAnchors).values(
        anchors.map((a) => ({ nodeId: node.id, path: a.path, symbol: a.symbol, sha: a.sha })),
      );
    }

    return {
      nodeId: node.id,
      status: settled ? "confirmed" : "proposed",
      conflictsWith,
      contradictedNodeId,
    };
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

/**
 * The project a repository address means, looked up across every archive its
 * owner belongs to.
 *
 * It used to be scoped to one archive, the one the token was minted for, and
 * that is what broke the promise the app makes at the end of onboarding: one
 * command per machine, covering all of your projects. A token stands for a
 * machine. Which archive a session reaches is decided by the repository it is
 * standing in, not by which token was pasted into the config, so a private
 * project and a company one can be open in two terminals at once.
 *
 * reachableWorkspaces is the whole of the boundary: membership, the same rule
 * the policies of migration 0008 apply underneath. Nothing outside it is
 * visible to any token.
 */
export async function resolveProjectByRepoRef(input: {
  userId: string;
  repoRef: string;
  /** Absent outside an MCP session, where there is no token to record against. */
  tokenId?: string;
}) {
  assertUuid(input.userId, "userId");
  const normalized = normalizeRepoRef(input.repoRef);
  const found = await db
    .select({ project: projects, workspace: workspaces.name })
    .from(projects)
    .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    .where(
      and(
        eq(projects.repoRef, normalized),
        inArray(projects.workspaceId, reachableWorkspaces(input.userId)),
      ),
    );
  if (found.length === 1) return found[0].project;

  // Written before the throw, and it survives it: the tool wrapper catches a
  // ServiceError inside the request transaction, and a JavaScript exception is
  // not what aborts a Postgres transaction. Nothing clears it on the way back -
  // the app stops showing it the moment the project it names exists.
  if (input.tokenId) {
    await db
      .update(apiTokens)
      .set({ lastUnknownRepo: normalized, lastUnknownRepoAt: new Date() })
      .where(eq(apiTokens.id, input.tokenId));
  }

  if (!found.length) {
    throw new ServiceError(
      "unknown_repo",
      `Zaloz projekt w aplikacji Ariadne i podaj repo_ref: ${normalized}`,
    );
  }

  // Two archives, one address, and no way to tell which was meant. Guessing here
  // would put half a project's entries where the other half cannot see them, so
  // the coder is told to stop and the person is told what to fix.
  const where = found.map((row) => `${row.project.name} w archiwum ${row.workspace}`).join(", ");
  throw new ServiceError(
    "ambiguous_repo",
    `repo_ref ${normalized} jest zapisany w wiecej niz jednym archiwum: ${where}. W aplikacji Ariadne przenies albo usun duplikat, zeby zostal jeden.`,
  );
}

// Every read of a node returns this shape. Listed column by column so the 768
// floats of the embedding never travel to a client that has no use for them.
const NODE_COLUMNS = {
  id: nodes.id,
  type: nodes.type,
  content: nodes.content,
  summary: nodes.summary,
  conflictsWith: nodes.conflictsWith,
  status: nodes.status,
  source: nodes.source,
  supersededBy: nodes.supersededBy,
  confirmedAt: nodes.confirmedAt,
  createdAt: nodes.createdAt,
  updatedAt: nodes.updatedAt,
};

// The users table is joined twice on a node (who wrote it, who confirmed it),
// so the second one needs a name of its own.
const confirmer = alias(users, "confirmer");
const taskCreator = alias(users, "task_creator");
const taskCompleter = alias(users, "task_completer");
const taskEventActor = alias(users, "task_event_actor");

/**
 * The entries a row says it clashes with, as text a screen can show. A second
 * query for the same reason anchors get one, and scoped to what the reader may
 * see anyway.
 *
 * Ids pointing at an entry that has since been archived or contradicted are
 * dropped rather than shown: the clash is over, one side simply lost it
 * somewhere else.
 */
export async function conflictsOf(userId: string, ids: string[]): Promise<ConflictEntry[]> {
  if (!ids.length) return [];
  return db
    .select({
      id: nodes.id,
      type: nodes.type,
      content: nodes.content,
      summary: nodes.summary,
      status: nodes.status,
      createdAt: nodes.createdAt,
    })
    .from(nodes)
    .where(
      and(
        inArray(nodes.id, ids),
        inArray(nodes.workspaceId, reachableWorkspaces(userId)),
        inArray(nodes.status, ["proposed", "confirmed"]),
      ),
    );
}

async function attachConflicts<T extends { conflictsWith: string[] }>(
  userId: string,
  rows: T[],
): Promise<(T & { conflicts: ConflictEntry[] })[]> {
  const found = await conflictsOf(userId, [...new Set(rows.flatMap((row) => row.conflictsWith))]);
  const byId = new Map(found.map((row) => [row.id, row]));
  return rows.map((row) => ({
    ...row,
    conflicts: row.conflictsWith.map((id) => byId.get(id)).filter(Boolean) as ConflictEntry[],
  }));
}

export type ConflictEntry = {
  id: string;
  type: string;
  content: string;
  summary: string;
  status: string;
  createdAt: Date;
};

// Anchors arrive in a second query instead of a join: a node can carry several,
// and a join would repeat the node row per anchor for every caller to regroup.
async function attachAnchors<T extends { id: string }>(rows: T[]) {
  const anchorRows = rows.length
    ? await db
        .select()
        .from(codeAnchors)
        .where(inArray(codeAnchors.nodeId, rows.map((r) => r.id)))
    : [];
  return rows.map((row) => ({
    ...row,
    anchors: anchorRows
      .filter((a) => a.nodeId === row.id)
      .map(({ path, symbol, sha }) => ({ path, symbol, sha })),
  }));
}

// How many each arm brings back before they are merged. Larger than any k a
// caller may ask for, because a merge over two lists of five is barely a merge:
// the overlap decides everything and there is nothing underneath it to promote.
const SEARCH_CANDIDATES = 20;

// The 60 of Reciprocal Rank Fusion, from the paper that named it. It flattens
// the top of the curve: without it first place would be worth twice second, and
// one arm's confident wrong answer would outweigh both arms agreeing on the
// right one a little lower down.
const RRF_DAMPING = 60;

/**
 * The names in a question that are recognisable by shape alone.
 *
 * Free, deterministic, and permanently correct for anything written the way code
 * is written. It is also, since the model that used to read the query beside it
 * was removed, the whole of the lexical arm: what shape does not give away -
 * that Hono is a library, that React Flow is two words and one name - is no
 * longer found at all, and that is the accepted half of the trade.
 *
 * Five tests and no more. A sixth, for a capitalised word mid-sentence, is the
 * tempting one and it is where this stops paying: it would take Hono and it
 * would equally take Ariadne and Postgres, which are in every entry and narrow
 * nothing. The right answer to wanting those names back is the model, measured
 * against its half second again, not a rule list maintained against a language.
 */
function literalsByShape(query: string): string[] {
  return query
    .split(/\s+/)
    // Sentence punctuation off the edges, so "service.ts." loses its full stop
    // and (normalizeRepoRef) loses its brackets. A leading dot is spared on the
    // way in, because dotfiles are half the configuration in a repository and
    // .env stripped down to env is a different word.
    .map((token) => token.replace(/^[^\w/.]+|[^\w/]+$/g, ""))
    .filter(
      (token) =>
        /[_/]/.test(token) || // snake_case, a path
        /[a-z][A-Z]/.test(token) || // camelCase
        /\.[a-z]{2,4}$/.test(token) || // a file
        /^[0-9a-f]{7,40}$/.test(token), // a commit
    );
}

/**
 * Two ranked lists into one, by position and never by score.
 *
 * The scores cannot be compared and no weighting fixes that: one arm answers in
 * cosine similarity, bounded and clustered near the top, the other in ts_rank_cd,
 * unbounded and calibrated against nothing. Position is the one thing both lists
 * mean the same way. An entry both arms rank highly beats an entry either one
 * loves alone, which is the whole point of asking twice.
 */
function fuseByRank<T extends { id: string }>(...ranked: T[][]): T[] {
  const fused = new Map<string, { row: T; score: number }>();
  for (const list of ranked) {
    list.forEach((row, position) => {
      const score = 1 / (RRF_DAMPING + position + 1);
      const seen = fused.get(row.id);
      if (seen) seen.score += score;
      else fused.set(row.id, { row, score });
    });
  }
  return [...fused.values()].sort((a, b) => b.score - a.score).map((entry) => entry.row);
}

/**
 * Search over one project's archive, by meaning and by name at once.
 *
 * Two arms because they fail at opposite things. Vectors read meaning and blur
 * identity: normalizeRepoRef reaches them as roughly "something about tidying a
 * repository address", so a note that never says the name scores level with the
 * one that does. Literal matching is the mirror image - it will never confuse
 * those two and it cannot see that "which ORM" and "we picked Drizzle" are the
 * same question. Neither is a better search; each covers the other's hole.
 *
 * A question naming nothing skips the second arm entirely and this is exactly
 * the search it has always been.
 *
 * `channel` says who is asking, and it changes what comes back. Not a filter for
 * tidiness: a coder reading its own unapproved proposals is the approval screen
 * being decorative, since whatever it wrote a minute ago comes back as settled
 * project knowledge in the next breath. Required rather than defaulted, so a new
 * call site has to say which side it is on instead of inheriting the loose one.
 */
export async function searchNodes(input: {
  userId: string;
  projectId: string;
  query: string;
  k?: number;
  channel: "coder" | "app";
  /**
   * Which halves to ask. Both by default, which is the search itself. A single
   * arm exists so scripts/eval-search.ts can measure what each one contributes
   * against the same corpus, a number no amount of reading the code produces.
   */
  arms?: ("vector" | "lexical")[];
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
  // Checked rather than left to the scope filter, which would answer a search of
  // someone else's project with an empty list - the one result a client cannot
  // tell apart from "nothing recorded yet".
  const workspaceId = await workspaceOfProject(input.userId, input.projectId);

  const arms = input.arms ?? ["vector", "lexical"];
  const key = await geminiKey(input.userId);
  // The vector is fetched even when its arm is off: the similarity column is
  // part of what a result is, and a caller asking only by name still gets told
  // how close each row landed.
  const queryVector = await embed(key, input.query, "RETRIEVAL_QUERY");

  // One reading of the query, by shape, and it costs nothing. A model used to
  // read it a second time and catch the names no shape gives away - React Flow,
  // CORS, RLS - which is real and was measured: eval/results.md has it lifting
  // recall@1 on questions that name something from 77% to 91%. It also put half
  // a second on every search, including the four in five that name nothing at
  // all and got nothing back for the wait. The archive this searches is full of
  // snake_case and paths, so the regex already answers most of it, and the trade
  // was refused deliberately. docs/rag-case-study.md is the whole argument.
  const literals = arms.includes("lexical") ? literalsByShape(input.query) : [];

  const distance = cosineDistance(nodes.embedding, queryVector);
  const toCoder = input.channel === "coder";

  // Metadata filters BEFORE similarity: they narrow, vectors rank (plan section 7).
  // Held in a variable rather than written inline, because both arms are scoped
  // by the same rule and a second copy of it is a second place to forget.
  const filters = [
    eq(nodes.workspaceId, workspaceId),
    eq(nodes.projectId, input.projectId),
    ne(nodes.status, "archived"),
    // Everything a coder gets back has been through a person, either because
    // someone approved it or because the account turned that requirement off
    // and its entries are written settled.
    toCoder ? eq(nodes.status, "confirmed") : undefined,
    // A session summary is a note about a working session, useful to a person
    // asking what happened last week and noise to a coder asking which ORM
    // this project uses. The boot index already leaves them out; this is the
    // same rule, applied where it was missed.
    toCoder ? inArray(nodes.type, ["decision", "note"]) : undefined,
  ];

  const columns = {
    id: nodes.id,
    type: nodes.type,
    content: nodes.content,
    // What a citation under an answer is labelled with: ten words beat the
    // first 140 characters of a paragraph for saying which entry this is.
    summary: nodes.summary,
    status: nodes.status,
    source: nodes.source,
    createdAt: nodes.createdAt,
    // An address is for the person reading the review screen, who knows their
    // teammates. A coder has no use for one and every result it reads becomes
    // part of a prompt, so the team's addresses stay out of it.
    author: toCoder ? sql<null>`null` : users.email,
    // Carried by both arms, so a row found by name still answers "how close is
    // this" the way the screen and the API have always been told it would.
    similarity: sql<number>`1 - (${distance})`,
  };

  const byMeaning = arms.includes("vector")
    ? await db
        .select(columns)
        .from(nodes)
        // Left, not inner: an entry whose author closed their account is still
        // part of the archive, and an inner join would quietly drop it from
        // every search.
        .leftJoin(users, eq(users.id, nodes.authorId))
        .where(and(...filters))
        .orderBy(distance)
        .limit(SEARCH_CANDIDATES)
    : [];

  // OR, not AND: one name the model got wrong would take an AND query to zero
  // and lose the arm, where under OR it simply matches nothing and the names
  // that were right still rank. Safe because only proper names are ever in
  // here, and a proper name is rare enough to carry a row on its own - which is
  // also how this sidesteps Postgres full-text search having no notion of how
  // rare a word is.
  //
  // websearch_to_tsquery and not to_tsquery: it is the only one of the family
  // that cannot raise a syntax error, and a name is free to contain a colon or
  // an ampersand, which to_tsquery would read as operators.
  //
  // ponytail: the default parser keeps backend/src/service.ts as one token, so
  // a question naming only service.ts does not reach it. The cure is a second
  // shape of the column, not a cleverer query.
  const tsquery = sql`websearch_to_tsquery('simple', ${literals.join(" OR ")})`;
  const byName = literals.length
    ? await db
        .select(columns)
        .from(nodes)
        .leftJoin(users, eq(users.id, nodes.authorId))
        .where(and(...filters, sql`"nodes"."search_text" @@ ${tsquery}`))
        .orderBy(desc(sql`ts_rank_cd("nodes"."search_text", ${tsquery})`))
        .limit(SEARCH_CANDIDATES)
    : [];

  // Anchors after the cut, not before: they are a second query and there is no
  // reason to run it over forty rows to keep five.
  return attachAnchors(fuseByRank(byMeaning, byName).slice(0, k));
}

// Everything recorded in one project, newest first, for the screens that list
// rather than search. Filtering and paging happen in Postgres: a review queue of
// forty is not the ceiling, and a client-side filter would fetch it all anyway.
export async function listNodes(input: {
  userId: string;
  projectId: string;
  status?: NodeStatus;
  type?: NodeType;
  file?: string;
  cursor?: string;
  limit?: number;
  /**
   * 'created' is the reading order: newest thought first. 'updated' answers a
   * different question, "what has been touched lately", which an entry written
   * a month ago and corrected yesterday only appears in under this order.
   * Paging stays on created, so this is a first-page-only sort.
   */
  sort?: "created" | "updated";
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.projectId, "projectId");
  if (input.status && !NODE_STATUSES.includes(input.status)) {
    throw new ServiceError("validation", `status must be one of: ${NODE_STATUSES.join(", ")}`);
  }
  if (input.type && !NODE_TYPES.includes(input.type)) {
    throw new ServiceError("validation", `type must be one of: ${NODE_TYPES.join(", ")}`);
  }
  const limit = input.limit ?? LIST_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
    throw new ServiceError("validation", `limit must be an integer between 1 and ${MAX_LIST_LIMIT}`);
  }
  const workspaceId = await workspaceOfProject(input.userId, input.projectId);

  const filters = [
    eq(nodes.workspaceId, workspaceId),
    eq(nodes.projectId, input.projectId),
    // Archived nodes are out of the default view for the reason they are out of
    // search: they were taken back. Asking for them by name still works.
    input.status ? eq(nodes.status, input.status) : ne(nodes.status, "archived"),
  ];
  if (input.type) filters.push(eq(nodes.type, input.type));
  if (input.file) {
    filters.push(
      inArray(
        nodes.id,
        db
          .select({ nodeId: codeAnchors.nodeId })
          .from(codeAnchors)
          .where(eq(codeAnchors.path, input.file)),
      ),
    );
  }
  if (input.cursor) filters.push(afterCursor(input.cursor));

  // The cursor is built from createdAt, so paging and 'updated' cannot be mixed:
  // rejected here rather than silently returning a window that skips rows.
  if (input.cursor && input.sort === "updated") {
    throw new ServiceError("validation", "sort=updated cannot be paged; it has no cursor");
  }

  const rows = await db
    .select({ ...NODE_COLUMNS, author: users.email, confirmedBy: confirmer.email })
    .from(nodes)
    // Both left: an entry outlives the account that wrote or settled it.
    .leftJoin(users, eq(users.id, nodes.authorId))
    .leftJoin(confirmer, eq(confirmer.id, nodes.confirmedBy))
    .where(and(...filters))
    // id breaks ties: two nodes written in the same millisecond would otherwise
    // come back in an arbitrary order and the cursor could skip or repeat one.
    .orderBy(
      input.sort === "updated" ? desc(nodes.updatedAt) : desc(nodes.createdAt),
      desc(nodes.id),
    )
    .limit(limit + 1); // one extra row answers "is there a next page" without a count

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  // No cursor under sort=updated: it encodes createdAt, so handing one out here
  // would produce a token that pages through a different ordering than the one
  // it came from.
  const pageable = input.sort !== "updated" && rows.length > limit && last;
  return {
    nodes: await attachAnchors(page),
    nextCursor: pageable && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
  };
}

// Keyset, not an offset: rows written while the user pages do not shift the
// window, so nothing is skipped or shown twice.
function afterCursor(cursor: string) {
  const [createdAt, id] = cursor.split("|");
  if (!id || Number.isNaN(Date.parse(createdAt ?? ""))) {
    throw new ServiceError("validation", "cursor is not one this endpoint handed out");
  }
  assertUuid(id, "cursor");
  return sql`(${nodes.createdAt}, ${nodes.id}) < (${createdAt}::timestamptz, ${id}::uuid)`;
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
export async function getBootContext(input: {
  userId: string;
  repoRef: string;
  tokenId?: string;
}) {
  assertUuid(input.userId, "userId");
  // The repository address picks the project, and the project carries the
  // archive. Nothing below reads a workspace off the caller any more.
  const project = await resolveProjectByRepoRef(input);
  const workspaceId = project.workspaceId;

  const [user] = await db
    .select({ profile: users.profile })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!user) throw noSuchAccount();

  const [lastSummary] = await db
    .select({ content: nodes.content, createdAt: nodes.createdAt, author: users.email })
    .from(nodes)
    .leftJoin(users, eq(users.id, nodes.authorId))
    .where(
      and(
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.projectId, project.id),
        eq(nodes.type, "session_summary"),
        ne(nodes.status, "archived"),
      ),
    )
    .orderBy(desc(nodes.createdAt))
    .limit(1);

  // What counts as "recorded here", asked three ways below: the newest headlines,
  // how many there are in total, and which files they are about.
  //
  // Contradicted ones are out too, not just archived: a headline carries no
  // status, so a superseded one would read as current and get acted on without
  // ever being opened. Its replacement is in the index anyway.
  const recorded = and(
    eq(nodes.workspaceId, workspaceId),
    eq(nodes.projectId, project.id),
    inArray(nodes.type, ["decision", "note"]),
    // Confirmed only. This used to include proposals, which meant a coder opened
    // every session already believing whatever the last one wrote, before anyone
    // had looked at it - and a headline carries no status, so there was nothing
    // in the payload to tell it apart from a settled decision.
    eq(nodes.status, "confirmed"),
  );

  // Without this the graph is invisible: the boot payload looks complete, so the
  // coder never calls search_context and answers from the code instead.
  //
  // The count rides along on the same statement. It is what stops ten headlines
  // from reading as the whole archive once there are two hundred entries, which
  // is the failure the ten were supposed to fix in the first place.
  const headlines = await db
    .select({
      node_id: nodes.id,
      type: nodes.type,
      content: nodes.content,
      // Who recorded it. In a shared archive this is the difference between "I
      // decided that" and "someone else decided that and I am about to undo it".
      author: users.email,
      total: sql<number>`count(*) over ()`.mapWith(Number),
    })
    .from(nodes)
    .leftJoin(users, eq(users.id, nodes.authorId))
    .where(recorded)
    .orderBy(desc(nodes.createdAt))
    .limit(INDEX_SIZE);

  // The part that survives growth. Headlines go stale as a sample the moment the
  // archive outgrows the limit, but "we have four entries about service.ts" stays
  // true at any size, and it is the question a coder is about to answer anyway:
  // it opens a file, sees the file named here, and searches before editing.
  //
  // Ordered by weight, then by path so that equal counts do not shuffle between
  // sessions. A list rather than an object, because the order is the point.
  const byFile = await db
    .select({ path: codeAnchors.path, entries: countDistinct(nodes.id) })
    .from(codeAnchors)
    .innerJoin(nodes, eq(nodes.id, codeAnchors.nodeId))
    .where(recorded)
    .groupBy(codeAnchors.path)
    .orderBy(desc(countDistinct(nodes.id)), codeAnchors.path)
    .limit(BY_FILE_SIZE);

  const taskSummary = await taskBootSummary({ userId: input.userId, projectId: project.id });

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
    // Headlines only, and an honest account of what they are a sample of. The
    // coder reads a relevant one, or sees a file it is about to touch named in
    // by_file, and calls search_context for the entry itself.
    index: {
      total: headlines[0]?.total ?? 0,
      showing: headlines.length,
      by_file: byFile,
      headlines: headlines.map(({ node_id, type, content }) => ({
        node_id,
        type,
        headline: headline(content),
      })),
    },
    tasks: taskSummary,
  };
}

// --- Node lifecycle (plan section 4) ---

export type RequestedBy = "coder" | "app_agent";
type UpdatePayload = { content?: string; anchors?: Anchor[] };

async function workspaceOfNode(userId: string, nodeId: string): Promise<string> {
  assertUuid(userId, "userId");
  assertUuid(nodeId, "nodeId");
  const [node] = await db
    .select({ workspaceId: nodes.workspaceId })
    .from(nodes)
    .innerJoin(memberships, eq(memberships.workspaceId, nodes.workspaceId))
    .where(and(eq(nodes.id, nodeId), eq(memberships.userId, userId)));
  if (!node) throw new ServiceError("not_found", "node not found for this user");
  return node.workspaceId;
}

async function hasAllPermission(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ allPermission: users.allPermission })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw noSuchAccount();
  return user.allPermission;
}

// Applies an update to a node's content and/or anchors. Content change
// recomputes the embedding - otherwise RAG keeps searching stale meaning - and
// the summary with it, or the card would keep leading with a line about text
// that is no longer there.
// The workspace is passed in rather than assumed from an earlier check: this is
// the statement that actually writes, so it carries the tenant itself. The
// account whose key pays comes in the same way, for the same reason.
async function applyNodeUpdate(
  userId: string,
  workspaceId: string,
  nodeId: string,
  payload: UpdatePayload,
  editedVia?: SourceMeta["channel"],
) {
  // Both payload halves are checked before the embedding call: a bad anchor found
  // afterwards would roll the transaction back having already paid for a vector.
  if (payload.anchors) assertAnchors(payload.anchors);
  const updates: Partial<typeof nodes.$inferInsert> = { updatedAt: new Date() };
  if (payload.content !== undefined) {
    const content = validateContent(payload.content);
    const key = await geminiKey(userId);
    const [embedding, summary] = await Promise.all([
      embed(key, content, "RETRIEVAL_DOCUMENT"),
      summarizeOrNothing(key, content),
    ]);
    updates.content = content;
    updates.embedding = embedding;
    updates.summary = summary;
  }
  // Merged into source rather than given a column: it is provenance, same as the
  // channel the node arrived through, and updated_at already carries the when.
  const stamped = editedVia
    ? {
        ...updates,
        source: sql`${nodes.source} || ${JSON.stringify({ edited_via: editedVia })}::jsonb`,
      }
    : updates;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(nodes)
      .set(stamped)
      .where(and(eq(nodes.id, nodeId), eq(nodes.workspaceId, workspaceId)))
      .returning(NODE_COLUMNS);
    if (!row) throw new ServiceError("not_found", "node not found in this workspace");
    if (payload.anchors) {
      await tx.delete(codeAnchors).where(eq(codeAnchors.nodeId, nodeId));
      if (payload.anchors.length) {
        await tx.insert(codeAnchors).values(
          payload.anchors.map((a) => ({ nodeId, path: a.path, symbol: a.symbol, sha: a.sha })),
        );
      }
    }
    return row;
  });
}

async function archiveNodeById(workspaceId: string, nodeId: string) {
  const [archived] = await db
    .update(nodes)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(nodes.id, nodeId), eq(nodes.workspaceId, workspaceId)))
    .returning({ id: nodes.id });
  if (!archived) throw new ServiceError("not_found", "node not found in this workspace");
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
  const workspaceId = await workspaceOfNode(input.userId, input.nodeId);

  const payload: UpdatePayload = { content: input.content, anchors: input.anchors };
  // Same rule as a new entry written here: the queue is for what a coder does
  // unattended, and "app_agent" is this app rewording a sentence its owner just
  // typed and read back on screen.
  if (input.requestedBy === "app_agent" || (await hasAllPermission(input.userId))) {
    await applyNodeUpdate(input.userId, workspaceId, input.nodeId, payload);
    return { applied: true };
  }
  const [pending] = await db
    .insert(pendingActions)
    .values({
      workspaceId,
      requestedByUserId: input.userId,
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
  const workspaceId = await workspaceOfNode(input.userId, input.nodeId);

  // As above: asked for from inside the app, it happens now.
  if (input.requestedBy === "app_agent" || (await hasAllPermission(input.userId))) {
    await archiveNodeById(workspaceId, input.nodeId); // never a physical DELETE
    return { applied: true };
  }
  const [pending] = await db
    .insert(pendingActions)
    .values({
      workspaceId,
      requestedByUserId: input.userId,
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
    .select({
      id: pendingActions.id,
      action: pendingActions.action,
      payload: pendingActions.payload,
      nodeId: pendingActions.nodeId,
      workspaceId: pendingActions.workspaceId,
    })
    .from(pendingActions)
    .innerJoin(memberships, eq(memberships.workspaceId, pendingActions.workspaceId))
    .where(
      and(
        eq(pendingActions.id, input.pendingActionId),
        eq(memberships.userId, input.userId),
        eq(pendingActions.status, "pending"),
      ),
    );
  if (!pending) throw new ServiceError("not_found", "pending action not found");

  // Both writes below carry pending.workspaceId, so a queue entry pointing at a
  // node in another workspace fails as not_found instead of editing it. Nothing
  // else compares the two tables.
  //
  // ponytail: apply-then-flip is not atomic; two concurrent approves can
  // double-apply. Fine for a queue a person clicks through; add a conditional
  // status flip if two members ever race on the same entry.
  if (pending.action === "update") {
    // The key belongs to whoever approves, not to whoever asked: the approver is
    // the one present, and the requester may be an agent whose account is gone.
    await applyNodeUpdate(
      input.userId,
      pending.workspaceId,
      pending.nodeId,
      pending.payload as UpdatePayload,
    );
  } else {
    await archiveNodeById(pending.workspaceId, pending.nodeId);
  }
  await db
    .update(pendingActions)
    .set({ status: "approved", resolvedAt: new Date(), resolvedBy: input.userId })
    .where(eq(pendingActions.id, pending.id));
}

export async function rejectPending(input: { userId: string; pendingActionId: string }) {
  assertUuid(input.userId, "userId");
  assertUuid(input.pendingActionId, "pendingActionId");
  const [rejected] = await db
    .update(pendingActions)
    .set({ status: "rejected", resolvedAt: new Date(), resolvedBy: input.userId })
    // A subquery rather than a join: the check and the write stay one statement,
    // so two members rejecting at once cannot both win.
    .where(
      and(
        eq(pendingActions.id, input.pendingActionId),
        inArray(pendingActions.workspaceId, reachableWorkspaces(input.userId)),
        eq(pendingActions.status, "pending"),
      ),
    )
    .returning({ id: pendingActions.id });
  if (!rejected) throw new ServiceError("not_found", "pending action not found");
}

// Anyone in the workspace may confirm, and the entry records who did. Without
// the signature "confirmed" in a team says only that somebody, once, agreed.
export async function confirmNode(input: { userId: string; nodeId: string }) {
  const workspaceId = await workspaceOfNode(input.userId, input.nodeId);
  const [confirmed] = await db
    .update(nodes)
    .set({
      status: "confirmed",
      confirmedBy: input.userId,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(nodes.id, input.nodeId),
        eq(nodes.workspaceId, workspaceId),
        eq(nodes.status, "proposed"), // only proposed can be confirmed (plan section 4)
      ),
    )
    .returning({ id: nodes.id });
  if (!confirmed) {
    throw new ServiceError("validation", "only a node with status proposed can be confirmed");
  }
}

/** Which of the two entries a person decided to keep, or neither answer. */
export type ConflictVerdict = "new" | "old" | "both";

/**
 * Settles one suspected clash between two entries. Three answers and no fourth:
 * the new one wins, the old one wins, or the model was wrong and both stand.
 *
 * The losing entry is contradicted rather than deleted, and it keeps a link to
 * the one that beat it. That is the difference between an archive that forgot
 * and an archive that changed its mind: "we no longer do X, we do Y" is the
 * sentence somebody will need in six months.
 */
export async function resolveConflict(input: {
  userId: string;
  nodeId: string;
  otherId: string;
  verdict: ConflictVerdict;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.nodeId, "nodeId");
  assertUuid(input.otherId, "otherId");
  if (input.nodeId === input.otherId) {
    throw new ServiceError("validation", "an entry cannot conflict with itself");
  }
  const workspaceId = await workspaceOfNode(input.userId, input.nodeId);

  if (input.verdict === "new") {
    await contradictNode({
      userId: input.userId,
      nodeId: input.otherId,
      supersededBy: input.nodeId,
    });
  }
  if (input.verdict === "old") {
    await contradictNode({
      userId: input.userId,
      nodeId: input.nodeId,
      supersededBy: input.otherId,
    });
  }

  // The pair is settled whichever way it went, so the suspicion goes - from
  // both entries, because either one may be carrying it. Left behind, the
  // screens would keep asking a question that has been answered.
  await Promise.all(
    [input.nodeId, input.otherId].map((id, i) =>
      db
        .update(nodes)
        .set({
          conflictsWith: sql`array_remove(${nodes.conflictsWith}, ${i === 0 ? input.otherId : input.nodeId}::uuid)`,
        })
        .where(and(eq(nodes.id, id), eq(nodes.workspaceId, workspaceId))),
    ),
  );
}

export async function archiveNode(input: { userId: string; nodeId: string }) {
  const workspaceId = await workspaceOfNode(input.userId, input.nodeId);
  await archiveNodeById(workspaceId, input.nodeId);
}

// The app's own edit, applied on the spot rather than queued. The pending queue
// exists because a coder writes unattended; the person clicking in the app is the
// one who would have approved it anyway.
export async function editNode(input: {
  userId: string;
  nodeId: string;
  content?: string;
  anchors?: Anchor[];
}) {
  if (input.content === undefined && input.anchors === undefined) {
    throw new ServiceError("validation", "nothing to update: provide content and/or anchors");
  }
  const workspaceId = await workspaceOfNode(input.userId, input.nodeId);
  const row = await applyNodeUpdate(
    input.userId,
    workspaceId,
    input.nodeId,
    { content: input.content, anchors: input.anchors },
    "app_form",
  );
  const [edited] = await attachAnchors([row]);
  return edited;
}

// proposed | confirmed -> contradicted (plan section 4), with the node that
// overruled it. Archiving is the other way out, for a node that is simply gone;
// this one is for a node that was answered, so the answer travels with it.
export async function contradictNode(input: {
  userId: string;
  nodeId: string;
  supersededBy: string;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.nodeId, "nodeId");
  assertUuid(input.supersededBy, "supersededBy");
  if (input.nodeId === input.supersededBy) {
    throw new ServiceError("validation", "a node cannot supersede itself");
  }

  const workspaceId = await workspaceOfNode(input.userId, input.nodeId);
  const [[target], [superseder]] = await Promise.all([
    db
      .select({ status: nodes.status, projectId: nodes.projectId })
      .from(nodes)
      .where(and(eq(nodes.id, input.nodeId), eq(nodes.workspaceId, workspaceId))),
    db
      .select({ projectId: nodes.projectId })
      .from(nodes)
      .where(and(eq(nodes.id, input.supersededBy), eq(nodes.workspaceId, workspaceId))),
  ]);
  if (!target) throw new ServiceError("not_found", "node not found for this user");
  if (!superseder) {
    throw new ServiceError("not_found", "supersededBy node not found for this user");
  }
  // Both in one project, otherwise the screen showing the pair has nowhere to
  // show the second one and the reference reads as a dead link.
  if (target.projectId !== superseder.projectId) {
    throw new ServiceError("validation", "both nodes must belong to the same project");
  }
  if (target.status !== "proposed" && target.status !== "confirmed") {
    throw new ServiceError("validation", "only a proposed or confirmed node can be contradicted");
  }

  await db
    .update(nodes)
    .set({ status: "contradicted", supersededBy: input.supersededBy, updatedAt: new Date() })
    .where(and(eq(nodes.id, input.nodeId), eq(nodes.workspaceId, workspaceId)));
}

// --- Tasks: shared operational state ---

export type TaskStatus = "backlog" | "todo" | "in_progress" | "blocked" | "done" | "archived";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskSource = {
  channel: "app_form" | "coder";
  client?: string;
  session_id?: string;
  commit_sha?: string;
  token_id?: string;
};

export type TaskPatch = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  blockedReason?: string | null;
  relatedMemoryIds?: string[];
};

const TASK_STATUSES = ["backlog", "todo", "in_progress", "blocked", "done", "archived"] as const;
const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
const TASK_ACTIVE_STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "blocked"];
const TASK_LIST_LIMIT = 50;
const TASK_MAX_LIST_LIMIT = 100;
const TASK_TITLE_LENGTH = 160;
const TASK_BOOT_ITEMS = 4;

const TASK_COLUMNS = {
  id: tasks.id,
  workspaceId: tasks.workspaceId,
  projectId: tasks.projectId,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  blockedReason: tasks.blockedReason,
  source: tasks.source,
  revision: tasks.revision,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  completedAt: tasks.completedAt,
  createdBy: taskCreator.email,
  completedBy: taskCompleter.email,
};

function assertTaskStatus(status: string): asserts status is TaskStatus {
  if (!TASK_STATUSES.includes(status as TaskStatus)) {
    throw new ServiceError("validation", `status must be one of: ${TASK_STATUSES.join(", ")}`);
  }
}

function assertTaskPriority(priority: string): asserts priority is TaskPriority {
  if (!TASK_PRIORITIES.includes(priority as TaskPriority)) {
    throw new ServiceError("validation", `priority must be one of: ${TASK_PRIORITIES.join(", ")}`);
  }
}

function validateTaskTitle(raw: string): string {
  const title = (raw ?? "").trim();
  if (!title) throw new ServiceError("validation", "title must not be empty");
  if (title.length > TASK_TITLE_LENGTH) {
    throw new ServiceError("validation", `title must be at most ${TASK_TITLE_LENGTH} characters`);
  }
  return title;
}

function validateOptionalTaskText(raw: string | null | undefined, field: string): string {
  const value = (raw ?? "").trim();
  if (value.length > MAX_CONTENT_LENGTH) {
    throw new ServiceError("validation", `${field} must be at most ${MAX_CONTENT_LENGTH} characters`);
  }
  return value;
}

function assertRevision(revision: number | undefined) {
  if (revision !== undefined && (!Number.isInteger(revision) || revision < 1)) {
    throw new ServiceError("validation", "revision must be a positive integer");
  }
}

function taskEventSource(input: TaskSource): TaskSource {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as TaskSource;
}

async function workspaceOfTask(userId: string, taskId: string): Promise<string> {
  assertUuid(userId, "userId");
  assertUuid(taskId, "taskId");
  const [task] = await db
    .select({ workspaceId: tasks.workspaceId })
    .from(tasks)
    .innerJoin(memberships, eq(memberships.workspaceId, tasks.workspaceId))
    .where(and(eq(tasks.id, taskId), eq(memberships.userId, userId)));
  if (!task) throw new ServiceError("not_found", "task not found for this user");
  return task.workspaceId;
}

async function assertTaskMemoryLinks(input: {
  userId: string;
  workspaceId: string;
  projectId: string;
  relatedMemoryIds: string[];
}) {
  const ids = [...new Set(input.relatedMemoryIds)];
  for (const id of ids) assertUuid(id, "relatedMemoryIds");
  if (!ids.length) return ids;

  const found = await db
    .select({ id: nodes.id })
    .from(nodes)
    .where(
      and(
        inArray(nodes.id, ids),
        eq(nodes.workspaceId, input.workspaceId),
        eq(nodes.projectId, input.projectId),
        inArray(nodes.workspaceId, reachableWorkspaces(input.userId)),
      ),
    );
  if (found.length !== ids.length) {
    throw new ServiceError("not_found", "one or more related memories were not found in this project");
  }
  return ids;
}

async function attachTaskMemoryIds<T extends { id: string }>(rows: T[]) {
  const links = rows.length
    ? await db
        .select({ taskId: taskMemoryLinks.taskId, nodeId: taskMemoryLinks.nodeId })
        .from(taskMemoryLinks)
        .where(inArray(taskMemoryLinks.taskId, rows.map((r) => r.id)))
    : [];
  return rows.map((row) => ({
    ...row,
    relatedMemoryIds: links.filter((link) => link.taskId === row.id).map((link) => link.nodeId),
  }));
}

async function readTaskRows(filters: SQLWrapper[], limit: number, cursor?: string) {
  const scoped = cursor ? [...filters, afterTaskCursor(cursor)] : filters;
  const rows = await db
    .select(TASK_COLUMNS)
    .from(tasks)
    .leftJoin(taskCreator, eq(taskCreator.id, tasks.createdBy))
    .leftJoin(taskCompleter, eq(taskCompleter.id, tasks.completedBy))
    .where(and(...scoped))
    .orderBy(
      sql`CASE ${tasks.status}
        WHEN 'blocked' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'todo' THEN CASE ${tasks.priority}
          WHEN 'critical' THEN 3
          WHEN 'high' THEN 4
          WHEN 'medium' THEN 5
          ELSE 6
        END
        WHEN 'backlog' THEN 7
        WHEN 'done' THEN 8
        ELSE 9
      END`,
      desc(tasks.updatedAt),
      desc(tasks.id),
    )
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    tasks: await attachTaskMemoryIds(page),
    nextCursor: rows.length > limit && last ? `${last.updatedAt.toISOString()}|${last.id}` : null,
  };
}

function afterTaskCursor(cursor: string) {
  const [updatedAt, id] = cursor.split("|");
  if (!id || Number.isNaN(Date.parse(updatedAt ?? ""))) {
    throw new ServiceError("validation", "cursor is not one this endpoint handed out");
  }
  assertUuid(id, "cursor");
  return sql`(${tasks.updatedAt}, ${tasks.id}) < (${updatedAt}::timestamptz, ${id}::uuid)`;
}

async function writeTaskEvent(input: {
  workspaceId: string;
  projectId: string;
  taskId: string;
  action: "created" | "updated" | "status_changed" | "archived" | "linked_memories";
  actorId: string;
  source: TaskSource;
  payload?: unknown;
}) {
  await db.insert(taskEvents).values({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    taskId: input.taskId,
    action: input.action,
    actorId: input.actorId,
    source: taskEventSource(input.source),
    payload: input.payload ?? {},
  });
}

export async function listTasks(input: {
  userId: string;
  projectId: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  creator?: string;
  active?: boolean;
  completed?: boolean;
  query?: string;
  cursor?: string;
  limit?: number;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.projectId, "projectId");
  if (input.status) assertTaskStatus(input.status);
  if (input.priority) assertTaskPriority(input.priority);
  if (input.creator) assertUuid(input.creator, "creator");
  const limit = input.limit ?? TASK_LIST_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > TASK_MAX_LIST_LIMIT) {
    throw new ServiceError("validation", `limit must be an integer between 1 and ${TASK_MAX_LIST_LIMIT}`);
  }
  const workspaceId = await workspaceOfProject(input.userId, input.projectId);
  const filters = [eq(tasks.workspaceId, workspaceId), eq(tasks.projectId, input.projectId)];
  if (input.status) filters.push(eq(tasks.status, input.status));
  else if (input.completed === true) filters.push(eq(tasks.status, "done"));
  else if (input.active === true || input.completed === false) {
    filters.push(inArray(tasks.status, TASK_ACTIVE_STATUSES));
  } else {
    filters.push(ne(tasks.status, "archived"));
  }
  if (input.priority) filters.push(eq(tasks.priority, input.priority));
  if (input.creator) filters.push(eq(tasks.createdBy, input.creator));
  const query = input.query?.trim();
  if (query) {
    const pattern = `%${query.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(sql`(${tasks.title} ILIKE ${pattern} ESCAPE '\' OR ${tasks.description} ILIKE ${pattern} ESCAPE '\')`);
  }
  return readTaskRows(filters, limit, input.cursor);
}

export async function getTask(input: { userId: string; taskId: string }) {
  assertUuid(input.userId, "userId");
  const workspaceId = await workspaceOfTask(input.userId, input.taskId);
  const [task] = await db
    .select(TASK_COLUMNS)
    .from(tasks)
    .leftJoin(taskCreator, eq(taskCreator.id, tasks.createdBy))
    .leftJoin(taskCompleter, eq(taskCompleter.id, tasks.completedBy))
    .where(and(eq(tasks.id, input.taskId), eq(tasks.workspaceId, workspaceId)));
  if (!task) throw new ServiceError("not_found", "task not found for this user");

  const links = await db
    .select({
      id: nodes.id,
      type: nodes.type,
      content: nodes.content,
      summary: nodes.summary,
      status: nodes.status,
      createdAt: nodes.createdAt,
    })
    .from(taskMemoryLinks)
    .innerJoin(nodes, eq(nodes.id, taskMemoryLinks.nodeId))
    .where(and(eq(taskMemoryLinks.taskId, input.taskId), eq(taskMemoryLinks.workspaceId, workspaceId)))
    .orderBy(desc(taskMemoryLinks.createdAt));

  const events = await db
    .select({
      id: taskEvents.id,
      action: taskEvents.action,
      actor: taskEventActor.email,
      source: taskEvents.source,
      payload: taskEvents.payload,
      createdAt: taskEvents.createdAt,
    })
    .from(taskEvents)
    .leftJoin(taskEventActor, eq(taskEventActor.id, taskEvents.actorId))
    .where(and(eq(taskEvents.taskId, input.taskId), eq(taskEvents.workspaceId, workspaceId)))
    .orderBy(desc(taskEvents.createdAt));

  return { ...(await attachTaskMemoryIds([task]))[0], relatedMemories: links, events };
}

export async function createTask(input: {
  userId: string;
  projectId: string;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  blockedReason?: string | null;
  relatedMemoryIds?: string[];
  source: TaskSource;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.projectId, "projectId");
  const title = validateTaskTitle(input.title);
  const description = validateOptionalTaskText(input.description, "description");
  const priority = input.priority ?? "medium";
  const status = input.status ?? "todo";
  assertTaskPriority(priority);
  assertTaskStatus(status);
  const blockedReason =
    status === "blocked" ? validateOptionalTaskText(input.blockedReason, "blockedReason") : null;
  if (status === "blocked" && !blockedReason) {
    throw new ServiceError("validation", "blockedReason is required when status is blocked");
  }
  const workspaceId = await workspaceOfProject(input.userId, input.projectId);
  const relatedMemoryIds = await assertTaskMemoryLinks({
    userId: input.userId,
    workspaceId,
    projectId: input.projectId,
    relatedMemoryIds: input.relatedMemoryIds ?? [],
  });

  const taskId = await db.transaction(async (tx) => {
    const now = new Date();
    const [created] = await tx
      .insert(tasks)
      .values({
        workspaceId,
        projectId: input.projectId,
        title,
        description,
        status,
        priority,
        blockedReason,
        createdBy: input.userId,
        completedBy: status === "done" ? input.userId : null,
        completedAt: status === "done" ? now : null,
        source: taskEventSource(input.source),
      })
      .returning({ id: tasks.id });

    if (relatedMemoryIds.length) {
      await tx.insert(taskMemoryLinks).values(
        relatedMemoryIds.map((nodeId) => ({
          taskId: created.id,
          nodeId,
          workspaceId,
          projectId: input.projectId,
        })),
      );
    }

    await tx.insert(taskEvents).values({
      workspaceId,
      projectId: input.projectId,
      taskId: created.id,
      action: "created",
      actorId: input.userId,
      source: taskEventSource(input.source),
      payload: { title, status, priority, relatedMemoryIds },
    });

    return created.id;
  });
  return getTask({ userId: input.userId, taskId });
}

export async function updateTask(input: {
  userId: string;
  taskId: string;
  patch: TaskPatch;
  revision?: number;
  source: TaskSource;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.taskId, "taskId");
  assertRevision(input.revision);
  const keys = Object.keys(input.patch);
  if (!keys.length) throw new ServiceError("validation", "nothing to update");

  const workspaceId = await workspaceOfTask(input.userId, input.taskId);
  const [current] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
      status: tasks.status,
      revision: tasks.revision,
      blockedReason: tasks.blockedReason,
      completedAt: tasks.completedAt,
    })
    .from(tasks)
    .where(and(eq(tasks.id, input.taskId), eq(tasks.workspaceId, workspaceId)));
  if (!current) throw new ServiceError("not_found", "task not found for this user");

  if (input.revision !== undefined && input.revision !== current.revision) {
    throw new ServiceError("conflict", "task has changed; reload it before saving");
  }

  const patch = input.patch;
  const updates: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  const changed: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    updates.title = validateTaskTitle(patch.title);
    changed.title = updates.title;
  }
  if (patch.description !== undefined) {
    updates.description = validateOptionalTaskText(patch.description, "description");
    changed.description = updates.description;
  }
  if (patch.priority !== undefined) {
    assertTaskPriority(patch.priority);
    updates.priority = patch.priority;
    changed.priority = patch.priority;
  }
  if (patch.status !== undefined) {
    assertTaskStatus(patch.status);
    updates.status = patch.status;
    changed.status = patch.status;
    if (patch.status === "done" && current.status !== "done") {
      updates.completedAt = new Date();
      updates.completedBy = input.userId;
      changed.completed = true;
    }
    if (current.status === "done" && patch.status !== "done") {
      updates.completedAt = null;
      updates.completedBy = null;
      changed.reopened = true;
    }
    if (patch.status !== "blocked") {
      updates.blockedReason = null;
    }
  }
  if (patch.blockedReason !== undefined) {
    updates.blockedReason = validateOptionalTaskText(patch.blockedReason, "blockedReason") || null;
    changed.blockedReason = updates.blockedReason;
  }

  const nextStatus = (updates.status ?? current.status) as TaskStatus;
  const nextBlockedReason =
    updates.blockedReason !== undefined ? updates.blockedReason : current.blockedReason;
  if (nextStatus === "blocked" && !nextBlockedReason) {
    throw new ServiceError("validation", "blockedReason is required when status is blocked");
  }

  const linked =
    patch.relatedMemoryIds === undefined
      ? undefined
      : await assertTaskMemoryLinks({
          userId: input.userId,
          workspaceId,
          projectId: current.projectId,
          relatedMemoryIds: patch.relatedMemoryIds,
        });

  const action =
    updates.status === "archived"
      ? "archived"
      : updates.status !== undefined
        ? "status_changed"
        : linked !== undefined
          ? "linked_memories"
          : "updated";

  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(tasks)
      .set({ ...updates, revision: sql`${tasks.revision} + 1` })
      .where(
        and(
          eq(tasks.id, input.taskId),
          eq(tasks.workspaceId, workspaceId),
          input.revision === undefined ? undefined : eq(tasks.revision, input.revision),
        ),
      )
      .returning({ id: tasks.id });
    if (!updated) throw new ServiceError("conflict", "task has changed; reload it before saving");

    if (linked !== undefined) {
      await tx.delete(taskMemoryLinks).where(eq(taskMemoryLinks.taskId, input.taskId));
      if (linked.length) {
        await tx.insert(taskMemoryLinks).values(
          linked.map((nodeId) => ({
            taskId: input.taskId,
            nodeId,
            workspaceId,
            projectId: current.projectId,
          })),
        );
      }
      changed.relatedMemoryIds = linked;
    }

    await tx.insert(taskEvents).values({
      workspaceId,
      projectId: current.projectId,
      taskId: input.taskId,
      action,
      actorId: input.userId,
      source: taskEventSource(input.source),
      payload: changed,
    });
  });
  return getTask({ userId: input.userId, taskId: input.taskId });
}

export async function taskBootSummary(input: { userId: string; projectId: string }) {
  const workspaceId = await workspaceOfProject(input.userId, input.projectId);
  const activeFilters = [
    eq(tasks.workspaceId, workspaceId),
    eq(tasks.projectId, input.projectId),
    inArray(tasks.status, TASK_ACTIVE_STATUSES),
  ];
  const counts = await db
    .select({ status: tasks.status, count: sql<number>`count(*)::int`.mapWith(Number) })
    .from(tasks)
    .where(and(...activeFilters))
    .groupBy(tasks.status);
  const important = await readTaskRows(activeFilters, TASK_BOOT_ITEMS);
  const totalActive = counts.reduce((sum, row) => sum + Number(row.count), 0);
  return {
    counts: Object.fromEntries(counts.map((row) => [row.status, row.count])),
    current: important.tasks.map((task) => ({
      task_id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      blocked_reason: task.blockedReason,
      updated_at: task.updatedAt,
    })),
    showing: important.tasks.length,
    total_active: totalActive,
    more_available: totalActive > important.tasks.length,
    tool: "get_tasks",
  };
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
  return db.transaction((tx) => openAccount(tx, email, passwordHash));
}

/**
 * An account and the private workspace that comes with it, in one transaction.
 * Both ways in need this - the form and the two providers - and a second copy is
 * how one of them ends up with a user who belongs to no workspace at all.
 *
 * passwordHash is null for an account that arrived through a provider: there is
 * no password to hash and nothing for login() to accept until someone sets one.
 */
async function openAccount(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  email: string,
  passwordHash: string | null,
): Promise<{ userId: string; workspaceId: string }> {
  const [user] = await tx
    .insert(users)
    .values({ email, passwordHash })
    // The caller's check races; this is what actually keeps the address unique.
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (!user) throw new ServiceError("validation", "email already registered");

  // A private workspace right away, so working alone is a workspace of one and
  // nothing downstream needs a branch for "no workspace yet". Named after the
  // address because there is nothing else to name it after at this point.
  const [workspace] = await tx
    .insert(workspaces)
    .values({ name: email, ownerId: user.id })
    .returning({ id: workspaces.id });
  await tx
    .insert(memberships)
    .values({ workspaceId: workspace.id, userId: user.id, role: "owner" });

  return { userId: user.id, workspaceId: workspace.id };
}

/**
 * Sign-in through Google or GitHub, from the identity the provider vouched for
 * (oauth.ts did the talking). Three cases, in the order they are tried:
 *
 * 1. This provider account is already known - the ordinary repeat sign-in.
 * 2. The address belongs to an existing account - link the provider to it, so
 *    "sign in with Google" on the address you registered with lands in your own
 *    archive rather than a second, empty one.
 * 3. Neither - open a new account with no password.
 *
 * Case 2 is the one with teeth. Linking on an unverified address would mean
 * anyone able to name your email at a provider that never checked it inherits
 * your archive, so an unverified address is refused rather than linked.
 */
export async function signInWithProvider(input: {
  provider: string;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
}): Promise<{ userId: string; created: boolean }> {
  const email = normalizeEmail(input.email);
  if (!EMAIL_RE.test(email)) {
    throw new ServiceError("validation", "the provider returned an address that is not an address");
  }

  const [known] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, input.provider),
        eq(oauthAccounts.providerUserId, input.providerUserId),
      ),
    );
  if (known) return { userId: known.userId, created: false };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    if (!input.emailVerified) {
      throw new ServiceError(
        "unauthorized",
        `an account already uses ${email}, and ${input.provider} has not confirmed that address belongs to you. Sign in with your password instead.`,
      );
    }
    await db
      .insert(oauthAccounts)
      .values({ provider: input.provider, providerUserId: input.providerUserId, userId: existing.id })
      // Two browser tabs finishing the same link at once: the row is already
      // there and says the same thing, which is not a failure.
      .onConflictDoNothing();
    return { userId: existing.id, created: false };
  }

  return db.transaction(async (tx) => {
    const { userId } = await openAccount(tx, email, null);
    await tx
      .insert(oauthAccounts)
      .values({ provider: input.provider, providerUserId: input.providerUserId, userId });
    return { userId, created: true };
  });
}

export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}) {
  assertUuid(input.userId, "userId");
  if ((input.newPassword ?? "").length < MIN_PASSWORD_LENGTH) {
    throw new ServiceError(
      "validation",
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!user) throw noSuchAccount();
  // Here, unlike login, the caller is already holding this account's token, so
  // there is nobody to leak anything to and the accurate message is the useful
  // one. Setting a first password from this screen would be a different feature:
  // it must not ask for a current one, and this route always does.
  if (!user.passwordHash) {
    throw new ServiceError(
      "validation",
      "this account signs in with Google or GitHub and has no password to change",
    );
  }
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new ServiceError("unauthorized", "current password is not correct");
  }
  // ponytail: tokens issued before the change keep working until they expire.
  // A denylist is the fix, and it is a table plus a check on every request for
  // one case; the 30 day ttl is the ceiling until sessions matter more.
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.newPassword) })
    .where(eq(users.id, input.userId));
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

// Counting failed attempts is the transport's job, not this one's: the limiter
// keyed by address sits on POST /auth/login in rest.ts, where there is a request
// to refuse. This function only ever answers whether the pair is correct.
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
  // An account that only ever arrived through a provider has no hash to check
  // against. Same message as a wrong password on purpose: "this address exists
  // but signs in with Google" is an answer to a question nobody authenticated
  // asked, and it tells a stranger which addresses are worth a phishing page.
  if (!user.passwordHash) throw rejected;
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
      geminiKey: users.geminiKey,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw noSuchAccount();
  // The key itself never leaves the server; whether there is a working one does.
  // "user" means one that still opens: a row sealed with a secret that has since
  // changed is as good as none, and saying otherwise would send someone hunting
  // for a fault in Google's console instead of pasting a new key.
  const source: GeminiKeySource = user.geminiKey && open(user.geminiKey) ? "user" : "none";
  // The hash itself must not leave the server; whether there is one must, or the
  // settings screen offers a "change password" form to an account that has none.
  const { geminiKey: _sealed, passwordHash, ...account } = user;
  return { ...account, geminiKey: source, hasPassword: !!passwordHash };
}

/**
 * Stores the person's own key, after proving it works. One embedding call of a
 * single word is the cheapest thing the API does, and it turns a pasted typo
 * into an error in the field where it was pasted - rather than into a chat that
 * mysteriously stops answering a week later.
 */
export async function setGeminiKey(input: { userId: string; key: string }) {
  assertUuid(input.userId, "userId");
  const key = input.key?.trim();
  if (!key) throw new ServiceError("validation", "key must not be empty");

  try {
    await embed(key, "ariadne", "RETRIEVAL_QUERY");
  } catch {
    throw new ServiceError("validation", "Google refused this key");
  }

  const [updated] = await db
    .update(users)
    .set({ geminiKey: seal(key) })
    .where(eq(users.id, input.userId))
    .returning({ id: users.id });
  if (!updated) throw noSuchAccount();
  return { geminiKey: "user" as GeminiKeySource };
}

export async function clearGeminiKey(userId: string) {
  assertUuid(userId, "userId");
  const [updated] = await db
    .update(users)
    .set({ geminiKey: null })
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  if (!updated) throw noSuchAccount();
  return { geminiKey: "none" as GeminiKeySource };
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
  if (!updated) throw noSuchAccount();
  return updated;
}

export async function setAllPermission(input: { userId: string; allPermission: boolean }) {
  assertUuid(input.userId, "userId");
  const [updated] = await db
    .update(users)
    .set({ allPermission: input.allPermission })
    .where(eq(users.id, input.userId))
    .returning({ allPermission: users.allPermission });
  if (!updated) throw noSuchAccount();
  return updated;
}

// --- Workspaces and invitations ---

// Where a project lands when the caller does not say. The private workspace made
// at registration is always the oldest membership, so this is that one until the
// person joins or creates another, and it stays that one afterwards.
async function defaultWorkspace(userId: string): Promise<string> {
  const [first] = await db
    .select({ id: memberships.workspaceId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .orderBy(memberships.createdAt)
    .limit(1);
  if (!first) throw new ServiceError("not_found", "user has no workspace");
  return first.id;
}

export async function listWorkspaces(userId: string) {
  assertUuid(userId, "userId");
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      role: memberships.role,
      isOwner: sql<boolean>`${workspaces.ownerId} = ${userId}`,
      memberCount: sql<number>`(
        SELECT count(*)::int FROM memberships m WHERE m.workspace_id = ${workspaces.id}
      )`,
      // Who else is in here, so a screen can say "this project is shared, with
      // these people" without a request per workspace. Addresses because that is
      // the only name an account has: sign-in asks a provider for an email and a
      // profile, never a picture, so there are no avatars to show.
      members: sql<string[]>`(
        SELECT coalesce(json_agg(u.email ORDER BY u.email), '[]'::json)
        FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.workspace_id = ${workspaces.id}
      )`,
      createdAt: workspaces.createdAt,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(eq(memberships.userId, userId))
    .orderBy(memberships.createdAt);
}

function validateName(raw: string): string {
  const name = (raw ?? "").trim();
  if (!name) throw new ServiceError("validation", "name must not be empty");
  if (name.length > MAX_NAME_LENGTH) {
    throw new ServiceError("validation", `name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return name;
}

export async function createWorkspace(input: { userId: string; name: string }) {
  assertUuid(input.userId, "userId");
  const name = validateName(input.name);
  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name, ownerId: input.userId })
      .returning();
    await tx
      .insert(memberships)
      .values({ workspaceId: workspace.id, userId: input.userId, role: "owner" });
    return workspace;
  });
}

export async function listMembers(input: { userId: string; workspaceId: string }) {
  await assertMember(input.userId, input.workspaceId);
  return db
    .select({
      userId: users.id,
      email: users.email,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.workspaceId, input.workspaceId))
    .orderBy(memberships.createdAt);
}

// One door for two actions: an owner removing someone, and anyone walking out.
// They differ in who is allowed, not in what happens.
export async function removeMember(input: {
  userId: string;
  workspaceId: string;
  memberId: string;
}) {
  const role = await assertMember(input.userId, input.workspaceId);
  assertUuid(input.memberId, "memberId");
  const leaving = input.memberId === input.userId;
  if (!leaving && role !== "owner") {
    throw new ServiceError("unauthorized", "only the owner removes other members");
  }
  const [workspace] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, input.workspaceId));
  // The owner leaving would leave the archive with tokens minted against a
  // workspace nobody administers. Handing it over is a feature that does not
  // exist yet, so the answer for now is no.
  if (workspace?.ownerId === input.memberId) {
    throw new ServiceError("validation", "the owner cannot leave their own workspace");
  }
  const [removed] = await db
    .delete(memberships)
    .where(
      and(eq(memberships.workspaceId, input.workspaceId), eq(memberships.userId, input.memberId)),
    )
    .returning({ userId: memberships.userId });
  if (!removed) throw new ServiceError("not_found", "member not found in this workspace");

  // Nothing to delete here. Their tokens belong to their machines and now reach
  // whatever they are still a member of, which stopped including this archive
  // the moment the row above was removed.
}

export async function createInvite(input: {
  userId: string;
  workspaceId: string;
  email?: string | null;
}) {
  await assertMember(input.userId, input.workspaceId);
  // Optional, and when given it binds the code to one address. An intercepted
  // code then opens nothing, and the field is where a delivered invitation will
  // read the recipient from once this runs somewhere with a mail sender.
  const email = input.email ? normalizeEmail(input.email) : null;
  if (email && !EMAIL_RE.test(email)) {
    throw new ServiceError("validation", "email does not look like an email address");
  }
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const [invite] = await db
    .insert(invites)
    .values({
      workspaceId: input.workspaceId,
      code: randomBytes(16).toString("base64url"),
      createdBy: input.userId,
      email,
      expiresAt,
    })
    .returning({
      id: invites.id,
      code: invites.code,
      email: invites.email,
      expiresAt: invites.expiresAt,
    });
  return invite;
}

export async function listInvites(input: { userId: string; workspaceId: string }) {
  await assertMember(input.userId, input.workspaceId);
  // Open ones only: a used or expired code is not something anyone acts on, and
  // showing it invites a second attempt with a code that cannot work.
  return db
    .select({
      id: invites.id,
      code: invites.code,
      email: invites.email,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .where(
      and(
        eq(invites.workspaceId, input.workspaceId),
        isNull(invites.acceptedAt),
        gt(invites.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invites.createdAt));
}

/**
 * Invitations written to my address and still open.
 *
 * listInvites answers the other question - what has this workspace sent out -
 * and only its members can ask it. There was no way at all to find out that
 * somebody had invited you: the code had to arrive through a channel outside
 * this application and be pasted in from memory. This is the half that lets an
 * invitation be a thing you are shown rather than a thing you are told about.
 *
 * Only invitations with an address on them. A code created without one opens for
 * whoever holds it, so there is nobody in particular to show it to.
 */
export async function listMyInvites(userId: string) {
  assertUuid(userId, "userId");
  const [me] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (!me) throw noSuchAccount();

  const inviter = alias(users, "inviter");
  return db
    .select({
      id: invites.id,
      // The code the recipient would otherwise have to be told by hand. Safe to
      // hand over here and nowhere else: the filter below is the address on the
      // invitation, so this only ever returns codes written to the reader.
      code: invites.code,
      workspaceId: invites.workspaceId,
      workspaceName: workspaces.name,
      invitedBy: inviter.email,
      expiresAt: invites.expiresAt,
      createdAt: invites.createdAt,
    })
    .from(invites)
    .innerJoin(workspaces, eq(workspaces.id, invites.workspaceId))
    // Left, so an invitation outlives the account that wrote it rather than
    // vanishing from the recipient's list when that person leaves.
    .leftJoin(inviter, eq(inviter.id, invites.createdBy))
    .where(
      and(
        eq(invites.email, me.email),
        isNull(invites.acceptedAt),
        gt(invites.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invites.createdAt));
}

/**
 * Saying no. Mine to refuse because it carries my address; revokeInvite is the
 * same act from the other side and is guarded by workspace membership instead.
 *
 * ponytail: the row is deleted rather than marked, so the sender sees it
 * disappear without learning whether it was refused or whether they withdrew it
 * themselves. A declined_at column the day that difference matters.
 */
export async function declineInvite(input: { userId: string; inviteId: string }) {
  assertUuid(input.userId, "userId");
  assertUuid(input.inviteId, "inviteId");
  const [me] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!me) throw noSuchAccount();

  const [deleted] = await db
    .delete(invites)
    .where(and(eq(invites.id, input.inviteId), eq(invites.email, me.email)))
    .returning({ id: invites.id });
  if (!deleted) throw new ServiceError("not_found", "invite not found");
}

export async function revokeInvite(input: { userId: string; inviteId: string }) {
  assertUuid(input.userId, "userId");
  assertUuid(input.inviteId, "inviteId");
  const [deleted] = await db
    .delete(invites)
    .where(
      and(
        eq(invites.id, input.inviteId),
        inArray(invites.workspaceId, reachableWorkspaces(input.userId)),
      ),
    )
    .returning({ id: invites.id });
  if (!deleted) throw new ServiceError("not_found", "invite not found");
}

export async function acceptInvite(input: { userId: string; code: string }) {
  assertUuid(input.userId, "userId");
  const code = (input.code ?? "").trim();
  if (!code) throw new ServiceError("validation", "code must not be empty");

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, input.userId));
  if (!user) throw noSuchAccount();

  return db.transaction(async (tx) => {
    // The single use is the update itself: a second acceptance finds no row with
    // accepted_at still null and stops here, so two people cannot share a code.
    const [invite] = await tx
      .update(invites)
      .set({ acceptedBy: input.userId, acceptedAt: new Date() })
      .where(
        and(eq(invites.code, code), isNull(invites.acceptedAt), gt(invites.expiresAt, new Date())),
      )
      .returning({ workspaceId: invites.workspaceId, email: invites.email });
    if (!invite) {
      throw new ServiceError("not_found", "this code is not valid, or was already used");
    }
    if (invite.email && invite.email !== user.email) {
      throw new ServiceError("unauthorized", "this invitation was written for another address");
    }

    const [joined] = await tx
      .insert(memberships)
      .values({ workspaceId: invite.workspaceId, userId: input.userId, role: "member" })
      .onConflictDoNothing()
      .returning({ workspaceId: memberships.workspaceId });
    if (!joined) throw new ServiceError("validation", "you are already in this workspace");

    const [workspace] = await tx
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, invite.workspaceId));
    return workspace;
  });
}

// --- MCP tokens (plan section 9) ---

// The raw token is shown once at generation; only its sha256 reaches the DB,
// so a database leak does not hand out working tokens.
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Who is calling, and which token said so. No archive: a token reaches every
 *  archive its owner belongs to, and the repository address picks the project
 *  out of them. The token id travels because a miss is recorded against it. */
export type Actor = { userId: string; tokenId: string };

// A token says who is calling and nothing else. What it can reach follows the
// person's memberships at the time of the call, so losing a team takes the
// archive with it on the next request, with no row to clean up here.
export async function resolveActorByToken(rawToken: string): Promise<Actor> {
  const [token] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(eq(apiTokens.tokenHash, hashToken(rawToken)));
  if (!token) throw new ServiceError("unauthorized", "invalid token");
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, token.id));
  return { userId: token.userId, tokenId: token.id };
}

// The only place the raw token exists after generation is this return value.
// Whoever calls it has one chance to show it to the user.
export async function createApiToken(input: { userId: string; label?: string }) {
  assertUuid(input.userId, "userId");
  const label = (input.label ?? "").trim().slice(0, MAX_LABEL_LENGTH);
  const token = generateToken();
  const [row] = await db
    .insert(apiTokens)
    // No workspace. The label names a machine ("work laptop") and that is all a
    // token is now; every archive its owner belongs to is in reach.
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
      // What a coder asked this token for and did not find. The app is the only
      // place that can answer it, and it could not see the question until now.
      lastUnknownRepo: apiTokens.lastUnknownRepo,
      lastUnknownRepoAt: apiTokens.lastUnknownRepoAt,
    })
    .from(apiTokens)
    // No join to workspaces any more: a token belongs to a machine, and naming
    // an archive beside it would say something about its reach that is no
    // longer true.
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

// Prose typed into a textarea carries whatever the keyboard left behind: CRLF
// from Windows, trailing spaces where a line was rewrapped, and runs of empty
// lines used as spacing. Stored as typed, that spacing becomes the screen's
// spacing and the agent's tokens. One empty line is a paragraph break, more
// than one is a habit.
export function normalizeProse(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The two prose fields of a project card, tidied on the way in rather than in
// every reader. The screen, the boot context and anything added later all get
// the same text, and the archive never holds a shape nobody meant to store.
function normalizeCard<T extends Partial<ProjectCard>>(card: T): T {
  return {
    ...card,
    ...(card.opis !== undefined && { opis: normalizeProse(card.opis) }),
    ...(card.ograniczenia !== undefined && { ograniczenia: normalizeProse(card.ograniczenia) }),
  };
}

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
  // The two counts ride along because the only caller, the main screen, lists
  // projects to answer "which one has something waiting for me". Fetching them
  // per project would be one round trip per row for a number the list is never
  // shown without.
  //
  // ponytail: pendingCount counts proposed nodes only. Queued update and delete
  // requests are missing from it, so a project whose only waiting item is a
  // coder's correction shows zero here and one item on the review screen. Add
  // the pending_actions tally when that gap is worth a second aggregate.
  return db
    .select({
      id: projects.id,
      name: projects.name,
      repoRef: projects.repoRef,
      opis: projects.opis,
      stack: projects.stack,
      etap: projects.etap,
      ograniczenia: projects.ograniczenia,
      workspaceId: projects.workspaceId,
      workspaceName: workspaces.name,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      // Archived nodes are out of the count for the same reason they are out of
      // the default list: they were taken back.
      nodeCount: sql<number>`count(${nodes.id}) filter (where ${nodes.status} <> 'archived')::int`,
      pendingCount: sql<number>`count(${nodes.id}) filter (where ${nodes.status} = 'proposed')::int`,
    })
    .from(projects)
    // Left, not inner: a project with no entries yet is exactly the one the
    // empty state is written for, and an inner join would hide it.
    .leftJoin(nodes, eq(nodes.projectId, projects.id))
    .innerJoin(workspaces, eq(workspaces.id, projects.workspaceId))
    // Every workspace this person belongs to, in one list. A project from a team
    // sits next to a private one and says which archive it came from.
    .where(inArray(projects.workspaceId, reachableWorkspaces(userId)))
    .groupBy(projects.id, workspaces.id)
    .orderBy(desc(projects.updatedAt));
}

export async function createProject(input: {
  userId: string;
  workspaceId?: string;
  card: ProjectCard;
}) {
  assertUuid(input.userId, "userId");
  validateCard(input.card);
  const workspaceId = input.workspaceId ?? (await defaultWorkspace(input.userId));
  await assertMember(input.userId, workspaceId);
  const repoRef = normalizeRepoRef(input.card.repoRef);
  const [project] = await db
    .insert(projects)
    .values({ ...normalizeCard(input.card), workspaceId, repoRef })
    .onConflictDoNothing({ target: [projects.workspaceId, projects.repoRef] })
    .returning();
  if (!project) {
    throw new ServiceError(
      "validation",
      `this workspace already has a project for repo_ref ${repoRef}`,
    );
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
  const patch = { ...normalizeCard(input.card), updatedAt: new Date() };
  if (input.card.repoRef !== undefined) patch.repoRef = normalizeRepoRef(input.card.repoRef);

  try {
    const [project] = await db
      .update(projects)
      .set(patch)
      .where(
        and(
          eq(projects.id, input.projectId),
          inArray(projects.workspaceId, reachableWorkspaces(input.userId)),
        ),
      )
      .returning();
    if (!project) throw new ServiceError("not_found", "project not found for this user");
    return project;
  } catch (error) {
    // A repo_ref edit can land on another project in the same workspace.
    if (isUniqueViolation(error)) {
      throw new ServiceError(
        "validation",
        "another project in this workspace already uses this repo_ref",
      );
    }
    throw error;
  }
}

/**
 * Removes a project and everything filed under it. Irreversible, and there is no
 * archive of the archive: the entries, their anchors, the review queue and the
 * chats about it all go with it.
 *
 * The database does the removing. projects -> nodes -> code_anchors and
 * pending_actions are all ON DELETE CASCADE, conversations hang off the project
 * directly, and nodes.superseded_by is SET NULL, so one statement leaves nothing
 * behind and nothing dangling. Writing the same sweep by hand here would be a
 * second description of the same rule, and the one that drifts.
 *
 * Only the workspace's owner, matching removeMember: a member writes to a shared
 * archive, and destroying one is not writing to it.
 */
export async function deleteProject(input: { userId: string; projectId: string }) {
  const workspaceId = await workspaceOfProject(input.userId, input.projectId);
  if ((await assertMember(input.userId, workspaceId)) !== "owner") {
    throw new ServiceError("unauthorized", "only the workspace owner deletes a project");
  }
  const [gone] = await db
    .delete(projects)
    .where(eq(projects.id, input.projectId))
    .returning({ id: projects.id });
  if (!gone) throw new ServiceError("not_found", "project not found for this user");
}

/**
 * Moves a project, with everything filed under it, into another archive.
 *
 * It exists because the two halves of this product each pick an archive on their
 * own: the app files a project where the person said, the coder reaches the one
 * its token was minted for. Every project created before the form asked the
 * question was filed by a default, so some of them sit where no token reaches,
 * and telling their owner to delete and retype the archive is asking them to
 * throw away the entries to fix the label.
 *
 * The rows carry a workspace of their own, so the cascade has to be written out:
 * nodes for the reads, pending_actions for the review queue. code_anchors hang
 * off a node and conversations belong to a person, so neither has one to update.
 *
 * Owner of the archive it leaves, member of the one it joins, matching
 * deleteProject: taking a project out of a shared archive removes it from
 * everyone else there, and that is not something a member does to a team.
 */
export async function moveProject(input: {
  userId: string;
  projectId: string;
  workspaceId: string;
}) {
  assertUuid(input.workspaceId, "workspaceId");
  const from = await workspaceOfProject(input.userId, input.projectId);
  if (from === input.workspaceId) {
    throw new ServiceError("validation", "the project is already in this workspace");
  }
  if ((await assertMember(input.userId, from)) !== "owner") {
    throw new ServiceError("unauthorized", "only the workspace owner moves a project out");
  }
  await assertMember(input.userId, input.workspaceId);

  const filedHere = db
    .select({ id: nodes.id })
    .from(nodes)
    .where(eq(nodes.projectId, input.projectId));

  try {
    const [moved] = await db
      .update(projects)
      .set({ workspaceId: input.workspaceId, updatedAt: new Date() })
      .where(eq(projects.id, input.projectId))
      .returning();
    if (!moved) throw new ServiceError("not_found", "project not found for this user");

    await db
      .update(pendingActions)
      .set({ workspaceId: input.workspaceId })
      .where(inArray(pendingActions.nodeId, filedHere));
    await db
      .update(nodes)
      .set({ workspaceId: input.workspaceId })
      .where(eq(nodes.projectId, input.projectId));
    return moved;
  } catch (error) {
    // The target archive may already hold a project for this repository, which
    // is the very pair this move exists to undo. Says repo_ref, like the create
    // path, because that is the word the app matches to name the field.
    if (isUniqueViolation(error)) {
      throw new ServiceError(
        "validation",
        "another project in that workspace already uses this repo_ref",
      );
    }
    throw error;
  }
}

// --- The connection graph (plan section 8) ---

// Two kinds of edge, computed on the fly rather than stored, because both are
// derivable and a stored copy would need invalidating on every write (plan
// section 8). They differ in meaning, so the screen draws them differently:
// a shared file is a fact, a similarity is a guess.
const SIMILARITY_FLOOR = 0.75;
const NEIGHBOURS = 3;

export async function getGraph(input: { userId: string; projectId: string }) {
  const workspaceId = await workspaceOfProject(input.userId, input.projectId);

  const graphNodes = await db
    .select({
      id: nodes.id,
      type: nodes.type,
      content: nodes.content,
      status: nodes.status,
      createdAt: nodes.createdAt,
    })
    .from(nodes)
    .where(
      and(
        eq(nodes.projectId, input.projectId),
        eq(nodes.workspaceId, workspaceId),
        ne(nodes.status, "archived"),
      ),
    )
    .orderBy(desc(nodes.createdAt));

  if (graphNodes.length < 2) return { nodes: graphNodes, edges: [] };

  // a1.node_id < a2.node_id keeps one row per pair instead of both directions.
  // The paths are aggregated rather than returned one per row: two entries that
  // touch four of the same files are one relationship, and four parallel lines
  // between the same two circles is not a drawing of anything.
  const shared = await db.execute<{ from_id: string; to_id: string; paths: string[] }>(sql`
    SELECT a1.node_id AS from_id, a2.node_id AS to_id,
           array_agg(DISTINCT a1.path ORDER BY a1.path) AS paths
    FROM code_anchors a1
    JOIN code_anchors a2 ON a1.path = a2.path AND a1.node_id < a2.node_id
    JOIN nodes n1 ON n1.id = a1.node_id
    JOIN nodes n2 ON n2.id = a2.node_id
    WHERE n1.project_id = ${input.projectId} AND n2.project_id = ${input.projectId}
      AND n1.workspace_id = ${workspaceId} AND n2.workspace_id = ${workspaceId}
      AND n1.status <> 'archived' AND n2.status <> 'archived'
    GROUP BY a1.node_id, a2.node_id
  `);

  // Nearest neighbours per node, not every pair over the floor: without the cap
  // a project where everything is about one subject comes back as a ball of
  // wool. LATERAL runs the top-N once per node and uses the HNSW index.
  const similar = await db.execute<{ from_id: string; to_id: string; similarity: number }>(sql`
    SELECT DISTINCT
      LEAST(n.id, m.id)::text AS from_id,
      GREATEST(n.id, m.id)::text AS to_id,
      m.similarity
    FROM nodes n
    CROSS JOIN LATERAL (
      SELECT o.id, 1 - (o.embedding <=> n.embedding) AS similarity
      FROM nodes o
      WHERE o.project_id = n.project_id AND o.workspace_id = ${workspaceId}
        AND o.id <> n.id AND o.status <> 'archived'
      ORDER BY o.embedding <=> n.embedding
      LIMIT ${NEIGHBOURS}
    ) m
    WHERE n.project_id = ${input.projectId} AND n.workspace_id = ${workspaceId}
      AND n.status <> 'archived' AND m.similarity >= ${SIMILARITY_FLOOR}
  `);

  // A pair that shares a file needs no second line saying it also reads alike.
  const byFile = new Set(shared.rows.map((r) => `${r.from_id}|${r.to_id}`));

  return {
    nodes: graphNodes,
    edges: [
      ...shared.rows.map((r) => ({
        kind: "file" as const,
        from: r.from_id,
        to: r.to_id,
        paths: r.paths,
      })),
      ...similar.rows
        .filter((r) => !byFile.has(`${r.from_id}|${r.to_id}`))
        .map((r) => ({
          kind: "similarity" as const,
          from: r.from_id,
          to: r.to_id,
          similarity: Number(r.similarity),
        })),
    ],
  };
}

// --- Conversations (plan section 11, screens 5 and 6) ---

export type ConversationKind = "ask" | "memory";
const CONVERSATION_KINDS = ["ask", "memory"] as const;
const TITLE_LENGTH = 70;
const CONVERSATION_LIST_LIMIT = 20;
const MAX_MESSAGES = 200;

/** One turn. `sources` belongs to an answer, `proposals` to a memory reply. */
export type ConversationMessage = {
  role: "user" | "ariadne";
  text: string;
  sources?: unknown[];
  proposals?: unknown[];
};

function assertKind(kind: string): asserts kind is ConversationKind {
  if (!CONVERSATION_KINDS.includes(kind as ConversationKind)) {
    throw new ServiceError("validation", `kind must be one of: ${CONVERSATION_KINDS.join(", ")}`);
  }
}

// A label, not a summary. Cutting on a word boundary rather than mid-word,
// because the alternative reads like a bug.
function titleFrom(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  if (flat.length <= TITLE_LENGTH) return flat;
  const cut = flat.slice(0, TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut}…`;
}

const CONVERSATION_COLUMNS = {
  id: conversations.id,
  projectId: conversations.projectId,
  kind: conversations.kind,
  title: conversations.title,
  messages: conversations.messages,
  createdAt: conversations.createdAt,
  updatedAt: conversations.updatedAt,
};

function assertMessages(messages: unknown): asserts messages is ConversationMessage[] {
  if (!Array.isArray(messages)) {
    throw new ServiceError("validation", "messages must be an array");
  }
  if (messages.length > MAX_MESSAGES) {
    throw new ServiceError("validation", `a conversation holds at most ${MAX_MESSAGES} messages`);
  }
  for (const message of messages) {
    const turn = message as ConversationMessage;
    if (turn?.role !== "user" && turn?.role !== "ariadne") {
      throw new ServiceError("validation", "each message needs role 'user' or 'ariadne'");
    }
    if (typeof turn.text !== "string") {
      throw new ServiceError("validation", "each message needs text");
    }
  }
}

export async function listConversations(input: {
  userId: string;
  projectId: string;
  kind: string;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.projectId, "projectId");
  assertKind(input.kind);
  // A conversation belongs to the person, not the workspace, so this only proves
  // they can reach the project it is filed under.
  await workspaceOfProject(input.userId, input.projectId);

  // Titles and timestamps only. The list is a way back into a conversation, and
  // shipping every message of the last twenty would be most of the table.
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      createdAt: conversations.createdAt,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, input.userId),
        eq(conversations.projectId, input.projectId),
        eq(conversations.kind, input.kind),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(CONVERSATION_LIST_LIMIT);
}

export async function getConversation(input: { userId: string; conversationId: string }) {
  assertUuid(input.userId, "userId");
  assertUuid(input.conversationId, "conversationId");

  // Projected, not select(): the whole row carries user_id, and an id the client
  // has no use for is an id it should not be handed.
  const [found] = await db
    .select(CONVERSATION_COLUMNS)
    .from(conversations)
    .where(
      and(eq(conversations.id, input.conversationId), eq(conversations.userId, input.userId)),
    );
  if (!found) throw new ServiceError("not_found", "conversation not found for this user");
  return found;
}

export async function createConversation(input: {
  userId: string;
  projectId: string;
  kind: string;
  messages: unknown;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.projectId, "projectId");
  assertKind(input.kind);
  assertMessages(input.messages);
  await workspaceOfProject(input.userId, input.projectId);

  const opening = input.messages.find((m) => m.role === "user");
  if (!opening) {
    throw new ServiceError("validation", "a conversation starts with a message from the user");
  }

  const [created] = await db
    .insert(conversations)
    .values({
      userId: input.userId,
      projectId: input.projectId,
      kind: input.kind,
      title: titleFrom(opening.text),
      messages: input.messages,
    })
    .returning(CONVERSATION_COLUMNS);
  return created;
}

// Whole-array replace, not append: the client owns the transcript it is showing
// and a partial append would need a turn index the client does not track.
export async function appendToConversation(input: {
  userId: string;
  conversationId: string;
  messages: unknown;
}) {
  assertUuid(input.userId, "userId");
  assertUuid(input.conversationId, "conversationId");
  assertMessages(input.messages);
  // Ownership before the write, so another user's id fails as not_found rather
  // than quietly updating nothing.
  await getConversation({ userId: input.userId, conversationId: input.conversationId });

  const [updated] = await db
    .update(conversations)
    .set({ messages: input.messages, updatedAt: new Date() })
    .where(
      and(eq(conversations.id, input.conversationId), eq(conversations.userId, input.userId)),
    )
    .returning(CONVERSATION_COLUMNS);
  return updated;
}

export async function deleteConversation(input: { userId: string; conversationId: string }) {
  await getConversation(input);
  await db
    .delete(conversations)
    .where(
      and(eq(conversations.id, input.conversationId), eq(conversations.userId, input.userId)),
    );
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
      workspaceName: workspaces.name,
      requestedByEmail: users.email,
    })
    .from(pendingActions)
    .innerJoin(nodes, eq(nodes.id, pendingActions.nodeId))
    .innerJoin(projects, eq(projects.id, nodes.projectId))
    .innerJoin(workspaces, eq(workspaces.id, pendingActions.workspaceId))
    .leftJoin(users, eq(users.id, pendingActions.requestedByUserId))
    .where(
      and(
        inArray(pendingActions.workspaceId, reachableWorkspaces(userId)),
        eq(pendingActions.status, "pending"),
      ),
    )
    .orderBy(desc(pendingActions.createdAt))
    .limit(FEED_LIMIT);

  const unsettled = await db
    .select({
      id: nodes.id,
      type: nodes.type,
      content: nodes.content,
      // The queue leads with the same line the rest of the app does.
      summary: nodes.summary,
      status: nodes.status,
      source: nodes.source,
      // The feed is where a contradicted node is read, and the status only means
      // something next to the node that overruled it.
      supersededBy: nodes.supersededBy,
      conflictsWith: nodes.conflictsWith,
      createdAt: nodes.createdAt,
      projectId: projects.id,
      projectName: projects.name,
      workspaceName: workspaces.name,
      author: users.email,
    })
    .from(nodes)
    .innerJoin(projects, eq(projects.id, nodes.projectId))
    .innerJoin(workspaces, eq(workspaces.id, nodes.workspaceId))
    .leftJoin(users, eq(users.id, nodes.authorId))
    .where(
      and(
        inArray(nodes.workspaceId, reachableWorkspaces(userId)),
        or(
          inArray(nodes.status, ["proposed", "contradicted"]),
          // A settled entry with an unanswered clash still waits for a person.
          // Written in the app it is confirmed on the spot and would otherwise
          // have nowhere to raise its hand once that screen is closed, and this
          // list is where everything that wants a decision belongs.
          sql`array_length(${nodes.conflictsWith}, 1) > 0`,
        ),
      ),
    )
    .orderBy(desc(nodes.createdAt))
    .limit(FEED_LIMIT);

  // ponytail: both lists capped at FEED_LIMIT with no paging. The screen is
  // explicitly ignorable, so a long tail is not worth a cursor yet; add one when
  // the count stops fitting on a screen.
  return { pendingActions: queued, nodesToReview: await attachConflicts(userId, unsettled) };
}
