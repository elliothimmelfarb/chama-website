import assert from "node:assert/strict";
import test from "node:test";

import { useClient } from "../db.js";
import { fakeDb, makeRequest } from "../test-helpers.js";
import { SESSION_COOKIE } from "../auth.js";
import { ROLE_DEFAULTS } from "../permissions.js";
import { zonedParts, zonedToUtc } from "../time.js";
import { handleHearth } from "../../../api/hearth.js";

// A dummy connection string is enough: useClient means neon() is never
// called, and mail stays unconfigured so nothing can leave the process.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_EMAIL_DOMAIN;
process.env.ADMIN_EMAILS = "";

const HOST = "chamainteligente.com";
const LISBON = "Europe/Lisbon";
const NOW = Date.now();

/* ---------- a day far enough out that notice and horizon both pass ---------- */

const DAY = (() => {
  const p = zonedParts(new Date(NOW + 20 * 86400000), LISBON);
  return { year: p.year, month: p.month, day: p.day };
})();
const at = (minute) => zonedToUtc({ ...DAY, minute }, LISBON);
const DAY_START = at(0);
const DAY_END = new Date(DAY_START.getTime() + 86400000);
const SLOT_START = at(540); // 09:00 in Lisbon
const SLOT_END = new Date(SLOT_START.getTime() + 60 * 60000);
const WEEKDAY = zonedParts(SLOT_START, LISBON).weekday;

// One window, 09:00 to 12:00 in Lisbon, on the weekday that day falls on.
const RULE = { weekday: WEEKDAY, start_minute: 540, end_minute: 720, timezone: LISBON, active: true };

/* ---------- the fake room ---------- */

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
    timezone: LISBON,
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
function signedIn({ role = "client", users = {}, settings = [], extra = [] } = {}) {
  const rows = { "actor-1": userRow({ role }), ...users };
  return fakeDb([
    ...extra,
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
    ],
    [/count\(\*\)::int as n from users/, [{ n: 1 }]],
    [/select \* from users where id/, (call) => (rows[call.values[0]] ? [rows[call.values[0]]] : [])],
    [/select \* from roles where name/, [{ name: role, label: role, permissions: permissionsFor(role) }]],
    [/from user_permissions/, []],
    [/select key, value from settings/, settings]
  ]);
}

async function body(response) {
  return await response.clone().json();
}

// Mail is unconfigured on purpose; the handlers log the failure by name and
// carry on, so a test only has to keep the console quiet.
async function quiet(run) {
  const was = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = was;
  }
}

const PACK = {
  id: "pack-1",
  name: "Four sessions",
  description: "A month of work",
  sessions: 4,
  minutes: 60,
  price_cents: 40000,
  currency: "EUR",
  active: true,
  position: 0
};

/* ---------- packs and purchases ---------- */

