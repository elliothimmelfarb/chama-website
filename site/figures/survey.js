// The first picture on /engineering-department, drawn as a survey sheet and
// played from time (a [data-stage]), because it is the first thing on the
// page. A business is an irregular, living shape. Software off the shelf is
// a box laid over it: as the business grows out of one box another is added,
// smaller, over the part that sticks out. Their corners go unused (hatched),
// where two meet is paid for twice (cross-hatched), and parts of the business
// are never covered (ember). Then the boxes go and your own software is one
// ember boundary that hugs the real shape. When a part of the business needs
// room it sends out a ripple, the boundary makes the room first, and the
// business grows into it.
// It ends on the business as the contrast and the loop then show it: the
// same shape (BUSINESS) on the same spot, the centre of the same cell. This
// sheet is drawn closer than theirs, so the shape is larger here.
// Complete at --p 1, which is the still that low motion, no JavaScript and
// print show.
import { html, raw, escape } from "../html.js";
import { n, c, ss, shape, blob, morph, place, subject, ripple, BUSINESS } from "./kit.js";
import { YOURS } from "./contrast.js";

export const SURVEY_VIEW = [-176, -125, 352, 250];
const { R } = YOURS;

// ---- the clock, in seconds ---------------------------------------------------
const T = 17.2;
const at = (sec) => n(sec / T);
const C = (a, b) => c(at(a), at(b));
const S = (a, b) => ss(at(a), at(b));
// shown from a (whole 0.4s later) until b (gone 0.4s later)
const on = (a, b) => `calc(${C(a, a + 0.4)} * (1 - ${C(b, b + 0.4)}))`;
const BOXES_GO = 8.6;

// ---- the business: how it starts, and each time it grows --------------------
// Each step moves two or three of the nine points out (kit.js, BUSINESS):
// to the right, to the left, then, once it has its own software, down and
// up. The last is BUSINESS itself.
const START = [0.86, 0.73, 0.7, 0.77, 0.82, 0.73, 0.67, 0.74, 0.7];
const STEPS = [[2, 3], [6, 7, 8], [4, 5], [0, 1]];
const SHAPES = STEPS.reduce((all, moved) => [...all, all[all.length - 1].map((r, i) => (moved.includes(i) ? BUSINESS[i] : r))], [START]);
const PTS = SHAPES.map((radii) => shape(R, radii));
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
// it outgrows the first box, then the second; then asks, and grows into the room made
const BODY = [[3.0, 0], [3.9, 1], [5.6, 1], [6.5, 2], [13.0, 2], [13.9, 3], [15.8, 3], [16.7, 4]].map(([s, i]) => [at(s), i]);
const FIT = [[12.1, 2], [12.9, 3], [14.9, 3], [15.7, 4]].map(([s, i]) => [at(s), i]);
const ASKS = [[mid(PTS[2][4], PTS[2][5]), 11.5], [PTS[3][0], 14.3]];

// ---- the boxes: [x, y, w, h] and when each is laid on -------------------------
const BOX = [
  { r: [-48, -44, 94, 94], a: 1.3 },
  { r: [34, -2, 62, 60], a: 4.2 },
  { r: [-96, -36, 60, 48], a: 6.8 },
];
const meet = (a, b) => {
  const x = Math.max(a[0], b[0]), y = Math.max(a[1], b[1]);
  return [x, y, Math.min(a[0] + a[2], b[0] + b[2]) - x, Math.min(a[1] + a[3], b[1] + b[3]) - y];
};
const rect = ([x, y, w, h], attrs) => `<rect ${attrs} x="${x}" y="${y}" width="${w}" height="${h}"/>`;
// a box is set down: it fades in a little large and settles
const laid = (a) => `opacity:${boxed(a)};transform-box:fill-box;transform-origin:center;scale:calc(1.06 - 0.06 * ${S(a, a + 0.5)})`;
// there from a until the boxes go
const boxed = (a) => on(a, BOXES_GO);

const hatch = (id, turn) => `<pattern id="${id}" class="sv-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(${turn})"><path d="M0 0V5"/></pattern>`;
// a leader: a dot on the part, and a line out to its label
const lead = ([x1, y1], [x2, y2], a, cls = "") =>
  `<path class="sv-lead${cls}" data-p d="M${x1} ${y1} L${x2} ${y2} M${x1 - 1.7} ${y1} a1.7 1.7 0 1 0 3.4 0 a1.7 1.7 0 1 0 -3.4 0" style="opacity:${boxed(a)}"/>`;
const CORNER = 10, [VX, VY, VW, VH] = SURVEY_VIEW;
const REG = [[VX + 6, VY + 6, 1, 1], [VX + VW - 6, VY + 6, -1, 1], [VX + 6, VY + VH - 6, 1, -1], [VX + VW - 6, VY + VH - 6, -1, -1]]
  .map(([x, y, a, b]) => `M${x} ${y + CORNER * b} V${y} H${x + CORNER * a}`).join(" ");

