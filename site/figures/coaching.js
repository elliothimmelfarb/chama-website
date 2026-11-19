// The figures on /coaching, in the figure
// language (kit.js): each part that moves reads --p inline, and every one is
// whole at --p 1, so a figure is complete wherever nothing writes --p (no
// JavaScript, low motion, one column, print). Their paint lives in
// site/pages/coaching.js, beside the frames they sit in.
import { html, raw } from "../html.js";
import { n, c, ss, out, poly, place } from "./kit.js";

const svg = (cls, vb, body) => `<svg class="fx-svg ${cls}" viewBox="${vb.join(" ")}" aria-hidden="true" focusable="false">${body}</svg>`;
// an HTML label on its part; one that reads --p carries data-p
const lb = (vb, text, [x, y], style = "", cls = "") =>
  html`<span class="fx-lb${cls ? " " + cls : ""}"${raw(/--p/.test(style) ? " data-p" : "")} style="${place(vb, x, y)}${style ? ";" + style : ""}" aria-hidden="true">${text}</span>`;
const lit = (id) => `<radialGradient id="${id}" cx="0.36" cy="0.3" r="0.85"><stop offset="0" class="fx-s-light"/><stop offset="0.75" class="fx-s-body"/></radialGradient>`;
const shade = (id) => `<radialGradient id="${id}"><stop offset="0" class="fx-s-shadow"/><stop offset="1" class="fx-s-clear"/></radialGradient>`;

// The mark (assets/favicon.svg's ring and spark), centred on 31.8, 31.8.
const RING = "M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z";
const SPARK = "M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z";

// ---- C1. A session: the first screen's figure ----------------------------
// You arrive unsure: a line that loops back on itself. It reaches the
// session (the mark on a lit coin, on its platform, ringed by dots) and goes
// round it once in ember, then leaves with a direction, rising to the top
// right. It is the first thing on the page, so it is drawn whole from the
// first paint and never waits for the scroll or a timer; once it is on
// screen, a point travels the line once, into the session and out along
// the ember, and the ring turns a little (site/pages/coaching.js, .cf-life).
const SV = [0, 28, 600, 372];
const SC = [306, 262]; // the session
const ORBIT = 80;
// the tangle, from the left edge into the orbit's left side: loops that
// shrink as it nears the session (the old site's coaching session, redrawn)
const TANGLE = (() => {
  const [x0, y0] = [26, 304], [x1, y1] = [SC[0] - ORBIT, SC[1]], N = 160, pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, th = Math.PI + u * 4.5 * 2 * Math.PI, lr = 46 * Math.pow(1 - u, 0.6) * (0.78 + 0.22 * Math.sin(u * 13));
    pts.push([x0 + (x1 - x0) * u + lr * (1 + Math.cos(th)), y0 + (y1 - y0) * u + 12 * Math.sin(u * 7) * (1 - u) + lr * Math.sin(th) * 1.12]);
  }
  return "M" + pts.map(([x, y]) => `${+x.toFixed(1)} ${+y.toFixed(1)}`).join(" L");
})();
// once round the session in ember, clockwise from its left, then out from
// the top, curving up to the top right
const [L, R, T] = [SC[0] - ORBIT, SC[0] + ORBIT, SC[1] - ORBIT];
const END = [574, 62], C2 = [478, 156];
const WAY = `M${L} ${SC[1]} A${ORBIT} ${ORBIT} 0 0 1 ${R} ${SC[1]} A${ORBIT} ${ORBIT} 0 0 1 ${L} ${SC[1]} A${ORBIT} ${ORBIT} 0 0 1 ${SC[0]} ${T} C${SC[0] + 84} ${T} ${C2[0]} ${C2[1]} ${END[0]} ${END[1]}`;
// the arrow head, along the curve's last tangent
const HEAD = (() => {
  const dx = END[0] - C2[0], dy = END[1] - C2[1], back = Math.atan2(-dy, -dx), arm = 17, w = (30 * Math.PI) / 180;
  const p = (a) => `${n(END[0] + arm * Math.cos(a))} ${n(END[1] + arm * Math.sin(a))}`;
  return `M${p(back + w)} L${END[0]} ${END[1]} L${p(back - w)}`;
})();
const MARK_K = 1.04;

