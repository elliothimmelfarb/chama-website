import { html, raw } from "../html.js";
import { page, talkClose } from "../parts/chrome.js";
import { about as t } from "../content/en/about.js";
import { logo, PARTNERS } from "../parts/logos.js";
import { markDraw, MARK_DRAW_CSS } from "../figures/about.js";

const photo = (alt) => html`<img class="photo ab-photo" src="/assets/family-2026-720.webp" srcset="/assets/family-2026-480.webp 480w, /assets/family-2026-720.webp 720w, /assets/family-2026-960.webp 960w, /assets/family-2026-1440.webp 1440w" sizes="(min-width: 1100px) 40vw, calc(100vw - 32px)" width="2048" height="1804" alt="${alt}" fetchpriority="high" decoding="async">`;

// A hyphenated word in the H1 never breaks at its hyphen ("family- /
// owned" read badly), so each one is kept whole.
const keepHyphens = (line) =>
  line.split(" ").map((w, i) => html`${i ? " " : ""}${w.includes("-") ? html`<span class="ab-nobr">${w}</span>` : w}`);

const partnerOf = (id) => PARTNERS.find((p) => p.id === id);

// Elliot's background as four points on a line, from the paragraph beside
// it; the latest in ember.
const timeline = (points) => html`<ol class="ab-line" aria-hidden="true">
  ${points.map((pt, i) => html`<li${i === points.length - 1 ? raw(' class="ab-now"') : ""}><b>${pt.when}</b><span>${pt.what}</span></li>`)}
</ol>`;

// Three grounds, two changes of ground: paper (who we are, the family), ember (Elliot,
// then the partners), tides (the name, then Talk to us).
const STYLE = raw(`<style>
.ab-nobr { white-space: nowrap; }
.ab-first { padding: calc(56px + var(--s7)) 0 var(--s9); }
.ab-first-grid { display: grid; gap: var(--s6); }
.ab-first .lead { margin-top: var(--s4); }
.ab-photo-wrap { margin: 0; }
.ab-photo-wrap figcaption { margin-top: var(--s3); }
@keyframes ab-settle { from { scale: 1.04; } }
:root:not([data-motion="low"]) .ab-photo { animation: ab-settle var(--dur-arrive) var(--ease-out) both; }
.ab-block { margin-top: var(--s8); max-width: 46rem; }
.ab-block h2 { max-width: 22ch; }
.ab-block > p { margin-top: var(--s4); max-width: 60ch; color: var(--fg-2); font-size: var(--t-lead); line-height: 1.5; text-wrap: pretty; }
.ab-block > p + p { margin-top: var(--s3); }
/* The next ground's soft edge reaches about a fifth of a screen above it. */
:root:not([data-motion="low"]) :is(.ab-first, .ab-elliot) { padding-bottom: calc(var(--s9) + 160px); }
:root:not([data-motion="low"]) .ab-elliot { padding-top: calc(var(--s9) + 120px); }

.ab-elliot { padding: var(--s9) 0; }
.ab-elliot .ab-block:first-child { margin-top: 0; }
.ab-plist { list-style: none; margin: var(--s6) 0 0; padding: 0; }
.ab-plist li { display: grid; gap: var(--s2); padding: var(--s5) 0; border-top: 1px solid var(--line); }
.ab-plist li:last-child { border-bottom: 1px solid var(--line); }
/* Sized by area, as the logo strip is, with a taller cap: these marks
   carry a partner's name, not a row of clients. */
.ab-plist .logo { width: calc(var(--lw) * 1.3px); height: calc(var(--lh) * 1.3px); max-height: 32px; max-width: calc(32px * var(--lw) / var(--lh)); margin-bottom: var(--s2); }
.ab-plist h3 a { text-decoration: none; }
.ab-plist h3 a:focus-visible, .ab-plist h3 a:hover { text-decoration: underline; text-decoration-color: var(--accent-text); text-underline-offset: 3px; }
.ab-where { color: var(--fg-2); font-size: var(--t-small); }
.ab-plist p.ab-text { color: var(--fg-2); max-width: 60ch; margin-top: var(--s1); }

.ab-line { list-style: none; margin: var(--s6) 0 0; padding: 0 0 0 22px; position: relative; display: grid; gap: var(--s5); }
.ab-line::before { content: ""; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 1.5px; background: var(--line-strong); }
.ab-line li { position: relative; display: grid; gap: 2px; font-size: var(--t-small); line-height: 1.35; color: var(--fg-2); }
.ab-line li::before { content: ""; position: absolute; left: -22px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: var(--ground, var(--bg)); box-shadow: inset 0 0 0 1.5px var(--fg); }
.ab-line li.ab-now::before { background: var(--accent); box-shadow: none; }
.ab-line b { font: 600 var(--t-label)/1.2 var(--text); color: var(--fg); }

.ab-name > .pin { display: flex; align-items: center; }
.ab-name-grid { display: grid; gap: var(--s6); align-items: center; }
.ab-name-fig { width: min(40vw, 160px); }
.ab-name .lead { margin-top: var(--s4); }
${MARK_DRAW_CSS}

@media (min-width: 1100px) {
  .ab-first { padding-top: calc(72px + var(--s8)); }
  .ab-first-grid { grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: end; }
  .ab-first-words { grid-column: 1 / span 6; padding-bottom: var(--s7); }
  .ab-photo-wrap { grid-column: 8 / span 5; }
  /* Ember on desktop: each heading on the left, its words on the right,
     so the world is not a column with an empty right half. */
  .ab-split { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; max-width: none; }
  .ab-split > h2 { grid-column: 1 / span 5; }
  /* the timeline stands under the heading, in the left half */
  .ab-split > .ab-line { grid-column: 1 / span 4; grid-row: 2 / span 4; align-self: start; margin-top: var(--s7); }
  .ab-split > :not(h2) { grid-column: 7 / span 6; }
  .ab-split > p:first-of-type { margin-top: 0; }
  .ab-split > h2 + p { grid-row: 1; }
  .ab-plist .logo { width: calc(var(--lw) * 1.6px); height: calc(var(--lh) * 1.6px); max-height: 44px; max-width: calc(44px * var(--lw) / var(--lh)); }
  .ab-name-grid { grid-template-columns: repeat(12, 1fr); column-gap: 24px; }
  .ab-name-grid > div { grid-column: 1 / span 6; }
  .ab-name-grid > .ab-name-fig { grid-column: 9 / span 3; width: 100%; max-width: 260px; }
}
</style>`);

