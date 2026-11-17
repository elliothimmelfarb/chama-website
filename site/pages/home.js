import { html, raw } from "../html.js";
import { SITE, pageById } from "../site.js";
import { page, talkField, talkClose, ARROW } from "../parts/chrome.js";
import { home as t } from "../content/en/home.js";
import { common } from "../content/en/common.js";
import { GLYPHS } from "../figures/glyphs.js";
import { stage } from "../figures/stage.js";
import { beliefFigure, canDoFigure, approachFigure, beliefPhrases, reasonStyle, homeFigureStyle } from "../figures/home-figures.js";
import { logoStrip, CLIENTS } from "../parts/logos.js";

const doors = () => html`<ul class="doors" data-doors>
  ${t.doors.map(
    (d) => html`<li class="door" data-door="${d.id}"><a href="${pageById(d.id).path}">${GLYPHS[d.id]}<div><h2>${d.title}</h2><p>${d.line}</p></div>${ARROW}</a></li>`,
  )}
</ul>`;

const photo = (alt) => html`<img class="photo" data-p src="/assets/family-2026-720.webp" srcset="/assets/family-2026-480.webp 480w, /assets/family-2026-720.webp 720w, /assets/family-2026-960.webp 960w, /assets/family-2026-1440.webp 1440w" sizes="(min-width: 760px) 50vw, 100vw" width="2048" height="1804" alt="${alt}" loading="lazy" decoding="async">`;

// the goals under Elliot's sentence, each reason lit as its side is drawn
const goals = () => beliefPhrases(t.belief.line).map((p) => (p.k === undefined ? p.text : html`<span data-p data-n="0${p.k + 1}" style="${reasonStyle(p.k)}">${p.text}</span>`));

// The pen's marks on the H1: an underline, then a ring, each an inline svg
// over its words (the words stay plain text for search and screen readers).
// Each viewBox is in hundredths of an em at the box's usual size, so the
// stroke is real path units: Safari mis-dashes pathLength under
// vector-effect: non-scaling-stroke.
const PEN = {
  under: '<svg viewBox="0 0 520 16" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M8 10C114 5 286 13 512 6"/></svg>',
  ring: '<svg viewBox="0 0 480 112" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M379 15C211 -1 29 17 17 56C7 92 178 111 322 102C437 95 475 67 463 39C451 21 418 13 370 11"/></svg>',
};
const marked = (half) => {
  for (const [kind, phrase] of Object.entries(t.h1Marks)) {
    const at = half.indexOf(phrase);
    if (at >= 0) return [half.slice(0, at), html`<span class="pen pen-${kind}">${phrase}${raw(PEN[kind])}</span>`, half.slice(at + phrase.length)];
  }
  return half;
};

const plant = SITE.laMetalNamed ? t.clients.lineNamed : t.clients.line;
// the line's last word keeps its arrow on the same line
const plantHead = plant.slice(0, plant.lastIndexOf(" ") + 1), plantEnd = plant.slice(plant.lastIndexOf(" ") + 1);

