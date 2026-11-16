import { html, raw } from "../html.js";
import { page, talkClose } from "../parts/chrome.js";
import { about as t } from "../content/en/about.js";
import { logo, PARTNERS } from "../parts/logos.js";
import { markDraw, MARK_DRAW_CSS } from "../figures/about.js";

const photo = (alt) => html`<img class="photo ab-photo" src="/assets/family-2026-720.webp" srcset="/assets/family-2026-480.webp 480w, /assets/family-2026-720.webp 720w, /assets/family-2026-960.webp 960w, /assets/family-2026-1440.webp 1440w" sizes="(min-width: 1100px) 40vw, calc(100vw - 32px)" width="2048" height="1804" alt="${alt}" fetchpriority="high" decoding="async">`;

// The superpowers line arrives a few words at a time as the ember world is
// held: each chunk is an .r with its own --in.
const chunks = (line, size = 3) => {
  const words = line.split(" ");
  const out = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size).join(" "));
  return out;
};

const partnerOf = (id) => PARTNERS.find((p) => p.id === id);

const STYLE = raw(`<style>
.ab-first { padding: calc(56px + var(--s7)) 0 var(--s9); }
.ab-family-grid { margin-top: var(--s8); }
/* The burn's rim waves about 200px above the next ground's edge. */
:root:not([data-motion="low"]) :is(.ab-first, .ab-elliot-more, .ab-partners) { padding-bottom: calc(var(--s9) + 160px); }

.ab-first-grid { display: grid; gap: var(--s6); }
.ab-first .lead { margin-top: var(--s4); }
.ab-photo-wrap { margin: 0; }
.ab-photo-wrap figcaption { margin-top: var(--s3); }
@keyframes ab-settle { from { scale: 1.04; } }
:root:not([data-motion="low"]) .ab-photo { animation: ab-settle var(--dur-arrive) var(--ease-out) both; }
.ab-family-grid h2, .ab-partners h2 { max-width: 22ch; }
.ab-family-grid p, .ab-elliot-more p { margin-top: var(--s4); max-width: 60ch; color: var(--fg-2); font-size: var(--t-lead); line-height: 1.5; text-wrap: pretty; }
.ab-family-grid p + p, .ab-elliot-more p + p { margin-top: var(--s3); }

.ab-elliot { --h: 150; }
.ab-elliot > .pin { display: flex; align-items: center; }
.ab-power { max-width: 18ch; }
.ab-power .r { display: inline-block; }
.ab-elliot-more { padding: var(--s7) 0 var(--s9); }

.ab-partners { padding: var(--s9) 0; }
.ab-partners .lead { margin-top: var(--s4); }
.ab-plist { list-style: none; margin: var(--s7) 0 0; padding: 0; }
.ab-plist li { display: grid; gap: var(--s3); padding: var(--s5) 0; border-top: 1px solid var(--line); }
.ab-plist li:last-child { border-bottom: 1px solid var(--line); }
.ab-plist .logo { width: calc(var(--lw) * 0.8px); height: calc(var(--lh) * 0.8px); }
.ab-plist h3 a { text-decoration: none; }
.ab-plist h3 a:focus-visible, .ab-plist h3 a:hover { text-decoration: underline; text-decoration-color: var(--accent-text); text-underline-offset: 3px; }
.ab-where { color: var(--fg-2); font-size: var(--t-small); margin-top: 2px; }
.ab-plist p.ab-text { color: var(--fg-2); max-width: 60ch; }

.ab-name { --h: 160; }
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
  .ab-family-grid { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; }
  .ab-family-grid > * { grid-column: 1 / span 7; }
  .ab-elliot-more .wrap > * { margin-left: calc((100% + 24px) / 12); }
  .ab-plist li { grid-template-columns: 200px 1fr; column-gap: var(--s6); align-items: start; padding: var(--s6) 0; }
  .ab-plist .logo { width: calc(var(--lw) * 1px); height: calc(var(--lh) * 1px); }
  .ab-plist li > div { grid-column: 2; }
  .ab-plist li > .logo { grid-row: 1 / span 2; }
  .ab-name-grid { grid-template-columns: repeat(12, 1fr); column-gap: 24px; }
  .ab-name-grid > div { grid-column: 1 / span 6; }
  .ab-name-fig { grid-column: 9 / span 3; width: 100%; max-width: 260px; }
}
</style>`);

export function render(p) {
  const power = chunks(t.elliot.h2);
  const main = html`${STYLE}
<section class="world ab-first" data-world="paper" data-pin="off" data-strip>
  <div class="wrap ab-first-grid">
    <div class="ab-first-words">
      <h1><span class="half">${t.h1}</span></h1>
      <p class="lead">${t.lead}</p>
    </div>
    <figure class="ab-photo-wrap">${photo(t.photoAlt)}<figcaption class="small">${t.caption}</figcaption></figure>
  </div>
  <div class="wrap ab-family-grid">
    <div>
      <h2>${t.family.h2}</h2>
      ${t.family.paras.map((x) => html`<p>${x}</p>`)}
    </div>
  </div>
</section>

<section class="world ab-elliot" data-world="ember">
  <div class="pin"><div class="wrap">
    <h2 class="ab-power">${power.map((w, i) => html`<span class="r" style="--in:${(i * 0.14 - 0.1).toFixed(2)}">${w}</span>${i < power.length - 1 ? " " : ""}`)}</h2>
  </div></div>
</section>

<section class="world ab-elliot-more" data-world="ember" data-pin="off" data-strip>
  <div class="wrap">
    ${t.elliot.paras.map((x) => html`<p>${x}</p>`)}
  </div>
</section>

<section class="world ab-partners" data-world="grid" data-pin="off" data-strip>
  <div class="wrap">
    <h2>${t.partners.h2}</h2>
    <p class="lead">${t.partners.lead}</p>
    <ul class="ab-plist">
      ${t.partners.items.map((it) => {
        const l = partnerOf(it.id);
        return html`<li>${l ? logo(l) : ""}<div><h3><a href="${it.href}" rel="noopener">${it.name}</a></h3><p class="ab-where">${it.where}</p></div><p class="ab-text">${it.text}</p></li>`;
      })}
    </ul>
  </div>
</section>

<section class="world ab-name" data-world="tides">
  <div class="pin"><div class="wrap ab-name-grid">
    <div>
      <h2 class="r" style="--in:-0.3">${t.name.h2}</h2>
      <p class="lead r" style="--in:-0.15">${t.name.lead}</p>
    </div>
    <div class="ab-name-fig r" style="--in:-0.3">${markDraw()}</div>
  </div></div>
</section>

<section class="world end" data-world="tides" data-pin="off" data-strip>
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
