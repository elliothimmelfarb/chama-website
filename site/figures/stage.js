// The home page's opening stage: eight beats that play themselves over 28
// seconds (docs/DESIGN.md section 11). The engine's [data-stage] clock writes
// --p on every [data-p] part; each part's rule below turns --p into seconds
// (--t) and draws its own beat from that, so seeking, pausing and the low
// motion stills all come from the one clock. Low motion is the engine's
// stepper over the same eight points, each shown at its data-stage-still.
// The actors are drawn in the figure language (kit.js, worlds.css): the
// business on its floor with a lit body, the queue on one shadow, the
// software company as a block, the AI system as a ring on a platform.
import { html, raw } from "../html.js";
import { GLYPHS } from "./glyphs.js";
import { poly, pent, grow, FIT_GAP } from "./kit.js";

const T = 28;

// The words come from site/content/en/home.js (stageBeats). Each beat is a
// sentence cut into the phrases it says one after another.

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
const VW = 400, VH = 260, RX = 132, RY = 70;
const f = (n) => +n.toFixed(2);
const R = 44;
const PENT = pent(R);
const BOTTOM = Math.max(...PENT.map((p) => p[1]));
// the sixth corner grows out of the upper right edge, along its normal
const MID = [(PENT[0][0] + PENT[1][0]) / 2, (PENT[0][1] + PENT[1][1]) / 2];
const EDGE = [PENT[1][0] - PENT[0][0], PENT[1][1] - PENT[0][1]];
const EL = Math.hypot(...EDGE);
const CORNER = [MID[0] + (16 * EDGE[1]) / EL, MID[1] - (16 * EDGE[0]) / EL];
const TILT = f((Math.atan2(EDGE[1], EDGE[0]) * 180) / Math.PI);
const HEX = [PENT[0], CORNER, ...PENT.slice(1)];
const GAP = FIT_GAP * R;
// the queue, standing on the software company's ground line
const Q = 15, QY = 22, QPENT = poly(pent(Q));
// the learner, up and to the right of the ring
const LR = 18, LRN = pent(LR), LRN_FIT = poly(grow(LRN, 4)), LRN_AT = [150, -88];
const ELLIPSE = (rx, ry) => `M0 ${-ry} A${rx} ${ry} 0 1 1 0 ${ry} A${rx} ${ry} 0 1 1 0 ${-ry}`;
const RING = ELLIPSE(RX, RY);
const rrect = (x, y, w, h, r) => `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;

// ---- the choreography, as CSS read from --p --------------------------------
// w(a, b): 0 before a seconds, 1 after b, linear between.
// e(name): the same window eased (smoothstep), from a --k-name it declares.
const w = (a, b) => `clamp(0, (var(--t) - ${a}) / ${f(b - a)}, 1)`;
const k = (name, a, b) => `--k${name}: ${w(a, b)}; --e${name}: calc(var(--k${name}) * var(--k${name}) * (3 - 2 * var(--k${name})));`;
const e = (name) => `var(--e${name})`;
// The loop collapses into the first door's glyph at the end (26.0 to 26.7s).
// Each of its parts moves on its own (--eL, --lo), never the loop as a group:
// a group whose transform changes restyles everything inside it each frame
// (pages.md, frame cost). After the catch the loop stays as a still at 40%.
const LOOP = `${k("L", 26.0, 26.7)} --lo: calc(1 - ${w(26.2, 26.7)});`;
const LOOPT = `translate(calc(-110px * var(--eL)), 0) scale(calc(1 - 0.81 * var(--eL)))`;
// draw, then optionally erase and draw again, a path with pathLength 1 and dasharray "1 1"
// (an undrawn path still paints its round cap, so it also hides while nothing of it shows)
const strokeRule = (cls, d1, u1, d2, extra) => `.stage .${cls} { ${k("d", ...d1)} ${u1 ? k("u", ...u1) : ""} ${d2 ? k("r", ...d2) : ""} ${LOOP}
  --v: calc(${e("d")}${u1 ? ` - ${e("u")}` : ""}${d2 ? ` + ${e("r")}` : ""});
  stroke-dashoffset: calc(1 - ${e("d")}${u1 ? ` - ${e("u")}` : ""}${d2 ? ` - ${e("r")}` : ""}); opacity: calc(clamp(0, var(--v) * 50, 1) * var(--lo)); ${extra ?? `transform: ${LOOPT};`} }`;
// The business, and what follows it (its floor, its fit): out of the queue
// to the centre at the old site's scale (1.9) for the turn, then to its
// place in the ring, a little smaller while the outline draws the devices.
const YOU = `${k(1, 1.6, 2.3)} ${k(2, 3.7, 4.2)} ${k(3, 4.2, 5.2)} ${k(6, 7.0, 7.8)} ${k(4, 17.5, 17.9)} ${k(5, 20.2, 20.6)}
  --z: calc(0.3 + 1.6 * ${e(3)} - 0.9 * ${e(6)} - 0.15 * ${e(4)} + 0.15 * ${e(5)});`;
const YOUT = `translate(calc(-13px + 33px * ${e(1)} - 20px * ${e(3)}), calc((${QY}px + 24px * ${e(2)}) * (1 - ${e(3)}))) scale(var(--z))`;
// the fit lands 3.5% large and settles in
const settle = (a, b) => `scale(calc(1.035 - 0.035 * ${w(a, b)}))`;
const LRN_ON = `${w(22.4, 22.9)} * (1 - ${w(26.2, 26.6)})`;
const LRN_MOVE = `${k(1, 22.4, 23)} ${k(2, 26.0, 26.7)}
  translate: calc(${LRN_AT[0]}px * (1 - ${e(2)})) calc(${LRN_AT[1]}px * (1 - ${e(2)})); scale: calc((0.6 + 0.4 * ${e(1)}) * (1 - 0.5 * ${e(2)}));`;
// a station, or its label, is lit while the marker passes it
const ON = `--on: calc(clamp(0, (var(--t) - var(--a)) / 0.12 + 1, 1) * (1 - clamp(0, (var(--t) - var(--a) - 0.875) / 0.12 + 1, 1)));`;

const scene = `
.stage [data-p], .stage-words { --t: calc(var(--p) * ${T}); }
.stage-sq, .stage-qr, .stage-qfloor { opacity: calc(1 - 0.9 * ${w(3.6, 4.2)} - 0.1 * ${w(7.0, 7.4)}); }
.stage-sq { translate: 0 calc(8px * (1 - ${w(0, 0.6)})); }
.stage-qr { ${k(1, 1.6, 2.3)} transform: translate(calc(33px * ${e(1)}), ${QY}px); }
.stage-qf { ${k(1, 1.6, 2.3)} transform: translate(calc(86px + 40px * ${e(1)}), ${QY}px) scale(calc(1 - 0.5 * ${e(1)})); opacity: calc(1 - ${w(1.9, 2.3)}); }
.stage-you, .stage-yf { ${YOU} ${LOOP} transform: ${LOOPT} ${YOUT}; opacity: var(--lo); }
/* the business keeps its line weight at every size it takes */
.stage-you .stage-ink { stroke-width: calc(1.5 * var(--sw) / var(--z)); }
.stage-pent { opacity: calc(1 - ${w(15.6, 15.8)}); }
.stage-hex { opacity: ${w(15.6, 15.8)}; }
.stage-wedge { ${k(1, 15.0, 15.6)} opacity: calc(1 - ${w(15.6, 15.8)});
  transform: translate(${f(MID[0])}px, ${f(MID[1])}px) rotate(${TILT}deg) scale(1, calc(0.001 + ${e(1)})) rotate(${-TILT}deg) translate(${f(-MID[0])}px, ${f(-MID[1])}px); }
