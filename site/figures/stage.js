// The home page's opening stage: eight scenes drawn by one ember line, as if
// by one hand. Each scene's sentence is shown
// whole and stays for its reading time, so the clock is the sum of those
// times. The engine's [data-stage] clock writes --p on every [data-p] part,
// and each part's inline style turns --p into its own draw, so seeking,
// pausing and the low motion stills all come from the one clock.
import { html, raw } from "../html.js";
import { c, ss, out, n } from "./kit.js";

// 1.4s to start reading, 0.35s a word, never under 3.2s.
export const readingTime = (say) => Math.max(3.2, 1.4 + 0.35 * say.trim().split(/\s+/).length);

// ---- the drawing, in the viewBox's units ------------------------------------
// The scenes are drawn on a 640 by 360 sheet with the ground at Y; the box
// shows the part they use.
const VB = [100, 52, 540, 260];
const Y = 300, L = VB[0], R = VB[0] + VB[2];
const r1 = (v) => Math.round(v * 10) / 10;
// a person in one line: up the left shoulder, a loop for the head, down the right
const emPerson = (x, s, base = Y) => {
  const nk = base - 22 * s, h = base - 45 * s;
  return `C${r1(x - 14 * s)} ${r1(base - 15 * s)} ${r1(x - 9 * s)} ${r1(nk)} ${r1(x)} ${r1(nk)} ` +
    `C${r1(x - 14 * s)} ${r1(nk)} ${r1(x - 14 * s)} ${r1(h)} ${r1(x)} ${r1(h)} C${r1(x + 14 * s)} ${r1(h)} ${r1(x + 14 * s)} ${r1(nk)} ${r1(x)} ${r1(nk)} ` +
    `C${r1(x + 9 * s)} ${r1(nk)} ${r1(x + 14 * s)} ${r1(base - 15 * s)} ${r1(x + 14 * s)} ${r1(base)}`;
};
// the same person in ink: shoulders and a round head
const inkPerson = (x, s, base = Y) => {
  const nk = base - 22 * s, cy = nk - 12.5 * s, r = 10 * s;
  return `M${r1(x - 14 * s)} ${r1(base)} C${r1(x - 14 * s)} ${r1(base - 15 * s)} ${r1(x - 9 * s)} ${r1(nk)} ${r1(x)} ${r1(nk)} C${r1(x + 9 * s)} ${r1(nk)} ${r1(x + 14 * s)} ${r1(base - 15 * s)} ${r1(x + 14 * s)} ${r1(base)} ` +
    `M${r1(x - r)} ${r1(cy)} A${r1(r)} ${r1(r)} 0 1 0 ${r1(x + r)} ${r1(cy)} A${r1(r)} ${r1(r)} 0 1 0 ${r1(x - r)} ${r1(cy)}`;
};
const rrect = (x, y, w, h, r) => `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
// a four-pointed spark, entered from its bottom point
const sparkB = (x, y, s) => `L${x} ${y + s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y - s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y + s}`;
// a hyphenated word never breaks at its hyphen ("AI-native")
const nobreak = (say) => say.replace(/(\w)-(\w)/g, "$1\u2011$2");
const circ = (x, y, r) => `M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y}`;

// Each scene: ink parts and quieter ink2 parts (each drawn from a seconds
// into the scene, over dur), tone and fill shapes that fade in, and the
// ember line, which is drawn by one hand. Times are seconds into the scene.
const SCENES = [];

// 1. Big companies: a tall company with engineers in its windows, and you standing in front of it.
{
  const ink = [rrect(452, 64, 140, 236, 8), `M505 300 V262 Q505 256 511 256 H533 Q539 256 539 262 V300`], win = [], fill = [];
  for (let r = 0; r < 7; r++) for (let k = 0; k < 4; k++) {
    const x = 468 + k * 29, y = 82 + r * 26;
    if (r === 6 && (k === 1 || k === 2)) continue;
    win.push(rrect(x, y, 21, 15, 2.5));
    if ((r * 4 + k) % 5 === 2) fill.push(circ(x + 10.5, y + 8.2, 3.2));
  }
  SCENES.push({
    tone: [rrect(452, 64, 140, 236, 8)],
    ink: [{ d: ink.join(" "), a: 0, dur: 1.1 }],
    ink2: [{ d: win.join(" "), a: 0.25, dur: 1.0 }],
    fill: fill.map((d) => ({ d, a: 1.1 })),
    em: { d: `M${L} ${Y} H${r1(370 - 14 * 1.05)} ${emPerson(370, 1.05)} H392`, a: 0.6, dur: 1.8 },
  });
}
// 2. Your own engineers: you at a table with two engineers who work only for you.
SCENES.push({
  zoom: [1.3, 360],
  ink: [{ d: `${inkPerson(214, 1.18)} ${inkPerson(170, 1.18)}`, a: 0, dur: 1.0 }, { d: `M262 246 H392 M276 246 V300 M378 246 V300`, a: 0.3, dur: 0.8 }],
  ink2: [{ d: `${rrect(304, 214, 42, 28, 2.5)} M296 246 H354`, a: 0.6, dur: 0.9 }],
  em: { d: `M${L} ${Y} H${r1(440 - 14 * 1.18)} ${emPerson(440, 1.18)} H${R}`, a: 0.5, dur: 2.0 },
  pop: [{ d: `M398 196 Q398 186 408 186 H432 Q442 186 442 196 V200 Q442 210 432 210 H414 L404 218 L406 210 Q398 208 398 200 Z`, a: 2.1 }],
});
// 3. We're those engineers, and we build with AI: the line builds our house, a spark over it.
SCENES.push({
  tone: [`M250 300 V204 L320 146 L390 204 V300 Z`],
  ink: [{ d: rrect(282, 214, 76, 52, 4), a: 1.1, dur: 0.6 }, { d: `${inkPerson(300, 0.8, 266)} ${inkPerson(326, 0.8, 266)} ${inkPerson(347, 0.55, 266)}`, a: 1.7, dur: 0.8 }],
  em: { d: `M${L} ${Y} H250 V204 L320 146 L390 204 V${Y} H432 C458 ${Y} 470 236 470 166 ${sparkB(470, 140, 24)}`, a: 0, dur: 2.4 },
});
// 4. The loop: a dot draws the ring, lighting each station as it passes.
const LOOP = { cx: 360, cy: 176, r: 96 };
// the line comes up off the ground to the top of the ring
const LOOP_IN = `M${L} ${Y} H230 C290 ${Y} 300 ${LOOP.cy - LOOP.r} ${LOOP.cx} ${LOOP.cy - LOOP.r}`;
const STATIONS = ["Tell us", "It gets built", "You use it", "What's next"];
SCENES.push({
  tone: [`M342 198 V168 L360 152 L378 168 V198 Z`],
  ink: [{ d: `M342 198 V168 L360 152 L378 168 V198 Z`, a: 0.1, dur: 0.7 }],
  loop: true,
});
// 5. Fits your process: three steps, the line traced snug round them, then
// the steps change and the line changes with them.
SCENES.push({ steps: true });
// 6. A phone, a computer, the cloud: one stroke draws all three.
{
  const phone = `H150 V200 Q150 190 160 190 H188 Q198 190 198 200 V${Y}`;
  const laptop = `H252 V288 H268 V198 Q268 190 276 190 H372 Q380 190 380 198 V288 H396 V${Y}`;
  // up into the cloud's lower left, round it, and down from its lower right
  const cloud = `H432 C454 ${Y} 458 252 476 250 C450 250 446 222 466 216 C466 194 492 186 506 200 C514 182 546 184 548 208 C570 208 570 250 548 250 C568 250 576 ${Y} 600 ${Y}`;
  SCENES.push({
    zoom: [1.12, 349],
    // each device's details draw as the line finishes its outline
    ink2: [{ d: `${rrect(156, 206, 36, 74, 3)} M168 198 H180 M166 290 H182`, a: 0.35, dur: 0.5 }, { d: `M284 210 H338 M284 224 H364 M284 238 H326`, a: 0.8, dur: 0.6 }, { d: `M476 250 H548`, a: 1.6, dur: 0.4 }],
    em: { d: `M${L} ${Y} ${phone} ${laptop} ${cloud} H${R}`, a: 0, dur: 3.6 },
  });
}
// 7. Something new: a spark appears on a screen, then the line carries it to you.
SCENES.push({
  zoom: [1.15, 320],
  tone: [rrect(150, 168, 112, 80, 8)],
  ink: [{ d: `${rrect(150, 168, 112, 80, 8)} M200 248 L195 270 H217 L212 248`, a: 0, dur: 1.0 }, { d: inkPerson(470, 1.25), a: 0.5, dur: 0.9 }],
  em: { d: `M${L} ${Y} H118 C150 ${Y} 168 280 172 252 C175 236 190 230 206 228 ${sparkB(206, 208, 20)} C226 232 246 250 256 270 C264 290 276 ${Y} 296 ${Y} H392 C428 ${Y} 430 226 452 218 ${sparkB(470, 190, 19)}`, a: 0.6, dur: 2.8 },
});
// 8. More time: the line becomes two people side by side, under a low sun.
{
  const s = 1.55, a = 282, b = 344, nk = Y - 22 * s, h = Y - 45 * s, mid = (a + b) / 2;
  const pair = `H${r1(a - 14 * s)} C${r1(a - 14 * s)} ${r1(Y - 15 * s)} ${r1(a - 9 * s)} ${r1(nk)} ${a} ${r1(nk)} ` +
    `C${r1(a - 14 * s)} ${r1(nk)} ${r1(a - 14 * s)} ${r1(h)} ${a} ${r1(h)} C${r1(a + 14 * s)} ${r1(h)} ${r1(a + 14 * s)} ${r1(nk)} ${a} ${r1(nk)} ` +
    `C${r1(a + 11 * s)} ${r1(nk)} ${r1(mid - 3)} ${r1(nk + 9)} ${r1(mid)} ${r1(nk + 10)} C${r1(mid + 3)} ${r1(nk + 9)} ${r1(b - 11 * s)} ${r1(nk)} ${b} ${r1(nk)} ` +
    `C${r1(b - 14 * s)} ${r1(nk)} ${r1(b - 14 * s)} ${r1(h - 3)} ${b} ${r1(h - 3)} C${r1(b + 14 * s)} ${r1(h - 3)} ${r1(b + 14 * s)} ${r1(nk)} ${b} ${r1(nk)} ` +
    `C${r1(b + 9 * s)} ${r1(nk)} ${r1(b + 14 * s)} ${r1(Y - 15 * s)} ${r1(b + 14 * s)} ${Y}`;
  SCENES.push({
    zoom: [1.3, 415],
    tone: [`M478 300 A46 46 0 0 1 570 300 Z`],
    ink: [{ d: `M478 300 A46 46 0 0 1 570 300`, a: 0.2, dur: 1.4 }, { d: inkPerson(402, 0.95), a: 1.2, dur: 0.7 }],
    em: { d: `M${L} ${Y} ${pair} H${R}`, a: 0.3, dur: 2.4 },
  });
}

// The steps of scene 5: three blocks whose heights change from A to B, and
// the line 9 units outside them. The line's corners move as straight
// segments (a unit line placed and stretched), so it stays one crisp
// line while the blocks change under it.
const SX = [214, 270, 350, 436], G = 9, HA = [64, 112, 82], HB = [64, 84, 132];
const stepLine = (H) => {
  let d = `M${L} ${Y} H${SX[0] - G} V${Y - H[0] - G}`;
  for (let k = 0; k < 3; k++) {
    const next = k < 2 ? Y - H[k + 1] - G : Y;
    const off = k < 2 ? G * Math.max(-1, Math.min(1, (H[k + 1] - H[k]) / -14)) : G;
    d += ` H${SX[k + 1] + off} V${next}`;
  }
  return `${d} H${R}`;
};
// the corners of the line between the first block's top and the ground on
// the right, at A and at B: [x of the rise to block 2, y of block 2's top,
// x of the rise to block 3, y of block 3's top]
const corner = (H) => [SX[1] - G, Y - H[1] - G, SX[2] + G * Math.max(-1, Math.min(1, (H[2] - H[1]) / -14)), Y - H[2] - G];

// ---- the choreography, as styles read from --p --------------------------------
export function stage({ label, beats }) {
  const holds = beats.map((b) => readingTime(b.say));
  const starts = holds.map((_, i) => holds.slice(0, i).reduce((a, b) => a + b, 0));
  const T = holds.reduce((a, b) => a + b, 0);
  const at = (sec) => n(sec / T);
  // 0 before a seconds, 1 after b; and smoothstep between
  const C = (a, b) => c(at(a), at(b));
  const S = (a, b) => ss(at(a), at(b));
  // the ember line is drawn eased out: quick along the ground, slowing into its figure
  const E = (a, b) => out(at(a), at(b));
  const last = beats.length - 1;
  const end = (i) => starts[i] + holds[i];
  // a scene's ink leaves over its last 0.3s, as its sentence does; the last stays
  const gone = (i) => (i === last ? "1" : `(1 - ${C(end(i) - 0.3, end(i))})`);
  // A scene's drawing is paced to its sentence: its last stroke ends at 78%
  // of the hold, so no scene stands still while its words are read.
  const pace = SCENES.map((sc, i) => {
    const ends = [...(sc.ink || []), ...(sc.ink2 || []), ...(sc.em ? [sc.em] : [])].map((p) => p.a + p.dur);
    return ends.length ? (0.78 * holds[i]) / Math.max(...ends) : 1;
  });
  // after the first, each scene starts drawing while the last one runs off
  // (not the loop, whose line would cross the house it follows)
  const early = (i) => starts[i] - (i && !SCENES[i].loop ? 0.35 : 0);
  const fit = (i, a, dur) => [early(i) + a * pace[i], early(i) + (a + dur) * pace[i]];
  const drawn = (i, a, dur) => {
    const [x, y] = fit(i, a, dur);
    return `opacity:calc(${C(x, x + 0.06)} * ${gone(i)});stroke-dashoffset:calc(1 - ${S(x, y)})`;
  };
  const shown = (i, a, len = 0.45) => {
    const x = early(i) + a * pace[i];
    return `opacity:calc(${C(x, x + len)} * ${gone(i)})`;
  };
  const path = (cls, d, style, extra = "") => `<path class="${cls}" data-p${extra} d="${d}" style="${style}"/>`;
  // The ember line never leaves the sheet blank: as a scene ends its line
  // runs on off its tail while the next scene's line comes in from the left.
  const runOff = (i) => (i === last ? "" : ` - ${S(end(i) - 0.2, end(i) + 0.6)}`);
  // and fades as it goes, so two finished drawings never share the sheet
  const lineGone = (i) => (i === last ? "1" : `(1 - ${C(end(i), end(i) + 0.45)})`);
  // off: when the line runs off, if not at its scene's end
  const ember = (i, d, x, y, off) => [
    path("stage-em", d, `opacity:calc(${C(x, x + 0.06)} * ${off ? `(1 - ${C(off + 0.8, off + 0.82)})` : lineGone(i)});stroke-dashoffset:calc(1 - ${E(x, y)}${off ? ` - ${S(off, off + 0.8)}` : runOff(i)})`, ` pathLength="1"`),
    // the pen: a nib at the drawing end while it draws, drawn as the round
    // cap of a dash too short to see (an offset-path on a path this long
    // cost Chrome more than a frame in every style pass)
    path("stage-nib", d, `opacity:calc(${C(x, x + 0.08)} * (1 - ${C(y - 0.02, y + 0.3)}));stroke-dashoffset:calc(-1 * ${E(x, y)})`, ` pathLength="1"`),
  ].join("");

  const parts = [];
  SCENES.forEach((sc, i) => {
    const from = parts.length;
    (sc.tone || []).forEach((d) => parts.push(path("stage-tone", d, shown(i, 0.4, 0.6))));
    (sc.ink || []).forEach((p) => parts.push(path("stage-ink", p.d, drawn(i, p.a, p.dur), ` pathLength="1"`)));
    (sc.ink2 || []).forEach((p) => parts.push(path("stage-ink2", p.d, drawn(i, p.a, p.dur), ` pathLength="1"`)));
    (sc.fill || []).forEach((p) => parts.push(path("stage-dotfill", p.d, shown(i, p.a))));
    (sc.pop || []).forEach((p) => parts.push(path("stage-ink2", p.d, shown(i, p.a))));
    if (sc.em) { const [x, y] = fit(i, sc.em.a, sc.em.dur); parts.push(ember(i, sc.em.d, x, y)); }
    if (sc.loop) {
      // the dot leaves the top half a second in and goes once round
      // the line up to the ring runs off as the lap begins
      parts.push(ember(i, LOOP_IN, starts[i], starts[i] + 0.6, starts[i] + 0.6));
      const x = starts[i] + 0.6, y = end(i) - 0.9;
      const { cx, cy, r } = LOOP;
      const ring = `M${cx} ${cy - r} A${r} ${r} 0 1 1 ${cx} ${cy + r} A${r} ${r} 0 1 1 ${cx} ${cy - r}`;
      parts.push(path("stage-ink2 stage-guide", circ(cx, cy, r), shown(i, 0, 0.5)));
      // the ring runs off inside its own scene: it stands where the next scene draws
      parts.push(path("stage-em", ring, `opacity:calc(${C(x, x + 0.06)} * (1 - ${C(end(i) + 0.05, end(i) + 0.07)}));stroke-dashoffset:calc(1 - ${S(x, y)} - ${S(end(i) - 0.25, end(i) + 0.05)})`, ` pathLength="1"`));
      // when the eased lap reaches each quarter: smoothstep inverted
      const inv = (v) => { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (m * m * (3 - 2 * m) < v) lo = m; else hi = m; } return lo; };
      const passes = [0, 0.25, 0.5, 0.75].map((v) => x + inv(v) * (y - x));
      passes.forEach((when, k) => {
        const ang = -Math.PI / 2 + (k * Math.PI) / 2;
        parts.push(`<circle class="stage-node" data-p cx="${n(cx + r * Math.cos(ang))}" cy="${n(cy + r * Math.sin(ang))}" r="6.5" style="opacity:calc(${C(starts[i], starts[i] + 0.4)} * ${gone(i)});--on:${C(when, when + 0.15)}"/>`);
      });
      parts.push(path("stage-nib stage-dot", ring, `opacity:calc(${C(x, x + 0.1)} * ${gone(i)});stroke-dashoffset:calc(-1 * ${S(x, y)})`, ` pathLength="1"`));
      sc.passes = passes;
    }
    if (sc.steps) {
      const m = S(starts[i] + 2.0, starts[i] + 2.9);
      const swap = starts[i] + 1.95;
      // the blocks, which keep their stroke as they stretch
      HA.forEach((h, k) => parts.push(`<rect class="stage-block" data-p x="${SX[k] + 3}" y="${Y - h}" width="${SX[k + 1] - SX[k] - 6}" height="${h}" style="${shown(i, 0)};transform-box:fill-box;transform-origin:bottom;scale:1 calc(1 + ${n(HB[k] / h - 1)} * ${m})"/>`));
      // the line as drawn, until the steps change
      parts.push(path("stage-em", stepLine(HA), `opacity:calc(${C(starts[i] - 0.35, starts[i] - 0.29)} * (1 - ${C(swap, swap + 0.02)}));stroke-dashoffset:calc(1 - ${S(starts[i] - 0.35, starts[i] + 1.5)})`, ` pathLength="1"`));
      // then the same line in pieces: the ends that never move, and five
      // straight runs placed and stretched as the steps change
      const [ax, ay, bx, by] = corner(HA), [, ay2, bx2, by2] = corner(HB);
      const on = `opacity:calc(${C(swap, swap + 0.02)} * ${gone(i)})`;
      parts.push(path("stage-em", `M${L} ${Y} H${SX[0] - G} V${Y - HA[0] - G} H${ax} M${SX[3] + G} ${Y} H${R}`, on));
      const lin = (a, b) => `calc(${a}px + ${n(b - a)}px * ${m})`;
      const num = (a, b) => `calc(${a} + ${n(b - a)} * ${m})`;
      const y0 = Y - HA[0] - G, xe = SX[3] + G;
      const runs = [
        [`M0 0 V1`, `${ax}px ${y0}px`, `1 ${num(ay - y0, ay2 - y0)}`],
        [`M0 0 H1`, `${ax}px ${lin(ay, ay2)}`, `${num(bx - ax, bx2 - ax)} 1`],
        [`M0 0 V1`, `${lin(bx, bx2)} ${lin(ay, ay2)}`, `1 ${num(by - ay, by2 - ay2)}`],
        [`M0 0 H1`, `${lin(bx, bx2)} ${lin(by, by2)}`, `${num(xe - bx, xe - bx2)} 1`],
        [`M0 0 V1`, `${xe}px ${lin(by, by2)}`, `1 ${num(Y - by, Y - by2)}`],
      ];
      runs.forEach(([d, tr, sc2]) => parts.push(path("stage-em stage-run", d, `${on};translate:${tr};scale:${sc2}`)));
    }
    // a scene drawn small on the sheet is scaled up about its ground; its
    // strokes keep their widths through --zs
    for (let j = from; j < parts.length; j++) parts[j] = parts[j].replace(/ data-p\b/g, ` data-p data-s="${i}"`);
    if (sc.zoom) {
      const [k, cx] = sc.zoom;
      parts.splice(from, parts.length - from, `<g transform="translate(${cx} ${Y}) scale(${k}) translate(${-cx} ${-Y})" style="--zs:${k}">${parts.slice(from).join("")}</g>`);
    }
  });

  // the station labels of the loop scene, over the box
  const li = SCENES.findIndex((s) => s.loop);
  const pct = (x, y) => `left:${n(((x - VB[0]) / VB[2]) * 100)}%;top:${n(((y - VB[1]) / VB[3]) * 100)}%`;
  const labels = STATIONS.map((s, k) => {
    const ang = -Math.PI / 2 + (k * Math.PI) / 2, d = LOOP.r + 16;
    const x = LOOP.cx + d * Math.cos(ang), y = LOOP.cy + d * Math.sin(ang);
    const when = SCENES[li].passes[k];
    return html`<span class="stage-lb stage-lb${k}" data-p style="${pct(x, y)};opacity:calc(${C(starts[li] + 0.2, starts[li] + 0.6)} * ${gone(li)});--on:${C(when, when + 0.15)}" aria-hidden="true">${s}</span>`;
  });

  const words = beats.map((b, i) => {
    const e = i === last ? T + 1 : end(i);
    // the first sentence is there before the clock starts
    const r = i === 0 ? -1 : starts[i] - 0.05;
    return html`<p class="stage-say" data-p style="opacity:calc(clamp(0, (var(--p) * ${n(T)} - ${n(r)}) / 0.35, 1) * (1 - clamp(0, (var(--p) * ${n(T)} - ${n(e - 0.25)}) / 0.25, 1)))">${nobreak(b.say)}</p>`;
  });

  const FIG = `<svg class="stage-fig" viewBox="${VB.join(" ")}" aria-hidden="true" focusable="false"><line class="stage-ground" x1="${L}" y1="${Y}" x2="${R}" y2="${Y}"/>${parts.join("")}</svg>`;

  return html`<figure class="stage" data-stage data-duration="${n(T)}" data-delay="2.6" tabindex="-1" aria-label="${label}">
  <style>${raw(CSS)}</style>
  <div class="stage-words">${words}</div>
  <div class="stage-pic"><div class="stage-box">${raw(FIG)}${labels}</div></div>
  <div class="stage-ctl">
    <button class="stage-btn" type="button" data-stage-action="play" aria-label="Play">${raw(ICON.play)}</button>
    <button class="stage-btn" type="button" data-stage-action="pause" aria-label="Pause">${raw(ICON.pause)}</button>
    <button class="stage-btn" type="button" data-stage-action="replay" aria-label="Play again">${raw(ICON.replay)}</button>
    <div class="stage-segs">${beats.map((b, i) => html`<button class="stage-seg" type="button" style="flex:${n(+holds[i].toFixed(2))}" data-stage-seek="${at(starts[i])}" data-stage-still="${at(starts[i] + holds[i] - 0.35)}" aria-label="Scene ${i + 1} of ${beats.length}: ${b.name}"><i><b data-p style="scale:${C(starts[i], starts[i] + holds[i])} 1"></b></i></button>`)}</div>
  </div>
  <div class="stage-step">
    <button class="stage-btn" type="button" data-stage-step="-1" aria-label="Previous scene" aria-disabled="true">${raw(ICON.prev)}</button>
    <p class="stage-count" aria-live="polite"><span data-stage-count>1 of ${beats.length}</span></p>
    <button class="stage-btn" type="button" data-stage-step="1" aria-label="Next scene">${raw(ICON.next)}</button>
  </div>
  <noscript><style>
    .stage { height: auto; }
    .stage-words { display: block; max-width: 40ch; margin: 0; padding-left: 1.2em; min-height: 0; }
    .stage-say { display: list-item; opacity: 1 !important; }
    .stage-say + .stage-say { margin-top: var(--s2); }
    .stage-pic { display: none; }
  </style></noscript>
