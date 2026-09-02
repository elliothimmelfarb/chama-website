import assert from "node:assert/strict";
import test from "node:test";

import { useClient } from "../db.js";
import { fakeDb, makeRequest } from "../test-helpers.js";
import { SESSION_COOKIE } from "../auth.js";
import { ROLE_DEFAULTS } from "../permissions.js";
import { handleHearth } from "../../../api/hearth.js";

// A dummy connection string is enough: useClient means neon() is never
// called, and mail stays unconfigured, so nothing can leave the process.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_EMAIL_DOMAIN;
process.env.ADMIN_EMAILS = "";

const HOST = "chamainteligente.com";
const NOW = Date.now();

// The queries this route stands on, named once so a test says what it means.
const RECORDS = /select id, title, held_at, derived from transcripts/;
const SEARCH = /ts_rank/;
const RATE = /insert into rate_limits/;
const STATUS = /count\(\*\)::int as n from transcripts/;

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

function recordRow(overrides = {}) {
  return {
    id: "rec-1",
    title: "First session",
    held_at: "2026-08-01T10:00:00.000Z",
    derived: { summary: "We talked about the shape of the work.", keyPoints: ["Start small"] },
    ...overrides
  };
}

// The key is process-wide, so every test that cares about it puts it back.
function withKey(value) {
  const before = process.env.ANTHROPIC_API_KEY;
  if (value === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = value;
  return () => {
    if (before === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = before;
  };
}

function ask(body, options = {}) {
  return handleHearth(hearth("/ask", { cookie: "t", method: "POST", body: JSON.stringify(body), ...options }));
}

/* ---------- who may ask ---------- */

test("a guest has no records of their own and cannot ask about them", async () => {
  const db = signedIn({ role: "guest" });
  useClient(db);
  const response = await ask({ question: "What did we decide?" });
  assert.equal(response.status, 403);
  assert.equal(db.count(RECORDS), 0);
});

/* ---------- the question itself ---------- */

test("an empty question is nothing to answer", async () => {
  const db = signedIn();
  useClient(db);
  const response = await ask({ question: "   " });
  assert.equal(response.status, 400);
  assert.equal(db.count(RECORDS), 0);
});

test("with no key the flame is resting", async () => {
  const restore = withKey(undefined);
  try {
    const db = signedIn();
    useClient(db);
    const response = await ask({ question: "What did we decide?" });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /The flame is resting\./);
    assert.equal(db.count(RECORDS), 0, "no records are read when nothing can answer");
  } finally {
    restore();
  }
});

test("a member with no records is told to come back after their first session", async () => {
  const restore = withKey("sk-ant-test");
  try {
    const db = signedIn({ extra: [[RECORDS, []]] });
    useClient(db);
    const response = await ask({ question: "What did we decide?" });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /no records to ask about yet/);
  } finally {
    restore();
  }
});

test("too many questions in an hour is a refusal, before anything is read", async () => {
  const restore = withKey("sk-ant-test");
  try {
    const db = signedIn({ extra: [[RATE, [{ count: 41 }]]] });
    useClient(db);
    const response = await ask({ question: "What did we decide?" });
    assert.equal(response.status, 429);
    assert.equal(db.count(RECORDS), 0);
  } finally {
    restore();
  }
});

/* ---------- the stream ---------- */

// The SDK is pointed at a closed port, so the call fails at once and the
// stream is exercised end to end without a network anywhere near it.
test("the answer streams, and a flame that cannot be reached ends in one error frame", { timeout: 20000 }, async () => {
  const restoreKey = withKey("sk-ant-test");
  const beforeBase = process.env.ANTHROPIC_BASE_URL;
  process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
  try {
    const db = signedIn({
      extra: [
        [RECORDS, [recordRow(), recordRow({ id: "rec-2", title: "Second session" })]],
        [SEARCH, [{ id: "rec-1", title: "First session", held_at: "2026-08-01T10:00:00.000Z", raw: "Elliot: hello.\nMember: hello.", rank: 0.5 }]]
      ]
    });
    useClient(db);
    const response = await ask({ question: "What did we decide?" });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);

    const frames = (await response.text())
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));
    assert.equal(frames.length, 1);
    assert.equal(frames[0].type, "error");

    const context = db.matching(RECORDS)[0];
    assert.equal(context.values[0], "actor-1", "only this member's records are read");
    assert.equal(db.count(SEARCH), 1, "a question of two characters or more is searched for");
  } finally {
    if (beforeBase === undefined) delete process.env.ANTHROPIC_BASE_URL;
    else process.env.ANTHROPIC_BASE_URL = beforeBase;
    restoreKey();
  }
});

/* ---------- status ---------- */

test("status counts the records and says the flame is not ready without a key", async () => {
  const restore = withKey(undefined);
  try {
    const db = signedIn({ extra: [[STATUS, [{ n: 3 }]]] });
    useClient(db);
    const response = await handleHearth(hearth("/ask/status", { cookie: "t" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { records: 3, ready: false });
  } finally {
    restore();
  }
});
