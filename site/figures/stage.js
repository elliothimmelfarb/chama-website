// The home page's opening stage: eight beats that play themselves over 28
// seconds (docs/DESIGN.md section 11). The engine's [data-stage] clock writes
// --p on every [data-p] part; each part's rule below turns --p into seconds
// (--t) and draws its own beat from that, so seeking, pausing and the low
// motion stills all come from the one clock. Low motion is the engine's
// stepper over the same eight points, each shown at its data-stage-still.
import { html, raw } from "../html.js";
import { GLYPHS } from "./glyphs.js";

const T = 28;

// The words come from site/content/en/home.js (stageBeats). Each beat is a
// sentence cut into the phrases the stage says one after another.

// When each phrase starts being said, in seconds. The picture's timings
// below are written against these.
const SAID = [
  [0, 1.5],
  [3.5, 4.6],
  [7.0, 8.6],
  [10.5, 11.375, 12.25, 13.125],
  [14.0, 15.0],
  [17.5, 18.1, 18.85, 19.6, 20.35],
  [21.0, 22.4],
  [24.5, 25.6],
];
// The moment each low motion still shows: late in its beat, with the
// picture finished and the phrase that matches it lit.
const STILLS = [2.6, 6.9, 10.2, 11.8, 17.3, 18.6, 24.2, T];
const STATIONS = ["Tell us", "It gets built", "You use it", "What's next"];

// ---- geometry, in the viewBox's units ------------------------------------
const VW = 400, VH = 190, RX = 125, RY = 58;
const f = (n) => +n.toFixed(2);
export const poly = (pts) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L") + " Z";
export const ngon = (r) => [0, 1, 2, 3, 4].map((i) => [r * Math.cos(((i * 72 - 90) * Math.PI) / 180), r * Math.sin(((i * 72 - 90) * Math.PI) / 180)]);
// The outline sits a constant distance outside the shape, mitred at the corners.
export function grow(pts, d) {
  const n = pts.length, norm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return [dy / l, -dx / l]; };
  return pts.map((v, i) => {
    const n1 = norm(pts[(i - 1 + n) % n], v), n2 = norm(v, pts[(i + 1) % n]), k = d / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [v[0] + (n1[0] + n2[0]) * k, v[1] + (n1[1] + n2[1]) * k];
  });
}
const PENT = ngon(40);
// the sixth corner grows out of the upper right edge
const MID = [(PENT[0][0] + PENT[1][0]) / 2, (PENT[0][1] + PENT[1][1]) / 2];
const CORNER = [MID[0] + 15 * 0.588, MID[1] - 15 * 0.809];
const HEX = [PENT[0], CORNER, ...PENT.slice(1)];
const ELLIPSE = (rx, ry) => `M0 ${-ry} A${rx} ${ry} 0 1 1 0 ${ry} A${rx} ${ry} 0 1 1 0 ${-ry}`;
const RING = ELLIPSE(RX, RY);
const rrect = (x, y, w, h, r) => `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;

// ---- the choreography, as CSS read from --p --------------------------------
// w(a, b): 0 before a seconds, 1 after b, linear between.
// e(name): the same window eased (smoothstep), from a --k-name it declares.
const w = (a, b) => `clamp(0, (var(--t) - ${a}) / ${f(b - a)}, 1)`;
const k = (name, a, b) => `--k${name}: ${w(a, b)}; --e${name}: calc(var(--k${name}) * var(--k${name}) * (3 - 2 * var(--k${name})));`;
const e = (name) => `var(--e${name})`;
// draw, then optionally erase and draw again, a path with pathLength 1 and dasharray "1 1"
// (an undrawn path still paints its round cap, so it also hides while nothing of it shows)
const strokeRule = (cls, d1, u1, d2) => `.stage .${cls} { ${k("d", ...d1)} ${u1 ? k("u", ...u1) : ""} ${d2 ? k("r", ...d2) : ""}
  --v: calc(${e("d")}${u1 ? ` - ${e("u")}` : ""}${d2 ? ` + ${e("r")}` : ""});
  stroke-dashoffset: calc(1 - ${e("d")}${u1 ? ` - ${e("u")}` : ""}${d2 ? ` - ${e("r")}` : ""}); opacity: clamp(0, var(--v) * 50, 1); }`;

const scene = `
.stage [data-p], .stage-words { --t: calc(var(--p) * ${T}); }
.stage-sq, .stage-qr { opacity: calc(1 - 0.9 * ${w(3.6, 4.2)} - 0.1 * ${w(7.0, 7.4)}); }
.stage-qr { ${k(1, 1.6, 2.3)} transform: translate(calc(30px * ${e(1)}), 0); }
.stage-qf { ${k(1, 1.6, 2.3)} transform: translate(calc(82px + 61px * ${e(1)}), 0) scale(calc(1 - 0.5 * ${e(1)})); opacity: calc(1 - ${w(1.9, 2.3)}); }
.stage-you { ${k(1, 1.6, 2.3)} ${k(2, 3.7, 4.2)} ${k(3, 4.2, 5.2)} ${k(4, 17.5, 17.9)} ${k(5, 20.2, 20.6)}
  --z: calc(0.25 + 0.75 * ${e(3)} - 0.15 * ${e(4)} + 0.15 * ${e(5)});
  transform: translate(calc(-8px + 30px * ${e(1)} - 22px * ${e(3)}), calc(24px * ${e(2)} * (1 - ${e(3)}))) scale(var(--z)); }