${strokeRule("stage-outp", [5.2, 6.4], [16.0, 16.4], null, `${YOU} transform: ${LOOPT} ${YOUT} ${settle(6.4, 6.9)}; stroke-width: calc(2.5 * var(--sw) / var(--z));`)}
${strokeRule("stage-outh", [16.3, 17.2], [17.5, 17.9], [20.4, 20.9], `${YOU} transform: ${LOOPT} ${YOUT} ${settle(17.0, 17.4)}; stroke-width: calc(2.5 * var(--sw) / var(--z));`)}
${strokeRule("stage-phone", [18.1, 18.45], [18.85, 19.05])}
${strokeRule("stage-laptop", [18.85, 19.2], [19.6, 19.8])}
${strokeRule("stage-cloud", [19.6, 19.95], [20.35, 20.55], null, `transform: ${LOOPT} scale(1.15);`)}
/* the devices fill with the software's tint as their outline closes */
.stage-dev { fill: var(--fx-tint); fill-opacity: clamp(0, var(--v) * 1.5 - 0.5, 1); }
.stage-people { ${k(1, 7.2, 7.7)} ${LOOP} opacity: calc(${w(7.2, 7.7)} * var(--lo)); transform: ${LOOPT} translate(-100px, 0) scale(calc(0.6 + 0.4 * ${e(1)})); }
${strokeRule("stage-link", [7.8, 8.4])}
/* the masks that draw the rings stay drawn: one that faded with the loop
   would hide the ring in the still after the catch */
