import { html } from "../html.js";
import { SITE, pageById } from "../site.js";
import { page, talkField, talkClose, ARROW } from "../parts/chrome.js";
import { home as t } from "../content/en/home.js";
import { GLYPHS } from "../figures/glyphs.js";
import { stage } from "../figures/stage.js";
import { proofChart } from "../figures/proof.js";
import { logoStrip, CLIENTS } from "../parts/logos.js";

const doors = () => html`<ul class="doors" data-doors>
  ${t.doors.map(
    (d) => html`<li class="door"><a href="${pageById(d.id).path}">${GLYPHS[d.id]}<div><h2>${d.title}</h2><p>${d.line}</p></div>${ARROW}</a></li>`,
  )}
</ul>`;

const photo = (alt) => html`<img class="photo" src="/assets/family-2026-720.webp" srcset="/assets/family-2026-480.webp 480w, /assets/family-2026-720.webp 720w, /assets/family-2026-960.webp 960w, /assets/family-2026-1440.webp 1440w" sizes="(min-width: 1100px) 40vw, calc(100vw - 32px)" width="2048" height="1804" alt="${alt}" loading="lazy" decoding="async">`;

export function render(p) {
  const main = html`
<section class="world first" data-world="paper" data-pin="off">
  <div class="first-grid wrap">
    <div class="first-words">
      <p class="thanks" id="thanks" role="status">${t.thanks}</p>
      <p class="descriptor">${t.descriptor}</p>
      <h1><span class="half">${t.h1[0]}</span> <span class="half">${t.h1[1]}</span></h1>
      <p class="lead sub">${t.sub}</p>
      ${talkField({ id: "ask-home" })}
    </div>
    ${stage({ label: t.stageLabel, beats: t.stageBeats })}
  </div>
  <div class="wrap doors-wrap">
    ${doors()}
    <p class="small also">${t.also}</p>
  </div>
</section>

<section class="world proof" data-world="grid">
  <div class="pin"><div class="wrap split">
    <div class="copy">
      <h2 class="r">${t.proof.h2}</h2>
      <p class="lead r">${SITE.laMetalNamed ? t.proof.leadNamed : t.proof.lead}</p>
      <a class="more r" href="${t.proof.cta.href}">${t.proof.cta.text}${ARROW}</a>
    </div>
    <div class="r">${proofChart({ caption: t.proof.caption })}</div>
  </div></div>
</section>

<section class="world clients" data-world="grid" data-pin="off">
  <div class="wrap">
    <h2 class="sr-only">${t.proof.clientsLabel}</h2>
    ${logoStrip(CLIENTS)}
  </div>
</section>

<section class="world people" data-world="ember">
  <div class="pin"><div class="wrap split">
    <figure class="photo-wrap r">${photo(t.people.photoAlt)}<figcaption class="small">${t.people.caption}</figcaption></figure>
    <div class="copy">
      <h2 class="r">${t.people.h2}</h2>
      <p class="lead r">${t.people.lead}</p>
      <p class="lead r">${t.people.more}</p>
      <a class="more r" href="${t.people.cta.href}">${t.people.cta.text}${ARROW}</a>
    </div>
  </div></div>
</section>

<section class="world belief" data-world="tides">
  <div class="pin"><div class="wrap">
    ${t.belief.lines.map((l) => html`<p class="belief-line r">${l}</p>`)}
  </div></div>
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
    t.sub,
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
