import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { useClient } from "./db.js";
import { fakeDb, makeRequest } from "./test-helpers.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  addressKey,
  allow,
  clearSessionCookie,
  consumeEmailToken,
  createSession,
  hashPassword,
  hashToken,
  issueEmailToken,
  passwordProblem,
  readSession,
  revokeAllSessions,
  sessionCookie,
  verifyPassword
} from "./auth.js";

const NOW = Date.UTC(2026, 8, 2, 12, 0, 0);
const CONTEXT = { country: "PT", device: "Safari on iOS" };

function withCookie(token) {
  return makeRequest("https://chamainteligente.com/api/hearth/me", {
    headers: { cookie: `${SESSION_COOKIE}=${token}` }
  });
}

function sessionRow(overrides = {}) {
  return {
    id: "session-1",
    user_id: "user-1",
    expires_at: new Date(NOW + 3600 * 1000).toISOString(),
    last_seen_at: new Date(NOW - 60 * 1000).toISOString(),
    revoked_at: null,
    ...overrides
  };
}

test("a password round trips and nothing else verifies", () => {
  const stored = hashPassword("a strong enough passphrase");
  assert.match(stored, /^scrypt\$/);
  assert.equal(verifyPassword("a strong enough passphrase", stored), true);
  assert.equal(verifyPassword("a strong enough passphras", stored), false);
  assert.equal(verifyPassword("a strong enough passphrase", "not-a-hash"), false);
  assert.equal(verifyPassword("a strong enough passphrase", "scrypt$only-two-parts"), false);
  assert.equal(verifyPassword("a strong enough passphrase", null), false);
});

test("passwordProblem names the problem and passes a decent password", () => {
  assert.equal(passwordProblem(undefined), "A password is required.");
  assert.equal(passwordProblem("short"), "Use at least 12 characters.");
  assert.equal(passwordProblem("x".repeat(257)), "That password is too long.");
  assert.equal(passwordProblem("Password1234"), "That password is too common.");
  assert.equal(passwordProblem("aaaaaaaaaaaaaa"), "That password is too simple.");
  assert.equal(passwordProblem("a quiet room by the fire"), null);
});

test("hashToken is a sha256 hex digest", () => {
  assert.equal(hashToken("token"), crypto.createHash("sha256").update("token").digest("hex"));
  assert.match(hashToken("token"), /^[0-9a-f]{64}$/);
});

test("the session cookie is HttpOnly, Secure, Lax and site wide", () => {
  const parts = sessionCookie("the-token").split("; ");
  assert.equal(parts[0], `${SESSION_COOKIE}=the-token`);
  for (const flag of ["Secure", "Path=/", "SameSite=Lax", "HttpOnly", `Max-Age=${SESSION_TTL_SECONDS}`]) {
    assert.ok(parts.includes(flag), `expected ${flag}`);
  }
  const cleared = clearSessionCookie().split("; ");
  assert.equal(cleared[0], `${SESSION_COOKIE}=`);
  assert.ok(cleared.includes("Max-Age=0"));
  assert.ok(cleared.includes("HttpOnly"));
});

// The table holds the hash. A read of it must not sign anyone in.
test("createSession writes the hash of the token, never the token", async () => {
  const db = fakeDb();
  useClient(db);
  const { token, expiresAt } = await createSession("user-1", CONTEXT, NOW);

  const insert = db.matching(/insert into login_sessions/)[0];
  assert.ok(insert);
  assert.ok(!insert.values.includes(token));
  assert.ok(insert.values.includes(hashToken(token)));
  assert.deepEqual(insert.values, [
    "user-1",
    hashToken(token),
    new Date(NOW + SESSION_TTL_SECONDS * 1000).toISOString(),
    "Safari on iOS",
    "PT"
  ]);
  assert.equal(expiresAt.getTime(), NOW + SESSION_TTL_SECONDS * 1000);
});

test("readSession returns nothing without a cookie, or for a revoked or expired row", async () => {
  useClient(fakeDb([[/from login_sessions/, [sessionRow()]]]));
  assert.equal(await readSession(makeRequest("https://chamainteligente.com/api/hearth/me"), NOW), null);

  useClient(fakeDb([[/from login_sessions/, [sessionRow({ revoked_at: new Date(NOW).toISOString() })]]]));
  assert.equal(await readSession(withCookie("t"), NOW), null);

  useClient(fakeDb([[/from login_sessions/, [sessionRow({ expires_at: new Date(NOW - 1000).toISOString() })]]]));
  assert.equal(await readSession(withCookie("t"), NOW), null);

  useClient(fakeDb([[/from login_sessions/, []]]));
  assert.equal(await readSession(withCookie("t"), NOW), null);
});

