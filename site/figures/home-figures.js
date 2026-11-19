// The home page's three scroll figures,
// in the figure language of site/figures/kit.js, drawn as technical drawings
// (Elliot's pick, 2026-11-17): paper bodies in ink, hatched where owned,
// construction lines, a ground line, corner marks and a figure number. They share one viewBox and
// one protagonist at one size and place, so the business in "what we can
// do" stands exactly where "what we believe" left it and arrives drawn.
//   belief    the five reasons are the business's five sides: the fit draws
//             round it one side at a time, then the business warms.
//   canDo     the same business; something it has never seen arrives dashed
//             and is solved too, then a step comes up under both of them.
//   approach  one person, two paths to the business: one draws its fit
//             (done for you), the other its own ring (taught).
import { html, raw } from "../html.js";
import { subject, fills, pent, grow, poly, c, ss, out, n, place, label, FIT_GAP, WARM } from "./kit.js";

const VB = [-300, -190, 600, 400];
const R = 130;
const PENT = pent(R);
const FIT = grow(PENT, FIT_GAP * R);
const FLOOR_Y = Math.max(...PENT.map((p) => p[1]));
const FIT_Y = Math.max(...FIT.map((p) => p[1]));

// On a phone a figure shows only the part of the viewBox it draws in (its
// callouts are gone), so the business stays near the old site's phone size.
const PHONE_CROP = { belief: [-190, -165, 380, 330], cando: [-200, -200, 500, 340] };
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
/* the step is a plinth drawn in hairlines, its top face lit like a body */
.hfx-top { fill: var(--fx-light); stroke: var(--line-strong); stroke-width: calc(1px * var(--sw)); stroke-linejoin: round; }
.hfx-front { fill: var(--fx-platform); stroke: var(--line-strong); stroke-width: calc(1px * var(--sw)); }
.hfx-path { fill: none; stroke: var(--fx-ink-2); stroke-width: calc(1.25px * var(--sw)); stroke-linecap: round; }
/* the technical drawing: a paper body in ink, hatched in ember once it is
   owned; the floor shadow gives way to a ground line */
.hfx { --fx-body: color-mix(in srgb, var(--fg) 8%, var(--ground, var(--bg))); }
/* a dark ground is darker than the sky over it, so a body mixed from it
   reads as a hole there */
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .hfx { --fx-body: color-mix(in srgb, var(--fg) 15%, var(--ground, var(--bg))); } }
:root[data-theme="dark"] .hfx { --fx-body: color-mix(in srgb, var(--fg) 15%, var(--ground, var(--bg))); }
.hfx-approach .fx-halo { stroke-width: calc(4px * var(--sw)); }
.hfx .fx-body { fill: var(--fx-body); }
/* nothing passes behind the business in Fig. 2, and on a marbled ground
   the halo reads as a band round the fit */
