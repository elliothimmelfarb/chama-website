// The website chat agent endpoint: same-origin, streaming, one tool.
//
// The prompt and tool definitions live in chat-prompt.js and are authored like
// copy. This file is only the plumbing: validate the conversation the page
// sends, run the model with a small agent loop, stream the reply back as
// Server-Sent Events, and execute send_note_to_elliot through the exact intake
// pipeline the form uses (api/intake.js).
//
// Nothing a visitor types is ever logged. Errors log a name only.

import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";

import { MODEL, SYSTEM_PROMPT, TOOLS } from "./chat-prompt.js";
import { buildRecord, sendNotification, validate } from "./intake.js";

const LIMITS = {
  messages: 40,
  messageChars: 4000,
  totalChars: 32000,
  userTurns: 30,
  modelCalls: 3,
  maxTokens: 1200
};

const MESSAGES = {
  offline: "The agent is offline right now. The form below still works.",
  unreadable: "That conversation could not be read. Please reload the page and try again.",
  tooLong:
    "This conversation has gone on longer than the agent allows in one sitting. Reload the page to start fresh, or use the form below.",
  overwhelmed: "The agent is a little overwhelmed right now. Please try again in a minute.",
  failed: "Something went wrong on our side. Please try again, or use the form below.",
  notSaved: "The note could not be saved.",
  savedNotEmailed:
    "The note was saved. The email notification did not go out, but Elliot will see it in storage.",
  sent: "The note was sent to Elliot."
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

export function friendlyErrorFor(error) {
  if (error instanceof Anthropic.RateLimitError) {
    return { message: MESSAGES.overwhelmed, status: 503 };
  }

  if (error instanceof Anthropic.APIError) {
    return { message: MESSAGES.failed, status: 502 };
  }

  return { message: MESSAGES.failed, status: 502 };
}

function eventLine(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// The agent loop. Streams text deltas out as they arrive, runs the tool when
// the model asks for it, and stops after at most LIMITS.modelCalls turns.
async function runAgent(client, history, emit) {
  const messages = history.map((entry) => ({ role: entry.role, content: entry.content }));

  for (let call = 0; call < LIMITS.modelCalls; call += 1) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: LIMITS.maxTokens,
      output_config: { effort: "low" },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }
      ],
      tools: TOOLS,
      messages
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        emit({ type: "text", text: event.delta.text });
      }
    }

    const message = await stream.finalMessage();
    if (message.stop_reason !== "tool_use") {
      return;
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

    if (!process.env.ANTHROPIC_API_KEY) {
      return json({ error: MESSAGES.offline }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: MESSAGES.unreadable }, 400);
    }

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

        try {
          await runAgent(client, result.messages, emit);
        } catch (error) {
          console.error("Chat agent failed", error instanceof Error ? error.name : "UnknownError");
          emit({ type: "error", error: friendlyErrorFor(error).message });
        }

        emit({ type: "done" });
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
