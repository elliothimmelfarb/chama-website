// The Hearth as an OAuth 2.1 authorization server, so an agent can be
// connected the way MCP clients expect: discover the metadata, register
// itself, send the person to a consent page in the Hearth, and trade the
// code for tokens. PKCE (S256) is required, redirect URIs match exactly,
// codes live ten minutes and are single use, access tokens last an hour,
// refresh tokens rotate. Every token is stored as a hash.
//
// Scopes are coarse on purpose and are shown to the person in plain words
// at consent. A token can never do more than the person could.

import crypto from "node:crypto";
import { sql } from "./db.js";
import { hashToken, randomToken } from "./auth.js";

export const SCOPES = [
  { key: "profile", label: "Know who you are", detail: "Your name, email, role and timezone." },
  { key: "sessions", label: "See your sessions", detail: "Upcoming and past sessions, and your credit balance." },
  { key: "records", label: "Read your session records", detail: "Summaries, key points, decisions and the transcripts." },
  { key: "followups", label: "Read and update your follow-ups", detail: "Tick them off, add new ones." },
  { key: "booking", label: "Book, move and cancel sessions", detail: "Spends and returns your credits." },
  { key: "notes", label: "Leave notes for the next session", detail: "A note goes to Elliot as data he reads, never as instructions." },
  { key: "feed", label: "Read the members' feed", detail: "What Elliot is looking at." },
  { key: "business", label: "Run the business", detail: "Members, every session, metrics, the log, posting to the feed. Only if your role allows it." }
];

export const SCOPE_KEYS = SCOPES.map((s) => s.key);
export const DEFAULT_SCOPES = SCOPE_KEYS.filter((s) => s !== "business");

export const ACCESS_TTL_SECONDS = 60 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
export const CODE_TTL_SECONDS = 10 * 60;
export const REQUEST_TTL_SECONDS = 10 * 60;

export function parseScopes(value) {
  if (Array.isArray(value)) return value.filter((s) => SCOPE_KEYS.includes(s));
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/[\s,]+/).filter((s) => SCOPE_KEYS.includes(s)))];
}

export function metadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    scopes_supported: SCOPE_KEYS,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    service_documentation: `${origin}/hearth/agents`
  };
}

export function resourceMetadata(origin) {
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    scopes_supported: SCOPE_KEYS,
    bearer_methods_supported: ["header"],
    resource_name: "The Hearth, Chama Inteligente"
  };
}

/* ---------- clients ---------- */

function validRedirect(uri) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    // Loopback redirects are how local MCP clients (Claude Code, an IDE)
    // receive the code; nothing else may be plain http.
    if (u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "[::1]")) return true;
    return false;
  } catch {
    return false;
  }
}

// RFC 7591 dynamic registration. Public clients (no secret) are the norm
// for MCP; a client that asks for a secret gets one, shown once.
export async function registerClient(body, createdBy = null) {
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u) => typeof u === "string" && validRedirect(u)).slice(0, 10) : [];
  if (!uris.length) return { error: "invalid_redirect_uri", error_description: "At least one https (or loopback http) redirect_uri is required." };
  const method = ["none", "client_secret_post", "client_secret_basic"].includes(body.token_endpoint_auth_method) ? body.token_endpoint_auth_method : "none";
  const name = typeof body.client_name === "string" && body.client_name.trim() ? body.client_name.trim().slice(0, 120) : "An agent";
  const id = "chama_" + crypto.randomBytes(12).toString("base64url");
  const secret = method === "none" ? null : randomToken(32);
  const grants = ["authorization_code", "refresh_token"];
  const clientUri = typeof body.client_uri === "string" && /^https:\/\//.test(body.client_uri) ? body.client_uri.slice(0, 300) : null;
  const logoUri = typeof body.logo_uri === "string" && /^https:\/\//.test(body.logo_uri) ? body.logo_uri.slice(0, 300) : null;
  await sql()`
    insert into oauth_clients (id, secret_hash, name, redirect_uris, grant_types, token_endpoint_auth_method, client_uri, logo_uri, created_by)
    values (${id}, ${secret ? hashToken(secret) : null}, ${name}, ${uris}, ${grants}, ${method}, ${clientUri}, ${logoUri}, ${createdBy})
  `;
  return {
    client_id: id,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: name,
    redirect_uris: uris,
    grant_types: grants,
    response_types: ["code"],
    token_endpoint_auth_method: method,
    ...(clientUri ? { client_uri: clientUri } : {}),
    ...(logoUri ? { logo_uri: logoUri } : {})
  };
}

