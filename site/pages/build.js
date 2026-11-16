import { html, raw } from "../html.js";
import { page, talkField, talkClose } from "../parts/chrome.js";
import { build as t } from "../content/en/build.js";
import { rig, SHOPINTAKE_TOP } from "../figures/devices.js";

// Which pictures in assets/built/ show each thing.
const PICTURES = { toraya: "toraya-lisboa", original: "original-site", vsf: "vsf-lead-automation", alves: "alves-teamwear" };

const OUT = raw(
  `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 11 11 5M6 5h5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
);
const LOCK = raw(
  `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3.2" y="7" width="9.6" height="6.8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
);

// The words that stand beside the devices are styled here; the rig, the
// .made grid and its choreography are worlds.css's.
const STYLE = html`<style>
.build-first { padding-bottom: var(--s6); }
.build-first .lead { margin-top: var(--s4); }
.build-first .talk-field { margin-top: var(--s6); }
.build-dev .made-open h2 { max-width: 14ch; }
.build-dev .made-open .lead { margin-top: var(--s4); }
.build-dev .made-words h2 { font-size: var(--t-h2); max-width: 16ch; margin-bottom: var(--s5); }
.build-dev .made-words h3 { font-size: var(--t-h2); line-height: 1.08; letter-spacing: -0.025em; }
.build-dev .made-words h2 + h3 { font-size: var(--t-h3); line-height: 1.15; letter-spacing: -0.015em; }
.build-kind { margin-top: var(--s2); font-size: var(--t-small); color: var(--fg-2); }
.build-what { margin-top: var(--s4); max-width: 44ch; color: var(--fg-2); text-wrap: pretty; }
.build-link { margin-top: var(--s4); font-weight: 600; }
.build-link a { display: inline-flex; align-items: center; gap: 6px; color: var(--accent-text); text-decoration: none; }
.build-link svg, .build-private svg { width: 1em; height: 1em; flex: none; }
@media (hover: hover) { .build-link a:hover { text-decoration: underline; text-underline-offset: 3px; } }
.build-private { display: flex; align-items: flex-start; gap: var(--s2); margin-top: var(--s4); max-width: 40ch; font-size: var(--t-small); font-weight: 500; color: var(--fg); }
.build-private svg { margin-top: 0.15em; color: var(--accent-text); }
.made-ticks a:focus-visible { border-radius: 2px; }
.build-ghost, .build-kind-apps { display: none; }
html:not(.pin) .build-dev .made-stage { max-width: var(--max); padding: var(--s7) var(--gutter) calc(var(--s8) + 20vh); }
html:not(.pin) .build-dev .made:first-of-type { margin-top: var(--s7); }

.build-partner-in { display: grid; gap: var(--s6); align-content: center; height: 100%; padding-top: calc(56px + var(--s4)); padding-bottom: var(--s6); }
html:not(.pin) .build-partner-in { height: auto; padding: 0; }
.build-partner h2 { max-width: 20ch; }
.build-partner .lead { margin-top: var(--s4); }
.build-proof { margin-top: var(--s5); padding-top: var(--s4); border-top: 1px solid var(--line); max-width: 46ch; }
.build-proof h3 { font-size: var(--t-h3); }
.build-proof p { margin-top: var(--s2); color: var(--fg-2); }
.build-shots { max-width: 40rem; width: 100%; }
html.pin .build-shots .rig { opacity: 1; visibility: visible; max-width: none; width: 100%; transform: none; }
.build-rise { transform: translateY(calc((1 - clamp(0, var(--p) * 2.5, 1)) * 16px)); }

@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  .build-dev .made-words h2 { margin-bottom: var(--s3); }
  .build-dev .made-words h3 { font-size: 1.5rem; }
  .build-what { margin-top: var(--s2); font-size: 0.9375rem; line-height: 1.4; }
  .build-kind { margin-top: 2px; }
  .build-link, .build-private { margin-top: var(--s2); }
  /* the opening words stand right under where the first thing's devices
     are, not at the foot of the screen: an invisible rig of the same size
     holds the place (after the h2 in the markup, since drawDevices measures
     the open's first child against the first rig) */
  html.pin .build-dev .made-open { align-content: start; padding-bottom: 0; }
  /* smaller devices, and the apps heading left to one column, so every
     thing's words sit above the grid's horizon */
  html.pin .build-dev .rig { width: calc(min(100%, (100svh - 24.5rem) * 1.75) * var(--fit, 1) * 0.72); }
  html.pin .build-dev .made-words h2 { display: none; }
  html.pin .build-dev .build-kind-apps { display: block; }
  html.pin .build-dev .made-open > .build-ghost { display: block; order: -1; opacity: 0; visibility: hidden; margin-bottom: var(--s3); }
  .build-partner-in { gap: var(--s4); padding-top: calc(56px + var(--s3)); padding-bottom: var(--s4); }
  .build-proof { margin-top: var(--s4); padding-top: var(--s3); }
  .build-proof p { font-size: 0.9375rem; line-height: 1.4; }
  .build-shots { max-width: 13.5rem; }
}
@media (min-width: 1100px) {
  .build-first { padding-top: calc(72px + var(--s9)); }
  .build-partner-in { grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: center; padding-top: 72px; }
  .build-partner-in > :first-child { grid-column: 1 / span 5; }
  .build-partner-in > :last-child { grid-column: 7 / span 6; }
}
</style>`;

