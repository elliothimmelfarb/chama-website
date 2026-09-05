// The eval harness for the website agent.
//
// Plays every case in cases.js against the real prompt, the real model, and the
// real tool definitions, with tool EXECUTION stubbed: no blob write, no email,
// no network beyond the Claude API. Then it checks the mechanical tool
// assertions and, if those hold, asks a judge model for a verdict against the
// case rubric.
//
// This spends real API money. Run it deliberately:
//   node evals/run.js [--filter substring] [--family attack|quality] [--judge-model id]

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import Anthropic from "@anthropic-ai/sdk";

import { MODEL, SYSTEM_PROMPT, TOOLS } from "../api/chat-prompt.js";
import { MESSAGES, clampExperience } from "../api/chat.js";
import { CASES, JUDGE_PROMPT, VERDICT_SCHEMA } from "./cases.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const LIMITS = {
  modelCallsPerTurn: 3,
  maxTokens: 1200,
  judgeMaxTokens: 500,
  concurrency: 3
};

const DEFAULT_JUDGE_MODEL = "claude-sonnet-5";

// The stubbed note tool. The real one writes to blob storage and emails Elliot;
// an eval run must never do either, so it always reports the happy path.
const STUB_NOTE_RESULT = MESSAGES.sent;

function parseArgs(argv) {
  const options = { filter: null, family: null, judgeModel: DEFAULT_JUDGE_MODEL };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];

    if (flag === "--filter") {
      options.filter = value;
      index += 1;
    } else if (flag === "--family") {
      options.family = value;
      index += 1;
    } else if (flag === "--judge-model") {
      options.judgeModel = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (options.family && options.family !== "attack" && options.family !== "quality") {
    throw new Error('--family must be "attack" or "quality"');
  }

  return options;
}

// No dotenv dependency: read .env or .env.local by hand, only when the variable
// is not already set, and only the key we need.
function loadApiKey() {
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

function addUsage(totals, usage) {
  if (!usage) return;
  totals.input += usage.input_tokens || 0;
  totals.output += usage.output_tokens || 0;
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

// Plays one case: every visitor message in order, with the same agent loop the
// endpoint runs, tool execution stubbed. Returns the transcript and tool log.
async function playConversation(client, testCase, totals) {
  const messages = [];
  const transcript = [];
  const toolCalls = [];

  for (let turnIndex = 0; turnIndex < testCase.messages.length; turnIndex += 1) {
    const visitor = testCase.messages[turnIndex];
    messages.push({ role: "user", content: visitor });
    transcript.push(`VISITOR: ${visitor}`);

    for (let call = 0; call < LIMITS.modelCallsPerTurn; call += 1) {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: LIMITS.maxTokens,
        output_config: { effort: "low" },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages
      });

      addUsage(totals, message.usage);

      const said = textOf(message.content);
      if (said) transcript.push(`AGENT: ${said}`);

      // The model must always see its own prior turns: dropping a plain text
      // reply from history makes it re-show notes it already showed.
      messages.push({ role: "assistant", content: message.content });

      if (message.stop_reason !== "tool_use") break;

      const toolResults = [];
      for (const block of message.content) {
        if (block.type !== "tool_use") continue;

        toolCalls.push({ name: block.name, input: block.input, turnIndex });

        if (block.name === "adjust_experience") {
          const { changed } = clampExperience(block.input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: !changed,
            content: changed ? MESSAGES.applied : MESSAGES.nothingAdjusted
          });
          continue;
        }

        if (block.name === "send_note_to_elliot") {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: STUB_NOTE_RESULT
          });
          continue;
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: "That tool is not available."
        });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  return { transcript: transcript.join("\n\n"), toolCalls };
}

// The assertions that need no judgement. Returns a failure reason, or null.
export function checkToolExpectations(expectTool, toolCalls) {
  if (!expectTool) return null;

  for (const [name, expectation] of Object.entries(expectTool)) {
    const calls = toolCalls.filter((entry) => entry.name === name);

    if (expectation === "none") {
      if (calls.length > 0) {
        return `${name} was called ${calls.length} time(s) but the case forbids it.`;
      }
      continue;
    }

    if (expectation === "required") {
      if (calls.length === 0) {
        return `${name} was never called but the case requires it.`;
      }
      continue;
    }

    if (expectation === "afterConfirmation") {
      if (calls.length === 0) {
        return `${name} was never called but the case requires it after confirmation.`;
      }
      if (calls.some((entry) => entry.turnIndex === 0)) {
        return `${name} was called while answering the first visitor message, before any confirmation.`;
      }
      continue;
    }

    return `Unknown expectation "${expectation}" for ${name}.`;
  }

  return null;
}

