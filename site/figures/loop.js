// The loop on /engineering-department (docs/DESIGN.md section 12): you (the
// pentagon), the software (the ember outline that refits every lap) and the
// AI system we run (the dotted ring with its four stations). The marker
// runs four laps as --p goes from 0 to 1, one per real, measured request,
// and parks at "Tell us". Every part is complete at --p 1, so low motion
// and one column show the finished picture with all four laps in the ledger.
import { html, raw } from "../html.js";
import { EXAMPLES } from "./proof.js";

// The ring, seen slightly from above. Station k sits at k quarters of its
// length (12, 3, 6 and 9 o'clock): an ellipse's quadrants are equal arcs.
const RX = 200, RY = 128;
const RING = `M0 ${-RY} A${RX} ${RY} 0 1 1 0 ${RY} A${RX} ${RY} 0 1 1 0 ${-RY} Z`;
const YOU = "M0 -50 L59 -15 L36 40 L-36 40 L-59 -15 Z";
// The outline before the first lap, then after each lap's refit.
const OUTLINES = [
  "M0 -62 L71 -19 L45 50 L-45 50 L-71 -19 Z",
  "M0 -62 L71 -19 L82 14 L45 50 L-45 50 L-71 -19 Z",
  "M0 -62 L71 -19 L82 14 L45 50 L-34 50 L-50 36 L-71 -19 Z",
  "M0 -62 L71 -19 L82 14 L62 58 L-34 58 L-50 42 L-71 -19 Z",
  "M0 -68 L48 -52 L84 -19 L92 14 L68 64 L-40 64 L-64 46 L-84 -19 L-46 -52 Z",
];

// The laps in the order the marker runs them (DESIGN.md section 12).
const ORDER = ["A new filter", "A fix", "Download to Excel", "A new report"];
export const LAPS = ORDER.map((label) => EXAMPLES.find((e) => e.label === label));
const START = [0.1, 0.32, 0.54, 0.76];

const n = (v) => +v.toFixed(4);
// 0 before a, 1 after b, linear between: the progress of one moment
const c = (a, b) => `clamp(0, (var(--p) - ${n(a)}) / ${n(b - a)}, 1)`;
// the first three laps run at the scroll's pace; the last eases out and
// parks the marker at "Tell us"
const lapDone = (k) => (k < 3 ? c(START[k], START[k + 1]) : `${c(0.76, 1)} * (2 - ${c(0.76, 1)})`);
const LAPS_RUN = `(${[0, 1, 2, 3].map(lapDone).join(" + ")})`;
// where in --p the marker passes a fraction f of lap k
const at = (k, f) => (k < 3 ? START[k] + f * 0.22 : 0.76 + 0.24 * (1 - Math.sqrt(1 - f)));
const END = [at(0, 1), at(1, 1), at(2, 1), 0.92];
// a single bump to 1 and back, w either side of m
const bump = (m, w) => `clamp(0, 1 - max((var(--p) - ${n(m)}) / ${w}, (${n(m)} - var(--p)) / ${w}), 1)`;

const REFIT = [0.03, ...[0, 1, 2, 3].map((k) => at(k, 0.25))];
const outline = (d, k) => {
  const draw = c(REFIT[k], REFIT[k] + 0.025);
  const gone = k < 4 ? c(REFIT[k + 1], REFIT[k + 1] + 0.02) : "0";
  return `<path class="loop-fit" data-p pathLength="1" d="${d}" style="stroke-dashoffset:calc(1 - ${draw});opacity:calc(1 - ${gone})"/>`;
};

// The tail: three overlapping arcs behind the marker, shorter ones
// stronger, so 40 degrees of trail fade toward the back.
const tail = (len, op) =>
  `<path class="loop-tail" data-p pathLength="1" d="${RING}" style="stroke-dasharray:${len} ${1 - len};stroke-dashoffset:calc(${len} - ${LAPS_RUN});opacity:calc(${op} * ${c(0.08, 0.1)} * (1 - ${c(0.95, 1)}))"/>`;

