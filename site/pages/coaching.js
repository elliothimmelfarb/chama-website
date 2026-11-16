import { html, raw } from "../html.js";
import { page, talkField, talkClose, ARROW } from "../parts/chrome.js";
import { coaching as t } from "../content/en/coaching.js";
import { sessionFigure, effortFigure, hearthFigure, whoGlyph, enablementFigure, ASPECT, STAGE_BUTTONS_CSS } from "../figures/coaching.js";

// Six worlds, each in one .frame (worlds.css): the first screen with the
// session playing beside the words; who it's for (flow); new models (pinned,
// the effort knob slides); AI enablement (flow, still); the Hearth (pinned,
// the records rise); Talk to us. A figure's --p styles are inline on its
// parts (site/figures/coaching.js); this sheet only paints them.
// --sw is viewBox units per CSS pixel at each figure width (worlds.css,
// "the figure language").
const sw = (cls, w) => `
.${cls} .fx-svg { --sw: calc(${w} / 330); }
@container fx (min-width: 480px) { .${cls} .fx-svg { --sw: calc(${w} / 540); } }
@container fx (min-width: 600px) { .${cls} .fx-svg { --sw: calc(${w} / 700); } }
@container fx (min-width: 800px) { .${cls} .fx-svg { --sw: calc(${w} / 880); } }`;

const STYLE = raw(`<style>
.coaching-page .words > .lead, .coaching-page .words > h2 + .more { margin-top: var(--s4); }
.coaching-page .words > .more { display: inline-flex; margin-top: var(--s5); }

/* the first screen: the words and the session as one group, a screen tall */
.world.coaching-first > .pin > .frame { min-height: 100svh; padding-top: calc(var(--head) + var(--s7)); padding-bottom: var(--s8); }
.coaching-first .talk-field { margin-top: var(--s6); }

/* C1, a session */
${sw("cf", 600)}
.cf-coin { stroke: var(--fx-ink); stroke-width: calc(1.5px * var(--sw)); }
.cf-mark-ring { fill: var(--fx-ink); }
.cf-mark-spark { fill: var(--accent); }
.cf-tube, .cf-tangle, .cf-tint, .cf-way, .cf-head { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.cf-tube { stroke: color-mix(in srgb, var(--fg) 8%, transparent); stroke-width: calc(12px * var(--sw)); }
.cf-tangle { stroke: var(--fx-ink); stroke-width: calc(2px * var(--sw)); }
.cf-tint { stroke: var(--fx-tint); stroke-width: calc(12px * var(--sw)); }
.cf-way, .cf-head { stroke: var(--accent); stroke-width: calc(3px * var(--sw)); }
.cf-you { r: calc(4.5px * var(--sw)); }
${STAGE_BUTTONS_CSS}

/* who it's for: the heading and lead stand while the rows scroll */
.coaching-who .who > h2 { font-size: var(--t-h3); }
.coaching-who ul { list-style: none; margin: var(--s5) 0 0; padding: 0; }
.coaching-who .qa summary h3 { font-size: var(--t-h3); flex: 1; }
.wf { width: 48px; height: 48px; flex: none; overflow: visible; }
.wf circle { fill: var(--fg-2); transition: fill var(--dur-quick) var(--ease-out); }
.wf .wf-hot { fill: var(--accent); stroke: var(--ground, var(--bg)); stroke-width: 1.5; paint-order: stroke; }
.wf .wf-table { fill: color-mix(in srgb, var(--fg) 8%, transparent); }
.qa[open] .wf circle:not(.wf-hot) { fill: var(--fg); }
@media (hover: hover) { .qa summary:hover .wf circle:not(.wf-hot) { fill: var(--fg); } }

/* C3, thinking effort */
${sw("ef", 560)}
.ef-groove { fill: color-mix(in srgb, var(--fg) 7%, var(--ground, var(--bg))); stroke: var(--line-strong); stroke-width: calc(1px * var(--sw)); }
.ef-notch { fill: none; stroke: var(--line-strong); stroke-width: calc(2px * var(--sw)); stroke-linecap: round; }
.ef-knob { fill: var(--fx-ink); stroke: var(--fx-halo); stroke-width: calc(3px * var(--sw)); paint-order: stroke; }
.ef-ghost { fill: none; stroke: var(--fx-ink-2); stroke-width: calc(1.5px * var(--sw)); stroke-dasharray: calc(3px * var(--sw)) calc(4px * var(--sw)); }

/* C4, AI enablement */
${sw("en", 520)}
.en-top, .en-side { stroke: var(--fx-ink); stroke-width: calc(1.5px * var(--sw)); stroke-linejoin: round; }
.en-side { fill: color-mix(in srgb, var(--fg) 12%, var(--ground, var(--bg))); }
.en-side-r { fill: color-mix(in srgb, var(--fg) 20%, var(--ground, var(--bg))); }
:is(.en-top, .en-side).en-hot { stroke: var(--accent); stroke-width: calc(2.5px * var(--sw)); }

/* C5, the Hearth */
${sw("hf", 520)}
.hf-tie { fill: none; stroke: var(--line-strong); stroke-width: calc(1.25px * var(--sw)); stroke-dasharray: calc(2px * var(--sw)) calc(4px * var(--sw)); stroke-linecap: round; }
.hf-card { stroke: var(--fx-ink); stroke-width: calc(1.5px * var(--sw)); }
.hf-hot .hf-card { fill: var(--fx-owned); stroke: var(--accent); stroke-width: calc(2px * var(--sw)); }
.hf-lines { fill: none; stroke: var(--fx-ink-2); stroke-width: calc(1.5px * var(--sw)); stroke-linecap: round; }
.hf-dot { fill: var(--fx-ink); stroke: var(--fx-halo); stroke-width: calc(3px * var(--sw)); paint-order: stroke; }

/* The flow worlds pad themselves: each follows a world on its own ground,
   so it needs no room for a blend above it, and only a short one below,
   where the engine's default (a fifth of a screen more) left a third of a
   screen bare at every handoff. */
.world:is(.coaching-who, .coaching-enable) > .pin > .frame { padding-top: var(--s8); padding-bottom: calc(var(--s8) + 10svh); }
.world.coaching-close > .pin > .frame { padding-top: var(--s8); padding-bottom: var(--s9); }

/* the close: the line and the field, as on every page, in the frame */
.coaching-close .talk-close { padding: 0; margin: 0; }

@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  .world.coaching-first > .pin > .frame { min-height: 0; padding-top: calc(var(--head) + var(--s6)); padding-bottom: var(--s7); }
  /* every figure here is wider than tall, so it takes the column's width;
     its height then fits under the words on a 610px screen */
  .coaching-page .frame { --fig-h: 46svh; }
}
</style>`);