export function sessionFigure({ labels, alt }) {
  const [where, session, going] = labels;
  const body = `<defs>${lit("cf-coin")}${shade("cf-floor")}</defs>
  <ellipse class="fx-floor" fill="url(#cf-floor)" cx="${SC[0]}" cy="${SC[1] + 74}" rx="84" ry="11"/>
  <circle class="fx-plat" cx="${SC[0]}" cy="${SC[1]}" r="64"/>
  <circle class="fx-ring cf-ring" cx="${SC[0]}" cy="${SC[1]}" r="64"/>
  <circle class="cf-coin" fill="url(#cf-coin)" cx="${SC[0]}" cy="${SC[1]}" r="42"/>
  <g transform="translate(${n(SC[0] - 31.8 * MARK_K)} ${n(SC[1] - 31.8 * MARK_K)}) scale(${MARK_K})"><path class="cf-mark-ring" d="${RING}"/><path class="cf-mark-spark" d="${SPARK}"/></g>
  <path class="cf-tube" d="${TANGLE}"/>
  <path class="cf-tangle" d="${TANGLE}"/>
  <path class="cf-tint" d="${WAY}"/>
  <path class="cf-way" d="${WAY}"/>
  <path class="cf-head" d="${HEAD}"/>
  <circle class="fx-dot cf-you cf-you-1" r="4.5" style="offset-path:path('${TANGLE}')"/>
  <circle class="fx-mk cf-you cf-you-2" r="5.5" style="offset-path:path('${WAY}')"/>`;
  return html`<figure class="fx cf" aria-label="${alt}">
  ${raw(svg("cf-svg", SV, body))}
  ${lb(SV, where, [112, 366])}
  ${lb(SV, session, [SC[0], SC[1] + 104])}
  ${lb(SV, going, [END[0] - 14, END[1] - 4], "--tx:-100%", "is-live")}
</figure>`;
}

// ---- C2. Who it's for: one small group per row ---------------------------
// You and Elliot, a table of leaders, an engineering team, a whole company.
// The ember dot is the coach, ringed in the ground so it stands clear.
const dots = (pts, hot) => pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === hot ? 3.6 : 2.7}"${i === hot ? ' class="wf-hot"' : ""}/>`).join("");
const ring = Array.from({ length: 14 }, (_, i) => [20 + 14 * Math.cos((i / 14) * 2 * Math.PI - Math.PI / 2), 20 + 14 * Math.sin((i / 14) * 2 * Math.PI - Math.PI / 2)].map((v) => +v.toFixed(2)));
const GROUPS = [
  dots([[13, 20], [27, 20]], 1),
  `<ellipse class="wf-table" cx="20" cy="20" rx="10" ry="5.5"/>` + dots([[11, 12], [20, 10.5], [29, 12], [14, 28], [26, 28]], 1),
  dots([[11, 11], [20, 11], [29, 11], [11, 20], [20, 20], [29, 20], [11, 29], [20, 29], [29, 29]], 4),
  dots([[20, 20], ...ring], 0),
];
export const whoGlyph = (i) => raw(`<svg class="wf" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${GROUPS[i]}</svg>`);

// ---- C3. Thinking effort, then and now -------------------------------------
// Two grooves with four notches each. On the older models the ink knob sits
// at extra high; on the current ones the ember knob leaves a ghost there and
// slides down to medium, where it lands and the level lights.
const EV = [0, 0, 560, 372];
const LEVEL_X = [100, 220, 340, 460];
const ROWS = [104, 282];
const KNOB = 15;
function groove(y) {
  const notch = LEVEL_X.map((x) => `M${x} ${y + 9}V${y + 17}`).join("");
  return `<rect class="ef-groove" x="40" y="${y - 4}" width="480" height="8" rx="4"/><path class="ef-notch" d="${notch}"/>`;
}
export function effortFigure({ alt, rows, levels }) {
  // whole by 0.56: on a phone the figure sits under the words and leaves
  // first, at about 0.7 of the hold
  const [then, now] = ROWS, from = LEVEL_X[3], to = LEVEL_X[1], go = -(from - to), move = [0.12, 0.44], land = 0.44;
  const slide = `translate:calc(${go}px * ${ss(...move)}) 0`;
  const body = `<defs>${shade("ef-floor")}</defs>
  ${groove(then)}${groove(now)}
  <ellipse class="fx-floor" fill="url(#ef-floor)" cx="${from}" cy="${then + 19}" rx="17" ry="4"/>
  <circle class="ef-knob" cx="${from}" cy="${then}" r="${KNOB}"/>
  <circle class="ef-ghost" data-p cx="${from}" cy="${now}" r="${KNOB}" style="opacity:${c(0.16, 0.24)}"/>
  <ellipse class="fx-floor" data-p fill="url(#ef-floor)" cx="${from}" cy="${now + 19}" rx="17" ry="4" style="${slide}"/>
  <circle class="fx-mk ef-now" data-p cx="${from}" cy="${now}" r="${KNOB}" style="${slide};transform-box:fill-box;transform-origin:center;scale:calc(1 + 0.14 * ${c(land - 0.06, land)} - 0.14 * ${out(land, land + 0.1)})"/>`;
  const names = rows.map((r, i) => lb(EV, r, [40, ROWS[i] - 42], "--tx:0", "is-live"));
  const scale = ROWS.flatMap((y) => levels.map((l, k) => lb(EV, l, [LEVEL_X[k], y + 36])));
  return html`<figure class="fx ef" role="img" aria-label="${alt}">
  ${raw(svg("ef-svg", EV, body))}
  ${names}${scale}
  ${lb(EV, levels[1], [to, now + 36], `opacity:calc(0.01 + 0.99 * ${c(land, land + 0.06)})`, "is-hot")}
</figure>`;
}

