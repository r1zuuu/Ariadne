// Google and GitHub sign-in, the half that talks to the provider. Turning an
// identity into an account lives in service.ts; this file knows two vocabularies
// and nothing about the database.
//
// The exchange happens here rather than in the desktop app for one reason: a
// client secret shipped inside an .exe is a published secret. The app only ever
// opens a browser and waits for the token that comes back.

import { sign, verify } from "hono/jwt";
import { ServiceError } from "./service.js";

export type Provider = "google" | "github";

const PROVIDERS: Provider[] = ["google", "github"];

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as string[]).includes(value);
}

/** What the provider told us, reduced to the three things an account needs. */
export type ExternalIdentity = {
  providerUserId: string;
  email: string;
  /** Whether the provider says it belongs to them. Linking hangs on this. */
  emailVerified: boolean;
};

// --- The handoff ---
//
// The browser cannot hand anything back to the window that opened it, so the
// result waits here under a one-time id the app made up before it opened the
// browser, and the app collects it by polling.
//
// The alternative was a custom ariadne:// scheme. It would keep this out of the
// server's memory, at the cost of a Tauri plugin, a Rust rebuild, a scheme that
// only exists once the installer has run - so no sign-in at all under `npm run
// dev` - and a handler any other program on the machine can claim.
//
// ponytail: one Map in one process, same as the login limiter. Correct while
// Render runs a single free instance; a second one means a person polls the
// instance that did not do the exchange and waits forever. Redis or a table then.

const HANDOFF_TTL_MS = 5 * 60 * 1000;
const HANDOFF_RE = /^[A-Za-z0-9_-]{22,86}$/;

type Waiting = { token?: string; error?: string; until: number };
const waiting = new Map<string, Waiting>();

/** Bounds what can become a Map key, since anyone may call the start route. */
export function isHandoff(value: string | undefined): value is string {
  return !!value && HANDOFF_RE.test(value);
}

export function park(handoff: string, result: { token?: string; error?: string }): void {
  const now = Date.now();
  // Expired entries are never read, so this is the only thing that stops an
  // abandoned sign-in from growing the map for the life of the process.
  for (const [key, entry] of waiting) if (entry.until <= now) waiting.delete(key);
  waiting.set(handoff, { ...result, until: now + HANDOFF_TTL_MS });
}

/**
 * Single use: the entry goes as it is read. A token that stays collectable is a
 * token a second caller can collect, and the app only ever needs it once.
 */
export function collect(handoff: string): { token?: string; error?: string } | null {
  const entry = waiting.get(handoff);
  if (!entry) return null;
  waiting.delete(handoff);
  if (entry.until <= Date.now()) return null;
  return { token: entry.token, error: entry.error };
}

// Trailing slash trimmed: it arrives from an environment variable pasted by
// hand, and "https://host/" + "/auth/..." is a 404 that looks like a typo in the
// provider's console.
function publicUrl(): string {
  const url = process.env.PUBLIC_URL;
  if (!url) throw new ServiceError("validation", "PUBLIC_URL is not set on the server");
  return url.replace(/\/+$/, "");
}

function redirectUri(provider: Provider): string {
  return `${publicUrl()}/auth/${provider}/callback`;
}

function credentials(provider: Provider): { id: string; secret: string } {
  const prefix = provider.toUpperCase();
  const id = process.env[`${prefix}_CLIENT_ID`];
  const secret = process.env[`${prefix}_CLIENT_SECRET`];
  // A missing pair is a server that was deployed without finishing setup, and
  // the button for it should not have been on the screen. Saying which provider
  // is the difference between a five minute fix and an afternoon.
  if (!id || !secret) {
    throw new ServiceError("validation", `${provider} sign-in is not configured on this server`);
  }
  return { id, secret };
}

/**
 * Which buttons the sign-in screen should show. PUBLIC_URL counts as much as the
 * credentials do: without it there is no callback address to send anyone to, and
 * a button that can only fail is worse than no button.
 */
export function configured(): Provider[] {
  if (!process.env.PUBLIC_URL) return [];
  return PROVIDERS.filter(
    (p) => process.env[`${p.toUpperCase()}_CLIENT_ID`] && process.env[`${p.toUpperCase()}_CLIENT_SECRET`],
  );
}

// --- The state parameter ---
//
// Its job is to prove the callback answers a request this server started, which
// is what stops someone from feeding a victim's browser a code of their own.
// Signed rather than stored: a row or a Map would have to survive a restart of a
// free instance that sleeps, and there is nothing to remember past the ninety
// seconds the round trip takes.

