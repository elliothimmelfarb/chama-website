// Buying software against having your own engineers (docs/DESIGN.md section
// 7, /engineering-department row 2). Left: customers queue at one software
// company; the line moves up three times, the front one goes in and a new
// one joins at the back each time, so the queue never gets shorter. Right:
// one business with its own ember outline. It grows a sixth corner while
// the queue is on its first step, and the new outline draws over the old
// one, which matches it everywhere but the new corner. Complete at --p 1.
import { html, raw } from "../html.js";
import { ngon, grow, poly, c, ss } from "./kit.js";

const STEPS = [[0.1, 0.28], [0.34, 0.52], [0.58, 0.76]];
const MOVED = `(${STEPS.map(([a, b]) => ss(a, b)).join(" + ")})`;

const GAP = 30, FRONT = 138, WAITING = 4;
// customer m starts m places back; the first three go in, one per step,
// and three more join at the back, one per step
const queue = Array.from({ length: WAITING + STEPS.length }, (_, m) => {
  const x = FRONT - GAP * m;
  let fade = "";
  if (m < STEPS.length) fade = `opacity:calc(1 - ${c(STEPS[m][0] + 0.04, STEPS[m][1] - 0.02)});`;
  else if (m >= WAITING) fade = `opacity:${c(STEPS[m - WAITING][0], STEPS[m - WAITING][1] - 0.04)};`;
  return `<path class="cx-q" data-p d="${poly(ngon(10))}" transform="translate(${x} 92)" style="${fade}translate:calc(${MOVED} * ${GAP}px) 0"/>`;
}).join("\n  ");

// yours: the pentagon grows a sixth corner out of its upper right edge
const PENT = ngon(36);
const MID = [(PENT[0][0] + PENT[1][0]) / 2, (PENT[0][1] + PENT[1][1]) / 2];
const HEX = [PENT[0], [MID[0] + 14 * 0.588, MID[1] - 14 * 0.809], ...PENT.slice(1)];
const REFIT = [0.2, 0.32];

const svg = raw(`<svg class="cx-svg" viewBox="0 0 460 170" aria-hidden="true" focusable="false">
  <rect class="cx-co" x="170" y="50" width="84" height="84"/>
  ${queue}
  <path class="cx-rule" d="M290 24 V160"/>
  <g transform="translate(378 92)">
    <path class="cx-you" data-p d="${poly(PENT)}" style="opacity:calc(1 - ${c(REFIT[0], REFIT[0] + 0.05)})"/>
    <path class="cx-you" data-p d="${poly(HEX)}" style="opacity:${c(REFIT[0], REFIT[0] + 0.05)}"/>
    <path class="cx-fit" data-p d="${poly(grow(PENT, 9))}" style="opacity:calc(1 - ${c(REFIT[1] - 0.03, REFIT[1])})"/>
    <path class="cx-fit" data-p pathLength="1" d="${poly(grow(HEX, 9))}" style="stroke-dashoffset:calc(1 - ${c(REFIT[0] + 0.03, REFIT[1])})"/>
  </g>
</svg>`);

export function contrast({ them, you, label }) {
  return html`<figure class="cx" role="group" aria-label="${label}">
  ${svg}
  <figcaption class="cx-labels"><span>${them}</span><span>${you}</span></figcaption>
</figure>`;
}
