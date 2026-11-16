import { html, raw } from "../html.js";
import { SITE } from "../site.js";
import { page, talkClose, ARROW } from "../parts/chrome.js";
import { work as t } from "../content/en/work.js";
import { logo, CLIENTS } from "../parts/logos.js";

const logoOf = (id) => CLIENTS.find((c) => c.id === id);
const nameOf = (it) => (SITE.laMetalNamed && it.nameNamed ? it.nameNamed : it.name);
const external = (href) => /^https?:/.test(href);

const STYLE = raw(`<style>
.wk { padding: calc(56px + var(--s7)) 0 0; }
.wk-head .lead { margin-top: var(--s4); }
.wk-group { margin-top: var(--s8); scroll-margin-top: 88px; }
.wk-group h2 { font-size: var(--t-h2); margin-bottom: var(--s5); max-width: 20ch; }
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
  .wk-row a:hover .logo { background: var(--fg); }
}
@media (min-width: 1100px) {
  .wk { padding-top: calc(72px + var(--s8)); }
  .wk-group { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; scroll-margin-top: 104px; }
  .wk-group h2 { grid-column: 1 / span 4; font-size: var(--t-h3); margin-top: var(--s4); }
  .wk-list { grid-column: 5 / span 8; }
  .wk-row a { grid-template-columns: minmax(0, 1fr) 140px 20px; grid-template-areas: "name logo arr" "line logo arr"; padding: var(--s5) var(--s3) var(--s5) 0; }
  .wk-logo { margin: 0; justify-self: end; }
  .wk-row .logo { width: calc(var(--lw) * 0.8px); height: calc(var(--lh) * 0.8px); }
}
</style>`);

export function render(p) {
  const main = html`${STYLE}
<section class="world wk" data-world="paper" data-pin="off" data-strip>
  <div class="wrap">
    <div class="wk-head">
      <h1><span class="half">${t.h1}</span></h1>
      <p class="lead">${t.lead}</p>
    </div>
    ${t.groups.map(
      (g) => html`<section class="wk-group" id="${g.offer}" aria-labelledby="wk-${g.offer}">
      <h2 id="wk-${g.offer}">${g.h2}</h2>
      <ul class="wk-list">
        ${g.items.map((it) => {
          const l = it.logo && logoOf(it.logo);
          return html`<li class="wk-row" id="${it.id}"><a href="${it.href}"${external(it.href) ? raw(' rel="noopener"') : ""}><h3 class="wk-name">${nameOf(it)}</h3><p class="wk-line">${it.line}</p>${l ? html`<span class="wk-logo" aria-hidden="true">${logo(l)}</span>` : ""}${ARROW}</a></li>`;
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
