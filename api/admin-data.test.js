import assert from "node:assert/strict";
import test from "node:test";

import { SESSION_COOKIE, signSession } from "./admin-auth.js";
import {
  buildSummary,
  countByDay,
  dayFromPathname,
  dayRange,
  handleAdminData,
  isConversationPathname,
  selectRecent,
  summarizeConversation
} from "./admin-data.js";

const SECRET = "a".repeat(64);
const ADMIN = "elliot@chamainteligente.com";

const ENV = {
  GOOGLE_CLIENT_ID: "123456.apps.googleusercontent.com",
  ADMIN_EMAILS: ADMIN,
  ADMIN_SESSION_SECRET: SECRET
};

const NOW_MS = Date.UTC(2026, 7, 30, 12, 0, 0);
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

function signedInCookie(exp = NOW_SECONDS + 1000, email = ADMIN) {
  return `${SESSION_COOKIE}=${signSession({ email, exp }, SECRET)}`;
}

function blob(pathname, { uploadedAt, size = 100 } = {}) {
  return {
    pathname,
    url: `https://blob.example.com/${pathname}`,
    uploadedAt: uploadedAt || `${dayFromPathname(pathname)}T09:00:00.000Z`,
    size
  };
}

function conversationRecord(id, overrides = {}) {
  return {
    schemaVersion: 1,
    conversationId: id,
    source: "chamainteligente.com",
    updatedAt: "2026-08-30T09:00:00.000Z",
    turns: [
      { role: "user", content: "Can you help with agents?" },
      { role: "assistant", content: "Yes." }
    ],
    toolEvents: [],
    ...overrides
  };
}

function intakeRecord(name) {
  return {
    schemaVersion: 2,
    submittedAt: "2026-08-30T09:00:00.000Z",
    source: "chamainteligente.com",
    name,
    email: "someone@example.com",
    whatsappNumber: "",
    request: "I would like an agent."
  };
}

// A blob store made of two maps, keyed the way @vercel/blob keys things: list()
// answers by prefix and get() answers by url or pathname.
function store({ blobs = [], contents = {} } = {}) {
  const byKey = new Map();
  for (const [pathname, value] of Object.entries(contents)) {
    const text = JSON.stringify(value);
    byKey.set(pathname, text);
    byKey.set(`https://blob.example.com/${pathname}`, text);
  }

  const calls = { list: 0, get: 0 };

  return {
    calls,
    list: async ({ prefix }) => {
      calls.list += 1;
      return { blobs: blobs.filter((entry) => entry.pathname.startsWith(prefix)), hasMore: false };
    },
    get: async (key) => {
      calls.get += 1;
      const text = byKey.get(key);
      return text === undefined ? null : { text: async () => text };
    }
  };
}

function deps(overrides = {}) {
  return { env: ENV, now: () => NOW_MS, ...overrides };
}

function get(query, { cookie = signedInCookie(), origin } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  return new Request(`https://chamainteligente.com/api/admin-data${query}`, { headers });
}

test("only a well formed conversation key is fetchable", () => {
  assert.equal(isConversationPathname("chat/2026-08-30/abcd-1234-efgh.json"), true);
  assert.equal(isConversationPathname("chat/2026-08-30/../../ops/kill-switch.json"), false);
  assert.equal(isConversationPathname("ops/kill-switch.json"), false);
  assert.equal(isConversationPathname("intake/2026-08-30/submission-x.json"), false);
  assert.equal(isConversationPathname("chat/2026-8-30/abcdefgh.json"), false);
  assert.equal(isConversationPathname("chat/2026-08-30/short.json"), false);
  assert.equal(isConversationPathname("chat/2026-08-30/abcdefgh.json?x=1"), false);
  assert.equal(isConversationPathname(undefined), false);
});

test("reads the day out of a pathname", () => {
  assert.equal(dayFromPathname("chat/2026-08-30/id.json"), "2026-08-30");
  assert.equal(dayFromPathname("intake/2026-08-01/submission-a.json"), "2026-08-01");
  assert.equal(dayFromPathname("ops/kill-switch.json"), null);
});

test("the day range is oldest first and covers every day", () => {
  const range = dayRange(NOW_MS, 3);
  assert.deepEqual(range, ["2026-08-28", "2026-08-29", "2026-08-30"]);
});

test("selects the newest blobs inside the window and caps them", () => {
  const blobs = [
    blob("chat/2026-08-30/aaaaaaaa.json", { uploadedAt: "2026-08-30T09:00:00.000Z" }),
    blob("chat/2026-08-29/bbbbbbbb.json", { uploadedAt: "2026-08-29T09:00:00.000Z" }),
    blob("chat/2026-01-01/cccccccc.json", { uploadedAt: "2026-01-01T09:00:00.000Z" })
  ];

  const result = selectRecent(blobs, { at: NOW_MS, days: 30 });
  assert.deepEqual(
    result.selected.map((entry) => entry.pathname),
    ["chat/2026-08-30/aaaaaaaa.json", "chat/2026-08-29/bbbbbbbb.json"]
  );
  assert.equal(result.capped, false);

  const capped = selectRecent(blobs, { at: NOW_MS, days: 30, cap: 1 });
  assert.equal(capped.selected.length, 1);
  assert.equal(capped.capped, true);

  const byBytes = selectRecent(blobs, { at: NOW_MS, days: 30, totalBytes: 150 });
  assert.equal(byBytes.selected.length, 1);
  assert.equal(byBytes.capped, true);
});