// Home's own section styles. Every pinned world is a .frame (worlds.css);
// what is here sizes home's words and figures inside it.
const STYLE = `
.home-sub { margin-top: var(--s4); }
/* the pen marks up the H1 once its halves have arrived, then the stage plays */
.first { overflow-x: clip; }
.first h1 { line-height: 1.06; }
.pen { position: relative; white-space: nowrap; }
.pen svg { position: absolute; max-width: none; overflow: visible; pointer-events: none; }
.pen path { fill: none; stroke: var(--accent); stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1 1; }
.pen-under svg { left: -1%; width: 102%; bottom: -0.1em; height: 0.16em; }
.pen-ring svg { left: -6%; width: 113%; top: -0.02em; height: 1.18em; }
@keyframes pen { from { stroke-dashoffset: 1; } }
:root:not([data-motion="low"]) .pen-under path { animation: pen 500ms var(--ease-out) 1150ms both; }
:root:not([data-motion="low"]) .pen-ring path { animation: pen 750ms var(--ease-out) 1650ms both; }
:root.routed:not([data-motion="low"]) .pen-under path { animation-delay: 450ms; }
:root.routed:not([data-motion="low"]) .pen-ring path { animation-delay: 900ms; }
@media (prefers-reduced-motion: reduce) { :root:not([data-motion="low"]) .pen path { animation: none; } }
/* on a phone: the headline, the stage under it, then the field; the
   descriptor and the sub follow, before the doors (from 760px the stage is
   so tall it would push the field off a tablet's first screen) */
@media (max-width: 759px) {
  .first-grid { display: flex; flex-direction: column; }
  .first-grid h1 { font-size: max(var(--t-display), 2.25rem); }
  .first-words { display: contents; }
  .first-grid h1 { order: 1; }
  .first-grid .stage { order: 2; margin-top: var(--s5); }
  .first-grid .talk-field { order: 3; }
  .first-grid .descriptor { order: 4; margin: var(--s6) 0 0; }
  .first-grid .home-sub { order: 5; margin-top: var(--s3); }
  html.nav-enter main > .world:first-child .descriptor { animation-delay: calc(3 * var(--stagger-ms)); }
  html.nav-enter main > .world:first-child .home-sub { animation-delay: calc(4 * var(--stagger-ms)); }
}
@media (min-width: 1100px) {
  .home-sub { margin-top: var(--s5); }
  .first-words { grid-column: 1 / span 6; }
}
.home-doors { margin-top: var(--s5); padding-bottom: var(--s7); }
.home-also { margin-top: var(--s4); }
.home-frame .words .lead { margin-top: var(--s4); }
/* the belief's sentence is long, so its heading is a size under the others */
.home-belief h2 { font-size: min(var(--t-h2), 2.5rem); }
/* the two beats of what we can do stand in one place, in turn */
.home-cando .slot > div > .lead { margin-top: var(--s4); }
/* who we have worked with: the plant line is the way to the engineering page */
.home-plant { display: inline; color: var(--fg); text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 4px; transition: text-decoration-color var(--dur-quick) var(--ease-out); }
.home-plant .arr { display: inline-block; width: 18px; height: 18px; margin-left: 4px; vertical-align: -3px; color: var(--accent-text); }
@media (hover: hover) { .home-plant:hover { text-decoration-color: var(--accent-text); } }
.home-clients .logos { padding: var(--s6) 0 0; gap: var(--s6) var(--s7); }
.home-clients .logo { width: calc(var(--lw) * 1.7px); height: calc(var(--lh) * 1.7px); background: color-mix(in srgb, var(--fg) 82%, transparent); }
.home-plant .end { white-space: nowrap; }
.home-clients .more { margin-top: var(--s6); }
/* the next world's words arrive as this short section ends: the flow
   padding's fifth of a screen for the ground's soft edge would leave a
   quarter screen of bare grid between them */
main .world.home-clients[data-pin="off"]:not([data-pad="off"]) > .pin { padding-bottom: 6vh; }
.home-clients .frame { padding-bottom: 0; }
/* on desktop the clients are a list beside the words, one to a row, at
   twice the strip's size, so the section holds its frame */
@media (min-width: 760px) and (min-aspect-ratio: 9/10) {
  .home-clients .logos { flex-direction: column; align-items: stretch; gap: 0; padding: 0; }
  .home-clients .logos li { padding: var(--s6) 0; border-top: 1px solid var(--line); }
  .home-clients .logos li:last-child { border-bottom: 1px solid var(--line); }
  .home-clients .logo { width: calc(var(--lw) * 2px); height: calc(var(--lh) * 2px); }
}
/* the photo settles as the world is held (docs/DESIGN.md, home) */
.home-photo { margin: 0; }
.home-photo-crop { border-radius: var(--r-surface); overflow: hidden; }
.home-photo .photo[data-p] { scale: calc(1.04 - 0.04 * clamp(0, var(--p) / 0.4, 1)); }
.home-photo figcaption { margin-top: var(--s3); }
.home-people .frame { --ar: 1.05; }
/* the people's heading is the page's last claim: set large beside the photo */
@media (min-width: 760px) and (min-aspect-ratio: 9/10) { .home-people h2 { font-size: var(--t-display); line-height: 1.02; letter-spacing: -0.03em; } }

@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  /* the words each world's figure leaves room for, measured at 364x610 with 17px text */
  .home-belief .frame { --words-h: 21rem; }
  .home-cando .frame { --words-h: 12rem; }
  .home-approach .frame { --words-h: 14rem; }
  .home-belief h2 { font-size: 1.5rem; }
  /* the figure's callouts are numbers on a phone; the reasons carry them */
  .home-belief .lead [data-n]::before { content: attr(data-n); margin-right: 0.3em; font-size: 0.6875rem; letter-spacing: 0.04em; vertical-align: 0.35em; font-variant-numeric: tabular-nums; }
  /* on a phone the photo is the width of the column, cropped to the faces */
  .home-people .frame { --ar: 1.33; }
  .home-photo-crop { aspect-ratio: 4 / 3; }
  .home-photo .photo { height: 100%; object-fit: cover; object-position: 50% 30%; }
}
${homeFigureStyle}`;

