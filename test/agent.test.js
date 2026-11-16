// The chat's decisions that need no browser: what a failed message leads to,
// and where an email address in a line the page wrote becomes a link.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

import { MESSAGES } from "../api/chat.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {} };
vm.runInNewContext(readFileSync(path.join(ROOT, "assets/agent.js"), "utf8"), sandbox);
const { failureKind, bodylessFailure, emailParts, shouldWarm } = sandbox.window.ChamaAgent;

test("the chat being offline is told apart from every other failure, however it arrives", () => {
  assert.equal(failureKind(503, MESSAGES.offline), "resting");
  // a spend limit reaches the page as an error event inside a 200 stream
  assert.equal(failureKind(undefined, MESSAGES.offline), "resting");
  for (const [name, text] of Object.entries(MESSAGES)) {
    if (name !== "offline") assert.notEqual(failureKind(503, text), "resting", name);
  }
});

test("a failure the visitor can fix by sending again offers a retry", () => {
  assert.equal(failureKind(503, MESSAGES.overwhelmed), "retry");
  assert.equal(failureKind(502, MESSAGES.failed), "retry");
  assert.equal(failureKind(undefined, MESSAGES.failed), "retry");
  assert.equal(failureKind(undefined, "Something went wrong. Please try again."), "retry");
});

// Vercel's firewall answers the chat's rate limit itself: a 429 with no
// JSON body. It says what the server says when it is busy, and offers the
// retry that line invites.
test("a refusal with no readable body still says what happened and what to do", () => {
  assert.equal(bodylessFailure(429), MESSAGES.overwhelmed);
  assert.equal(failureKind(429, bodylessFailure(429)), "retry");
  assert.equal(failureKind(502, bodylessFailure(502)), "retry");
});

test("a request the server refused for what it carried does not offer the same request again", () => {
  assert.equal(failureKind(400, MESSAGES.unreadable), "final");
  assert.equal(failureKind(429, MESSAGES.tooLong), "final");
  assert.equal(failureKind(403, "This request could not be accepted."), "final");
});

test("an email address in a line becomes its own part, without the full stop after it", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(emailParts("Email hello@example.com and we will answer."))), [
    { text: "Email " },
    { email: "hello@example.com" },
    { text: " and we will answer." }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(emailParts("Write to contact@chamainteligente.com."))), [
    { text: "Write to " },
    { email: "contact@chamainteligente.com" },
    { text: "." }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(emailParts("Sent. We will get back to you."))), [
    { text: "Sent. We will get back to you." }
  ]);
});

// The cache the first reply reads lasts five minutes on the API's side, so a
// warm-up is worth sending once per window and no more often.
test("the reply is warmed once, then again only when the last warm-up has gone cold", () => {
  const minute = 60 * 1000;
  assert.equal(shouldWarm(1000, null), true, "never warmed");
  assert.equal(shouldWarm(10 * minute, 10 * minute - 30 * 1000), false, "warmed half a minute ago");
  assert.equal(shouldWarm(10 * minute, 10 * minute - 4 * minute), false);
  assert.equal(shouldWarm(10 * minute, 10 * minute - 5 * minute), true, "five minutes on, the cache has expired");
});