test("readSession touches last_seen only once the row has gone quiet", async () => {
  const fresh = fakeDb([[/from login_sessions/, [sessionRow()]]]);
  useClient(fresh);
  assert.deepEqual(await readSession(withCookie("t"), NOW), { id: "session-1", userId: "user-1" });
  assert.equal(fresh.count(/update login_sessions/), 0);
  assert.equal(fresh.count(/update users/), 0);

  const quiet = fakeDb([
    [/from login_sessions/, [sessionRow({ last_seen_at: new Date(NOW - 10 * 60 * 1000).toISOString() })]]
  ]);
  useClient(quiet);
  assert.deepEqual(await readSession(withCookie("t"), NOW), { id: "session-1", userId: "user-1" });
  assert.equal(quiet.count(/update login_sessions set last_seen_at/), 1);
  assert.equal(quiet.count(/update users set last_seen_at/), 1);
});

test("revokeAllSessions can spare the session doing the revoking", async () => {
  const db = fakeDb();
  useClient(db);
  await revokeAllSessions("user-1", "session-1");
  const update = db.matching(/update login_sessions set revoked_at/)[0];
  assert.deepEqual(update.values, ["user-1", "session-1", "session-1"]);

  await revokeAllSessions("user-1");
  assert.deepEqual(db.matching(/update login_sessions set revoked_at/)[1].values, ["user-1", null, null]);
});

test("email tokens are issued hashed, per purpose, and consumed once", async () => {
  const db = fakeDb([[/update email_tokens/, [{ id: 7, email: "someone@example.com", user_id: null, meta: {} }]]]);
  useClient(db);

  const token = await issueEmailToken({ email: "someone@example.com", purpose: "magic", meta: { next: "/hearth" } }, NOW);
  const insert = db.matching(/insert into email_tokens/)[0];
  assert.ok(!insert.values.includes(token));
  assert.deepEqual(insert.values.slice(0, 4), ["someone@example.com", null, "magic", hashToken(token)]);
  assert.equal(insert.values[4], new Date(NOW + 15 * 60 * 1000).toISOString());
  assert.equal(insert.values[5], JSON.stringify({ next: "/hearth" }));

  const row = await consumeEmailToken(token, "magic");
  assert.deepEqual(row, { id: 7, email: "someone@example.com", user_id: null, meta: {} });
  assert.deepEqual(db.matching(/update email_tokens/)[0].values, [hashToken(token), "magic"]);
  assert.equal(await consumeEmailToken("x".repeat(200), "magic"), null);
  assert.equal(await consumeEmailToken(undefined, "magic"), null);

  await assert.rejects(() => issueEmailToken({ email: "someone@example.com", purpose: "nonsense" }), /UnknownTokenPurpose/);
});

test("allow counts within the window and refuses past the limit", async () => {
  let count = 0;
  useClient(
    fakeDb([
      [
        /insert into rate_limits/,
        () => {
          count += 1;
          return [{ count }];
        }
      ]
    ])
  );
  assert.equal(await allow("key", 2, 900, NOW), true);
  assert.equal(await allow("key", 2, 900, NOW), true);
  assert.equal(await allow("key", 2, 900, NOW), false);
});

// A database hiccup must never lock everyone out of signing in.
test("allow fails open when the table cannot be reached", async () => {
  useClient(
    fakeDb([
      [
        /insert into rate_limits/,
        () => {
          throw new Error("ConnectionError");
        }
      ]
    ])
  );
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.equal(await allow("key", 1, 900, NOW), true);
  } finally {
    console.error = quiet;
  }
});

test("addressKey hashes the first forwarded address and never returns it", () => {
  const request = makeRequest("https://chamainteligente.com/api/hearth/me", {
    headers: { "x-forwarded-for": "203.0.113.7, 198.51.100.1" }
  });
  const key = addressKey(request);
  assert.match(key, /^[0-9a-f]{24}$/);
  assert.ok(!key.includes("203"));
  assert.equal(key, crypto.createHash("sha256").update("203.0.113.7").digest("hex").slice(0, 24));
  assert.notEqual(key, addressKey(makeRequest("https://chamainteligente.com/api/hearth/me")));
});
