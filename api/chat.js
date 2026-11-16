// The "Talk to us" chat endpoint: same-origin, streaming, one tool.
//
// The prompt and tool definition live in chat-prompt.js and are authored like
// copy. This file is only the plumbing: validate the conversation the page
// sends, run the model with a small agent loop, stream the reply back as
// Server-Sent Events, and run send_note_to_elliot (a visitor asking to be
// contacted) through the intake pipeline in api/intake.js, after checking the
// conversation shows the visitor gave those details and confirmed them.
//
// A request with { warm: true } only fills the prompt cache, so the visitor's
// first real message does not wait for the model to read the whole prompt.
//
// Conversations are saved: after every exchange the whole transcript is
// written to a private blob so Elliot can read it back and improve the agent.
// Nothing a visitor types is ever logged to the console. Errors log a name
// only, and no IP address, user agent or header is ever stored.

import Anthropic from "@anthropic-ai/sdk";
import { get, put } from "@vercel/blob";

import { MODEL, SYSTEM_PROMPT, TOOLS } from "./chat-prompt.js";
import { buildRecord, sendNotification, validate } from "./intake.js";
import { killSwitchBites } from "./watchdog.js";

const EFFORT = "low";

const LIMITS = {
  messages: 40,
  messageChars: 4000,
  totalChars: 32000,
  userTurns: 30,
  modelCalls: 3,
  maxTokens: 1200
};

export const MESSAGES = {
  offline: "The chat is offline right now. Please try again later.",
  unreadable: "That conversation could not be read. Please reload the page and try again.",
  tooLong:
    "This conversation has gone on longer than one sitting allows. Reload the page to start fresh.",
  overwhelmed: "The agent is busy right now. Please try again in a minute.",
  failed: "Something went wrong on our side. Please try again.",
  notSaved: "The details could not be saved, so nothing was sent.",
  savedNotEmailed:
    "The details were saved, so Elliot will see them, but the email telling him did not go out.",
  sent: "The details were sent. Elliot will get in touch.",
  notShown:
    "Not sent. Show the visitor exactly what will be sent (their name, how to reach them, what they need), ask them to confirm, and send only after they say yes.",
  notGiven:
    "Not sent. Every name, email address and number must be one the visitor typed in this conversation. Use only what they gave you.",
  alreadySent: "Not sent again. This visitor's details already went to Elliot in this reply."
};

function clean(value) {
  if (typeof value !== "string") return "";
  return value.replaceAll("\u0000", "").trim();
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const submittedHost = new URL(origin).host;
    const forwardedHost = request.headers.get("x-forwarded-host");
    const requestHost = forwardedHost || new URL(request.url).host;
    return submittedHost === requestHost;
  } catch {
    return false;
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

// Strict, pure validation of the history the page sends up. Returns either
// { error } or { messages } with every entry trimmed and nul-stripped.
export function validateChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: MESSAGES.unreadable };
  }

  if (messages.length > LIMITS.messages) {
    return { error: MESSAGES.unreadable };
  }

  const cleaned = [];
  let totalChars = 0;

  for (const entry of messages) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return { error: MESSAGES.unreadable };
    }

    if (entry.role !== "user" && entry.role !== "assistant") {
      return { error: MESSAGES.unreadable };
    }

    if (typeof entry.content !== "string") {
      return { error: MESSAGES.unreadable };
    }

    const content = clean(entry.content);
    if (!content) {
      return { error: MESSAGES.unreadable };
    }

    if (content.length > LIMITS.messageChars) {
      return { error: MESSAGES.unreadable };
    }

    totalChars += content.length;
    if (totalChars > LIMITS.totalChars) {
      return { error: MESSAGES.unreadable };
    }

    cleaned.push({ role: entry.role, content });
  }

  if (cleaned[0].role !== "user" || cleaned[cleaned.length - 1].role !== "user") {
    return { error: MESSAGES.unreadable };
  }

  return { messages: cleaned };
}

