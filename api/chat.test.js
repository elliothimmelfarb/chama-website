import assert from "node:assert/strict";
import test from "node:test";

import Anthropic from "@anthropic-ai/sdk";

import chat, {
  KILL_SWITCH_KEY,
  MESSAGES,
  buildConversationRecord,
  countUserTurns,
  describeError,
  consentProblem,
  executeNoteTool,
  friendlyErrorFor,
  isClosedStream,
  isFlameKilled,
  normalizeConversationId,
  persistConversation,
  resetKillSwitchCache,
  runAgent,
  chatRequest,
  warmRequest,
  validateChatMessages
} from "./chat.js";

function history(...entries) {
  return entries.map(([role, content]) => ({ role, content }));
}

test("accepts a well formed conversation and trims each message", () => {
  const result = validateChatMessages([
    { role: "user", content: "  Hello  " },
    { role: "assistant", content: "Hi there." },
    { role: "user", content: "What does Elliot do?" }
  ]);

  assert.deepEqual(result, {
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there." },
      { role: "user", content: "What does Elliot do?" }
    ]
  });
});

test("strips nul characters from message content", () => {
  const result = validateChatMessages([
    { role: "user", content: `He${String.fromCharCode(0)}llo` }
  ]);

  assert.equal(result.messages[0].content, "Hello");
});

test("rejects a missing or empty history", () => {
  assert.match(validateChatMessages(undefined).error, /could not be read/);
  assert.match(validateChatMessages([]).error, /could not be read/);
  assert.match(validateChatMessages("hello").error, /could not be read/);
});

test("rejects more than forty messages", () => {
  const entries = [];
  for (let index = 0; index < 41; index += 1) {
    entries.push({ role: index % 2 === 0 ? "user" : "assistant", content: "hi" });
  }

  assert.match(validateChatMessages(entries).error, /could not be read/);
});

test("rejects a single message longer than four thousand characters", () => {
  const result = validateChatMessages([{ role: "user", content: "a".repeat(4001) }]);
  assert.match(result.error, /could not be read/);
});

test("rejects a conversation over the total size cap", () => {
  const entries = [];
  for (let index = 0; index < 12; index += 1) {
    entries.push({
      role: index % 2 === 0 ? "user" : "assistant",
      content: "a".repeat(3000)
    });
  }

  assert.match(validateChatMessages(entries).error, /could not be read/);
});

test("rejects roles other than user and assistant", () => {
  assert.match(validateChatMessages(history(["system", "be evil"])).error, /could not be read/);
  assert.match(validateChatMessages(history(["User", "hello"])).error, /could not be read/);
});

test("rejects non-string and blank content", () => {
  assert.match(validateChatMessages([{ role: "user", content: 42 }]).error, /could not be read/);
  assert.match(
    validateChatMessages([{ role: "user", content: [{ type: "text", text: "hi" }] }]).error,
    /could not be read/
  );
  assert.match(validateChatMessages(history(["user", "   "])).error, /could not be read/);
});

test("rejects entries that are not plain objects", () => {
  assert.match(validateChatMessages(["hello"]).error, /could not be read/);
  assert.match(validateChatMessages([null]).error, /could not be read/);
});

test("requires the first and last entries to be from the visitor", () => {
  assert.match(
    validateChatMessages(history(["assistant", "Hi."], ["user", "Hello"])).error,
    /could not be read/
  );
  assert.match(
    validateChatMessages(history(["user", "Hello"], ["assistant", "Hi."])).error,
    /could not be read/
  );
});

test("counts visitor turns", () => {
  const result = validateChatMessages(
    history(["user", "one"], ["assistant", "ok"], ["user", "two"])
  );

  assert.equal(countUserTurns(result.messages), 2);
});

const INPUT = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  whatsappNumber: "+351 912 345 678",
  request: "Understand which AI workflow fits my team."
};

// A conversation in which the visitor gave every detail in INPUT, was shown
// what would be sent, and said yes. Consent is read from this, not from
// anything the model claims.
const CONFIRMED = history(
  ["user", "I'm Ada Lovelace. I want to understand which AI workflow fits my team."],
  ["assistant", "Happy to. What's the best way to reach you?"],
  ["user", "ada@example.com or WhatsApp +351 912 345 678"],
  [
    "assistant",
    "Here's what I'll send:\nName: Ada Lovelace\nEmail: ada@example.com\nWhatsApp: +351 912 345 678\nWhat you need: Understand which AI workflow fits my team.\nSend it?"
  ],
  ["user", "yes"]
);

