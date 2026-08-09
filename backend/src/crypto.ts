import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Sealing one thing: a user's own key to Google's API. Passwords are hashed
// with argon2 and never come back; this has to come back, because every call to
// Gemini needs the key itself.
//
// AES-256-GCM rather than plain AES: GCM authenticates as well as encrypts, so
// a row someone edited in the database fails to open instead of decrypting into
// a different key. The encryption key is derived from JWT_SECRET, which the
// server already cannot run without, so this adds no new secret to lose. Losing
// that one means the sealed keys are unreadable - which is the point, and why
// the user can always paste a new key.

const ALGORITHM = "aes-256-gcm";
// A fixed salt is the correct trade here: the input is one long random secret,
// not a password, so the salt is not defending against a dictionary and a
// per-row salt would only mean storing it next to the ciphertext.
const SALT = "ariadne.gemini-key.v1";

// Derived once. scrypt is slow on purpose, and every entry written and every
// question asked opens this key: deriving it per call would put a tenth of a
// second on the front of each one for no security at all, since the input never
// changes while the process lives.
let derived: Buffer | null = null;

function secret(): Buffer {
  if (derived) return derived;
  const jwt = process.env.JWT_SECRET;
  if (!jwt) throw new Error("JWT_SECRET is not set (add it to .env)");
  derived = scryptSync(jwt, SALT, 32);
  return derived;
}

/** iv:tag:ciphertext, all base64url, which survives any text column. */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, secret(), iv);
  const sealed = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), sealed].map((b) => b.toString("base64url")).join(":");
}

/** Null for anything this did not write: a changed secret, a hand-edited row. */
export function open(sealed: string): string | null {
  try {
    const [iv, tag, body] = sealed.split(":").map((part) => Buffer.from(part, "base64url"));
    if (!iv || !tag || !body) return null;
    const decipher = createDecipheriv(ALGORITHM, secret(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