test("counts blobs per day and ignores days outside the range", () => {
  const range = dayRange(NOW_MS, 2);
  const counts = countByDay(
    [blob("chat/2026-08-30/a.json"), blob("chat/2026-08-30/b.json"), blob("chat/2026-01-01/c.json")],
    range
  );
  assert.equal(counts.get("2026-08-30"), 2);
  assert.equal(counts.get("2026-08-29"), 0);
});

test("summarises a conversation without carrying the whole transcript", () => {
  const record = conversationRecord("abcd-1234-efgh", {
    turns: [
      { role: "user", content: "x".repeat(300) },
      { role: "assistant", content: "ok" },
      { role: "user", content: "again" }
    ],
    toolEvents: [{ name: "send_note_to_elliot", input: {} }]
  });

  const summary = summarizeConversation(record, blob("chat/2026-08-30/abcd-1234-efgh.json"));
  assert.equal(summary.conversationId, "abcd-1234-efgh");
  assert.equal(summary.day, "2026-08-30");
  assert.equal(summary.turnCount, 3);
  assert.equal(summary.userTurns, 2);
  assert.equal(summary.noteSent, true);
  assert.equal(summary.preview.length, 140);
});

test("a conversation record missing its fields still summarises", () => {
  const summary = summarizeConversation({}, blob("chat/2026-08-30/abcd-1234-efgh.json"));
  assert.equal(summary.conversationId, "abcd-1234-efgh");
  assert.equal(summary.turnCount, 0);
  assert.equal(summary.noteSent, false);
  assert.equal(summary.preview, "");
});

test("the summary aggregates totals and per day counts", () => {
  const chatBlobs = [
    blob("chat/2026-08-30/aaaaaaaa.json", { uploadedAt: "2026-08-30T11:00:00.000Z" }),
    blob("chat/2026-08-29/bbbbbbbb.json", { uploadedAt: "2026-08-29T11:00:00.000Z" })
  ];
  const intakeBlobs = [blob("intake/2026-08-30/submission-a.json", { uploadedAt: "2026-08-30T10:00:00.000Z" })];

  const summary = buildSummary({
    flame: { killed: false, reason: null, at: null, chatDisabledEnv: false },
    intakeBlobs,
    chatBlobs,
    conversations: [{ noteSent: true }, { noteSent: false }],
    at: NOW_MS,
    days: 3
  });

  assert.deepEqual(summary.totals, {
    intakes: 1,
    conversations: 2,
    notesSent: 1,
    lastActivity: "2026-08-30T11:00:00.000Z"
  });
  assert.equal(summary.days.length, 3);
  assert.deepEqual(summary.days[2], { day: "2026-08-30", conversations: 1, intakes: 1 });
  assert.deepEqual(summary.days[0], { day: "2026-08-28", conversations: 0, intakes: 0 });
});

test("no session is a generic 401", async () => {
  const response = await handleAdminData(get("?view=summary", { cookie: null }), deps(store()));
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(Object.keys(body).length, 1);
  assert.ok(body.error);
});

test("an expired session is a 401", async () => {
  const response = await handleAdminData(
    get("?view=summary", { cookie: signedInCookie(NOW_SECONDS - 1) }),
    deps(store())
  );
  assert.equal(response.status, 401);
});

test("a session for an email off the allowlist is a 401", async () => {
  const response = await handleAdminData(
    get("?view=summary", { cookie: signedInCookie(NOW_SECONDS + 1000, "stranger@example.com") }),
    deps(store())
  );
  assert.equal(response.status, 401);
});

test("a missing configuration is a 503, not a 401", async () => {
  const response = await handleAdminData(get("?view=summary"), deps({ ...store(), env: {} }));
  assert.equal(response.status, 503);
});

test("a cross origin read is refused", async () => {
  const response = await handleAdminData(
    get("?view=summary", { origin: "https://evil.example.com" }),
    deps(store())
  );
  assert.equal(response.status, 403);
});

test("anything but GET is refused", async () => {
  const response = await handleAdminData(
    new Request("https://chamainteligente.com/api/admin-data", { method: "POST" }),
    deps(store())
  );
  assert.equal(response.status, 405);
});

