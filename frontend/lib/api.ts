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
    if (res.status === 401) clearToken();
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
};

export const login = (email: string, password: string) =>
  request<{ token: string }>("/auth/login", { method: "POST", body: { email, password }, auth: false });

export const register = (email: string, password: string) =>
  request<{ token: string }>("/auth/register", { method: "POST", body: { email, password }, auth: false });

export const getAccount = () => request<Account>("/me");

export const saveProfile = (profile: string) =>
  request<{ profile: string }>("/me/profile", { method: "PUT", body: { profile } });

export const createProject = (card: Partial<Project> & { name: string; repoRef: string }) =>
  request<Project>("/projects", { method: "POST", body: card });

export const mintToken = (label: string) =>
  request<{ id: string; label: string; token: string }>("/tokens", { method: "POST", body: { label } });