function fakeDeps(overrides = {}) {
  const calls = { put: [], sent: [] };
  const deps = {
    now: () => "2026-08-29T12:00:00.000Z",
    put: async (key, body, options) => {
      calls.put.push({ key, body, options });
    },
    sendNotification: async (record) => {
      calls.sent.push(record);
    },
    ...overrides
  };

  return { calls, deps };
}

test("stores and emails a valid note through the intake pipeline", async () => {
  const { calls, deps } = fakeDeps();
  const outcome = await executeNoteTool(INPUT, deps, { conversation: CONFIRMED });

  assert.equal(outcome.ok, true);
  assert.match(outcome.text, /sent/);
  assert.equal(calls.put.length, 1);
  assert.equal(
    calls.put[0].key,
    "intake/2026-08-29/submission-2026-08-29T12-00-00.000Z.json"
  );
  assert.deepEqual(calls.put[0].options, {
    access: "private",
    addRandomSuffix: true,
    contentType: "application/json"
  });

  const record = JSON.parse(calls.put[0].body);
  assert.equal(record.schemaVersion, 2);
  assert.equal(record.source, "chamainteligente.com");
  assert.equal(record.email, "ada@example.com");
  assert.equal(calls.sent.length, 1);
  assert.deepEqual(calls.sent[0], record);
});

test("the record names the conversation it came from, so Elliot can read it first", async () => {
  const { calls, deps } = fakeDeps();
  await executeNoteTool(INPUT, deps, { conversation: CONFIRMED, conversationId: "abc12345-6789" });

  assert.equal(JSON.parse(calls.put[0].body).conversationId, "abc12345-6789");
});

test("accepts a note with a WhatsApp number and no email", async () => {
  const { calls, deps } = fakeDeps();
  const outcome = await executeNoteTool({ ...INPUT, email: "" }, deps, { conversation: CONFIRMED });

  assert.equal(outcome.ok, true);
  assert.equal(calls.put.length, 1);
});

test("reports the validation error and stores nothing when no contact way is given", async () => {
  const { calls, deps } = fakeDeps();
  const outcome = await executeNoteTool({ ...INPUT, email: "", whatsappNumber: "" }, deps, {
    conversation: CONFIRMED
  });

  assert.equal(outcome.ok, false);
  assert.match(outcome.text, /way to reach you/);
  assert.equal(calls.put.length, 0);
  assert.equal(calls.sent.length, 0);
});

test("reports a bad email address", async () => {
  const { deps } = fakeDeps();
  const outcome = await executeNoteTool({ ...INPUT, email: "not-an-email" }, deps, {
    conversation: CONFIRMED
  });

  assert.equal(outcome.ok, false);
  assert.match(outcome.text, /valid email/);
});

test("treats a non-object tool input as a missing note", async () => {
  const { calls, deps } = fakeDeps();
  const outcome = await executeNoteTool("send it", deps, { conversation: CONFIRMED });

  assert.equal(outcome.ok, false);
  assert.equal(calls.put.length, 0);
});

test("refuses a contact request when no conversation is given to check consent against", async () => {
  const { calls, deps } = fakeDeps();
  const outcome = await executeNoteTool(INPUT, deps);

  assert.equal(outcome.ok, false);
  assert.equal(calls.put.length, 0);
  assert.equal(calls.sent.length, 0);
});

test("refuses an email address the visitor never typed", async () => {
  const { calls, deps } = fakeDeps();
  const outcome = await executeNoteTool({ ...INPUT, email: "someone.else@example.com" }, deps, {
    conversation: CONFIRMED
  });

  assert.equal(outcome.ok, false);
  assert.match(outcome.text, /visitor/);
  assert.equal(calls.put.length, 0);
});

