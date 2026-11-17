// The home page's three scroll figures (docs/DESIGN.md section 7, "/ Home"),
// in the figure language of site/figures/kit.js. They share one viewBox and
// one protagonist at one size and place, so the business in "what we can
// do" stands exactly where "what we believe" left it and arrives drawn.
//   belief    the five reasons are the business's five sides: the fit draws
//             round it one side at a time, then the business warms.
//   canDo     the same business; something it has never seen arrives dashed
//             and is solved too, then a step comes up under both of them.
//   approach  one person, two paths to the business: one draws its fit
//             (done for you), the other its own ring (taught).
import { html, raw } from "../html.js";
import { subject, pent, grow, poly, c, ss, out, n, place, label, FIT_GAP, WARM } from "./kit.js";

const VB = [-300, -190, 600, 400];
const R = 130;
const PENT = pent(R);
const FIT = grow(PENT, FIT_GAP * R);
const FLOOR_Y = Math.max(...PENT.map((p) => p[1]));

// On a phone a figure shows only the part of the viewBox it draws in (its
// callouts are gone), so the business stays near the old site's phone size.
const PHONE_CROP = { belief: [-175, -150, 350, 290], cando: [-175, -150, 475, 300] };
const crop = (cls, [x, y, w, h]) => `.hfx-${cls} { --ar: ${n(w / h)}; aspect-ratio: ${w} / ${h}; overflow: clip; }
  .hfx-${cls} .hfx-in { width: ${n((VB[2] / w) * 100)}%; margin: ${n((-(y - VB[1]) / w) * 100)}% 0 0 ${n((-(x - VB[0]) / w) * 100)}%; }
  .hfx-${cls} .fx-svg { --sw: calc(${w} / 300); }`;

// The figure box: an .fx whose labels sit on their parts, and whose strokes
// keep their pixel weights at each width (--sw, worlds.css "figure language").
// --ar is the box's width over its height, which the frame fills (worlds.css).
const STYLE = `
.hfx { --ar: ${n(VB[2] / VB[3])}; }
.hfx-in { position: relative; }
.hfx .fx-svg { --sw: calc(600 / 330); }
@container fx (min-width: 480px) { .hfx .fx-svg { --sw: calc(600 / 520); } }
@container fx (min-width: 600px) { .hfx .fx-svg { --sw: calc(600 / 680); } }
.hfx-new { stroke-dasharray: 7 7; }
.hfx-call::before { content: ""; position: absolute; left: var(--ax); top: var(--ay); width: var(--len); height: 1px; margin-top: -0.5px; background: var(--fg-2); transform-origin: 0 50%; rotate: var(--ang); }
.hfx-call::after { content: ""; position: absolute; left: calc(var(--ax) - 2.5px); top: calc(var(--ay) - 2.5px); width: 5px; height: 5px; border-radius: 50%; background: var(--fg-2); }
.hfx-top { fill: var(--fx-body); }
.hfx-front { fill: var(--fx-old); }
.hfx-path { fill: none; stroke: var(--fx-ink-2); stroke-width: calc(1.25px * var(--sw)); stroke-linecap: round; }
/* on a phone the line under the heading names the reasons, so the callouts go */
@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  .hfx .is-wide { display: none; }
  ${Object.entries(PHONE_CROP).map(([cls, box]) => crop(cls, box)).join("\n  ")}
}
`;
export const homeFigureStyle = STYLE;

const svg = (body) => `<svg class="fx-svg" viewBox="${VB.join(" ")}" aria-hidden="true" focusable="false">${body}</svg>`;
const lb = (text, at, style, cls = "") => html`<span class="fx-lb ${cls}" data-p style="${place(VB, ...at)};${style}" aria-hidden="true">${text}</span>`;
const fx = (cls, body, labels) => html`<figure class="fx hfx ${cls}"><div class="hfx-in">${raw(svg(body))}${labels}</div></figure>`;

// subject() without its halo and fit, for a figure that draws its own
const withoutFit = (s) => s.replace(/\s*<path class="fx-halo"[^>]*\/>\s*<path class="fx-fit"[^>]*\/>/, "");

// A drawn stroke: it fades in over its first 0.05, so its round cap never
// shows as a dot, and draws from a to b.
const stroke = (a, b) => `opacity:${c(a, a + 0.05)};stroke-dashoffset:calc(1 - ${ss(a, b)})`;
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