export function render(p) {
  const main = html`${STYLE}
<section class="world first coaching-first coaching-page" data-world="tides" data-pin="off" data-pad="off" data-fill data-label="Coaching">
  <div class="pin"><div class="frame" data-layout="split">
    <div class="words">
      <h1><span class="half">${t.h1}</span></h1>
      <p class="lead">${t.lead}</p>
      ${talkField({ id: "ask-coaching" })}
    </div>
    <div class="fig" style="--ar:${ASPECT.session.toFixed(3)}">${sessionFigure(t.figure)}</div>
  </div></div>
</section>

<section class="world coaching-who coaching-page" data-world="tides" data-pin="off" data-pad="off" data-fill data-label="${t.forms.h2}">
  <div class="pin"><div class="frame" data-layout="pair">
    <div class="words">
      <h2>${t.figure.h2}</h2>
      <p class="lead">${t.figure.lead}</p>
    </div>
    <div class="who">
      <h2>${t.forms.h2}</h2>
      <ul>
        ${t.forms.items.map(
          (f, i) => html`<li><details class="qa"><summary>${whoGlyph(i)}<h3>${f.q}</h3></summary><div class="qa-a">${f.a.map((a) => html`<p>${a}</p>`)}</div></details></li>`,
        )}
      </ul>
    </div>
  </div></div>
</section>

<section class="world coaching-page" data-world="grid" style="--h:160" data-fill data-label="New models">
  <div class="pin"><div class="frame" data-layout="split">
    <div class="words backed">
      <h2 class="r">${t.example.h2}</h2>
      <p class="lead r">${t.example.short}</p>
    </div>
    <div class="fig r backed" style="--ar:${ASPECT.effort.toFixed(3)}">${effortFigure(t.example.figure)}</div>
  </div></div>
</section>

<section class="world coaching-enable coaching-page" data-world="grid" data-pin="off" data-pad="off" data-fill data-label="${t.enablement.h2}">
  <div class="pin"><div class="frame" data-layout="split" data-flip>
    <div class="words backed">
      <h2>${t.enablement.h2}</h2>
      <p class="lead">${t.enablement.lead}</p>
    </div>
    <div class="fig backed" style="--ar:${ASPECT.enablement.toFixed(3)}">${enablementFigure(t.enablement)}</div>
  </div></div>
</section>

<section class="world coaching-page" data-world="ember" style="--h:140" data-fill data-label="${t.hearth.h2}" id="hearth">
  <div class="pin"><div class="frame" data-layout="split">
    <div class="words">
      <h2 class="r">${t.hearth.h2}</h2>
      <p class="lead r">${t.hearth.lead}</p>
      <a class="more r" href="/hearth">${t.hearth.members}${ARROW}</a>
    </div>
    <div class="fig r" style="--ar:${ASPECT.hearth.toFixed(3)}">${hearthFigure(t.hearth.figure)}</div>
  </div></div>
</section>

<section class="world end coaching-close" data-world="ember" data-pin="off" data-pad="off" data-fill data-label="${t.close}">
  <div class="pin"><div class="frame" data-layout="statement">
    <div class="words">${talkClose(t.close, { work: "coaching" })}</div>
  </div></div>
</section>`;
  return page(p, t, main);
}

export function text() {
  return [
    `# ${t.h1}`,
    t.lead,
    `## ${t.figure.h2}`,
    t.figure.lead,
    `## ${t.forms.h2}`,
    ...t.forms.items.map((f) => `### ${f.q}\n\n${f.a.join("\n\n")}`),
    `## ${t.example.h2}`,
    t.example.lead,
    `## ${t.enablement.h2}`,
    t.enablement.lead,
    `## ${t.hearth.h2}`,
    t.hearth.lead,
  ].join("\n\n");
}
