import assert from "node:assert/strict";
import test from "node:test";

import { useClient } from "../db.js";
import { fakeDb, makeRequest } from "../test-helpers.js";
import { SESSION_COOKIE, hashToken } from "../auth.js";
import { ROLE_DEFAULTS } from "../permissions.js";
import { KEY_PREFIX, SCOPE_KEYS } from "../oauth.js";
import { handleHearth } from "../../../api/hearth/[...path].js";

// A dummy connection string is enough: useClient means neon() is never
// called, and mail stays unconfigured, so nothing can leave the process.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_EMAIL_DOMAIN;
process.env.ADMIN_EMAILS = "";

const HOST = "chamainteligente.com";
const NOW = Date.now();
const REDIRECT = "https://app.example.com/callback";

function hearth(path, { cookie, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = `${SESSION_COOKIE}=${cookie}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  return makeRequest(`https://${HOST}/api/hearth${path}`, { ...options, headers });
}

function userRow(overrides = {}) {
  return {
    id: "actor-1",
    email: "someone@example.com",
    name: "Someone",
    avatar_url: null,
    role: "client",
    status: "active",
    timezone: "Europe/Lisbon",
    referral_code: "abcd2345",
    created_at: "2026-09-01T10:00:00.000Z",
    last_seen_at: new Date(NOW).toISOString(),
    email_verified_at: "2026-09-01T10:00:00.000Z",
    notes: "",
    referred_by: null,
    ...overrides
  };
}

function permissionsFor(role) {
  return ROLE_DEFAULTS.find((r) => r.name === role)?.permissions || [];
}

function signedIn({ role = "client", extra = [] } = {}) {
  return fakeDb([
    ...extra,
    [
      /select id, user_id, expires_at, last_seen_at, revoked_at/,
      [{ id: "session-1", user_id: "actor-1", expires_at: new Date(NOW + 3600 * 1000).toISOString(), last_seen_at: new Date(NOW - 1000).toISOString(), revoked_at: null }]
    ],
    [/count\(\*\)::int as n from users/, [{ n: 1 }]],
    [/select \* from users where id/, [userRow({ role })]],
    [/select \* from roles where name/, [{ name: role, label: role, permissions: permissionsFor(role) }]],
    [/from user_permissions/, []],
    [/select key, value from settings/, []]
  ]);
}

async function body(response) {
  return await response.clone().json();
}

/* ---------- the agents page ---------- */

test("a guest can see their keys, their connected apps and what a key may be given", async () => {
  const db = signedIn({
    role: "guest",
    extra: [
      [/from api_keys[\s\S]*where user_id/, [{ id: "key-1", name: "Laptop", prefix: "chama_sk_abcd1234", scopes: ["profile"], created_at: "2026-09-01T10:00:00.000Z", expires_at: null, last_used_at: null }]],
      [/from oauth_tokens t join oauth_clients c/, [{ id: "chama_abc", name: "Claude Code", client_uri: null, logo_uri: null, connected_at: "2026-09-01T10:00:00.000Z", last_used_at: null, scopes: ["profile"] }]],
      [/from audit_log/, []]
    ]
  });
  useClient(db);
  const response = await handleHearth(hearth("/agents", { cookie: "t" }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.deepEqual(payload.scopes.map((s) => s.key), SCOPE_KEYS);
  assert.equal(payload.keys.length, 1);
  assert.equal(payload.keys[0].prefix, "chama_sk_abcd1234");
  assert.equal(payload.apps.length, 1);
  assert.equal(payload.apps[0].name, "Claude Code");
});

/* ---------- keys ---------- */

test("a key that may do nothing is refused", async () => {
  const db = signedIn();
  useClient(db);
  const response = await handleHearth(hearth("/agents/keys", { cookie: "t", method: "POST", body: JSON.stringify({ name: "Laptop", scopes: [] }) }));
  assert.equal(response.status, 400);
  assert.equal(db.count(/insert into api_keys/), 0);
});

test("a client cannot mint a key that runs the business", async () => {
  const db = signedIn();
  useClient(db);
  const response = await handleHearth(hearth("/agents/keys", { cookie: "t", method: "POST", body: JSON.stringify({ scopes: ["profile", "business"] }) }));
  assert.equal(response.status, 403);
  assert.equal(db.count(/insert into api_keys/), 0);
});

test("the owner's key is shown once and stored as a hash", async () => {
  const db = signedIn({
    role: "owner",
    extra: [[/insert into api_keys/, (call) => [{ id: "key-1", prefix: call.values[2], created_at: "2026-09-02T10:00:00.000Z" }]]]
  });
  useClient(db);
  const response = await handleHearth(hearth("/agents/keys", { cookie: "t", method: "POST", body: JSON.stringify({ name: "The laptop", scopes: ["profile", "business"] }) }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.ok(payload.secret.startsWith(KEY_PREFIX));
  assert.deepEqual(payload.key.scopes, ["profile", "business"]);
  const insert = db.matching(/insert into api_keys/)[0];
  assert.equal(insert.values[3], hashToken(payload.secret));
  assert.ok(!insert.values.includes(payload.secret), "the secret itself is never stored");
});

test("revoking a key that is not there is a plain not found", async () => {
  useClient(signedIn({ extra: [[/update api_keys set revoked_at/, []]] }));
  const response = await handleHearth(hearth("/agents/keys/key-9", { cookie: "t", method: "DELETE" }));
  assert.equal(response.status, 404);
});

/* ---------- consent ---------- */

const pendingMeta = {
  clientId: "chama_abc",
  redirectUri: REDIRECT,
  scopes: ["profile", "sessions", "business"],
  codeChallenge: "c".repeat(43),
  state: "xyz",
  resource: null
};

test("a consent request that has expired is gone", async () => {
  useClient(signedIn({ extra: [[/select meta from oauth_states/, []]] }));
  const response = await handleHearth(hearth("/agents/consent?req=req-1", { cookie: "t" }));
  assert.equal(response.status, 404);
});

test("saying no sends the app away with access_denied", async () => {
  useClient(signedIn({ extra: [[/delete from oauth_states/, [{ meta: pendingMeta }]]] }));
  const response = await handleHearth(hearth("/agents/consent", { cookie: "t", method: "POST", body: JSON.stringify({ req: "req-1", decision: "deny" }) }));
  assert.equal(response.status, 200);
  const url = new URL((await body(response)).to);
  assert.equal(url.searchParams.get("error"), "access_denied");
  assert.equal(url.searchParams.get("state"), "xyz");
});

test("saying yes hands the app a code, and a client cannot grant the business", async () => {
  const db = signedIn({ extra: [[/delete from oauth_states/, [{ meta: pendingMeta }]]] });
  useClient(db);
  const response = await handleHearth(
    hearth("/agents/consent", { cookie: "t", method: "POST", body: JSON.stringify({ req: "req-1", decision: "approve", scopes: ["profile", "sessions", "business"] }) })
  );
  assert.equal(response.status, 200);
  const url = new URL((await body(response)).to);
  assert.ok(url.searchParams.get("code"), "the app is handed a code");
  assert.equal(url.searchParams.get("state"), "xyz");
  const insert = db.matching(/insert into oauth_codes/)[0];
  assert.deepEqual(insert.values[4], ["profile", "sessions"], "the business is not a client's to grant");
});
