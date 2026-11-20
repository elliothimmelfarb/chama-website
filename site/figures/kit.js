// The figure language's shared parts: the expressions that turn a world's --p into motion,
// the business's shape and its geometry, and subject(), the protagonist drawn
// on its layers. Every figure imports these instead of keeping its own copies.
// Nothing here imports anything, so test/fixtures/figure.html can load it
// in the browser as it is.

// ---- motion: CSS expressions read from var(--p) ----------------------------
export const n = (v) => +v.toFixed(4);
// 0 before a, 1 after b, linear between
export const c = (a, b) => `clamp(0, (var(--p) - ${n(a)}) / ${n(b - a)}, 1)`;
// smoothstep, for things that move from one place to another
export const ss = (a, b) => `(${c(a, b)} * ${c(a, b)} * (3 - 2 * ${c(a, b)}))`;
// ease-out cubic, for things that arrive or land
export const out = (a, b) => `(1 - pow(1 - ${c(a, b)}, 3))`;
// up to 1 at m and back to 0, w either side. Written with max() rather
// than abs(), which Chrome only has from version 138.
export const bump = (m, w) => `clamp(0, 1 - max((var(--p) - ${n(m)}) / ${w}, (${n(m)} - var(--p)) / ${w}), 1)`;

// ---- geometry ------------------------------------------------------------
const f = (v) => +v.toFixed(2);
const f1 = (v) => +v.toFixed(1);
export const poly = (pts) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L") + " Z";
// The business is an irregular, living shape: nine points round its centre,
// the first at the top and the rest clockwise, each given as its distance
// from the centre in units of R. Every figure draws this one shape, so a
// business on one figure is the business on the next. A shape that changes
// keeps its nine points and moves some of them out.
export const BUSINESS = [1.12, 0.89, 1.05, 1.14, 0.94, 1.06, 0.74, 1.12, 1.05];
export const shape = (R, radii = BUSINESS) =>
  radii.map((r, i) => {
    const a = (i / radii.length) * 2 * Math.PI - Math.PI / 2;
    return [R * r * Math.cos(a), R * r * Math.sin(a)];
  });
// A closed curve through the points. At this tension the sides run nearly
// straight and the corners are turned, which is what keeps the outline crisp.
export const TENSION = 0.45;
const xy = ([x, y]) => `${f1(x)} ${f1(y)}`;
// the curve from p1 to p2, bent by the points either side of them
const span = (p0, p1, p2, p3, t) =>
  ` C${xy([p1[0] + ((p2[0] - p0[0]) / 6) * t, p1[1] + ((p2[1] - p0[1]) / 6) * t])} ${xy([p2[0] - ((p3[0] - p1[0]) / 6) * t, p2[1] - ((p3[1] - p1[1]) / 6) * t])} ${xy(p2)}`;
export function blob(pts, t = TENSION) {
  const k = pts.length, at = (i) => pts[(i + k) % k];
  return `M${xy(pts[0])}${pts.map((_, i) => span(at(i - 1), at(i), at(i + 1), at(i + 2), t)).join("")} Z`;
}
// An open curve through the points, for a line drawn by hand.
export function curve(pts, t = 1) {
  const at = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  return `M${xy(pts[0])}${pts.slice(1).map((_, i) => span(at(i - 1), at(i), at(i + 1), at(i + 2), t)).join("")}`;
}
// Each point pushed d outward, square to the line between its neighbours.
export function offset(pts, d) {
  const k = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + k) % k], b = pts[(i + 1) % k], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty);
    return [p[0] + (ty / l) * d, p[1] - (tx / l) * d];
  });
}
// The software's ember boundary stands FIT_GAP of R outside the business,
// and its survey ticks reach TICK of R further out, one at each point.
export const FIT_GAP = 0.15, TICK = 0.09;
export const ticks = (pts, from, to) => {
  const a = offset(pts, from), b = offset(pts, to);
  return a.map(([x, y], i) => `M${f1(x)} ${f1(y)} L${f1(b[i][0])} ${f1(b[i][1])}`).join(" ");
};
// A path that changes shape with --p, as the data-morph the engine reads
// (worlds.js, "shapes"): keys are [p, i] pairs, shape ds[i] standing at
// progress p. The ds must be the same commands with different numbers.
export const morph = (keys, ds) => `${keys.map(([p, i]) => `${n(p)}:${i}`).join(" ")}|${ds.join("|")}`;

// ---- the rhythm: arrive, draw, fit, land ---------------------------------------
// The default style of each layer; a figure passes its own in subject({ st }).
// A drawn stroke also fades in over its first 0.05, so an undrawn path's
// round cap never shows as a dot and nothing blinks: no part or label fades
// in over less than 0.05 of the hold.
export const ARRIVE = `opacity:calc(0.01 + 0.99 * ${c(0, 0.08)})`;
export const DRAW = `opacity:${c(0.02, 0.07)};stroke-dashoffset:calc(1 - ${ss(0.02, 0.16)})`;
export const FIT = `opacity:${c(0.1, 0.15)};stroke-dashoffset:calc(1 - ${ss(0.1, 0.22)})`;
// the survey ticks come once the boundary is whole
export const TICKS = `opacity:${c(0.22, 0.28)}`;
// the owned warmth arrives with the land
export const WARM = `opacity:${c(0.62, 0.7)}`;