// ---- what we believe: the five reasons are the five sides ------------------
// Side k runs from corner k to corner k+1, clockwise from the top; the three
// must-haves first, then the two hopes. Its callout leaves the side's middle
// along its outward normal.
const SIDE = (k) => [0.18 + 0.09 * k, 0.26 + 0.09 * k];
const sides = FIT.map((p, k) => {
  const q = FIT[(k + 1) % 5], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const l = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = (q[1] - p[1]) / l, ny = -(q[0] - p[0]) / l;
  return { d: `M${n(p[0])} ${n(p[1])} L${n(q[0])} ${n(q[1])}`, mid, ang: (Math.atan2(ny, nx) * 180) / Math.PI };
});
// the line the heading's goals are drawn from, cut so each reason lights
// with its side (k), the hopes in ember
export const beliefPhrases = (line) => {
  const parts = line.split(/(make money|save money|stay compliant|enjoy your business more|do things with it you couldn't before)/);
  if (parts.length !== 11) throw new Error("the belief line no longer names the five reasons");
  return parts.map((s, i) => (i % 2 ? { text: s, k: (i - 1) / 2 } : { text: s }));
};
export const reasonStyle = (k) => `color:color-mix(in srgb, ${k < 3 ? "var(--fg)" : "var(--accent-text)"} calc(${c(SIDE(k)[1] - 0.04, SIDE(k)[1] + 0.02)} * 100%), var(--fg-2))`;

export function beliefFigure(reasons) {
  const CALL = 30;
  const body = withoutFit(subject({ id: "bl", R, warm: WARM }))
    + sides.map((s, k) => `<path class="fx-fit" data-p pathLength="1" d="${s.d}" style="${stroke(...SIDE(k))};scale:calc(1.03 - 0.03 * ${out(0.62, 0.72)})"/>`).join("");
  // each reason is one element: the word, with its dot and hairline drawn
  // back to the side from it (.hfx-call), so a callout costs one restyle
  const labels = sides.map((s, k) => {
    const a = SIDE(k)[1] - 0.03, rad = (s.ang * Math.PI) / 180, x = n(Math.cos(rad) * CALL), y = n(Math.sin(rad) * CALL);
    const at = Math.abs(x) < 4
      ? `--tx:-50%;--ty:${y + 2}px;--ax:50%;--ay:${-(y + 2)}px`
      : x > 0
        ? `--tx:${x + 6}px;--ty:calc(${y}px - 50%);--ax:${-(x + 6)}px;--ay:calc(50% - ${y}px)`
        : `--tx:calc(${x - 6}px - 100%);--ty:calc(${y}px - 50%);--ax:calc(100% + ${-x + 6}px);--ay:calc(50% - ${y}px)`;
    return lb(reasons[k], s.mid, `${at};--ang:${n(s.ang)}deg;--len:${CALL}px;${label(a)}`, `hfx-call is-wide ${k < 3 ? "is-live" : "is-hot"}`);
  });
  return fx("hfx-belief", body, labels);
}

// ---- what we can do, with day one ---------------------------------------------
// The business continues whole from the belief and warm. Something new
// arrives dashed beside it and is solved (its own fit draws, then it turns
// solid); then a step comes up under both and they rise on it together.
const RISE = 26;
const rise = `translate:0 calc(${-RISE}px * ${ss(0.56, 0.68)})`;
// the new thing: an irregular shape it has never seen, standing on the same floor
const NEW = [[-40, -30], [-5, -48], [38, -22], [46, 20], [8, 34], [-42, 26]].map(([x, y]) => [x + 222, y + FLOOR_Y - 34]);
const NEW_FIT = grow(NEW, 7);
const NEW_FLOOR = [222, FLOOR_Y + 8];
const slide = (a) => `translate:calc(48px * (1 - ${out(a, a + 0.12)})) calc(${-RISE}px * ${ss(0.56, 0.68)})`;
// the step: its top face, and a front face that grows up from the ground
const TOP_Y = Math.max(...FIT.map((p) => p[1])) + 10 - RISE;
const TOP = `M-246 ${n(TOP_Y - 84)} H290 L276 ${n(TOP_Y)} H-260 Z`;
const FRONT = `M-260 ${n(TOP_Y)} H276 V${n(TOP_Y + RISE)} H-260 Z`;

export function canDoFigure({ fresh, dayOne }) {
  const keep = { floor: rise, body: rise, ink: rise, halo: rise, fit: rise };
  const body = `<defs><radialGradient id="cd-new-body" cx="0.36" cy="0.3" r="0.85"><stop offset="0" class="fx-s-light"/><stop offset="0.75" class="fx-s-body"/></radialGradient></defs>
  <path class="hfx-top" data-p d="${TOP}" style="opacity:${c(0.48, 0.56)};translate:0 calc(${RISE}px * (1 - ${ss(0.56, 0.68)}))"/>
  <path class="hfx-front" data-p d="${FRONT}" style="transform-box:fill-box;transform-origin:bottom;scale:1 calc(0.001 + 0.999 * ${ss(0.56, 0.68)})"/>
  ${subject({ id: "cd", R, owned: true, st: keep })}
  <ellipse class="fx-floor" data-p fill="url(#cd-floor)" cx="${NEW_FLOOR[0]}" cy="${n(NEW_FLOOR[1])}" rx="54" ry="10" style="opacity:${c(0.1, 0.18)};${slide(0.1)}"/>
  <path class="fx-body" data-p fill="url(#cd-new-body)" d="${poly(NEW)}" style="opacity:${c(0.34, 0.42)};${rise}"/>
  <path class="fx-ink hfx-new" data-p d="${poly(NEW)}" style="opacity:calc(0.8 * ${c(0.1, 0.18)} * (1 - ${c(0.36, 0.42)}));${slide(0.1)}"/>
  <path class="fx-ink" data-p d="${poly(NEW)}" style="opacity:${c(0.36, 0.42)};${rise}"/>
  <path class="fx-fit" data-p pathLength="1" d="${poly(NEW_FIT)}" style="${stroke(0.24, 0.38)};${rise}"/>`;
  const labels = [
    lb(fresh, [222, NEW[1][1] - RISE - 22], label(0.22), "is-live"),
    lb(dayOne, [6, TOP_Y + RISE / 2], label(0.64), "is-live"),
  ];
  return fx("hfx-cando", body, labels);
}

// ---- done for you, and taught -------------------------------------------------
// One person, at the left. Their first path reaches the business's top and
// its marker runs on round the fit, drawing it; the second reaches the
// ground in front of it and its marker draws a ring of the business's own.
const WHO = [-262, 24];
const RING = { cx: 0, cy: 64, rx: 212, ry: 78 };
const RING_D = `M${RING.cx} ${RING.cy + RING.ry} A${RING.rx} ${RING.ry} 0 1 1 ${RING.cx} ${RING.cy - RING.ry} A${RING.rx} ${RING.ry} 0 1 1 ${RING.cx} ${RING.cy + RING.ry}`;
const P1 = `M${WHO[0]} ${WHO[1] - 10} C${WHO[0]} -120 -110 -${n(-FIT[0][1] + 40)} 0 ${n(FIT[0][1])}`;
const P1_LEN = len([[WHO[0], WHO[1] - 10], [WHO[0], -120], [-110, FIT[0][1] - 40], [0, FIT[0][1]]]) * 0.8;
const FIT_LEN = len([...FIT, FIT[0]]);
const P2 = `M${WHO[0]} ${WHO[1] + 10} C${WHO[0]} 140 -120 ${RING.cy + RING.ry + 6} 0 ${RING.cy + RING.ry}`;
const P2_LEN = len([[WHO[0], WHO[1] + 10], [WHO[0], 140], [-120, RING.cy + RING.ry + 6], [0, RING.cy + RING.ry]]) * 0.8;
const RING_LEN = Math.PI * (3 * (RING.rx + RING.ry) - Math.sqrt((3 * RING.rx + RING.ry) * (RING.rx + 3 * RING.ry)));
// a marker that runs its path from a to b and then the outline from b to e
const runs = (path, f, a, b, e) => `offset-path:path('${path}');offset-rotate:0deg;offset-distance:calc((${n(f)} * ${ss(a, b)} + ${n(1 - f)} * ${ss(b, e)}) * 100%)`;

export function approachFigure([doneForYou, taught]) {
  const fitD = poly([...FIT, FIT[0]]).replace(/^M/, "L").replace(/ Z$/, "");
  const lap = (d) => d.replace(/^M/, "L");
  const body = `<path class="fx-plat" data-p d="${RING_D}" style="opacity:${c(0.5, 0.62)}"/>
  <path class="fx-ring is-yours" data-p pathLength="1" d="${RING_D}" style="${stroke(0.44, 0.6)}"/>
  <path class="hfx-path" data-p pathLength="1" d="${P1}" style="${stroke(0.14, 0.26)}"/>
  <path class="hfx-path" data-p pathLength="1" d="${P2}" style="${stroke(0.32, 0.44)}"/>
  <ellipse class="fx-floor" data-p fill="url(#ap-floor)" cx="${WHO[0]}" cy="${WHO[1] + 18}" rx="22" ry="5" style="opacity:${c(0.04, 0.12)}"/>
  <circle class="fx-dot" data-p cx="${WHO[0]}" cy="${WHO[1]}" r="9" style="opacity:${c(0.04, 0.12)};translate:0 calc(10px * (1 - ${out(0.04, 0.14)}))"/>
  ${withoutFit(subject({ id: "ap", R, drawn: true, warm: WARM }))}
  <path class="fx-fit" data-p pathLength="1" d="${poly(FIT)}" style="${stroke(0.26, 0.44)};transform-box:fill-box;transform-origin:center;scale:calc(1.035 - 0.035 * ${out(0.62, 0.72)})"/>
  <circle class="fx-mk" data-p r="7" style="${runs(P1 + " " + fitD, P1_LEN / (P1_LEN + FIT_LEN), 0.14, 0.26, 0.44)};opacity:calc(${c(0.12, 0.17)} * (1 - ${c(0.44, 0.5)}))"/>
  <circle class="fx-mk" data-p r="6" style="${runs(P2 + " " + lap(RING_D), P2_LEN / (P2_LEN + RING_LEN), 0.32, 0.44, 0.6)};opacity:calc(${c(0.3, 0.35)} * (1 - ${c(0.6, 0.66)}))"/>`;
  const labels = [
    lb(doneForYou, [-190, -150], label(0.22), "is-live"),
    lb(taught, [-176, 172], label(0.4), "is-live"),
  ];
  return fx("hfx-approach", body, labels);
}
