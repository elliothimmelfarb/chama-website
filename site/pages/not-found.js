import { html, raw } from "../html.js";
import { PAGES } from "../site.js";
import { page, talkClose, ARROW } from "../parts/chrome.js";
import { notFound as t } from "../content/en/not-found.js";
import { common as c } from "../content/en/common.js";
import { GLYPHS } from "../figures/glyphs.js";

// Paper burning through to ember (docs/DESIGN.md, "Other pages"): the
// words and the five pages on paper, Talk to us on the ember below.
const STYLE = raw(`<style>
.nf { padding: calc(56px + var(--s7)) 0 var(--s9); }
/* The burn's rim waves about 200px above the next ground's edge. */
:root:not([data-motion="low"]) :is(.nf) { padding-bottom: calc(var(--s9) + 160px); }
.nf .lead { margin-top: var(--s4); }
.nf-doors { list-style: none; margin: var(--s7) 0 0; padding: 0; max-width: 46rem; }
.nf-doors a { display: grid; grid-template-columns: 36px minmax(0, 1fr) 20px; align-items: center; gap: var(--s3); min-height: 64px; padding: 12px 0; text-decoration: none; border-top: 1px solid var(--line); }
.nf-doors li:last-child a { border-bottom: 1px solid var(--line); }
.nf-doors .g { width: 36px; height: 36px; }
.nf-doors h2 { font-size: var(--t-h3); line-height: 1.15; letter-spacing: -0.015em; }
.nf-doors p { margin-top: 2px; font-size: var(--t-small); line-height: 1.35; color: var(--fg-2); }
.nf-doors .arr { width: 20px; height: 20px; color: var(--accent-text); transition: translate var(--dur-quick) var(--ease-spring); }
.nf-doors a:active { scale: 0.99; }
@media (hover: hover) {
  .nf-doors a { transition: background-color var(--dur-quick) var(--ease-out), scale var(--dur-press) var(--ease-out); }
  .nf-doors a:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
  .nf-doors a:hover .arr { translate: 3px 0; }
}
@media (min-width: 1100px) { .nf { padding-top: calc(72px + var(--s9)); } }
</style>`);

export function render(p) {
  const pages = PAGES.filter((x) => x.nav);
  const main = html`${STYLE}
<section class="world nf" data-world="paper" data-pin="off" data-strip>
  <div class="wrap">
    <h1><span class="half">${t.h1}</span></h1>
    <p class="lead">${t.lead}</p>
    <nav aria-label="${t.pagesLabel}">
      <ul class="nf-doors">
        ${pages.map((x) => html`<li><a href="${x.path}">${GLYPHS[x.id] || html`<span aria-hidden="true"></span>`}<div><h2>${c.navLabels[x.id]}</h2><p>${c.menuLines[x.id]}</p></div>${ARROW}</a></li>`)}
      </ul>
    </nav>
  </div>
</section>
<section class="world end" data-world="ember" data-pin="off" data-strip>
  ${talkClose(t.close)}
</section>`;
  return page(p, t, main);
}

export function text() {
  return "";
}
