import assert from "node:assert/strict";
import test from "node:test";

import { useClient } from "../db.js";
import { fakeDb, makeRequest } from "../test-helpers.js";
import { SESSION_COOKIE } from "../auth.js";
import { ROLE_DEFAULTS } from "../permissions.js";
import { handleHearth } from "../../../api/hearth.js";

// A dummy connection string is enough: useClient means neon() is never
// called, mail stays unconfigured, and with no ANTHROPIC_API_KEY the model
// is never reachable either, so nothing can leave the process.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_EMAIL_DOMAIN;
delete process.env.ANTHROPIC_API_KEY;
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

function permissionsFor(role) {
  return ROLE_DEFAULTS.find((r) => r.name === role)?.permissions || [];
}

// A signed-in actor: the session row, the user, their role, no overrides.
// `extra` handlers come first, so a test can answer any query it cares about.
function signedIn({ role = "client", users = {}, extra = [] } = {}) {
  const rows = { "actor-1": userRow({ role }), ...users };
  return fakeDb([
    ...extra,
    [
      /select id, user_id, expires_at, last_seen_at, revoked_at/,
      [{ id: "session-1", user_id: "actor-1", expires_at: new Date(NOW + 3600 * 1000).toISOString(), last_seen_at: new Date(NOW - 1000).toISOString(), revoked_at: null }]
    ],
    [/count\(\*\)::int as n from users/, [{ n: 1 }]],
    [/select \* from users where id/, (call) => (rows[call.values[0]] ? [rows[call.values[0]]] : [])],
    [/select \* from roles where name/, [{ name: role, label: role, permissions: permissionsFor(role) }]],
    [/from user_permissions/, []],
    [/select key, value from settings/, []]
  ]);
}

async function body(response) {
  return await response.clone().json();
}

// The model and the mail are both unconfigured on purpose; the handlers log
// the failure by name and carry on, so a test only keeps the console quiet.
async function quiet(run) {
  const was = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = was;
  }
}

function transcriptRow(overrides = {}) {
  return {
    id: "transcript-1",
    booking_id: null,
    user_id: "actor-1",
    title: "The week",
    held_at: "2026-08-30T09:00:00.000Z",
    source: "paste",
    status: "ready",
    derived: { summary: "You talked." },
    derived_at: "2026-08-30T10:00:00.000Z",
    created_at: "2026-08-30T10:00:00.000Z",
    raw: "Elliot: Hello.\nSomeone: Hello.",
    member_email: "someone@example.com",
    member_name: "Someone",
    ...overrides
  };
}

/* ---------- reading ---------- */

