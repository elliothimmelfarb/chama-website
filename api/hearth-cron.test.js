import assert from "node:assert/strict";
import test from "node:test";

import { useClient } from "../lib/hearth/db.js";
import { fakeDb, makeRequest } from "../lib/hearth/test-helpers.js";
import { handleCron, sendReminders, sweep } from "./hearth-cron.js";

// A dummy connection string is enough: useClient means neon() is never
// called, and with no RESEND_* the mailer refuses before it can reach
// anything, so nothing can leave the process.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_EMAIL_DOMAIN;
process.env.CRON_SECRET = "the-cron-secret";

const HOST = "chamainteligente.com";

function cron(secret) {
  const headers = {};
  if (secret) headers.authorization = `Bearer ${secret}`;
  return makeRequest(`https://${HOST}/api/hearth-cron`, { headers });
}

async function body(response) {
  return await response.clone().json();
}

async function quiet(run) {
  const was = console.error;
  const wasInfo = console.info;
  console.error = () => {};
  console.info = () => {};
  try {
    return await run();
  } finally {
    console.error = was;
    console.info = wasInfo;
  }
}

function bookingRow(overrides = {}) {
  return {
    id: "booking-1",
    starts_at: new Date(Date.now() + 24 * 3600000).toISOString(),
    ends_at: new Date(Date.now() + 25 * 3600000).toISOString(),
    meeting_url: "",
    email: "someone@example.com",
    name: "Someone",
    timezone: "Europe/Lisbon",
    ...overrides
  };
}

test("the job is nobody's to run without the shared secret", async () => {
  useClient(fakeDb());
  assert.equal((await handleCron(cron())).status, 401);
  assert.equal((await handleCron(cron("not-the-secret"))).status, 401);
});

test("with no database the job says so rather than failing", async () => {
  const url = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await handleCron(cron("the-cron-secret"));
    assert.equal(response.status, 503);
    assert.deepEqual(await body(response), { ok: false, reason: "unconfigured" });
  } finally {
    process.env.DATABASE_URL = url;
  }
});

test("reminders are looked for in both windows and nothing is marked sent when the mail cannot go", async () => {
  const db = fakeDb([[/from bookings b join users u/, [bookingRow()]]]);
  useClient(db);
  const sent = await quiet(() => sendReminders(new Date("2026-09-02T10:00:00.000Z")));
  assert.equal(sent, 0, "the send fails first, so nothing counts as sent");
  const selects = db.matching(/from bookings b join users u/);
  assert.equal(selects.length, 2, "one window a day out, one an hour out");
  const [day, hour] = selects.map((call) => [Date.parse(call.values[0]), Date.parse(call.values[1])]);
  assert.equal((day[1] - day[0]) / 3600000, 2);
  assert.equal(day[0] - Date.parse("2026-09-02T10:00:00.000Z"), 23 * 3600000);
  assert.equal(hour[0] - Date.parse("2026-09-02T10:00:00.000Z"), 0.75 * 3600000);
  assert.equal(db.count(/update bookings set reminded/), 0, "an unsent reminder is never recorded as sent");
});

test("the sweep clears out everything that has expired", async () => {
  const db = fakeDb();
  useClient(db);
  await sweep();
  const deletes = db.matching(/^\s*delete from/);
  assert.equal(deletes.length, 5);
  for (const table of ["email_tokens", "oauth_states", "rate_limits", "oauth_codes", "login_sessions"]) {
    assert.equal(db.count(new RegExp(`delete from ${table}`)), 1, table);
  }
});

test("a run with the right secret sweeps and reports what it sent", async () => {
  const db = fakeDb([[/from bookings b join users u/, [bookingRow()]]]);
  useClient(db);
  const response = await quiet(() => handleCron(cron("the-cron-secret")));
  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { ok: true, reminders: 0, meet: { pulled: 0, checked: 0 } });
  assert.equal(db.matching(/^\s*delete from/).length, 5);
});
