import assert from "node:assert/strict";
import test from "node:test";

import { useClient } from "./db.js";
import { fakeDb } from "./test-helpers.js";
import { ROLE_DEFAULTS } from "./permissions.js";
import { SCOPE_KEYS } from "./oauth.js";
import { PROTOCOL_VERSION, SERVER_INFO, handleRpc, listTools, resolveBearer } from "./mcp.js";

// A dummy connection string is enough: useClient means neon() is never
// called, so nothing here can reach a database.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
process.env.ADMIN_EMAILS = "";

const CONTEXT = { country: "PT", device: "Chrome on Mac" };

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

function permissionsFor(role) {
  return ROLE_DEFAULTS.find((r) => r.name === role)?.permissions || [];
}

// The rows behind loadActor, for whatever role the test wants.
function actorHandlers({ role = "client", user = {} } = {}) {
  return [
    [/select \* from users where id/, [userRow({ role, ...user })]],
    [/select \* from roles where name/, [{ name: role, label: role, permissions: permissionsFor(role) }]],
    [/from user_permissions/, []]
  ];
}

// A caller of the shape resolveBearer returns, without the database.
function caller({ role = "client", scopes = SCOPE_KEYS, user = {}, actorKind = "key", actorRef = "chama_sk_abcd1234" } = {}) {
  return {
    user: userRow({ role, ...user }),
    role: { name: role },
    permissions: new Set(permissionsFor(role)),
    scopes: new Set(scopes),
    actorKind,
    actorRef,
    clientName: ""
  };
}

const names = (list) => list.map((t) => t.name).sort();

async function quiet(run) {
  const was = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = was;
  }
}

/* ---------- who is calling ---------- */

test("no bearer header is nobody", async () => {
  useClient(fakeDb());
  assert.equal(await resolveBearer(null), null);
  assert.equal(await resolveBearer(""), null);
  assert.equal(await resolveBearer("Basic abcd"), null);
});

test("an API key resolves to a member, with the key prefix as the actor reference", async () => {
  const db = fakeDb([
    [/from api_keys/, [{ id: "key-1", user_id: "user-1", scopes: ["profile", "sessions"], prefix: "chama_sk_abcd1234", name: "Laptop" }]],
    ...actorHandlers()
  ]);
  useClient(db);
  const found = await resolveBearer("Bearer chama_sk_thesecret");
  assert.equal(found.actorKind, "key");
  assert.equal(found.actorRef, "chama_sk_abcd1234");
  assert.equal(found.user.id, "user-1");
  assert.deepEqual([...found.scopes], ["profile", "sessions"]);
  assert.equal(db.count(/from oauth_tokens t join oauth_clients c/), 0, "an API key never goes near the token table");
});

test("any other token is read as an OAuth access token", async () => {
  const db = fakeDb([
    [/from oauth_tokens t join oauth_clients c/, [{ id: "access-1", user_id: "user-1", scopes: ["profile"], client_id: "chama_abc", client_name: "Claude Code" }]],
    ...actorHandlers()
  ]);
  useClient(db);
  const found = await resolveBearer("Bearer  an-access-token ");
  assert.equal(found.actorKind, "oauth");
  assert.equal(found.actorRef, "chama_abc");
  assert.equal(found.clientName, "Claude Code");
  assert.equal(db.count(/from api_keys/), 0);
});

test("a member who may not connect, and a suspended one, are nobody", async () => {
  const key = [/from api_keys/, [{ id: "key-1", user_id: "user-1", scopes: [], prefix: "chama_sk_abcd1234", name: "Laptop" }]];
  useClient(fakeDb([
    key,
    [/select \* from users where id/, [userRow()]],
    [/select \* from roles where name/, [{ name: "client", label: "client", permissions: ["hearth.enter"] }]],
    [/from user_permissions/, []]
  ]));
  assert.equal(await resolveBearer("Bearer chama_sk_x"), null);

  useClient(fakeDb([key, ...actorHandlers({ user: { status: "suspended" } })]));
  assert.equal(await resolveBearer("Bearer chama_sk_x"), null);
});

/* ---------- the tool list ---------- */

test("with no caller the tool list is empty until the owner switches the public tools on", () => {
  assert.deepEqual(listTools(null, false), []);
  assert.deepEqual(names(listTools(null, true)), ["about", "get_feed", "how_to_get_in_touch"]);
});

test("a client's token sees the member tools and none of the business ones", () => {
  const list = names(listTools(caller(), false));
  assert.ok(list.includes("whoami"));
  assert.ok(list.includes("book_session"));
  assert.ok(list.includes("about"), "public tools come with any token");
  for (const business of ["list_members", "metrics", "audit_tail", "post_to_feed", "add_transcript", "upcoming_sessions"]) {
    assert.ok(!list.includes(business), `${business} is not a client's to call`);
  }
});

test("a token narrowed to profile can only say who it is", () => {
  const list = listTools(caller({ scopes: ["profile"] }), false).filter((t) => !["about", "how_to_get_in_touch", "get_feed"].includes(t.name));
  assert.deepEqual(names(list), ["whoami"]);
});

