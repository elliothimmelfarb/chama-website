// Remember cards: spaced repetition for what came up in a session.
//
// A card climbs a fixed ladder of gaps. "Got it" moves it up a step,
// "fuzzy" holds it where it is, "missed it" sends it back to the first
// step. Answered well at the top step, it retires: the client owns it.

export const LADDER_DAYS = [1, 3, 7, 16, 35];
export const RESULTS = ["again", "hard", "good"];
const DAY_MS = 86400000;

function after(now, days) {
  return new Date(now + days * DAY_MS).toISOString();
}

export function firstDue(now = Date.now()) {
  return after(now, LADDER_DAYS[0]);
}

export function nextReview({ step, result, now = Date.now() }) {
  if (!RESULTS.includes(result)) throw new Error("Unknown review result.");
  const current = Math.min(Math.max(Number.isInteger(step) ? step : 0, 0), LADDER_DAYS.length - 1);
  if (result === "again") return { step: 0, dueAt: after(now, LADDER_DAYS[0]), retired: false };
  if (result === "hard") return { step: current, dueAt: after(now, LADDER_DAYS[current]), retired: false };
  const next = current + 1;
  if (next >= LADDER_DAYS.length) return { step: current, dueAt: after(now, LADDER_DAYS[current]), retired: true };
  return { step: next, dueAt: after(now, LADDER_DAYS[next]), retired: false };
}