/* the business keeps its line weight at every size it takes */
.stage-you .stage-ink { stroke-width: calc(1.5 * var(--sw) / var(--z)); }
.stage-pent { opacity: calc(1 - ${w(15.6, 15.8)}); }
.stage-hex { opacity: ${w(15.6, 15.8)}; }
.stage-wedge { ${k(1, 15.0, 15.6)} opacity: calc(1 - ${w(15.6, 15.8)});
  transform: translate(${f(MID[0])}px, ${f(MID[1])}px) rotate(36deg) scale(1, calc(0.001 + ${e(1)})) rotate(-36deg) translate(${f(-MID[0])}px, ${f(-MID[1])}px); }
${strokeRule("stage-outp", [5.2, 6.4], [16.0, 16.4])}
${strokeRule("stage-outh", [16.3, 17.2], [17.5, 17.9], [20.4, 20.9])}
${strokeRule("stage-phone", [18.1, 18.45], [18.85, 19.05])}
${strokeRule("stage-laptop", [18.85, 19.2], [19.6, 19.8])}
${strokeRule("stage-cloud", [19.6, 19.95], [20.35, 20.55])}
.stage-people { ${k(1, 7.2, 7.7)} opacity: ${w(7.2, 7.7)}; transform: translate(-82px, 0) scale(calc(0.6 + 0.4 * ${e(1)})); }
${strokeRule("stage-link", [7.8, 8.4])}
${strokeRule("stage-ringm", [8.6, 9.8])}
.stage-ticks { ${k(1, 24.5, 26)} opacity: ${w(9.3, 9.9)}; stroke-dashoffset: calc(-0.04 * min(var(--t), 24.5) - 0.03 * ${e(1)}); }
.stage-stations { opacity: ${w(10.5, 10.9)}; }
.stage-mk { ${k(1, 15.6, 16.6)} --s: calc(${w(10.5, 14)} + ${e(1)}); opacity: calc(${w(10.5, 10.8)} * (1 - ${w(17.4, 17.8)})); }
.stage-head { stroke-dashoffset: calc(-1 * var(--s)); }
.stage-tail { stroke-dashoffset: calc(0.05 - var(--s)); }
.stage-trail { stroke-dashoffset: calc(0.11 - var(--s)); }
.stage-lrn { ${k(1, 22.4, 23)} ${k(2, 26.0, 26.7)} opacity: calc(${w(22.4, 22.9)} * (1 - ${w(26.2, 26.6)}));
  transform: translate(calc(165px * (1 - ${e(2)})), calc(-60px * (1 - ${e(2)}))) scale(calc((0.6 + 0.4 * ${e(1)}) * (1 - 0.5 * ${e(2)}))); }
