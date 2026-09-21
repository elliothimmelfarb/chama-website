// A calendar file for one session, so a confirmation email lands in the
// client's calendar with one tap. RFC 5545, the minimum a calendar needs.

function stamp(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n?/g, "\n")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// Lines longer than 75 octets are folded with a CRLF and a space. The limit
// is octets of UTF-8, not characters, and the break never falls inside a
// code point: an accent or an emoji counts for what it weighs on the wire.
const UTF8 = new TextEncoder();

function fold(line) {
  const parts = [];
  let current = "";
  let used = 0;
  let budget = 75;
  for (const character of line) {
    const weight = UTF8.encode(character).length;
    if (used + weight > budget) {
      parts.push(current);
      current = "";
      used = 0;
      budget = 74; // the space that opens a continuation is one of the 75
    }
    current += character;
    used += weight;
  }
  parts.push(current);
  return parts.map((part, index) => (index === 0 ? part : " " + part)).join("\r\n");
}

export function icsEvent({ uid, startsAt, endsAt, summary, description, url, organizerEmail, attendeeEmail, sequence = 0, cancelled = false }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chama Inteligente//Hearth//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${uid}@chamainteligente.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(startsAt)}`,
    `DTEND:${stamp(endsAt)}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    `SUMMARY:${escapeText(summary)}`
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  if (url) lines.push(`URL:${url}`);
  if (organizerEmail) lines.push(`ORGANIZER;CN=Elliot Himmelfarb:mailto:${organizerEmail}`);
  if (attendeeEmail) lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${attendeeEmail}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
