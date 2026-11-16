import { html, raw } from "../html.js";
import { page, talkClose } from "../parts/chrome.js";
import { about as t } from "../content/en/about.js";
import { logo, PARTNERS } from "../parts/logos.js";
import { markDraw } from "../figures/about.js";
import { STAGE_BUTTONS_CSS } from "../figures/coaching.js";

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

// Three worlds on three grounds, every one in a .frame (worlds.css), none
// pinned: nothing on this page moves with the scroll. Paper: who we are and
// the family, the photo standing beside the words the whole way down. Ember:
// Elliot, then the partners, each heading standing beside its text. Tides:
// the name, its mark drawing itself once in view, and Talk to us.
const STYLE = raw(`<style>
.ab-nobr { white-space: nowrap; }
.about-page .words > .lead { margin-top: var(--s4); }
.ab-text > p { color: var(--fg-2); font-size: var(--t-lead); line-height: 1.5; max-width: 60ch; text-wrap: pretty; }
.ab-text > * + p { margin-top: var(--s4); }
.ab-text > h2 + p { margin-top: var(--s4); }

/* paper: the words, then the family, beside the photo, which stands while they scroll */
.world.ab-first > .pin > .frame { padding-top: calc(var(--head) + var(--s7)); padding-bottom: var(--s9); row-gap: var(--s8); }
/* the photo stands here, not the words: they scroll with the family under them */
.ab-first .frame > .words { align-self: end; position: static; }
.ab-photo-wrap { margin: 0; }
.ab-photo-wrap figcaption { margin-top: var(--s3); }
@keyframes ab-settle { from { scale: 1.04; } }
:root:not([data-motion="low"]) .ab-photo { animation: ab-settle var(--dur-arrive) var(--ease-out) both; }

/* ember: two pairs, each heading standing while its text scrolls */
.ab-elliot > .pin > .frame + .frame { margin-top: var(--s9); }
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
/* the latest point: ember, ringed in the ground so the line stops short of it */
.ab-line li.ab-now::before { background: var(--accent); box-shadow: 0 0 0 3px var(--ground, var(--bg)); }
.ab-line b { font: 600 var(--t-label)/1.2 var(--text); color: var(--fg); }

/* tides: the name and Talk to us, the mark beside them */
.ab-name .talk-close { padding: 0; margin: var(--s8) 0 0; }
.md { width: 100%; }
.md .replay { right: -56px; }
.md-line { fill: none; stroke: var(--accent); stroke-width: 0.6; }
.md-fill, .md-spark { fill: var(--accent); }
${STAGE_BUTTONS_CSS}

@media (min-width: 760px) and (min-aspect-ratio: 9/10) {
  .ab-first .frame > .words { grid-column: 1 / span 6; grid-row: 1; }
  .ab-first .frame > .ab-family { grid-column: 1 / span 6; grid-row: 2; }
  .ab-first .frame > .fig { grid-column: 8 / -1; grid-row: 1 / span 2; align-self: start; position: sticky; top: calc(var(--head) + var(--s6)); }
  .ab-elliot .frame > .words { grid-column: 1 / span 5; }
  .ab-elliot .frame > :not(.words) { grid-column: 7 / -1; }
  .ab-plist .logo { width: calc(var(--lw) * 1.6px); height: calc(var(--lh) * 1.6px); max-height: 44px; max-width: calc(44px * var(--lw) / var(--lh)); }
  /* the mark fills its cell, by height: the cell is wider than the mark is */
  .ab-name .frame { --fig-h: min(56svh, 30rem); }
}
@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  .world.ab-first > .pin > .frame { padding-top: calc(var(--head) + var(--s6)); row-gap: var(--s6); }
  /* the mark above its words, at 60% of the column */
  .ab-name .frame > .fig { order: -1; }
  .ab-first .frame > .fig > img { width: 100%; }
  .ab-name .frame { --fig-h: 30svh; }
}
</style>`);

export function render(p) {
  const main = html`${STYLE}
<section class="world first ab-first about-page" data-world="paper" data-pin="off" data-pad="off" data-fill>
  <div class="pin"><div class="frame" data-layout="pair">
    <div class="words">
      <h1><span class="half">${keepHyphens(t.h1)}</span></h1>
      <p class="lead">${t.lead}</p>
    </div>
    <figure class="fig ab-photo-wrap" style="--ar:1.135">${photo(t.photoAlt)}<figcaption class="small">${t.caption}</figcaption></figure>
    <div class="ab-text ab-family">
      <h2>${t.family.h2}</h2>
      ${t.family.paras.map((x) => html`<p>${x}</p>`)}
    </div>
  </div></div>
</section>

<section class="world ab-elliot about-page" data-world="ember" data-pin="off" data-fill>
  <div class="pin">
    <div class="frame" data-layout="pair">
      <div class="words">
        <h2>${t.elliot.h2}</h2>
        ${timeline(t.elliot.timeline)}
      </div>
      <div class="ab-text">${t.elliot.paras.map((x) => html`<p>${x}</p>`)}</div>
    </div>
    <div class="frame" data-layout="pair">
      <div class="words">
        <h2>${t.partners.h2}</h2>
        <p class="lead">${t.partners.lead}</p>
      </div>
      <ul class="ab-plist">
        ${t.partners.items.map((it) => {
          const l = partnerOf(it.id);
          return html`<li>${l ? logo(l) : ""}<h3><a href="${it.href}" rel="noopener">${it.name}</a></h3><p class="ab-where">${it.where}</p><p class="ab-text">${it.text}</p></li>`;
        })}
      </ul>
    </div>
  </div>
</section>

<section class="world end ab-name about-page" data-world="tides" data-pin="off" data-fill data-label="${t.name.h2}">
  <div class="pin"><div class="frame" data-layout="split">
    <div class="words">
      <h2>${t.name.h2}</h2>
      <p class="lead">${t.name.lead}</p>
      ${talkClose(t.close)}
    </div>
    <div class="fig" style="--ar:${(64 / 68).toFixed(3)}">${markDraw()}</div>
  </div></div>
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
