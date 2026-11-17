import { html, raw } from "../html.js";
import { page, talkField, talkClose, OUT } from "../parts/chrome.js";
import { build as t } from "../content/en/build.js";
import { rig, RIG_AR, SHOPINTAKE_TOP } from "../figures/devices.js";

// Which pictures in assets/built/ show each thing.
const PICTURES = { toraya: "toraya-lisboa", original: "original-site", vsf: "vsf-lead-automation", alves: "alves-teamwear" };

const LOCK = raw(
  `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3.2" y="7" width="9.6" height="6.8" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`,
);

// The words that stand beside the devices are styled here; the rig, the
// .made grid and its choreography are worlds.css's. The H1 opens the
// devices world, beside the first thing's devices, so the first screen is
// the same split as every frame after it.
const STYLE = html`<style>
.build-dev .made-open h1 { max-width: 11ch; }
.build-dev .made-open .lead { margin-top: var(--s4); }
.build-dev .made-open .talk-field { margin-top: var(--s6); }
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
.build-ghost { display: none; }
html:not(.pin) .build-dev .made-stage { max-width: var(--max); padding: calc(56px + var(--s6)) var(--gutter) calc(var(--s8) + 20vh); }

/* product partnership: the device run's last thing, on a new ground. The
   words stand level with the laptop's top, as the devices' words do. */
.build-partner .frame { align-items: start; }
/* the words start where the devices' words start, high enough to be in
   view while the devices leave (centred, they came after a bare stretch) */
html.pin .build-partner .frame { align-content: start; padding-top: clamp(6.5rem, 17svh, 13rem); }
.build-partner h2 { max-width: 18ch; }
.build-partner .lead { margin-top: var(--s4); }
.build-proof { margin-top: var(--s6); padding-top: var(--s4); border-top: 1px solid var(--line); max-width: 44ch; }
.build-proof h3 { font-size: var(--t-h3); }
.build-proof p { margin-top: var(--s2); color: var(--fg-2); }
.build-proof .build-link { margin-top: var(--s3); }
html.pin .build-partner .rig { opacity: 1; visibility: visible; max-width: none; }
/* ShopIntake's phone rises in beside the laptop in the hold's first half */
.build-partner .rig .phone[data-p] {
  opacity: clamp(0, (var(--p) - 0.04) * 4, 1);
  translate: 0 calc((1 - clamp(0, (var(--p) - 0.04) / 0.44, 1)) * 14%);
}

@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  html.pin .build-dev .made-open { row-gap: 0; }
  .build-dev .made-open h1 { max-width: none; }
  .build-dev .made-open .lead { margin-top: var(--s3); font-size: 0.9375rem; line-height: 1.45; }
  .build-dev .made-open .talk-field { margin-top: var(--s4); }
  /* the opening heading of a run reads as the line above the thing's name */
  .build-dev .made-words h2 { margin-bottom: 2px; font: 600 var(--t-small)/1.4 var(--text); letter-spacing: 0; color: var(--fg-2); max-width: none; }
  .build-dev .made-words h3, .build-dev .made-words h2 + h3 { font-size: 1.5rem; line-height: 1.1; letter-spacing: -0.02em; }
  .build-what { margin-top: var(--s2); font-size: var(--t-small); line-height: 1.4; }
  /* a little under the column, so the last thing's foot stays high (below) */
  html.pin .build-dev .rig { width: calc(min(100%, (100svh - 24.5rem) * 1.75) * var(--fit, 1) * 0.94); }
  .build-kind { margin-top: 2px; }
  .build-link, .build-private { margin-top: var(--s2); }
  /* the last thing's words are kept short: the devices must be gone before
     the partnership words reach their foot, so the higher it is, the less
     bare ground between the worlds. A private thing's kind is said again by
     its private line, which fits on one line at label size. */
  .build-kind-said { display: none; }
  .build-private { font-size: var(--t-label); max-width: none; }
  /* the opening words stand under an invisible rig of the first thing's
     size, so they sit right under its devices (after the h1 in the markup:
     drawDevices measures the open's first child against the first rig) */
  html.pin .build-dev .made-open > .build-ghost { display: block; order: -1; opacity: 0; visibility: hidden; margin-bottom: var(--s4); }
  .build-partner .frame { --fig-h: min(34svh, calc(100svh - 56px - 23.5rem)); row-gap: var(--s4); }
  html.pin .build-partner .frame { padding-top: calc(env(safe-area-inset-top) + 3.9rem); }
  .build-proof { margin-top: var(--s4); padding-top: var(--s3); }
  .build-proof p { font-size: 0.9375rem; line-height: 1.4; }
}
@media (min-width: 760px) and (min-aspect-ratio: 9/10) {
  html:not(.pin) .build-dev .made-stage { padding-top: calc(72px + var(--s8)); }
}
</style>`;

