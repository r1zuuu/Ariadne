// The only place that talks to the backend. Every screen goes through request().

const BASE = process.env.NEXT_PUBLIC_ARIADNE_URL ?? "http://localhost:3000";
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

export function writeToken(token: string) {
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

// Cheap reachability probe for the line the login screen keeps on screen. Any
// answer at all counts, including 401: it proves the server is up.
export async function serverReachable(): Promise<boolean> {
  try {
    await request("/me", { auth: false });
    return true;
  } catch (error) {
    return error instanceof ApiError && error.failure === "rejected";
  }
}

// --- Endpoints used by login and onboarding ---

export type Account = {
  id: string;
  email: string;
  profile: string;
  allPermission: boolean;
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
  status: NodeStatus;
  // 'coder' is the agent writing after a session; the other two are the person
  // in this window. The main screen only needs that distinction.
  source: { channel: "coder" | "app_chat" | "app_form"; session_id: string };
  createdAt: string;
  /** Equal to createdAt until someone edits or settles the entry. */
  updatedAt: string;
};

export const login = (email: string, password: string) =>
  request<{ token: string }>("/auth/login", { method: "POST", body: { email, password }, auth: false });

export const register = (email: string, password: string) =>
  request<{ token: string }>("/auth/register", { method: "POST", body: { email, password }, auth: false });

export const getAccount = () => request<Account>("/me");

export const saveProfile = (profile: string) =>
  request<{ profile: string }>("/me/profile", { method: "PUT", body: { profile } });

export const listProjects = () => request<Project[]>("/projects");

export const createProject = (card: { name: string; repoRef: string } & Partial<ProjectCard>) =>
  request<Project>("/projects", { method: "POST", body: card });

type ProjectCard = { opis: string; stack: string; etap: string; ograniczenia: string };

export const updateProject = (id: string, card: Partial<ProjectCard & { name: string }>) =>
  request<Project>(`/projects/${id}`, { method: "PUT", body: card });

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

export const mintToken = (label: string) =>
  request<{ id: string; label: string; token: string }>("/tokens", { method: "POST", body: { label } });

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
};

export type ReviewNode = Node & { supersededBy: string | null; projectName: string };

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
