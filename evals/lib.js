// What the two eval runners share: finding the API key, loading the prompt
// under test, and playing one agent turn with the endpoint's own loop and the
// tools stubbed. Nothing here writes a blob or sends an email.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { MESSAGES, clampExperience } from "../api/chat.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MODEL_CALLS_PER_TURN = 3;
const MAX_TOKENS = 1200;

// No dotenv dependency: read .env or .env.local by hand, only when the variable
// is not already set, and only the key we need.
export function loadApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  for (const name of [".env", ".env.local"]) {
    let text;
    try {
      text = readFileSync(join(ROOT, name), "utf8");
    } catch {
      continue;
    }

    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      if (key !== "ANTHROPIC_API_KEY") continue;

      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value) return value;
    }
  }

  return null;
}

// The agent under test: the live prompt by default, or another copy of
// chat-prompt.js (an earlier version, say) to compare against.
export async function loadAgent(promptPath) {
  const url = promptPath
    ? pathToFileURL(resolve(promptPath)).href
    : new URL("../api/chat-prompt.js", import.meta.url).href;
  const { MODEL, SYSTEM_PROMPT, TOOLS } = await import(url);
  return { model: MODEL, system: SYSTEM_PROMPT, tools: TOOLS };
}

export function addUsage(totals, usage) {
  if (!usage) return;
  totals.input += usage.input_tokens || 0;
  totals.output += usage.output_tokens || 0;
}

export function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

// Answers the last visitor message in `messages` and appends everything the
// agent said and did to it. The note tool always reports the happy path.
export async function agentTurn(client, agent, messages, totals) {
  const said = [];
  const toolCalls = [];

  for (let call = 0; call < MODEL_CALLS_PER_TURN; call += 1) {
    const message = await client.messages.create({
      model: agent.model,
      max_tokens: MAX_TOKENS,
      output_config: { effort: "low" },
      system: [{ type: "text", text: agent.system, cache_control: { type: "ephemeral" } }],
      tools: agent.tools,
      messages
    });

    addUsage(totals, message.usage);

    const text = textOf(message.content);
    if (text) said.push(text);

    // The model must always see its own prior turns: dropping a plain text
    // reply from history makes it re-show notes it already showed.
    messages.push({ role: "assistant", content: message.content });

    if (message.stop_reason !== "tool_use") break;

    const toolResults = [];
    for (const block of message.content) {
      if (block.type !== "tool_use") continue;

      toolCalls.push({ name: block.name, input: block.input });

      if (block.name === "adjust_experience") {
        const { changed } = clampExperience(block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: !changed,
          content: changed ? MESSAGES.applied : MESSAGES.nothingAdjusted
        });
      } else if (block.name === "send_note_to_elliot") {
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: MESSAGES.sent });
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: "That tool is not available."
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  return { reply: said.join("\n\n"), toolCalls };
}

// A small pool: `limit` items in flight, each pulling the next when it lands.
export async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