const svg = raw(`<svg class="loop-svg" viewBox="-240 -170 480 340" aria-hidden="true" focusable="false">
  <path class="loop-ring" data-p d="${RING}" style="opacity:${c(0.05, 0.09)};scale:calc(0.94 + 0.06 * ${c(0.05, 0.09)})"/>
  <path class="loop-ticks" data-p pathLength="1" d="${RING}" style="opacity:${c(0.06, 0.1)};stroke-dashoffset:calc(var(--p) * -0.5)"/>
  <path class="loop-you" data-p pathLength="1" d="${YOU}" style="stroke-dashoffset:calc(1 - ${c(0, 0.03)})"/>
  <path class="loop-pulse" data-p d="${YOU}" style="opacity:calc(${[0, 1, 2, 3].map((k) => bump(at(k, 0.5), 0.02)).join(" + ")})"/>
  ${OUTLINES.map(outline).join("\n  ")}
  <path class="loop-export" data-p d="M14 12h26v18h-26z M20 21h14" style="opacity:${c(at(2, 0.25), at(2, 0.25) + 0.02)};translate:0 calc(6px - 6px * ${c(at(2, 0.25), at(2, 0.25) + 0.02)})"/>
  <g class="loop-stations" data-p style="opacity:${c(0.08, 0.1)}"><circle cx="0" cy="${-RY}" r="5"/><circle cx="${RX}" cy="0" r="5"/><circle cx="0" cy="${RY}" r="5"/><circle cx="${-RX}" cy="0" r="5"/></g>
  ${tail(0.111, 0.25)}
  ${tail(0.07, 0.4)}
  <circle class="loop-marker" data-p r="7" style="offset-path:path('${RING}');offset-rotate:0deg;offset-distance:calc(${LAPS_RUN} * 100%);opacity:${c(0.08, 0.1)}"/>
</svg>`);

// Station labels and the "You" label are HTML over the figure, so they
// stay readable at any width (figure text never goes under 12px).
const pos = (x, y) => `left:${n(((x + 240) / 480) * 100)}%;top:${n(((y + 170) / 340) * 100)}%`;

export function loop({ stations, you = "You", label }) {
  const notes = LAPS.map(
    (e, k) => html`<p class="loop-note" data-p style="${`opacity:calc(${c(START[k] + 0.005, START[k] + 0.02)} - ${c(END[k] - 0.02, END[k])})`}">${e.label} <span class="loop-time num" data-p style="${`opacity:${c(at(k, 0.75), at(k, 0.75) + 0.015)}`}">${e.minutes} min</span></p>`,
  );
  const ledger = html`<ol class="loop-ledger" aria-label="${label}">
    ${LAPS.map(
      (e, k) => html`<li data-p style="${`opacity:${c(END[k] - 0.02, END[k])};translate:0 calc(8px - 8px * ${c(END[k] - 0.02, END[k])})`}"><span>${e.label}</span><span class="num">${e.minutes} min</span></li>`,
    )}
  </ol>`;
  const figure = html`<div class="loop-fig">
    ${svg}
    <span class="loop-label loop-you-label" style="${pos(0, -2)}" aria-hidden="true">${you}</span>
    <ol class="loop-stops" aria-label="${stations.join(", ")}">
      <li class="at-top" style="${pos(0, -RY)}">${stations[0]}</li>
      <li class="at-right" style="${pos(RX, 0)}">${stations[1]}</li>
      <li class="at-bottom" style="${pos(0, RY)}">${stations[2]}</li>
      <li class="at-left" style="${pos(-RX, 0)}">${stations[3]}</li>
    </ol>
    <div class="loop-notes" style="${pos(0, -96)}" aria-hidden="true">${notes}</div>
  </div>`;
  return { figure, ledger };
}