// ---- C4. AI enablement: three layers, enablement on top -----------------
// Policy, structure and enablement as slabs seen from above, each with a lit
// top and two shaded sides, on one floor shadow; the top one is ember and
// warm. Still: its world scrolls.
const NV = [0, 0, 520, 340];
const SLAB = { x: 196, w: 156, d: 42, t: 16 };
function slab(y, hot) {
  const { x, w, d, t } = SLAB;
  const top = poly([[x - w, y], [x, y - d], [x + w, y], [x, y + d]]);
  const left = poly([[x - w, y], [x, y + d], [x, y + d + t], [x - w, y + t]]);
  const right = poly([[x, y + d], [x + w, y], [x + w, y + t], [x, y + d + t]]);
  const k = hot ? " en-hot" : "";
  return `<path class="en-side${k}" d="${left}"/><path class="en-side en-side-r${k}" d="${right}"/><path class="en-top${k}" fill="url(#${hot ? "en-warm" : "en-lit"})" d="${top}"/>`;
}
export function enablementFigure({ layers }) {
  const ys = [244, 160, 76];
  const body = `<defs>${lit("en-lit")}<radialGradient id="en-warm" cx="0.36" cy="0.3" r="0.85"><stop offset="0" class="fx-s-light"/><stop offset="0.75" class="fx-s-owned"/></radialGradient>${shade("en-floor")}</defs>
  <ellipse class="fx-floor" fill="url(#en-floor)" cx="${SLAB.x}" cy="${ys[0] + SLAB.d + SLAB.t + 10}" rx="${SLAB.w + 24}" ry="26"/>
  ${ys.map((y, i) => slab(y, i === ys.length - 1)).join("")}`;
  const right = SLAB.x + SLAB.w;
  return html`<figure class="fx en" aria-hidden="true">
  ${raw(svg("en-svg", NV, body))}
  ${layers.map((l, i) => html`<span class="fx-lb fx-call" style="${place(NV, right + 6, ys[i] + SLAB.t / 2)};--ang:0deg;--len:18px"></span>${lb(NV, l, [right + 34, ys[i] + SLAB.t / 2], "--tx:0", i === layers.length - 1 ? "is-live" : "")}`)}
</figure>`;
}

// ---- C5. The Hearth: sessions, each leaving its record ---------------------
// Six sessions booked along a line; under each, its record, a paper card
// that rises onto its own soft shadow as the world is held, the rows
// alternating so every card has room. The latest session and record are
// ember and warm.
const HV = [0, 0, 520, 400];
const HX = [64, 142, 220, 298, 376, 454];
const LINE_Y = 44, CARD = { w: 84, h: 104 }, ROW_Y = [92, 236];
function record(x, i, last) {
  // whole by 0.44: on a phone the figure sits under the words and leaves first
  const y = ROW_Y[i % 2], at = 0.04 + i * 0.06, l = x - 28;
  const lines = `M${l} ${y + 24}H${x + 8}M${l} ${y + 46}H${x + 28}M${l} ${y + 60}H${x + 18}M${l} ${y + 74}H${x + 24}`;
  // the tie hangs from its session from the start; the card and its lines
  // rise together (a group of two, for frame cost) onto a shadow that darkens as it comes
  return `<path class="hf-tie" d="M${x} ${LINE_Y + 10}V${y - 2}"/>
  <ellipse class="fx-floor" data-p fill="url(#hf-floor)" cx="${x}" cy="${y + CARD.h + 6}" rx="${CARD.w / 2 + 8}" ry="7" style="opacity:calc(0.01 + 0.99 * ${c(at, at + 0.1)})"/>
  <g class="hf-rec${last ? " hf-hot" : ""}" data-p style="opacity:calc(0.01 + 0.99 * ${c(at, at + 0.08)});translate:0 calc(16px * (1 - ${out(at, at + 0.1)}))"><rect class="hf-card" x="${x - CARD.w / 2}" y="${y}" width="${CARD.w}" height="${CARD.h}" rx="6"${last ? "" : ' fill="url(#hf-paper)"'}/><path class="hf-lines" d="${lines}"/></g>`;
}
export function hearthFigure({ sessions, records }) {
  const last = HX.length - 1;
  const body = `<defs>${lit("hf-paper")}${shade("hf-floor")}</defs>
  <path class="fx-hair hf-axis" d="M20 ${LINE_Y}H500"/>
  ${HX.map((x, i) => record(x, i, i === last)).join("")}
  ${HX.map((x, i) => `<circle class="${i === last ? "fx-mk" : "hf-dot"}" cx="${x}" cy="${LINE_Y}" r="${i === last ? 7 : 6}"/>`).join("")}`;
  return html`<figure class="fx hf" aria-hidden="true">
  ${raw(svg("hf-svg", HV, body))}
  ${lb(HV, sessions, [500, LINE_Y - 22], "--tx:-100%")}
  ${lb(HV, records, [22, 376], "--tx:0")}
</figure>`;
}

// the viewBox's aspect, for the frame's --ar
export const ASPECT = { session: SV[2] / SV[3], effort: EV[2] / EV[3], enablement: NV[2] / NV[3], hearth: HV[2] / HV[3] };