test("refuses a number the visitor never typed", async () => {
  const { calls, deps } = fakeDeps();
  const outcome = await executeNoteTool({ ...INPUT, whatsappNumber: "+1 555 0100 999" }, deps, {
    conversation: CONFIRMED
  });

  assert.equal(outcome.ok, false);
  assert.equal(calls.put.length, 0);
});

test("refuses a name the visitor never gave", async () => {
  const { calls, deps } = fakeDeps();
  const outcome = await executeNoteTool({ ...INPUT, name: "Grace Hopper" }, deps, {
    conversation: CONFIRMED
  });

  assert.equal(outcome.ok, false);
  assert.equal(calls.put.length, 0);
});

test("a number matches however the visitor spaced or punctuated it", async () => {
  const { calls, deps } = fakeDeps();
  const outcome = await executeNoteTool({ ...INPUT, email: null, whatsappNumber: "+351912345678" }, deps, {
    conversation: CONFIRMED
  });

  assert.equal(outcome.ok, true);
  assert.equal(calls.put.length, 1);
});

test("refuses to send what the visitor was not shown before saying yes", async () => {
  const { calls, deps } = fakeDeps();
  const unseen = history(
    ["user", "I'm Ada Lovelace, ada@example.com. Understand which AI workflow fits my team."],
    ["assistant", "Would you like us to get in touch?"],
    ["user", "yes"]
  );
  const outcome = await executeNoteTool({ ...INPUT, whatsappNumber: null }, deps, { conversation: unseen });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.text, MESSAGES.notShown);
  assert.equal(calls.put.length, 0);
});

test("refuses a note sent in the same breath as the details, before any yes", async () => {
  const { calls, deps } = fakeDeps();
  const noPreview = history(["user", "I'm Ada Lovelace, ada@example.com, please have someone call me"]);
  const outcome = await executeNoteTool(INPUT, deps, { conversation: noPreview });

  assert.equal(outcome.ok, false);
  assert.equal(calls.put.length, 0);
});

test("reports failure when storage throws", async () => {
  const { calls, deps } = fakeDeps({
    put: async () => {
      throw new Error("BlobError");
    }
  });
  const outcome = await executeNoteTool(INPUT, deps, { conversation: CONFIRMED });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.text, MESSAGES.notSaved);
  assert.equal(calls.sent.length, 0);
});

test("treats an email failure as a success the visitor can rely on", async () => {
  const { calls, deps } = fakeDeps({
    sendNotification: async () => {
      throw new Error("EmailDeliveryError");
    }
  });
  const outcome = await executeNoteTool(INPUT, deps, { conversation: CONFIRMED });

  assert.equal(outcome.ok, true);
  assert.match(outcome.text, /saved/);
  assert.equal(calls.put.length, 1);
});

// The chat is how people reach us, so nothing it shows may hand them an
// email address or phone number instead.
test("no message the chat can show names an email address or a phone number", () => {
  for (const [name, text] of Object.entries(MESSAGES)) {
    assert.doesNotMatch(text, /@|\+?\d[\d\s-]{6,}/, name);
  }
});

/* ---- saved conversations ---------------------------------------------- */

function fakeStore(overrides = {}) {
  const calls = { put: [] };
  const deps = {
    put: async (key, body, options) => {
      calls.put.push({ key, body, options });
      return { url: "https://blob.example/" + key };
    },
    now: () => "2026-08-30T09:15:00.000Z",
    ...overrides
  };
  return { calls, deps };
}

const TURNS = [
  { role: "user", content: "What is this?" },
  { role: "assistant", content: "A box where you can talk to us." },
  { role: "user", content: "Can someone call me?" }
];

test("writes one private json blob per conversation per day", async () => {
  const { calls, deps } = fakeStore();
  const outcome = await persistConversation(
    { conversationId: "9d1f0c22-4b3a-4f7e-8f1e-1c2b3a4d5e6f", turns: TURNS, toolEvents: [] },
    deps
  );

  assert.equal(outcome.ok, true);
  assert.equal(calls.put.length, 1);
  assert.equal(calls.put[0].key, "chat/2026-08-30/9d1f0c22-4b3a-4f7e-8f1e-1c2b3a4d5e6f.json");
  assert.deepEqual(calls.put[0].options, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json"
  });
});

