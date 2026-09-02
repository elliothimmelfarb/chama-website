import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { useClient } from "../lib/hearth/db.js";
import { fakeDb, makeRequest } from "../lib/hearth/test-helpers.js";
import { hashToken } from "../lib/hearth/auth.js";
import handleOauthDefault, { handleOauth } from "./oauth.js";

// A dummy connection string is enough: useClient means neon() is never
// called, so nothing here can reach a database.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";

const HOST = "chamainteligente.com";
const ORIGIN = `https://${HOST}`;
const REDIRECT = "https://app.example.com/callback";
const CHALLENGE = crypto.createHash("sha256").update("a".repeat(64)).digest("base64url");

function oauth(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  return makeRequest(`${ORIGIN}/api/oauth${path}`, { ...options, headers });
}

function clientRow(overrides = {}) {
  return {
    id: "chama_abc",
    secret_hash: null,
    name: "An agent",
    redirect_uris: [REDIRECT],
    grant_types: ["authorization_code", "refresh_token"],
    token_endpoint_auth_method: "none",
    client_uri: null,
    logo_uri: null,
    ...overrides
  };
}

async function body(response) {
  return await response.clone().json();
}

test("the default export is the same handler", () => {
  assert.equal(typeof handleOauthDefault.fetch, "function");
});

test("a preflight is answered with the CORS headers and no body", async () => {
  const response = await handleOauth(oauth("/token", { method: "OPTIONS" }));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(response.headers.get("Access-Control-Allow-Methods"), /POST/);
});

test("the metadata is served even before the Hearth has a database", async () => {
  const url = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await handleOauth(oauth("/metadata"));
    assert.equal(response.status, 200);
    const doc = await body(response);
    assert.equal(doc.issuer, ORIGIN);
    assert.equal(doc.token_endpoint, `${ORIGIN}/api/oauth/token`);

    const resource = await handleOauth(oauth("/resource"));
    assert.equal(resource.status, 200);
    assert.equal((await body(resource)).resource, `${ORIGIN}/mcp`);

    const closed = await handleOauth(oauth("/token", { method: "POST", body: "grant_type=refresh_token" }));
    assert.equal(closed.status, 503);
  } finally {
    process.env.DATABASE_URL = url;
  }
});

/* ---------- registration ---------- */

test("an agent registers itself, and one with nowhere to send the code cannot", async () => {
  const db = fakeDb();
  useClient(db);
  const response = await handleOauth(oauth("/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Claude Code", redirect_uris: [REDIRECT] })
  }));
  assert.equal(response.status, 201);
  const registered = await body(response);
  assert.ok(registered.client_id.startsWith("chama_"));
  assert.equal(db.count(/insert into oauth_clients/), 1);

  useClient(fakeDb());
  const refused = await handleOauth(oauth("/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ redirect_uris: ["http://example.com/cb"] })
  }));
  assert.equal(refused.status, 400);
  assert.equal((await body(refused)).error, "invalid_redirect_uri");
});

/* ---------- authorize ---------- */

test("an unknown client is told so here, not at a redirect", async () => {
  useClient(fakeDb([[/from oauth_clients where id/, []]]));
  const response = await handleOauth(oauth(`/authorize?client_id=chama_nope&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&code_challenge=${CHALLENGE}`));
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, "invalid_client");
});

test("a good request sends the person to the consent page in the Hearth", async () => {
  useClient(fakeDb([[/from oauth_clients where id/, [clientRow()]]]));
  const response = await handleOauth(oauth(`/authorize?client_id=chama_abc&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=code&code_challenge=${CHALLENGE}&state=xyz`));
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("Location"));
  assert.equal(location.origin, ORIGIN);
  assert.equal(location.pathname, "/hearth/authorize");
  assert.ok(location.searchParams.get("req"));
});

test("a request the client got wrong goes back to the client", async () => {
  useClient(fakeDb([[/from oauth_clients where id/, [clientRow()]]]));
  const response = await handleOauth(oauth(`/authorize?client_id=chama_abc&redirect_uri=${encodeURIComponent(REDIRECT)}&response_type=token&code_challenge=${CHALLENGE}&state=xyz`));
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("Location"));
  assert.equal(location.searchParams.get("error"), "unsupported_response_type");
});

/* ---------- token ---------- */

test("a grant this server does not do is refused by name", async () => {
  useClient(fakeDb());
  const response = await handleOauth(oauth("/token", { method: "POST", body: "grant_type=password&username=a&password=b" }));
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, "unsupported_grant_type");
});

test("a form-encoded code grant is parsed, and a client it does not know is a 401", async () => {
  useClient(fakeDb([[/from oauth_clients where id/, []]]));
  const response = await handleOauth(oauth("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: "c", redirect_uri: REDIRECT, client_id: "chama_nope", code_verifier: "a".repeat(64) }).toString()
  }));
  assert.equal(response.status, 401);
  assert.equal((await body(response)).error, "invalid_client");
});

test("client credentials sent as HTTP Basic are read", async () => {
  const confidential = clientRow({ token_endpoint_auth_method: "client_secret_basic", secret_hash: hashToken("the-real-secret") });
  const db = fakeDb([[/from oauth_clients where id/, [confidential]], [/select \* from oauth_tokens where token_hash/, []]]);
  useClient(db);
  const basic = Buffer.from("chama_abc:the-real-secret").toString("base64");
  const response = await handleOauth(oauth("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${basic}` },
    body: "grant_type=refresh_token&refresh_token=r"
  }));
  // The client authenticated; only the token itself was not found.
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, "invalid_grant");

  useClient(fakeDb([[/from oauth_clients where id/, [confidential]]]));
  const wrong = await handleOauth(oauth("/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${Buffer.from("chama_abc:wrong").toString("base64")}` },
    body: "grant_type=refresh_token&refresh_token=r"
  }));
  assert.equal(wrong.status, 401);
  assert.equal((await body(wrong)).error, "invalid_client");
});

/* ---------- revoke ---------- */

test("revoking without a client that checks out is a 401", async () => {
  useClient(fakeDb([[/from oauth_clients where id/, []]]));
  const response = await handleOauth(oauth("/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "token=t&client_id=chama_nope"
  }));
  assert.equal(response.status, 401);
  assert.equal((await body(response)).error, "invalid_client");
});

test("an unknown path under the authorization server is a plain not found", async () => {
  useClient(fakeDb());
  const response = await handleOauth(oauth("/nonsense"));
  assert.equal(response.status, 404);
});
