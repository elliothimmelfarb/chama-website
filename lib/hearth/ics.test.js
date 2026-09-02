import assert from "node:assert/strict";
import test from "node:test";

import { icsEvent } from "./ics.js";

const BASE = {
  uid: "booking-1",
  startsAt: "2026-03-15T10:00:00.000Z",
  endsAt: "2026-03-15T11:00:00.000Z",
  summary: "Session with Elliot Himmelfarb"
};

// A calendar file is one string of folded CRLF lines; unfolding is how a
// reader gets back what was written.
function unfold(text) {
  return text.replace(/\r\n /g, "");
}

function lines(text) {
  return unfold(text).split("\r\n").filter(Boolean);
}

test("an event carries the envelope a calendar needs", () => {
  const ics = icsEvent(BASE);
  const out = lines(ics);
  assert.equal(out[0], "BEGIN:VCALENDAR");
  assert.equal(out.at(-1), "END:VCALENDAR");
  assert.ok(out.includes("VERSION:2.0"));
  assert.ok(out.includes("PRODID:-//Chama Inteligente//Hearth//EN"));
  assert.ok(out.includes("CALSCALE:GREGORIAN"));
  assert.ok(out.includes("METHOD:REQUEST"));
  assert.ok(out.includes("BEGIN:VEVENT"));
  assert.ok(out.includes("END:VEVENT"));
  assert.ok(out.includes("UID:booking-1@chamainteligente.com"));
  assert.ok(out.includes("SEQUENCE:0"));
  assert.ok(out.includes("STATUS:CONFIRMED"));
  assert.match(out.find((l) => l.startsWith("DTSTAMP:")) || "", /^DTSTAMP:\d{8}T\d{6}Z$/);
});

test("every line ends with CRLF, including the last", () => {
  const ics = icsEvent(BASE);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.equal(ics.includes("\n\n"), false);
  for (const part of ics.split("\r\n")) assert.equal(part.includes("\n"), false);
});

test("the times are the compact UTC form", () => {
  const out = lines(icsEvent(BASE));
  assert.ok(out.includes("DTSTART:20260315T100000Z"));
  assert.ok(out.includes("DTEND:20260315T110000Z"));

  // A Date works as well as a string, and so does a time with milliseconds.
  const fromDates = lines(
    icsEvent({ ...BASE, startsAt: new Date("2026-12-01T08:30:45.500Z"), endsAt: new Date("2026-12-01T09:30:45.500Z") })
  );
  assert.ok(fromDates.includes("DTSTART:20261201T083045Z"));
  assert.ok(fromDates.includes("DTEND:20261201T093045Z"));
});

test("a cancellation says so in the method and the status", () => {
  const out = lines(icsEvent({ ...BASE, cancelled: true, sequence: 1 }));
  assert.ok(out.includes("METHOD:CANCEL"));
  assert.ok(out.includes("STATUS:CANCELLED"));
  assert.ok(out.includes("SEQUENCE:1"));
  assert.equal(out.includes("METHOD:REQUEST"), false);
  assert.equal(out.includes("STATUS:CONFIRMED"), false);
});

test("commas, semicolons, backslashes and newlines are escaped", () => {
  const out = lines(
    icsEvent({
      ...BASE,
      summary: "Coaching, planning; and a back\\slash",
      description: "First line\nSecond line, with a comma"
    })
  );
  assert.ok(out.includes("SUMMARY:Coaching\\, planning\\; and a back\\\\slash"));
  assert.ok(out.includes("DESCRIPTION:First line\\nSecond line\\, with a comma"));
});

test("description, url, organizer and attendee appear only when given", () => {
  const bare = lines(icsEvent(BASE));
  for (const prefix of ["DESCRIPTION:", "URL:", "ORGANIZER", "ATTENDEE"]) {
    assert.equal(bare.some((l) => l.startsWith(prefix)), false, prefix);
  }

  const full = lines(
    icsEvent({
      ...BASE,
      description: "Join: https://meet.example.com/room",
      url: "https://chamainteligente.com/hearth/sessions",
      organizerEmail: "owner@example.com",
      attendeeEmail: "client@example.com"
    })
  );
  assert.ok(full.includes("URL:https://chamainteligente.com/hearth/sessions"));
  assert.ok(full.includes("ORGANIZER;CN=Elliot Himmelfarb:mailto:owner@example.com"));
  assert.ok(full.includes("ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:client@example.com"));
});

test("a long line is folded and unfolds back to itself", () => {
  const summary = "A session about " + "everything at once ".repeat(8);
  const ics = icsEvent({ ...BASE, summary });
  const raw = ics.split("\r\n");
  const folded = raw.filter((l) => l.startsWith("SUMMARY:") || l.startsWith(" "));
  assert.ok(folded.length > 1, "the long summary is folded across lines");
  for (const line of raw) assert.ok(line.length <= 75, `line of ${line.length} octets: ${line}`);
  for (const continuation of folded.slice(1)) assert.ok(continuation.startsWith(" "));
  assert.ok(lines(ics).includes(`SUMMARY:${summary}`), "unfolding gives back the original line");
});