${strokeRule("stage-lrnm", [22.9, 24.0])}
.stage-loop { ${k(1, 26.0, 26.7)} opacity: calc(1 - ${w(26.2, 26.7)}); transform: translate(calc(-110px * ${e(1)}), 0) scale(calc(1 - 0.81 * ${e(1)})); }
.stage-gl { --x: 0px; --a: 26.35; --k1: clamp(0, (var(--t) - var(--a)) / 0.5, 1); --e1: calc(var(--k1) * var(--k1) * (3 - 2 * var(--k1)));
  opacity: var(--k1); transform: translate(var(--x), 0) scale(calc(1.25 - 0.25 * ${e(1)})); }
.stage-gl1 { --x: -110px; }
.stage-gl3 { --x: 110px; --a: 26.5; }
.stage-lb { --on: calc(clamp(0, (var(--t) - var(--a)) / 0.12 + 1, 1) * (1 - clamp(0, (var(--t) - var(--a) - 0.875) / 0.12 + 1, 1)));
  opacity: calc(${w(10.5, 10.9)} * (1 - ${w(26.0, 26.4)})); color: color-mix(in srgb, var(--fg) calc(var(--on) * 100%), var(--fg-2)); }
.stage-say { opacity: calc(clamp(0, (var(--t) - var(--s)) * 100 + 1, 1) * (1 - clamp(0, (var(--t) - var(--e)) / 0.25 + 1, 1))); }
.stage-ph { --in: clamp(0, (var(--t) - var(--r)) / 0.35, 1);
  --on: calc(clamp(0, (var(--t) - var(--a)) / 0.12 + 1, 1) * (1 - clamp(0, (var(--t) - var(--b)) / 0.12 + 1, 1)));
  opacity: var(--in); transform: translateY(calc((1 - var(--in)) * 0.3em));
  color: color-mix(in srgb, var(--fg) calc(var(--on) * 100%), var(--fg-2)); font-weight: calc(500 + 100 * var(--on)); }
.stage-fill { transform: scaleX(var(--p)); }
`;

const CSS = `
.stage { position: relative; margin: var(--s5) 0 0; height: clamp(14rem, 40svh, 22rem); display: flex; flex-direction: column; gap: var(--s2); }
.stage-words { display: grid; margin: 0; font: 500 var(--t-stage)/1.3 var(--display); letter-spacing: -0.01em; color: var(--fg-2); max-width: 32ch; }
.stage-say { grid-area: 1 / 1; margin: 0; }
.stage-ph { display: inline-grid; }
.stage-ph > span, .stage-ph::after { grid-area: 1 / 1; }
/* each phrase keeps the width of its bold self, so lighting it never rewraps the line */
.stage-ph::after { content: attr(data-t); font-weight: 600; visibility: hidden; }
.stage-pic { flex: 1; min-height: 0; container-type: size; display: grid; place-items: center; }
.stage-box { position: relative; width: min(82cqw, 100cqh * ${VW} / ${VH}); aspect-ratio: ${VW} / ${VH}; container: stage-box / inline-size; }
/* Strokes scale with the picture, because Chrome misplaces pathLength dashes
   under vector-effect: non-scaling-stroke. --sw holds them near their pixel
   widths at each size of the box. */
