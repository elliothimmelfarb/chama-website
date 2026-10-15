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

test("a session that gained a transcript between the check and the insert is a conflict", async () => {
  const db = adminDb({
    extra: [
      [/select id, starts_at, user_id from bookings/, [{ id: "booking-1", starts_at: "2026-08-30T09:00:00.000Z", user_id: "member-1" }]],
      [/select id from transcripts where booking_id/, []],
      [
        /insert into transcripts/,
        () => {
          const error = new Error("duplicate key value violates unique constraint");
          error.code = "23505";
          throw error;
        }
      ]
    ]
  });
  useClient(db);
  const response = await handleHearth(
    hearth("/admin/transcripts", { cookie: "t", method: "POST", body: JSON.stringify({ userId: "member-1", text: LONG, bookingId: "booking-1" }) })
  );
  assert.equal(response.status, 409);
  assert.equal((await body(response)).error, "That session already has a transcript.");
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

/* ---------- the record's figures ---------- */

const PICTURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>circle{fill:#c60}</style><circle cx="5" cy="5" r="4"/></svg>';
const RECORD_ROW = /from transcripts t join users u on u\.id = t\.user_id where t\.id/;

test("a record's figure is served to its member as an image that cannot run", async () => {
  useClient(signedIn({ extra: [[RECORD_ROW, [transcriptRow()]], [/from record_figures where transcript_id = \$1 and key = \$2/, [{ svg: PICTURE }]]] }));
  const response = await handleHearth(hearth("/transcripts/transcript-1/figures/journey", { cookie: "t" }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/svg+xml; charset=utf-8");
  assert.match(response.headers.get("Content-Security-Policy") || "", /default-src 'none'.*sandbox/);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(await response.text(), PICTURE);

  useClient(signedIn({ extra: [[RECORD_ROW, [transcriptRow({ user_id: "someone-else" })]], [/from record_figures/, [{ svg: PICTURE }]]] }));
  assert.equal((await handleHearth(hearth("/transcripts/transcript-1/figures/journey", { cookie: "t" }))).status, 403);

  useClient(signedIn({ extra: [[RECORD_ROW, [transcriptRow()]], [/from record_figures/, []]] }));
  assert.equal((await handleHearth(hearth("/transcripts/transcript-1/figures/journey", { cookie: "t" }))).status, 404);
});

test("the record names its figures without carrying them", async () => {
  useClient(signedIn({
    extra: [
      [RECORD_ROW, [transcriptRow()]],
      [/select key, alt from record_figures/, [{ key: "journey", alt: "Where you have been" }]],
      [/select \* from follow_ups where transcript_id/, []]
    ]
  }));
  const payload = await body(await handleHearth(hearth("/transcripts/transcript-1", { cookie: "t" })));
  assert.deepEqual(payload.transcript.figures, [{ key: "journey", alt: "Where you have been" }]);
  assert.ok(!JSON.stringify(payload).includes("<svg"), "the picture itself stays out of the JSON");
});

test("a figure that could run or reach outside is refused, a clean one is stored", async () => {
  const unsafe = [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div/></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/x.png"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://example.com/a.css);</style></svg>',
    '<p>not a picture</p>'
  ];
  for (const svg of unsafe) {
    const db = signedIn({ role: "owner", extra: [[/select id from transcripts where id/, [{ id: "transcript-1" }]]] });
    useClient(db);
    const response = await handleHearth(hearth("/admin/transcripts/transcript-1", { cookie: "t", method: "PATCH", body: JSON.stringify({ figures: { journey: { svg } } }) }));
    assert.equal(response.status, 400, svg);
    assert.equal(db.count(/into record_figures/), 0, svg);
  }

  const db = signedIn({ role: "owner", extra: [[/select id from transcripts where id/, [{ id: "transcript-1" }]]] });
  useClient(db);
  const stored = await handleHearth(hearth("/admin/transcripts/transcript-1", { cookie: "t", method: "PATCH", body: JSON.stringify({ figures: { journey: { svg: PICTURE, alt: "A map" }, old: null } }) }));
  assert.equal(stored.status, 200);
  assert.deepEqual(db.matching(/into record_figures/)[0].values, ["transcript-1", "journey", PICTURE, "A map"]);
  assert.deepEqual(db.matching(/delete from record_figures/)[0].values, ["transcript-1", "old"]);

  const badKey = signedIn({ role: "owner", extra: [[/select id from transcripts where id/, [{ id: "transcript-1" }]]] });
  useClient(badKey);
  assert.equal((await handleHearth(hearth("/admin/transcripts/transcript-1", { cookie: "t", method: "PATCH", body: JSON.stringify({ figures: { "../x": { svg: PICTURE } } }) }))).status, 400);

  useClient(signedIn({ extra: [[/select id from transcripts where id/, [{ id: "transcript-1" }]]] }));
  assert.equal((await handleHearth(hearth("/admin/transcripts/transcript-1", { cookie: "t", method: "PATCH", body: JSON.stringify({ figures: { journey: { svg: PICTURE } } }) }))).status, 403);
});

/* ---------- a record written by hand ---------- */

test("a hand-written record keeps its shape and turns this week's actions into follow-ups", async () => {
  let n = 0;
  const db = signedIn({
    role: "owner",
    extra: [
      [/select id, user_id from transcripts where id/, [{ id: "transcript-1", user_id: "member-1" }]],
      [/select id from transcripts where id/, [{ id: "transcript-1" }]],
      [/insert into follow_ups/, () => [{ id: `follow-${++n}` }]]
    ]
  });
  useClient(db);
  const record = {
    title: "Getting started",
    short: ["Express intent.", "Build one tool."],
    chapters: [
      { heading: "Intent", body: ["Say what, not how."], figure: "intent", quote: { text: "Intent. Okay.", who: "You" }, stray: "dropped" },
      { heading: "In your threads", body: ["Intent at work."], label: "  Idea 1 in practice  " }
    ],
    actions: [{ title: "Build one tool", why: "Seeing is believing.", steps: ["Open an empty folder"], prompt: "Own this end to end." }],
    followUpsCoach: ["Send the pattern"],
    next: { when: "Thursday", plan: ["Show and tell"] }
  };
  const response = await handleHearth(hearth("/admin/transcripts/transcript-1", { cookie: "t", method: "PATCH", body: JSON.stringify({ derived: record }) }));
  assert.equal(response.status, 200);

  const inserts = db.matching(/insert into follow_ups/);
  assert.deepEqual(inserts.map((c) => [c.values[2], c.values[3]]), [["client", "Build one tool"], ["coach", "Send the pattern"]]);
  const update = db.matching(/update transcripts set derived/)[0];
  const stored = JSON.parse(update.values[0]);
  assert.equal(stored.version, 2);
  assert.equal(stored.actions[0].followUpId, "follow-1");
  assert.equal(stored.chapters[0].stray, undefined, "fields outside the shape are dropped");
  assert.deepEqual(stored.chapters[0].quote, { text: "Intent. Okay.", who: "You" });
  assert.equal(stored.chapters[0].label, undefined, "an idea has no label");
  assert.equal(stored.chapters[1].label, "Idea 1 in practice", "a supporting chapter keeps its label");
});

/* ---------- remember cards ---------- */

function cardRow(overrides = {}) {
  return { id: "card-1", user_id: "actor-1", transcript_id: "transcript-1", position: 0, kind: "recall", front: "Q?", back: "A.", step: 1, due_at: new Date(NOW - 1000).toISOString(), reviewed_at: null, reviews: 1, retired_at: null, ...overrides };
}

test("a member's answer moves their card along the ladder", async () => {
  const db = signedIn({ extra: [[/select \* from recall_cards where id/, [cardRow()]], [/update recall_cards/, [cardRow({ step: 2 })]]] });
  useClient(db);
  const response = await handleHearth(hearth("/cards/card-1/review", { cookie: "t", method: "POST", body: JSON.stringify({ result: "good" }) }));
  assert.equal(response.status, 200);
  const update = db.matching(/update recall_cards/)[0];
  assert.equal(update.values[0], 2, "one step up");
  const due = Date.parse(update.values[1]);
  assert.ok(Math.abs(due - (Date.now() + 7 * 86400000)) < 60000, "next due a week out");
});

test("nobody reviews another member's card, and a nonsense answer is refused", async () => {
  useClient(signedIn({ extra: [[/select \* from recall_cards where id/, [cardRow({ user_id: "someone-else" })]]] }));
  assert.equal((await handleHearth(hearth("/cards/card-1/review", { cookie: "t", method: "POST", body: JSON.stringify({ result: "good" }) }))).status, 403);

  const db = signedIn({ extra: [[/select \* from recall_cards where id/, [cardRow()]]] });
  useClient(db);
  assert.equal((await handleHearth(hearth("/cards/card-1/review", { cookie: "t", method: "POST", body: JSON.stringify({ result: "maybe" }) }))).status, 400);
  assert.equal(db.count(/update recall_cards/), 0);
});

test("the cards due are the member's own and not retired", async () => {
  const db = signedIn({ extra: [[/from recall_cards c/, [cardRow()]]] });
  useClient(db);
  const payload = await body(await handleHearth(hearth("/cards/due", { cookie: "t" })));
  assert.equal(payload.cards.length, 1);
  const call = db.matching(/from recall_cards c/)[0];
  assert.match(call.text, /retired_at is null/);
  assert.ok(call.values.includes("actor-1"));
});

test("only the owner sets a record's cards, and new ones are first due the next day", async () => {
  useClient(signedIn({ extra: [[/select id, user_id from transcripts where id/, [{ id: "transcript-1", user_id: "member-1" }]]] }));
  assert.equal((await handleHearth(hearth("/admin/transcripts/transcript-1/cards", { cookie: "t", method: "PUT", body: JSON.stringify({ cards: [{ front: "Q?", back: "A." }] }) }))).status, 403);

  const db = signedIn({ role: "owner", extra: [[/select id, user_id from transcripts where id/, [{ id: "transcript-1", user_id: "member-1" }]]] });
  useClient(db);
  const response = await handleHearth(hearth("/admin/transcripts/transcript-1/cards", { cookie: "t", method: "PUT", body: JSON.stringify({ cards: [{ kind: "apply", front: "Q?", back: "A." }, { front: "", back: "no question" }] }) }));
  assert.equal(response.status, 200);
  assert.equal(db.count(/delete from recall_cards where transcript_id/), 1);
  const inserts = db.matching(/insert into recall_cards/);
  assert.equal(inserts.length, 1, "a card without a question is skipped");
  assert.equal(inserts[0].values[0], "member-1", "the card belongs to the record's member");
  assert.equal(inserts[0].values[3], "apply");
  const due = Date.parse(inserts[0].values[6]);
  assert.ok(Math.abs(due - (Date.now() + 86400000)) < 60000);
});