.hfx-cando .fx-halo { display: none; }
.hfx .fx-ink { stroke: color-mix(in srgb, var(--fx-ink) 85%, transparent); }
.hfx-belief .fx-body[fill*="-owned"] { fill: url(#hfx-hatch-bl); }
.hfx-cando .fx-body[fill*="-owned"] { fill: url(#hfx-hatch-cd); }
.hfx-approach .fx-body[fill*="-owned"] { fill: url(#hfx-hatch-ap); }
.hfx .fx-floor { display: none; }
.hfx .fx-plat { fill: none; stroke: var(--line-strong); stroke-width: calc(1px * var(--sw)); stroke-dasharray: calc(3px * var(--sw)) calc(5px * var(--sw)); }
.hfx .hfx-person { fill: var(--fx-body); stroke: var(--fx-ink); stroke-width: calc(1.75px * var(--sw)); stroke-linejoin: round; }
.hfx .fx-ring.is-yours { stroke: var(--accent); stroke-opacity: 1; stroke-width: calc(2.25px * var(--sw)); }
.hfx-con { fill: none; stroke: color-mix(in srgb, var(--fg) 32%, transparent); stroke-width: calc(1px * var(--sw)); }
.hfx-faint { opacity: 0.5; }
.hfx-axis { stroke-dasharray: calc(16px * var(--sw)) calc(4px * var(--sw)) calc(2px * var(--sw)) calc(4px * var(--sw)); }
.hfx-dash { stroke-dasharray: calc(3px * var(--sw)) calc(5px * var(--sw)); }
.hfx-ground { fill: none; stroke: var(--fx-ink); stroke-width: calc(1.25px * var(--sw)); }
.hfx .hfx-front { fill: url(#hfx-ink-hatch-cd); stroke: var(--fx-ink); }
.hfx .hfx-top { fill: var(--fx-halo); stroke: var(--fx-ink); }
.hfx-hatch-e { stroke: var(--accent); stroke-width: 0.75; stroke-opacity: 0.55; }
.hfx-hatch-i { stroke: color-mix(in srgb, var(--fg) 40%, transparent); stroke-width: 0.75; }
.hfx-hatch-bg { fill: var(--fx-body); }
/* the sheet: corner marks at the box's corners and the figure's number */
.hfx::after { content: ""; position: absolute; inset: 0; pointer-events: none; --m: 14px; --c: var(--line-strong);
  background:
    linear-gradient(var(--c), var(--c)) 0 0 / var(--m) 1px, linear-gradient(var(--c), var(--c)) 0 0 / 1px var(--m),
    linear-gradient(var(--c), var(--c)) 100% 0 / var(--m) 1px, linear-gradient(var(--c), var(--c)) 100% 0 / 1px var(--m),
    linear-gradient(var(--c), var(--c)) 0 100% / var(--m) 1px, linear-gradient(var(--c), var(--c)) 0 100% / 1px var(--m),
    linear-gradient(var(--c), var(--c)) 100% 100% / var(--m) 1px, linear-gradient(var(--c), var(--c)) 100% 100% / 1px var(--m);
  background-repeat: no-repeat; }
/* the title block in the bottom right corner: the figure's number and name */
.hfx-tb { position: absolute; right: 0; bottom: 0; display: flex; font: 600 0.6875rem/1 var(--text); letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-2); font-variant-numeric: tabular-nums; box-shadow: inset 0 0 0 1px var(--line-strong); }
.hfx-tb > * { padding: 7px 10px; }
.hfx-tb b { color: var(--fg); box-shadow: 1px 0 var(--line-strong); }
/* annotation: small capitals, numbered */
.hfx .fx-lb { font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; }
.hfx-belief { --call: 44px; }
.hfx-n { margin-right: 0.6em; color: var(--fg-2); font-variant-numeric: tabular-nums; }
/* on a phone the line under the heading names the reasons, so the callouts go */
@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  /* the callouts keep only their numbers; the line under the heading,
     numbered to match, names the reasons */
  .hfx .fx-lb { font-size: 0.6875rem; }
  .hfx-belief { --call: 16px; }
  .hfx .fx-lb.is-wide { font-size: 0; letter-spacing: 0; }
  .hfx .fx-lb.is-wide .hfx-n { margin: 0; font-size: 0.75rem; letter-spacing: 0.04em; color: inherit; }
  .hfx-tb { display: none; }
  ${Object.entries(PHONE_CROP).map(([cls, box]) => crop(cls, box)).join("\n  ")}
}
`;

const svg = (body) => `<svg class="fx-svg" viewBox="${VB.join(" ")}" aria-hidden="true" focusable="false">${body}</svg>`;
const lb = (text, at, style, cls = "") => html`<span class="fx-lb ${cls}" data-p style="${place(VB, ...at)};${style}" aria-hidden="true">${text}</span>`;
const fx = (cls, [fig, name], body, labels) => html`<figure class="fx hfx ${cls}"><div class="hfx-in">${raw(svg(body))}${labels}</div><span class="hfx-tb" aria-hidden="true"><b>${fig}</b><span>${name}</span></span></figure>`;

// ---- the drawing's furniture: still, so it costs nothing a frame -------------
// the hatch patterns: ember for an owned body; ink for a cut face, which only Fig. 2 has
const hatches = (id, { cut = false } = {}) => `<defs><pattern id="hfx-hatch-${id}" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hfx-hatch-bg" width="9" height="9"/><line class="hfx-hatch-e" x1="0" y1="0" x2="0" y2="9"/></pattern>${cut ? `
  <pattern id="hfx-ink-hatch-${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hfx-hatch-bg" width="6" height="6"/><line class="hfx-hatch-i" x1="0" y1="0" x2="0" y2="6"/></pattern>` : ""}</defs>`;
// centre lines through the business, its centre mark, and the dashed
// circle it is constructed on
const construct = (cx, cy, { circle = false, reach = 1.15 } = {}) => {
  const ry = R * 0.86;
  return `<path class="hfx-con hfx-axis" d="M${n(cx - R * reach)} ${cy} H${n(cx + R * reach)} M${cx} ${n(cy - ry * reach)} V${n(cy + ry * reach)}"/>`
    +  (circle ? `<ellipse class="hfx-con hfx-dash hfx-faint" cx="${cx}" cy="${cy}" rx="${R}" ry="${n(ry)}"/>` : "");
};
// the ground: a line with its hatch under it
const ground = (x1, x2, y) => {
  let ticks = "";
  for (let x = x1 + 6; x < x2; x += 12) ticks += `M${x} ${n(y + 1)} l-7 7 `;
  return `<path class="hfx-ground" d="M${x1} ${y} H${x2}"/><path class="hfx-con" d="${ticks.trim()}"/>`;
};


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

export function beliefFigure(reasons, title) {
  // the business stands from the start of the hold; only its fit, side by
  // side, and the reasons draw
  const body = hatches("bl") + construct(0, 0, { circle: true }) + ground(-250, 250, n(FIT_Y + 1))
    + subject({ id: "bl", R, drawn: true, warm: WARM, outline: false })
    + sides.map((s, k) => `<path class="fx-fit" data-p pathLength="1" d="${s.d}" style="${stroke(...SIDE(k))};scale:calc(1.03 - 0.03 * ${out(0.62, 0.72)})"/>`).join("");
  // each reason is one element: the word, with its dot and hairline drawn
  // back to the side from it (.hfx-call), so a callout costs one restyle
  const labels = sides.map((s, k) => {
    // the leader's length is --call, shorter on a phone (STYLE)
    const a = SIDE(k)[1] - 0.03, rad = (s.ang * Math.PI) / 180, cx = n(Math.cos(rad)), cy = n(Math.sin(rad));
    const x = `${cx} * var(--call)`, y = `${cy} * var(--call)`;
    const at = Math.abs(cx) < 0.1
      ? `--tx:-50%;--ty:calc(${y} + 2px);--ax:50%;--ay:calc(-1 * (${y} + 2px))`
      : cx > 0
        ? `--tx:calc(${x} + 6px);--ty:calc(${y} - 50%);--ax:calc(-1 * (${x} + 6px));--ay:calc(50% - ${y})`
        : `--tx:calc(${x} - 6px - 100%);--ty:calc(${y} - 50%);--ax:calc(100% - ${x} + 6px);--ay:calc(50% - ${y})`;
    return lb(html`<span class="hfx-n">0${k + 1}</span>${reasons[k]}`, s.mid, `${at};--ang:${n(s.ang)}deg;--len:var(--call);${label(a)}`, `hfx-call is-wide ${k < 3 ? "is-live" : "is-hot"}`);
  });
  return fx("hfx-belief", ["Fig. 1", title], body, labels);
}

// ---- what we can do, with day one ---------------------------------------------
// The business continues whole from the belief and warm. Something new
// arrives dashed beside it and is solved (its own fit draws, then it turns
// solid); then a step comes up under both and they rise on it together.
const RISE = 26;
const rise = `translate:0 calc(${-RISE}px * ${ss(0.56, 0.68)})`;
// the new thing: an irregular shape it has never seen, standing on the same floor
const NEW = [[-40, -30], [-5, -48], [38, -22], [46, 20], [8, 34], [-42, 26]].map(([x, y]) => [x + 222, y + FLOOR_Y - 34]);
// its fit draws from the top vertex, so a half-drawn fit never hooks
const NEW_FIT = (([a, ...rest]) => [...rest, a])(grow(NEW, 7));
const NEW_FIT_RIGHT = Math.max(...NEW_FIT.map((p) => p[0]));
// on a phone "Something new" sits close over its shape's right edge, so it
// names that shape and not the business beside it
const FRESH_PHONE = `@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  .hfx-cando .fx-lb.hfx-fresh { left: ${n(((NEW_FIT_RIGHT - VB[0]) / VB[2]) * 100)}%; top: ${n(((NEW[1][1] - RISE - 14 - VB[1]) / VB[3]) * 100)}%; --ty: -100%;
    width: 7.5em; white-space: normal; text-align: right; line-height: 1.3; }
  /* two labels need no numbers, and there is no room for them here */
  .hfx-cando .hfx-n { display: none; }
}`;
const NEW_FLOOR = [222, FLOOR_Y + 8];
const slide = (a) => `translate:calc(48px * (1 - ${out(a, a + 0.12)})) calc(${-RISE}px * ${ss(0.56, 0.68)})`;
// the step: its top face, and a front face that grows up from the ground
// the business's fit stands on the top face's back edge
const TOP_Y = FIT_Y + 48 - RISE;
const TOP = `M-160 ${n(TOP_Y - 48)} H282 L272 ${n(TOP_Y)} H-170 Z`;
const FRONT = `M-170 ${n(TOP_Y)} H272 V${n(TOP_Y + RISE)} H-170 Z`;

export function canDoFigure({ fresh, dayOne }, title) {
  const keep = { floor: rise, body: rise, ink: rise, halo: rise, fit: rise };
  const body = `${hatches("cd", { cut: true })}${construct(0, 0)}<defs><radialGradient id="cd-new-body" cx="0.36" cy="0.3" r="0.85"><stop offset="0" class="fx-s-light"/><stop offset="0.75" class="fx-s-body"/></radialGradient></defs>
  <path class="hfx-top" data-p d="${TOP}" style="opacity:${c(0.48, 0.56)};translate:0 calc(${RISE}px * (1 - ${ss(0.56, 0.68)}))"/>
  <path class="hfx-front" data-p d="${FRONT}" style="opacity:${c(0.5, 0.56)};transform-box:fill-box;transform-origin:bottom;scale:1 calc(0.001 + 0.999 * ${ss(0.56, 0.68)})"/>
  ${subject({ id: "cd", R, owned: true, st: keep })}
  <ellipse class="fx-floor" data-p fill="${fills("cd").floor}" cx="${NEW_FLOOR[0]}" cy="${n(NEW_FLOOR[1])}" rx="54" ry="10" style="opacity:${c(0.1, 0.18)};${slide(0.1)}"/>
  <path class="fx-body" data-p fill="url(#cd-new-body)" d="${poly(NEW)}" style="opacity:${c(0.34, 0.42)};${rise}"/>
  <path class="fx-ink hfx-new" data-p d="${poly(NEW)}" style="opacity:calc(0.8 * ${c(0.1, 0.18)} * (1 - ${c(0.36, 0.42)}));${slide(0.1)}"/>
  <path class="fx-ink" data-p d="${poly(NEW)}" style="opacity:${c(0.36, 0.42)};${rise}"/>
  <path class="fx-fit" data-p pathLength="1" d="${poly(NEW_FIT)}" style="${stroke(0.24, 0.38)};${rise}"/>`;
  const labels = [
    // right-aligned to the box's edge, so on a phone it stays clear of the business
    lb(html`<span class="hfx-n">01</span>${fresh}`, [298, NEW[1][1] - RISE - 62], `--tx:-100%;${label(0.22)}`, "is-live hfx-fresh"),
    lb(html`<span class="hfx-n">02</span>${dayOne}`, [49, TOP_Y + RISE + 18], label(0.64), "is-live"),
  ];
  return fx("hfx-cando", ["Fig. 2", title], body, labels);
}

// ---- done for you, and taught -------------------------------------------------
// One person, at the left. Their first path reaches the business's top and
// its marker runs on round the fit, drawing it; the second reaches the
// ground in front of it and its marker draws a ring of the business's own.
const WHO = [-262, 24];
// the ring lies flat on the floor in front of the business
const RING = { cx: 0, cy: n(FLOOR_Y + 18), rx: 190, ry: 44 };
// the person: shoulders standing on the floor and a round head
const PERSON = `M${WHO[0] - 22} ${WHO[1] + 30} C${WHO[0] - 22} ${WHO[1] + 9} ${WHO[0] - 13} ${WHO[1]} ${WHO[0]} ${WHO[1]} C${WHO[0] + 13} ${WHO[1]} ${WHO[0] + 22} ${WHO[1] + 9} ${WHO[0] + 22} ${WHO[1] + 30} Z M${WHO[0] - 13} ${WHO[1] - 19} A13 13 0 1 0 ${WHO[0] + 13} ${WHO[1] - 19} A13 13 0 1 0 ${WHO[0] - 13} ${WHO[1] - 19} Z`;
const RING_D = `M${RING.cx} ${RING.cy + RING.ry} A${RING.rx} ${RING.ry} 0 1 1 ${RING.cx} ${RING.cy - RING.ry} A${RING.rx} ${RING.ry} 0 1 1 ${RING.cx} ${RING.cy + RING.ry}`;
const P1 = `M${WHO[0]} ${WHO[1] - 40} C${WHO[0]} -120 -110 -${n(-FIT[0][1] + 40)} 0 ${n(FIT[0][1])}`;
const P1_LEN = len([[WHO[0], WHO[1] - 40], [WHO[0], -120], [-110, FIT[0][1] - 40], [0, FIT[0][1]]]) * 0.8;
const FIT_LEN = len([...FIT, FIT[0]]);
const P2 = `M${WHO[0] + 22} ${WHO[1] + 20} C${WHO[0] + 40} ${n(RING.cy + RING.ry)} -120 ${n(RING.cy + RING.ry + 6)} 0 ${n(RING.cy + RING.ry)}`;
const P2_LEN = len([[WHO[0] + 22, WHO[1] + 20], [WHO[0] + 40, RING.cy + RING.ry], [-120, RING.cy + RING.ry + 6], [0, RING.cy + RING.ry]]) * 0.8;
const RING_LEN = Math.PI * (3 * (RING.rx + RING.ry) - Math.sqrt((3 * RING.rx + RING.ry) * (RING.rx + 3 * RING.ry)));
// a marker that runs its path from a to b and then the outline from b to e
const runs = (path, f, a, b, e) => `offset-path:path('${path}');offset-rotate:0deg;offset-distance:calc((${n(f)} * ${ss(a, b)} + ${n(1 - f)} * ${ss(b, e)}) * 100%)`;

export function approachFigure([doneForYou, taught], title) {
  const fitD = poly([...FIT, FIT[0]]).replace(/^M/, "L").replace(/ Z$/, "");
  const lap = (d) => d.replace(/^M/, "L");
  const body = `${hatches("ap")}${construct(0, 0, { reach: 1.5 })}<path class="fx-plat" data-p d="${RING_D}" style="opacity:${c(0.5, 0.62)}"/>
  <path class="fx-ring is-yours" data-p pathLength="1" d="${RING_D}" style="${stroke(0.44, 0.6)}"/>
  <path class="hfx-path" data-p pathLength="1" d="${P1}" style="${stroke(0.14, 0.26)}"/>
  <path class="hfx-path" data-p pathLength="1" d="${P2}" style="${stroke(0.32, 0.44)}"/>
  ${ground(WHO[0] - 38, WHO[0] + 38, WHO[1] + 30)}
  <path class="hfx-person" data-p d="${PERSON}" style="opacity:${c(0.04, 0.12)};translate:0 calc(10px * (1 - ${out(0.04, 0.14)}))"/>
  ${subject({ id: "ap", R, drawn: true, warm: WARM, outline: false })}
  <path class="fx-halo" data-p pathLength="1" d="${poly(FIT)}" style="${stroke(0.26, 0.44)};transform-box:fill-box;transform-origin:center;scale:calc(1.035 - 0.035 * ${out(0.62, 0.72)})"/>
  <path class="fx-fit" data-p pathLength="1" d="${poly(FIT)}" style="${stroke(0.26, 0.44)};transform-box:fill-box;transform-origin:center;scale:calc(1.035 - 0.035 * ${out(0.62, 0.72)})"/>
  <circle class="fx-mk" data-p r="7" style="${runs(P1 + " " + fitD, P1_LEN / (P1_LEN + FIT_LEN), 0.14, 0.26, 0.44)};opacity:calc(${c(0.12, 0.17)} * (1 - ${c(0.44, 0.5)}))"/>
  <circle class="fx-mk" data-p r="6" style="${runs(P2 + " " + lap(RING_D), P2_LEN / (P2_LEN + RING_LEN), 0.32, 0.44, 0.6)};opacity:calc(${c(0.3, 0.35)} * (1 - ${c(0.6, 0.66)}))"/>`;
  const labels = [
    lb(html`<span class="hfx-n">01</span>${doneForYou}`, [-120, -165], label(0.22), "is-live"),
    lb(html`<span class="hfx-n">02</span>${taught}`, [-280, n(RING.cy + RING.ry + 18)], `--tx:0%;${label(0.4)}`, "is-live"),
  ];
  return fx("hfx-approach", ["Fig. 3", title], body, labels);
}

export const homeFigureStyle = STYLE + FRESH_PHONE;
