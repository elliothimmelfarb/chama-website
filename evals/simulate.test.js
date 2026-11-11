import assert from "node:assert/strict";
import { test } from "node:test";

import { strikesFor, summarize } from "./simulate.js";

test("a short reply with one question costs the visitor no patience", () => {
  assert.deepEqual(strikesFor("hey", "Hey. What brought you by?"), []);
});

test("a wall of text next to a short message is a strike", () => {
  const reply = Array.from({ length: 61 }, () => "word").join(" ");
  assert.equal(strikesFor("hey", reply).length, 1);
});

test("a long reply to a long message is not a wall", () => {
  const visitor = Array.from({ length: 40 }, () => "word").join(" ");
  const reply = Array.from({ length: 110 }, () => "word").join(" ");
  assert.deepEqual(strikesFor(visitor, reply), []);
});

test("two questions in one reply is a strike", () => {
  assert.equal(strikesFor("we use excel", "Which version? Who fills it in?").length, 1);
});

test("summarize counts contacts, one-message visits and stacked questions", () => {
  const summary = summarize([
    { noteSent: true, visitorMessages: 4, agentWords: [20, 30, 40, 10], agentQuestions: [1, 1, 1, 0], factsLearned: 3, factsTotal: 4, questionsAnswered: 1, questionsTotal: 1 },
    { noteSent: false, visitorMessages: 1, agentWords: [90], agentQuestions: [2], factsLearned: 0, factsTotal: 2, questionsAnswered: 0, questionsTotal: 1 }
  ]);
  assert.equal(summary.gotInContact, 1);
  assert.equal(summary.leftAfterFirstReply, 1);
  assert.equal(summary.factsLearned, 3);
  assert.equal(summary.factsTotal, 6);
  assert.equal(summary.repliesWithTwoQuestions, 1);
});