test("the summary view reports the flame and the counts", async () => {
  const blobs = [
    blob("chat/2026-08-30/aaaaaaaa.json", { uploadedAt: "2026-08-30T11:00:00.000Z" }),
    blob("intake/2026-08-30/submission-a.json", { uploadedAt: "2026-08-30T10:00:00.000Z" })
  ];
  const backing = store({
    blobs,
    contents: {
      "chat/2026-08-30/aaaaaaaa.json": conversationRecord("aaaaaaaa", {
        toolEvents: [{ name: "send_note_to_elliot", input: {} }]
      }),
      "ops/kill-switch.json": { disabled: true, reason: "An attack landed.", at: "2026-08-30T08:00:00.000Z" }
    }
  });

  const response = await handleAdminData(get("?view=summary"), deps(backing));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");

  const body = await response.json();
  assert.deepEqual(body.flame, {
    killed: true,
    reason: "An attack landed.",
    at: "2026-08-30T08:00:00.000Z",
    chatDisabledEnv: false
  });
  assert.equal(body.totals.conversations, 1);
  assert.equal(body.totals.intakes, 1);
  assert.equal(body.totals.notesSent, 1);
  assert.equal(body.days.length, 30);
});

test("a missing kill switch blob means the flame is burning", async () => {
  const response = await handleAdminData(get("?view=summary"), deps(store()));
  const body = await response.json();
  assert.deepEqual(body.flame, { killed: false, reason: null, at: null, chatDisabledEnv: false });
});

test("the env kill switch is reported alongside the blob one", async () => {
  const response = await handleAdminData(
    get("?view=summary"),
    deps({ ...store(), env: { ...ENV, CHAT_DISABLED: "1" } })
  );
  const body = await response.json();
  assert.equal(body.flame.chatDisabledEnv, true);
});

test("the intakes view returns records newest first with their pathname", async () => {
  const backing = store({
    blobs: [
      blob("intake/2026-08-29/submission-old.json", { uploadedAt: "2026-08-29T10:00:00.000Z" }),
      blob("intake/2026-08-30/submission-new.json", { uploadedAt: "2026-08-30T10:00:00.000Z" })
    ],
    contents: {
      "intake/2026-08-29/submission-old.json": intakeRecord("Older"),
      "intake/2026-08-30/submission-new.json": intakeRecord("Newer")
    }
  });

  const response = await handleAdminData(get("?view=intakes&days=30"), deps(backing));
  const body = await response.json();
  assert.deepEqual(body.intakes.map((entry) => entry.name), ["Newer", "Older"]);
  assert.equal(body.intakes[0].pathname, "intake/2026-08-30/submission-new.json");
  assert.equal(body.intakes[0].uploadedAt, "2026-08-30T10:00:00.000Z");
});

test("the conversations view returns summaries, not transcripts", async () => {
  const backing = store({
    blobs: [blob("chat/2026-08-30/abcd-1234-efgh.json", { uploadedAt: "2026-08-30T11:00:00.000Z" })],
    contents: { "chat/2026-08-30/abcd-1234-efgh.json": conversationRecord("abcd-1234-efgh") }
  });

  const response = await handleAdminData(get("?view=conversations"), deps(backing));
  const body = await response.json();
  assert.equal(body.conversations.length, 1);
  assert.equal(body.conversations[0].conversationId, "abcd-1234-efgh");
  assert.equal(body.conversations[0].turns, undefined);
  assert.equal(body.conversations[0].preview, "Can you help with agents?");
});

test("an unreadable blob is skipped rather than failing the whole view", async () => {
  const backing = store({
    blobs: [
      blob("chat/2026-08-30/abcd-1234-efgh.json"),
      blob("chat/2026-08-30/zzzz-9999-yyyy.json")
    ],
    contents: { "chat/2026-08-30/abcd-1234-efgh.json": conversationRecord("abcd-1234-efgh") }
  });

  const response = await handleAdminData(get("?view=conversations"), deps(backing));
  const body = await response.json();
  assert.equal(body.conversations.length, 1);
});

test("the conversation view returns one full record", async () => {
  const backing = store({
    blobs: [blob("chat/2026-08-30/abcd-1234-efgh.json")],
    contents: { "chat/2026-08-30/abcd-1234-efgh.json": conversationRecord("abcd-1234-efgh") }
  });

  const response = await handleAdminData(
    get("?view=conversation&path=chat/2026-08-30/abcd-1234-efgh.json"),
    deps(backing)
  );
  const body = await response.json();
  assert.equal(body.conversation.conversationId, "abcd-1234-efgh");
  assert.equal(body.conversation.turns.length, 2);
});

test("the conversation view never fetches a path it did not validate", async () => {
  const backing = store({
    contents: { "ops/kill-switch.json": { disabled: true } }
  });

  const response = await handleAdminData(
    get("?view=conversation&path=ops/kill-switch.json"),
    deps(backing)
  );
  assert.equal(response.status, 400);
  assert.equal(backing.calls.get, 0);
});

test("an unknown view is refused", async () => {
  const response = await handleAdminData(get("?view=everything"), deps(store()));
  assert.equal(response.status, 400);
});

test("a blob store outage is a 502, not a crash", async () => {
  const response = await handleAdminData(
    get("?view=conversations"),
    deps({
      list: async () => {
        throw new Error("BlobServiceError");
      },
      get: async () => null
    })
  );
  assert.equal(response.status, 502);
});
