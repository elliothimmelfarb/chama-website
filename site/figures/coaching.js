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
  <figcaption class="cf-labels" aria-hidden="true">${labels.map((l, i) => html`<span data-p style="--at:${[0.08, 0.34, 0.6][i]}">${l}</span>`)}</figcaption>
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

// The Hearth: sessions booked along a line, each leaving its record below
// it, the latest record in ember. The words beside it say what it shows.
export function hearthFigure({ sessions, records }) {
  const xs = [40, 110, 180, 250, 320];
  return html`<figure class="hearth-fig">
  ${raw(`<svg viewBox="0 0 360 170" focusable="false">
    <path class="hf-axis" d="M14 30H346"/>
    ${xs.map((x) => `<circle class="hf-dot" cx="${x}" cy="30" r="5"/>`).join("")}
    ${xs
      .map(
        (x, i) => `<g class="hf-rec${i === xs.length - 1 ? " hf-hot" : ""}" data-p style="--at:${(i * 0.07).toFixed(2)}"><path class="hf-tie" d="M${x} 38V58"/><rect x="${x - 24}" y="62" width="48" height="62" rx="5"/><path d="M${x - 14} 80H${x + 14}M${x - 14} 92H${x + 8}M${x - 14} 104H${x + 11}"/></g>`,
      )
      .join("")}
  </svg>`)}
  <figcaption class="hf-labels" aria-hidden="true"><span class="hf-l-s">${sessions}</span><span class="hf-l-r">${records}</span></figcaption>
</figure>`;
}

// Who coaching is for, one small group per row: you and Elliot, a table of
// leaders, an engineering team, a whole company. The ember dot is the coach.
const dots = (pts, hot) => pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === hot ? 3.4 : 2.6}"${i === hot ? ' class="wf-hot"' : ""}/>`).join("");
const ring = Array.from({ length: 14 }, (_, i) => [20 + 14 * Math.cos((i / 14) * 2 * Math.PI - Math.PI / 2), 20 + 14 * Math.sin((i / 14) * 2 * Math.PI - Math.PI / 2)].map((n) => +n.toFixed(2)));
const GROUPS = [
  dots([[13, 20], [27, 20]], 1),
  `<path class="wf-table" d="M11 20H29"/>` + dots([[11, 12], [20, 11], [29, 12], [14, 28], [26, 28]], 1),
  dots([[11, 11], [20, 11], [29, 11], [11, 20], [20, 20], [29, 20], [11, 29], [20, 29], [29, 29]], 4),
  dots([[20, 20], ...ring], 0),
];
export const whoGlyph = (i) => raw(`<svg class="wf" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${GROUPS[i]}</svg>`);

// AI enablement for companies: policy, structure and enablement, three
// slabs stacked as layers, the top one in ember.
export function enablementFigure({ layers }) {
  const slab = (y, hot) => `<path class="en-slab${hot ? " en-hot" : ""}" d="M40 ${y}L180 ${y - 30}L320 ${y}L180 ${y + 30}Z"/><path class="en-side${hot ? " en-hot" : ""}" d="M40 ${y}V${y + 12}L180 ${y + 42}L320 ${y + 12}V${y}"/>`;
  return html`<figure class="en-fig" aria-hidden="true">
  ${raw(`<svg viewBox="0 0 360 240" focusable="false">${slab(176, false)}${slab(116, false)}${slab(56, true)}</svg>`)}
  <figcaption class="en-labels">${[...layers].reverse().map((l) => html`<span>${l}</span>`)}</figcaption>
</figure>`;
}
