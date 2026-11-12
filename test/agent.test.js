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
const { failureKind, emailParts } = sandbox.window.ChamaAgent;

test("the flame resting is told apart from every other failure, however it arrives", () => {
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

test("a request the server refused for what it carried does not offer the same request again", () => {
  assert.equal(failureKind(400, MESSAGES.unreadable), "final");
  assert.equal(failureKind(429, MESSAGES.tooLong), "final");
  assert.equal(failureKind(403, "This request could not be accepted."), "final");
});

test("an email address in a line becomes its own part, without the full stop after it", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(emailParts(MESSAGES.offline))), [
    { text: "The flame is resting right now. Email " },
    { email: "contact@chamainteligente.com" },
    { text: " and Elliot will get back to you." }
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