export function render(p) {
  const main = html`${STYLE}
<section class="world ab-first" data-world="paper" data-pin="off">
  <div class="wrap">
    <div class="ab-first-grid">
      <div class="ab-first-words">
        <h1><span class="half">${keepHyphens(t.h1)}</span></h1>
        <p class="lead">${t.lead}</p>
      </div>
      <figure class="ab-photo-wrap">${photo(t.photoAlt)}<figcaption class="small">${t.caption}</figcaption></figure>
    </div>
    <div class="ab-block">
      <h2>${t.family.h2}</h2>
      ${t.family.paras.map((x) => html`<p>${x}</p>`)}
    </div>
  </div>
</section>

<section class="world ab-elliot" data-world="ember" data-pin="off">
  <div class="wrap">
    <div class="ab-block ab-split">
      <h2>${t.elliot.h2}</h2>
      ${t.elliot.paras.map((x) => html`<p>${x}</p>`)}
      ${timeline(t.elliot.timeline)}
    </div>
    <div class="ab-block ab-split">
      <h2>${t.partners.h2}</h2>
      <p>${t.partners.lead}</p>
      <ul class="ab-plist">
        ${t.partners.items.map((it) => {
          const l = partnerOf(it.id);
          return html`<li>${l ? logo(l) : ""}<h3><a href="${it.href}" rel="noopener">${it.name}</a></h3><p class="ab-where">${it.where}</p><p class="ab-text">${it.text}</p></li>`;
        })}
      </ul>
    </div>
  </div>
</section>

<section class="world ab-name" data-world="tides" style="--h:180">
  <div class="pin"><div class="wrap ab-name-grid">
    <div>
      <h2 class="r">${t.name.h2}</h2>
      <p class="lead r">${t.name.lead}</p>
    </div>
    <div class="ab-name-fig r fig">${markDraw()}</div>
  </div></div>
</section>

<section class="world end" data-world="tides" data-pin="off">
  ${talkClose(t.close)}
</section>`;
  return page(p, t, main);
}

export function text() {
  return [
    `# ${t.h1}`,
    t.lead,
    t.caption,
    `## ${t.family.h2}`,
    ...t.family.paras,
    `## ${t.elliot.h2}`,
    ...t.elliot.paras,
    `## ${t.partners.h2}`,
    t.partners.lead,
    ...t.partners.items.map((it) => `- ${it.name} (${it.where}): ${it.text} ${it.href}`),
    `## ${t.name.h2}`,
    t.name.lead,
  ].join("\n\n");
}
