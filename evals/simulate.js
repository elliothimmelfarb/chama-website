// The conversation simulator for the website agent.
//
// run.js checks single replies against a rubric. This plays whole
// conversations: a second model is each visitor in personas.js, decides turn
// by turn whether to keep typing or close the tab, and hands over a name and a
// way to be reached only if the conversation earns it. It measures what the
// flame is for: did the visitor stay, did the flame learn what their problem
// is, were their questions answered, and did they get in contact.
//
// Tool execution is stubbed exactly as in run.js. This spends real API money:
//   node evals/simulate.js [--runs 3] [--filter substring]
//     [--prompt path/to/another/chat-prompt.js] [--json results.json]

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import Anthropic from "@anthropic-ai/sdk";

import { addUsage, agentTurn, loadAgent, loadApiKey, runPool, textOf } from "./lib.js";
import { PERSONAS, REVIEW_PROMPT, REVIEW_SCHEMA, VISITOR_SCHEMA, visitorPrompt } from "./personas.js";
import { countQuestions, countWords } from "./shape.js";

const VISITOR_MODEL = "claude-sonnet-5";

// The saved conversations show what a model playing a visitor will not: real
// people do not read a long reply to a short message. So patience is counted
// here, not left to the visitor model. A reply that is a wall next to what the
// visitor wrote, or that asks more than one thing, is a strike, and a visitor
// out of strikes closes the tab.
const WALL = { floorWords: 60, timesVisitorWords: 3 };
const DEFAULT_PATIENCE = 2;

export function strikesFor(visitorText, reply) {
  const strikes = [];
  const limit = Math.max(WALL.floorWords, WALL.timesVisitorWords * countWords(visitorText));
  const words = countWords(reply);
  if (words > limit) strikes.push(`a ${words}-word reply to a ${countWords(visitorText)}-word message`);
  if (countQuestions(reply) > 1) strikes.push("more than one question at once");
  return strikes;
}

const LIMITS = {
  visitorTurns: 8,
  visitorMaxTokens: 1000,
  reviewMaxTokens: 800,
  concurrency: 4
};

function parseArgs(argv) {
  const options = { runs: 3, filter: null, prompt: null, json: null };
  const flags = { "--runs": "runs", "--filter": "filter", "--prompt": "prompt", "--json": "json" };

  for (let index = 0; index < argv.length; index += 2) {
    const name = flags[argv[index]];
    if (!name || argv[index + 1] === undefined) {
      throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
    }
    options[name] = argv[index + 1];
  }

  options.runs = Number(options.runs);
  if (!Number.isInteger(options.runs) || options.runs < 1) {
    throw new Error("--runs must be a whole number of at least 1");
  }

  return options;
}

async function structured(client, { system, content, schema, maxTokens }, totals) {
  const message = await client.messages.create({
    model: VISITOR_MODEL,
    max_tokens: maxTokens,
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content }]
  });
  addUsage(totals, message.usage);
  return JSON.parse(textOf(message.content));
}

function render(turns) {
  return turns.map((turn) => `${turn.role === "visitor" ? "VISITOR" : "AGENT"}: ${turn.text}`).join("\n\n");
}