.stage-fig { --sw: 1.67; position: static; translate: none; display: block; width: 100%; height: 100%; overflow: visible; }
@container stage-box (min-width: 280px) { .stage-fig { --sw: 1.33; } }
@container stage-box (min-width: 360px) { .stage-fig { --sw: 1.05; } }
@container stage-box (min-width: 440px) { .stage-fig { --sw: 0.9; } }
.stage-ink { fill: color-mix(in srgb, var(--fg) 7%, transparent); stroke: var(--fg); stroke-width: calc(1.5 * var(--sw)); stroke-linejoin: round; }
.stage-sq { fill: color-mix(in srgb, var(--fg-2) 10%, transparent); stroke: var(--fg-2); stroke-width: calc(1.5 * var(--sw)); }
.stage-hot { fill: none; stroke: var(--accent); stroke-width: calc(2 * var(--sw)); stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1 1; }
.stage-ring { fill: none; stroke: var(--fg); stroke-opacity: 0.4; stroke-width: calc(1.25 * var(--sw)); stroke-dasharray: 2 6; stroke-linecap: round; }
.stage-ticks { fill: none; stroke: var(--fg); stroke-width: calc(2.5 * var(--sw)); stroke-linecap: round; stroke-dasharray: 0.012 0.113; }
.stage-mask { fill: none; stroke: var(--fg); stroke-width: 16; stroke-dasharray: 1 1; }
.stage-people { fill: var(--fg); }
.stage-stations circle { fill: var(--bg); stroke: var(--fg); stroke-width: calc(1.5 * var(--sw)); }
.stage-link { fill: none; stroke: var(--fg); stroke-width: calc(1.25 * var(--sw)); stroke-dasharray: 1 1; }
.stage-mk { fill: none; stroke: var(--accent); stroke-linecap: round; }
.stage-head { stroke-width: calc(7 * var(--sw)); stroke-dasharray: 0.001 0.999; }
.stage-tail { stroke-width: calc(3 * var(--sw)); stroke-dasharray: 0.05 0.95; }
.stage-trail { stroke-width: calc(3 * var(--sw)); stroke-dasharray: 0.11 0.89; stroke-opacity: 0.35; }
.stage-gl { color: var(--fg); }
.stage-lb { position: absolute; font: 600 var(--t-label)/1.2 var(--text); letter-spacing: 0.01em; white-space: nowrap; }
.stage-lb0 { left: 50%; bottom: calc(50% + ${f((RY / VH) * 100)}% + 8px); translate: -50% 0; }
.stage-lb1 { left: calc(50% + ${f((RX / VW) * 100)}% + 10px); top: 50%; translate: 0 -50%; }
.stage-lb2 { left: 50%; top: calc(50% + ${f((RY / VH) * 100)}% + 8px); translate: -50% 0; }
.stage-lb3 { right: calc(50% + ${f((RX / VW) * 100)}% + 10px); top: 50%; translate: 0 -50%; }

.stage-ctl, .stage-step { flex: none; display: flex; align-items: center; gap: var(--s3); height: 44px; }
.stage-btn { flex: none; display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: var(--r-pill); background: var(--surface); color: var(--fg); box-shadow: inset 0 0 0 1px var(--line-strong); cursor: pointer; transition: box-shadow var(--dur-quick) var(--ease-out), scale var(--dur-press) var(--ease-out); }
.stage-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
.stage-btn:active { scale: 0.97; }
.stage-btn[aria-disabled="true"] { color: var(--fg-2); box-shadow: inset 0 0 0 1px var(--line); cursor: default; }
.stage-bar { position: relative; flex: 1; height: 44px; }
.stage-track { position: absolute; inset: 20px 0 auto; height: 4px; overflow: hidden; background: color-mix(in srgb, var(--fg) 14%, transparent);
  --seg: calc((100% - 28px) / 8);
  -webkit-mask: repeating-linear-gradient(90deg, var(--fg) 0 var(--seg), transparent 0 calc(var(--seg) + 4px));
  mask: repeating-linear-gradient(90deg, var(--fg) 0 var(--seg), transparent 0 calc(var(--seg) + 4px)); }
.stage-fill { display: block; height: 100%; background: var(--accent); transform-origin: left; }
.stage-segs { position: absolute; inset: 0; display: flex; gap: 4px; }
.stage-seg { flex: 1; min-width: 0; padding: 0; border: 0; background: transparent; cursor: pointer; }
.stage-seg:focus-visible { outline-offset: -8px; }
/* the stepper names the beat in play beside the engine's "N of M" */
.stage-name { display: none; }
.stage-name1, ${[2, 3, 4, 5, 6, 7, 8].map((n) => `.stage:has(.stage-seg:nth-child(${n})[aria-current]) .stage-name${n}`).join(", ")} { display: inline; }
.stage:has(.stage-seg[aria-current]:not(:first-child)) .stage-name1 { display: none; }
.stage-count { flex: 1; margin: 0; text-align: center; font-size: var(--t-small); line-height: 1.3; color: var(--fg-2); font-variant-numeric: tabular-nums; }
@media (hover: hover) { .stage-btn:not([aria-disabled="true"]):hover { box-shadow: inset 0 0 0 1px var(--fg-2); } }

