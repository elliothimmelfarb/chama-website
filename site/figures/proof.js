// The note-to-live chart: four real, measured LA Metal requests on an
// hour-long axis (docs/DESIGN.md, "Proof"). Bars grow with --p in full
// motion; without --p they are drawn at their value.
import { html } from "../html.js";

// Measured 2026-11-16 (feedback note filed to change live in production).
export const EXAMPLES = [
  { label: "A fix", minutes: 14 },
  { label: "A new filter", minutes: 31 },
  { label: "A new report", minutes: 33 },
  { label: "Download to Excel", minutes: 42 },
];

export function proofChart({ caption, captionClass = "", label = "Time from request to live, in minutes" } = {}) {
  return html`<figure class="bars" aria-label="${label}">
  <div class="bars-axis" aria-hidden="true"><span>0</span><span>15 min</span><span>30 min</span><span>45 min</span><span>1 hour</span></div>
  <ol class="bars-list">
    ${EXAMPLES.map(
      (e, i) => html`<li style="--v:${e.minutes / 60};--i:${i}"><span class="bars-label">${e.label}</span><span class="bars-value num" data-p>${e.minutes} min</span><span class="bars-bar" data-p aria-hidden="true"></span></li>`,
    )}
  </ol>
  ${caption ? html`<figcaption class="small${captionClass ? ` ${captionClass}` : ""}">${caption}</figcaption>` : ""}
</figure>`;
}
