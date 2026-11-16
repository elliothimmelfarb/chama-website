// The home page's opening stage. Placeholder: the loop's still (beat 4).
// The full eight-beat stage (docs/DESIGN.md section 11) replaces this.
import { html, raw } from "../html.js";

export function stage({ label }) {
  return html`<figure class="stage" data-stage data-duration="28" aria-label="${label}">
  <p class="stage-words">Tell us what you need. <b>It gets built.</b> You use it. You find what's next.</p>
  ${raw(`<svg class="stage-fig" viewBox="-220 -190 440 380" aria-hidden="true" focusable="false">
    <ellipse cx="0" cy="0" rx="178" ry="150" fill="none" stroke="var(--fg)" stroke-opacity="0.35" stroke-width="1.25" stroke-dasharray="2 7" stroke-linecap="round"/>
    <path d="M0 -104 L99 -32 L64 88 L-62 92 L-101 -30 Z" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" transform="rotate(4)"/>
    <path d="M0 -80 L76 -25 L47 66 L-47 66 L-76 -25 Z" fill="var(--fg)" fill-opacity="0.07" stroke="var(--fg)" stroke-width="1.5" stroke-linejoin="round"/>
    <g fill="var(--bg)" stroke="var(--fg)" stroke-width="1.5"><circle cx="0" cy="-150" r="5"/><circle cx="178" cy="0" r="5"/><circle cx="0" cy="150" r="5"/><circle cx="-178" cy="0" r="5"/></g>
    <path d="M 126 -106 A 178 150 0 0 1 150 -81" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="150" cy="-81" r="7" fill="var(--accent)"/>
  </svg>`)}
</figure>`;
}
