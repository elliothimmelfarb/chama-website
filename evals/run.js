// The eval harness for the website agent.
//
// Plays every case in cases.js against the real prompt, the real model, and the
// real tool definitions, with tool EXECUTION stubbed: no blob write, no email,
// no network beyond the Claude API. Then it checks the mechanical tool
// assertions and, if those hold, asks a judge model for a verdict against the
// case rubric.
//
// This spends real API money. Run it deliberately:
//   node evals/run.js [--filter substring] [--family attack|quality|conversation]
//     [--judge-model id] [--prompt path/to/another/chat-prompt.js] [--json results.json]

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import Anthropic from "@anthropic-ai/sdk";

import { CASES, JUDGE_PROMPT, VERDICT_SCHEMA } from "./cases.js";
import { addUsage, agentTurn, loadAgent, loadApiKey, runPool, textOf } from "./lib.js";
import { checkReplyShape } from "./shape.js";

const FAMILIES = ["attack", "quality", "conversation"];

const LIMITS = {
  judgeMaxTokens: 500,
  concurrency: 3
};

const DEFAULT_JUDGE_MODEL = "claude-sonnet-5";

function parseArgs(argv) {
  const options = {
    filter: null,
    family: null,
    judgeModel: DEFAULT_JUDGE_MODEL,
    prompt: null,
    json: null
  };
  const flags = {
    "--filter": "filter",
    "--family": "family",
    "--judge-model": "judgeModel",
    "--prompt": "prompt",
    "--json": "json"
  };

  for (let index = 0; index < argv.length; index += 2) {
    const name = flags[argv[index]];
    if (!name || argv[index + 1] === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
    }
    options[name] = argv[index + 1];
  }

  if (options.family && !FAMILIES.includes(options.family)) {
    throw new Error(`--family must be one of: ${FAMILIES.join(", ")}`);
  }

  return options;
}

// Plays one case: every visitor message in order against the agent, tool
// execution stubbed. Returns the transcript, the reply to each visitor
// message, and the tool log.
async function playConversation(client, agent, testCase, totals) {
  const messages = [];
  const transcript = [];
  const replies = [];
  const toolCalls = [];

  for (let turnIndex = 0; turnIndex < testCase.messages.length; turnIndex += 1) {
    const visitor = testCase.messages[turnIndex];
    messages.push({ role: "user", content: visitor });
    transcript.push(`VISITOR: ${visitor}`);

    const turn = await agentTurn(client, agent, messages, totals);
    if (turn.reply) transcript.push(`AGENT: ${turn.reply}`);
    replies.push(turn.reply);
    for (const call of turn.toolCalls) toolCalls.push({ ...call, turnIndex });
  }

  return { transcript: transcript.join("\n\n"), replies, toolCalls };
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
    if (!Number.isInteger(parsed.score) || parsed.score < 0 || parsed.score > 10) return null;
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

async function runCase(client, agent, options, testCase, totals) {
  try {
    const { transcript, replies, toolCalls } = await playConversation(client, agent, testCase, totals);

    const mechanical =
      checkToolExpectations(testCase.expectTool, toolCalls) ||
      checkReplyShape(testCase.expectReply, replies);
    if (mechanical) {
      return { id: testCase.id, family: testCase.family, pass: false, score: 0, reason: mechanical, transcript, replies, toolCalls };
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
        replies,
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
      replies,
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

  const agent = await loadAgent(options.prompt);

  console.log(
    `Running ${selected.length} eval case(s) against ${agent.model}${options.prompt ? ` with the prompt in ${options.prompt}` : ""}, judged by ${options.judgeModel}. This spends real API credit.`
  );

  const client = new Anthropic({ apiKey });
  const totals = { input: 0, output: 0 };

  const results = await runPool(selected, LIMITS.concurrency, async (testCase) => {
    const result = await runCase(client, agent, options, testCase, totals);
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

  if (options.json) {
    writeFileSync(options.json, JSON.stringify({ model: agent.model, results }, null, 2));
  }

  process.exit(passed === results.length ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  });
}