test("a guest can read the packs and a visitor cannot", async () => {
  useClient(signedIn({ role: "guest", extra: [[/from packs where active/, [PACK]]] }));
  const response = await handleHearth(hearth("/packs", { cookie: "t" }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.packs.length, 1);
  assert.deepEqual(payload.packs[0], {
    id: "pack-1", name: "Four sessions", description: "A month of work",
    sessions: 4, minutes: 60, priceCents: 40000, currency: "EUR"
  });
  assert.equal(payload.pendingReferral, false);

  useClient(signedIn());
  const signedOut = await handleHearth(hearth("/packs"));
  assert.equal(signedOut.status, 401);
});

test("a pack that is not on offer is not found", async () => {
  const db = signedIn({ role: "guest", extra: [[/select \* from packs where id/, []]] });
  useClient(db);
  const response = await handleHearth(
    hearth("/purchases", { method: "POST", cookie: "t", body: JSON.stringify({ packId: "nope" }) })
  );
  assert.equal(response.status, 404);
  assert.equal((await body(response)).error, "That pack is not available.");
  assert.equal(db.count(/insert into purchases/), 0);
});

test("asking for a pack writes a requested purchase and survives an unsendable email", async () => {
  const db = signedIn({
    role: "guest",
    extra: [
      [/select \* from packs where id/, [PACK]],
      [/count\(\*\)::int as n from purchases/, [{ n: 0 }]],
      [/from referral_events where referrer_id/, []],
      [
        /insert into purchases/,
        (call) => [{ id: "purchase-1", pack_name: call.values[2], sessions: call.values[3], status: "requested", note: call.values[7] }]
      ],
      [/select email, name from users where role = 'owner'/, [{ email: "owner@example.com", name: "Elliot" }]]
    ]
  });
  useClient(db);

  const response = await quiet(() =>
    handleHearth(
      hearth("/purchases", { method: "POST", cookie: "t", body: JSON.stringify({ packId: "pack-1", note: "mornings suit me" }) })
    )
  );
  assert.equal(response.status, 200);
  assert.equal((await body(response)).purchase.status, "requested");

  const insert = db.matching(/insert into purchases/)[0];
  assert.ok(/'requested'/.test(insert.text), "the status is written as requested");
  assert.deepEqual(insert.values, ["actor-1", "pack-1", "Four sessions", 4, 40000, 0, "EUR", "mornings suit me"]);
});

test("credits come back as the sum of the ledger", async () => {
  useClient(
    signedIn({
      extra: [
        [/as balance from credit_ledger/, [{ balance: 3 }]],
        [/select id, delta, reason, ref_id, note, created_at from credit_ledger/, [{ id: 1, delta: 4, reason: "purchase" }]],
        [/from purchases where user_id/, [{ id: "purchase-1", pack_name: "Four sessions", sessions: 4, status: "paid" }]],
        [/from referral_events where referrer_id/, []]
      ]
    })
  );
  const response = await handleHearth(hearth("/credits", { cookie: "t" }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.balance, 3);
  assert.equal(payload.ledger.length, 1);
  assert.equal(payload.purchases[0].packName, "Four sessions");
  assert.equal(payload.pendingDiscount, null);
});

/* ---------- slots ---------- */

function slotsDb(overrides = {}) {
  return signedIn({
    extra: [[/from availability_rules where active/, [RULE]]],
    ...overrides
  });
}

test("the slots of one day are every half hour the window holds", async () => {
  useClient(slotsDb());
  const response = await handleHearth(
    hearth(`/slots?from=${encodeURIComponent(DAY_START.toISOString())}&to=${encodeURIComponent(DAY_END.toISOString())}`, { cookie: "t" })
  );
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.minutes, 60);
  assert.equal(payload.timezone, LISBON);
  assert.equal(payload.slots.length, 5);
  assert.equal(payload.slots[0].startsAt, SLOT_START.toISOString());
  assert.equal(payload.slots[0].endsAt, SLOT_END.toISOString());
  assert.equal(payload.slots.at(-1).startsAt, at(660).toISOString());
});

test("the horizon cuts the window short", async () => {
  useClient(slotsDb({ settings: [{ key: "booking_horizon_days", value: 1 }] }));
  const response = await handleHearth(
    hearth(`/slots?from=${encodeURIComponent(DAY_START.toISOString())}&to=${encodeURIComponent(DAY_END.toISOString())}`, { cookie: "t" })
  );
  const payload = await body(response);
  assert.equal(payload.slots.length, 0);
  assert.ok(new Date(payload.horizon).getTime() <= Date.now() + 86400000 + 1000);
});

/* ---------- booking ---------- */

function bookingDb({ spend = [{ id: "credit-1" }], bookingInsert, extra = [], ...rest } = {}) {
  return signedIn({
    extra: [
      [/from availability_rules where active/, [RULE]],
      [/insert into credit_ledger/, spend],
      [
        /insert into bookings/,
        bookingInsert ||
          ((call) => [
            {
              id: "booking-1",
              user_id: call.values[0],
              starts_at: call.values[1],
              ends_at: call.values[2],
              status: "scheduled",
              credit_id: call.values[3],
              client_note: call.values[4],
              meeting_url: call.values[5]
            }
          ])
      ],
      [/as balance from credit_ledger/, [{ balance: 2 }]],
      [/select email, name from users where role = 'owner'/, []],
      ...extra
    ],
    ...rest
  });
}

test("a time the calculator would not offer is refused", async () => {
  const db = bookingDb();
  useClient(db);
  const response = await handleHearth(
    hearth("/bookings", { method: "POST", cookie: "t", body: JSON.stringify({ startsAt: at(480).toISOString() }) })
  );
  assert.equal(response.status, 409);
  assert.equal((await body(response)).error, "That time is not available.");
  assert.equal(db.count(/insert into credit_ledger/), 0);
  assert.equal(db.count(/insert into bookings/), 0);
});

test("a booking without a credit is refused and nothing is written", async () => {
  const db = bookingDb({ spend: [] });
  useClient(db);
  const response = await handleHearth(
    hearth("/bookings", { method: "POST", cookie: "t", body: JSON.stringify({ startsAt: SLOT_START.toISOString() }) })
  );
  assert.equal(response.status, 402);
  assert.equal((await body(response)).error, "You have no session credits left. Ask for a pack first.");
  assert.equal(db.count(/insert into bookings/), 0);
});

test("a booking spends the credit, then ties the credit to the session", async () => {
  const db = bookingDb();
  useClient(db);
  const response = await quiet(() =>
    handleHearth(
      hearth("/bookings", { method: "POST", cookie: "t", body: JSON.stringify({ startsAt: SLOT_START.toISOString(), note: "a note" }) })
    )
  );
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.equal(payload.booking.id, "booking-1");
  assert.equal(payload.balance, 2);

  const spend = db.matching(/insert into credit_ledger/)[0];
  assert.ok(/-1, 'booking'/.test(spend.text), "one credit is spent");
  const insert = db.matching(/insert into bookings/)[0];
  assert.deepEqual(insert.values, ["actor-1", SLOT_START.toISOString(), SLOT_END.toISOString(), "credit-1", "a note", null]);
  const tie = db.matching(/update credit_ledger set ref_id/)[0];
  assert.deepEqual(tie.values, ["booking-1", "credit-1"]);
  assert.equal(db.count(/delete from credit_ledger/), 0);
});

test("a session the database refuses gives the credit back", async () => {
  const db = bookingDb({
    bookingInsert: () => {
      throw new Error('conflicting key value violates exclusion constraint "bookings_starts_at_ends_at_excl"');
    }
  });
  useClient(db);
  const response = await handleHearth(
    hearth("/bookings", { method: "POST", cookie: "t", body: JSON.stringify({ startsAt: SLOT_START.toISOString() }) })
  );
  assert.equal(response.status, 409);
  assert.equal((await body(response)).error, "Someone just took that time. Pick another.");
  const undo = db.matching(/delete from credit_ledger/)[0];
  assert.ok(undo, "the spent credit is deleted");
  assert.deepEqual(undo.values, ["credit-1"]);
});

function bookingRow(startsAt, overrides = {}) {
  return {
    id: "booking-1",
    user_id: "actor-1",
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 3600000).toISOString(),
    status: "scheduled",
    credit_id: "credit-1",
    client_note: "",
    owner_note: "",
    meeting_url: null,
    ...overrides
  };
}

