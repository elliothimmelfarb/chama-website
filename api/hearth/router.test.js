import assert from "node:assert/strict";
import test from "node:test";

import { useClient } from "../../lib/hearth/db.js";
import { fakeDb, makeRequest } from "../../lib/hearth/test-helpers.js";
import { SESSION_COOKIE } from "../../lib/hearth/auth.js";
import { MESSAGES, SETTING_DEFAULTS, handleHearth, readSettings } from "./[...path].js";

// A dummy connection string is enough: useClient means neon() is never
// called, and mail stays unconfigured so nothing can leave the process.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_EMAIL_DOMAIN;
process.env.ADMIN_EMAILS = "";

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

function sessionHandlers() {
  return [
    [
      /select id, user_id, expires_at, last_seen_at, revoked_at/,
      [
        {
          id: "session-1",
          user_id: "actor-1",
          expires_at: new Date(NOW + 3600 * 1000).toISOString(),
          last_seen_at: new Date(NOW - 1000).toISOString(),
          revoked_at: null
        }
      ]
    ]
  ];
}

// A signed-in actor: the session row, the user, their role and no overrides.
function signedIn({ role = "client", permissions = ["hearth.enter"], users = {}, extra = [] } = {}) {
  const rows = { "actor-1": userRow({ role }), ...users };
  return fakeDb([
    ...extra,
    ...sessionHandlers(),
    [/count\(\*\)::int as n from users/, [{ n: 1 }]],
    [/select \* from users where id/, (call) => (rows[call.values[0]] ? [rows[call.values[0]]] : [])],
    [/select \* from roles where name/, [{ name: role, label: role, permissions }]],
    [/from user_permissions/, []],
    [/select key, value from settings/, []]
  ]);
}

async function body(response) {
  return await response.clone().json();
}

test("an unconfigured Hearth says so and touches nothing", async () => {
  const url = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await handleHearth(hearth("/config"));
    assert.equal(response.status, 503);
    assert.deepEqual(await body(response), { error: MESSAGES.unconfigured });
  } finally {
    process.env.DATABASE_URL = url;
  }
});

test("an unknown path is 404 and a known path with the wrong method is 405", async () => {
  useClient(fakeDb());
  assert.equal((await handleHearth(hearth("/nonsense"))).status, 404);
  assert.equal((await handleHearth(hearth("/auth/email/start"))).status, 405);
});

test("the path resolves from the pathname or from the path query segments", async () => {
  useClient(fakeDb([[/select key, value from settings/, []]]));
  const fromQuery = await handleHearth(
    makeRequest(`https://${HOST}/api/hearth?path=config`)
  );
  assert.equal(fromQuery.status, 200);
  assert.ok("openSignup" in (await body(fromQuery)));

  const nested = await handleHearth(makeRequest(`https://${HOST}/api/hearth?path=auth&path=email/start`));
  assert.equal(nested.status, 405);
});

test("a post from another site is refused before any handler runs", async () => {
  const db = fakeDb();
  useClient(db);
  const response = await handleHearth(
    hearth("/auth/email/start", {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
      body: JSON.stringify({ email: "someone@example.com" })
    })
  );
  assert.equal(response.status, 403);
  assert.deepEqual(await body(response), { error: MESSAGES.refused });
  assert.equal(db.count(/email_tokens/), 0);
});

test("GET /config reports the doors that are open", async () => {
  useClient(fakeDb([[/select key, value from settings/, [{ key: "open_signup", value: false }]]]));
  const response = await handleHearth(hearth("/config"));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.openSignup, false);
  assert.equal(payload.providers.email, true);
  assert.equal("github" in payload.providers, true);
});

test("GET /me is 401 without a session and the actor with one", async () => {
  useClient(fakeDb());
  const anonymous = await handleHearth(hearth("/me"));
  assert.equal(anonymous.status, 401);
  assert.deepEqual(await body(anonymous), { error: MESSAGES.signedOut });

  useClient(signedIn({ permissions: ["hearth.enter", "feed.read"] }));
  const response = await handleHearth(hearth("/me", { cookie: "a-session-token" }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.user.id, "actor-1");
  assert.deepEqual(payload.user.permissions.sort(), ["feed.read", "hearth.enter"]);
  assert.equal(payload.role.name, "client");
  assert.equal(payload.settings.sessionMinutes, SETTING_DEFAULTS.session_minutes);
});

test("a magic link is refused for a bad address", async () => {
  useClient(fakeDb());
  const response = await handleHearth(
    hearth("/auth/email/start", { method: "POST", body: JSON.stringify({ email: "not-an-address" }) })
  );
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, "That does not look like an email address.");
});

// The token is written before the send is attempted, and an unconfigured
// mailbox is a 503 rather than a silent success.
test("a magic link records its token and reports an unsendable email", async () => {
  const db = fakeDb([
    [/insert into rate_limits/, [{ count: 1 }]],
    [/select key, value from settings/, []],
    [/select \* from users where email/, []]
  ]);
  useClient(db);

  const quiet = console.error;
  console.error = () => {};
  let response;
  try {
    response = await handleHearth(
      hearth("/auth/email/start", { method: "POST", body: JSON.stringify({ email: "someone@example.com" }) })
    );
  } finally {
    console.error = quiet;
  }

  assert.equal(response.status, 503);
  const insert = db.matching(/insert into email_tokens/)[0];
  assert.ok(insert, "the token row is written first");
  assert.equal(insert.values[0], "someone@example.com");
  assert.equal(insert.values[2], "magic");
});

