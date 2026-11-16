// Buying software against having your own engineers (docs/DESIGN.md section
// 7, /engineering-department row 2). Left: customers queue at one software
// company and the queue moves up one step. Right: one business with its own
// ember outline, which refits when the business changes shape: the new
// outline draws in before the old one goes, so an ember outline is always
// there. Complete at
// --p 1.
import { html, raw } from "../html.js";

const n = (v) => +v.toFixed(4);
const c = (a, b) => `clamp(0, (var(--p) - ${n(a)}) / ${n(b - a)}, 1)`;
// the queue's one step, eased in and out
const STEP = `(${c(0.25, 0.6)} * ${c(0.25, 0.6)} * (3 - 2 * ${c(0.25, 0.6)}))`;

const pent = (r) => {
  const pts = [0, 1, 2, 3, 4].map((k) => {
    const a = ((-90 + 72 * k) * Math.PI) / 180;
    return `${n(r * Math.cos(a))} ${n(r * Math.sin(a))}`;
  });
  return `M${pts.join(" L")} Z`;
};
const hex = (r) => {
  const pts = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = ((-90 + 60 * k) * Math.PI) / 180;
    return `${n(r * Math.cos(a) * (k === 1 || k === 2 ? 1.12 : 1))} ${n(r * Math.sin(a))}`;
  });
  return `M${pts.join(" L")} Z`;
};

const GAP = 30, FRONT = 138;
// five customers: four waiting and one that joins at the back as the
// queue moves up; the front one goes in to the company and fades
const queue = [0, 1, 2, 3, 4]
  .map((k) => {
    const x = FRONT - GAP * k;
    const fade = k === 0 ? `opacity:calc(1 - ${c(0.3, 0.42)});` : k === 4 ? `opacity:${c(0.3, 0.55)};` : "";
    return `<path class="cx-q" data-p d="${pent(10)}" transform="translate(${x} 92)" style="${fade}translate:calc(${STEP} * ${GAP}px) 0"/>`;
  })
  .join("\n  ");

const svg = raw(`<svg class="cx-svg" viewBox="0 0 460 170" aria-hidden="true" focusable="false">
  <rect class="cx-co" x="170" y="50" width="84" height="84"/>
  ${queue}
  <path class="cx-rule" d="M290 24 V160"/>
  <g transform="translate(378 92)">
    <path class="cx-you" data-p d="${pent(36)}" style="opacity:calc(1 - ${c(0.45, 0.55)})"/>
    <path class="cx-you" data-p d="${hex(36)}" style="opacity:${c(0.45, 0.55)}"/>
    <path class="cx-fit" data-p d="${pent(46)}" style="opacity:calc(1 - ${c(0.55, 0.65)})"/>
    <path class="cx-fit" data-p pathLength="1" d="${hex(46)}" style="stroke-dashoffset:calc(1 - ${c(0.4, 0.6)})"/>
  </g>
</svg>`);

export function contrast({ them, you, label }) {
  return html`<figure class="cx" role="group" aria-label="${label}">
  ${svg}
  <figcaption class="cx-labels"><span>${them}</span><span>${you}</span></figcaption>
</figure>`;
}