test("stores the whole transcript including the assistant reply", async () => {
  const { calls, deps } = fakeStore();
  await persistConversation(
    { conversationId: "abcd1234-conversation", turns: TURNS, toolEvents: [] },
    deps
  );

  const record = JSON.parse(calls.put[0].body);
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.conversationId, "abcd1234-conversation");
  assert.equal(record.source, "chamainteligente.com");
  assert.equal(record.updatedAt, "2026-08-30T09:15:00.000Z");
  assert.deepEqual(record.turns, TURNS);
  assert.deepEqual(record.toolEvents, []);
});

test("stores only role and content, never anything else about the visitor", async () => {
  const { calls, deps } = fakeStore();
  await persistConversation(
    {
      conversationId: "abcd1234-conversation",
      turns: [{ role: "user", content: "hello", ip: "203.0.113.4", userAgent: "Firefox" }],
      toolEvents: []
    },
    deps
  );

  const record = JSON.parse(calls.put[0].body);
  assert.deepEqual(record.turns, [{ role: "user", content: "hello" }]);
  assert.equal(calls.put[0].body.includes("203.0.113.4"), false);
  assert.equal(calls.put[0].body.includes("Firefox"), false);
});

test("stores the tool calls the exchange produced", async () => {
  const { calls, deps } = fakeStore();
  const toolEvents = [
    {
      name: "send_note_to_elliot",
      input: { name: "Ada", email: "ada@example.com", request: "Automate my invoices." }
    }
  ];
  await persistConversation(
    { conversationId: "abcd1234-conversation", turns: TURNS, toolEvents },
    deps
  );

  const record = JSON.parse(calls.put[0].body);
  assert.deepEqual(record.toolEvents, toolEvents);
});

test("a storage failure is swallowed so the visitor still gets the reply", async () => {
  const { deps } = fakeStore({
    put: async () => {
      throw new Error("BlobError");
    }
  });

  const outcome = await persistConversation(
    { conversationId: "abcd1234-conversation", turns: TURNS, toolEvents: [] },
    deps
  );

  assert.equal(outcome.ok, false);
  assert.equal(outcome.record.conversationId, "abcd1234-conversation");
});

test("keeps a well formed conversation id", () => {
  assert.equal(
    normalizeConversationId("9d1f0c22-4b3a-4f7e-8f1e-1c2b3a4d5e6f"),
    "9d1f0c22-4b3a-4f7e-8f1e-1c2b3a4d5e6f"
  );
  assert.equal(normalizeConversationId("abcd1234"), "abcd1234");
  assert.equal(normalizeConversationId("a".repeat(64)), "a".repeat(64));
});

test("replaces a missing or malformed conversation id so storage still works", () => {
  const made = () => "generated-server-side-id";

  assert.equal(normalizeConversationId(undefined, made), "generated-server-side-id");
  assert.equal(normalizeConversationId("", made), "generated-server-side-id");
  assert.equal(normalizeConversationId("short", made), "generated-server-side-id");
  assert.equal(normalizeConversationId("a".repeat(65), made), "generated-server-side-id");
  assert.equal(normalizeConversationId("../../etc/passwd", made), "generated-server-side-id");
  assert.equal(normalizeConversationId("has spaces here", made), "generated-server-side-id");
  assert.equal(normalizeConversationId(42, made), "generated-server-side-id");
  assert.match(normalizeConversationId(null), /^[0-9a-f-]{36}$/);
});

test("a replaced id is what the record and the key are written under", async () => {
  const { calls, deps } = fakeStore();
  const conversationId = normalizeConversationId("nope", () => "replacement-id-1234");
  await persistConversation({ conversationId, turns: TURNS, toolEvents: [] }, deps);

  assert.equal(calls.put[0].key, "chat/2026-08-30/replacement-id-1234.json");
  assert.equal(JSON.parse(calls.put[0].body).conversationId, "replacement-id-1234");
});

test("the record builder is pure and returns exactly the stored shape", () => {
  const record = buildConversationRecord({
    conversationId: "abcd1234-conversation",
    turns: TURNS,
    toolEvents: [],
    updatedAt: "2026-08-30T09:15:00.000Z"
  });

  assert.deepEqual(Object.keys(record).sort(), [
    "conversationId",
    "schemaVersion",
    "source",
    "toolEvents",
    "turns",
    "updatedAt"
  ]);
});

