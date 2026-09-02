import assert from "node:assert/strict";
import test, { after } from "node:test";

import { useClient } from "./db.js";
import { fakeDb } from "./test-helpers.js";
import {
  SCOPES,
  googleConfig,
  seal,
  open,
  connectionStatus,
  authorizeUrl,
  finishConnect,
  disconnect,
  accessToken,
  createMeeting,
  moveMeeting,
  cancelMeeting,
  fetchTranscript
} from "./google.js";

// Nothing here talks to Google or to Postgres: every fetch is injected and
// every query goes to the fake client.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";

const SECRET = "s".repeat(48);
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
process.env.HEARTH_SESSION_SECRET = SECRET;

after(() => {
  restore("GOOGLE_CLIENT_ID", ORIGINAL.id);
  restore("GOOGLE_CLIENT_SECRET", ORIGINAL.secret);
  restore("HEARTH_SESSION_SECRET", ORIGINAL.session);
});

const REDIRECT = "https://chamainteligente.com/api/hearth/google/callback";
const ACCESS = "access-token-1";

// A fetch that answers a planned sequence: each call takes the first entry
// still waiting whose match is a substring of the url, so a test reads as
// the list of calls it expects. Anything unplanned throws rather than
// reaching the network.
function fakeFetch(plan) {
  const waiting = plan.map((entry) => ({ ...entry, used: false }));
  const calls = [];
  const fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ url: target, options, body: options.body });
    const entry = waiting.find((e) => !e.used && target.includes(e.match));
    if (!entry) throw new Error(`UnplannedFetch: ${target}`);
    entry.used = true;
    const status = entry.status || 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (typeof entry.body === "function" ? entry.body() : entry.body ?? {})
    };
  };
  fetch.calls = calls;
  return fetch;
}

const tokenCall = { match: "oauth2.googleapis.com/token", body: { access_token: ACCESS, expires_in: 3600 } };

function connectionRow(overrides = {}) {
  return {
    email: "elliot@example.com",
    refresh: seal("refresh-token-plain", SECRET),
    scopes: SCOPES,
    connectedAt: "2026-09-01T10:00:00.000Z",
    calendarId: "primary",
    ...overrides
  };
}

// A database holding a connection, with the module's access-token cache
// cleared so the next call is known to refresh.
async function connected(extra = []) {
  const db = fakeDb([...extra, [/select value from settings/, [{ value: connectionRow() }]]]);
  useClient(db);
  await disconnect();
  return db;
}

