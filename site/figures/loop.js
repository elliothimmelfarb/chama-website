// The loop on /engineering-department: you (the
// protagonist, carried on from the contrast at the same size and place,
// so it arrives drawn), the software (the ember boundary round you) and the
// AI system we run (a platform with a dotted rim and four stations). The
// marker runs four laps as --p goes from 0 to 1, one per real, measured
// request, and parks at "Tell us". Each lap is ask, make room, grow: the
// side of the business that needs room sends out a ripple as the marker
// leaves "Tell us", the boundary makes the room as it passes "It gets
// built", and the business grows into it as it passes "You use it". Every
// part is complete at --p 1, so low motion and one column show the finished
// picture, the business at its fullest, with all four laps in the ledger.
import { html, raw } from "../html.js";
import { EXAMPLES } from "./proof.js";
import { VIEW, YOURS } from "./contrast.js";
import { c, bump, shape, place, subject, ripple, BUSINESS } from "./kit.js";

// The ring, seen slightly from above. Station k sits at k quarters of its
// length (12, 3, 6 and 9 o'clock): an ellipse's quadrants are equal arcs.
const RX = 200, RY = 128;
const RING = `M0 ${-RY} A${RX} ${RY} 0 1 1 0 ${RY} A${RX} ${RY} 0 1 1 0 ${-RY} Z`;

// The business before the first lap (the contrast's "Yours") and after each
// lap: which of its nine points move out, and how far (kit.js, BUSINESS). The
// filter on the right, the fix lower left, the export's room at the bottom,
// the report upper left.
const ROOM = [{ 2: 1.3, 3: 1.38 }, { 5: 1.16, 6: 1.0 }, { 4: 1.16, 5: 1.3 }, { 7: 1.36, 8: 1.28 }];
const SHAPES = ROOM.reduce((all, room) => [...all, all[all.length - 1].map((r, i) => room[i] ?? r)], [BUSINESS]);
// where each lap's ripple starts: on the edge between the points that will move
const ASK = ROOM.map((room, k) => {
  const pts = shape(YOURS.R, SHAPES[k]), [a, b] = Object.keys(room).map((i) => pts[i]);
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
});

// The laps in the order the marker runs them.
const ORDER = ["A new filter", "A fix", "Download to Excel", "A new report"];
export const LAPS = ORDER.map((label) => EXAMPLES.find((e) => e.label === label));
// Each lap is 0.19 of the hold and the last parks by 0.84, so the finished
// picture (all four laps in the ledger) stands for the rest of the hold,
// which on a phone is when the words begin to leave.
const START = [0.08, 0.27, 0.46, 0.65];
const LAP = 0.19, PARK = START[3] + LAP;

// the first three laps run at the scroll's pace; the last eases out and
// parks the marker at "Tell us"
const lapDone = (k) => (k < 3 ? c(START[k], START[k + 1]) : `${c(START[3], PARK)} * (2 - ${c(START[3], PARK)})`);
const LAPS_RUN = `(${[0, 1, 2, 3].map(lapDone).join(" + ")})`;
// where in --p the marker passes a fraction f of lap k
const at = (k, f) => (k < 3 ? START[k] + f * LAP : START[3] + LAP * (1 - Math.sqrt(1 - f)));

// Lap k, in the marker's quarters: the ask as it leaves "Tell us", the
// boundary making room from "It gets built", the business growing from
// "You use it". The boundary is whole before the business moves.
const asks = ASK.map((pt, k) => ripple(pt, at(k, 0.02), at(k, 0.24))).join("\n  ");
const GROWS = {
  shapes: SHAPES,
  fit: ROOM.flatMap((_, k) => [[at(k, 0.25), k], [at(k, 0.45), k + 1]]),
  body: ROOM.flatMap((_, k) => [[at(k, 0.5), k], [at(k, 0.72), k + 1]]),
};

// The tail: an arc behind the marker, 40 degrees of trail.
const tail = (len, op) =>
  `<path class="loop-tail" data-p pathLength="1" d="${RING}" style="stroke-dasharray:${len} ${1 - len};stroke-dashoffset:calc(${len} - ${LAPS_RUN});opacity:calc(${op} * ${c(0.03, 0.08)} * (1 - ${c(PARK - 0.04, PARK)}))"/>`;

// Each "You use it" warms the business once; after the last lap it stays warm.
const WARMS = `opacity:min(1, ${[0, 1, 2, 3].map((k) => bump(at(k, 0.5), 0.05)).join(" + ")} + ${c(PARK - 0.06, PARK)})`;
// the export shows in the room made for it, as the business grows into it
const EXPORT_AT = at(2, 0.6);

const figureSvg = () => `<svg class="fx-svg loop-svg" viewBox="${VIEW.join(" ")}" aria-hidden="true" focusable="false">
  <ellipse class="fx-plat" rx="${RX}" ry="${RY}"/>
  <path class="fx-ring loop-ring" data-p d="${RING}" style="opacity:${c(0, 0.05)};scale:calc(0.96 + 0.04 * ${c(0, 0.05)})"/>
  ${asks}
  ${subject({ ...YOURS, drawn: true, warm: WARMS, grows: GROWS })}
  <path class="loop-export" data-p d="M14 12h26v18h-26z M20 21h14" style="opacity:${c(EXPORT_AT, EXPORT_AT + 0.05)};translate:0 calc(6px - 6px * ${c(EXPORT_AT, EXPORT_AT + 0.05)})"/>
  <path class="loop-station" data-p d="${[[0, -RY], [RX, 0], [0, RY], [-RX, 0]].map(([x, y]) => `M${x - 5.5} ${y}a5.5 5.5 0 1 0 11 0a5.5 5.5 0 1 0 -11 0`).join("")}" style="opacity:${c(0.02, 0.07)}"/>
  ${tail(0.111, 0.35)}
  <circle class="fx-mk loop-marker" data-p r="7.5" style="offset-path:path('${RING}');offset-rotate:0deg;offset-distance:calc(${LAPS_RUN} * 100%);opacity:${c(0.03, 0.08)}"/>
</svg>`;

// Station labels and the "You" label are HTML over the figure, so they
// stay readable at any width (figure text never goes under 12px).
const pos = (x, y) => place(VIEW, x, y);

export function loop({ stations, you = "You", label }) {
  // each lap's row, its request and how long it took, arrives as the
  // marker passes "It gets built" and the boundary makes room
  const ledger = html`<ol class="loop-ledger" aria-label="${label}">
    ${LAPS.map(
      (e, k) => html`<li data-p style="${`opacity:${c(at(k, 0.25), at(k, 0.25) + 0.05)}`}"><span>${e.label}</span><span class="num">${e.minutes} min</span></li>`,
    )}
  </ol>`;
  const figure = html`<figure class="fx loop-fig">
    ${raw(figureSvg())}
    <span class="fx-lb is-live loop-you-label" aria-hidden="true" style="${pos(0, -4)}">${you}</span>
    <ol class="loop-stops" data-p style="${`opacity:${c(0.02, 0.07)}`}" aria-label="${stations.join(", ")}">
      <li class="fx-lb is-live at-top" style="${pos(0, -RY)}">${stations[0]}</li>
      <li class="fx-lb is-live at-right" style="${pos(RX, 0)}">${stations[1]}</li>
      <li class="fx-lb is-live at-bottom" style="${pos(0, RY)}">${stations[2]}</li>
      <li class="fx-lb is-live at-left" style="${pos(-RX, 0)}">${stations[3]}</li>
    </ol>
  </figure>`;
  return { figure, ledger };
}
