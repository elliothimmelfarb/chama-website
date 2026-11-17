// The measured requests: the four that the loop's ledger names, and the
// summary of all of them on /engineering-department.
import { html, raw } from "../html.js";
import { n, c, out, place, label as arrive } from "./kit.js";
import { VIEW as SUM_VIEW } from "./contrast.js";

// Measured 2026-11-16 (feedback note filed to change live in production).
export const EXAMPLES = [
  { label: "A fix", minutes: 14 },
  { label: "A new filter", minutes: 31 },
  { label: "A new report", minutes: 33 },
  { label: "Download to Excel", minutes: 42 },
];

// The summary on /engineering-department (docs/DESIGN.md section 7, row 4):
// every measured request as one dot on one sheet, the day, in the order
// they went live. The sheet arrives with its world already holding a grey
// dot for each request; then those live within the hour fill in ember, a
// row at a time from the left, and the rest of the same day stay grey. It
// shows what the loop's ledger, one section before, cannot: all of them.
const COLS = 18, PITCH = 24, DOT = 6, TOP = -62;
const dots = (from, to) => {
  let d = "";
  for (let i = from; i < to; i++) {
    const x = (i % COLS) * PITCH - ((COLS - 1) * PITCH) / 2, y = TOP + Math.floor(i / COLS) * PITCH;
    d += `M${n(x - DOT)} ${y}a${DOT} ${DOT} 0 1 0 ${2 * DOT} 0a${DOT} ${DOT} 0 1 0 ${-2 * DOT} 0`;
  }
  return d;
};

export function changeSummary({ requests, within, share, day, label }) {
  const rows = Math.ceil(requests / COLS);
  const sheet = { x: -226, y: TOP - 22, w: 452, h: (rows - 1) * PITCH + 44 };
  // the ember rows fill in turn, each sliding in from the left, whole by 0.44
  const fill = (r) => {
    const a = 0.08 + 0.06 * r, lo = r * COLS, hi = Math.min(within, lo + COLS);
    return hi > lo ? `<path class="sum-dot sum-in" data-p d="${dots(lo, hi)}" style="opacity:${c(a, a + 0.06)};translate:calc(-16px * (1 - ${out(a, a + 0.08)})) 0"/>` : "";
  };
  const svg = `<svg class="fx-svg sum-svg" viewBox="${SUM_VIEW.join(" ")}" aria-hidden="true" focusable="false">
  <defs><radialGradient id="sum-floor"><stop offset="0" class="fx-s-shadow"/><stop offset="1" class="fx-s-clear"/></radialGradient></defs>
  <ellipse class="fx-floor" fill="url(#sum-floor)" cx="0" cy="${sheet.y + sheet.h + 6}" rx="250" ry="12"/>
  <rect class="sum-sheet" x="${sheet.x}" y="${sheet.y}" width="${sheet.w}" height="${sheet.h}"/>
  <path class="sum-dot sum-slot" d="${dots(0, requests)}"/>
  ${Array.from({ length: rows }, (_, r) => fill(r)).join("\n  ")}
</svg>`;
  return html`<figure class="fx sum" role="group" aria-label="${label}">
  <div class="sum-box">${raw(svg)}
  <span class="fx-lb is-hot sum-hour" data-p style="${`${place(SUM_VIEW, sheet.x, sheet.y - 12)};--tx:0%;--ty:-100%;${arrive(0.44)}`}">${share}</span>
  <span class="fx-lb sum-day" data-p style="${`${place(SUM_VIEW, sheet.x, sheet.y + sheet.h + 16)};--tx:0%;--ty:0%;${arrive(0.5)}`}">${day}</span></div>
</figure>`;
}