const made = (thing, i) => html`<article class="made" id="${thing.id}" aria-labelledby="${thing.id}-name">
  ${rig(PICTURES[thing.id], { lazy: i > 0, first: i === 0 })}
  <div class="made-words">
    ${thing.opensApps ? html`<h2>${t.apps.h2}</h2>` : ""}
    <h3 id="${thing.id}-name">${thing.name}</h3>
    <p class="${thing.opensApps ? "build-kind build-kind-apps" : "build-kind"}">${thing.kind}</p>
    <p class="build-what">${thing.short || thing.text}</p>
    ${thing.href ? html`<p class="build-link"><a href="${thing.href}" rel="noopener" target="_blank">${thing.link}${OUT}</a></p>` : ""}
    ${thing.private ? html`<p class="build-private">${LOCK}<span>${thing.private}</span></p>` : ""}
  </div>
</article>`;

export function render(p) {
  const n = t.things.length;
  const main = html`${STYLE}
<section class="world first build-first" data-world="grid" data-pin="off" data-label="Websites, apps and products">
  <div class="wrap">
    <h1><span class="half">${t.h1}</span></h1>
    <p class="lead">${t.lead}</p>
    ${talkField({ id: "ask-build" })}
  </div>
</section>

<section class="world devices-world build-dev" data-world="grid" data-pad="off" style="--h:${100 + 90 + 135 * n}" data-label="${t.websites.h2}" aria-labelledby="build-websites">
  <div class="pin">
    <div class="made-stage">
      <div class="made-open on">
        <h2 id="build-websites">${t.websites.h2}</h2>
        <p class="lead">${t.websites.lead}</p>
        <div class="rig build-ghost" aria-hidden="true"><div class="laptop"><div class="lid"><div class="screen"></div></div><div class="base"></div></div><div class="phone"><div class="screen"></div></div></div>
      </div>
      ${t.things.map(made)}
      <nav class="made-ticks" aria-label="${t.ticksLabel}">${t.things.map((x) => html`<a href="#${x.id}" aria-label="${x.name}"></a>`)}</nav>
    </div>
  </div>
</section>

<section class="world build-partner" data-world="ember" style="--h:170" data-label="Product partnership" id="partnership">
  <div class="pin"><div class="wrap build-partner-in">
    <div>
      <h2 class="r">${t.partnership.h2}</h2>
      <p class="lead r">${t.partnership.lead}</p>
      <div class="build-proof r">
        <h3>${t.partnership.proof.name}</h3>
        <p>${t.partnership.proof.text}</p>
        <p class="build-link"><a href="${t.partnership.proof.href}" rel="noopener" target="_blank">${t.partnership.proof.link}${OUT}</a></p>
      </div>
    </div>
    <div class="r" role="img" aria-label="${t.partnership.proof.alt}"><div class="build-shots build-rise" data-p>${rig("shopintake", { desktop: SHOPINTAKE_TOP })}</div></div>
  </div></div>
</section>

<section class="world end" data-world="ember" data-pin="off" data-label="${t.close}">
  ${talkClose(t.close)}
</section>`;
  return page(p, t, main);
}

export function text() {
  const at = t.things.findIndex((x) => x.opensApps);
  const sites = t.things.slice(0, at), apps = t.things.slice(at);
  const thing = (x) => [`### ${x.name}`, `${x.kind}. ${x.text}`, x.href ? `Live at ${x.href}` : x.private].join("\n\n");
  return [
    `# ${t.h1}`,
    t.lead,
    `## ${t.websites.h2}`,
    t.websites.lead,
    ...sites.map(thing),
    `## ${t.apps.h2}`,
    t.apps.lead,
    ...apps.map(thing),
    `## ${t.partnership.h2}`,
    t.partnership.lead,
    `### ${t.partnership.proof.name}`,
    `${t.partnership.proof.text} ${t.partnership.proof.href}`,
  ].join("\n\n");
}
