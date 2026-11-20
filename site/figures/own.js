// You own it: the
// two businesses stand from the start, the copy we run on our platform,
// behind, and yours on yours, in front. The software's ember outline is
// drawn round ours, then lifts out, flies over and sets down round yours,
// and yours warms. A shadow on the ground under it shrinks while it is in
// the air, which is what tells its height. Complete at --p 1, with the
// outline round yours.
import { html, raw, escape } from "../html.js";
import { n, c, ss, out, shape, blob, offset, ticks, place, label, subject, FIT_GAP, TICK, WARM } from "./kit.js";

const VIEW = [-240, -180, 480, 360];
const R = 70, GHOST = 44;
const OURS = { at: [-100, -92], plat: [-100, -66, 116, 38] };
const YOURS = { at: [70, 66], plat: [70, 98, 158, 54] };
const shadowY = (at, r) => n(at[1] + Math.max(...shape(r).map((p) => p[1])) + 0.08 * r);

// the flight, eased in and out
const FLY = ss(0.3, 0.6);
const t = FLY;
// the outline is drawn at your size and carried at the ghost's on our side
const SMALL = n(GHOST / R);
const SIZE = `(${SMALL} + ${n(1 - GHOST / R)} * ${t})`;
const ARC = `M${OURS.at[0]} ${OURS.at[1]} C -70 -176 40 -156 ${YOURS.at[0]} ${YOURS.at[1]}`;
const GROUND = `M${OURS.at[0]} ${shadowY(OURS.at, GHOST)} L${YOURS.at[0]} ${shadowY(YOURS.at, R)}`;
// higher in the air, a smaller and fainter shadow
const AIR = `(${t} * (1 - ${t}))`;

// a platform and its rim in one element: ours dotted, yours solid
const platform = ([cx, cy, rx, ry], cls) => `<ellipse class="fx-plat own-plat${cls}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
const FIT = blob(offset(shape(R), FIT_GAP * R));
const FIT_TICKS = ticks(shape(R), FIT_GAP * R, (FIT_GAP + TICK) * R);
const travel = `offset-path:path('${ARC}');offset-rotate:0deg;offset-distance:calc(${t} * 100%);transform:scale(calc(${SIZE} * (1.04 - 0.04 * ${out(0.6, 0.7)})))`;
const drawn = `stroke-dashoffset:calc(1 - ${ss(0.12, 0.24)})`;

const svg = raw(`<svg class="fx-svg own-svg" viewBox="${VIEW.join(" ")}" aria-hidden="true" focusable="false">
  <defs><radialGradient id="own-air"><stop offset="0" class="fx-s-shadow"/><stop offset="1" class="fx-s-clear"/></radialGradient></defs>
  ${platform(OURS.plat, "")}
  <path class="fx-body own-ghost" d="${blob(shape(GHOST))}" transform="translate(${OURS.at.join(" ")})"/>
  ${platform(YOURS.plat, " is-yours")}
  ${subject({ R, at: YOURS.at, drawn: true, warm: WARM, outline: false })}
  <ellipse class="fx-floor own-air" data-p fill="url(#own-air)" rx="${n(1.15 * R)}" ry="${n(0.2 * R)}" style="offset-path:path('${GROUND}');offset-rotate:0deg;offset-distance:calc(${t} * 100%);transform:scale(calc(${SIZE} * (1 - 2.2 * ${AIR})));opacity:calc(${c(0.3, 0.35)} * (1 - ${c(0.55, 0.6)}) * (1 - 1.6 * ${AIR}))"/>
  <path class="fx-halo" data-p pathLength="1" d="${FIT}" style="${travel};${drawn}"/>
  <path class="fx-fit" data-p pathLength="1" d="${FIT}" style="${travel};${drawn};opacity:${c(0.12, 0.17)}"/>
  <path class="fx-ticks" data-p d="${FIT_TICKS}" style="${travel};opacity:${c(0.22, 0.28)}"/>
</svg>`);

const lb = (text, [x, y], style, cls = "") => `<span class="fx-lb${cls}" data-p style="${place(VIEW, x, y)};--ty:0%;${style}">${escape(text)}</span>`;

export function own({ ours, yours }) {
  return html`<figure class="fx own-fig">
  ${svg}
  ${raw(lb(ours, [OURS.plat[0], OURS.plat[1] + OURS.plat[3] + 12], label(0.1)))}
  ${raw(lb(yours, [YOURS.plat[0], YOURS.plat[1] + YOURS.plat[3] + 12], label(0.64), " is-live"))}
</figure>`;
}
