// Two still figures on /engineering-department that draw what their words
// say. Both sit in worlds that scroll, so neither reads --p.
import { html, raw } from "../html.js";
import { place, shape, subject, FIT_GAP, TICK } from "./kit.js";

// Before and after: what the plant ran on, an
// old system's window, a second app and four spreadsheets in a loose pile
// on one shadow, three lines gathering them into one point, and the one
// system that replaced them: the protagonist, owned, so it is warm.
const BA_VIEW = [0, 0, 440, 330];
const SHEETS = [[22, 176, -6], [70, 196, 3], [116, 172, -2], [64, 236, 5]];
const sheet = ([x, y, r]) => `<g transform="translate(${x} ${y}) rotate(${r} 32 23)"><rect class="pl-sheet" width="64" height="46"/><path class="pl-grid" d="M0 12H64M0 23H64M0 34H64M21 0V46M42 0V46"/></g>`;
const ONE = { R: 64, at: [346, 168] };

export function beforeAfter({ after, label }) {
  const bottom = ONE.at[1] + Math.max(...shape(ONE.R).map((p) => p[1])) + (FIT_GAP + TICK) * ONE.R;
  return html`<figure class="fx pl-fig" role="img" aria-label="${label}">
  ${raw(`<svg class="fx-svg pl-svg" viewBox="${BA_VIEW.join(" ")}" aria-hidden="true" focusable="false">
    <defs><radialGradient id="pl-pile"><stop offset="0" class="fx-s-shadow"/><stop offset="1" class="fx-s-clear"/></radialGradient></defs>
    <ellipse class="fx-floor" fill="url(#pl-pile)" cx="104" cy="292" rx="104" ry="13"/>
    <rect class="pl-old" x="20" y="72" width="132" height="88"/><rect class="pl-bar" x="20" y="72" width="132" height="15"/>
    <rect class="pl-old" x="168" y="96" width="38" height="66" rx="7"/>
    ${SHEETS.map(sheet).join("")}
    <path class="fx-hair pl-gather" d="M156 116C196 116 208 150 238 166M212 166H238M186 236C212 236 216 182 238 166"/>
    <path class="pl-head" d="M238 159L252 166L238 173Z"/>
    ${subject({ ...ONE, owned: true, drawn: true })}
  </svg>`)}
  <span class="fx-lb is-live" aria-hidden="true" style="${`${place(BA_VIEW, ONE.at[0], bottom + 12)};--ty:0%`}">${after}</span>
</figure>`;
}

// How it starts and how it is paid for, under the price: your old system
// running as a hatched band until the third step, where you switch it off
// and the setup fee falls due (an ember tag), then the monthly fee as even
// ticks on a band that runs on. HTML, so the steps' sentences wrap: across
// the page on a desktop, down the column on a phone.
export function priceLine({ steps, old, setup, monthly, label }) {
  return html`<figure class="pr-fig" role="img" aria-label="${label}">
  <ol class="pr-line" aria-hidden="true">
    ${steps.map(
      (s, i) => html`<li class="${`pr-step${i === steps.length - 1 ? " is-due" : ""}`}">${i < steps.length - 1 ? html`<i class="pr-old">${i ? "" : html`<span>${old}</span>`}</i>` : html`<b class="pr-tag">${setup}</b>`}<span class="pr-text">${s}</span></li>`,
    )}
    <li class="pr-month"><i class="pr-run"></i><span class="pr-text">${monthly}</span></li>
  </ol>
</figure>`;
}
