import assert from "node:assert/strict";
import test from "node:test";

import { ceilToStep, datesBetween, freeSlots, offsetMinutes, overlaps, zonedParts, zonedToUtc } from "./time.js";

const LISBON = "Europe/Lisbon";
const NEW_YORK = "America/New_York";

// A Tuesday well inside Lisbon's winter, so wall clock and UTC agree.
const TUESDAY = { year: 2026, month: 1, day: 13 };
function utc(day, hour, minute = 0) {
  return new Date(Date.UTC(2026, 0, day, hour, minute, 0));
}

test("zonedParts reads the wall clock of a zone at an instant", () => {
  const winter = zonedParts(new Date("2026-01-15T10:00:00.000Z"), LISBON);
  assert.deepEqual(winter, { year: 2026, month: 1, day: 15, hour: 10, minute: 0, second: 0, weekday: 4 });

  const summer = zonedParts(new Date("2026-07-15T10:00:00.000Z"), LISBON);
  assert.equal(summer.hour, 11);
  assert.equal(summer.day, 15);

  // The same instant, five hours behind, is still the previous evening.
  const newYork = zonedParts(new Date("2026-01-15T02:00:00.000Z"), NEW_YORK);
  assert.equal(newYork.day, 14);
  assert.equal(newYork.hour, 21);
  assert.equal(newYork.weekday, 3);
});

test("offsetMinutes gives the zone's offset in winter and in summer", () => {
  assert.equal(offsetMinutes(new Date("2026-01-15T10:00:00.000Z"), LISBON), 0);
  assert.equal(offsetMinutes(new Date("2026-07-15T10:00:00.000Z"), LISBON), 60);
  assert.equal(offsetMinutes(new Date("2026-01-15T10:00:00.000Z"), NEW_YORK), -300);
  assert.equal(offsetMinutes(new Date("2026-07-15T10:00:00.000Z"), NEW_YORK), -240);
  assert.equal(offsetMinutes(new Date("2026-01-15T10:00:00.000Z"), "UTC"), 0);
});

test("zonedToUtc holds on the day the clocks change", () => {
  // 2026-03-29 is the day Lisbon springs forward, so 10:00 local is 09:00Z.
  const dstDay = zonedToUtc({ year: 2026, month: 3, day: 29, minute: 600 }, LISBON);
  assert.equal(dstDay.toISOString(), "2026-03-29T09:00:00.000Z");

  // The same wall clock in winter is the same instant in UTC.
  const winter = zonedToUtc({ year: 2026, month: 1, day: 15, minute: 600 }, LISBON);
  assert.equal(winter.toISOString(), "2026-01-15T10:00:00.000Z");

  assert.equal(
    zonedToUtc({ year: 2026, month: 1, day: 15, minute: 600 }, NEW_YORK).toISOString(),
    "2026-01-15T15:00:00.000Z"
  );
});

test("zonedToUtc round trips through zonedParts", () => {
  for (const spec of [
    { year: 2026, month: 3, day: 29, minute: 600, zone: LISBON },
    { year: 2026, month: 3, day: 29, minute: 30, zone: LISBON },
    { year: 2026, month: 10, day: 25, minute: 720, zone: LISBON },
    { year: 2026, month: 7, day: 4, minute: 855, zone: NEW_YORK }
  ]) {
    const instant = zonedToUtc(spec, spec.zone);
    const parts = zonedParts(instant, spec.zone);
    assert.equal(parts.year, spec.year);
    assert.equal(parts.month, spec.month);
    assert.equal(parts.day, spec.day);
    assert.equal(parts.hour * 60 + parts.minute, spec.minute);
  }
});

test("datesBetween spans the dates a zone actually sees", () => {
  const from = new Date("2026-01-13T23:30:00.000Z");
  const to = new Date("2026-01-14T00:30:00.000Z");

  assert.deepEqual(datesBetween(from, to, LISBON), [
    { year: 2026, month: 1, day: 13 },
    { year: 2026, month: 1, day: 14 }
  ]);

  // Five hours behind, both instants are still the evening of the 13th.
  assert.deepEqual(datesBetween(from, to, NEW_YORK), [{ year: 2026, month: 1, day: 13 }]);

  assert.deepEqual(datesBetween(new Date("2026-01-13T09:00:00.000Z"), new Date("2026-01-13T10:00:00.000Z"), LISBON), [
    { year: 2026, month: 1, day: 13 }
  ]);
  assert.equal(datesBetween(new Date("2026-01-13T00:00:00.000Z"), new Date("2026-01-17T00:00:00.000Z"), LISBON).length, 5);
});

test("overlaps is true only when the ranges share time", () => {
  assert.equal(overlaps(10, 20, 15, 25), true);
  assert.equal(overlaps(15, 25, 10, 20), true);
  assert.equal(overlaps(10, 20, 20, 30), false);
  assert.equal(overlaps(20, 30, 10, 20), false);
  assert.equal(overlaps(10, 20, 12, 14), true);
});

function rule(overrides = {}) {
  return { weekday: 2, start_minute: 540, end_minute: 720, timezone: LISBON, active: true, ...overrides };
}

function starts(slots) {
  return slots.map((s) => s.startsAt.toISOString());
}

