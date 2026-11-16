// Two small figures on /engineering-department that draw what its words
// say. Both are still: they sit in sections that scroll.
import { html, raw } from "../html.js";
import { ngon, poly } from "./kit.js";

// Before and after (docs/DESIGN.md section 8): the systems the plant ran
// on (one old system, a second app, four spreadsheets) drawn as outlines
// in a loose cluster, three lines gathering them, and the one system that
// replaced them as an ember-outlined pentagon.
export function beforeAfter({ before, after, label }) {
  const sheet = (x, y) => `<g transform="translate(${x} ${y})"><rect class="pl-o" width="34" height="26" rx="2"/><path class="pl-l" d="M0 9H34M0 17H34M11 0V26M22 0V26"/></g>`;
  const one = poly(ngon(30).map(([x, y]) => [x + 330, y + 74]));
  const fit = poly(ngon(39).map(([x, y]) => [x + 330, y + 74]));
  return html`<figure class="pl-fig backed" role="img" aria-label="${label}">
  ${raw(`<svg viewBox="0 0 400 150" aria-hidden="true" focusable="false">
    <rect class="pl-o" x="8" y="14" width="78" height="52" rx="3"/><path class="pl-l" d="M8 26H86"/>
    <rect class="pl-o" x="100" y="22" width="24" height="42" rx="4"/>
    ${sheet(10, 84)}${sheet(52, 92)}${sheet(94, 80)}${sheet(136, 96)}
    <path class="pl-gather" d="M176 40C220 40 240 70 270 74M176 74H270M176 112C220 112 240 78 270 74"/>
    <path class="pl-biz" d="${one}"/>
    <path class="pl-fit" d="${fit}"/>
  </svg>`)}
  <figcaption class="pl-labels" aria-hidden="true"><span>${before}</span><span>${after}</span></figcaption>
</figure>`;
}

// How it starts and how it is paid for: the three steps as open circles,
// the third (you switch off the old system) in ember where the setup fee
// falls due, then the monthly fee as even ticks running on and fading.
export function priceLine({ steps, setup, monthly, label }) {
  const xs = [16, 116, 216];
  const ticks = Array.from({ length: 9 }, (_, i) => `<path class="pr-tick" d="M${266 + i * 26} 40V52" style="opacity:${(1 - i / 10).toFixed(2)}"/>`).join("");
  return html`<figure class="pr-fig" role="img" aria-label="${label}">
  ${raw(`<svg viewBox="0 0 500 70" aria-hidden="true" focusable="false">
    <path class="pr-axis" d="M16 46H492"/>
    ${xs.map((x, i) => `<circle class="pr-step${i === 2 ? " pr-hot" : ""}" cx="${x}" cy="46" r="8"/>`).join("")}
    <path class="pr-due" d="M216 30V14"/>
    ${ticks}
  </svg>`)}
  <span class="pr-setup" aria-hidden="true">${setup}</span>
  <ol class="pr-labels" aria-hidden="true">
    ${steps.map((s, i) => html`<li style="${`--x:${xs[i] / 5}%`}">${s}</li>`)}
    <li class="pr-monthly" style="--x:66%">${monthly}</li>
  </ol>
</figure>`;
}