// The watchdog's kill switch, from the chat side. The blob is written by
// api/watchdog.js; this is the read that makes it bite.

function killSwitchDeps(overrides = {}) {
  const calls = { get: [] };
  const { disabled = null, at = 1_000_000, ...rest } = overrides;

  const deps = {
    now: () => at,
    get: async (key, options) => {
      calls.get.push({ key, options });
      return disabled === null ? null : { text: async () => JSON.stringify({ disabled }) };
    },
    ...rest
  };

  return { calls, deps };
}

test("a disabled kill switch takes the chat offline", async () => {
  resetKillSwitchCache();
  const { calls, deps } = killSwitchDeps({ disabled: true });

  assert.equal(await isFlameKilled(deps), true);
  assert.equal(calls.get.length, 1);
  assert.equal(calls.get[0].key, KILL_SWITCH_KEY);
  assert.equal(calls.get[0].options.access, "private");
  assert.match(MESSAGES.offline, /offline right now/);
});

test("no kill switch blob leaves the flame burning", async () => {
  resetKillSwitchCache();
  const { deps } = killSwitchDeps({ disabled: null });

  assert.equal(await isFlameKilled(deps), false);
});

test("a kill switch blob that says disabled false leaves the flame burning", async () => {
  resetKillSwitchCache();
  const { deps } = killSwitchDeps({ disabled: false });

  assert.equal(await isFlameKilled(deps), false);
});

test("the check is cached for a minute, positive and negative alike", async () => {
  resetKillSwitchCache();
  const { calls, deps } = killSwitchDeps({ disabled: true, at: 1_000_000 });

  assert.equal(await isFlameKilled(deps), true);
  assert.equal(await isFlameKilled({ ...deps, now: () => 1_059_999 }), true);
  assert.equal(calls.get.length, 1);

  resetKillSwitchCache();
  const clear = killSwitchDeps({ disabled: null, at: 2_000_000 });
  assert.equal(await isFlameKilled(clear.deps), false);
  assert.equal(await isFlameKilled({ ...clear.deps, now: () => 2_059_999 }), false);
  assert.equal(clear.calls.get.length, 1);
});

test("the cache expires after a minute and the blob is read again", async () => {
  resetKillSwitchCache();
  const { calls, deps } = killSwitchDeps({ disabled: true, at: 1_000_000 });

  assert.equal(await isFlameKilled(deps), true);
  assert.equal(await isFlameKilled({ ...deps, now: () => 1_060_001 }), true);
  assert.equal(calls.get.length, 2);
});

test("a blob read error fails open so a storage outage never takes the chat down", async () => {
  resetKillSwitchCache();
  let reads = 0;
  const deps = {
    now: () => 3_000_000,
    get: async () => {
      reads += 1;
      throw new Error("BlobServiceNotAvailable");
    }
  };

  assert.equal(await isFlameKilled(deps), false);
  assert.equal(reads, 1);
});

test("a switch thrown more than a day ago has expired and the flame burns", async () => {
  resetKillSwitchCache();
  const now = Date.parse("2026-08-30T12:00:00.000Z");
  const deps = {
    now: () => now,
    get: async () => ({
      text: async () =>
        JSON.stringify({ disabled: true, at: "2026-08-29T11:00:00.000Z" })
    })
  };

  assert.equal(await isFlameKilled(deps), false);

  resetKillSwitchCache();
  const fresh = {
    ...deps,
    get: async () => ({
      text: async () =>
        JSON.stringify({ disabled: true, at: "2026-08-30T11:00:00.000Z" })
    })
  };
  assert.equal(await isFlameKilled(fresh), true);
});

test("unreadable kill switch content fails open", async () => {
  resetKillSwitchCache();
  const deps = {
    now: () => 4_000_000,
    get: async () => ({ text: async () => "not json" })
  };

  assert.equal(await isFlameKilled(deps), false);
});

function apiError(Kind, status, message) {
  return new Kind(
    status,
    { type: "error", error: { type: "invalid_request_error", message } },
    message,
    new Headers()
  );
}

