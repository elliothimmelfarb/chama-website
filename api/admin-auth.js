// The door to the admin area.
//
// Google Identity Services hands the page an ID token. This endpoint verifies
// that token against Google's published keys, checks the email against a small
// allowlist, and issues an HMAC-signed cookie that the admin endpoints trust.
// There is no client secret anywhere: the flow only ever needs the public
// client id, so nothing here can leak a credential that opens anything else.
//
// Everything fails closed. A missing env var is a 503 (the area is not
// configured), and every rejected sign-in is the same generic 401 with no hint
// about which check failed. The token, the email and the cookie are never
// logged: the console only ever sees an error name.

import crypto from "node:crypto";

export const SESSION_COOKIE = "chama_admin";

export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

const JWKS_DEFAULT_TTL_MS = 60 * 60 * 1000;

// A signing secret shorter than this is a misconfiguration, not a weak choice.
const MIN_SECRET_LENGTH = 32;

export const MESSAGES = {
  rejected: "Sign-in was not accepted.",
  unconfigured: "The admin area is not configured.",
  refused: "This request could not be accepted."
};

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

// Copied from api/chat.js so the admin endpoints refuse cross-site posts the
// same way the public ones do.
export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const submittedHost = new URL(origin).host;
    const forwardedHost = request.headers.get("x-forwarded-host");
    const requestHost = forwardedHost || new URL(request.url).host;
    return submittedHost === requestHost;
  } catch {
    return false;
  }
}

export function parseAdminEmails(value) {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

// The three env vars the area needs. Any one missing means the whole area is
// unconfigured: there is no half-open state where sign-in works but sessions
// cannot be checked.
export function adminConfig(env = process.env) {
  const clientId = typeof env.GOOGLE_CLIENT_ID === "string" ? env.GOOGLE_CLIENT_ID.trim() : "";
  const secret =
    typeof env.ADMIN_SESSION_SECRET === "string" ? env.ADMIN_SESSION_SECRET.trim() : "";
  const admins = parseAdminEmails(env.ADMIN_EMAILS);

  const configured = Boolean(clientId) && admins.length > 0 && secret.length >= MIN_SECRET_LENGTH;

  return { clientId, admins, secret, configured };
}

// Every entry point takes the same dependencies object, so a test can hand in
// an env (or a ready-made config) and nothing reaches process.env or the network.
function configFrom(dependencies) {
  return dependencies.config || adminConfig(dependencies.env || process.env);
}

function base64UrlEncode(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url");
}

function decodeJsonSegment(segment) {
  try {
    return JSON.parse(base64UrlDecode(segment).toString("utf8"));
  } catch {
    return null;
  }
}

let jwksCache = null;

export function resetJwksCache() {
  jwksCache = null;
}

function maxAgeMs(header) {
  const match = /max-age=(\d+)/i.exec(typeof header === "string" ? header : "");
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

// Google rotates these keys, so the set is cached for whatever its own
// cache-control says and an hour otherwise. A failed fetch is not cached: the
// next sign-in tries again rather than being locked out for an hour.
export async function fetchGoogleKeys(dependencies = {}) {
  const deps = { fetch: globalThis.fetch, now: () => Date.now(), ...dependencies };
  const at = deps.now();

  if (jwksCache && at < jwksCache.expiresAt) {
    return jwksCache.keys;
  }

  const response = await deps.fetch(GOOGLE_JWKS_URL);
  if (!response || response.ok === false) {
    throw new Error("JwksFetchError");
  }

  const body = await response.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  if (!keys.length) {
    throw new Error("JwksEmptyError");
  }

  const ttl = maxAgeMs(response.headers?.get?.("cache-control")) ?? JWKS_DEFAULT_TTL_MS;
  jwksCache = { keys, expiresAt: at + ttl };
  return keys;
}

function verifySignature(jwk, signingInput, signature) {
  try {
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    return crypto.verify("RSA-SHA256", Buffer.from(signingInput), key, signature);
  } catch {
    return false;
  }
}

// Full verification of a Google ID token: RS256 signature against the
// published keys, then every claim that matters. Returns the verified email or
// a short reason code that stays on this side of the wire (the caller answers
// with one generic message whatever the reason was).
export async function verifyIdToken(credential, dependencies = {}) {
  const deps = { fetch: globalThis.fetch, now: () => Date.now(), ...dependencies };

  const config = configFrom(deps);
  if (!config.configured) return { ok: false, reason: "unconfigured" };

  if (typeof credential !== "string" || credential.length > 8192) {
    return { ok: false, reason: "malformed" };
  }

  const parts = credential.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };

  const header = decodeJsonSegment(parts[0]);
  const claims = decodeJsonSegment(parts[1]);
  if (!header || !claims) return { ok: false, reason: "malformed" };
  if (header.alg !== "RS256") return { ok: false, reason: "alg" };

  let signature;
  try {
    signature = base64UrlDecode(parts[2]);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!signature.length) return { ok: false, reason: "malformed" };

  let keys;
  try {
    keys = await fetchGoogleKeys(deps);
  } catch (error) {
    console.error("Admin JWKS fetch failed", error instanceof Error ? error.name : "UnknownError");
    return { ok: false, reason: "jwks" };
  }

  const signingInput = `${parts[0]}.${parts[1]}`;
  const candidates = header.kid ? keys.filter((key) => key.kid === header.kid) : keys;
  const signed = candidates.some((jwk) => verifySignature(jwk, signingInput, signature));
  if (!signed) return { ok: false, reason: "signature" };

  if (!GOOGLE_ISSUERS.has(claims.iss)) return { ok: false, reason: "issuer" };
  if (claims.aud !== config.clientId) return { ok: false, reason: "audience" };

  const nowSeconds = Math.floor(deps.now() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds) {
    return { ok: false, reason: "expired" };
  }
  if (Number.isFinite(claims.nbf) && claims.nbf > nowSeconds + 60) {
    return { ok: false, reason: "notYet" };
  }
  if (claims.email_verified !== true) return { ok: false, reason: "unverified" };

  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) return { ok: false, reason: "noEmail" };
  if (!config.admins.includes(email)) return { ok: false, reason: "notAllowed" };

  return { ok: true, email };
}