async function playPersona(client, agent, persona, totals) {
  const messages = [];
  const turns = [];
  let noteSent = false;
  let leftBecause = "The conversation reached its turn limit.";
  let visitorMessage = persona.opening;
  const patience = persona.patience ?? DEFAULT_PATIENCE;
  const strikes = [];

  for (let turnIndex = 0; turnIndex < LIMITS.visitorTurns; turnIndex += 1) {
    messages.push({ role: "user", content: visitorMessage });
    turns.push({ role: "visitor", text: visitorMessage });

    const { reply, toolCalls } = await agentTurn(client, agent, messages, totals);
    turns.push({ role: "agent", text: reply });
    if (toolCalls.some((call) => call.name === "send_note_to_elliot")) {
      noteSent = true;
      leftBecause = "Their details were sent.";
      break;
    }

    strikes.push(...strikesFor(visitorMessage, reply));
    if (strikes.length >= patience) {
      leftBecause = `Out of patience: ${strikes.join("; ")}.`;
      break;
    }

    const next = await structured(
      client,
      {
        system: visitorPrompt(persona),
        content: `The conversation so far:\n\n${render(turns)}\n\nWhat do you do now?`,
        schema: VISITOR_SCHEMA,
        maxTokens: LIMITS.visitorMaxTokens
      },
      totals
    );

    if (next.action === "leave" || !next.message.trim()) {
      leftBecause = next.why;
      break;
    }
    visitorMessage = next.message.trim();
  }

  const review = await structured(
    client,
    {
      system: REVIEW_PROMPT,
      content: `## FACTS\n${persona.facts.map((fact, index) => `${index}. ${fact}`).join("\n")}\n\n## QUESTIONS\n${
        persona.questions.map((question, index) => `${index}. ${question}`).join("\n") || "(none)"
      }\n\n## TRANSCRIPT\n${render(turns)}`,
      schema: REVIEW_SCHEMA,
      maxTokens: LIMITS.reviewMaxTokens
    },
    totals
  );

  const within = (indexes, length) => new Set(indexes.filter((index) => index >= 0 && index < length)).size;
  const agentTurns = turns.filter((turn) => turn.role === "agent");
  const visitorTurns = turns.filter((turn) => turn.role === "visitor");

  return {
    persona: persona.id,
    noteSent,
    visitorMessages: visitorTurns.length,
    visitorWords: visitorTurns.map((turn) => countWords(turn.text)),
    agentWords: agentTurns.map((turn) => countWords(turn.text)),
    agentQuestions: agentTurns.map((turn) => countQuestions(turn.text)),
    factsLearned: within(review.factsLearned, persona.facts.length),
    factsTotal: persona.facts.length,
    questionsAnswered: within(review.questionsAnswered, persona.questions.length),
    questionsTotal: persona.questions.length,
    leftBecause,
    turns
  };
}

const sum = (values) => values.reduce((total, value) => total + value, 0);

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}

export function summarize(results) {
  const firstReplies = results.map((result) => result.agentWords[0]);
  const allReplies = results.flatMap((result) => result.agentWords);
  const allQuestions = results.flatMap((result) => result.agentQuestions);

  return {
    conversations: results.length,
    gotInContact: results.filter((result) => result.noteSent).length,
    leftAfterFirstReply: results.filter((result) => result.visitorMessages === 1).length,
    visitorMessagesMedian: median(results.map((result) => result.visitorMessages)),
    factsLearned: sum(results.map((result) => result.factsLearned)),
    factsTotal: sum(results.map((result) => result.factsTotal)),
    questionsAnswered: sum(results.map((result) => result.questionsAnswered)),
    questionsTotal: sum(results.map((result) => result.questionsTotal)),
    firstReplyWordsMedian: median(firstReplies),
    replyWordsMedian: median(allReplies),
    repliesWithTwoQuestions: allQuestions.filter((count) => count > 1).length,
    replies: allReplies.length
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set and was not found in .env or .env.local at the repo root.");
    process.exit(2);
  }

  const personas = options.filter
    ? PERSONAS.filter((persona) => persona.id.includes(options.filter))
    : PERSONAS;
  if (personas.length === 0) {
    console.error("No personas matched the filter.");
    process.exit(2);
  }

  const agent = await loadAgent(options.prompt);
  const jobs = personas.flatMap((persona) => Array.from({ length: options.runs }, () => persona));

  console.log(
    `Simulating ${jobs.length} conversation(s) against ${agent.model}${options.prompt ? ` with the prompt in ${options.prompt}` : ""}. This spends real API credit.`
  );

  const client = new Anthropic({ apiKey });
  const totals = { input: 0, output: 0 };

  const results = await runPool(jobs, LIMITS.concurrency, async (persona) => {
    try {
      const result = await playPersona(client, agent, persona, totals);
      console.log(
        `${result.noteSent ? "CONTACT" : "left   "}  ${result.persona.padEnd(20)} ${String(result.visitorMessages).padStart(2)} msgs  facts ${result.factsLearned}/${result.factsTotal}  answered ${result.questionsAnswered}/${result.questionsTotal}  replies ${result.agentWords.join(",")} words  ${result.leftBecause}`
      );
      return result;
    } catch (error) {
      console.log(`ERROR    ${persona.id}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });

  const finished = results.filter(Boolean);
  const summary = summarize(finished);

  console.log("");
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Tokens: ${totals.input} input / ${totals.output} output`);

  if (options.json) {
    writeFileSync(options.json, JSON.stringify({ model: agent.model, summary, results: finished }, null, 2));
  }

  process.exit(finished.length === jobs.length ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  });
}
