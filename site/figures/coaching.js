// The two figures on /coaching (docs/DESIGN.md section 7). Both are drawn
// complete at --p 1, so they are whole wherever nothing writes --p. Their
// styles live in site/pages/coaching.js.
import { html, raw, escape } from "../html.js";

// The mark, drawn in ink inside the session ring.
const MARK_PATHS = `<path d="M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z"/><path d="M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z"/>`;

// You arrive unsure (a tangle), a session (the mark in a ring), you leave
// with a direction (a straight ember line). The tangle draws, the ring
// turns and the line runs out of it as the world is held.
export function coachingFigure({ labels, alt }) {
  return html`<figure class="coaching-fig">
  ${raw(`<svg viewBox="0 0 640 200" role="img" aria-label="${escape(alt)}" focusable="false">
    <path class="cf-tangle" data-p pathLength="1" d="M20 118C36 44 112 52 92 112S18 158 42 98 152 34 138 112 66 150 112 78 206 58 192 122 136 142 170 88 238 78 266 100"/>
    <circle class="cf-ring" data-p cx="320" cy="100" r="52"/>
    <g class="cf-mark" data-p transform="translate(299 79) scale(0.66)">${MARK_PATHS}</g>
    <path class="cf-line" data-p pathLength="1" d="M374 100H612"/>
    <path class="cf-head" data-p d="M598 88 612 100 598 112"/>
  </svg>`)}
  <figcaption class="cf-labels" aria-hidden="true">${labels.map((l) => html`<span>${l}</span>`)}</figcaption>
</figure>`;
}

// Where Elliot sets thinking effort: extra high on the older models, and
// on the current ones the ember marker slides down to medium.
export function effortFigure({ alt, rows, levels }) {
  const scale = html`<span class="ef-levels">${levels.map((l) => html`<span>${l}</span>`)}</span>`;
  return html`<figure class="effort-fig" role="img" aria-label="${alt}">
  <div class="ef-row" aria-hidden="true">
    <span class="ef-name">${rows[0]}</span>
    <span class="ef-track"><span class="ef-ticks"></span><span class="ef-at ef-then"><i></i></span></span>
    ${scale}
  </div>
  <div class="ef-row" aria-hidden="true">
    <span class="ef-name">${rows[1]}</span>
    <span class="ef-track"><span class="ef-ticks"></span><span class="ef-ghost"></span><span class="ef-at ef-now" data-p><i></i></span></span>
    ${scale}
  </div>
</figure>`;
}
