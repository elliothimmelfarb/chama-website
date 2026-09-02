import assert from "node:assert/strict";
import test from "node:test";

import {
  HttpError,
  clampText,
  cookie,
  deviceFamily,
  isEmail,
  isSameOrigin,
  matchPath,
  normalizeEmail,
  readCookie,
  readJson,
  requestContext
} from "./http.js";

function request(url, options = {}) {
  return new Request(url, options);
}

test("matchPath matches, refuses and names the segments", () => {
  assert.deepEqual(matchPath("/config", "/config"), {});
  assert.equal(matchPath("/config", "/configuration"), null);
  assert.equal(matchPath("/auth/:provider", "/auth/github/callback"), null);
  assert.deepEqual(matchPath("/auth/:provider/callback", "/auth/github/callback"), { provider: "github" });
  assert.deepEqual(matchPath("/sessions/:id", "/sessions/abc-123"), { id: "abc-123" });
  assert.deepEqual(matchPath("/admin/members/:id", "/admin/members/a%40b.com"), { id: "a@b.com" });
});

test("isSameOrigin lets an origin-less request through and refuses another site", () => {
  const host = { "x-forwarded-host": "chamainteligente.com" };
  assert.equal(isSameOrigin(request("https://fn.vercel.app/api/hearth/me", { headers: host })), true);
  assert.equal(
    isSameOrigin(request("https://fn.vercel.app/api/hearth/me", { headers: { ...host, origin: "https://chamainteligente.com" } })),
    true
  );
  assert.equal(
    isSameOrigin(request("https://fn.vercel.app/api/hearth/me", { headers: { ...host, origin: "https://evil.example.com" } })),
    false
  );
  assert.equal(
    isSameOrigin(request("https://fn.vercel.app/api/hearth/me", { headers: { ...host, origin: "not a url" } })),
    false
  );
});

test("readCookie finds one cookie among many", () => {
  const header = "other=1; chama_hearth=abc123 ; trailing=2";
  assert.equal(readCookie(header, "chama_hearth"), "abc123");
  assert.equal(readCookie(header, "missing"), null);
  assert.equal(readCookie("novalue", "novalue"), null);
  assert.equal(readCookie(null, "chama_hearth"), null);
});

test("cookie carries the flags a session needs", () => {
  const value = cookie("chama_hearth", "token", { maxAge: 60, sameSite: "Lax" });
  assert.match(value, /^chama_hearth=token; /);
  for (const flag of ["Secure", "Path=/", "SameSite=Lax", "HttpOnly", "Max-Age=60"]) {
    assert.ok(value.split("; ").includes(flag), `expected ${flag}`);
  }
  assert.ok(!cookie("a", "b", { httpOnly: false }).split("; ").includes("HttpOnly"));
  assert.ok(cookie("a", "b", { maxAge: -5 }).split("; ").includes("Max-Age=0"));
});

test("deviceFamily names a family and never the agent string", () => {
  assert.equal(
    deviceFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"),
    "Safari on iOS"
  );
  assert.equal(
    deviceFamily("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36"),
    "Chrome on Android"
  );
  assert.equal(
    deviceFamily("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"),
    "Chrome on Mac"
  );
  assert.equal(deviceFamily("curl/8.4.0"), "curl on Other");
  assert.equal(deviceFamily(""), "unknown");
  assert.equal(deviceFamily("Claude-User/1.0 (MCP)"), "agent on Other");
});

test("requestContext keeps only a two letter country and a device family", () => {
  const context = requestContext(
    request("https://chamainteligente.com/api/hearth/me", {
      headers: { "x-vercel-ip-country": "pt", "user-agent": "curl/8.4.0" }
    })
  );
  assert.deepEqual(context, { country: "PT", device: "curl on Other" });
  assert.deepEqual(requestContext(request("https://chamainteligente.com/api/hearth/me")), {
    country: "",
    device: "unknown"
  });
});

test("isEmail and normalizeEmail", () => {
  assert.equal(isEmail("someone@example.com"), true);
  assert.equal(isEmail(" someone@example.com "), true);
  assert.equal(isEmail("someone@example"), false);
  assert.equal(isEmail("two @example.com"), false);
  assert.equal(isEmail(`${"a".repeat(250)}@example.com`), false);
  assert.equal(isEmail(undefined), false);
  assert.equal(normalizeEmail("  Someone@Example.COM "), "someone@example.com");
  assert.equal(normalizeEmail(undefined), "");
});

test("readJson refuses malformed and oversized bodies", async () => {
  assert.deepEqual(await readJson(request("https://x.test/", { method: "POST", body: '{"a":1}' })), { a: 1 });
  assert.deepEqual(await readJson(request("https://x.test/", { method: "POST", body: "" })), {});
  assert.deepEqual(await readJson(request("https://x.test/", { method: "POST", body: "42" })), {});

  await assert.rejects(
    () => readJson(request("https://x.test/", { method: "POST", body: "{not json" })),
    (error) => error instanceof HttpError && error.status === 400
  );

  const big = JSON.stringify({ a: "x".repeat(200) });
  await assert.rejects(
    () => readJson(request("https://x.test/", { method: "POST", body: big }), 64),
    (error) => error instanceof HttpError && error.status === 413
  );
});

// The one thing text is not allowed to carry into Postgres is a NUL byte.
test("clampText drops NUL bytes and truncates", () => {
  assert.equal(clampText("a\u0000b\u0000"), "ab");
  assert.equal(clampText("abcdef", 3), "abc");
  assert.equal(clampText(42), "");
});