test("a spend cap tells the visitor the chat is offline, not that we broke", () => {
  const capped = apiError(
    Anthropic.BadRequestError,
    400,
    "You have reached your specified API usage limits. You will regain access on 2026-09-01 at 00:00 UTC."
  );

  assert.deepEqual(friendlyErrorFor(capped), { message: MESSAGES.offline, status: 503, kind: "offline" });
});

test("any other bad request is still the generic failure", () => {
  const broken = apiError(Anthropic.BadRequestError, 400, "max_tokens: must be greater than 0");

  assert.deepEqual(friendlyErrorFor(broken), { message: MESSAGES.failed, status: 502, kind: "retry" });
});

test("an API error describes itself by class, status and type", () => {
  const failed = apiError(Anthropic.BadRequestError, 400, "something");

  assert.equal(describeError(failed), "BadRequestError status=400 type=invalid_request_error");
});

test("a plain error describes itself by class alone", () => {
  assert.equal(describeError(new TypeError("bad")), "TypeError");
  assert.equal(describeError("not an error"), "UnknownError");
});

// A stand-in for the SDK's streaming client. `turns` is one entry per model
// call: text to stream, and optionally a tool_use block to ask for.
function fakeClient(turns) {
  const sent = [];
  return {
    sent,
    messages: {
      stream(params) {
        sent.push(params);
        const turn = turns[sent.length - 1] || { text: "" };
        const content = [{ type: "text", text: turn.text || "" }];
        if (turn.tool) {
          content.push({ type: "tool_use", id: `t${sent.length}`, name: turn.tool, input: turn.input || {} });
        }
        return {
          async *[Symbol.asyncIterator]() {
            if (turn.text) yield { type: "content_block_delta", delta: { type: "text_delta", text: turn.text } };
          },
          async finalMessage() {
            return {
              content,
              stop_reason: turn.tool ? "tool_use" : "end_turn",
              usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0 }
            };
          }
        };
      }
    }
  };
}

test("forbids a tool on the last permitted call so the visitor always gets words", async () => {
  // A model that asks for a tool every time it is offered one.
  const client = fakeClient([
    { tool: "send_note_to_elliot" },
    { tool: "send_note_to_elliot" },
    { text: "Here is the answer." }
  ]);

  const outcome = await runAgent(client, history(["user", "Hello"]), () => {});

  assert.equal(client.sent.length, 3);
  // The tool definitions go with every call: the history carries tool_use and
  // tool_result blocks by then, and the API refuses those without `tools`.
  assert.ok(client.sent[0].tools, "the tools are offered on the first call");
  assert.ok(client.sent[1].tools);
  assert.ok(client.sent[2].tools, "and still declared on the last");
  assert.equal(client.sent[0].tool_choice, undefined, "the model is free to use one at first");
  assert.equal(client.sent[1].tool_choice, undefined);
  assert.equal(client.sent[2].tool_choice.type, "none", "and forbidden one on the last");
  assert.equal(outcome.reply, "Here is the answer.");
});

test("a visitor who closed the tab is not an error worth logging", () => {
  assert.equal(isClosedStream(new TypeError("Invalid state: Controller is already closed")), true);
  assert.equal(isClosedStream(new Error("The stream is closed")), true);
  assert.equal(isClosedStream(new Error("boom")), false);
});

test("a genuine failure that mentions closing is still an error", () => {
  assert.equal(isClosedStream(new Error("The upstream connection closed unexpectedly")), false);
  assert.equal(isClosedStream(new Error("Database pool closed")), false);
});

test("a contact request runs against the conversation the page sent, and carries its id", async () => {
  const { calls, deps } = fakeDeps();
  const client = fakeClient([{ tool: "send_note_to_elliot", input: INPUT }, { text: "Sent. We'll be in touch." }]);
  const events = [];

  await runAgent(client, CONFIRMED, (event) => events.push(event), {
    noteDeps: deps,
    conversationId: "abc12345-6789"
  });

  assert.equal(calls.put.length, 1);
  assert.equal(JSON.parse(calls.put[0].body).conversationId, "abc12345-6789");
  assert.deepEqual(events.find((event) => event.type === "tool"), { type: "tool", name: "send_note_to_elliot", ok: true });
});

