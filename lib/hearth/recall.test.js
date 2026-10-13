import assert from "node:assert/strict";
import test from "node:test";

import { LADDER_DAYS, firstDue, nextReview } from "./recall.js";

const NOW = Date.parse("2026-10-13T12:00:00.000Z");
const days = (n) => new Date(NOW + n * 86400000).toISOString();

test("a new card comes back the next day", () => {
  assert.equal(firstDue(NOW), days(1));
});

test("got it climbs the ladder, fuzzy holds the step, missed it starts over", () => {
  assert.deepEqual(nextReview({ step: 0, result: "good", now: NOW }), { step: 1, dueAt: days(3), retired: false });
  assert.deepEqual(nextReview({ step: 2, result: "hard", now: NOW }), { step: 2, dueAt: days(7), retired: false });
  assert.deepEqual(nextReview({ step: 3, result: "again", now: NOW }), { step: 0, dueAt: days(1), retired: false });
});

test("a card answered well at every step retires after the last one", () => {
  let step = 0;
  let last;
  for (let i = 0; i < LADDER_DAYS.length; i += 1) {
    last = nextReview({ step, result: "good", now: NOW });
    step = last.step;
  }
  assert.equal(last.retired, true);
});

test("an unknown answer is refused rather than guessed", () => {
  assert.throws(() => nextReview({ step: 0, result: "maybe", now: NOW }), /result/);
});