function idToken(claims) {
  const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "none" })}.${part(claims)}.sig`;
}

function formValue(body, key) {
  return new URLSearchParams(String(body)).get(key);
}

/* ---------- configuration ---------- */

test("Google is configured only with a client id, a secret and a long session secret", () => {
  assert.equal(googleConfig().configured, true);
  assert.equal(googleConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" }).configured, false);
  assert.equal(googleConfig({ GOOGLE_CLIENT_ID: "a", HEARTH_SESSION_SECRET: SECRET }).configured, false);
  assert.equal(googleConfig({ GOOGLE_CLIENT_SECRET: "b", HEARTH_SESSION_SECRET: SECRET }).configured, false);
  assert.equal(googleConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", HEARTH_SESSION_SECRET: "short" }).configured, false);
  assert.equal(googleConfig({ GOOGLE_CLIENT_ID: " a ", GOOGLE_CLIENT_SECRET: "b", HEARTH_SESSION_SECRET: SECRET }).clientId, "a");
});

/* ---------- the sealed secret ---------- */

test("a sealed token comes back only with the right key", () => {
  const sealed = seal("refresh-token-plain", SECRET);
  assert.ok(!sealed.includes("refresh-token-plain"));
  assert.equal(open(sealed, SECRET), "refresh-token-plain");
  assert.equal(open(sealed, "another-secret-entirely-0123456789"), null);

  const parts = sealed.split(".");
  const tampered = [parts[0], parts[1], Buffer.from("tampered body").toString("base64url"), parts[3]].join(".");
  assert.equal(open(tampered, SECRET), null);

  assert.equal(open("garbage", SECRET), null);
  assert.equal(open("", SECRET), null);
  assert.equal(open(null, SECRET), null);
  assert.equal(open("v2.a.b.c", SECRET), null);
});

/* ---------- the connection ---------- */

test("the status is unconnected with no row and connected with one", async () => {
  useClient(fakeDb());
  const empty = await connectionStatus();
  assert.equal(empty.configured, true);
  assert.equal(empty.connected, false);
  assert.equal(empty.email, null);
  assert.deepEqual(empty.scopes, []);
  assert.equal(empty.calendarId, "primary");

  useClient(fakeDb([[/select value from settings/, [{ value: connectionRow({ calendarId: "work@example.com" }) }]]]));
  const live = await connectionStatus();
  assert.equal(live.connected, true);
  assert.equal(live.email, "elliot@example.com");
  assert.deepEqual(live.scopes, SCOPES);
  assert.equal(live.calendarId, "work@example.com");
  assert.equal(live.connectedAt, "2026-09-01T10:00:00.000Z");
});

test("the consent url asks for offline access to every scope", () => {
  const url = new URL(authorizeUrl({ redirectUri: REDIRECT, state: "state-1" }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), "client-id.apps.googleusercontent.com");
  assert.equal(url.searchParams.get("redirect_uri"), REDIRECT);
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "state-1");
  const scope = url.searchParams.get("scope");
  for (const wanted of SCOPES) assert.ok(scope.split(" ").includes(wanted), `${wanted} is asked for`);
});

/* ---------- finishing the connection ---------- */

test("an exchange that fails or returns no refresh token connects nothing", async () => {
  const db = fakeDb();
  useClient(db);
  const bad = await finishConnect({ code: "c", redirectUri: REDIRECT }, { fetch: fakeFetch([{ match: "oauth2.googleapis.com/token", status: 400, body: { error: "invalid_grant" } }]) });
  assert.deepEqual(bad, { ok: false, reason: "exchange" });

  const noRefresh = await finishConnect({ code: "c", redirectUri: REDIRECT }, { fetch: fakeFetch([{ match: "oauth2.googleapis.com/token", body: { access_token: ACCESS } }]) });
  assert.deepEqual(noRefresh, { ok: false, reason: "exchange" });
  assert.equal(db.count(/insert into settings/), 0);
});

test("a finished connection stores the email and a sealed refresh token, never the token itself", async () => {
  const db = fakeDb();
  useClient(db);
  const fetch = fakeFetch([
    {
      match: "oauth2.googleapis.com/token",
      body: {
        refresh_token: "refresh-token-plain",
        access_token: ACCESS,
        scope: SCOPES.join(" "),
        id_token: idToken({ email: "Elliot@Example.com" })
      }
    }
  ]);
  const result = await finishConnect({ code: "the-code", redirectUri: REDIRECT }, { fetch });
  assert.deepEqual(result, { ok: true, email: "elliot@example.com", scopes: SCOPES });

  const exchange = fetch.calls[0];
  assert.equal(exchange.options.method, "POST");
  assert.equal(formValue(exchange.body, "grant_type"), "authorization_code");
  assert.equal(formValue(exchange.body, "code"), "the-code");
  assert.equal(formValue(exchange.body, "redirect_uri"), REDIRECT);

  const insert = db.matching(/insert into settings/)[0];
  assert.ok(insert, "the connection is written to settings");
  const stored = JSON.parse(insert.values.find((v) => typeof v === "string" && v.includes("refresh")));
  assert.equal(stored.email, "elliot@example.com");
  assert.equal(stored.calendarId, "primary");
  assert.deepEqual(stored.scopes, SCOPES);
  assert.equal(open(stored.refresh, SECRET), "refresh-token-plain");
  for (const call of db.calls) {
    for (const value of call.values) {
      assert.ok(!String(value).includes("refresh-token-plain"), "the plain refresh token is never in a query");
    }
  }
});

/* ---------- access tokens ---------- */

test("an access token is minted from the sealed refresh token and kept for the hour", async () => {
  await connected();
  const fetch = fakeFetch([tokenCall]);
  assert.equal(await accessToken({ fetch }), ACCESS);
  assert.equal(fetch.calls.length, 1);
  assert.equal(formValue(fetch.calls[0].body, "grant_type"), "refresh_token");
  assert.equal(formValue(fetch.calls[0].body, "refresh_token"), "refresh-token-plain");
  assert.equal(formValue(fetch.calls[0].body, "client_id"), "client-id.apps.googleusercontent.com");

  assert.equal(await accessToken({ fetch }), ACCESS);
  assert.equal(fetch.calls.length, 1, "the second call is served from the cache");
});

test("no connection is GoogleNotConnected and a refused refresh is GoogleRefreshFailed", async () => {
  const db = fakeDb();
  useClient(db);
  await disconnect();
  await assert.rejects(() => accessToken({ fetch: fakeFetch([]) }), /GoogleNotConnected/);

  await connected();
  await assert.rejects(
    () => accessToken({ fetch: fakeFetch([{ match: "oauth2.googleapis.com/token", status: 400, body: { error: "invalid_grant" } }]) }),
    /GoogleRefreshFailed/
  );
});

/* ---------- the calendar event ---------- */

test("a booking becomes a calendar event with a Meet room and the client invited", async () => {
  await connected();
  const fetch = fakeFetch([
    tokenCall,
    {
      match: "calendar/v3/calendars/primary/events?",
      body: {
        id: "event-1",
        hangoutLink: "https://meet.google.com/abc-defg-hij",
        conferenceData: { conferenceId: "abc-defg-hij" }
      }
    }
  ]);
  const meeting = await createMeeting(
    {
      bookingId: "booking-1",
      startsAt: "2026-09-10T14:00:00.000Z",
      endsAt: "2026-09-10T15:00:00.000Z",
      clientEmail: "client@example.com",
      clientName: "A Client",
      title: "Session"
    },
    { fetch }
  );
  assert.deepEqual(meeting, { eventId: "event-1", meetUrl: "https://meet.google.com/abc-defg-hij", meetingCode: "abc-defg-hij" });

  const post = fetch.calls[1];
  assert.equal(post.options.method, "POST");
  assert.ok(post.url.includes("conferenceDataVersion=1"), "the Meet room is asked for");
  assert.ok(post.url.includes("sendUpdates=all"));
  assert.equal(post.options.headers.Authorization, `Bearer ${ACCESS}`);
  const sent = JSON.parse(post.body);
  assert.equal(sent.conferenceData.createRequest.conferenceSolutionKey.type, "hangoutsMeet");
  assert.equal(sent.conferenceData.createRequest.requestId, "hearth-booking-1");
  assert.deepEqual(sent.attendees, [{ email: "client@example.com", displayName: "A Client" }]);
  assert.equal(sent.extendedProperties.private.hearthBookingId, "booking-1");
  assert.equal(sent.summary, "Session");
});

test("moving a booking patches the event and tells the attendees", async () => {
  await connected();
  const fetch = fakeFetch([tokenCall, { match: "/events/event-1", body: { id: "event-1" } }]);
  await moveMeeting({ eventId: "event-1", startsAt: "2026-09-11T14:00:00.000Z", endsAt: "2026-09-11T15:00:00.000Z" }, { fetch });
  const patch = fetch.calls[1];
  assert.equal(patch.options.method, "PATCH");
  assert.ok(patch.url.includes("sendUpdates=all"));
  const sent = JSON.parse(patch.body);
  assert.equal(sent.start.dateTime, "2026-09-11T14:00:00.000Z");
  assert.equal(sent.end.dateTime, "2026-09-11T15:00:00.000Z");
});

test("cancelling an event that is already gone is fine, a broken calendar is not", async () => {
  await connected();
  await cancelMeeting({ eventId: "event-1" }, { fetch: fakeFetch([tokenCall, { match: "/events/event-1", status: 404, body: { error: { message: "Not Found" } } }]) });
  await cancelMeeting({ eventId: "event-1" }, { fetch: fakeFetch([{ match: "/events/event-1", status: 410, body: {} }]) });
  await assert.rejects(
    () => cancelMeeting({ eventId: "event-1" }, { fetch: fakeFetch([{ match: "/events/event-1", status: 500, body: { error: { message: "boom" } } }]) }),
    /GoogleDELETEFailed/
  );
});

/* ---------- the transcript ---------- */

test("nothing to fetch: no code, no record, nothing ended, no finished transcript", async () => {
  assert.equal(await fetchTranscript({ meetingCode: "" }, { fetch: fakeFetch([]) }), null);

  await connected();
  assert.equal(await fetchTranscript({ meetingCode: "abc" }, { fetch: fakeFetch([tokenCall, { match: "conferenceRecords?filter", body: { conferenceRecords: [] } }]) }), null);

  await connected();
  assert.equal(
    await fetchTranscript({ meetingCode: "abc" }, { fetch: fakeFetch([tokenCall, { match: "conferenceRecords?filter", body: { conferenceRecords: [{ name: "conferenceRecords/r1" }] } }]) }),
    null
  );

  await connected();
  assert.equal(
    await fetchTranscript(
      { meetingCode: "abc" },
      {
        fetch: fakeFetch([
          tokenCall,
          { match: "conferenceRecords?filter", body: { conferenceRecords: [{ name: "conferenceRecords/r1", endTime: "2026-09-10T15:00:00.000Z" }] } },
          { match: "/transcripts", body: { transcripts: [{ name: "conferenceRecords/r1/transcripts/t1", state: "STARTED" }] } }
        ])
      }
    ),
    null
  );
});

test("a finished transcript becomes named lines, with a speaker's run of turns joined", async () => {
  await connected();
  const fetch = fakeFetch([
    tokenCall,
    {
      match: "conferenceRecords?filter",
      body: {
        conferenceRecords: [
          { name: "conferenceRecords/old", startTime: "2026-09-09T14:00:00.000Z", endTime: "2026-09-09T15:00:00.000Z" },
          { name: "conferenceRecords/r1", startTime: "2026-09-10T14:00:00.000Z", endTime: "2026-09-10T15:00:00.000Z" }
        ]
      }
    },
    { match: "/transcripts", body: { transcripts: [{ name: "conferenceRecords/r1/transcripts/t1", state: "FILE_GENERATED" }] } },
    {
      match: "/participants",
      body: {
        participants: [
          { name: "conferenceRecords/r1/participants/p1", signedinUser: { displayName: "Elliot" } },
          { name: "conferenceRecords/r1/participants/p2", signedinUser: { displayName: "A Client" } }
        ]
      }
    },
    {
      match: "/entries",
      body: {
        transcriptEntries: [
          { participant: "conferenceRecords/r1/participants/p1", text: "Good morning." },
          { participant: "conferenceRecords/r1/participants/p1", text: "How did the week go?" },
          { participant: "conferenceRecords/r1/participants/p2", text: "  " }
        ],
        nextPageToken: "page-2"
      }
    },
    {
      match: "/entries",
      body: {
        transcriptEntries: [
          { participant: "conferenceRecords/r1/participants/p2", text: "Busy." },
          { participant: "conferenceRecords/r1/participants/unknown", text: "Hello?" }
        ]
      }
    }
  ]);

  const found = await fetchTranscript({ meetingCode: "abc-defg-hij" }, { fetch });
  assert.equal(found.recordName, "conferenceRecords/r1", "the most recent ended record wins");
  assert.equal(found.endTime, "2026-09-10T15:00:00.000Z");
  assert.deepEqual(found.participants, ["Elliot", "A Client"]);
  assert.equal(found.text, ["Elliot: Good morning. How did the week go?", "A Client: Busy.", "Speaker: Hello?"].join("\n"));

  assert.ok(fetch.calls[1].url.includes(encodeURIComponent('space.meeting_code = "abc-defg-hij"')), "the record is looked up by meeting code");
  assert.ok(fetch.calls[5].url.includes("pageToken=page-2"), "the second page of entries is asked for");
  assert.equal(fetch.calls.length, 6);
});