test("cancelling in good time gives the credit back", async () => {
  const db = signedIn({
    extra: [
      [/select \* from bookings where id/, [bookingRow(SLOT_START)]],
      [/as balance from credit_ledger/, [{ balance: 1 }]],
      [/select email, name from users where role = 'owner'/, []]
    ]
  });
  useClient(db);
  const response = await quiet(() =>
    handleHearth(hearth("/bookings/booking-1/cancel", { method: "POST", cookie: "t", body: JSON.stringify({ reason: "flu" }) }))
  );
  assert.equal(response.status, 200);
  assert.equal((await body(response)).refund, true);
  assert.equal(db.count(/update bookings set status = 'cancelled'/), 1);
  const refund = db.matching(/insert into credit_ledger/)[0];
  assert.ok(refund, "a credit is put back");
  assert.ok(/, 1, 'cancel'/.test(refund.text));
  assert.deepEqual(refund.values, ["actor-1", "booking-1", "actor-1"]);
});

test("cancelling inside the notice window cancels without a refund", async () => {
  const db = signedIn({
    extra: [
      [/select \* from bookings where id/, [bookingRow(new Date(Date.now() + 3600000))]],
      [/as balance from credit_ledger/, [{ balance: 0 }]],
      [/select email, name from users where role = 'owner'/, []]
    ]
  });
  useClient(db);
  const response = await quiet(() =>
    handleHearth(hearth("/bookings/booking-1/cancel", { method: "POST", cookie: "t", body: JSON.stringify({}) }))
  );
  assert.equal(response.status, 200);
  assert.equal((await body(response)).refund, false);
  assert.equal(db.count(/update bookings set status = 'cancelled'/), 1);
  assert.equal(db.count(/insert into credit_ledger/), 0);
});