export function countUserTurns(messages) {
  return messages.filter((entry) => entry.role === "user").length;
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normal(text) {
  return String(text || "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

function wordsOf(text) {
  return normal(text).match(/[\p{L}\p{N}'-]+/gu) || [];
}

// Share of the words in `request` worth comparing (four letters or more)
// that the preview showed. The model may tidy punctuation, not substance.
const REQUEST_SHOWN_SHARE = 0.8;

// This guards against the model, not against an attacker: every turn,
// including the agent's preview, comes from the page, so a script can write
// any history it likes (and /api/intake takes a form anyway). What it stops
// is the model sending details the visitor never typed or never saw.
//
// Every word of the name, the email and the number must be ones the visitor
// typed, and the agent's message just before the visitor's latest one must
// have shown all of them and what they need, so that latest message is the
// visitor's answer to what will be sent. Returns the reason to refuse, or null.
export function consentProblem(submission, conversation) {
  if (!Array.isArray(conversation) || conversation.length < 3) return MESSAGES.notShown;
  const latest = conversation[conversation.length - 1];
  const shown = conversation[conversation.length - 2];
  if (latest.role !== "user" || shown.role !== "assistant") return MESSAGES.notShown;

  const visitorTurns = conversation.filter((entry) => entry.role === "user").map((entry) => entry.content);
  const visitorWords = new Set(visitorTurns.flatMap(wordsOf));
  const visitorText = visitorTurns.map(normal);
  const previewWords = new Set(wordsOf(shown.content));
  const preview = normal(shown.content);

  const nameWords = wordsOf(submission.name);
  const email = normal(submission.email);
  const number = digits(submission.whatsappNumber);

  if (!nameWords.length || !nameWords.every((word) => visitorWords.has(word))) return MESSAGES.notGiven;
  if (email && !visitorText.some((text) => text.includes(email))) return MESSAGES.notGiven;
  if (submission.whatsappNumber && number.length < 6) return MESSAGES.notGiven;
  if (number && !visitorTurns.some((text) => digits(text).includes(number))) return MESSAGES.notGiven;

  if (!nameWords.every((word) => previewWords.has(word))) return MESSAGES.notShown;
  if (email && !preview.includes(email)) return MESSAGES.notShown;
  if (number && !digits(shown.content).includes(number)) return MESSAGES.notShown;

  const requestWords = wordsOf(submission.request.replace(/phone, not whatsapp\.?/i, "")).filter(
    (word) => word.length >= 4
  );
  const seen = requestWords.filter((word) => previewWords.has(word)).length;
  if (requestWords.length && seen / requestWords.length < REQUEST_SHOWN_SHARE) return MESSAGES.notShown;

  return null;
}

// A visitor asking to be contacted: checked against the conversation, then
// stored and emailed through the same pipeline as /api/intake.
// Dependencies are injectable so the tool path can be tested without network.
export async function executeNoteTool(input, dependencies = {}, context = {}) {
  const deps = {
    validate,
    buildRecord,
    sendNotification,
    put,
    now: () => new Date().toISOString(),
    ...dependencies
  };

  const fields = typeof input === "object" && input !== null ? input : {};
  const result = deps.validate({
    name: fields.name,
    email: fields.email,
    whatsappNumber: fields.whatsappNumber,
    request: fields.request
  });

  if (result.error) {
    return { ok: false, text: result.error };
  }

  const refusal = consentProblem(result.submission, context.conversation);
  if (refusal) {
    return { ok: false, text: refusal };
  }

  const submittedAt = deps.now();
  const day = submittedAt.slice(0, 10);
  const record = deps.buildRecord(result.submission, submittedAt, context.conversationId);

  try {
    await deps.put(
      `intake/${day}/submission-${submittedAt.replaceAll(":", "-")}.json`,
      JSON.stringify(record, null, 2),
      {
        access: "private",
        addRandomSuffix: true,
        contentType: "application/json"
      }
    );
  } catch (error) {
    console.error("Chat note storage failed", error instanceof Error ? error.name : "UnknownError");
    return { ok: false, text: MESSAGES.notSaved };
  }

  try {
    await deps.sendNotification(record);
  } catch (error) {
    console.error(
      "Chat note notification failed",
      error instanceof Error ? error.name : "UnknownError"
    );
    return { ok: true, text: MESSAGES.savedNotEmailed };
  }

  return { ok: true, text: MESSAGES.sent };
}

// The conversation id the page sends is the storage key, so it has to be
// something safe to put in a path. A UUID is what the page generates; anything
// else that is plainly an id is accepted too. Anything missing or malformed is
// replaced rather than rejected, so a visitor never loses a reply over it.
const CONVERSATION_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function normalizeConversationId(value, makeId = () => crypto.randomUUID()) {
  if (typeof value === "string" && CONVERSATION_ID_PATTERN.test(value)) {
    return value;
  }
  return makeId();
}

// Builds the record written for a conversation. Only the transcript and the
// tool calls it produced: no IP address, user agent or header.
export function buildConversationRecord({ conversationId, turns, toolEvents, updatedAt }) {
  return {
    schemaVersion: 1,
    conversationId,
    source: "chamainteligente.com",
    updatedAt,
    turns: turns.map((entry) => ({ role: entry.role, content: entry.content })),
    toolEvents
  };
}

// One blob per conversation per day, overwritten on every turn with the fuller
// transcript. A conversation that crosses midnight leaves one file on each
// side of it, which is fine: both carry the same id.
export async function persistConversation(
  { conversationId, turns, toolEvents },
  dependencies = {}
) {
  const deps = { put, now: () => new Date().toISOString(), ...dependencies };

  const updatedAt = deps.now();
  const day = updatedAt.slice(0, 10);
  const record = buildConversationRecord({ conversationId, turns, toolEvents, updatedAt });

  try {
    await deps.put(`chat/${day}/${conversationId}.json`, JSON.stringify(record, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json"
    });
    return { ok: true, record };
  } catch (error) {
    console.error(
      "Chat conversation storage failed",
      error instanceof Error ? error.name : "UnknownError"
    );
    return { ok: false, record };
  }
}

// The watchdog's kill switch (see api/watchdog.js). When it finds that an
// attack landed it writes ops/kill-switch.json, and this is the read that
// makes that authority real: a disabled switch turns every request into the
// offline reply until Elliot deletes the blob by hand, or until the switch
// expires on its own 24 hours after the watchdog threw it (killSwitchBites in
// watchdog.js). A hand-written switch with no timestamp never expires.
//
// The check is cached in module scope for a minute, positive and negative
// alike, so it costs one blob read per warm instance per minute rather than
// one per visitor message. A read that fails is cached the same way and fails
// OPEN: a blob outage must never take the chat down, and the switch is retried
// a minute later regardless.
export const KILL_SWITCH_KEY = "ops/kill-switch.json";

const KILL_SWITCH_TTL_MS = 60 * 1000;

let killSwitchCache = null;

export function resetKillSwitchCache() {
  killSwitchCache = null;
}

async function readBlobText(result) {
  if (!result) return null;
  if (typeof result.text === "function") return await result.text();
  if (result.stream) return await new Response(result.stream).text();
  return null;
}

export async function isFlameKilled(dependencies = {}) {
  const deps = { get, now: () => Date.now(), ...dependencies };
  const at = deps.now();

  if (killSwitchCache && at - killSwitchCache.checkedAt < KILL_SWITCH_TTL_MS) {
    return killSwitchCache.disabled;
  }

  let disabled = false;
  try {
    const text = await readBlobText(
      await deps.get(KILL_SWITCH_KEY, { access: "private", useCache: false })
    );
    disabled = text ? killSwitchBites(JSON.parse(text), at) : false;
  } catch (error) {
    console.error(
      "Kill switch read failed",
      error instanceof Error ? error.name : "UnknownError"
    );
    disabled = false;
  }

  killSwitchCache = { checkedAt: at, disabled };
  return disabled;
}

// The SDK's error classes never set `name`, so every API failure used to log as
// a bare "Error". This says what actually happened: the class, the HTTP status
// and the API's own error type. None of it contains visitor text.
// A visitor closing the tab is not a fault. The runtimes phrase it differently
// ("Invalid state: Controller is already closed", "The stream is closed"), so
// the test is on the wording rather than on a type.
export function isClosedStream(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Controller is already closed|The stream is closed|Invalid state|ERR_INVALID_STATE/i.test(
    message
  );
}

export function describeError(error) {
  if (error instanceof Anthropic.APIError) {
    const type = error.error && error.error.error && error.error.error.type;
    return `${error.constructor.name} status=${error.status || "none"} type=${type || "none"}`;
  }

  if (error instanceof Error) {
    return error.constructor.name;
  }

  return "UnknownError";
}

// A spend cap reads as a 400 with no distinct error type, so the text is the
// only signal the API gives. It is our own account's message, never a visitor's.
function isUsageLimit(error) {
  if (!(error instanceof Anthropic.BadRequestError)) return false;
  const detail = error.error && error.error.error && error.error.error.message;
  return /usage limits|credit balance|billing/i.test(String(detail || ""));
}

// kind tells the page what follows: "offline" (nobody is answering here, so
// it offers another way to leave details), "retry" (sending again may work),
// "final" (sending the same again would be refused again).
export function friendlyErrorFor(error) {
  if (error instanceof Anthropic.RateLimitError) {
    return { message: MESSAGES.overwhelmed, status: 503, kind: "retry" };
  }

  // Out of budget is not a fault the visitor should be asked to retry through.
  // It is the same situation as the kill switch: the chat is simply offline.
  if (isUsageLimit(error)) {
    return { message: MESSAGES.offline, status: 503, kind: "offline" };
  }

  return { message: MESSAGES.failed, status: 502, kind: "retry" };
}

function failure(message, status, kind) {
  return json({ error: message, kind }, status);
}

function eventLine(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// What every call to the model sends. The model, effort, system prompt and
// tools are the cached prefix, identical on every request.
export function chatRequest(messages, { lastCall }) {
  return {
    model: MODEL,
    max_tokens: LIMITS.maxTokens,
    output_config: { effort: EFFORT },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    tools: TOOLS,
    // On the last permitted call the model is told not to use a tool, so it
    // has to answer in words. Left free, it could spend the turn on another
    // tool call and the visitor would get a done event with nothing in it.
    // The tool definitions still go with every call: once the history holds
    // tool_use and tool_result blocks, the API rejects a request without them.
    ...(lastCall ? { tool_choice: { type: "none" } } : {}),
    messages
  };
}

// Reads the prompt into the cache and answers nothing (max_tokens 0), so a
// visitor's first message finds it warm. It must send exactly what
// chatRequest sends before the messages, or it warms an entry nobody reads.
export function warmRequest() {
  const prefix = chatRequest([], { lastCall: false });
  delete prefix.messages;
  return { ...prefix, max_tokens: 0, messages: [{ role: "user", content: "warmup" }] };
}

// The agent loop. Streams text deltas out as they arrive, runs the tool when
// the model asks for it, and stops after at most LIMITS.modelCalls turns.
export async function runAgent(client, history, emit, options = {}) {
  const messages = history.map((entry) => ({ role: entry.role, content: entry.content }));
  const usage = { model: MODEL, effort: EFFORT, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  const toolEvents = [];
  let reply = "";
  let noteSent = false;

  for (let call = 0; call < LIMITS.modelCalls; call += 1) {
    const lastCall = call === LIMITS.modelCalls - 1;
    const stream = client.messages.stream(chatRequest(messages, { lastCall }));

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        reply += event.delta.text;
        emit({ type: "text", text: event.delta.text });
      }
    }

    const message = await stream.finalMessage();
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.cacheReadTokens += message.usage.cache_read_input_tokens || 0;
    // The cap in LIMITS.maxTokens includes the model's thinking. A reply cut
    // there is worth knowing about; the count is all that is logged.
    if (message.stop_reason === "max_tokens") {
      console.warn("Chat reply hit max_tokens", JSON.stringify({ outputTokens: message.usage.output_tokens }));
    }
    if (message.stop_reason !== "tool_use") {
      return { usage, toolEvents, reply };
    }

    const toolResults = [];
    for (const block of message.content) {
      if (block.type !== "tool_use") continue;

      if (block.name !== "send_note_to_elliot") {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: "That tool is not available."
        });
        continue;
      }

      toolEvents.push({ name: block.name, input: block.input });
      const outcome = noteSent
        ? { ok: false, text: MESSAGES.alreadySent }
        : await executeNoteTool(block.input, options.noteDeps, {
            conversation: history,
            conversationId: options.conversationId
          });
      if (outcome.ok) noteSent = true;
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        is_error: !outcome.ok,
        content: outcome.text
      });
      emit({ type: "tool", name: block.name, ok: outcome.ok });
    }

    messages.push({ role: "assistant", content: message.content });
    messages.push({ role: "user", content: toolResults });
  }

  return { usage, toolEvents, reply };
}

export default {
  // `testing` lets a test hand in a fake model client; the platform passes
  // nothing that has makeClient.
  async fetch(request, testing) {
    if (request.method !== "POST") {
      return new Response("Method not allowed.", {
        status: 405,
        headers: { Allow: "POST", "Cache-Control": "no-store" }
      });
    }

    if (!isSameOrigin(request)) {
      return failure("This request could not be accepted.", 403, "final");
    }

    // CHAT_DISABLED is the kill switch: any non-empty value takes the chat
    // offline without touching the key. Set it in Vercel and redeploy.
    if (process.env.CHAT_DISABLED || !process.env.ANTHROPIC_API_KEY) {
      return failure(MESSAGES.offline, 503, "offline");
    }

    // The watchdog's switch, which it can throw on its own authority.
    if (await isFlameKilled()) {
      return failure(MESSAGES.offline, 503, "offline");
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return failure(MESSAGES.unreadable, 400, "final");
    }

    const client =
      typeof testing?.makeClient === "function"
        ? testing.makeClient()
        : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    if (body?.warm === true) {
      // the page always sends an Origin on a POST; a script elsewhere need not
      if (!request.headers.get("origin")) {
        return failure("This request could not be accepted.", 403, "final");
      }
      try {
        const warmed = await client.messages.create(warmRequest());
        console.log(
          "Chat warm-up",
          JSON.stringify({
            cacheWrite: warmed?.usage?.cache_creation_input_tokens || 0,
            cacheRead: warmed?.usage?.cache_read_input_tokens || 0
          })
        );
      } catch (error) {
        console.error("Chat warm-up failed", describeError(error));
      }
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }

    const conversationId = normalizeConversationId(body?.conversationId);

    const result = validateChatMessages(body?.messages);
    if (result.error) {
      return failure(result.error, 400, "final");
    }

    if (countUserTurns(result.messages) > LIMITS.userTurns) {
      return failure(MESSAGES.tooLong, 429, "final");
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // The visitor can close the tab at any point, which closes the
        // controller under us. Writing to a closed controller throws, and this
        // start() runs detached, so an unguarded write becomes an unhandled
        // rejection. A closed stream is ordinary; anything else is logged.
        let closed = false;
        const emit = (payload) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(eventLine(payload)));
          } catch (error) {
            closed = true;
            if (!isClosedStream(error)) {
              console.error("Chat stream write failed", describeError(error));
            }
          }
        };

        let usage = null;
        let toolEvents = [];
        let reply = "";
        try {
          const outcome = await runAgent(client, result.messages, emit, { conversationId });
          usage = outcome.usage;
          toolEvents = outcome.toolEvents;
          reply = outcome.reply;
        } catch (error) {
          console.error("Chat agent failed", describeError(error));
          const { message, kind } = friendlyErrorFor(error);
          emit({ type: "error", error: message, kind });
        }

        // Serverless: nothing runs after the response ends, so the transcript
        // has to be written before the done event goes out. A storage failure
        // is swallowed inside persistConversation and never reaches the page.
        const turns = reply
          ? [...result.messages, { role: "assistant", content: reply }]
          : result.messages;
        await persistConversation({ conversationId, turns, toolEvents });

        emit(usage ? { type: "done", usage } : { type: "done" });

        try {
          if (!closed) controller.close();
        } catch (error) {
          if (!isClosedStream(error)) {
            console.error("Chat stream close failed", describeError(error));
          }
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no"
      }
    });
  }
};
