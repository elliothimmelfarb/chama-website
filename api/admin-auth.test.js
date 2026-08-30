import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { beforeEach } from "node:test";

import {
  MESSAGES,
  SESSION_COOKIE,
  adminConfig,
  clearSessionCookie,
  handleAdminAuth,
  makeSessionCookie,
  parseAdminEmails,
  readCookie,
  requireAdmin,
  resetJwksCache,
  signSession,
  verifyIdToken,
  verifySession
} from "./admin-auth.js";

const CLIENT_ID = "123456.apps.googleusercontent.com";
const SECRET = "a".repeat(64);
const ADMIN = "elliot@chamainteligente.com";

const ENV = {
  GOOGLE_CLIENT_ID: CLIENT_ID,
  ADMIN_EMAILS: ` ${ADMIN.toUpperCase()} , other@example.com `,
  ADMIN_SESSION_SECRET: SECRET
};

// A real keypair so the tests exercise the same crypto path production does.
const keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = { ...keyPair.publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };

const otherPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

const NOW_MS = Date.UTC(2026, 7, 30, 12, 0, 0);
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function makeToken(claims = {}, { privateKey = keyPair.privateKey, header = {} } = {}) {
  const fullHeader = { alg: "RS256", kid: "test-key", typ: "JWT", ...header };
  const fullClaims = {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: NOW_SECONDS + 3600,
    email: ADMIN,
    email_verified: true,
    ...claims
  };

  const signingInput = `${base64url(JSON.stringify(fullHeader))}.${base64url(JSON.stringify(fullClaims))}`;
  if (fullHeader.alg === "none") {
    return `${signingInput}.`;
  }

  const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return `${signingInput}.${signature.toString("base64url")}`;
}

function jwksFetch(keys = [publicJwk]) {
  return async () => ({
    ok: true,
    headers: { get: () => "public, max-age=3600" },
    json: async () => ({ keys })
  });
}

function deps(overrides = {}) {
  return { env: ENV, now: () => NOW_MS, fetch: jwksFetch(), ...overrides };
}

function request(url, options = {}) {
  return new Request(url, options);
}

beforeEach(() => {
  resetJwksCache();
});

test("reads the allowlist lowercased and trimmed", () => {
  assert.deepEqual(parseAdminEmails(" A@b.com ,C@d.com, "), ["a@b.com", "c@d.com"]);
  assert.deepEqual(parseAdminEmails(undefined), []);
});

test("treats a missing or short secret as unconfigured", () => {
  assert.equal(adminConfig(ENV).configured, true);
  assert.equal(adminConfig({ ...ENV, ADMIN_SESSION_SECRET: "short" }).configured, false);
  assert.equal(adminConfig({ ...ENV, GOOGLE_CLIENT_ID: "" }).configured, false);
  assert.equal(adminConfig({ ...ENV, ADMIN_EMAILS: "" }).configured, false);
});

test("accepts a well formed google token for an allowlisted email", async () => {
  const result = await verifyIdToken(makeToken(), deps());
  assert.deepEqual(result, { ok: true, email: ADMIN });
});

test("rejects a token signed by the wrong key", async () => {
  const token = makeToken({}, { privateKey: otherPair.privateKey });
  assert.deepEqual(await verifyIdToken(token, deps()), { ok: false, reason: "signature" });
});

test("rejects a tampered payload", async () => {
  const token = makeToken();
  const parts = token.split(".");
  parts[1] = base64url(JSON.stringify({ iss: "https://accounts.google.com", aud: CLIENT_ID, exp: NOW_SECONDS + 3600, email: "attacker@example.com", email_verified: true }));
  assert.deepEqual(await verifyIdToken(parts.join("."), deps()), { ok: false, reason: "signature" });
});

test("rejects the wrong audience", async () => {
  const token = makeToken({ aud: "someone-else.apps.googleusercontent.com" });
  assert.deepEqual(await verifyIdToken(token, deps()), { ok: false, reason: "audience" });
});

test("rejects the wrong issuer", async () => {
  const token = makeToken({ iss: "https://evil.example.com" });
  assert.deepEqual(await verifyIdToken(token, deps()), { ok: false, reason: "issuer" });
});

test("rejects an expired token", async () => {
  const token = makeToken({ exp: NOW_SECONDS - 1 });
  assert.deepEqual(await verifyIdToken(token, deps()), { ok: false, reason: "expired" });
});

test("rejects an unverified email", async () => {
  const token = makeToken({ email_verified: false });
  assert.deepEqual(await verifyIdToken(token, deps()), { ok: false, reason: "unverified" });
});

test("rejects an email that is not on the allowlist", async () => {
  const token = makeToken({ email: "stranger@example.com" });
  assert.deepEqual(await verifyIdToken(token, deps()), { ok: false, reason: "notAllowed" });
});

test("rejects an alg of none and other unsigned shapes", async () => {
  assert.deepEqual(await verifyIdToken(makeToken({}, { header: { alg: "none" } }), deps()), {
    ok: false,
    reason: "alg"
  });
  assert.deepEqual(await verifyIdToken("not-a-jwt", deps()), { ok: false, reason: "malformed" });
  assert.deepEqual(await verifyIdToken(undefined, deps()), { ok: false, reason: "malformed" });
});

test("rejects everything when the env is not configured", async () => {
  const result = await verifyIdToken(makeToken(), deps({ env: {} }));
  assert.deepEqual(result, { ok: false, reason: "unconfigured" });
});