test("a contact request the visitor did not confirm goes back to the model as an error and sends nothing", async () => {
  const { calls, deps } = fakeDeps();
  const client = fakeClient([{ tool: "send_note_to_elliot", input: INPUT }, { text: "Here's what I'll send." }]);

  await runAgent(client, history(["user", "I'm Ada Lovelace, ada@example.com"]), () => {}, { noteDeps: deps });

  assert.equal(calls.put.length, 0);
  const toolResult = client.sent[1].messages.at(-1).content[0];
  assert.equal(toolResult.is_error, true);
});

test("the cache warm-up asks for exactly what a real first message reads, and nothing back", () => {
  const real = chatRequest(history(["user", "Hello"]), { lastCall: false });
  const warm = warmRequest();

  assert.equal(warm.max_tokens, 0);
  assert.equal(warm.stream, undefined, "max_tokens 0 is refused with streaming");
  for (const key of ["model", "system", "tools", "output_config", "thinking"]) {
    assert.deepEqual(warm[key], real[key], key);
  }
  assert.ok(real.system.at(-1).cache_control, "the shared prefix ends in a cache breakpoint");
  assert.equal(warm.cache_control, undefined, "no automatic breakpoint on the placeholder message");
});

test("the agent offers only the contact tool, and no control over a flame", () => {
  const real = chatRequest(history(["user", "Hello"]), { lastCall: false });
  assert.deepEqual(real.tools.map((tool) => tool.name), ["send_note_to_elliot"]);
});

// The widget decides what follows a failure from `kind`, not from wording:
// "offline" shows the contact form, "retry" offers to send again, "final"
// does neither.
test("every failure the chat can answer with says what kind it is", async () => {
  const saved = { ...process.env };
  try {
    process.env.ANTHROPIC_API_KEY = "test";
    process.env.CHAT_DISABLED = "1";
    const offline = await chat.fetch(chatPost({ messages: [{ role: "user", content: "hi" }] }));
    assert.equal(offline.status, 503);
    assert.deepEqual(await offline.json(), { error: MESSAGES.offline, kind: "offline" });

    delete process.env.CHAT_DISABLED;
    resetKillSwitchCache();
    // a kill switch read that fails fails open, so the chat is up from here
    const unreadable = await chat.fetch(chatPost({ messages: [] }));
    assert.equal(unreadable.status, 400);
    assert.deepEqual(await unreadable.json(), { error: MESSAGES.unreadable, kind: "final" });

    const crossSite = await chat.fetch(chatPost({ messages: [] }, "https://evil.example"));
    assert.equal(crossSite.status, 403);
    assert.equal((await crossSite.json()).kind, "final");
  } finally {
    process.env = saved;
  }

  assert.equal(friendlyErrorFor(apiError(Anthropic.RateLimitError, 429, "slow down")).kind, "retry");
});

function chatPost(body, origin = "https://chamainteligente.com") {
  return new Request("https://chamainteligente.com/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body)
  });
}

/* ---- consent, the edges ---------------------------------------------------- */

function confirmed(visitorTurns, preview) {
  const turns = [];
  for (const text of visitorTurns) {
    turns.push(["user", text]);
    turns.push(["assistant", "Got it."]);
  }
  turns.pop();
  turns.push(["assistant", preview], ["user", "yes"]);
  return history(...turns);
}

const NEED = "A booking app for my barbershop.";

test("a name matches whatever its case, Unicode form or spacing", () => {
  const conversation = confirmed(
    ["i'm josé  da silva, jose@example.pt".normalize("NFD"), NEED],
    `Name: José da Silva\nEmail: jose@example.pt\nWhat you need: ${NEED}\nSend it?`
  );
  const submission = { name: "José da Silva", email: "jose@example.pt", whatsappNumber: "", request: NEED };
  assert.equal(consentProblem(submission, conversation), null);
});

test("a name given in pieces across turns still counts as the visitor's", () => {
  const conversation = confirmed(
    ["I'm Ana, ana@example.pt", "Surname Ferreira. " + NEED],
    `Name: Ana Ferreira\nEmail: ana@example.pt\nWhat you need: ${NEED}\nSend it?`
  );
  const submission = { name: "Ana Ferreira", email: "ana@example.pt", whatsappNumber: "", request: NEED };
  assert.equal(consentProblem(submission, conversation), null);
});