.stage .stage-ringm { ${k("d", 8.6, 9.8)} stroke-dashoffset: calc(1 - ${e("d")}); opacity: clamp(0, ${e("d")} * 50, 1); }
.stage-ringg, .stage-plat { ${LOOP} transform: ${LOOPT}; opacity: var(--lo); }
.stage-plat { opacity: calc(${w(8.6, 9.8)} * var(--lo)); }
.stage-ticks { ${k(1, 24.5, 26)} opacity: ${w(9.3, 9.9)}; stroke-dashoffset: calc(-0.04 * min(var(--t), 24.5) - 0.03 * ${e(1)}); }
.stage-st { ${LOOP} ${ON} opacity: calc(${w(10.5, 10.9)} * var(--lo)); transform: ${LOOPT};
  fill: color-mix(in srgb, var(--accent) calc(var(--on) * 100%), var(--fx-halo)); }
.stage-mk { ${k(1, 15.6, 16.6)} ${LOOP} --s: calc(${w(10.5, 14)} + ${e(1)}); opacity: calc(${w(10.5, 10.8)} * (1 - ${w(17.4, 17.8)}) * var(--lo)); transform: ${LOOPT}; }
.stage-head { stroke-dashoffset: calc(-1 * var(--s)); }
.stage-tail { stroke-dashoffset: calc(0.05 - var(--s)); }
.stage-lrn { ${LRN_MOVE} opacity: calc(${LRN_ON}); }
.stage .stage-lrnm { ${k("d", 22.9, 24.0)} stroke-dashoffset: calc(1 - ${e("d")}); opacity: clamp(0, ${e("d")} * 50, 1); }
/* the learner's own marker draws its own fit, then rests on it */
.stage-lrnfit { ${k("d", 23.0, 24.2)} ${LRN_MOVE} stroke-dashoffset: calc(1 - ${e("d")}); opacity: calc(clamp(0, ${e("d")} * 50, 1) * ${LRN_ON}); }
.stage-lrnmk { ${k("d", 23.0, 24.2)} ${LRN_MOVE} offset-distance: calc(${e("d")} * 100%); opacity: calc(${w(22.9, 23.1)} * ${LRN_ON}); }
/* each part of a glyph arrives on its own, scaling about the glyph's centre */
.stage-glp { --a: 26.35; --k1: clamp(0, (var(--t) - var(--a)) / 0.5, 1); --e1: calc(var(--k1) * var(--k1) * (3 - 2 * var(--k1)));
  opacity: var(--k1); transform-origin: 18px 18px; transform: scale(calc(1.25 - 0.25 * ${e(1)})); }
.stage-gl3 .stage-glp { --a: 26.5; }
.stage-lb { ${ON}
  opacity: calc(${w(10.5, 10.9)} * (1 - ${w(26.0, 26.4)})); color: color-mix(in srgb, var(--fg) calc(var(--on) * 100%), var(--fg-2)); }