test("a session cannot be moved inside the notice window", async () => {
  const db = signedIn({
    extra: [[/select \* from bookings where id/, [bookingRow(new Date(Date.now() + 3600000))]]]
  });
  useClient(db);
  const response = await handleHearth(
    hearth("/bookings/booking-1/move", { method: "POST", cookie: "t", body: JSON.stringify({ startsAt: SLOT_START.toISOString() }) })
  );
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, "Sessions can be moved up to 24 hours before they start.");
  assert.equal(db.count(/update bookings set starts_at/), 0);
});

/* ---------- the owner's side ---------- */

const PURCHASE = {
  id: "purchase-1",
  user_id: "member-1",
  pack_id: "pack-1",
  pack_name: "Four sessions",
  sessions: 4,
  status: "requested",
  amount_cents: 40000,
  discount_cents: 0,
  currency: "EUR",
  note: ""
};

const MEMBER = userRow({ id: "member-1", email: "member@example.com", name: "Member", role: "guest" });

test("marking a purchase paid adds the credits and makes a client", async () => {
  const db = signedIn({
    role: "owner",
    users: { "member-1": MEMBER },
    extra: [
      [/select \* from purchases where id/, [PURCHASE]],
      [/from referral_events where referred_id/, []],
      [/from referral_events where referrer_id/, []]
    ]
  });
  useClient(db);
  const response = await quiet(() =>
    handleHearth(hearth("/admin/purchases/purchase-1", { method: "PATCH", cookie: "t", body: JSON.stringify({ status: "paid" }) }))
  );
  assert.equal(response.status, 200);
  assert.equal(db.count(/update purchases set status = 'paid', paid_at = now\(\)/), 1);
  const credit = db.matching(/insert into credit_ledger/)[0];
  assert.ok(/'purchase'/.test(credit.text));
  assert.deepEqual(credit.values, ["member-1", 4, "purchase-1", "Four sessions", "actor-1"]);
  const promoted = db.matching(/update users set role = 'client'/)[0];
  assert.ok(promoted, "a guest becomes a client");
  assert.deepEqual(promoted.values, ["member-1"]);
});

test("a paid purchase does not change status again, and an unknown status is refused", async () => {
  const db = signedIn({
    role: "owner",
    users: { "member-1": MEMBER },
    extra: [[/select \* from purchases where id/, [{ ...PURCHASE, status: "paid" }]]]
  });
  useClient(db);
  const again = await handleHearth(
    hearth("/admin/purchases/purchase-1", { method: "PATCH", cookie: "t", body: JSON.stringify({ status: "invoiced" }) })
  );
  assert.equal(again.status, 400);
  assert.equal((await body(again)).error, "A paid purchase cannot change status. Adjust credits by hand instead.");
  assert.equal(db.count(/insert into credit_ledger/), 0);

  const unknown = await handleHearth(
    hearth("/admin/purchases/purchase-1", { method: "PATCH", cookie: "t", body: JSON.stringify({ status: "settled" }) })
  );
  assert.equal(unknown.status, 400);
  assert.equal((await body(unknown)).error, "Unknown status.");
  assert.equal(db.count(/update purchases set status/), 0);
});

