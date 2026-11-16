// The figure language's shared parts (docs/DESIGN.md, "The frame and the
// figure language"): the expressions that turn a world's --p into motion,
// the pentagon's geometry, and subject(), the protagonist drawn on its five
// layers. Every figure imports these instead of keeping its own copies.
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
export const poly = (pts) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L") + " Z";
// a regular pentagon of circumradius r, first vertex at the top, seen square on
export const ngon = (r) => [0, 1, 2, 3, 4].map((i) => [r * Math.cos(((i * 72 - 90) * Math.PI) / 180), r * Math.sin(((i * 72 - 90) * Math.PI) / 180)]);
// The business, seen slightly from above: its height squashed to SQUASH.
export const SQUASH = 0.86;
export const pent = (R, k = 5) =>
  Array.from({ length: k }, (_, i) => {
    const a = (((i * 360) / k - 90) * Math.PI) / 180;
    return [R * Math.cos(a), R * Math.sin(a) * SQUASH];
  });
// The ember fit stands FIT_GAP of the circumradius outside the business:
// the old site's hug, measured at about 0.12 to 0.14 of R on its canvas.
export const FIT_GAP = 0.14;
// The outline sits a constant distance outside the shape, mitred at the corners.
export function grow(pts, d) {
  const k = pts.length;
  const norm = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return [dy / l, -dx / l];
  };
  return pts.map((v, i) => {
    const n1 = norm(pts[(i - 1 + k) % k], v), n2 = norm(v, pts[(i + 1) % k]), m = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [v[0] + (n1[0] + n2[0]) * m, v[1] + (n1[1] + n2[1]) * m];
  });
}

// ---- the rhythm: arrive, draw, fit, act, land --------------------------------
// The default style of each layer; a figure passes its own in subject({ st }).
// A drawn stroke also fades in over its first 0.05, so an undrawn path's
// round cap never shows as a dot and nothing blinks: no part or label fades
// in over less than 0.05 of the hold.
export const ARRIVE = {
  floor: `opacity:calc(0.01 + 0.99 * ${c(0, 0.08)});transform-box:fill-box;transform-origin:center;scale:calc(0.7 + 0.3 * ${out(0, 0.1)})`,
  body: `opacity:calc(0.01 + 0.99 * ${c(0, 0.08)});transform-box:fill-box;transform-origin:center;scale:calc(0.94 + 0.06 * ${out(0, 0.1)});translate:0 calc(12px * (1 - ${out(0, 0.1)}))`,
};
export const DRAW = `opacity:${c(0.06, 0.11)};stroke-dashoffset:calc(1 - ${ss(0.06, 0.16)})`;
export const FIT = `opacity:${c(0.1, 0.15)};stroke-dashoffset:calc(1 - ${ss(0.1, 0.22)});transform-box:fill-box;transform-origin:center;scale:calc(1.035 - 0.035 * ${out(0.62, 0.72)})`;
// the owned warmth arrives with the land
export const WARM = `opacity:${c(0.62, 0.7)}`;

// ---- the protagonist ---------------------------------------------------------
// One business on the five layers: floor shadow, body, ink outline, the
// halo that cuts what passes behind the fit, and the ember fit. id is
// unique per instance on the page (a figure rendered twice needs two).
// owned: true paints the body warm from the start; warm: a style string
// (WARM, or the figure's own) cross-fades the warm body in, one element more.
// drawn: true is a protagonist that continues from the world before, at the
// same size and place: it arrives whole with its world and reads no --p, so
// it costs nothing a frame (its warmth, if it has one, still arrives). A
// pentagon is drawn from nothing only where it first appears on a page.
// Five elements carry data-p (six with warm); the defs and the group do not.
export function subject({ id, R, pts = pent(R), at = [0, 0], fit = FIT_GAP * R, st = {}, owned = false, warm = null, drawn = false }) {
  const d = poly(pts), g = poly(grow(pts, fit));
  const bottom = Math.max(...pts.map((p) => p[1]));
  const P = (style) => (drawn ? "" : ` data-p style="${style}"`);
  const stop = (cls) => `<radialGradient id="${id}-${cls}" cx="0.36" cy="0.3" r="0.85"><stop offset="0" class="fx-s-light"/><stop offset="0.75" class="fx-s-${cls}"/></radialGradient>`;
  // the warmth is new even on a protagonist that arrives drawn, so it keeps its --p
  const warmth = warm && !owned;
  return `<defs>
    ${stop(owned ? "owned" : "body")}${warmth ? stop("owned") : ""}
    <radialGradient id="${id}-floor"><stop offset="0" class="fx-s-shadow"/><stop offset="1" class="fx-s-clear"/></radialGradient>
  </defs>
  <g transform="translate(${n(at[0])} ${n(at[1])})">
    <ellipse class="fx-floor"${P(st.floor || ARRIVE.floor)} fill="url(#${id}-floor)" cx="0" cy="${n(bottom + 0.08 * R)}" rx="${n(1.15 * R)}" ry="${n(0.2 * R)}"/>
    <path class="fx-body"${P(st.body || ARRIVE.body)} fill="url(#${id}-${owned ? "owned" : "body"})" d="${d}"/>
    ${warmth ? `<path class="fx-body" data-p style="${warm}" fill="url(#${id}-owned)" d="${d}"/>` : ""}
    <path class="fx-ink"${P(st.ink || DRAW)} pathLength="1" d="${d}"/>
    <path class="fx-halo"${P(st.halo || st.fit || FIT)} pathLength="1" d="${g}"/>
    <path class="fx-fit"${P(st.fit || FIT)} pathLength="1" d="${g}"/>
  </g>`;
}

// ---- labels ------------------------------------------------------------------
// Where a point of the viewBox [x, y, w, h] falls, as the --x and --y an
// .fx-lb reads, so HTML labels stay on their part at every width.
export const place = (vb, x, y) => `--x:${n(((x - vb[0]) / vb[2]) * 100)}%;--y:${n(((y - vb[1]) / vb[3]) * 100)}%`;
// a label arrives when its part finishes, at a, rising 4px over 0.05
export const label = (a) => `opacity:calc(0.01 + 0.99 * ${c(a, a + 0.05)});translate:var(--tx, -50%) calc(var(--ty, -50%) + 4px * (1 - ${out(a, a + 0.05)}))`;