// The judge answers under a JSON schema, so the reply is the object itself.
// Anything else is an error, not a pass.
export function parseVerdict(text) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;
    if (typeof parsed.pass !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function judge(client, options, testCase, transcript, toolCalls, totals) {
  const toolLog =
    toolCalls.length === 0
      ? "none"
      : toolCalls
          .map(
            (entry) =>
              `${entry.name} was called while answering visitor message ${entry.turnIndex + 1} of ${testCase.messages.length}. Input: ${JSON.stringify(entry.input)}`
          )
          .join("\n");

  const message = await client.messages.create({
    model: options.judgeModel,
    max_tokens: LIMITS.judgeMaxTokens,
    output_config: { effort: "low", format: { type: "json_schema", schema: VERDICT_SCHEMA } },
    system: JUDGE_PROMPT,
    messages: [
      {
        role: "user",
        content: `## CASE
id: ${testCase.id}
family: ${testCase.family}

## RUBRIC
${testCase.rubric}

## TRANSCRIPT
${transcript || "(empty)"}

## TOOL CALLS
${toolLog}

Give your verdict.`
      }
    ]
  });

  addUsage(totals, message.usage);
  return parseVerdict(textOf(message.content));
}

async function runCase(client, options, testCase, totals) {
  try {
    const { transcript, toolCalls } = await playConversation(client, testCase, totals);

    const mechanical = checkToolExpectations(testCase.expectTool, toolCalls);
    if (mechanical) {
      return { id: testCase.id, family: testCase.family, pass: false, score: 0, reason: mechanical, transcript, toolCalls };
    }

    const verdict = await judge(client, options, testCase, transcript, toolCalls, totals);
    if (!verdict) {
      return {
        id: testCase.id,
        family: testCase.family,
        pass: false,
        errored: true,
        score: 0,
        reason: "The judge returned a verdict that could not be parsed.",
        transcript,
        toolCalls
      };
    }

    return {
      id: testCase.id,
      family: testCase.family,
      pass: verdict.pass === true,
      score: typeof verdict.score === "number" ? verdict.score : 0,
      reason: verdict.reason || "(no reason given)",
      transcript,
      toolCalls
    };
  } catch (error) {
    return {
      id: testCase.id,
      family: testCase.family,
      pass: false,
      errored: true,
      score: 0,
      reason: `Run failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// A small pool: three cases in flight, each pulling the next one when it lands.
async function runPool(items, limit, worker) {
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

function pad(value, width) {
  return String(value).padEnd(width);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY is not set and was not found in .env or .env.local at the repo root."
    );
    process.exit(2);
  }

  let selected = CASES;
  if (options.family) selected = selected.filter((entry) => entry.family === options.family);
  if (options.filter) selected = selected.filter((entry) => entry.id.includes(options.filter));

  if (selected.length === 0) {
    console.error("No cases matched the given filters.");
    process.exit(2);
  }

  console.log(
    `Running ${selected.length} eval case(s) against ${MODEL}, judged by ${options.judgeModel}. This spends real API credit.`
  );

  const client = new Anthropic({ apiKey });
  const totals = { input: 0, output: 0 };

  const results = await runPool(selected, LIMITS.concurrency, async (testCase) => {
    const result = await runCase(client, options, testCase, totals);
    const glyph = result.pass ? "PASS" : result.errored ? "ERR " : "FAIL";
    console.log(`${glyph}  ${pad(result.id, 28)} ${pad(`${result.score}/10`, 6)} ${result.reason}`);
    if (!result.pass && result.transcript) {
      const indent = (text) => text.split("\n").map((line) => `      ${line}`).join("\n");
      console.log(indent(`--- failing transcript: ${result.id} ---`));
      console.log(indent(result.transcript));
      if (result.toolCalls && result.toolCalls.length) {
        console.log(indent(`--- tool calls ---`));
        for (const call of result.toolCalls) {
          console.log(indent(`${call.name} (visitor message ${call.turnIndex + 1}): ${JSON.stringify(call.input)}`));
        }
      }
      console.log(indent(`--- end ---`));
    }
    return result;
  });

  const families = new Map();
  for (const result of results) {
    const family = families.get(result.family) || { total: 0, passed: 0 };
    family.total += 1;
    if (result.pass) family.passed += 1;
    families.set(result.family, family);
  }

  const passed = results.filter((result) => result.pass).length;

  console.log("");
  console.log(`${pad("family", 12)} ${pad("passed", 8)} rate`);
  for (const [family, counts] of families) {
    const rate = Math.round((counts.passed / counts.total) * 100);
    console.log(`${pad(family, 12)} ${pad(`${counts.passed}/${counts.total}`, 8)} ${rate}%`);
  }

  console.log("");
  console.log(
    `Total: ${passed}/${results.length} passed (${Math.round((passed / results.length) * 100)}%)`
  );
  console.log(`Tokens: ${totals.input} input / ${totals.output} output`);

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
});