.stage-say { opacity: calc(clamp(0, (var(--t) - var(--s)) * 100 + 1, 1) * (1 - clamp(0, (var(--t) - var(--e)) / 0.25 + 1, 1))); }
.stage-ph { --in: clamp(0, (var(--t) - var(--r)) / 0.35, 1);
  --on: calc(clamp(0, (var(--t) - var(--a)) / 0.12 + 1, 1) * (1 - clamp(0, (var(--t) - var(--b)) / 0.12 + 1, 1)));
  opacity: var(--in); transform: translateY(calc((1 - var(--in)) * 0.3em));
  color: color-mix(in srgb, var(--fg) calc(var(--on) * 100%), var(--fg-2)); font-weight: calc(500 + 100 * var(--on)); }
.stage-fill { transform: scaleX(var(--p)); }
`;

const CSS = `
.stage { position: relative; margin: var(--s4) 0 0; height: clamp(18rem, 52svh, 27rem); display: flex; flex-direction: column; gap: var(--s2); }
.stage-words { display: grid; margin: 0; font: 500 var(--t-stage)/1.3 var(--display); letter-spacing: -0.01em; color: var(--fg-2); max-width: 32ch; }
.stage-say { grid-area: 1 / 1; margin: 0; }
.stage-ph { display: inline-grid; }
.stage-ph > span, .stage-ph::after { grid-area: 1 / 1; }
/* each phrase keeps the width of its bold self, so lighting it never rewraps the line */
.stage-ph::after { content: attr(data-t); font-weight: 600; visibility: hidden; }
.stage-pic { flex: 1; min-height: 0; container-type: size; display: grid; place-items: center; }
.stage-box { position: relative; width: min(100cqw, 100cqh * ${VW} / ${VH}); aspect-ratio: ${VW} / ${VH}; container: stage-box / inline-size; }
.stage-fx { width: 100%; height: 100%; }
/* Strokes scale with the picture, because Chrome misplaces pathLength dashes
   under vector-effect: non-scaling-stroke. --sw holds them near their pixel
   widths at each size of the box. */
