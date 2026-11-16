// You own it (docs/DESIGN.md section 7, /engineering-department row 6): the
// software's ember outline lifts out of our ring and sets down around your
// business in yours. Complete at --p 1, with the outline in your ring.
import { html, raw } from "../html.js";
import { n } from "./kit.js";

const t = "clamp(0, (var(--p) - 0.15) / 0.6, 1)";
// eased in and out along the arc
const MOVE = `(${t} * ${t} * (3 - 2 * ${t}))`;
const ARC = "M-110 0 C -70 -110 70 -110 110 0";

const pent = (r) =>
  "M" +
  [0, 1, 2, 3, 4]
    .map((k) => {
      const a = ((-90 + 72 * k) * Math.PI) / 180;
      return `${n(r * Math.cos(a))} ${n(r * 0.8 * Math.sin(a))}`;
    })
    .join(" L") +
  " Z";

const svg = raw(`<svg class="own-svg" viewBox="-210 -100 420 170" aria-hidden="true" focusable="false">
  <ellipse class="own-ours" cx="-110" cy="0" rx="86" ry="50"/>
  <ellipse class="own-yours" cx="110" cy="0" rx="86" ry="50"/>
  <path class="own-biz" d="${pent(24)}" transform="translate(110 0)"/>
  <path class="own-fit" data-p d="${pent(34)}" style="offset-path:path('${ARC}');offset-rotate:0deg;offset-distance:calc(${MOVE} * 100%)"/>
</svg>`);

export function own({ ours, yours }) {
  return html`<figure class="own-fig">
  ${svg}
  <figcaption class="own-labels"><span>${ours}</span><span>${yours}</span></figcaption>
</figure>`;
}