const svg = raw(`<svg class="fx-svg sv-svg" viewBox="${SURVEY_VIEW.join(" ")}" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="sv-dots" class="sv-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="0.8"/></pattern>
    ${hatch("sv-h", 45)}${hatch("sv-x", -45).replace("<path", `<rect class="sv-paid" width="5" height="5"/><path`)}
    <mask id="sv-open" maskUnits="userSpaceOnUse" x="${VX}" y="${VY}" width="${VW}" height="${VH}"><rect x="${VX}" y="${VY}" width="${VW}" height="${VH}" fill="#fff"/>${BOX.map((b) => rect(b.r, `data-p fill="#000" style="opacity:${boxed(b.a)}"`)).join("")}</mask>
  </defs>
  <rect x="${VX}" y="${VY}" width="${VW}" height="${VH}" fill="url(#sv-dots)"/>
  <path class="sv-reg" d="${REG} M-6 0 H6 M0 -6 V6"/>
  ${BOX.map((b) => rect(b.r, `class="sv-unused" data-p fill="url(#sv-h)" style="${laid(b.a)}"`)).join("\n  ")}
  ${ASKS.map(([pt, sec]) => ripple(pt, at(sec), at(sec + 1.5))).join("\n  ")}
  ${subject({
    R,
    grows: { shapes: SHAPES, body: BODY, fit: FIT },
    warm: `opacity:${C(10.2, 11.2)}`,
    st: {
      body: `opacity:calc(0.01 + 0.99 * ${C(0, 0.9)})`,
      ink: `opacity:${C(0.1, 0.5)};stroke-dashoffset:calc(1 - ${S(0.1, 1.3)})`,
      fit: `opacity:${C(9.2, 9.6)};stroke-dashoffset:calc(1 - ${S(9.2, 10.7)})`,
      ticks: `opacity:${C(10.6, 11.2)}`,
    },
  })}
  <g mask="url(#sv-open)"><path class="sv-missing" data-p data-morph="${morph(BODY, PTS.map((p) => blob(p)))}" d="${blob(PTS[PTS.length - 1])}" style="opacity:${boxed(BOX[0].a + 0.4)}"/></g>
  ${[1, 2].map((k) => rect(meet(BOX[0].r, BOX[k].r), `class="sv-twice" data-p fill="url(#sv-x)" style="opacity:${boxed(BOX[k].a)}"`)).join("\n  ")}
  ${BOX.map((b) => rect(b.r, `class="sv-box" data-p style="${laid(b.a)}"`)).join("\n  ")}
  ${lead([-42, 44], [-66, 76], 1.7)}
  ${lead([3, -51], [30, -76], 1.9, " is-hot")}
  ${lead([40, 34], [60, 78], 4.6)}
</svg>`);

// The labels are the drawing's own lettering, and most are gone by the end;
// the figure's aria-label tells the whole story, so they are hidden from it.
const lb = (text, [x, y], style, cls = "") => `<span class="fx-lb sv-lb${cls}" data-p aria-hidden="true" style="${place(SURVEY_VIEW, x, y)};${style}">${escape(text)}</span>`;
const CAP_AT = [0, 112];

export function survey({ label, unused, missing, twice, shelf, own }) {
  // the caption under the sheet: how many times off the shelf, then your own
  const caps = [[shelf[0], 1.5, 3.9], [shelf[1], 4.4, 6.5], [shelf[2], 7.0, BOXES_GO]];
  return html`<figure class="fx sv" data-stage data-duration="${T}" role="group" aria-label="${label}">
  ${svg}
  ${raw(lb(unused, [-69, 82], `--tx:-100%;opacity:${boxed(1.7)}`))}
  ${raw(lb(missing, [33, -81], `--tx:0%;opacity:${boxed(1.9)}`, " is-hot"))}
  ${raw(lb(twice, [63, 85], `--tx:0%;opacity:${boxed(4.6)}`))}
  ${raw(caps.map(([text, a, b]) => lb(text, CAP_AT, `opacity:${on(a, b)}`, " sv-cap")).join(""))}
  ${raw(lb(own, CAP_AT, `opacity:${C(10.6, 11.2)}`, " sv-cap is-hot"))}
  <div class="sv-ctl">
    <button class="sv-btn" type="button" data-stage-action="play" aria-label="Play">${raw(ICON.play)}</button>
    <button class="sv-btn" type="button" data-stage-action="pause" aria-label="Pause">${raw(ICON.pause)}</button>
    <button class="sv-btn" type="button" data-stage-action="replay" aria-label="Play again">${raw(ICON.replay)}</button>
  </div>
</figure>`;
}

const ICON = {
  play: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M6 4.2v9.6l8-4.8z"/></svg>`,
  pause: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M6.5 4v10M11.5 4v10"/></svg>`,
  replay: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9a5 5 0 1 0 1.6-3.7M4 3.2v3h3"/></svg>`,
};