// ---- the protagonist ---------------------------------------------------------
// One business, drawn flat as on a survey sheet: a quiet fill, a crisp ink
// outline, and round it the software, an ember boundary with its ticks over
// a halo that cuts whatever passes behind it. The fill is opaque, so what
// a figure draws before the subject shows only outside the business.
// owned: true paints the fill warm from the start; warm: a style string
// (WARM, or the figure's own) cross-fades the warm fill in, one element more.
// drawn: true is a protagonist that continues from the world before, at the
// same size and place: it arrives whole with its world and none of its parts
// reads --p (its warmth, if it has one, still arrives). It is not free: the
// .fig.r box around it reads --u, so its whole subtree restyles every frame
// its world is on screen. A business is drawn from nothing only where it
// first appears on a page. outline: false leaves out the halo, the boundary
// and the ticks (a business before it has its software).
// grows: { shapes, body, fit } is a business that changes shape: shapes are
// lists of radii (as BUSINESS), and body and fit are the [p, i] keys of the
// business and of its boundary (kit.morph). The boundary's keys come first,
// so the software makes room before the business grows into it, and the
// business never crosses its boundary. The layers that change carry data-p
// even on a drawn protagonist. Each layer is one leaf element.
export function subject({ R, radii = BUSINESS, at = [0, 0], fit = FIT_GAP * R, st = {}, owned = false, warm = null, drawn = false, outline = true, grows = null }) {
  const sets = grows ? grows.shapes.map((r) => shape(R, r)) : [shape(R, radii)];
  const tick = (pts) => ticks(pts, fit, fit + TICK * R);
  const ds = { body: sets.map((p) => blob(p)), fit: sets.map((p) => blob(offset(p, fit))), ticks: sets.map(tick) };
  // a layer's d (its last shape) and, if it changes, its data-morph
  const D = (layer, keys) => {
    const last = grows ? keys[keys.length - 1][1] : 0;
    return `${grows ? ` data-morph="${morph(keys, ds[layer])}"` : ""} d="${ds[layer][last]}"`;
  };
  const P = (style) => (drawn ? (grows ? " data-p" : "") : ` data-p style="${style}"`);
  const body = D("body", grows?.body), edge = D("fit", grows?.fit);
  // the warmth is new even on a protagonist that arrives drawn, so it keeps its --p
  const warmth = warm && !owned;
  return `<g transform="translate(${n(at[0])} ${n(at[1])})">
    <path class="fx-body${owned ? " is-owned" : ""}"${P(st.body || ARRIVE)}${body}/>
    ${warmth ? `<path class="fx-body is-owned" data-p style="${warm}"${body}/>` : ""}
    <path class="fx-ink"${P(st.ink || DRAW)} pathLength="1"${body}/>
    ${outline ? `<path class="fx-halo"${P(st.halo || st.fit || FIT)} pathLength="1"${edge}/>
    <path class="fx-fit"${P(st.fit || FIT)} pathLength="1"${edge}/>
    <path class="fx-ticks"${P(st.ticks || TICKS)}${D("ticks", grows?.fit)}/>` : ""}
  </g>`;
}

// Three quiet rings from a point on the business: the part that needs room
// asking for it. Drawn before the subject, they show only outside it. The
// rings leave one after another between a and b of the hold.
export const ripple = ([x, y], a, b, r = 24) =>
  [0, 1, 2].map((i) => {
    const from = a + (i * (b - a)) / 5, to = from + (3 * (b - a)) / 5;
    return `<circle class="fx-ripple" data-p cx="${f1(x)}" cy="${f1(y)}" r="${r}" style="opacity:calc(0.8 * ${c(from, from + (to - from) / 4)} * (1 - ${c(from + (to - from) / 4, to)}));scale:calc(0.08 + 0.92 * ${c(from, to)})"/>`;
  }).join("");

// ---- labels ------------------------------------------------------------------
// Where a point of the viewBox [x, y, w, h] falls, as the --x and --y an
// .fx-lb reads, so HTML labels stay on their part at every width.
export const place = (vb, x, y) => `--x:${n(((x - vb[0]) / vb[2]) * 100)}%;--y:${n(((y - vb[1]) / vb[3]) * 100)}%`;
// a label arrives when its part finishes, at a, rising 4px over 0.05
export const label = (a) => `opacity:calc(0.01 + 0.99 * ${c(a, a + 0.05)});translate:var(--tx, -50%) calc(var(--ty, -50%) + 4px * (1 - ${out(a, a + 0.05)}))`;
