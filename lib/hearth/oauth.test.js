import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { useClient } from "./db.js";
import { fakeDb } from "./test-helpers.js";
import { hashToken } from "./auth.js";
import {
  ACCESS_TTL_SECONDS, DEFAULT_SCOPES, KEY_PREFIX, SCOPE_KEYS,
  approveAuthorization, createApiKey, denyAuthorization, exchangeCode, metadata,
  parseScopes, readAccessToken, readApiKey, refreshTokens, registerClient,
  resourceMetadata, revokeToken, startAuthorization
} from "./oauth.js";

// A dummy connection string is enough: useClient means neon() is never
// called, so nothing here can reach a database.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";

const ORIGIN = "https://chamainteligente.com";
const REDIRECT = "https://app.example.com/callback";

const s256 = (verifier) => crypto.createHash("sha256").update(verifier).digest("base64url");
const VERIFIER = "a".repeat(64);
const CHALLENGE = s256(VERIFIER);

function clientRow(overrides = {}) {
  return {
    id: "chama_abc",
    secret_hash: null,
    name: "An agent",
    redirect_uris: [REDIRECT],
    grant_types: ["authorization_code", "refresh_token"],
    token_endpoint_auth_method: "none",
    client_uri: null,
    logo_uri: null,
    ...overrides
  };
}

const clientHandler = (row) => [/from oauth_clients where id/, row ? [row] : []];

/* ---------- scopes and discovery ---------- */

test("parseScopes reads a string or an array, drops the unknown and dedupes", () => {
  assert.deepEqual(parseScopes("profile sessions"), ["profile", "sessions"]);
  assert.deepEqual(parseScopes("profile,sessions"), ["profile", "sessions"]);
  assert.deepEqual(parseScopes("profile profile sessions"), ["profile", "sessions"]);
  assert.deepEqual(parseScopes("profile wizardry"), ["profile"]);
  assert.deepEqual(parseScopes(["profile", "nope", "business"]), ["profile", "business"]);
  assert.deepEqual(parseScopes(undefined), []);
  assert.deepEqual(parseScopes(42), []);
  assert.ok(!DEFAULT_SCOPES.includes("business"));
});