/* without the engine there is nothing to drive the controls, so they hide;
   in low motion the stepper stands in for the bar */
.stage:not([data-state]) :is(.stage-ctl, .stage-step), .stage-step,
html[data-motion="low"] .stage-ctl { display: none; }
html[data-motion="low"] .stage[data-state] .stage-step { display: flex; }
html[data-motion="low"] .stage-ph { --in: 1; }

/* After the catch the glyphs live in the doors, and the stage keeps the loop
   as a quiet still behind Replay. */
.stage[data-caught] .stage-gl { opacity: 0 !important; }
.stage[data-caught] .stage-loop { opacity: 0.4 !important; transform: none !important; transition: opacity 600ms var(--ease-out); }

@media (min-width: 1100px) {
  .stage { grid-column: 8 / span 5; margin: 0; height: auto; gap: var(--s4); container-type: inline-size; }
  .stage-pic { flex: none; height: calc(100cqw * ${VH} / ${VW}); }
  .stage-box { width: 100cqw; }
}
${scene}
`;

// The doors catch (docs/DESIGN.md, "the doors catch"): while the stage plays,
// the door icons wait (data-catch="wait" on [data-doors], hidden in base.css);
// when it ends, each icon flies from its glyph in the stage to its door.
// A pause, or scrolling past a stage that never played, shows them where they
// are. It watches data-state from document, so a stage the router swaps in
// later is still caught; if this never ran (the page arrived by the router
// first), the icons simply stay shown.
const CATCH = `(function () {
  if (document.documentElement.getAttribute("data-motion") === "low" || window.chamaCatch) return;
  window.chamaCatch = true;
  var io = window.IntersectionObserver && new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var st = e.target;
      if (st.getAttribute("data-state") === "idle" && e.boundingClientRect.top < 0 && e.intersectionRatio < 0.6) set(st, "off");
    });
  }, { threshold: [0, 0.6] });
  function doorsOf(st) { return document.querySelector("[data-doors]"); }
  function set(st, v) { var d = doorsOf(st); if (d) d.setAttribute("data-catch", v); }
  function fly(st) {
    var d = doorsOf(st), moves = [];
    st.setAttribute("data-caught", "");
    if (!d || d.getAttribute("data-catch") !== "wait") return;
    [].forEach.call(st.querySelectorAll("[data-door]"), function (g) {
      var to = d.querySelector('[data-door="' + g.getAttribute("data-door") + '"] .g'), from = g.querySelector("svg");
      if (!to || !from) return;
      var a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      if (b.top < 0 || b.bottom > innerHeight || a.bottom < 0 || a.top > innerHeight) return;
      moves.push([to, a.left + a.width / 2 - b.left - b.width / 2, a.top + a.height / 2 - b.top - b.height / 2, a.width / b.width]);
    });
    // under reduced motion the icons fade in where they are (data-catch="off")
    var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    d.setAttribute("data-catch", moves.length && !still ? "caught" : "off");
    if (still) return;
    var cs = getComputedStyle(document.documentElement), dur = parseFloat(cs.getPropertyValue("--dur-carry")) || 700, gap = parseFloat(cs.getPropertyValue("--stagger-ms")) || 50;
    moves.forEach(function (m, i) {
      if (m[0].animate) m[0].animate([{ transform: "translate(" + m[1] + "px, " + m[2] + "px) scale(" + m[3] + ")" }, { transform: "none" }],
        { duration: dur, delay: i * gap, easing: cs.getPropertyValue("--ease-in-out").trim(), fill: "backwards" });
    });
  }
  function change(st) {
    var s = st.getAttribute("data-state"), was = st.chamaWas;
    st.chamaWas = s;
    if (s !== "ended") st.removeAttribute("data-caught");
    if (s === "idle") { set(st, "wait"); if (io) io.observe(st); }
    else if (s === "playing" && (was === "idle" || was === "ended")) set(st, "wait");
    else if (s === "paused") set(st, "off");
    else if (s === "ended" && was) fly(st);
  }
  new MutationObserver(function (list) {
    list.forEach(function (m) { if (m.target.hasAttribute("data-stage")) change(m.target); });
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
})();`;

const ICON = {
  play: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M6 4.2v9.6l8-4.8z"/></svg>`,
  pause: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M6.5 4v10M11.5 4v10"/></svg>`,
  replay: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9a5 5 0 1 0 1.6-3.7M4 3.2v3h3"/></svg>`,
  prev: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M11 4 6 9l5 5"/></svg>`,
  next: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m7 4 5 5-5 5"/></svg>`,
};