test("an owner's token with the business scope sees the business tools", () => {
  const list = names(listTools(caller({ role: "owner" }), false));
  for (const business of ["list_members", "metrics", "audit_tail", "post_to_feed", "add_transcript", "upcoming_sessions"]) {
    assert.ok(list.includes(business), `${business} is the owner's to call`);
  }
});

/* ---------- JSON-RPC ---------- */

function rpcDb(handlers = []) {
  return fakeDb([...handlers, [/select key, value from settings/, []]]);
}

const request = new Request("https://chamainteligente.com/mcp", { method: "POST" });

async function rpc(message, options = {}) {
  return await handleRpc(message, { caller: null, request, context: CONTEXT, ...options });
}

test("a malformed message and an unknown method are answered as JSON-RPC errors", async () => {
  useClient(rpcDb());
  assert.equal((await rpc(null)).error.code, -32600);
  assert.equal((await rpc({ jsonrpc: "1.0", method: "ping", id: 1 })).error.code, -32600);
  assert.equal((await rpc({ jsonrpc: "2.0", id: 1 })).error.code, -32600);
  const unknown = await rpc({ jsonrpc: "2.0", id: 7, method: "sorcery/cast" });
  assert.equal(unknown.error.code, -32601);
  assert.equal(unknown.id, 7);
});

test("initialize introduces the server and a notification is answered with nothing", async () => {
  useClient(rpcDb());
  const result = (await rpc({ jsonrpc: "2.0", id: 1, method: "initialize" })).result;
  assert.equal(result.protocolVersion, PROTOCOL_VERSION);
  assert.deepEqual(result.serverInfo, SERVER_INFO);
  assert.equal(await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
});

test("tools/list answers for whoever is calling", async () => {
  useClient(rpcDb());
  const anonymous = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.deepEqual(anonymous.result.tools, []);

  useClient(rpcDb([[/select key, value from settings/, [{ key: "mcp_public", value: true }]]]));
  const publicOn = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.deepEqual(names(publicOn.result.tools), ["about", "get_feed", "how_to_get_in_touch"]);

  useClient(rpcDb());
  const member = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { caller: caller() });
  assert.ok(names(member.result.tools).includes("list_records"));
});

test("an unknown tool, and one this token cannot use, are both refused", async () => {
  useClient(rpcDb());
  const unknown = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "sorcery" } });
  assert.equal(unknown.error.code, -32602);

  const refused = await rpc(
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "metrics" } },
    { caller: caller({ scopes: ["profile"] }) }
  );
  assert.equal(refused.error.code, -32602);
  assert.match(refused.error.message, /cannot use that tool/);
});

test("whoami answers with the member and the call is written to the log", async () => {
  const db = rpcDb();
  useClient(db);
  const answer = await rpc({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "whoami" } }, { caller: caller() });
  assert.match(answer.result.content[0].text, /someone@example\.com/);
  const entry = db.matching(/insert into audit_log/)[0];
  assert.ok(entry, "the call is audited");
  assert.equal(entry.values[3], "mcp.call");
  assert.equal(entry.values[4], "whoami");
  assert.deepEqual(JSON.parse(entry.values[5]), { tool: "whoami", ok: true });
  assert.equal(entry.values[0], "user-1");
  assert.equal(entry.values[1], "key");
});

test("a tool that fails answers with the generic sentence and is still logged", async () => {
  // The insert answers with no rows, so the tool trips over its own result:
  // an error that is not a ToolError.
  const db = rpcDb([[/insert into follow_ups/, []]]);
  useClient(db);
  const answer = await quiet(() =>
    rpc({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "add_follow_up", arguments: { text: "Write the thing" } } }, { caller: caller() })
  );
  assert.equal(answer.result.isError, true);
  assert.equal(answer.result.content[0].text, "The tool could not complete.");
  const entry = db.matching(/insert into audit_log/)[0];
  assert.deepEqual(JSON.parse(entry.values[5]), { tool: "add_follow_up", ok: false });
});

test("a follow-up needs text, and with text it is stored as the agent's", async () => {
  const db = rpcDb([[/insert into follow_ups/, [{ id: "follow-1" }]]]);
  useClient(db);
  const empty = await rpc(
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "add_follow_up", arguments: { text: "   " } } },
    { caller: caller() }
  );
  assert.equal(empty.result.isError, true);
  assert.equal(empty.result.content[0].text, "The follow-up needs text.");
  assert.equal(db.count(/insert into follow_ups/), 0);

  const written = await rpc(
    { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "add_follow_up", arguments: { text: "Write the thing" } } },
    { caller: caller() }
  );
  assert.equal(written.result.isError, undefined);
  const insert = db.matching(/insert into follow_ups/)[0];
  assert.ok(/'agent'/.test(insert.text), "a follow-up from an agent says so");
  assert.equal(insert.values[0], "user-1");
  assert.equal(insert.values[1], "Write the thing");
});
