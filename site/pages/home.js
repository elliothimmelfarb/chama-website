import { html, raw } from "../html.js";
import { SITE, pageById } from "../site.js";
import { page, talkField, talkClose, ARROW } from "../parts/chrome.js";
import { home as t } from "../content/en/home.js";
import { GLYPHS } from "../figures/glyphs.js";
import { stage } from "../figures/stage.js";
import { proofChart } from "../figures/proof.js";
import { logoStrip, CLIENTS } from "../parts/logos.js";

const doors = () => html`<ul class="doors" data-doors>
  ${t.doors.map(
    (d) => html`<li class="door" data-door="${d.id}"><a href="${pageById(d.id).path}">${GLYPHS[d.id]}<div><h2>${d.title}</h2><p>${d.line}</p></div>${ARROW}</a></li>`,
  )}
</ul>`;

const photo = (alt) => html`<img class="photo" src="/assets/family-2026-720.webp" srcset="/assets/family-2026-480.webp 480w, /assets/family-2026-720.webp 720w, /assets/family-2026-960.webp 960w, /assets/family-2026-1440.webp 1440w" sizes="(min-width: 760px) 40vw, 70vw" width="2048" height="1804" alt="${alt}" loading="lazy" decoding="async">`;

// Home's own section styles. The pinned worlds put their words in the
// engine's .copy and their figure in a .figure-box placed here.
const STYLE = `
.home-sub { margin-top: var(--s4); }
.home-sub + .home-sub { margin-top: 0; }
@media (min-width: 1100px) { .home-sub:not(.home-sub + .home-sub) { margin-top: var(--s5); } }
.home-doors { margin-top: var(--s5); padding-bottom: var(--s7); }
.home-also { margin-top: var(--s4); }

/* the grid's horizon is 60% down the screen, and the words and chart stay above it */
.home-proof .copy { top: 40%; }
.home-proof .figure-box { position: absolute; right: var(--edge); top: auto; bottom: 45%; width: min(44vw, 38rem); }
.home-photo { margin: 0; position: absolute; right: var(--edge); top: calc(50% + 36px); translate: 0 -50%;
  width: min(42vw, 36rem, (100svh - 72px - 150px) * 8 / 7); }
.home-photo figcaption { margin-top: var(--s3); }
.home-belief .copy { width: min(56vw, 46rem); }
.home-belief-line { font: 600 var(--t-h2)/1.12 var(--display); letter-spacing: -0.025em; max-width: 24ch; text-wrap: balance; }
.home-belief-line + .home-belief-line { margin-top: var(--s6); color: var(--fg-2); }

@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  /* words in the upper part of the screen: above the grid's horizon, and in
     the upper 60% of the ember (docs/DESIGN.md section 4) */
  :is(.home-proof, .home-people) .copy { top: calc(56px + env(safe-area-inset-top) + 20px); bottom: auto; }
  .home-proof .figure-box { left: 16px; right: 16px; top: auto; bottom: calc(20px + env(safe-area-inset-bottom)); width: auto; translate: none; }
  .home-proof .bars-list { gap: var(--s3); }
  .home-proof .bars figcaption { margin-top: var(--s3); }
  .home-photo { left: 16px; right: auto; top: auto; bottom: calc(20px + env(safe-area-inset-bottom)); translate: none;
    width: min(100vw - 32px, (100svh - 400px) * 8 / 7); }
}
/* one column: the figures follow their words */
html:not(.pin) :is(.home-proof .figure-box, .home-photo) { position: static; translate: none; width: min(100%, 36rem); margin-top: var(--s6); }
`;

export function render(p) {
  const main = html`
<style>${raw(STYLE)}</style>
<section class="world first" data-world="paper" data-pin="off">
  <div class="first-grid wrap">
    <div class="first-words">
      <p class="thanks" id="thanks" role="status">${t.thanks}</p>
      <p class="descriptor">${t.descriptor}</p>
      <h1><span class="half">${t.h1[0]}</span> <span class="half">${t.h1[1]}</span></h1>
      ${t.sub.map((l) => html`<p class="lead home-sub">${l}</p>`)}
      ${talkField({ id: "ask-home" })}
    </div>
    ${stage({ label: t.stageLabel, beats: t.stageBeats })}
  </div>
  <div class="wrap home-doors">
    ${doors()}
    <p class="small home-also">${t.also}</p>
  </div>
</section>

<section class="world home-proof" data-world="grid" style="--h:180">
  <div class="pin">
    <div class="copy">
      <h2 class="r">${t.proof.h2}</h2>
      <p class="lead r">${SITE.laMetalNamed ? t.proof.leadNamed : t.proof.lead}</p>
      <a class="more r" href="${t.proof.cta.href}">${t.proof.cta.text}${ARROW}</a>
    </div>
    <div class="figure-box r">${proofChart({ caption: t.proof.caption })}</div>
  </div>
</section>

<section class="world clients" data-world="grid" data-pin="off">
  <div class="wrap">
    <h2 class="sr-only">${t.proof.clientsLabel}</h2>
    ${logoStrip(CLIENTS)}
  </div>
</section>

<section class="world home-people" data-world="ember" style="--h:170">
  <div class="pin">
    <div class="copy">
      <h2 class="r">${t.people.h2}</h2>
      <p class="lead r">${t.people.lead}</p>
      <p class="lead r">${t.people.more}</p>
      <a class="more r" href="${t.people.cta.href}">${t.people.cta.text}${ARROW}</a>
    </div>
    <figure class="figure-box home-photo r">${photo(t.people.photoAlt)}<figcaption class="small">${t.people.caption}</figcaption></figure>
  </div>
</section>

<section class="world home-belief" data-world="tides" style="--h:170">
  <div class="pin">
    <div class="copy">
      ${t.belief.lines.map((l, i) => html`<p class="home-belief-line r" style="--in:${i ? 0.15 : -0.3}">${l}</p>`)}
    </div>
  </div>
</section>

<section class="world end" data-world="tides" data-pin="off">
  ${talkClose(t.close)}
</section>`;
  return page(p, t, main);
}

export function text() {
  return [
    t.descriptor,
    `# ${t.h1.join(" ")}`,
    t.sub.join(" "),
    ...t.doors.map((d) => `- ${d.title}: ${d.line}`),
    t.also,
    `## ${t.proof.h2}`,
    SITE.laMetalNamed ? t.proof.leadNamed : t.proof.lead,
    t.proof.caption,
    `## ${t.people.h2}`,
    t.people.lead,
    t.people.more,
    ...t.belief.lines,
  ].join("\n\n");
}