test("granting credits takes whole numbers only", async () => {
  const db = signedIn({
    role: "owner",
    users: { "member-1": MEMBER },
    extra: [[/as balance from credit_ledger/, [{ balance: 2 }]]]
  });
  useClient(db);
  const grant = (delta, note) =>
    handleHearth(hearth("/admin/credits", { method: "POST", cookie: "t", body: JSON.stringify({ userId: "member-1", delta, note }) }));

  for (const delta of [0, 1.5, "two", 101]) {
    const refused = await grant(delta);
    assert.equal(refused.status, 400, `delta ${delta}`);
    assert.equal((await body(refused)).error, "Enter a whole number of credits.");
  }
  assert.equal(db.count(/insert into credit_ledger/), 0);

  const response = await grant(2, "on the house");
  assert.equal(response.status, 200);
  assert.equal((await body(response)).balance, 2);
  const insert = db.matching(/insert into credit_ledger/)[0];
  assert.ok(/'grant'/.test(insert.text));
  assert.deepEqual(insert.values, ["member-1", 2, "on the house", "actor-1"]);
  assert.equal(db.count(/update users set role = 'client'/), 1);
});

test("availability refuses a backwards window and an eighth weekday", async () => {
  const db = signedIn({ role: "owner" });
  useClient(db);
  const put = (rules) => handleHearth(hearth("/admin/availability", { method: "PUT", cookie: "t", body: JSON.stringify({ rules }) }));

  const backwards = await put([{ weekday: 2, startMinute: 720, endMinute: 540 }]);
  assert.equal(backwards.status, 400);
  assert.equal((await body(backwards)).error, "A window needs a start before its end, within the day.");

  const eighthDay = await put([{ weekday: 7, startMinute: 540, endMinute: 720 }]);
  assert.equal(eighthDay.status, 400);
  assert.equal((await body(eighthDay)).error, "Weekday out of range.");

  assert.equal(db.count(/delete from availability_rules/), 0);
  assert.equal(db.count(/insert into availability_rules/), 0);
});

test("saving availability clears the rules and writes the new ones", async () => {
  const db = signedIn({ role: "owner" });
  useClient(db);
  const response = await handleHearth(
    hearth("/admin/availability", {
      method: "PUT",
      cookie: "t",
      body: JSON.stringify({
        rules: [
          { weekday: 2, startMinute: 540, endMinute: 720 },
          { weekday: 4, startMinute: 600, endMinute: 660, timezone: "America/New_York", active: false }
        ]
      })
    })
  );
  assert.equal(response.status, 200);
  const clear = db.calls.findIndex((c) => /delete from availability_rules/.test(c.text));
  const inserts = db.matching(/insert into availability_rules/);
  assert.ok(clear > -1);
  assert.ok(clear < db.calls.findIndex((c) => /insert into availability_rules/.test(c.text)), "cleared before written");
  assert.equal(inserts.length, 2);
  assert.deepEqual(inserts[0].values, [2, 540, 720, LISBON, true]);
  assert.deepEqual(inserts[1].values, [4, 600, 660, "America/New_York", false]);
});

test("a block needs a start before its end", async () => {
  const db = signedIn({ role: "owner" });
  useClient(db);
  const response = await handleHearth(
    hearth("/admin/blocks", {
      method: "POST",
      cookie: "t",
      body: JSON.stringify({ startsAt: SLOT_END.toISOString(), endsAt: SLOT_START.toISOString() })
    })
  );
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, "A block needs a start before its end.");
  assert.equal(db.count(/insert into availability_blocks/), 0);
});

test("a meeting link that is not https is refused", async () => {
  const db = signedIn({
    role: "owner",
    extra: [[/select \* from bookings where id/, [bookingRow(SLOT_START)]]]
  });
  useClient(db);
  const response = await handleHearth(
    hearth("/admin/bookings/booking-1", { method: "PATCH", cookie: "t", body: JSON.stringify({ meetingUrl: "http://meet.example.com/room" }) })
  );
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, "A meeting link starts with https://");
  assert.equal(db.count(/update bookings set meeting_url/), 0);
});

test("a client cannot reach the owner's packs", async () => {
  const db = signedIn({ role: "client" });
  useClient(db);
  const response = await handleHearth(hearth("/admin/packs", { cookie: "t" }));
  assert.equal(response.status, 403);
  assert.equal((await body(response)).error, "You do not have access to that.");
  assert.equal(db.count(/from packs/), 0);
});