test("a client's list of records is asked for by their own id", async () => {
  const db = signedIn({ extra: [[/from transcripts t join users u/, [transcriptRow()]]] });
  useClient(db);
  const response = await handleHearth(hearth("/transcripts", { cookie: "t" }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.transcripts.length, 1);
  assert.equal(payload.transcripts[0].raw, undefined, "a list never carries the transcript itself");
  const call = db.matching(/from transcripts t join users u/)[0];
  assert.ok(call.values.includes("actor-1"), "the query is scoped to the member");
});

test("one member's record is not another's to read, and the owner reads it in full", async () => {
  useClient(signedIn({ extra: [[/from transcripts t join users u on u\.id = t\.user_id where t\.id/, [transcriptRow({ user_id: "someone-else" })]]] }));
  const refused = await handleHearth(hearth("/transcripts/transcript-1", { cookie: "t" }));
  assert.equal(refused.status, 403);

  useClient(signedIn({
    role: "owner",
    extra: [
      [/from transcripts t join users u on u\.id = t\.user_id where t\.id/, [transcriptRow({ user_id: "someone-else" })]],
      [/select \* from follow_ups where transcript_id/, []]
    ]
  }));
  const allowed = await handleHearth(hearth("/transcripts/transcript-1", { cookie: "t" }));
  assert.equal(allowed.status, 200);
  const payload = await body(allowed);
  assert.equal(payload.transcript.raw, "Elliot: Hello.\nSomeone: Hello.");
});

test("a one-character search is answered with nothing and asks the database nothing", async () => {
  const db = signedIn();
  useClient(db);
  const response = await handleHearth(hearth("/search?q=a", { cookie: "t" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { results: [] });
  assert.equal(db.count(/ts_headline/), 0);
});

/* ---------- follow-ups ---------- */

function followUpRow(overrides = {}) {
  return {
    id: "follow-1",
    user_id: "actor-1",
    transcript_id: null,
    owner: "client",
    text: "Write the thing",
    due_at: null,
    done_at: null,
    created_at: "2026-08-30T10:00:00.000Z",
    source: "manual",
    ...overrides
  };
}

test("a follow-up with no text is refused", async () => {
  const db = signedIn();
  useClient(db);
  const response = await handleHearth(hearth("/follow-ups", { cookie: "t", method: "POST", body: JSON.stringify({ text: "   " }) }));
  assert.equal(response.status, 400);
  assert.equal(db.count(/insert into follow_ups/), 0);
});

test("a follow-up written by hand is stored as the member's own", async () => {
  const db = signedIn({ extra: [[/insert into follow_ups/, [followUpRow()]]] });
  useClient(db);
  const response = await handleHearth(hearth("/follow-ups", { cookie: "t", method: "POST", body: JSON.stringify({ text: "  Write the thing  " }) }));
  assert.equal(response.status, 200);
  const insert = db.matching(/insert into follow_ups/)[0];
  assert.ok(/'manual'/.test(insert.text));
  assert.equal(insert.values[0], "actor-1");
  assert.equal(insert.values[3], "Write the thing");
  assert.equal(insert.values[5], "actor-1", "and by the member");
});

test("ticking a follow-up off writes the moment it was done", async () => {
  const db = signedIn({ extra: [[/select \* from follow_ups where id/, [followUpRow()]]] });
  useClient(db);
  const response = await handleHearth(hearth("/follow-ups/follow-1", { cookie: "t", method: "PATCH", body: JSON.stringify({ done: true }) }));
  assert.equal(response.status, 200);
  const update = db.matching(/update follow_ups set done_at/)[0];
  assert.ok(update.values[0], "done_at is a time, not null");
  assert.ok(!Number.isNaN(Date.parse(update.values[0])));
});

test("a member cannot tick off someone else's follow-up", async () => {
  const db = signedIn({ extra: [[/select \* from follow_ups where id/, [followUpRow({ user_id: "someone-else" })]]] });
  useClient(db);
  const response = await handleHearth(hearth("/follow-ups/follow-1", { cookie: "t", method: "PATCH", body: JSON.stringify({ done: true }) }));
  assert.equal(response.status, 403);
  assert.equal(db.count(/update follow_ups/), 0);
});

/* ---------- notes ---------- */

test("a note left from the room is recorded as coming from the web", async () => {
  const db = signedIn({ extra: [[/insert into session_notes/, [{ id: "note-1", text: "Something for next time", created_at: "2026-09-02T10:00:00.000Z" }]]] });
  useClient(db);
  const response = await handleHearth(hearth("/notes", { cookie: "t", method: "POST", body: JSON.stringify({ text: "Something for next time" }) }));
  assert.equal(response.status, 200);
  const insert = db.matching(/insert into session_notes/)[0];
  assert.equal(insert.values[0], "actor-1");
  assert.equal(insert.values[2], "web");
});

/* ---------- the owner's side ---------- */

const LONG = "Elliot: How did the week go? Someone: Better than the last one, honestly.";

function adminDb({ extra = [] } = {}) {
  return signedIn({
    role: "owner",
    extra: [
      ...extra,
      [/select \* from users where id = \$1$/, (call) => [call.values[0] === "member-1" ? userRow({ id: "member-1", email: "member@example.com" }) : userRow({ role: "owner" })]]
    ]
  });
}

test("attaching a transcript is not a client's to do", async () => {
  const db = signedIn();
  useClient(db);
  const response = await handleHearth(hearth("/admin/transcripts", { cookie: "t", method: "POST", body: JSON.stringify({ userId: "member-1", text: LONG }) }));
  assert.equal(response.status, 403);
  assert.equal(db.count(/insert into transcripts/), 0);
});

test("something too short to be a transcript is refused", async () => {
  const db = adminDb();
  useClient(db);
  const response = await handleHearth(hearth("/admin/transcripts", { cookie: "t", method: "POST", body: JSON.stringify({ userId: "member-1", text: "Hello." }) }));
  assert.equal(response.status, 400);
  assert.equal(db.count(/insert into transcripts/), 0);
});

test("a transcript can be attached without asking the model for the record", async () => {
  const db = adminDb({
    extra: [
      [/insert into transcripts/, [{ ...transcriptRow({ id: "transcript-9", status: "new", derived: null }) }]],
      [/select \* from transcripts where id/, [transcriptRow({ id: "transcript-9", status: "new", derived: null })]]
    ]
  });
  useClient(db);
  const response = await handleHearth(
    hearth("/admin/transcripts", { cookie: "t", method: "POST", body: JSON.stringify({ userId: "member-1", text: LONG, derive: false }) })
  );
  assert.equal(response.status, 200);
  const insert = db.matching(/insert into transcripts/)[0];
  assert.ok(/'new'/.test(insert.text), "the transcript is parked as new");
  assert.equal(insert.values[1], "member-1");
  assert.equal(insert.values[5], LONG);
  assert.equal(db.count(/set status = 'deriving'/), 0, "the model is never asked");
});

test("a transcript cannot be hung on another member's session", async () => {
  const db = adminDb({ extra: [[/select id, starts_at, user_id from bookings/, [{ id: "booking-1", starts_at: "2026-08-30T09:00:00.000Z", user_id: "someone-else" }]]] });
  useClient(db);
  const response = await handleHearth(
    hearth("/admin/transcripts", { cookie: "t", method: "POST", body: JSON.stringify({ userId: "member-1", text: LONG, bookingId: "booking-1" }) })
  );
  assert.equal(response.status, 400);
  assert.equal(db.count(/insert into transcripts/), 0);
});

test("when the record cannot be written the transcript is left marked failed", async () => {
  const db = adminDb({
    extra: [
      [/select id from transcripts where id/, [{ id: "transcript-1" }]],
      [/select t\.\*, u\.name as member_name from transcripts/, [{ ...transcriptRow(), member_name: "Someone" }]]
    ]
  });
  useClient(db);
  // No ANTHROPIC_API_KEY, so constructing the model client throws before
  // anything can be asked of it.
  const response = await quiet(() => handleHearth(hearth("/admin/transcripts/transcript-1/derive", { cookie: "t", method: "POST", body: "{}" })));
  assert.equal(response.status, 502);
  assert.equal(db.count(/set status = 'deriving'/), 1);
  assert.equal(db.count(/set status = 'failed'/), 1);
});
