// The only place that talks to the backend. Every screen goes through request().

// Trailing slash trimmed: this is pasted by hand into .env.local, and one at the
// end turns every call into BASE//path, which answers 404 and looks like a
// broken server rather than a typo.
const BASE = (process.env.NEXT_PUBLIC_ARIADNE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const TOKEN_KEY = "ariadne.jwt";

export const serverUrl = BASE;

// The spec separates three failures that a single "offline" state would blur:
// the server is not running, the request was rejected, or the model key was
// refused. Only the first two can happen here, and they need different copy.
export type Failure = "unreachable" | "rejected";

export class ApiError extends Error {
  constructor(
    readonly failure: Failure,
    readonly status: number,
    // The backend's error code: validation, unauthorized, not_found,
    // unknown_repo, too_large, internal.
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// localStorage rather than a secure store: the Tauri window loads only bundled
// files under a strict CSP, so there is no remote script to read it.
// ponytail: move the token to the OS keychain the moment this window loads
// anything from the network.
export function readToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

// State that belongs to whoever was signed in, not to this machine. localStorage
// is scoped to the origin and not to the account, so signing into a second
// account inherited the first one's leftovers: the main screen greeted a
// brand-new account with "last time you were here", carrying a date from
// somebody else's session, and a half-finished wizard would have resumed under
// the wrong name. The device's own preferences - which side the navigation is
// on, the language - are deliberately not in this list.
const SESSION_SCOPED = ["ariadne.lastSeen", "ariadne.activeProject", "ariadne.onboarding"];

export function writeToken(token: string) {
  // Every way into the application ends here, which makes it the one place that
  // knows the session has changed.
  for (const key of SESSION_SCOPED) localStorage.removeItem(key);
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

type Options = { method?: string; body?: unknown; auth?: boolean };

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const token = auth ? readToken() : null;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // fetch only rejects when the request never reached a server, so this is
    // the one branch that means "the backend is not running".
    throw new ApiError("unreachable", 0, "unreachable", `${BASE} did not answer`);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // The backend answers JSON on every path including 401, 404 and 413, so a
    // non-JSON body means something else is listening on this port.
    throw new ApiError("rejected", res.status, "internal", text.slice(0, 200));
  }

  if (!res.ok) {
    const { error, message } = (payload ?? {}) as { error?: string; message?: string };
    // Only when the request actually carried a token. The reachability probe calls
    // /me deliberately unauthenticated, so clearing on every 401 logged the user
    // out on each visit to the entry screen.
    if (res.status === 401 && token) clearToken();
    throw new ApiError("rejected", res.status, error ?? "internal", message ?? res.statusText);
  }

  return payload as T;
}

// --- Endpoints used by login and onboarding ---

/**
 * Whether this account has a key of its own for the calls to Google. Without
 * one, writing an entry and both chats stop working until it is set: there is
 * no server-wide key behind it.
 */
export type GeminiKeySource = "user" | "none";

/** Where a person gets one. Named here because two screens send them there. */
export const GEMINI_KEY_CONSOLE = "https://aistudio.google.com/apikey";

export type Account = {
  id: string;
  email: string;
  profile: string;
  allPermission: boolean;
  geminiKey: GeminiKeySource;
  /** False on an account that only ever signed in through Google or GitHub. */
  hasPassword: boolean;
  createdAt: string;
};

export type Project = {
  id: string;
  name: string;
  repoRef: string;
  opis: string;
  stack: string;
  etap: string;
  ograniczenia: string;
  updatedAt: string;
  /** Which archive it belongs to. A project can come from a shared workspace. */
  workspaceId: string;
  /** Absent on the row POST /projects hands back, which joins nothing. */
  workspaceName?: string;
  /** Everything not archived. Absent on the row POST /projects hands back. */
  nodeCount?: number;
  /** The 'proposed' slice of the above, the number the main screen acts on. */
  pendingCount?: number;
};

export type NodeStatus = "proposed" | "confirmed" | "contradicted" | "archived";

export type Node = {
  id: string;
  type: "session_summary" | "decision" | "note";
  content: string;
  /** Ten words written by the model, the line a card leads with. Empty for
      entries recorded before this existed, and for a summary call that failed;
      the card falls back to the first sentence of the content. */
  summary: string;
  /** Entries this one appears to contradict, unresolved. Ids only; the screens
      that offer a decision get the text in `conflicts` alongside. */
  conflictsWith: string[];
  status: NodeStatus;
  // 'coder' is the agent writing after a session; the other two are the person
  // in this window. The main screen only needs that distinction.
  source: { channel: "coder" | "app_chat" | "app_form"; session_id: string };
  createdAt: string;
  /** Equal to createdAt until someone edits or settles the entry. */
  updatedAt: string;
  /** Email of whoever recorded it. Null once that account is gone. */
  author?: string | null;
  /** Email of whoever moved it to confirmed, and when. */
  confirmedBy?: string | null;
  confirmedAt?: string | null;
};

export const login = (email: string, password: string) =>
  request<{ token: string }>("/auth/login", { method: "POST", body: { email, password }, auth: false });

export const register = (email: string, password: string) =>
  request<{ token: string }>("/auth/register", { method: "POST", body: { email, password }, auth: false });

// --- Signing in through Google and GitHub ---

export type Provider = "google" | "github";

/**
 * Which buttons the entry screen may show. A server without GitHub credentials
 * leaves that one out, so the screen never offers a way in that only fails.
 */
export const authProviders = () =>
  request<{ providers: Provider[] }>("/auth/providers", { auth: false }).then((r) => r.providers);

// How long to keep asking before giving up on a browser tab the person probably
// abandoned. The server forgets the result at five minutes; stopping earlier
// only means this window stops spinning while that is still true.
const HANDOFF_TIMEOUT_MS = 3 * 60 * 1000;
const HANDOFF_POLL_MS = 1500;

/**
 * The whole provider sign-in, from this window's point of view.
 *
 * The browser cannot hand a token back to the window that opened it, so the app
 * invents a one-time id, sends the browser off with it, and asks the server for
 * whatever ends up under that id. Nothing is stored on this side until a token
 * actually arrives.
 */
export async function signInWithProvider(provider: Provider, signal: AbortSignal): Promise<string> {
  // 32 bytes of the platform CSPRNG, base64url so it survives a query string
  // untouched. Only this window and the server ever see it.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const handoff = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Same mechanism the settings and onboarding screens already use for external
  // links: Tauri sends _blank to the system browser, and in dev it is a tab.
  window.open(`${BASE}/auth/${provider}/start?handoff=${handoff}`, "_blank");

  const deadline = Date.now() + HANDOFF_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new Error("cancelled");
    await new Promise((resolve) => setTimeout(resolve, HANDOFF_POLL_MS));
    // 204 while the shelf is empty, which request() gives back as undefined.
    const result = await request<{ token?: string; error?: string } | undefined>(
      `/auth/handoff/${handoff}`,
      { auth: false },
    );
    if (result?.token) return result.token;
    if (result?.error) throw new ApiError("rejected", 401, "unauthorized", result.error);
  }
  throw new ApiError("rejected", 408, "timeout", "sign-in timed out");
}

export const getAccount = () => request<Account>("/me");

export const saveProfile = (profile: string) =>
  request<{ profile: string }>("/me/profile", { method: "PUT", body: { profile } });

export const listProjects = () => request<Project[]>("/projects");

// workspaceId is optional and absent means the account's own archive, which is
// what the wizard sends. Leaving it out of the type was what let a project land
// in one archive while the coder's token spoke to another.
export const createProject = (
  card: { name: string; repoRef: string; workspaceId?: string } & Partial<ProjectCard>,
) => request<Project>("/projects", { method: "POST", body: card });

type ProjectCard = { opis: string; stack: string; etap: string; ograniczenia: string };

// repoRef is in here now. The server always accepted it - it normalises the
// value and answers a collision with its own message - and leaving it out of the
// type was what made a mistyped address permanent.
export const updateProject = (
  id: string,
  card: Partial<ProjectCard & { name: string; repoRef: string }>,
) => request<Project>(`/projects/${id}`, { method: "PUT", body: card });

// Takes the entries and the review queue with it, so a coder's token that
// reaches the new archive starts finding the project by its repository address.
// Reversible, unlike the delete below: it can be moved straight back.
export const moveProject = (id: string, workspaceId: string) =>
  request<Project>(`/projects/${id}/workspace`, { method: "POST", body: { workspaceId } });

// No undo and no copy: the entries, their anchors, the review queue and the
// chats under this project go with it. The screen asks for the name first.
export const deleteProject = (id: string) =>
  request<void>(`/projects/${id}`, { method: "DELETE" });

// `sort` picks the question being asked: "created" is newest thought first,
// "updated" is what has been touched lately, which is a different list once
// entries start getting corrected.
export const listNodes = (
  projectId: string,
  limit: number,
  options: { type?: Node["type"]; sort?: "created" | "updated" } = {},
) => {
  const query = new URLSearchParams({ limit: String(limit) });
  if (options.type) query.set("type", options.type);
  if (options.sort) query.set("sort", options.sort);
  return request<{ nodes: Node[]; nextCursor: string | null }>(
    `/projects/${projectId}/nodes?${query}`,
  );
};

// Without a workspace the backend files it under the private one, which is what
// onboarding means and what an account with a single archive always means.
export const mintToken = (label: string, workspaceId?: string) =>
  request<{ id: string; label: string; token: string }>("/tokens", {
    method: "POST",
    body: { label, workspaceId },
  });

export type ApiToken = {
  id: string;
  label: string;
  workspaceId: string;
  workspaceName: string;
  createdAt: string;
  /** Null until a coder actually connects with it. */
  lastUsedAt: string | null;
  /** The last repository a coder asked this token for and did not find in its
   *  archive. The miss is answered to the coder alone, so without this the app
   *  looks healthy while every session comes back empty. */
  lastUnknownRepo: string | null;
  lastUnknownRepoAt: string | null;
};

export const listTokens = () => request<ApiToken[]>("/tokens");

export const deleteToken = (id: string) => request<void>(`/tokens/${id}`, { method: "DELETE" });

/** Rejected by the server unless Google accepts the key, so a typo fails here. */
export const saveGeminiKey = (key: string) =>
  request<{ geminiKey: GeminiKeySource }>("/me/gemini-key", { method: "PUT", body: { key } });

export const clearGeminiKey = () =>
  request<{ geminiKey: GeminiKeySource }>("/me/gemini-key", { method: "DELETE" });

export const setAllPermission = (allPermission: boolean) =>
  request<{ allPermission: boolean }>("/me/all-permission", {
    method: "PUT",
    body: { allPermission },
  });

export const changePassword = (currentPassword: string, newPassword: string) =>
  request<void>("/me/password", { method: "PUT", body: { currentPassword, newPassword } });

// --- Workspaces: who shares an archive ---

export type Workspace = {
  id: string;
  name: string;
  role: "owner" | "member";
  isOwner: boolean;
  memberCount: number;
  /** Every member's address, including yours. There are no avatars to show:
   *  sign-in asks a provider for an email and a profile, never a picture. */
  members: string[];
  createdAt: string;
};

export type Member = {
  userId: string;
  email: string;
  role: "owner" | "member";
  joinedAt: string;
};

export type Invite = {
  id: string;
  code: string;
  /** When set, only that address can accept the code. */
  email: string | null;
  expiresAt: string;
  createdAt: string;
};

export const listWorkspaces = () => request<Workspace[]>("/workspaces");

export const createWorkspace = (name: string) =>
  request<Workspace>("/workspaces", { method: "POST", body: { name } });

export const listMembers = (workspaceId: string) =>
  request<Member[]>(`/workspaces/${workspaceId}/members`);

/** Removing yourself is leaving; removing anyone else is for the owner. */
export const removeMember = (workspaceId: string, userId: string) =>
  request<void>(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" });

export const listInvites = (workspaceId: string) =>
  request<Invite[]>(`/workspaces/${workspaceId}/invites`);

export const createInvite = (workspaceId: string, email: string | null) =>
  request<Invite>(`/workspaces/${workspaceId}/invites`, { method: "POST", body: { email } });

export const revokeInvite = (id: string) => request<void>(`/invites/${id}`, { method: "DELETE" });

/** Invitations written to this account and still open, newest first. */
export type MyInvite = {
  id: string;
  /** Only ever a code written to this address, so accepting needs no retyping. */
  code: string;
  workspaceId: string;
  workspaceName: string;
  /** Null once the account that wrote it is gone; the invitation still stands. */
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
};

export const myInvites = () => request<MyInvite[]>("/me/invites");

/** Saying no. Mine to refuse because it carries my address. */
export const declineInvite = (id: string) =>
  request<void>(`/invites/${id}/decline`, { method: "POST" });

export const acceptInvite = (code: string) =>
  request<{ id: string; name: string }>(`/invites/${encodeURIComponent(code)}/accept`, {
    method: "POST",
  });

// --- Graph, review feed and the two chats ---

export type Anchor = { path: string; symbol: string | null; sha: string | null };
export type Source = Node & { similarity: number; anchors: Anchor[] };

export type GraphEdge =
  | { kind: "file"; from: string; to: string; paths: string[] }
  | { kind: "similarity"; from: string; to: string; similarity: number };

export const getGraph = (projectId: string) =>
  request<{ nodes: Node[]; edges: GraphEdge[] }>(`/projects/${projectId}/graph`);

export type PendingAction = {
  id: string;
  action: "update" | "delete";
  /** For an update: the proposed replacement. A delete carries nothing. */
  payload: { content?: string };
  requestedBy: "coder" | "app_agent";
  createdAt: string;
  nodeId: string;
  /** What is stored today, so the screen can show the change against it. */
  nodeContent: string;
  projectName: string;
  /** Which archive it belongs to. The server has always sent this; the type
   *  dropped it, so the queue could not say whose work an item was about. */
  workspaceName: string;
};

/** The other side of a suspected clash, with enough text to judge it by. */
export type ConflictEntry = Pick<Node, "id" | "type" | "content" | "summary" | "status"> & {
  createdAt: string;
};

export type ReviewNode = Node & {
  supersededBy: string | null;
  projectName: string;
  workspaceName: string;
  conflicts: ConflictEntry[];
};

/** Which entry stands: the new one, the one already recorded, or both. */
export type ConflictVerdict = "new" | "old" | "both";

export const resolveConflict = (nodeId: string, otherId: string, verdict: ConflictVerdict) =>
  request<void>(`/nodes/${nodeId}/conflicts/resolve`, {
    method: "POST",
    body: { otherId, verdict },
  });

export const getPending = () =>
  request<{ pendingActions: PendingAction[]; nodesToReview: ReviewNode[] }>("/pending");

export const approvePending = (id: string) => request<void>(`/pending/${id}/approve`, { method: "POST" });
export const rejectPending = (id: string) => request<void>(`/pending/${id}/reject`, { method: "POST" });
export const confirmNode = (id: string) => request<void>(`/nodes/${id}/confirm`, { method: "POST" });
export const archiveNode = (id: string) => request<void>(`/nodes/${id}/archive`, { method: "POST" });

export type Proposal = {
  action: "update" | "delete" | "create";
  nodeId: string;
  content: string;
  pendingActionId?: string;
  /** Only on a create, and only when the new entry clashes with something. */
  conflicts?: ConflictEntry[];
};

// --- Conversations ---
//
// Both chats keep a transcript so that leaving a screen stops throwing the
// exchange away. They share one endpoint and differ by `kind`: asking reads the
// project's memory, adding writes to it.

export type ConversationKind = "ask" | "memory";

/** One turn. `sources` belongs to an answer, `proposals` to a memory reply. */
export type ConversationMessage = {
  role: "user" | "ariadne";
  text: string;
  sources?: Source[];
  proposals?: Proposal[];
};

/** What the list endpoint returns: enough to offer a way back in, no messages. */
export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type Conversation = ConversationSummary & {
  projectId: string;
  kind: ConversationKind;
  messages: ConversationMessage[];
};

export const listConversations = (projectId: string, kind: ConversationKind) =>
  request<ConversationSummary[]>(
    `/conversations?${new URLSearchParams({ projectId, kind })}`,
  );

export const getConversation = (id: string) => request<Conversation>(`/conversations/${id}`);

export const createConversation = (
  projectId: string,
  kind: ConversationKind,
  messages: ConversationMessage[],
) => request<Conversation>("/conversations", { method: "POST", body: { projectId, kind, messages } });

/** The whole transcript, not a delta: the screen owns what it is showing. */
export const saveConversation = (id: string, messages: ConversationMessage[]) =>
  request<Conversation>(`/conversations/${id}`, { method: "PUT", body: { messages } });

export const deleteConversation = (id: string) =>
  request<void>(`/conversations/${id}`, { method: "DELETE" });

export const chatEdit = (projectId: string, message: string, sessionId: string) =>
  request<{ reply: string; sources: Source[]; queued: Proposal[] }>("/chat/edit", {
    method: "POST",
    body: { projectId, message, sessionId },
  });

type QueryChunk =
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "error"; message: string };

// The one endpoint that does not go through request(): it answers with NDJSON
// over a long-lived body, so there is nothing to JSON.parse at the end. Yields
// each line as it lands, which is what makes the answer appear as it is written.
export async function* chatQuery(
  projectId: string,
  question: string,
  signal?: AbortSignal,
): AsyncGenerator<QueryChunk> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(readToken() ? { Authorization: `Bearer ${readToken()}` } : {}),
      },
      body: JSON.stringify({ projectId, question }),
      signal,
    });
  } catch {
    throw new ApiError("unreachable", 0, "unreachable", `${BASE} did not answer`);
  }

  if (!res.ok || !res.body) {
    const { error, message } = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (res.status === 401) clearToken();
    throw new ApiError("rejected", res.status, error ?? "internal", message ?? res.statusText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  // A line can be split across two reads, so the tail is carried forward.
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as QueryChunk;
  }
  if (buffer.trim()) yield JSON.parse(buffer) as QueryChunk;
}