const made = (thing, i) => html`<article class="made" id="${thing.id}" aria-labelledby="${thing.id}-name">
  ${rig(PICTURES[thing.id], { lazy: i > 0, first: i === 0 })}
  <div class="made-words">
    ${thing.opens ? html`<h2>${t[thing.opens].h2}</h2>` : ""}
    <h3 id="${thing.id}-name">${thing.name}</h3>
    ${thing.opens ? "" : html`<p class="${thing.private ? "build-kind build-kind-said" : "build-kind"}">${thing.kind}</p>`}
    <p class="build-what">${thing.short || thing.text}</p>
    ${thing.href ? html`<p class="build-link"><a href="${thing.href}" rel="noopener" target="_blank">${thing.link}${OUT}</a></p>` : ""}
    ${thing.private ? html`<p class="build-private">${LOCK}<span>${thing.private}</span></p>` : ""}
  </div>
</article>`;

// The opening stretch, in hundredths of a screen, before the first thing's
// words take the H1's place (drawDevices reads it as data-open).
const OPEN = 40;

export function render(p) {
  const n = t.things.length;
  const main = html`${STYLE}
<section class="world devices-world build-dev" data-world="grid" data-pad="off" data-open="${OPEN}" style="--h:${100 + OPEN + 135 * n}" data-label="${t.h1}" aria-labelledby="build-h1">
  <div class="pin">
    <div class="made-stage">
      <div class="made-open on">
        <h1 id="build-h1"><span class="half">${t.h1}</span></h1>
        <p class="lead">${t.lead}</p>
        ${talkField({ id: "ask-build" })}
        <div class="rig build-ghost" aria-hidden="true"><div class="laptop"><div class="lid"><div class="screen"></div></div><div class="base"></div></div><div class="phone"><div class="screen"></div></div></div>
      </div>
      ${t.things.map(made)}
      <nav class="made-ticks" aria-label="${t.ticksLabel}">${t.things.map((x) => html`<a href="#${x.id}" aria-label="${x.name}"></a>`)}</nav>
    </div>
  </div>
</section>

<section class="world build-partner" data-world="ember" style="--h:140" data-fill data-label="Product partnership" id="partnership">
  <div class="pin"><div class="frame" data-layout="split">
    <div class="words">
      <h2 class="r">${t.partnership.h2}</h2>
      <p class="lead r">${t.partnership.lead}</p>
      <div class="build-proof r">
        <h3>${t.partnership.proof.name}</h3>
        <p>${t.partnership.proof.text}</p>
        <p class="build-link"><a href="${t.partnership.proof.href}" rel="noopener" target="_blank">${t.partnership.proof.link}${OUT}</a></p>
      </div>
    </div>
    <div class="fig r" role="img" aria-label="${t.partnership.proof.alt}" style="--ar:${RIG_AR}">${rig("shopintake", { desktop: SHOPINTAKE_TOP, rise: true })}</div>
  </div></div>
</section>

<section class="world end" data-world="ember" data-pin="off" data-label="${t.close}">
  ${talkClose(t.close, { work: "build" })}
</section>`;
  return page(p, t, main);
}

export function text() {
  const at = t.things.findIndex((x) => x.opens === "apps");
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