// A door glyph, drawn inside the stage at a glyph's spot.
const glyph = (id, n) =>
  `<g class="stage-gl stage-gl${n}" data-p data-door="${id}">${String(GLYPHS[id]).replace('<svg class="g"', '<svg class="g" x="-28" y="-28" width="56" height="56"')}</g>`;

const FIG = `<svg class="stage-fig" viewBox="${-VW / 2} ${-VH / 2} ${VW} ${VH}" aria-hidden="true" focusable="false">
  <defs>
    <mask id="stage-ring-m" style="mask-type: alpha" maskUnits="userSpaceOnUse" x="-200" y="-100" width="400" height="200"><path class="stage-mask stage-ringm" data-p pathLength="1" d="${RING}"/></mask>
    <mask id="stage-lrn-m" style="mask-type: alpha" maskUnits="userSpaceOnUse" x="-40" y="-25" width="80" height="50"><path class="stage-mask stage-lrnm" data-p pathLength="1" d="${ELLIPSE(27, 14)}"/></mask>
  </defs>
  <rect class="stage-sq" data-p x="110" y="-33" width="66" height="66" rx="3"/>
  <path class="stage-ink stage-qf" data-p d="${poly(ngon(10))}"/>
  <g class="stage-qr" data-p>${[52, 22, -38].map((x) => `<path class="stage-ink" transform="translate(${x} 0)" d="${poly(ngon(10))}"/>`).join("")}</g>
  <g class="stage-loop" data-p>
    <g mask="url(#stage-ring-m)"><path class="stage-ring" d="${RING}"/><path class="stage-ticks" data-p pathLength="1" d="${RING}"/></g>
    <g class="stage-stations" data-p>${[[0, -RY], [RX, 0], [0, RY], [-RX, 0]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5"/>`).join("")}</g>
    <g class="stage-people" data-p><circle cy="-14" r="3.5"/><circle r="3.5"/><circle cy="14" r="3.5"/></g>
    <path class="stage-link" data-p pathLength="1" d="M-78 -1 L-39 -11"/>
    <g class="stage-you" data-p>
      <path class="stage-ink stage-pent" data-p d="${poly(PENT)}"/>
      <path class="stage-ink stage-hex" data-p d="${poly(HEX)}"/>
      <path class="stage-ink stage-wedge" data-p d="M${f(PENT[0][0])} ${f(PENT[0][1])} L${f(CORNER[0])} ${f(CORNER[1])} L${f(PENT[1][0])} ${f(PENT[1][1])}"/>
    </g>
    <path class="stage-hot stage-outp" data-p pathLength="1" d="${poly(grow(PENT, 9))}"/>
    <path class="stage-hot stage-outh" data-p pathLength="1" d="${poly(grow(HEX, 9))}"/>
    <path class="stage-hot stage-phone" data-p pathLength="1" d="${rrect(-34, -48, 68, 94, 10)} M-8 37 H8"/>
    <path class="stage-hot stage-laptop" data-p pathLength="1" d="${rrect(-56, -46, 112, 76, 5)} M-68 38 H68"/>
    <path class="stage-hot stage-cloud" data-p pathLength="1" transform="scale(1.15)" d="M-50 34 H48 C66 34 74 18 70 4 C66 -10 52 -14 42 -10 C40 -30 22 -42 2 -40 C-18 -38 -28 -24 -30 -14 C-46 -20 -66 -8 -64 10 C-62 26 -56 34 -50 34 Z"/>
    <path class="stage-mk stage-trail" data-p pathLength="1" d="${RING}"/>
    <path class="stage-mk stage-tail" data-p pathLength="1" d="${RING}"/>
    <path class="stage-mk stage-head" data-p pathLength="1" d="${RING}"/>
  </g>
  <g class="stage-lrn" data-p>
    <path class="stage-ink" d="${poly(ngon(12))}"/>
    <path class="stage-ring" mask="url(#stage-lrn-m)" d="${ELLIPSE(27, 14)}" style="stroke-dasharray: 1.5 4"/>
  </g>
  ${glyph("engineering-department", 1)}${glyph("coaching", 2)}${glyph("build", 3)}
