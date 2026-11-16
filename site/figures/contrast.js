// Buying software against having your own engineers (docs/DESIGN.md section
// 7, /engineering-department row 2), in two acts in one box. Act one, large:
// customers queue at a software company, a grey block with a doorway; the
// line moves up twice, each time the front one goes in and a new one joins
// at the back, so it never gets shorter. Then the camera moves on: the
// company and its queue step back into the corner and dim, and yours
// arrives in the middle, at full size, with its own three engineers.
// "Yours" stands exactly where the loop's business stands in the next world
// (VIEW and YOURS are shared with loop.js), so the loop carries it on.
// Act one stands at --p 0, so the figure arrives with its world already
// showing the queue. Complete at --p 1.
import { html, raw } from "../html.js";
import { n, c, ss, out, pent, poly, place, label, subject } from "./kit.js";

// The box and the business, shared with the loop so the two line up.
export const VIEW = [-240, -170, 480, 340];
export const YOURS = { R: 66, at: [0, 0] };

// ---- act one: the queue at the company, standing on the ground at y 50 --------
const GROUND = 50;
const STEPS = [[0.1, 0.22], [0.24, 0.36]];
// the line moves up one place per step
const MOVED = `(${STEPS.map(([a, b]) => ss(a, b)).join(" + ")})`;
// slot s: 0 at the door, 4 at the back; nearer is larger
const SLOT_X = (s) => 30 - 50 * s, SLOT_R = (s) => 26 - 2 * s;
// five wait; one joins at the back on each step
const JOIN = [null, null, null, null, null, 0, 1];

// The camera moving on: act one shrinks to 0.42 about the box's origin and
// moves into the top left corner, dimming as it goes.
const CAM = ss(0.36, 0.46);
const camera = `translate:calc(-149px * ${CAM}) calc(-118px * ${CAM});scale:calc(1 - 0.58 * ${CAM})`;
const dim = `(1 - 0.62 * ${CAM})`;

// a customer, drawn with its bottom on 0 so it scales where it stands
function customer(k) {
  const join = JOIN[k];
  // where it starts (every newcomer at the back), and how far it has moved up since
  const start = join === null ? k : 4;
  const pts = pent(SLOT_R(start)), bottom = Math.max(...pts.map((p) => p[1]));
  const d = poly(pts.map(([x, y]) => [x, y - bottom]));
  const moved = join === null ? MOVED : join === 0 ? ss(...STEPS[1]) : "0";
  // act one stands from the start, so the figure never arrives empty;
  // a newcomer joins at the back on its step
  const arrive = join === null ? "1" : c(STEPS[join][0] + 0.02, STEPS[join][0] + 0.08);
  // the one at the door goes in on its step
  const inside = k < STEPS.length ? ` * (1 - ${c(STEPS[k][0] + 0.03, STEPS[k][1] - 0.01)})` : "";
  const nearer = `(1 + ${n(2 / SLOT_R(start))} * ${moved})`;
  return `<path class="cx-q" data-p d="${d}" style="opacity:calc(${arrive}${inside} * ${dim});${camera};transform:translate(calc(${SLOT_X(start)}px + 50px * ${moved}), ${GROUND}px) scale(calc${nearer})"/>`;
}
const queue = JOIN.map((_, k) => customer(k)).join("\n  ");

// The company: a block seen from the front and a little above, its doorway
// cut through the front face (one path, evenodd), so it costs two elements.
const ACT_ONE = `opacity:${dim};${camera}`;
const FRONT = `M56 -60 H176 V${GROUND} H56 Z M68 6 H90 V${GROUND} H68 Z`;
const TOP = "M56 -60 L176 -60 L196 -76 L76 -76 Z";

// ---- act two: yours, with its engineers --------------------------------------
const { R } = YOURS;
// the protagonist's own rhythm, from the moment the camera has moved on
const ACT = {
  floor: `opacity:calc(0.01 + 0.99 * ${c(0.4, 0.47)});transform-box:fill-box;transform-origin:center;scale:calc(0.7 + 0.3 * ${out(0.4, 0.5)})`,
  body: `opacity:calc(0.01 + 0.99 * ${c(0.4, 0.47)});transform-box:fill-box;transform-origin:center;scale:calc(0.94 + 0.06 * ${out(0.4, 0.5)});translate:0 calc(12px * (1 - ${out(0.4, 0.5)}))`,
  ink: `opacity:${c(0.44, 0.49)};stroke-dashoffset:calc(1 - ${ss(0.44, 0.54)})`,
  fit: `opacity:${c(0.48, 0.53)};stroke-dashoffset:calc(1 - ${ss(0.48, 0.6)});transform-box:fill-box;transform-origin:center;scale:calc(1.035 - 0.035 * ${out(0.62, 0.72)})`,
};
// three engineers, standing together to its left on one shadow
const TEAM = [[-136, 22], [-114, 31], [-146, 40]];
const dot = ([x, y]) => `M${x - 6} ${y}a6 6 0 1 0 12 0a6 6 0 1 0 -12 0`;
const team = `<path class="fx-dot" data-p d="${TEAM.map(dot).join("")}" style="opacity:${c(0.52, 0.58)};transform-box:fill-box;transform-origin:center;scale:calc(0.9 + 0.1 * ${out(0.52, 0.6)})"/>`;
const teamFloor = `<ellipse class="fx-floor" data-p fill="url(#cx-team-floor)" cx="-128" cy="48" rx="34" ry="6" style="opacity:${c(0.52, 0.58)}"/>`;
// the line to the one you talk to
const talk = `<path class="fx-hair cx-talk" data-p pathLength="1" d="M-104 30 L-66 20" style="opacity:${c(0.56, 0.6)};stroke-dashoffset:calc(1 - ${ss(0.56, 0.64)})"/>`;

const svg = raw(`<svg class="fx-svg cx-svg" viewBox="${VIEW.join(" ")}" aria-hidden="true" focusable="false">
  <defs><radialGradient id="cx-q-body" cx="0.36" cy="0.3" r="0.85"><stop offset="0" class="fx-s-light"/><stop offset="0.75" class="fx-s-body"/></radialGradient>
  <radialGradient id="cx-team-floor"><stop offset="0" class="fx-s-shadow"/><stop offset="1" class="fx-s-clear"/></radialGradient></defs>
  <ellipse class="fx-floor" data-p fill="url(#cx-team-floor)" cx="4" cy="${GROUND + 3}" rx="226" ry="12" style="${ACT_ONE}"/>
  <path class="cx-co-top" data-p d="${TOP}" style="${ACT_ONE}"/>
  <path class="cx-co" data-p d="${FRONT}" style="${ACT_ONE}"/>
  ${queue}
  ${teamFloor}${team}
  ${talk}
  ${subject({ id: "cx", ...YOURS, st: ACT })}
</svg>`);

// labels: the company named in its corner once the camera has moved on
// (while it is large, the heading beside it says what it is); yours under yours
const lb = (text, [x, y], style, cls = "") => `<span class="fx-lb${cls}" data-p style="${place(VIEW, x, y)};${style}">${text}</span>`;
const bottom = 0.86 * R * Math.cos(Math.PI / 5);

export function contrast({ them, you, label: aria }) {
  return html`<figure class="fx cx" role="group" aria-label="${aria}">
  ${svg}
  ${raw(lb(them, [-148, -84], `--ty:0%;${label(0.46)}`))}
  ${raw(lb(you, [0, bottom + 0.14 * R + 22], `--ty:0%;${label(0.58)}`, " is-live"))}
</figure>`;
}