.stage-fig { --sw: 1.3; position: static; translate: none; display: block; width: 100%; height: 100%; overflow: visible; }
@container stage-box (min-width: 360px) { .stage-fig { --sw: 1.05; } }
@container stage-box (min-width: 440px) { .stage-fig { --sw: 0.85; } }
@container stage-box (min-width: 560px) { .stage-fig { --sw: 0.66; } }
.stage-ink { fill: url(#stage-body); stroke: var(--fx-ink); stroke-width: calc(1.5 * var(--sw)); stroke-linejoin: round; }
.stage-sq { fill: var(--fx-old); }
.stage-sq .stage-top { fill: color-mix(in srgb, var(--fg-2) 22%, var(--fx-halo)); }
.stage-sq .stage-door { fill: color-mix(in srgb, var(--fx-ink) 70%, transparent); }
.stage-hot { fill: none; stroke: var(--accent); stroke-width: calc(2.5 * var(--sw)); stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1 1; }
.stage-ring { fill: none; stroke: var(--fx-ink); stroke-opacity: 0.45; stroke-width: calc(1.25 * var(--sw)); stroke-dasharray: 2 6; stroke-linecap: round; }
.stage-ticks { fill: none; stroke: var(--fx-ink); stroke-width: calc(2.5 * var(--sw)); stroke-linecap: round; stroke-dasharray: 0.008 0.117; }
.stage-mask { fill: none; stroke: var(--fg); stroke-width: 16; stroke-dasharray: 1 1; }
.stage-people { fill: var(--fx-ink); }
.stage-st { stroke: var(--fx-ink); stroke-width: calc(1.5 * var(--sw)); }
.stage-link { fill: none; stroke: var(--fx-ink); stroke-width: calc(1.25 * var(--sw)); stroke-dasharray: 1 1; }
.stage-mk { fill: none; stroke: var(--accent); stroke-linecap: round; }
.stage-head { stroke-width: calc(8 * var(--sw)); stroke-dasharray: 0.001 0.999; }
.stage-tail { stroke-width: calc(3 * var(--sw)); stroke-dasharray: 0.05 0.95; }
.stage-lrnfit { fill: none; stroke: var(--accent); stroke-width: calc(2 * var(--sw)); stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1 1; }
.stage-lrnmk { fill: var(--accent); stroke: var(--fx-halo); stroke-width: calc(2 * var(--sw)); paint-order: stroke; offset-rotate: 0deg; }
.stage-gl { color: var(--fg); }
.stage-lb { position: absolute; font: 600 var(--t-label)/1.2 var(--text); letter-spacing: 0.01em; white-space: nowrap; }
/* every label stands outside the ring, clear of its line and its nodes; the
   side ones take the room beside it and wrap there on a narrow picture */
.stage-lb0 { left: 50%; bottom: calc(50% + ${f((RY / VH) * 100)}% + 10px); translate: -50% 0; }
.stage-lb2 { left: 50%; top: calc(50% + ${f((RY / VH) * 100)}% + 10px); translate: -50% 0; }
.stage-lb1, .stage-lb3 { top: 50%; translate: 0 -50%; max-width: calc(${f(50 - (RX / VW) * 100)}% - 14px); white-space: normal; line-height: 1.15; }
.stage-lb1 { left: calc(50% + ${f((RX / VW) * 100)}% + 12px); }
.stage-lb3 { right: calc(50% + ${f((RX / VW) * 100)}% + 12px); text-align: right; }
@container stage-box (max-width: 440px) { .stage-lb { font-size: 0.75rem; } }
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
.stage[data-caught] .stage-glp { opacity: 0 !important; }
/* the doors' icons never stand blank while the stage waits or plays (base.css
   hides them for the catch); the catch still flies them in from the stage */
.first [data-doors] .g { opacity: 1 !important; }
.stage[data-caught] :is(.stage-ringg, .stage-plat, .stage-st, .stage-people, .stage-link, .stage-you, .stage-yf) { --lo: 0.85 !important; --eL: 0 !important; transition: opacity 600ms var(--ease-out); }

@media (min-width: 1100px) {
  .stage { grid-column: 7 / span 6; margin: 0; height: auto; gap: var(--s4); container-type: inline-size; }
  .stage-pic { flex: none; height: min(56svh, 100cqw * ${VH} / ${VW}); }
  .stage-box { width: min(100cqw, 56svh * ${VW} / ${VH}); }
}
${scene}
`;

// The doors catch (docs/DESIGN.md, "the doors catch"): while the stage plays,
// the door icons wait (data-catch="wait" on [data-doors]; base.css would hide
// them, but the stage's CSS keeps them shown, so no row is ever blank);
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
      var to = d.querySelector('[data-door="' + g.getAttribute("data-door") + '"] .g'), from = g;
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

// A door glyph, drawn inside the stage at a glyph's spot: its parts in a
// still group placed and scaled to 56 units, each part moving on its own
// (a moving group would restyle all of its parts every frame).
const GLYPH_AT = [-110, 0, 110];
const glyph = (id, n) => {
  const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(String(GLYPHS[id]))[1]
    .replace(/<(\w+)( class="([^"]*)")?/g, (m, tag, _, cls) => `<${tag} class="stage-glp${cls ? ` ${cls}` : ""}" data-p`);
  return `<g class="g stage-gl stage-gl${n}" data-door="${id}" transform="translate(${GLYPH_AT[n - 1] - 28} -28) scale(${f(56 / 36)})">${inner}</g>`;
};

const FIG = `<svg class="stage-fig" viewBox="${-VW / 2} ${-VH / 2} ${VW} ${VH}" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="stage-body" cx="0.36" cy="0.3" r="0.85"><stop offset="0" class="fx-s-light"/><stop offset="0.75" class="fx-s-body"/></radialGradient>
    <radialGradient id="stage-floor"><stop offset="0" class="fx-s-shadow"/><stop offset="1" class="fx-s-clear"/></radialGradient>
    <mask id="stage-ring-m" style="mask-type: alpha" maskUnits="userSpaceOnUse" x="-200" y="-130" width="400" height="260"><path class="stage-mask stage-ringm" data-p pathLength="1" d="${RING}"/></mask>
    <mask id="stage-lrn-m" style="mask-type: alpha" maskUnits="userSpaceOnUse" x="-60" y="-35" width="120" height="70"><path class="stage-mask stage-lrnm" data-p pathLength="1" d="${ELLIPSE(40, 18)}"/></mask>
  </defs>
  <g class="stage-sq" data-p><path class="stage-top" d="M112 -33 L126 -47 H192 L178 -33 Z"/><rect x="112" y="-33" width="66" height="66" rx="2"/><rect class="stage-door" x="118" y="7" width="16" height="26" rx="1"/></g>
  <ellipse class="stage-qfloor" data-p fill="url(#stage-floor)" cx="22" cy="${f(QY + 12)}" rx="120" ry="6"/>
  <path class="stage-ink stage-qf" data-p d="${QPENT}"/>
  <g class="stage-qr" data-p>${[53, 20, -46].map((x) => `<path class="stage-ink" transform="translate(${x} 0)" d="${QPENT}"/>`).join("")}</g>
  <ellipse class="fx-plat stage-plat" data-p rx="${RX}" ry="${RY}"/>
  <g class="stage-ringg" data-p mask="url(#stage-ring-m)"><path class="stage-ring" d="${RING}"/><path class="stage-ticks" data-p pathLength="1" d="${RING}"/></g>
  ${[[0, -RY], [RX, 0], [0, RY], [-RX, 0]].map(([x, y], i) => `<circle class="stage-st" data-p cx="${x}" cy="${y}" r="5.5" style="--a:${SAID[3][i]}"/>`).join("")}
  <g class="stage-people" data-p><circle cy="-15" r="4"/><circle r="4"/><circle cy="15" r="4"/></g>
  <path class="stage-link" data-p pathLength="1" d="M-94 -1 L${f(PENT[4][0] - GAP - 2)} ${f(PENT[4][1] + 4)}"/>
  <ellipse class="stage-yf" data-p fill="url(#stage-floor)" cy="${f(BOTTOM + 0.08 * R)}" rx="${f(1.15 * R)}" ry="${f(0.2 * R)}"/>
  <g class="stage-you" data-p>
    <path class="stage-ink stage-pent" data-p d="${poly(PENT)}"/>
    <path class="stage-ink stage-hex" data-p d="${poly(HEX)}"/>
    <path class="stage-ink stage-wedge" data-p d="M${f(PENT[0][0])} ${f(PENT[0][1])} L${f(CORNER[0])} ${f(CORNER[1])} L${f(PENT[1][0])} ${f(PENT[1][1])}"/>
  </g>
  <path class="stage-hot stage-yf stage-outp" data-p pathLength="1" d="${poly(grow(PENT, GAP))}"/>
  <path class="stage-hot stage-yf stage-outh" data-p pathLength="1" d="${poly(grow(HEX, GAP))}"/>
  <path class="stage-hot stage-dev stage-phone" data-p pathLength="1" d="${rrect(-34, -48, 68, 94, 10)} M-8 37 H8"/>
  <path class="stage-hot stage-dev stage-laptop" data-p pathLength="1" d="${rrect(-56, -46, 112, 76, 5)} M-68 38 H68"/>
  <path class="stage-hot stage-dev stage-cloud" data-p pathLength="1" d="M-50 34 H48 C66 34 74 18 70 4 C66 -10 52 -14 42 -10 C40 -30 22 -42 2 -40 C-18 -38 -28 -24 -30 -14 C-46 -20 -66 -8 -64 10 C-62 26 -56 34 -50 34 Z"/>
  <path class="stage-mk stage-tail" data-p pathLength="1" d="${RING}"/>
  <path class="stage-mk stage-head" data-p pathLength="1" d="${RING}"/>
  <g class="stage-lrn" data-p>
    <path class="stage-ink" d="${poly(LRN)}"/>
    <path class="stage-ring" mask="url(#stage-lrn-m)" d="${ELLIPSE(40, 18)}" style="stroke-dasharray: 1.5 4"/>
  </g>
  <path class="stage-lrnfit" data-p pathLength="1" d="${LRN_FIT}"/>
  <circle class="stage-lrnmk" data-p r="3.5" style="offset-path: path('${LRN_FIT}')"/>
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
    <div class="fx stage-fx">${raw(FIG)}</div>
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
