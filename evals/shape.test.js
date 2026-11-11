import assert from "node:assert/strict";
import { test } from "node:test";

import { checkReplyShape, countQuestions, countWords } from "./shape.js";

test("countWords counts whitespace-separated words and treats empty text as zero", () => {
  assert.equal(countWords("Hey. What brought you by?"), 5);
  assert.equal(countWords("  \n "), 0);
});

test("countQuestions counts question sentences, not question marks", () => {
  assert.equal(countQuestions("Really?? Where do the orders come in?"), 2);
  assert.equal(countQuestions("We build software."), 0);
});

test("checkReplyShape passes when there is nothing to check", () => {
  assert.equal(checkReplyShape(undefined, ["anything at all"]), null);
});

test("checkReplyShape fails a reply over its word limit and names the turn", () => {
  const reason = checkReplyShape({ maxWords: [3] }, ["one two three four"]);
  assert.match(reason, /Reply 1 is 4 words/);
});

test("checkReplyShape skips turns whose limit is null", () => {
  assert.equal(checkReplyShape({ maxWords: [null, 2] }, ["a very long first reply", "ok then"]), null);
});

test("checkReplyShape fails a reply that asks more questions than allowed", () => {
  const reason = checkReplyShape({ maxQuestions: 1 }, ["What do you use? And who enters it?"]);
  assert.match(reason, /Reply 1 asks 2 questions/);
});

test("checkReplyShape fails a turn the agent never answered", () => {
  const reason = checkReplyShape({ maxWords: [10] }, [""]);
  assert.match(reason, /Reply 1 is empty/);
});
