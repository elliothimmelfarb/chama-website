// The note-to-live chart: four real, measured LA Metal requests on an
// hour-long axis (docs/DESIGN.md, "Proof"). Bars grow with --p in full
// motion; without --p they are drawn at their value.
import { html, raw } from "../html.js";
import { n, c, out, place, label as arrive, ARRIVE } from "./kit.js";
import { VIEW as SUM_VIEW } from "./contrast.js";

// Measured 2026-11-16 (feedback note filed to change live in production).
export const EXAMPLES = [
  { label: "A fix", minutes: 14 },
  { label: "A new filter", minutes: 31 },
  { label: "A new report", minutes: 33 },
  { label: "Download to Excel", minutes: 42 },
];

export function proofChart({ caption, captionClass = "", label = "Time from request to live, in minutes" } = {}) {
  return html`<figure class="bars" aria-label="${label}">
  <div class="bars-axis" aria-hidden="true"><span>0</span><span>15 min</span><span>30 min</span><span>45 min</span><span>1 hour</span></div>
  <ol class="bars-list">
    ${EXAMPLES.map(
      (e, i) => html`<li style="--v:${e.minutes / 60};--i:${i}"><span class="bars-label">${e.label}</span><span class="bars-value num" data-p>${e.minutes} min</span><span class="bars-bar" data-p aria-hidden="true"></span></li>`,
    )}
  </ol>
  ${caption ? html`<figcaption class="small${captionClass ? ` ${captionClass}` : ""}">${caption}</figcaption>` : ""}
</figure>`;
}

// The summary on /engineering-department (docs/DESIGN.md section 7, row 4):
// every measured request as one dot on one sheet, the day, in the order
// they went live, so those live within the hour fill the first rows in
// ember and the rest of the same day follow in ink. It shows what the
// loop's ledger, one section before, cannot: all of them. Its box is the
// loop's, so the dots pour out of where the loop's marker parked.
const COLS = 18, PITCH = 24, DOT = 6, TOP = -62;
const PARKED = [0, -128];
const dots = (from, to) => {
  let d = "";
  for (let i = from; i < to; i++) {
    const x = (i % COLS) * PITCH - ((COLS - 1) * PITCH) / 2, y = TOP + Math.floor(i / COLS) * PITCH;
    d += `M${n(x - DOT)} ${y}a${DOT} ${DOT} 0 1 0 ${2 * DOT} 0a${DOT} ${DOT} 0 1 0 ${-2 * DOT} 0`;
  }
  return d;
};

export function changeSummary({ requests, within, hour, day, label }) {
  const rows = Math.ceil(requests / COLS);
  const sheet = { x: -226, y: TOP - 22, w: 452, h: (rows - 1) * PITCH + 44 };
  // each row pours out of the parked marker in turn, whole by 0.52
  const row = (r) => {
    const a = 0.1 + 0.05 * r, lo = r * COLS, hi = Math.min(requests, lo + COLS);
    const style = `opacity:${c(a, a + 0.06)};transform-origin:${PARKED[0]}px ${PARKED[1]}px;scale:calc(0.1 + 0.9 * ${out(a, a + 0.12)})`;
    const part = (cls, f, t) => (t > f ? `<path class="sum-dot ${cls}" data-p d="${dots(f, t)}" style="${style}"/>` : "");
    return part("sum-in", lo, Math.min(hi, within)) + part("sum-later", Math.max(lo, within), hi);
  };
  const svg = `<svg class="fx-svg sum-svg" viewBox="${SUM_VIEW.join(" ")}" aria-hidden="true" focusable="false">
  <defs><radialGradient id="sum-floor"><stop offset="0" class="fx-s-shadow"/><stop offset="1" class="fx-s-clear"/></radialGradient></defs>
  <ellipse class="fx-floor" data-p fill="url(#sum-floor)" cx="0" cy="${sheet.y + sheet.h + 6}" rx="250" ry="12" style="${ARRIVE.floor}"/>
  <rect class="sum-sheet" data-p x="${sheet.x}" y="${sheet.y}" width="${sheet.w}" height="${sheet.h}" style="${ARRIVE.body}"/>
  ${Array.from({ length: rows }, (_, r) => row(r)).join("\n  ")}
  <circle class="fx-mk" data-p cx="${PARKED[0]}" cy="${PARKED[1]}" r="7.5" style="opacity:calc(1 - ${c(0.1, 0.16)})"/>
</svg>`;
  return html`<figure class="fx sum" role="group" aria-label="${label}">
  <div class="sum-box">${raw(svg)}
  <span class="fx-lb is-hot sum-hour" data-p style="${`${place(SUM_VIEW, sheet.x, sheet.y - 12)};--tx:0%;--ty:-100%;${arrive(0.48)}`}">${hour}</span>
  <span class="fx-lb sum-day" data-p style="${`${place(SUM_VIEW, sheet.x, sheet.y + sheet.h + 16)};--tx:0%;--ty:0%;${arrive(0.56)}`}">${day}</span></div>
</figure>`;
}