const STATE_TTL_SECONDS = 15 * 60;

type StatePayload = { provider: Provider; handoff: string; exp: number };

function stateSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new ServiceError("validation", "JWT_SECRET is not set on the server");
  return secret;
}

export function issueState(provider: Provider, handoff: string): Promise<string> {
  return sign(
    { provider, handoff, exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS },
    stateSecret(),
    "HS256",
  );
}

/** Returns the handoff id this journey started with, or throws if it did not. */
export async function readState(state: string | undefined, provider: Provider): Promise<string> {
  const rejected = new ServiceError("unauthorized", "this sign-in link is no longer valid");
  if (!state) throw rejected;
  let payload: StatePayload;
  try {
    payload = (await verify(state, stateSecret(), "HS256")) as StatePayload;
  } catch {
    // Covers a tampered signature and an expired one alike: both mean the person
    // should press the button again, which is the only advice either deserves.
    throw rejected;
  }
  // A state minted for Google must not be spent at GitHub's callback.
  if (payload.provider !== provider) throw rejected;
  if (!isHandoff(payload.handoff)) throw rejected;
  return payload.handoff;
}

// --- The two providers ---

export function authorizeUrl(provider: Provider, state: string): string {
  const { id } = credentials(provider);
  const common = { client_id: id, redirect_uri: redirectUri(provider), state };

  if (provider === "google") {
    const query = new URLSearchParams({
      ...common,
      response_type: "code",
      scope: "openid email profile",
      // Without this Google silently reuses whoever is already signed in, which
      // on a shared machine hands the archive to the wrong person.
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
  }

  const query = new URLSearchParams({ ...common, scope: "read:user user:email" });
  return `https://github.com/login/oauth/authorize?${query}`;
}

async function json(res: Response, what: string): Promise<Record<string, unknown>> {
  if (!res.ok) {
    throw new ServiceError("unauthorized", `${what} was refused by the provider (${res.status})`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Trades the one-time code for whatever the provider will say about the person. */
export async function identify(provider: Provider, code: string): Promise<ExternalIdentity> {
  return provider === "google" ? google(code) : github(code);
}

async function google(code: string): Promise<ExternalIdentity> {
  const { id, secret } = credentials("google");
  const token = await json(
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: id,
        client_secret: secret,
        redirect_uri: redirectUri("google"),
        grant_type: "authorization_code",
      }),
    }),
    "the sign-in code",
  );

  // The id_token next to it carries the same claims, but trusting it means
  // verifying Google's signature against a rotating key set. Asking the userinfo
  // endpoint over TLS answers the same question with no key handling at all.
  const profile = await json(
    await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }),
    "the profile",
  );

  const email = typeof profile.email === "string" ? profile.email : "";
  if (!email) throw new ServiceError("validation", "Google did not return an email address");
  return {
    providerUserId: String(profile.sub),
    email,
    emailVerified: profile.email_verified === true,
  };
}

async function github(code: string): Promise<ExternalIdentity> {
  const { id, secret } = credentials("github");
  const token = await json(
    await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri("github") }),
    }),
    "the sign-in code",
  );
  // GitHub answers 200 with an error field rather than a status, so an expired
  // code would otherwise sail through as an undefined access token.
  if (typeof token.access_token !== "string") {
    throw new ServiceError("unauthorized", "this sign-in link is no longer valid");
  }

  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    Accept: "application/vnd.github+json",
    // GitHub rejects API calls without one.
    "User-Agent": "ariadne",
  };
  const profile = await json(await fetch("https://api.github.com/user", { headers }), "the profile");

  // profile.email is null whenever the person keeps their address private, which
  // is the default, so the address always comes from this second call. Only the
  // primary one, and only if GitHub has confirmed it.
  const addresses = (await (
    await fetch("https://api.github.com/user/emails", { headers })
  ).json()) as { email: string; primary: boolean; verified: boolean }[];
  const primary = Array.isArray(addresses)
    ? addresses.find((a) => a.primary && a.verified) ?? addresses.find((a) => a.verified)
    : undefined;
  if (!primary) {
    throw new ServiceError(
      "validation",
      "your GitHub account has no verified email address; confirm one on GitHub and try again",
    );
  }
  return { providerUserId: String(profile.id), email: primary.email, emailVerified: true };
}
