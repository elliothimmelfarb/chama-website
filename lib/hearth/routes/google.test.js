import assert from "node:assert/strict";
import test, { after } from "node:test";

import { useClient } from "../db.js";
import { fakeDb, makeRequest } from "../test-helpers.js";
import { SESSION_COOKIE } from "../auth.js";
import { ROLE_DEFAULTS } from "../permissions.js";
import { handleHearth } from "../../../api/hearth.js";

// A dummy connection string is enough: useClient means neon() is never
// called, and no route here is allowed to reach Google.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_EMAIL_DOMAIN;
process.env.ADMIN_EMAILS = "";

const ORIGINAL = {
  id: process.env.GOOGLE_CLIENT_ID,
  secret: process.env.GOOGLE_CLIENT_SECRET,
  session: process.env.HEARTH_SESSION_SECRET
};

function restore(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

process.env.GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "client-secret";
process.env.HEARTH_SESSION_SECRET = "s".repeat(48);

after(() => {
  restore("GOOGLE_CLIENT_ID", ORIGINAL.id);
  restore("GOOGLE_CLIENT_SECRET", ORIGINAL.secret);
  restore("HEARTH_SESSION_SECRET", ORIGINAL.session);
});

const HOST = "chamainteligente.com";
const NOW = Date.now();

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

function signedIn({ role = "client", permissions, extra = [] } = {}) {
  return fakeDb([
    ...extra,
    [
      /select id, user_id, expires_at, last_seen_at, revoked_at/,
      [{ id: "session-1", user_id: "actor-1", expires_at: new Date(NOW + 3600 * 1000).toISOString(), last_seen_at: new Date(NOW - 1000).toISOString(), revoked_at: null }]
    ],
    [/count\(\*\)::int as n from users/, [{ n: 1 }]],
    [/select \* from users where id/, [userRow({ role })]],
    [/select \* from roles where name/, [{ name: role, label: role, permissions: permissions || permissionsFor(role) }]],
    [/from user_permissions/, []],
    [/select key, value from settings/, []]
  ]);
}

async function body(response) {
  return await response.clone().json();
}

const CALLBACK = `https://${HOST}/api/hearth/google/callback`;

/* ---------- the settings panel ---------- */

test("only someone who manages settings can see the Google connection", async () => {
  useClient(signedIn());
  assert.equal((await handleHearth(hearth("/admin/google", { cookie: "t" }))).status, 403);

  useClient(signedIn({ role: "owner", extra: [[/select value from settings/, []]] }));
  const response = await handleHearth(hearth("/admin/google", { cookie: "t" }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.configured, true);
  assert.equal(payload.connected, false);
  assert.equal(payload.callbackUrl, CALLBACK);
});

/* ---------- connecting ---------- */

test("staff who manage settings still cannot connect the company's account", async () => {
  useClient(signedIn({ role: "staff", permissions: [...permissionsFor("staff"), "settings.manage"] }));
  const response = await handleHearth(hearth("/admin/google/connect", { cookie: "t" }));
  assert.equal(response.status, 403);
  assert.match((await body(response)).error, /Only the owner/);
});

test("with no client secret in Vercel there is nowhere to send the owner", async () => {
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_SECRET;
  try {
    const db = signedIn({ role: "owner" });
    useClient(db);
    const response = await handleHearth(hearth("/admin/google/connect", { cookie: "t" }));
    assert.equal(response.status, 503);
    assert.equal(db.count(/insert into oauth_states/), 0);
  } finally {
    process.env.GOOGLE_CLIENT_SECRET = secret;
  }
});

test("the owner is sent to Google's consent with a state that was written down", async () => {
  const db = signedIn({ role: "owner" });
  useClient(db);
  const response = await handleHearth(hearth("/admin/google/connect", { cookie: "t" }));
  assert.equal(response.status, 302);
  const to = new URL(response.headers.get("location"));
  assert.equal(to.host, "accounts.google.com");
  assert.equal(to.searchParams.get("redirect_uri"), CALLBACK);
  assert.equal(to.searchParams.get("access_type"), "offline");

  const insert = db.matching(/insert into oauth_states/)[0];
  assert.ok(insert, "the state is written down before the redirect");
  assert.match(insert.text, /'google-connect'/);
  assert.equal(insert.values[0], to.searchParams.get("state"));
  assert.equal(JSON.parse(insert.values[2]).userId, "actor-1");
});

/* ---------- coming back ---------- */

test("a callback without a state goes back to settings as a failure", async () => {
  const db = signedIn({ role: "owner", extra: [[/delete from oauth_states/, []]] });
  useClient(db);
  const response = await handleHearth(hearth("/google/callback?code=abc", { cookie: "t" }));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/hearth/admin/settings?google=failed");
  assert.equal(db.count(/insert into settings/), 0);
});

test("a good state from a signed-out browser finishes nothing", async () => {
  const db = fakeDb([[/delete from oauth_states/, [{ meta: { userId: "actor-1" } }]]]);
  useClient(db);
  const response = await handleHearth(hearth("/google/callback?code=abc&state=state-1"));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/hearth/admin/settings?google=failed");
  assert.equal(db.count(/insert into settings/), 0);
});

/* ---------- disconnecting ---------- */

test("the owner can forget the connection", async () => {
  const db = signedIn({ role: "owner" });
  useClient(db);
  const response = await handleHearth(hearth("/admin/google", { cookie: "t", method: "DELETE" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { ok: true });
  assert.equal(db.count(/delete from settings where key/), 1);
});
