// The website chat agent endpoint: same-origin, streaming, two tools.
//
// The prompt and tool definitions live in chat-prompt.js and are authored like
// copy. This file is only the plumbing: validate the conversation the page
// sends, run the model with a small agent loop, stream the reply back as
// Server-Sent Events, execute send_note_to_elliot through the exact intake
// pipeline the form uses (api/intake.js), and turn adjust_experience into a
// config event the page applies.
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
  offline: "The flame is resting right now. Email contact@chamainteligente.com and Elliot will get back to you.",
  unreadable: "That conversation could not be read. Please reload the page and try again.",
  tooLong:
    "This conversation has gone on longer than the agent allows in one sitting. Reload the page to start fresh, or email contact@chamainteligente.com.",
  overwhelmed: "The agent is a little overwhelmed right now. Please try again in a minute.",
  failed: "Something went wrong on our side. Please try again, or email contact@chamainteligente.com.",
  notSaved: "The note could not be saved.",
  savedNotEmailed:
    "The note was saved. The email notification did not go out, but Elliot will see it in storage.",
  sent: "The note was sent to Elliot.",
  applied: "Applied.",
  nothingAdjusted: "No valid changes were given, so nothing was adjusted."
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

// Runs the one tool the agent has, through the same pipeline as the form.
// Dependencies are injectable so the tool path can be tested without network.
export async function executeNoteTool(input, dependencies = {}) {
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

  const submittedAt = deps.now();
  const day = submittedAt.slice(0, 10);
  const record = deps.buildRecord(result.submission, submittedAt);

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

// The second tool has no server-side effect: it only tells the page what to
// change. All the work is validation, so it is a pure function. Anything the
// model gets wrong becomes null rather than an error, and a call where every
// field is null changed nothing.
// Numeric fields clamp to their range; circular ones (hue, angle) wrap
// instead. reset: true restores every default and ignores the rest.
const EXPERIENCE_RANGES = {
  brightness: { min: 0.2, max: 1 },
  motion: { min: 0.2, max: 1 },
  hue: { wrap: 360 },
  size: { min: 0.3, max: 1.6 },
  speed: { min: 0.2, max: 2 },
  turbulence: { min: 0, max: 1 },
  density: { min: 0.2, max: 1.5 },
  angle: { wrap: 360 },
  position: { min: 0, max: 1 },
  sparkle: { min: 0, max: 1 }
};

export function clampExperience(input) {
  const fields = typeof input === "object" && input !== null ? input : {};

  const settings = {};
  for (const [name, range] of Object.entries(EXPERIENCE_RANGES)) {
    const value = fields[name];
    if (value === null || value === undefined || value === "") {
      settings[name] = null;
      continue;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      settings[name] = null;
      continue;
    }
    settings[name] = range.wrap
      ? ((parsed % range.wrap) + range.wrap) % range.wrap
      : Math.min(range.max, Math.max(range.min, parsed));
  }

  settings.textAnimation =
    fields.textAnimation === "off" ||
    fields.textAnimation === "subtle" ||
    fields.textAnimation === "full"
      ? fields.textAnimation
      : null;

  settings.reset = fields.reset === true ? true : null;

  const changed = Object.values(settings).some((value) => value !== null);

  return { settings, changed };
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

export function friendlyErrorFor(error) {
  if (error instanceof Anthropic.RateLimitError) {
    return { message: MESSAGES.overwhelmed, status: 503 };
  }

  // Out of budget is not a fault the visitor should be asked to retry through.
  // It is the same situation as the kill switch: the flame is simply out.
  if (isUsageLimit(error)) {
    return { message: MESSAGES.offline, status: 503 };
  }

  if (error instanceof Anthropic.APIError) {
    return { message: MESSAGES.failed, status: 502 };
  }

  return { message: MESSAGES.failed, status: 502 };
}

function eventLine(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// The agent loop. Streams text deltas out as they arrive, runs a tool when
// the model asks for it, and stops after at most LIMITS.modelCalls turns.
async function runAgent(client, history, emit) {
  const messages = history.map((entry) => ({ role: entry.role, content: entry.content }));
  const usage = { model: MODEL, effort: EFFORT, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  const toolEvents = [];
  let reply = "";

  for (let call = 0; call < LIMITS.modelCalls; call += 1) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: LIMITS.maxTokens,
      output_config: { effort: EFFORT },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }
      ],
      tools: TOOLS,
      messages
    });

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
    if (message.stop_reason !== "tool_use") {
      return { usage, toolEvents, reply };
    }

    const toolResults = [];
    for (const block of message.content) {
      if (block.type !== "tool_use") continue;

      if (block.name === "adjust_experience") {
        const { settings, changed } = clampExperience(block.input);
        toolEvents.push({ name: block.name, input: settings });
        if (changed) {
          emit({ type: "config", settings });
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: !changed,
          content: changed ? MESSAGES.applied : MESSAGES.nothingAdjusted
        });
        continue;
      }

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
      const outcome = await executeNoteTool(block.input);
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
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed.", {
        status: 405,
        headers: { Allow: "POST", "Cache-Control": "no-store" }
      });
    }

    if (!isSameOrigin(request)) {
      return json({ error: "This request could not be accepted." }, 403);
    }

    // CHAT_DISABLED is the kill switch: any non-empty value takes the flame
    // offline without touching the key. Set it in Vercel and redeploy.
    if (process.env.CHAT_DISABLED || !process.env.ANTHROPIC_API_KEY) {
      return json({ error: MESSAGES.offline }, 503);
    }

    // The watchdog's switch, which it can throw on its own authority.
    if (await isFlameKilled()) {
      return json({ error: MESSAGES.offline }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: MESSAGES.unreadable }, 400);
    }

    const conversationId = normalizeConversationId(body?.conversationId);

    const result = validateChatMessages(body?.messages);
    if (result.error) {
      return json({ error: result.error }, 400);
    }

    if (countUserTurns(result.messages) > LIMITS.userTurns) {
      return json({ error: MESSAGES.tooLong }, 429);
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (payload) => {
          controller.enqueue(encoder.encode(eventLine(payload)));
        };

        let usage = null;
        let toolEvents = [];
        let reply = "";
        try {
          const outcome = await runAgent(client, result.messages, emit);
          usage = outcome.usage;
          toolEvents = outcome.toolEvents;
          reply = outcome.reply;
        } catch (error) {
          console.error("Chat agent failed", describeError(error));
          emit({ type: "error", error: friendlyErrorFor(error).message });
        }

        // Serverless: nothing runs after the response ends, so the transcript
        // has to be written before the done event goes out. A storage failure
        // is swallowed inside persistConversation and never reaches the page.
        const turns = reply
          ? [...result.messages, { role: "assistant", content: reply }]
          : result.messages;
        await persistConversation({ conversationId, turns, toolEvents });

        emit(usage ? { type: "done", usage } : { type: "done" });
        controller.close();
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