test("a jwks fetch failure is a rejection, not a crash", async () => {
  const result = await verifyIdToken(
    makeToken(),
    deps({
      fetch: async () => {
        throw new Error("NetworkError");
      }
    })
  );
  assert.deepEqual(result, { ok: false, reason: "jwks" });
});

test("caches the key set for its max-age", async () => {
  let calls = 0;
  const counting = async () => {
    calls += 1;
    return {
      ok: true,
      headers: { get: () => "public, max-age=3600" },
      json: async () => ({ keys: [publicJwk] })
    };
  };

  await verifyIdToken(makeToken(), deps({ fetch: counting }));
  await verifyIdToken(makeToken(), deps({ fetch: counting }));
  assert.equal(calls, 1);

  await verifyIdToken(makeToken(), deps({ fetch: counting, now: () => NOW_MS + 3601 * 1000 }));
  assert.equal(calls, 2);
});

test("a session cookie round trips", () => {
  const value = signSession({ email: ADMIN, exp: NOW_SECONDS + 100 }, SECRET);
  assert.deepEqual(verifySession(value, SECRET, NOW_SECONDS), { email: ADMIN });
});

test("a tampered or wrongly signed session is refused", () => {
  const value = signSession({ email: ADMIN, exp: NOW_SECONDS + 100 }, SECRET);
  const parts = value.split(".");

  const swapped = `v1.${base64url(JSON.stringify({ email: "attacker@example.com", exp: NOW_SECONDS + 100 }))}.${parts[2]}`;
  assert.equal(verifySession(swapped, SECRET, NOW_SECONDS), null);

  assert.equal(verifySession(`${parts[0]}.${parts[1]}.${parts[2]}x`, SECRET, NOW_SECONDS), null);
  assert.equal(verifySession(value, "b".repeat(64), NOW_SECONDS), null);
  assert.equal(verifySession("v2." + parts[1] + "." + parts[2], SECRET, NOW_SECONDS), null);
  assert.equal(verifySession("nonsense", SECRET, NOW_SECONDS), null);
});

test("an expired session is refused", () => {
  const value = signSession({ email: ADMIN, exp: NOW_SECONDS - 1 }, SECRET);
  assert.equal(verifySession(value, SECRET, NOW_SECONDS), null);
});

test("the cookie carries every flag the browser needs", () => {
  const cookie = makeSessionCookie({ email: ADMIN, exp: NOW_SECONDS + 604800 }, SECRET, NOW_SECONDS);
  assert.match(cookie, /^chama_admin=v1\./);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Path=\/api\//);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=604800/);
  assert.match(clearSessionCookie(), /Max-Age=0/);
});

test("reads one cookie out of a header with several", () => {
  assert.equal(readCookie("a=1; chama_admin=v1.x.y; b=2", SESSION_COOKIE), "v1.x.y");
  assert.equal(readCookie("a=1", SESSION_COOKIE), null);
  assert.equal(readCookie(null, SESSION_COOKIE), null);
});

test("requireAdmin drops a session whose email left the allowlist", () => {
  const value = signSession({ email: ADMIN, exp: NOW_SECONDS + 100 }, SECRET);
  const signedIn = request("https://chamainteligente.com/api/admin-data", {
    headers: { cookie: `${SESSION_COOKIE}=${value}` }
  });

  assert.deepEqual(requireAdmin(signedIn, deps()), { email: ADMIN });
  assert.equal(
    requireAdmin(signedIn, deps({ env: { ...ENV, ADMIN_EMAILS: "someone@else.com" } })),
    null
  );
  assert.equal(
    requireAdmin(request("https://chamainteligente.com/api/admin-data"), deps()),
    null
  );
});

test("GET returns the public client id, and 503 when unconfigured", async () => {
  const ok = await handleAdminAuth(request("https://chamainteligente.com/api/admin-auth"), deps());
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { clientId: CLIENT_ID });
  assert.equal(ok.headers.get("cache-control"), "no-store");

  const missing = await handleAdminAuth(
    request("https://chamainteligente.com/api/admin-auth"),
    deps({ env: {} })
  );
  assert.equal(missing.status, 503);
  assert.deepEqual(await missing.json(), { error: MESSAGES.unconfigured });
});

test("POST with a good credential sets the session cookie", async () => {
  const response = await handleAdminAuth(
    request("https://chamainteligente.com/api/admin-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: makeToken() })
    }),
    deps()
  );

  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /^chama_admin=/);

  const value = cookie.slice(cookie.indexOf("=") + 1, cookie.indexOf(";"));
  assert.deepEqual(verifySession(value, SECRET, NOW_SECONDS), { email: ADMIN });
});

test("POST with a bad credential is a generic 401 with no cookie", async () => {
  const response = await handleAdminAuth(
    request("https://chamainteligente.com/api/admin-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: makeToken({ email: "stranger@example.com" }) })
    }),
    deps()
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: MESSAGES.rejected });
  assert.equal(response.headers.get("set-cookie"), null);
});

test("POST refuses a cross origin sign-in", async () => {
  const response = await handleAdminAuth(
    request("https://chamainteligente.com/api/admin-auth", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example.com" },
      body: JSON.stringify({ credential: makeToken() })
    }),
    deps()
  );

  assert.equal(response.status, 403);
});

test("DELETE clears the cookie", async () => {
  const response = await handleAdminAuth(
    request("https://chamainteligente.com/api/admin-auth", { method: "DELETE" }),
    deps()
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie"), /^chama_admin=; .*Max-Age=0/);
});

test("other methods are not allowed", async () => {
  const response = await handleAdminAuth(
    request("https://chamainteligente.com/api/admin-auth", { method: "PUT" }),
    deps()
  );
  assert.equal(response.status, 405);
});