export async function findClient(id) {
  if (typeof id !== "string" || id.length > 64) return null;
  const rows = await sql()`select * from oauth_clients where id = ${id}`;
  return rows[0] || null;
}

/* ---------- the authorization request ---------- */

// Validates an authorize request and parks it for the consent page.
// Returns { requestId } or { error, redirect } (an error the client
// should see at its redirect) or { error } (an error shown here).
export async function startAuthorization(params) {
  const client = await findClient(params.client_id);
  if (!client) return { error: "invalid_client", description: "Unknown client." };
  const redirectUri = typeof params.redirect_uri === "string" ? params.redirect_uri : "";
  if (!client.redirect_uris.includes(redirectUri)) return { error: "invalid_request", description: "That redirect address is not registered for this client." };
  const back = (error, description) => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", error);
    if (description) u.searchParams.set("error_description", description);
    if (typeof params.state === "string") u.searchParams.set("state", params.state.slice(0, 500));
    return { error, redirect: u.toString() };
  };
  if (params.response_type !== "code") return back("unsupported_response_type");
  if (typeof params.code_challenge !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(params.code_challenge)) return back("invalid_request", "PKCE code_challenge is required.");
  if (params.code_challenge_method && params.code_challenge_method !== "S256") return back("invalid_request", "Only S256 is supported.");
  const scopes = params.scope ? parseScopes(params.scope) : DEFAULT_SCOPES;
  if (!scopes.length) return back("invalid_scope");
  const requestId = randomToken(24);
  const expiresAt = new Date(Date.now() + REQUEST_TTL_SECONDS * 1000).toISOString();
  await sql()`
    insert into oauth_states (state, provider, expires_at, meta)
    values (${requestId}, 'oauth', ${expiresAt}, ${JSON.stringify({
      clientId: client.id, redirectUri, scopes, codeChallenge: params.code_challenge,
      state: typeof params.state === "string" ? params.state.slice(0, 500) : null,
      resource: typeof params.resource === "string" ? params.resource.slice(0, 300) : null
    })}::jsonb)
  `;
  return { requestId };
}

export async function readAuthorization(requestId) {
  if (typeof requestId !== "string" || requestId.length > 128) return null;
  const rows = await sql()`select meta from oauth_states where state = ${requestId} and provider = 'oauth' and expires_at > now()`;
  if (!rows[0]) return null;
  const meta = rows[0].meta;
  const client = await findClient(meta.clientId);
  if (!client) return null;
  return { ...meta, client: { id: client.id, name: client.name, uri: client.client_uri, logo: client.logo_uri } };
}

// The person said yes: the request becomes a code at the client's redirect.
export async function approveAuthorization(requestId, userId, grantedScopes) {
  const rows = await sql()`delete from oauth_states where state = ${requestId} and provider = 'oauth' and expires_at > now() returning meta`;
  if (!rows[0]) return null;
  const meta = rows[0].meta;
  const scopes = parseScopes(grantedScopes).filter((s) => meta.scopes.includes(s));
  if (!scopes.length) return null;
  const code = randomToken(32);
  const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString();
  await sql()`
    insert into oauth_codes (code_hash, client_id, user_id, redirect_uri, scopes, code_challenge, code_challenge_method, resource, expires_at)
    values (${hashToken(code)}, ${meta.clientId}, ${userId}, ${meta.redirectUri}, ${scopes}, ${meta.codeChallenge}, 'S256', ${meta.resource}, ${expiresAt})
  `;
  const u = new URL(meta.redirectUri);
  u.searchParams.set("code", code);
  if (meta.state) u.searchParams.set("state", meta.state);
  return { redirect: u.toString(), clientId: meta.clientId, scopes };
}