test("a name word must be a whole word the visitor typed, not part of another", () => {
  const conversation = confirmed(
    ["reach me at annabelle@example.pt", NEED],
    `Name: Anna\nEmail: annabelle@example.pt\nWhat you need: ${NEED}\nSend it?`
  );
  const submission = { name: "Anna", email: "annabelle@example.pt", whatsappNumber: "", request: NEED };
  assert.equal(consentProblem(submission, conversation), MESSAGES.notGiven);
});

test("a preview that left out the number is not consent to send it", () => {
  const conversation = confirmed(
    ["I'm Rui Lopes, +351 911 222 333", NEED],
    `Name: Rui Lopes\nWhat you need: ${NEED}\nSend it?`
  );
  const submission = { name: "Rui Lopes", email: "", whatsappNumber: "+351 911 222 333", request: NEED };
  assert.equal(consentProblem(submission, conversation), MESSAGES.notShown);
});

test("what they need must be what the preview showed, not something new", () => {
  const conversation = confirmed(
    ["I'm Rui Lopes, rui@example.pt", NEED],
    `Name: Rui Lopes\nEmail: rui@example.pt\nWhat you need: ${NEED}\nSend it?`
  );
  const submission = {
    name: "Rui Lopes",
    email: "rui@example.pt",
    whatsappNumber: "",
    request: "Wants a full ERP replacement and mentioned his divorce settlement."
  };
  assert.equal(consentProblem(submission, conversation), MESSAGES.notShown);
});

test("a number too short to be a phone number is refused", () => {
  const conversation = confirmed(["I'm Rui Lopes, 12345", NEED], `Name: Rui Lopes\nWhatsApp: 12345\nWhat you need: ${NEED}\nSend it?`);
  const submission = { name: "Rui Lopes", email: "", whatsappNumber: "12345", request: NEED };
  assert.equal(consentProblem(submission, conversation), MESSAGES.notGiven);
});

test("one exchange sends at most one contact request, however often the model asks", async () => {
  const { calls, deps } = fakeDeps();
  const client = fakeClient([
    { tool: "send_note_to_elliot", input: INPUT },
    { tool: "send_note_to_elliot", input: INPUT },
    { text: "Sent." }
  ]);

  await runAgent(client, CONFIRMED, () => {}, { noteDeps: deps });

  assert.equal(calls.put.length, 1);
  assert.equal(client.sent[2].messages.at(-1).content[0].is_error, true);
});

test("a warm-up answers 204 before any conversation is read, and a failure stays quiet", async () => {
  const saved = { ...process.env };
  try {
    process.env.ANTHROPIC_API_KEY = "test";
    delete process.env.CHAT_DISABLED;
    resetKillSwitchCache();
    const response = await chat.fetch(chatPost({ warm: true }), {
      makeClient: () => ({ messages: { create: async () => { throw new Error("APIConnectionError"); } } })
    });
    assert.equal(response.status, 204);
  } finally {
    process.env = saved;
  }
});

test("a warm-up without an Origin header is refused, so it cannot be scripted from elsewhere", async () => {
  const saved = { ...process.env };
  try {
    process.env.ANTHROPIC_API_KEY = "test";
    resetKillSwitchCache();
    let called = false;
    const request = new Request("https://chamainteligente.com/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ warm: true })
    });
    const response = await chat.fetch(request, { makeClient: () => ({ messages: { create: async () => { called = true; } } }) });
    assert.equal(response.status, 403);
    assert.equal(called, false);
  } finally {
    process.env = saved;
  }
});

test("the line marking a number as not WhatsApp need not be in the preview", () => {
  const conversation = confirmed(
    ["I'm Ana Ferreira, +351 233 000 111, landline", "Fix our rota."],
    "Name: Ana Ferreira\nPhone: +351 233 000 111\nWhat you need: Fix our rota.\nSend it?"
  );
  const submission = { name: "Ana Ferreira", email: "", whatsappNumber: "+351 233 000 111", request: "Fix our rota.\nPhone, not WhatsApp." };
  assert.equal(consentProblem(submission, conversation), null);
});
