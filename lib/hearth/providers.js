// The three outside doors: Google, GitHub, Discord.
//
// Google uses the ID-token flow the flame admin already trusts: the browser
// gets a signed token from Google, this side verifies it against Google's
// published keys. No client secret exists. GitHub and Discord use the
// authorization-code flow with a state nonce kept server-side; their secrets
// live only in Vercel and are read fresh on every call. Every provider must
// hand over a verified email or the sign-in is refused: an email is how a
// person is one person across doors.

import crypto from "node:crypto";
import { fetchGoogleKeys } from "../../api/admin-auth.js";
import { sql } from "./db.js";
import { normalizeEmail } from "./http.js";

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const STATE_TTL_MS = 10 * 60 * 1000;

export function providerConfig(env = process.env) {
  const read = (key) => (typeof env[key] === "string" ? env[key].trim() : "");
  return {
    google: { clientId: read("GOOGLE_CLIENT_ID") },
    github: { clientId: read("GITHUB_CLIENT_ID"), clientSecret: read("GITHUB_CLIENT_SECRET") },
    discord: { clientId: read("DISCORD_CLIENT_ID"), clientSecret: read("DISCORD_CLIENT_SECRET") }
  };
}

export function availableProviders(env = process.env) {
  const c = providerConfig(env);
  return {
    google: c.google.clientId || null,
    github: Boolean(c.github.clientId && c.github.clientSecret),
    discord: Boolean(c.discord.clientId && c.discord.clientSecret),
    email: true
  };
}

function decodeSegment(segment) {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/* ---------- Google ---------- */

export async function verifyGoogleIdToken(credential, dependencies = {}) {
  const deps = { fetch: globalThis.fetch, now: () => Date.now(), ...dependencies };
  const clientId = deps.clientId || providerConfig().google.clientId;
  if (!clientId) return { ok: false, reason: "unconfigured" };
  if (typeof credential !== "string" || credential.length > 8192) return { ok: false, reason: "malformed" };
  const parts = credential.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const header = decodeSegment(parts[0]);
  const claims = decodeSegment(parts[1]);
  if (!header || !claims || header.alg !== "RS256") return { ok: false, reason: "malformed" };
  let signature;
  try {
    signature = Buffer.from(parts[2], "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  let keys;
  try {
    keys = await fetchGoogleKeys(deps);
  } catch {
    return { ok: false, reason: "jwks" };
  }
  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`);
  const candidates = header.kid ? keys.filter((k) => k.kid === header.kid) : keys;
  const signed = candidates.some((jwk) => {
    try {
      return crypto.verify("RSA-SHA256", signingInput, crypto.createPublicKey({ key: jwk, format: "jwk" }), signature);
    } catch {
      return false;
    }
  });
  if (!signed) return { ok: false, reason: "signature" };
  if (!GOOGLE_ISSUERS.has(claims.iss)) return { ok: false, reason: "issuer" };
  if (claims.aud !== clientId) return { ok: false, reason: "audience" };
  const nowSeconds = Math.floor(deps.now() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds) return { ok: false, reason: "expired" };
  if (claims.email_verified !== true) return { ok: false, reason: "unverified" };
  const email = normalizeEmail(claims.email);
  if (!email || typeof claims.sub !== "string") return { ok: false, reason: "noEmail" };
  return {
    ok: true,
    identity: {
      provider: "google",
      providerId: claims.sub,
      email,
      name: typeof claims.name === "string" ? claims.name.slice(0, 120) : "",
      avatarUrl: typeof claims.picture === "string" && claims.picture.startsWith("https://") ? claims.picture : null
    }
  };
}

/* ---------- state for the redirect flows ---------- */

export async function issueState(provider, meta = {}) {
  const state = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
  await sql()`
    insert into oauth_states (state, provider, expires_at, meta)
    values (${state}, ${provider}, ${expiresAt}, ${JSON.stringify(meta)}::jsonb)
  `;
  return state;
}

export async function consumeState(provider, state) {
  if (typeof state !== "string" || state.length > 128) return null;
  const rows = await sql()`
    delete from oauth_states where state = ${state} and provider = ${provider} and expires_at > now()
    returning meta
  `;
  return rows[0] ? rows[0].meta || {} : null;
}

/* ---------- GitHub ---------- */

export function githubAuthorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function githubExchange({ code, redirectUri }, dependencies = {}) {
  const deps = { fetch: globalThis.fetch, ...dependencies };
  const config = deps.config || providerConfig().github;
  const tokenResponse = await deps.fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri
    })
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || typeof token.access_token !== "string") return { ok: false, reason: "exchange" };
  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "chama-hearth"
  };
  const [userResponse, emailsResponse] = await Promise.all([
    deps.fetch("https://api.github.com/user", { headers }),
    deps.fetch("https://api.github.com/user/emails", { headers })
  ]);
  const profile = await userResponse.json().catch(() => ({}));
  const emails = await emailsResponse.json().catch(() => []);
  if (!userResponse.ok || !Number.isFinite(profile.id)) return { ok: false, reason: "profile" };
  const primary = Array.isArray(emails)
    ? emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified)
    : null;
  if (!primary || typeof primary.email !== "string") return { ok: false, reason: "unverified" };
  return {
    ok: true,
    identity: {
      provider: "github",
      providerId: String(profile.id),
      email: normalizeEmail(primary.email),
      name: typeof profile.name === "string" && profile.name ? profile.name.slice(0, 120) : String(profile.login || ""),
      avatarUrl: typeof profile.avatar_url === "string" && profile.avatar_url.startsWith("https://") ? profile.avatar_url : null
    }
  };
}

/* ---------- Discord ---------- */

export function discordAuthorizeUrl({ clientId, redirectUri, state }) {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "none");
  return url.toString();
}

export async function discordExchange({ code, redirectUri }, dependencies = {}) {
  const deps = { fetch: globalThis.fetch, ...dependencies };
  const config = deps.config || providerConfig().discord;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri
  });
  const tokenResponse = await deps.fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || typeof token.access_token !== "string") return { ok: false, reason: "exchange" };
  const userResponse = await deps.fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  const profile = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || typeof profile.id !== "string") return { ok: false, reason: "profile" };
  if (profile.verified !== true || typeof profile.email !== "string") return { ok: false, reason: "unverified" };
  const avatar = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
    : null;
  return {
    ok: true,
    identity: {
      provider: "discord",
      providerId: profile.id,
      email: normalizeEmail(profile.email),
      name: String(profile.global_name || profile.username || "").slice(0, 120),
      avatarUrl: avatar
    }
  };
}