export async function denyAuthorization(requestId) {
  const rows = await sql()`delete from oauth_states where state = ${requestId} and provider = 'oauth' returning meta`;
  if (!rows[0]) return null;
  const meta = rows[0].meta;
  const u = new URL(meta.redirectUri);
  u.searchParams.set("error", "access_denied");
  if (meta.state) u.searchParams.set("state", meta.state);
  return { redirect: u.toString() };
}

/* ---------- tokens ---------- */

function s256(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

async function authenticateClient(client, presentedSecret) {
  if (client.token_endpoint_auth_method === "none") return true;
  if (!client.secret_hash || typeof presentedSecret !== "string") return false;
  const a = Buffer.from(hashToken(presentedSecret));
  const b = Buffer.from(client.secret_hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function issueTokens(clientId, userId, scopes) {
  const access = randomToken(32);
  const refresh = randomToken(32);
  const accessExp = new Date(Date.now() + ACCESS_TTL_SECONDS * 1000).toISOString();
  const refreshExp = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString();
  const refreshRows = await sql()`
    insert into oauth_tokens (client_id, user_id, kind, token_hash, scopes, expires_at)
    values (${clientId}, ${userId}, 'refresh', ${hashToken(refresh)}, ${scopes}, ${refreshExp}) returning id
  `;
  await sql()`
    insert into oauth_tokens (client_id, user_id, kind, token_hash, scopes, parent_id, expires_at)
    values (${clientId}, ${userId}, 'access', ${hashToken(access)}, ${scopes}, ${refreshRows[0].id}, ${accessExp})
  `;
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refresh,
    scope: scopes.join(" ")
  };
}

export async function exchangeCode({ code, redirectUri, clientId, clientSecret, codeVerifier }) {
  const client = await findClient(clientId);
  if (!client || !(await authenticateClient(client, clientSecret))) return { error: "invalid_client" };
  if (typeof code !== "string" || code.length > 128) return { error: "invalid_grant" };
  const rows = await sql()`
    update oauth_codes set used_at = now()
    where code_hash = ${hashToken(code)} and client_id = ${client.id} and used_at is null and expires_at > now()
    returning *
  `;
  const row = rows[0];
  if (!row) return { error: "invalid_grant" };
  if (row.redirect_uri !== redirectUri) return { error: "invalid_grant", error_description: "redirect_uri does not match." };
  if (typeof codeVerifier !== "string" || s256(codeVerifier) !== row.code_challenge) return { error: "invalid_grant", error_description: "PKCE verification failed." };
  const user = await sql()`select status from users where id = ${row.user_id}`;
  if (!user[0] || user[0].status !== "active") return { error: "invalid_grant" };
  return await issueTokens(client.id, row.user_id, row.scopes);
}

// Refresh rotation: the old refresh token and its access tokens are revoked
// as the new pair is issued. Presenting a revoked refresh token again
// revokes the whole family, the standard answer to a stolen token.
export async function refreshTokens({ refreshToken, clientId, clientSecret, scope }) {
  const client = await findClient(clientId);
  if (!client || !(await authenticateClient(client, clientSecret))) return { error: "invalid_client" };
  if (typeof refreshToken !== "string" || refreshToken.length > 128) return { error: "invalid_grant" };
  const rows = await sql()`select * from oauth_tokens where token_hash = ${hashToken(refreshToken)} and kind = 'refresh' and client_id = ${client.id}`;
  const row = rows[0];
  if (!row) return { error: "invalid_grant" };
  if (row.revoked_at) {
    await sql()`update oauth_tokens set revoked_at = now() where user_id = ${row.user_id} and client_id = ${client.id} and revoked_at is null`;
    return { error: "invalid_grant" };
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) return { error: "invalid_grant" };
  await sql()`update oauth_tokens set revoked_at = now() where id = ${row.id} or parent_id = ${row.id}`;
  const scopes = scope ? parseScopes(scope).filter((s) => row.scopes.includes(s)) : row.scopes;
  if (!scopes.length) return { error: "invalid_scope" };
  return await issueTokens(client.id, row.user_id, scopes);
}

export async function revokeToken({ token, clientId, clientSecret }) {
  const client = await findClient(clientId);
  if (!client || !(await authenticateClient(client, clientSecret))) return false;
  if (typeof token !== "string") return true;
  const rows = await sql()`select id, kind, parent_id from oauth_tokens where token_hash = ${hashToken(token)} and client_id = ${client.id}`;
  const row = rows[0];
  if (!row) return true;
  const family = row.kind === "refresh" ? row.id : row.parent_id;
  await sql()`update oauth_tokens set revoked_at = now() where revoked_at is null and (id = ${row.id} or id = ${family} or parent_id = ${family})`;
  return true;
}

// A bearer token to its user and scopes, or null.
export async function readAccessToken(token) {
  if (typeof token !== "string" || token.length > 128) return null;
  const rows = await sql()`
    select t.id, t.user_id, t.scopes, t.client_id, c.name as client_name from oauth_tokens t join oauth_clients c on c.id = t.client_id
    where t.token_hash = ${hashToken(token)} and t.kind = 'access' and t.revoked_at is null and t.expires_at > now()
  `;
  const row = rows[0];
  if (!row) return null;
  await sql()`update oauth_tokens set last_used_at = now() where id = ${row.id}`;
  return { userId: row.user_id, scopes: row.scopes, clientId: row.client_id, clientName: row.client_name };
}

// What the member sees as "connected apps": one row per client with a live
// refresh token.
export async function connectedApps(userId) {
  return await sql()`
    select c.id, c.name, c.client_uri, c.logo_uri, max(t.created_at) as connected_at, max(t.last_used_at) as last_used_at,
           (array_agg(t.scopes order by t.created_at desc))[1] as scopes
    from oauth_tokens t join oauth_clients c on c.id = t.client_id
    where t.user_id = ${userId} and t.kind = 'refresh' and t.revoked_at is null and t.expires_at > now()
    group by c.id, c.name, c.client_uri, c.logo_uri order by max(t.created_at) desc
  `;
}

export async function disconnectApp(userId, clientId) {
  await sql()`update oauth_tokens set revoked_at = now() where user_id = ${userId} and client_id = ${clientId} and revoked_at is null`;
}

/* ---------- API keys ---------- */

export const KEY_PREFIX = "chama_sk_";

export async function createApiKey({ userId, name, scopes, expiresAt = null }) {
  const secret = KEY_PREFIX + randomToken(32);
  const rows = await sql()`
    insert into api_keys (user_id, name, prefix, key_hash, scopes, expires_at)
    values (${userId}, ${name}, ${secret.slice(0, KEY_PREFIX.length + 8)}, ${hashToken(secret)}, ${scopes}, ${expiresAt})
    returning id, prefix, created_at
  `;
  return { secret, id: rows[0].id, prefix: rows[0].prefix, createdAt: rows[0].created_at };
}

export async function readApiKey(secret) {
  if (typeof secret !== "string" || !secret.startsWith(KEY_PREFIX) || secret.length > 128) return null;
  const rows = await sql()`
    select id, user_id, scopes, prefix, name from api_keys
    where key_hash = ${hashToken(secret)} and revoked_at is null and (expires_at is null or expires_at > now())
  `;
  const row = rows[0];
  if (!row) return null;
  await sql()`update api_keys set last_used_at = now() where id = ${row.id}`;
  return { userId: row.user_id, scopes: row.scopes, keyId: row.id, prefix: row.prefix, name: row.name };
}