</svg>`;

export function stage({ label, beats }) {
  beats.forEach((b, i) => {
    if (b.say.length !== SAID[i].length) throw new Error(`stage beat ${i + 1} has ${b.say.length} phrases; its timing has ${SAID[i].length}`);
  });
  const end = (i) => (i === beats.length - 1 ? 99 : SAID[i + 1][0]);
  const words = beats.map((b, i) => {
    const phrases = b.say.map((ph, j) => {
      const a = SAID[i][j], next = j + 1 < b.say.length ? SAID[i][j + 1] : end(i);
      const r = i === 0 ? -1 : a;
      return html`<span class="stage-ph" style="--r:${r};--a:${a};--b:${next}" data-t="${ph}"><span>${ph}</span></span>`;
    });
    return html`<p class="stage-say" style="--s:${SAID[i][0]};--e:${end(i)}">${phrases.flatMap((p, j) => (j ? [" ", p] : [p]))}</p>`;
  });
  return html`<figure class="stage" data-stage data-duration="${T}" data-delay="1.4" tabindex="-1" aria-label="${label}">
  <style>${raw(CSS)}</style>
  <div class="stage-words" data-p>${words}</div>
  <div class="stage-pic"><div class="stage-box">
    ${raw(FIG)}
    ${STATIONS.map((s, i) => html`<span class="stage-lb stage-lb${i}" data-p style="--a:${SAID[3][i]}" aria-hidden="true">${s}</span>`)}
  </div></div>
  <div class="stage-ctl">
    <button class="stage-btn" type="button" data-stage-action="play" aria-label="Play">${raw(ICON.play)}</button>
    <button class="stage-btn" type="button" data-stage-action="pause" aria-label="Pause">${raw(ICON.pause)}</button>
    <button class="stage-btn" type="button" data-stage-action="replay" aria-label="Play again">${raw(ICON.replay)}</button>
    <div class="stage-bar">
      <div class="stage-track" aria-hidden="true"><i class="stage-fill" data-p></i></div>
      <div class="stage-segs">${beats.map((b, i) => html`<button class="stage-seg" type="button" data-stage-seek="${i / beats.length}" data-stage-still="${+(STILLS[i] / T).toFixed(3)}" aria-label="Scene ${i + 1} of ${beats.length}: ${b.name}"></button>`)}</div>
    </div>
  </div>
  <div class="stage-step">
    <button class="stage-btn" type="button" data-stage-step="-1" aria-label="Previous scene" aria-disabled="true">${raw(ICON.prev)}</button>
    <p class="stage-count" aria-live="polite"><span data-stage-count>1 of ${beats.length}</span> · ${beats.map((b, i) => html`<span class="stage-name stage-name${i + 1}">${b.name}</span>`)}</p>
    <button class="stage-btn" type="button" data-stage-step="1" aria-label="Next scene">${raw(ICON.next)}</button>
  </div>
  <noscript><style>
    .stage { height: auto; }
    .stage-words { display: block; max-width: 40ch; margin: 0; padding-left: 1.2em; }
    .stage-say { display: list-item; opacity: 1; }
    .stage-say + .stage-say { margin-top: var(--s2); }
    .stage-ph { opacity: 1; transform: none; color: var(--fg-2); font-weight: 500; }
    .stage-pic { display: none; }
  </style></noscript>
  <script>${raw(CATCH)}</script>
</figure>`;
}