function sign(payloadSegment, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`v1.${payloadSegment}`)
    .digest("base64url");
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function signSession({ email, exp }, secret) {
  const payload = base64UrlEncode(JSON.stringify({ email, exp }));
  return `v1.${payload}.${sign(payload, secret)}`;
}

export function verifySession(value, secret, nowSeconds) {
  if (typeof value !== "string" || !secret) return null;

  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  if (!constantTimeEqual(parts[2], sign(parts[1], secret))) return null;

  const payload = decodeJsonSegment(parts[1]);
  if (!payload || typeof payload.email !== "string") return null;
  if (!Number.isFinite(payload.exp) || payload.exp <= nowSeconds) return null;

  return { email: payload.email };
}

// Path is /api/ because the cookie is only ever read by these functions: the
// static admin page never needs it, so it never travels with page requests.
export function makeSessionCookie({ email, exp }, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const maxAge = Math.max(0, exp - nowSeconds);
  return [
    `${SESSION_COOKIE}=${signSession({ email, exp }, secret)}`,
    "HttpOnly",
    "Secure",
    "Path=/api/",
    "SameSite=Strict",
    `Max-Age=${maxAge}`
  ].join("; ");
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; Path=/api/; SameSite=Strict; Max-Age=0`;
}

export function readCookie(header, name) {
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return null;
}

export function readSession(request, dependencies = {}) {
  const deps = { now: () => Date.now(), ...dependencies };
  const config = configFrom(deps);
  if (!config.configured) return null;

  const value = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  return verifySession(value, config.secret, Math.floor(deps.now() / 1000));
}

// The allowlist is checked again on every request, not only at sign-in, so
// taking an address out of ADMIN_EMAILS ends its live sessions too.
export function requireAdmin(request, dependencies = {}) {
  const deps = { now: () => Date.now(), ...dependencies };
  const session = readSession(request, deps);
  if (!session) return null;
  if (!configFrom(deps).admins.includes(session.email)) return null;
  return session;
}

export async function handleAdminAuth(request, dependencies = {}) {
  const deps = { fetch: globalThis.fetch, now: () => Date.now(), ...dependencies };

  const config = configFrom(deps);

  if (request.method === "GET") {
    if (!config.configured) return json({ error: MESSAGES.unconfigured }, 503);
    return json({ clientId: config.clientId });
  }

  if (!isSameOrigin(request)) {
    return json({ error: MESSAGES.refused }, 403);
  }

  if (request.method === "DELETE") {
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { Allow: "GET, POST, DELETE", "Cache-Control": "no-store" }
    });
  }

  if (!config.configured) return json({ error: MESSAGES.unconfigured }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: MESSAGES.rejected }, 401);
  }

  const result = await verifyIdToken(body?.credential, { ...deps, config });
  if (!result.ok) {
    console.warn("Admin sign-in rejected", result.reason);
    return json({ error: MESSAGES.rejected }, 401);
  }

  const nowSeconds = Math.floor(deps.now() / 1000);
  const exp = nowSeconds + SESSION_TTL_SECONDS;

  return json({ ok: true, email: result.email }, 200, {
    "Set-Cookie": makeSessionCookie({ email: result.email, exp }, config.secret, nowSeconds)
  });
}

export default {
  async fetch(request) {
    return await handleAdminAuth(request);
  }
};