test("the metadata documents describe this server and only S256", () => {
  const doc = metadata(ORIGIN);
  assert.equal(doc.issuer, ORIGIN);
  for (const key of ["authorization_endpoint", "token_endpoint", "registration_endpoint", "revocation_endpoint"]) {
    assert.ok(doc[key].startsWith(`${ORIGIN}/api/oauth/`), `${key} lives under the origin`);
  }
  assert.deepEqual(doc.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(doc.response_types_supported, ["code"]);
  assert.deepEqual(doc.grant_types_supported, ["authorization_code", "refresh_token"]);
  assert.deepEqual(doc.scopes_supported, SCOPE_KEYS);

  const resource = resourceMetadata(ORIGIN);
  assert.equal(resource.resource, `${ORIGIN}/mcp`);
  assert.deepEqual(resource.authorization_servers, [ORIGIN]);
  assert.deepEqual(resource.bearer_methods_supported, ["header"]);
});

/* ---------- registration ---------- */

test("registration refuses a client with no usable redirect address", async () => {
  const db = fakeDb();
  useClient(db);
  for (const uris of [undefined, [], ["http://example.com/cb"], ["https://app.example.com/cb#frag"], ["not a url"]]) {
    const result = await registerClient({ redirect_uris: uris });
    assert.equal(result.error, "invalid_redirect_uri", JSON.stringify(uris));
  }
  assert.equal(db.count(/insert into oauth_clients/), 0);
});

test("registration accepts https and loopback http, and assigns a chama_ id", async () => {
  const db = fakeDb();
  useClient(db);
  const result = await registerClient({
    redirect_uris: [REDIRECT, "http://127.0.0.1:52111/cb", "http://localhost:8080/cb"],
    client_name: "  Claude Code  "
  });
  assert.ok(result.client_id.startsWith("chama_"));
  assert.equal(result.client_name, "Claude Code");
  assert.equal(result.token_endpoint_auth_method, "none");
  assert.deepEqual(result.response_types, ["code"]);
  assert.deepEqual(result.redirect_uris, [REDIRECT, "http://127.0.0.1:52111/cb", "http://localhost:8080/cb"]);
  assert.equal(result.client_secret, undefined);
  const insert = db.matching(/insert into oauth_clients/)[0];
  assert.equal(insert.values[0], result.client_id);
  assert.equal(insert.values[1], null);
});

test("a confidential client is handed a secret once and only its hash is stored", async () => {
  const db = fakeDb();
  useClient(db);
  const result = await registerClient({ redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_post" });
  assert.equal(typeof result.client_secret, "string");
  assert.equal(result.client_secret_expires_at, 0);
  const insert = db.matching(/insert into oauth_clients/)[0];
  assert.equal(insert.values[1], hashToken(result.client_secret));
  assert.ok(!insert.values.includes(result.client_secret), "the secret itself is never stored");
});

/* ---------- the authorization request ---------- */

test("an unknown client or an unregistered redirect is refused without redirecting", async () => {
  useClient(fakeDb([clientHandler(null)]));
  const unknown = await startAuthorization({ client_id: "chama_nope", redirect_uri: REDIRECT, response_type: "code", code_challenge: CHALLENGE });
  assert.equal(unknown.error, "invalid_client");
  assert.equal(unknown.redirect, undefined);

  useClient(fakeDb([clientHandler(clientRow())]));
  const stranger = await startAuthorization({ client_id: "chama_abc", redirect_uri: "https://elsewhere.example.com/cb", response_type: "code", code_challenge: CHALLENGE });
  assert.equal(stranger.error, "invalid_request");
  assert.equal(stranger.redirect, undefined);
});

test("a malformed request comes back at the client's redirect with the error and the state", async () => {
  const base = { client_id: "chama_abc", redirect_uri: REDIRECT, code_challenge: CHALLENGE, state: "xyz" };
  const cases = [
    [{ ...base, response_type: "token" }, "unsupported_response_type"],
    [{ ...base, response_type: "code", code_challenge: undefined }, "invalid_request"],
    [{ ...base, response_type: "code", code_challenge: "short" }, "invalid_request"],
    [{ ...base, response_type: "code", code_challenge_method: "plain" }, "invalid_request"]
  ];
  for (const [params, expected] of cases) {
    useClient(fakeDb([clientHandler(clientRow())]));
    const result = await startAuthorization(params);
    assert.equal(result.error, expected);
    const url = new URL(result.redirect);
    assert.equal(url.origin + url.pathname, REDIRECT);
    assert.equal(url.searchParams.get("error"), expected);
    assert.equal(url.searchParams.get("state"), "xyz");
  }
});

test("a good request is parked in oauth_states and answered with a request id", async () => {
  const db = fakeDb([clientHandler(clientRow())]);
  useClient(db);
  const result = await startAuthorization({
    client_id: "chama_abc", redirect_uri: REDIRECT, response_type: "code",
    code_challenge: CHALLENGE, code_challenge_method: "S256", scope: "profile sessions", state: "xyz"
  });
  assert.equal(typeof result.requestId, "string");
  assert.ok(result.requestId.length > 20);
  const insert = db.matching(/insert into oauth_states/)[0];
  assert.ok(insert, "the request is parked");
  assert.ok(/'oauth'/.test(insert.text), "parked with provider 'oauth'");
  assert.equal(insert.values[0], result.requestId);
  const meta = JSON.parse(insert.values[2]);
  assert.deepEqual(meta, {
    clientId: "chama_abc", redirectUri: REDIRECT, scopes: ["profile", "sessions"],
    codeChallenge: CHALLENGE, state: "xyz", resource: null
  });
});

/* ---------- consent ---------- */

const pendingMeta = {
  clientId: "chama_abc", redirectUri: REDIRECT, scopes: ["profile", "sessions", "records"],
  codeChallenge: CHALLENGE, state: "xyz", resource: null
};

test("approving stores the hash of the code and hands the code to the client", async () => {
  const db = fakeDb([[/delete from oauth_states/, [{ meta: pendingMeta }]]]);
  useClient(db);
  const result = await approveAuthorization("req-1", "user-1", ["profile", "sessions", "business"]);
  assert.deepEqual(result.scopes, ["profile", "sessions"], "granted scopes are filtered to the requested ones");
  const url = new URL(result.redirect);
  const code = url.searchParams.get("code");
  assert.equal(url.searchParams.get("state"), "xyz");
  const insert = db.matching(/insert into oauth_codes/)[0];
  assert.equal(insert.values[0], hashToken(code));
  assert.ok(!insert.values.includes(code), "the code itself is never stored");
  assert.equal(insert.values[2], "user-1");
});

test("an expired request cannot be approved", async () => {
  useClient(fakeDb([[/delete from oauth_states/, []]]));
  assert.equal(await approveAuthorization("req-1", "user-1", ["profile"]), null);
});

test("denying sends the person back with access_denied and the state", async () => {
  useClient(fakeDb([[/delete from oauth_states/, [{ meta: pendingMeta }]]]));
  const result = await denyAuthorization("req-1");
  const url = new URL(result.redirect);
  assert.equal(url.searchParams.get("error"), "access_denied");
  assert.equal(url.searchParams.get("state"), "xyz");
});

/* ---------- the token endpoint ---------- */

function codeRow(overrides = {}) {
  return {
    id: "code-1",
    client_id: "chama_abc",
    user_id: "user-1",
    redirect_uri: REDIRECT,
    scopes: ["profile", "sessions"],
    code_challenge: CHALLENGE,
    code_challenge_method: "S256",
    ...overrides
  };
}

function tokenDb(handlers = []) {
  return fakeDb([
    ...handlers,
    [/insert into oauth_tokens[\s\S]*'refresh'/, [{ id: "refresh-1" }]],
    [/select status from users/, [{ status: "active" }]]
  ]);
}

test("the code grant refuses an unknown client and a wrong secret", async () => {
  useClient(tokenDb([clientHandler(null)]));
  assert.deepEqual(await exchangeCode({ code: "c", redirectUri: REDIRECT, clientId: "chama_nope", codeVerifier: VERIFIER }), { error: "invalid_client" });

  const confidential = clientRow({ token_endpoint_auth_method: "client_secret_post", secret_hash: hashToken("the-real-secret") });
  useClient(tokenDb([clientHandler(confidential)]));
  assert.deepEqual(
    await exchangeCode({ code: "c", redirectUri: REDIRECT, clientId: "chama_abc", clientSecret: "wrong", codeVerifier: VERIFIER }),
    { error: "invalid_client" }
  );
});

test("a used or expired code, a mismatched redirect and a wrong verifier are all invalid_grant", async () => {
  useClient(tokenDb([clientHandler(clientRow()), [/update oauth_codes set used_at/, []]]));
  assert.deepEqual(
    await exchangeCode({ code: "c", redirectUri: REDIRECT, clientId: "chama_abc", codeVerifier: VERIFIER }),
    { error: "invalid_grant" }
  );

  useClient(tokenDb([clientHandler(clientRow()), [/update oauth_codes set used_at/, [codeRow()]]]));
  const mismatch = await exchangeCode({ code: "c", redirectUri: "https://app.example.com/other", clientId: "chama_abc", codeVerifier: VERIFIER });
  assert.equal(mismatch.error, "invalid_grant");

  useClient(tokenDb([clientHandler(clientRow()), [/update oauth_codes set used_at/, [codeRow()]]]));
  const badVerifier = await exchangeCode({ code: "c", redirectUri: REDIRECT, clientId: "chama_abc", codeVerifier: "b".repeat(64) });
  assert.equal(badVerifier.error, "invalid_grant");
});

test("the right verifier issues a refresh token and an access token that hangs off it", async () => {
  const db = tokenDb([clientHandler(clientRow()), [/update oauth_codes set used_at/, [codeRow()]]]);
  useClient(db);
  const result = await exchangeCode({ code: "c", redirectUri: REDIRECT, clientId: "chama_abc", codeVerifier: VERIFIER });
  assert.equal(typeof result.access_token, "string");
  assert.equal(typeof result.refresh_token, "string");
  assert.equal(result.token_type, "Bearer");
  assert.equal(result.expires_in, ACCESS_TTL_SECONDS);
  assert.equal(result.expires_in, 3600);
  assert.equal(result.scope, "profile sessions");

  const inserts = db.matching(/insert into oauth_tokens/);
  assert.equal(inserts.length, 2);
  assert.ok(/'refresh'/.test(inserts[0].text));
  assert.equal(inserts[0].values[2], hashToken(result.refresh_token));
  assert.ok(/'access'/.test(inserts[1].text));
  assert.ok(/parent_id/.test(inserts[1].text));
  assert.equal(inserts[1].values[2], hashToken(result.access_token));
  assert.equal(inserts[1].values[4], "refresh-1");
});

/* ---------- refresh ---------- */

function refreshRow(overrides = {}) {
  return {
    id: "refresh-old",
    user_id: "user-1",
    client_id: "chama_abc",
    kind: "refresh",
    scopes: ["profile", "sessions"],
    revoked_at: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    ...overrides
  };
}

test("a revoked refresh token revokes the whole family and grants nothing", async () => {
  const db = tokenDb([
    clientHandler(clientRow()),
    [/select \* from oauth_tokens where token_hash/, [refreshRow({ revoked_at: new Date().toISOString() })]]
  ]);
  useClient(db);
  const result = await refreshTokens({ refreshToken: "r", clientId: "chama_abc" });
  assert.deepEqual(result, { error: "invalid_grant" });
  const revoke = db.matching(/update oauth_tokens set revoked_at/)[0];
  assert.ok(/user_id = \$1 and client_id = \$2 and revoked_at is null/.test(revoke.text));
  assert.deepEqual(revoke.values, ["user-1", "chama_abc"]);
  assert.equal(db.count(/insert into oauth_tokens/), 0);
});

test("a live refresh token is rotated, and can be narrowed", async () => {
  const db = tokenDb([clientHandler(clientRow()), [/select \* from oauth_tokens where token_hash/, [refreshRow()]]]);
  useClient(db);
  const result = await refreshTokens({ refreshToken: "r", clientId: "chama_abc" });
  assert.equal(result.scope, "profile sessions");
  const revoke = db.matching(/update oauth_tokens set revoked_at/)[0];
  assert.ok(/id = \$1 or parent_id = \$2/.test(revoke.text));
  assert.deepEqual(revoke.values, ["refresh-old", "refresh-old"]);
  assert.equal(db.count(/insert into oauth_tokens/), 2);

  const narrowed = tokenDb([clientHandler(clientRow()), [/select \* from oauth_tokens where token_hash/, [refreshRow()]]]);
  useClient(narrowed);
  const smaller = await refreshTokens({ refreshToken: "r", clientId: "chama_abc", scope: "profile business" });
  assert.equal(smaller.scope, "profile", "a refresh can narrow but never widen");
});

test("an expired refresh token is invalid_grant", async () => {
  useClient(tokenDb([
    clientHandler(clientRow()),
    [/select \* from oauth_tokens where token_hash/, [refreshRow({ expires_at: new Date(Date.now() - 1000).toISOString() })]]
  ]));
  assert.deepEqual(await refreshTokens({ refreshToken: "r", clientId: "chama_abc" }), { error: "invalid_grant" });
});

/* ---------- revocation and reading ---------- */

test("revoking is quiet about tokens it does not know and revokes the family of one it does", async () => {
  useClient(fakeDb([clientHandler(clientRow()), [/select id, kind, parent_id from oauth_tokens/, []]]));
  assert.equal(await revokeToken({ token: "nothing", clientId: "chama_abc" }), true);

  const db = fakeDb([
    clientHandler(clientRow()),
    [/select id, kind, parent_id from oauth_tokens/, [{ id: "access-1", kind: "access", parent_id: "refresh-1" }]]
  ]);
  useClient(db);
  assert.equal(await revokeToken({ token: "a", clientId: "chama_abc" }), true);
  const revoke = db.matching(/update oauth_tokens set revoked_at/)[0];
  assert.deepEqual(revoke.values, ["access-1", "refresh-1", "refresh-1"]);

  useClient(fakeDb([clientHandler(null)]));
  assert.equal(await revokeToken({ token: "a", clientId: "chama_nope" }), false);
});

test("an access token reads back as a grant and marks itself used, or reads back as nothing", async () => {
  useClient(fakeDb([[/from oauth_tokens t join oauth_clients c/, []]]));
  assert.equal(await readAccessToken("gone"), null);
  assert.equal(await readAccessToken(undefined), null);
  assert.equal(await readAccessToken("x".repeat(200)), null);

  const db = fakeDb([[
    /from oauth_tokens t join oauth_clients c/,
    [{ id: "access-1", user_id: "user-1", scopes: ["profile"], client_id: "chama_abc", client_name: "An agent" }]
  ]]);
  useClient(db);
  assert.deepEqual(await readAccessToken("live"), {
    userId: "user-1", scopes: ["profile"], clientId: "chama_abc", clientName: "An agent"
  });
  const touch = db.matching(/update oauth_tokens set last_used_at/)[0];
  assert.deepEqual(touch.values, ["access-1"]);
});

/* ---------- API keys ---------- */

test("a new API key is shown once and stored as a hash with a readable prefix", async () => {
  const db = fakeDb([[/insert into api_keys/, (call) => [{ id: "key-1", prefix: call.values[2], created_at: "2026-09-02T10:00:00.000Z" }]]]);
  useClient(db);
  const key = await createApiKey({ userId: "user-1", name: "Laptop", scopes: ["profile"] });
  assert.ok(key.secret.startsWith(KEY_PREFIX));
  const insert = db.matching(/insert into api_keys/)[0];
  assert.equal(insert.values[2], key.secret.slice(0, KEY_PREFIX.length + 8));
  assert.equal(insert.values[3], hashToken(key.secret));
  assert.ok(!insert.values.includes(key.secret), "the secret itself is never stored");
  assert.equal(key.prefix, insert.values[2]);
});

test("a string without the key prefix is refused without touching the database", async () => {
  const db = fakeDb();
  useClient(db);
  assert.equal(await readApiKey("sk-something-else"), null);
  assert.equal(await readApiKey(null), null);
  assert.equal(await readApiKey(KEY_PREFIX + "x".repeat(200)), null);
  assert.equal(db.calls.length, 0);
});

test("a live API key reads back as a grant and marks itself used", async () => {
  const db = fakeDb([[
    /from api_keys/,
    [{ id: "key-1", user_id: "user-1", scopes: ["profile"], prefix: "chama_sk_abcd1234", name: "Laptop" }]
  ]]);
  useClient(db);
  assert.deepEqual(await readApiKey(KEY_PREFIX + "secret"), {
    userId: "user-1", scopes: ["profile"], keyId: "key-1", prefix: "chama_sk_abcd1234", name: "Laptop"
  });
  assert.equal(db.count(/update api_keys set last_used_at/), 1);
});
