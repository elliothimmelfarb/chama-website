import { html, raw } from "../html.js";
import { SITE, pageById } from "../site.js";
import { page, talkClose, ARROW, OUT } from "../parts/chrome.js";
import { GLYPHS } from "../figures/glyphs.js";
import { work as t } from "../content/en/work.js";
import { logo, CLIENTS } from "../parts/logos.js";

const logoOf = (id) => CLIENTS.find((c) => c.id === id);
const nameOf = (it) => (SITE.laMetalNamed && it.nameNamed ? it.nameNamed : it.name);
const external = (href) => /^https?:/.test(href);

// Each offer's group is a pair frame: its name and glyph stand sticky on
// the left while its rows pass on the right, so no frame is a bare list.
const STYLE = raw(`<style>
.wk { padding: calc(56px + var(--s7)) 0 0; }
.wk-head .lead { margin-top: var(--s4); }
.wk .frame { padding: 0; margin-top: var(--s7); }
.wk-group { scroll-margin-top: 88px; }
.wk .talk-close { padding-top: var(--s8); }
.wk-group h2 { font-size: var(--t-h2); max-width: 20ch; }
.wk-offer { display: grid; justify-items: start; gap: var(--s3); text-decoration: none; }
.wk-offer .g { width: 40px; height: 40px; }
@media (hover: hover) { .wk-offer { transition: color var(--dur-quick) var(--ease-out); } .wk-offer:hover { color: var(--accent-text); } }
.wk-list { list-style: none; margin: 0; padding: 0; }
.wk-row a { display: grid; grid-template-columns: minmax(0, 1fr) 20px; grid-template-areas: "name arr" "line arr" "logo arr"; column-gap: var(--s4); align-items: center; padding: var(--s4) 0; border-top: 1px solid var(--line); text-decoration: none; scroll-margin-top: 88px; }
.wk-row:last-child a { border-bottom: 1px solid var(--line); }
.wk-name { grid-area: name; font-size: var(--t-h3); }
.wk-line { grid-area: line; margin-top: 4px; font-size: var(--t-small); line-height: 1.4; color: var(--fg-2); max-width: 60ch; }
.wk-logo { grid-area: logo; margin-top: var(--s3); }
.wk-row .logo { width: calc(var(--lw) * 0.7px); height: calc(var(--lh) * 0.7px); }
.wk-row .arr { grid-area: arr; width: 20px; height: 20px; color: var(--accent-text); transition: translate var(--dur-quick) var(--ease-spring); }
.wk-row a:active { scale: 0.99; }
@media (hover: hover) {
  .wk-row a { transition: background-color var(--dur-quick) var(--ease-out), scale var(--dur-press) var(--ease-out); }
  .wk-row a:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
  .wk-row a:hover .arr { translate: 3px 0; }
  .wk-row a:hover .arr-out { translate: 2px -2px; }
  .wk-row a:hover .logo { background: var(--fg); }
}
@media (min-width: 1100px) {
  .wk { padding-top: calc(72px + var(--s8)); }
  .wk-head { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: var(--s5); align-items: end; }
  .wk-head h1 { grid-column: 1 / span 7; }
  .wk-head .lead { grid-column: 8 / -1; margin: 0 0 0.6em; }
  .wk .frame { margin-top: var(--s8); }
  .wk-group { scroll-margin-top: 104px; }
  .wk-group > .words { top: calc(72px + var(--s7)); padding-top: var(--s5); }
  .wk-group h2 { font-size: clamp(1.75rem, 0.9rem + 1.5vw, 2.5rem); }
  .wk-offer { gap: var(--s4); }
  .wk-offer .g { width: 56px; height: 56px; }
  .wk-group > .wk-list { grid-column: 5 / -1; }
  .wk-row a { grid-template-columns: minmax(0, 1fr) 9rem 20px; grid-template-areas: "name logo arr" "line logo arr"; padding: var(--s5) var(--s3) var(--s5) 0; }
  .wk-line { font-size: var(--t-body); line-height: 1.45; max-width: none; text-wrap: pretty; }
  .wk-logo { margin: 0; justify-self: end; }
  .wk-row .logo { width: calc(var(--lw) * 0.8px); height: calc(var(--lh) * 0.8px); }
}
</style>`);

export function render(p) {
  const main = html`${STYLE}
<section class="world wk" data-world="paper" data-pin="off" data-fill>
  <div class="wrap">
    <div class="wk-head">
      <h1><span class="half">${t.h1}</span></h1>
      <p class="lead">${t.lead}</p>
    </div>
    ${t.groups.map(
      (g) => html`<section class="wk-group frame" data-layout="pair" id="${g.offer}" aria-labelledby="wk-${g.offer}">
      <div class="words"><h2 id="wk-${g.offer}"><a class="wk-offer" href="${pageById(g.offer).path}">${GLYPHS[g.offer]}<span>${g.h2}</span></a></h2></div>
      <ul class="wk-list">
        ${g.items.map((it) => {
          const l = it.logo && logoOf(it.logo);
          return html`<li class="wk-row" id="${it.id}">${it.also ? html`<span id="${it.also}"></span>` : ""}<a href="${it.href}"${external(it.href) ? raw(' rel="noopener"') : ""}><h3 class="wk-name">${nameOf(it)}</h3><p class="wk-line">${it.line}</p>${l ? html`<span class="wk-logo" aria-hidden="true">${logo(l)}</span>` : ""}${external(it.href) ? OUT : ARROW}</a></li>`;
        })}
      </ul>
    </section>`,
    )}
  </div>
  ${talkClose(t.close)}
</section>`;
  return page(p, t, main);
}

export function text() {
  return [
    `# ${t.h1}`,
    t.lead,
    ...t.groups.flatMap((g) => [`## ${g.h2}`, g.items.map((it) => `- ${nameOf(it)}: ${it.line} (${it.href.startsWith("/") ? SITE.origin + it.href : it.href})`).join("\n")]),
  ].join("\n\n");
}
