// Time-zone arithmetic and the slot calculator, with no library.
//
// Availability is written in the owner's zone as weekday windows. A client
// sees free slots in their own zone. Everything in between is UTC instants,
// which is what the database stores and compares. The one hard part, turning
// "Tuesday 14:00 in Europe/Lisbon" into an instant across daylight-saving
// changes, is `zonedToUtc`, done with Intl and one correction pass.

const DAY_MS = 24 * 60 * 60 * 1000;

const partsCache = new Map();

function formatter(timeZone) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      weekday: "short"
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

export function isValidZone(timeZone) {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// The wall-clock parts of an instant in a zone.
export function zonedParts(date, timeZone) {
  const parts = {};
  for (const p of formatter(timeZone).formatToParts(date)) parts[p.type] = p.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAYS[parts.weekday]
  };
}

// The zone's offset from UTC at an instant, in minutes.
export function offsetMinutes(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

// The instant at which a zone's wall clock reads the given date and minute
// of day. A first guess assumes UTC, then the offset at that guess corrects
// it; a second pass handles the hour around a DST change.
export function zonedToUtc({ year, month, day, minute }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0) + minute * 60000;
  let offset = offsetMinutes(new Date(guess), timeZone);
  let instant = guess - offset * 60000;
  const second = offsetMinutes(new Date(instant), timeZone);
  if (second !== offset) instant = guess - second * 60000;
  return new Date(instant);
}

// The calendar dates (in a zone) touched by an instant range.
export function datesBetween(from, to, timeZone) {
  const out = [];
  const start = zonedParts(from, timeZone);
  let cursor = Date.UTC(start.year, start.month - 1, start.day);
  const endParts = zonedParts(to, timeZone);
  const end = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  while (cursor <= end) {
    const d = new Date(cursor);
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() });
    cursor += DAY_MS;
  }
  return out;
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Free slots between two instants.
//   rules:  [{ weekday, start_minute, end_minute, timezone, active }]
//   busy:   [{ starts_at, ends_at }] (bookings and blocks alike)
//   options: { minutes, stepMinutes, from, to, timeZone (owner's), now, noticeHours }
// Returns [{ startsAt, endsAt }] as Dates, ascending.
export function freeSlots({ rules, busy, minutes, stepMinutes = 30, from, to, timeZone, now = new Date(), noticeHours = 0 }) {
  const earliest = Math.max(from.getTime(), now.getTime() + noticeHours * 3600000);
  const latest = to.getTime();
  if (earliest >= latest || !minutes) return [];
  const busyRanges = busy
    .map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime()])
    .filter(([s, e]) => e > s);
  const active = rules.filter((r) => r.active !== false && r.end_minute > r.start_minute);
  const out = [];
  for (const date of datesBetween(new Date(earliest), new Date(latest), timeZone)) {
    const weekday = zonedToUtc({ ...date, minute: 12 * 60 }, timeZone);
    const wd = zonedParts(weekday, timeZone).weekday;
    for (const rule of active) {
      if (rule.weekday !== wd) continue;
      const zone = rule.timezone || timeZone;
      for (let m = rule.start_minute; m + minutes <= rule.end_minute; m += stepMinutes) {
        const start = zonedToUtc({ ...date, minute: m }, zone).getTime();
        const end = start + minutes * 60000;
        if (start < earliest || end > latest) continue;
        if (busyRanges.some(([s, e]) => overlaps(start, end, s, e))) continue;
        out.push({ startsAt: new Date(start), endsAt: new Date(end) });
      }
    }
  }
  out.sort((a, b) => a.startsAt - b.startsAt);
  // Two rules on one day can propose the same start; keep one.
  return out.filter((s, i) => i === 0 || s.startsAt.getTime() !== out[i - 1].startsAt.getTime());
}

// Rounds an instant up to the next step boundary in UTC minutes.
export function ceilToStep(date, stepMinutes) {
  const step = stepMinutes * 60000;
  return new Date(Math.ceil(date.getTime() / step) * step);
}
