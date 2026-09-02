// Sessions, tokens, passwords and rate limits.
//
// A browser session is an opaque 256-bit token in an HttpOnly cookie; the
// database holds only its SHA-256, so a read of the table yields nothing that
// signs anyone in. Sessions slide: each use past a few minutes extends the
// expiry, up to the ceiling. Every session can be revoked on its own or all at
// once, which is what "sign out everywhere" does.
//
// Passwords use scrypt with a per-user salt and are compared in constant
// time. Email tokens (magic links, verification, resets) are single use and
// short lived, and hashed at rest the same way.

import crypto from "node:crypto";
import { sql } from "./db.js";
import { cookie, readCookie } from "./http.js";

export const SESSION_COOKIE = "__Host-chama_hearth";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
const SESSION_TOUCH_SECONDS = 5 * 60;

export const EMAIL_TOKEN_TTL = {
  magic: 15 * 60,
  verify: 24 * 60 * 60,
  reset: 30 * 60,
  invite: 7 * 24 * 60 * 60
};

export const PASSWORD_MIN_LENGTH = 12;

// The most common passwords, so a long but obvious one is refused too. The
// list is short on purpose: it catches the bulk of credential-stuffing hits.
const WEAK_PASSWORDS = new Set([
  "password1234", "123456789012", "qwertyuiop12", "passwordpassword",
  "iloveyou1234", "adminadmin12", "letmeinletmein", "welcome12345",
  "chamainteligente", "chama1234567", "abcdefghijkl", "111111111111"
]);

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ---------- passwords ---------- */

export function passwordProblem(password) {
  if (typeof password !== "string") return "A password is required.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > 256) return "That password is too long.";
  if (WEAK_PASSWORDS.has(password.toLowerCase())) return "That password is too common.";
  if (/^(.)\1+$/.test(password)) return "That password is too simple.";
  return null;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== "string" || typeof password !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(parts[2], "base64url");
    const key = crypto.scryptSync(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return key.length === expected.length && crypto.timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/* ---------- browser sessions ---------- */

export async function createSession(userId, context, nowMs = Date.now()) {
  const token = randomToken(32);
  const expiresAt = new Date(nowMs + SESSION_TTL_SECONDS * 1000);
  await sql()`
    insert into login_sessions (user_id, token_hash, expires_at, device, country)
    values (${userId}, ${hashToken(token)}, ${expiresAt.toISOString()}, ${context.device || ""}, ${context.country || ""})
  `;
  return { token, expiresAt };
}

export function sessionCookie(token) {
  return cookie(SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS, path: "/", sameSite: "Lax" });
}

export function clearSessionCookie() {
  return cookie(SESSION_COOKIE, "", { maxAge: 0, path: "/", sameSite: "Lax" });
}

// Finds the live session behind a cookie, touching last_seen and sliding the
// expiry at most every few minutes. Returns null for anything not a session.
export async function readSession(request, nowMs = Date.now()) {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token || token.length > 128) return null;
  const rows = await sql()`
    select id, user_id, expires_at, last_seen_at, revoked_at, created_at
    from login_sessions where token_hash = ${hashToken(token)}
  `;
  const row = rows[0];
  if (!row || row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() <= nowMs) return null;
  // Sliding, but never past the ceiling from creation.
  if (new Date(row.created_at).getTime() + SESSION_MAX_AGE_SECONDS * 1000 <= nowMs) return null;
  const lastSeen = new Date(row.last_seen_at).getTime();
  if (nowMs - lastSeen > SESSION_TOUCH_SECONDS * 1000) {
    const expiresAt = new Date(nowMs + SESSION_TTL_SECONDS * 1000).toISOString();
    const now = new Date(nowMs).toISOString();
    await sql()`
      update login_sessions set last_seen_at = ${now}, expires_at = ${expiresAt} where id = ${row.id}
    `;
    await sql()`update users set last_seen_at = ${now} where id = ${row.user_id}`;
  }
  return { id: row.id, userId: row.user_id };
}

export async function revokeSession(sessionId, userId) {
  await sql()`
    update login_sessions set revoked_at = now()
    where id = ${sessionId} and user_id = ${userId} and revoked_at is null
  `;
}

export async function revokeAllSessions(userId, exceptSessionId = null) {
  await sql()`
    update login_sessions set revoked_at = now()
    where user_id = ${userId} and revoked_at is null
      and (${exceptSessionId}::uuid is null or id <> ${exceptSessionId}::uuid)
  `;
}

export async function listSessions(userId) {
  return await sql()`
    select id, created_at, last_seen_at, expires_at, device, country
    from login_sessions
    where user_id = ${userId} and revoked_at is null and expires_at > now()
    order by last_seen_at desc
  `;
}

/* ---------- email tokens ---------- */

export async function issueEmailToken({ email, userId = null, purpose, meta = {} }, nowMs = Date.now()) {
  const ttl = EMAIL_TOKEN_TTL[purpose];
  if (!ttl) throw new Error("UnknownTokenPurpose");
  const token = randomToken(32);
  const expiresAt = new Date(nowMs + ttl * 1000).toISOString();
  await sql()`
    insert into email_tokens (email, user_id, purpose, token_hash, expires_at, meta)
    values (${email}, ${userId}, ${purpose}, ${hashToken(token)}, ${expiresAt}, ${JSON.stringify(meta)}::jsonb)
  `;
  return token;
}

// Consumes a token: returns its row once and never again.
export async function consumeEmailToken(token, purpose) {
  if (typeof token !== "string" || token.length > 128) return null;
  const rows = await sql()`
    update email_tokens set used_at = now()
    where token_hash = ${hashToken(token)} and purpose = ${purpose}
      and used_at is null and expires_at > now()
    returning id, email, user_id, meta
  `;
  return rows[0] || null;
}

/* ---------- rate limits ---------- */

// Fixed windows in the database, keyed by whatever the caller chooses (an
// email, a hashed address, an endpoint). Returns true when the call is
// allowed. Storage trouble fails open: a database hiccup must not lock
// everyone out of signing in.
export async function allow(key, limit, windowSeconds, nowMs = Date.now()) {
  const windowStart = new Date(Math.floor(nowMs / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
  try {
    const rows = await sql()`
      insert into rate_limits (key, window_start, count) values (${key}, ${windowStart}, 1)
      on conflict (key) do update set
        count = case when rate_limits.window_start = excluded.window_start then rate_limits.count + 1 else 1 end,
        window_start = excluded.window_start
      returning count
    `;
    return (rows[0]?.count || 0) <= limit;
  } catch (error) {
    console.error("Rate limit check failed", error instanceof Error ? error.name : "UnknownError");
    return true;
  }
}

// The client address is only ever used hashed and only for rate limiting:
// it is never stored as itself and never reaches the audit log.
export function addressKey(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const address = forwarded.split(",")[0].trim() || "unknown";
  return crypto.createHash("sha256").update(address).digest("hex").slice(0, 24);
}