const BASE = {
  rules: [rule()],
  busy: [],
  minutes: 60,
  stepMinutes: 30,
  from: utc(13, 0),
  to: utc(14, 0),
  timeZone: LISBON,
  now: utc(1, 0),
  noticeHours: 0
};

test("a Tuesday window offers a start every half hour that fits", () => {
  const slots = freeSlots(BASE);
  assert.deepEqual(starts(slots), [
    "2026-01-13T09:00:00.000Z",
    "2026-01-13T09:30:00.000Z",
    "2026-01-13T10:00:00.000Z",
    "2026-01-13T10:30:00.000Z",
    "2026-01-13T11:00:00.000Z"
  ]);
  for (const slot of slots) {
    assert.ok(slot.startsAt instanceof Date);
    assert.ok(slot.endsAt instanceof Date);
    assert.equal(slot.endsAt.getTime() - slot.startsAt.getTime(), 60 * 60000);
  }
  for (let i = 1; i < slots.length; i += 1) {
    assert.ok(slots[i - 1].startsAt < slots[i].startsAt, "ascending");
  }
});

test("a busy hour removes every start that would run into it", () => {
  const slots = freeSlots({
    ...BASE,
    busy: [{ starts_at: utc(13, 10).toISOString(), ends_at: utc(13, 11).toISOString() }]
  });
  assert.deepEqual(starts(slots), ["2026-01-13T09:00:00.000Z", "2026-01-13T11:00:00.000Z"]);
});

test("a busy range of no length is ignored", () => {
  const slots = freeSlots({
    ...BASE,
    busy: [{ starts_at: utc(13, 10).toISOString(), ends_at: utc(13, 10).toISOString() }]
  });
  assert.equal(slots.length, 5);
});

test("notice hours push the earliest start out", () => {
  const slots = freeSlots({ ...BASE, now: utc(13, 0), noticeHours: 10 });
  assert.deepEqual(starts(slots), [
    "2026-01-13T10:00:00.000Z",
    "2026-01-13T10:30:00.000Z",
    "2026-01-13T11:00:00.000Z"
  ]);
});

test("the end of the window caps the latest start", () => {
  const slots = freeSlots({ ...BASE, to: utc(13, 10, 30) });
  assert.deepEqual(starts(slots), ["2026-01-13T09:00:00.000Z", "2026-01-13T09:30:00.000Z"]);
});

test("a window that has already closed offers nothing", () => {
  assert.deepEqual(freeSlots({ ...BASE, to: utc(13, 0) }), []);
  assert.deepEqual(freeSlots({ ...BASE, minutes: 0 }), []);
});

test("two rules proposing the same start are counted once", () => {
  const slots = freeSlots({ ...BASE, rules: [rule(), rule()] });
  assert.deepEqual(starts(slots), [
    "2026-01-13T09:00:00.000Z",
    "2026-01-13T09:30:00.000Z",
    "2026-01-13T10:00:00.000Z",
    "2026-01-13T10:30:00.000Z",
    "2026-01-13T11:00:00.000Z"
  ]);
});

test("an inactive rule and a backwards rule are both ignored", () => {
  assert.deepEqual(freeSlots({ ...BASE, rules: [rule({ active: false })] }), []);
  assert.deepEqual(freeSlots({ ...BASE, rules: [rule({ start_minute: 720, end_minute: 540 })] }), []);
  assert.deepEqual(freeSlots({ ...BASE, rules: [rule({ start_minute: 540, end_minute: 540 })] }), []);
  // A rule for another weekday never fires inside a one-day window.
  assert.deepEqual(freeSlots({ ...BASE, rules: [rule({ weekday: 3 })] }), []);
});

test("a rule carries its own zone when it has one", () => {
  const slots = freeSlots({ ...BASE, rules: [rule({ timezone: NEW_YORK })], to: utc(14, 12) });
  // 09:00 in New York on the same Tuesday is 14:00Z.
  assert.equal(starts(slots)[0], "2026-01-13T14:00:00.000Z");
  assert.equal(slots.length, 5);
});

test("the weekday of a rule is read in the owner's zone", () => {
  // Tuesday 13 January in Lisbon, and the window opens the evening before in UTC.
  const slots = freeSlots({ ...BASE, from: utc(12, 23), to: utc(13, 10) });
  assert.deepEqual(starts(slots), ["2026-01-13T09:00:00.000Z"]);
});

test("ceilToStep rounds up to the next boundary and leaves one alone", () => {
  assert.equal(ceilToStep(new Date("2026-01-13T09:07:00.000Z"), 30).toISOString(), "2026-01-13T09:30:00.000Z");
  assert.equal(ceilToStep(new Date("2026-01-13T09:30:00.000Z"), 30).toISOString(), "2026-01-13T09:30:00.000Z");
  assert.equal(ceilToStep(new Date("2026-01-13T09:31:00.000Z"), 30).toISOString(), "2026-01-13T10:00:00.000Z");
  assert.equal(ceilToStep(new Date("2026-01-13T09:00:01.000Z"), 15).toISOString(), "2026-01-13T09:15:00.000Z");
});

test("the Tuesday the tests lean on really is a Tuesday", () => {
  assert.equal(zonedParts(zonedToUtc({ ...TUESDAY, minute: 720 }, LISBON), LISBON).weekday, 2);
});