export function render(p) {
  const main = html`
<style>${raw(STYLE)}</style>
<section class="world first" data-world="paper" data-pin="off" data-fill>
  <div class="first-grid wrap">
    <div class="first-words">
      <p class="thanks" id="thanks" role="status">${t.thanks}</p>
      <p class="descriptor">${t.descriptor}</p>
      <h1><span class="half">${marked(t.h1[0])}</span> <span class="half">${marked(t.h1[1])}</span></h1>
      <p class="lead home-sub">${t.sub}</p>
      ${talkField({ id: "ask-home" })}
    </div>
    ${stage({ label: t.stageLabel, beats: t.stageBeats })}
  </div>
  <div class="wrap home-doors">
    ${doors()}
    <p class="small home-also">${t.also}</p>
  </div>
</section>

<section class="world home-belief" data-world="tides" style="--h:180" data-label="${t.belief.label}" data-fill>
  <div class="pin">
    <div class="frame home-frame" data-layout="split">
      <div class="words">
        <h2 class="r">${t.belief.h2}</h2>
        <p class="lead r">${goals()}</p>
      </div>
      <div class="fig r">${beliefFigure(t.belief.reasons, t.belief.label)}</div>
    </div>
  </div>
</section>

<section class="world home-cando" data-world="grid" style="--h:220" data-label="${t.cando.label}" data-fill>
  <div class="pin">
    <div class="frame home-frame" data-layout="split">
      <div class="words slot">
        <div>
          <h2 class="r" style="--out:0.5">${t.cando.h2}</h2>
          <p class="lead r" style="--out:0.5">${t.cando.line}</p>
        </div>
        <div>
          <h2 class="r" style="--in:0.5">${t.dayOne.h2}</h2>
          <p class="lead r" style="--in:0.5">${t.dayOne.line}</p>
        </div>
      </div>
      <div class="fig r">${canDoFigure({ fresh: t.cando.fig, dayOne: t.dayOne.fig }, t.cando.label)}</div>
    </div>
  </div>
</section>

<section class="world home-clients" data-world="grid" data-pin="off" data-label="${t.clients.h2}" data-fill>
  <div class="pin">
    <div class="frame home-frame" data-layout="split">
      <div class="words backed">
        <h2 class="r">${t.clients.h2}</h2>
        <p class="lead r"><a class="home-plant" href="/engineering-department">${plantHead}<span class="end">${plantEnd}${ARROW}</span></a></p>
        <a class="more r" href="/work">${common.workLink}${ARROW}</a>
      </div>
      <div class="r backed">${logoStrip(CLIENTS)}</div>
    </div>
  </div>
</section>

<section class="world home-approach" data-world="ember" style="--h:170" data-label="${t.approach.label}" data-fill>
  <div class="pin">
    <div class="frame home-frame" data-layout="split">
      <div class="words">
        <h2 class="r">${t.approach.h2}</h2>
        <p class="lead r">${t.approach.line}</p>
      </div>
      <div class="fig r">${approachFigure(t.approach.paths, t.approach.label)}</div>
    </div>
  </div>
</section>

<section class="world home-people" data-world="ember" style="--h:130" data-label="${t.people.h2.replace(/\.$/, "")}" data-fill>
  <div class="pin">
    <div class="frame home-frame" data-layout="split" data-flip>
      <div class="words">
        <h2 class="r">${t.people.h2}</h2>
        <a class="more r" href="${t.people.cta.href}">${t.people.cta.text}${ARROW}</a>
      </div>
      <div class="fig r"><figure class="fig-box home-photo"><div class="home-photo-crop">${photo(t.people.photoAlt)}</div><figcaption class="small">${t.people.caption}</figcaption></figure></div>
    </div>
  </div>
</section>

<section class="world end" data-world="ember" data-pin="off" data-label="Talk to us">
  ${talkClose(t.close)}
</section>`;
  return page(p, t, main);
}

export function text() {
  return [
    t.descriptor,
    `# ${t.h1.join(" ")}`,
    t.sub,
    `${t.stageLabel}:`,
    ...t.stageBeats.map((b) => b.say),
    ...t.doors.map((d) => `- ${d.title}: ${d.line}`),
    t.also,
    `## ${t.belief.h2}`,
    t.belief.line,
    `## ${t.cando.h2}`,
    t.cando.line,
    `## ${t.dayOne.h2}`,
    t.dayOne.line,
    `## ${t.clients.h2}`,
    plant,
    `## ${t.approach.h2}`,
    t.approach.line,
    `## ${t.people.h2}`,
  ].join("\n\n");
}
