import assert from "node:assert/strict";
import test from "node:test";

import { useClient } from "../lib/hearth/db.js";
import { fakeDb, makeRequest } from "../lib/hearth/test-helpers.js";
import { ROLE_DEFAULTS } from "../lib/hearth/permissions.js";
import { PROTOCOL_VERSION, SERVER_INFO } from "../lib/hearth/mcp.js";
import { handleMcp } from "./mcp.js";

// A dummy connection string is enough: useClient means neon() is never
// called, so nothing here can reach a database.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
process.env.ADMIN_EMAILS = "";

const HOST = "chamainteligente.com";

function mcp(message, { token, raw, origin } = {}) {
  const headers = { "content-type": "application/json" };
  if (origin) headers.origin = origin;
  if (token) headers.authorization = `Bearer ${token}`;
  return makeRequest(`https://${HOST}/mcp`, {
    method: "POST",
    headers,
    body: raw !== undefined ? raw : JSON.stringify(message)
  });
}

function userRow(overrides = {}) {
  return {
    id: "user-1",
    email: "someone@example.com",
    name: "Someone",
    avatar_url: null,
    role: "client",
    status: "active",
    timezone: "Europe/Lisbon",
    referral_code: "abcd2345",
    created_at: "2026-09-01T10:00:00.000Z",
    last_seen_at: "2026-09-02T10:00:00.000Z",
    email_verified_at: "2026-09-01T10:00:00.000Z",
    ...overrides
  };
}

function actorHandlers(role = "client") {
  return [
    [/select \* from users where id/, [userRow({ role })]],
    [/select \* from roles where name/, [{ name: role, label: role, permissions: ROLE_DEFAULTS.find((r) => r.name === role).permissions }]],
    [/from user_permissions/, []]
  ];
}

const KEY = "chama_sk_thesecret";

function keyHandler() {
  return [/from api_keys/, [{ id: "key-1", user_id: "user-1", scopes: ["profile"], prefix: "chama_sk_abcd1234", name: "Laptop" }]];
}

function publicSetting(on) {
  return [/from settings where key = 'mcp_public'/, [{ value: on }]];
}

async function body(response) {
  return await response.clone().json();
}

test("the transport offers POST only", async () => {
  useClient(fakeDb());
  const get = await handleMcp(makeRequest(`https://${HOST}/mcp`));
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("Allow"), "POST");
});

test("with no token and the public tools off, the answer points at the resource metadata", async () => {
  useClient(fakeDb([publicSetting(false)]));
  const response = await handleMcp(mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
  assert.equal(response.status, 401);
  const challenge = response.headers.get("WWW-Authenticate");
  assert.match(challenge, /^Bearer resource_metadata="https:\/\/chamainteligente\.com\/\.well-known\/oauth-protected-resource"/);
});

test("with the public tools on, a stranger gets the public tools", async () => {
  useClient(fakeDb([publicSetting(true), [/select key, value from settings/, [{ key: "mcp_public", value: true }]]]));
  const response = await handleMcp(mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.deepEqual(payload.result.tools.map((t) => t.name).sort(), ["about", "get_feed", "how_to_get_in_touch"]);
});

test("a browser on another site is refused before anything else happens", async () => {
  for (const origin of ["https://evil.example.com", "null"]) {
    const db = fakeDb([publicSetting(true)]);
    useClient(db);
    const response = await handleMcp(mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { origin, token: KEY }));
    assert.equal(response.status, 403, origin);
    assert.equal(db.calls.length, 0, "nothing was looked up");
  }
});

test("our own pages, Claude on the web and clients with no Origin all pass the check", async () => {
  for (const origin of [`https://${HOST}`, "https://claude.ai", "https://claude.com", undefined]) {
    useClient(fakeDb([publicSetting(false)]));
    const response = await handleMcp(mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { origin }));
    assert.equal(response.status, 401, String(origin));
  }
});

test("an OAuth token is checked against this server's address", async () => {
  const row = { id: "access-1", user_id: "user-1", scopes: ["profile"], client_id: "chama_abc", client_name: "An agent" };
  const call = () => handleMcp(mcp({ jsonrpc: "2.0", id: 1, method: "ping" }, { token: "an-oauth-token" }));

  useClient(fakeDb([[/from oauth_tokens t join oauth_clients c/, [{ ...row, resource: "https://preview.example.com/mcp" }]], ...actorHandlers()]));
  assert.equal((await call()).status, 401);

  for (const resource of [`https://${HOST}/mcp`, null]) {
    useClient(fakeDb([[/from oauth_tokens t join oauth_clients c/, [{ ...row, resource }]], ...actorHandlers(), [/select key, value from settings/, []]]));
    assert.equal((await call()).status, 200, String(resource));
  }
});

test("a token that is not a token is refused", async () => {
  useClient(fakeDb([[/from oauth_tokens t join oauth_clients c/, []]]));
  const response = await handleMcp(mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { token: "not-a-real-token" }));
  assert.equal(response.status, 401);
  assert.match(response.headers.get("WWW-Authenticate"), /error="invalid_token"/);
});

test("a valid API key initializes the session", async () => {
  useClient(fakeDb([keyHandler(), ...actorHandlers(), [/select key, value from settings/, []]]));
  const response = await handleMcp(mcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, { token: KEY }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("MCP-Protocol-Version"), PROTOCOL_VERSION);
  assert.match(response.headers.get("content-type"), /application\/json/);
  const payload = await body(response);
  assert.deepEqual(payload.result.serverInfo, SERVER_INFO);
  assert.equal(payload.result.protocolVersion, PROTOCOL_VERSION);
});

test("a notification on its own is accepted with no body", async () => {
  useClient(fakeDb([keyHandler(), ...actorHandlers(), [/select key, value from settings/, []]]));
  const response = await handleMcp(mcp({ jsonrpc: "2.0", method: "notifications/initialized" }, { token: KEY }));
  assert.equal(response.status, 202);
  assert.equal(await response.text(), "");
});

test("a body that is not JSON is a parse error", async () => {
  useClient(fakeDb([keyHandler(), ...actorHandlers()]));
  const response = await handleMcp(mcp(null, { token: KEY, raw: "{not json" }));
  assert.equal(response.status, 400);
  const payload = await body(response);
  assert.equal(payload.error.code, -32700);
  assert.equal(payload.id, null);
});

test("a batch comes back as a batch", async () => {
  useClient(fakeDb([keyHandler(), ...actorHandlers(), [/select key, value from settings/, []]]));
  const response = await handleMcp(mcp([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" }
  ], { token: KEY }));
  assert.equal(response.status, 200);
  const payload = await body(response);
  assert.ok(Array.isArray(payload));
  assert.equal(payload.length, 2, "the notification is answered with nothing");
  assert.deepEqual(payload.map((a) => a.id), [1, 2]);
});