test("an unknown magic link lands back at the Hearth with an error", async () => {
  useClient(fakeDb([[/update email_tokens/, []]]));
  const response = await handleHearth(hearth("/auth/email/callback?token=nothing"));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "/hearth?error=link");
  assert.equal(response.headers.get("Set-Cookie"), null);
});

test("a good magic link for a new address creates a user and signs them in", async () => {
  const db = fakeDb([
    [/update email_tokens/, [{ id: 1, email: "new@example.com", user_id: null, meta: {} }]],
    [/select \* from users where email/, []],
    [/insert into users/, (call) => [userRow({ id: "new-user", email: call.values[0], role: call.values[3] })]],
    [/select key, value from settings/, []]
  ]);
  useClient(db);

  const response = await handleHearth(hearth("/auth/email/callback?token=a-good-token"));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), "/hearth?welcome=1");
  assert.match(response.headers.get("Set-Cookie") || "", new RegExp(`^${SESSION_COOKIE}=[^;]+; Secure`));
  assert.equal(db.count(/insert into users/), 1);
  assert.equal(db.count(/insert into login_sessions/), 1);
});

test("only an owner touches an owner's role, and never the last one", async () => {
  const owner = userRow({ id: "owner-1", email: "owner@example.com", role: "owner" });

  const staffDb = signedIn({
    role: "staff",
    permissions: ["members.read", "members.manage"],
    users: { "owner-1": owner }
  });
  useClient(staffDb);
  const refused = await handleHearth(
    hearth("/admin/members/owner-1", { method: "PATCH", cookie: "t", body: JSON.stringify({ role: "client" }) })
  );
  assert.equal(refused.status, 403);
  assert.deepEqual(await body(refused), { error: MESSAGES.forbidden });
  assert.equal(staffDb.count(/update users set role/), 0);

  const ownerDb = fakeDb([
    ...sessionHandlers(),
    [/count\(\*\)::int as n from users/, [{ n: 1 }]],
    [/select \* from users where id/, (call) => (call.values[0] === "actor-1" ? [userRow({ role: "owner" })] : [owner])],
    [/select \* from roles where name/, [{ name: "owner", label: "Owner", permissions: [] }]],
    [/from user_permissions/, []]
  ]);
  useClient(ownerDb);
  const lastOwner = await handleHearth(
    hearth("/admin/members/owner-1", { method: "PATCH", cookie: "t", body: JSON.stringify({ role: "client" }) })
  );
  assert.equal(lastOwner.status, 400);
  assert.equal((await body(lastOwner)).error, "There must always be one owner.");
  assert.equal(ownerDb.count(/update users set role/), 0);
});

test("the owner role cannot be edited into a lockout", async () => {
  useClient(signedIn({ role: "owner", permissions: [] }));
  const response = await handleHearth(
    hearth("/admin/roles/owner", { method: "PUT", cookie: "t", body: JSON.stringify({ permissions: [] }) })
  );
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, "The owner role always holds every permission.");
});

test("settings refuse a value out of shape and accept one in shape", async () => {
  const db = signedIn({ role: "owner", permissions: [] });
  useClient(db);
  const refused = await handleHearth(
    hearth("/admin/settings", { method: "PUT", cookie: "t", body: JSON.stringify({ session_minutes: "an hour" }) })
  );
  assert.equal(refused.status, 400);
  assert.equal((await body(refused)).error, "That value for session_minutes is not allowed.");
  assert.equal(db.count(/insert into settings/), 0);

  const accepted = await handleHearth(
    hearth("/admin/settings", { method: "PUT", cookie: "t", body: JSON.stringify({ session_minutes: 45, nonsense: 1 }) })
  );
  assert.equal(accepted.status, 200);
  const inserts = db.matching(/insert into settings/);
  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0].values, ["session_minutes", "45", "actor-1"]);
});

test("the audit log needs audit.read", async () => {
  useClient(signedIn({ role: "client", permissions: ["hearth.enter"] }));
  const refused = await handleHearth(hearth("/admin/audit", { cookie: "t" }));
  assert.equal(refused.status, 403);
  assert.deepEqual(await body(refused), { error: MESSAGES.forbidden });

  useClient(
    signedIn({
      role: "staff",
      permissions: ["audit.read"],
      extra: [[/from audit_log l left join users u/, [{ id: 9, event: "auth.sign_in" }]]]
    })
  );
  const allowed = await handleHearth(hearth("/admin/audit?limit=1", { cookie: "t" }));
  assert.equal(allowed.status, 200);
  assert.deepEqual(await body(allowed), { entries: [{ id: 9, event: "auth.sign_in" }], nextBefore: 9 });
});

test("readSettings lays the stored rows over the defaults", async () => {
  useClient(
    fakeDb([
      [
        /select key, value from settings/,
        [
          { key: "session_minutes", value: 45 },
          { key: "open_signup", value: false },
          { key: "not_a_setting", value: "ignored" }
        ]
      ]
    ])
  );
  const settings = await readSettings();
  assert.equal(settings.session_minutes, 45);
  assert.equal(settings.open_signup, false);
  assert.equal(settings.owner_timezone, SETTING_DEFAULTS.owner_timezone);
  assert.equal("not_a_setting" in settings, false);
});