</figure>`;
}

const ICON = {
  play: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M6 4.2v9.6l8-4.8z"/></svg>`,
  pause: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M6.5 4v10M11.5 4v10"/></svg>`,
  replay: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9a5 5 0 1 0 1.6-3.7M4 3.2v3h3"/></svg>`,
  prev: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M11 4 6 9l5 5"/></svg>`,
  next: `<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m7 4 5 5-5 5"/></svg>`,
};

// --sw holds strokes at their pixel widths at each width of the box (dashes
// need real path units, so strokes cannot be non-scaling while they draw).
const CSS = `
.stage { position: relative; margin: var(--s4) 0 0; display: flex; flex-direction: column; gap: var(--s3); }
.stage-words { display: grid; margin: 0; min-height: calc(3 * 1.25em); font: 500 1.25rem/1.25 var(--display); letter-spacing: -0.015em; color: var(--fg); max-width: 30ch; text-wrap: pretty; }
.stage-say { grid-area: 1 / 1; margin: 0; align-self: start; }
.stage-pic { container: stage-box / inline-size; }
.stage-box { position: relative; aspect-ratio: ${VB[2]} / ${VB[3]}; }
.stage-fig { --sw: calc(${VB[2]} / 330); display: block; width: 100%; height: 100%; overflow: hidden; }
@container stage-box (min-width: 400px) { .stage-fig { --sw: calc(${VB[2]} / 440); } }
@container stage-box (min-width: 500px) { .stage-fig { --sw: calc(${VB[2]} / 560); } }
@container stage-box (min-width: 620px) { .stage-fig { --sw: calc(${VB[2]} / 680); } }
.stage-fig path, .stage-fig rect { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.stage-fig [pathLength] { stroke-dasharray: 1 1; }
.stage-ground { stroke: var(--line-strong); stroke-width: 1px; vector-effect: non-scaling-stroke; }
.stage-ink { stroke: var(--fg); stroke-width: calc(1.6px * var(--sw) / var(--zs, 1)); }
.stage-ink2 { stroke: color-mix(in srgb, var(--fg) 50%, transparent); stroke-width: calc(1.3px * var(--sw) / var(--zs, 1)); }
.stage-fig .stage-nib { stroke: var(--accent); stroke-width: calc(9px * var(--sw) / var(--zs, 1)); stroke-dasharray: 0.0001 2; }
.stage-fig .stage-dot { stroke-width: calc(15px * var(--sw) / var(--zs, 1)); }
.stage-guide { stroke-dasharray: 2 5; }
.stage-em { stroke: var(--accent); stroke-width: calc(3.25px * var(--sw) / var(--zs, 1)); }
/* the steps' moving runs are stretched, so their stroke is non-scaling, at
   the width the line's other pieces have at this size of the box */
.stage-fig .stage-run { stroke-width: calc(3.25 * var(--sw) * 100cqw / ${VB[2]}); vector-effect: non-scaling-stroke; stroke-linecap: square; }
.stage-fig .stage-tone { fill: color-mix(in srgb, var(--fg) 7%, transparent); stroke: none; }
.stage-fig .stage-dotfill { fill: var(--fg); stroke: none; }
.stage-fig .stage-block { fill: color-mix(in srgb, var(--fg) 7%, transparent); stroke: var(--fg); stroke-width: 1.6px; vector-effect: non-scaling-stroke; }
.stage-node { fill: color-mix(in srgb, var(--accent) calc(var(--on) * 100%), var(--ground, var(--bg))); stroke: color-mix(in srgb, var(--accent) calc(var(--on) * 100%), var(--fg)); stroke-width: 1.6px; vector-effect: non-scaling-stroke; }
.stage-lb { position: absolute; translate: -50% -50%; font: 600 var(--t-label)/1.15 var(--text); white-space: nowrap; color: color-mix(in srgb, var(--fg) calc(var(--on) * 100%), var(--fg-2)); }
.stage-lb1 { translate: 0 -50%; }
.stage-lb3 { translate: -100% -50%; }
@container stage-box (max-width: 399px) { .stage-lb { font-size: 0.75rem; } }
.stage-ctl, .stage-step { flex: none; display: flex; align-items: center; gap: var(--s3); height: 44px; }
.stage-btn { flex: none; position: relative; display: grid; place-items: center; width: 44px; height: 44px; margin-left: -6px; padding: 0; border: 0; border-radius: var(--r-pill); background: none; color: var(--fg); cursor: pointer; transition: scale var(--dur-press) var(--ease-out); }
/* the ring is 32px; the button stays a 44px target */
.stage-btn::before { content: ""; position: absolute; inset: 6px; border-radius: inherit; box-shadow: inset 0 0 0 1px var(--line-strong); transition: box-shadow var(--dur-quick) var(--ease-out); }
.stage-step .stage-btn { margin: 0; }
.stage-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
.stage-btn:active { scale: 0.97; }
.stage-btn[aria-disabled="true"] { color: var(--fg-2); cursor: default; }
.stage-btn[aria-disabled="true"]::before { box-shadow: inset 0 0 0 1px var(--line); }
.stage-segs { flex: 1; min-width: 0; display: flex; gap: 4px; height: 44px; }
.stage-seg { min-width: 0; padding: 0; border: 0; background: transparent; cursor: pointer; display: flex; align-items: center; }
.stage-seg i { display: block; width: 100%; height: 2px; border-radius: 1px; overflow: hidden; background: color-mix(in srgb, var(--fg) 18%, transparent); }
/* scenes seen are ink; only the scene in play fills in ember */
.stage-seg b { display: block; height: 100%; background: color-mix(in srgb, var(--fg) 55%, transparent); transform-origin: left; }
.stage-seg[aria-current] b { background: var(--accent); }
.stage-seg:focus-visible { outline-offset: -8px; }
@media (hover: hover) { .stage-seg:hover i { background: color-mix(in srgb, var(--fg) 26%, transparent); } }
.stage-count { flex: 1; margin: 0; text-align: center; font-size: var(--t-small); line-height: 1.3; color: var(--fg-2); font-variant-numeric: tabular-nums; }
@media (hover: hover) { .stage-btn:not([aria-disabled="true"]):hover::before { box-shadow: inset 0 0 0 1px var(--fg-2); } }
/* without the engine there is nothing to drive the controls, so they hide;
   in low motion the stepper stands in for the bar */
.stage:not([data-state]) :is(.stage-ctl, .stage-step), .stage-step,
html[data-motion="low"] .stage-ctl { display: none; }
html[data-motion="low"] .stage[data-state] .stage-step { display: flex; }
@media (min-width: 1100px) {
  .stage { grid-column: 7 / span 6; margin: 0; gap: var(--s4); }
  .stage-words { min-height: calc(3 * 1.2em); font-size: 1.5rem; line-height: 1.2; }
}
`;
