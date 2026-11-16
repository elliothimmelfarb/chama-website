import { html } from "../html.js";
import { page, talkField, talkClose, ARROW } from "../parts/chrome.js";
import { coaching as t } from "../content/en/coaching.js";
import { coachingFigure, effortFigure, hearthFigure, whoGlyph, enablementFigure } from "../figures/coaching.js";

// Every rule that reads var(--p) sits on a [data-p] element (worlds.css).
const STYLE = html`<style>
.coaching-in { display: grid; gap: var(--s6); align-content: start; height: 100%; padding-top: calc(56px + var(--s6)); padding-bottom: var(--s6); }
html:not(.pin) .coaching-in { height: auto; padding: 0; }
.coaching-sec { padding: var(--s8) 0; }
.coaching-sec h2 { max-width: 22ch; }
.coaching-sec .lead { margin-top: var(--s4); }
.coaching-first { padding-bottom: var(--s6); }
.coaching-first .lead { margin-top: var(--s4); }
.coaching-first .talk-field { margin-top: var(--s6); }
.coaching-in h2 { max-width: 20ch; }
.coaching-in .lead { margin-top: var(--s4); }

.coaching-fig { margin: 0; width: 100%; }
.coaching-fig svg { width: 100%; height: auto; overflow: visible; }
.cf-tangle, .cf-line, .cf-head { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.cf-tangle { stroke: var(--fg); stroke-dasharray: 1; stroke-dashoffset: calc(1 - clamp(0, (var(--p) - 0.05) / 0.3, 1)); }
.cf-ring { fill: none; stroke: var(--fg); stroke-width: 1.5; stroke-dasharray: 2 7; stroke-linecap: round; vector-effect: non-scaling-stroke; transform-box: fill-box; transform-origin: center; opacity: clamp(0.01, (var(--p) - 0.3) * 10, 1); transform: rotate(calc(clamp(0, (var(--p) - 0.3) / 0.4, 1) * 120deg)); }
.cf-mark { fill: var(--fg); opacity: clamp(0.01, (var(--p) - 0.36) * 10, 1); }
.cf-line { stroke: var(--accent); stroke-width: 3; stroke-dasharray: 1; stroke-dashoffset: calc(1 - clamp(0, (var(--p) - 0.42) / 0.22, 1)); }
.cf-head { stroke: var(--accent); stroke-width: 3; opacity: clamp(0.01, (var(--p) - 0.62) * 16, 1); }
.cf-labels { display: grid; grid-template-columns: 1fr 1fr 1fr; margin-top: var(--s3); font: 600 var(--t-label)/1.2 var(--text); letter-spacing: 0.01em; color: var(--fg-2); }
.cf-labels span:nth-child(2) { text-align: center; }
.cf-labels span:nth-child(3) { text-align: right; color: var(--fg); }
/* each label arrives with its part of the figure */
.cf-labels span[data-p] { opacity: clamp(0.01, (var(--p) - var(--at)) * 8, 1); }
@media (max-width: 759px) { .cf-labels { font-size: 0.75rem; } }

.coaching-who .qa summary h3 { font-size: var(--t-h3); flex: 1; }
.coaching-who ul { list-style: none; margin: var(--s6) 0 0; padding: 0; max-width: 46rem; }
.wf { width: 40px; height: 40px; flex: none; overflow: visible; }
.wf circle { fill: var(--fg-2); transition: fill var(--dur-quick) var(--ease-out); }
.wf .wf-hot { fill: var(--accent); }
.wf .wf-table { stroke: var(--fg-2); stroke-width: 1.5; stroke-linecap: round; fill: none; }
.qa[open] .wf circle:not(.wf-hot) { fill: var(--fg); }
@media (hover: hover) { .qa summary:hover .wf circle:not(.wf-hot) { fill: var(--fg); } }

/* AI enablement: the three layers beside the words, grounded on the grid's
   paper so the floor lines never cross the text */
.coaching-enable .wrap { display: grid; gap: var(--s6); }
.en-fig { position: relative; margin: 0; width: min(100%, 26rem); }
.en-fig svg { width: 78%; height: auto; overflow: visible; }
.en-slab, .en-side { fill: var(--ground, var(--bg)); stroke: var(--fg); stroke-width: 1.5; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.en-side { fill: color-mix(in srgb, var(--fg) 6%, var(--ground, var(--bg))); }
.en-hot { stroke: var(--accent); stroke-width: 2; }
.en-labels { position: absolute; inset: 0 0 0 80%; font: 600 var(--t-label)/1.2 var(--text); color: var(--fg-2); }
.en-labels span { position: absolute; left: 0; translate: 0 -50%; white-space: nowrap; }
.en-labels span:nth-child(1) { top: 23%; color: var(--fg); }
.en-labels span:nth-child(2) { top: 48%; }
.en-labels span:nth-child(3) { top: 73%; }

.effort-fig { margin: 0; display: grid; gap: var(--s7); width: 100%; }
.ef-row { display: grid; gap: var(--s2); }
.ef-name { font: 600 var(--t-label)/1.2 var(--text); letter-spacing: 0.01em; }
.ef-track { position: relative; height: 28px; }
.ef-ticks { position: absolute; left: 12.5%; right: 12.5%; top: 13px; height: 2px; background: var(--line-strong); }
.ef-at { position: absolute; inset: 0; }
.ef-at i { position: absolute; left: 87.5%; top: 2px; width: 24px; height: 24px; margin-left: -12px; border-radius: 50%; }
.ef-then i { background: var(--fg); }
.ef-now i { background: var(--accent); }
.ef-now { --k: clamp(0, (var(--p) - 0.15) / 0.45, 1); transform: translateX(calc(-50% * var(--k) * var(--k) * (3 - 2 * var(--k)))); }
.ef-ghost { position: absolute; left: 87.5%; top: 2px; width: 24px; height: 24px; margin-left: -12px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--line-strong); }
.ef-levels { display: grid; grid-template-columns: repeat(4, 1fr); font: 600 var(--t-label)/1.2 var(--text); color: var(--fg-2); text-align: center; }


.hearth-fig { margin: 0; width: 100%; max-width: 44rem; }
.hearth-fig svg { width: 100%; height: auto; overflow: visible; }
.hearth-fig path, .hearth-fig rect { fill: none; stroke: var(--fg); stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.hearth-fig .hf-axis { stroke: var(--line-strong); }
.hearth-fig .hf-dot { fill: var(--fg); }
.hearth-fig .hf-tie { stroke: var(--line-strong); stroke-dasharray: 2 4; }
.hearth-fig .hf-hot rect { stroke: var(--accent); stroke-width: 2; }
.hearth-fig { position: relative; }
.hf-labels { font: 600 var(--t-label)/1.2 var(--text); color: var(--fg-2); }
.hf-labels span { position: absolute; }
.hf-l-s { right: 0; top: calc(30 / 170 * 100% - 10px); translate: 0 -100%; }
.hf-l-r { left: 0; top: calc(124 / 170 * 100% + 10px); }
.hearth-fig { padding-bottom: var(--s5); }
.hf-rec { opacity: clamp(0.01, (var(--p) - var(--at)) * 6, 1); transform: translateY(calc((1 - clamp(0, (var(--p) - var(--at)) * 6, 1)) * 16px)); }

@media (max-width: 1099px) {
  .coaching-in { padding-top: calc(56px + var(--s5)); gap: var(--s6); align-content: safe center; }
}
@media (min-width: 1100px) {
  .coaching-in { grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: center; align-content: safe center; padding-top: calc(72px + var(--s5)); padding-bottom: var(--s7); }
  .coaching-in > :first-child { grid-column: 1 / span 5; }
  .coaching-in > :last-child { grid-column: 7 / span 6; }
  .coaching-first { padding-top: calc(72px + var(--s9)); }
  .coaching-sec { padding-top: var(--s9); padding-bottom: var(--s9); }
  .coaching-who .wrap { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: start; }
  .coaching-who h2 { grid-column: 1 / span 4; }
  .coaching-who ul { grid-column: 6 / span 7; margin-top: 0; max-width: none; }
  .coaching-enable .wrap { grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: center; }
  .en-words { grid-column: 1 / span 6; }
  .en-fig { grid-column: 8 / span 4; width: 100%; }
}
</style>`;

export function render(p) {
  const main = html`${STYLE}
<section class="world first coaching-first" data-world="tides" data-pin="off" data-label="Coaching">
  <div class="wrap">
    <h1><span class="half">${t.h1}</span></h1>
    <p class="lead">${t.lead}</p>
    ${talkField({ id: "ask-coaching" })}
  </div>
</section>

<section class="world" data-world="tides" style="--h:200" data-label="A session">
  <div class="pin"><div class="wrap coaching-in">
    <div class="copy-block">
      <h2 class="r">${t.figure.h2}</h2>
      <p class="lead r">${t.figure.lead}</p>
    </div>
    <div class="r fig">${coachingFigure(t.figure)}</div>
  </div></div>
</section>

<section class="world coaching-sec coaching-who" data-world="tides" data-pin="off" data-label="${t.forms.h2}">
  <div class="wrap">
    <h2>${t.forms.h2}</h2>
    <ul>
      ${t.forms.items.map(
        (f, i) => html`<li><details class="qa"><summary>${whoGlyph(i)}<h3>${f.q}</h3></summary><div class="qa-a">${f.a.map((a) => html`<p>${a}</p>`)}</div></details></li>`,
      )}
    </ul>
  </div>
</section>

<section class="world" data-world="grid" style="--h:170" data-label="New models">
  <div class="pin"><div class="wrap coaching-in">
    <div class="copy-block">
      <h2 class="r">${t.example.h2}</h2>
      <p class="lead r">${t.example.short}</p>
    </div>
    <div class="r fig backed">${effortFigure(t.example.figure)}</div>
  </div></div>
</section>

<section class="world coaching-sec coaching-enable" data-world="grid" data-pin="off" data-label="${t.enablement.h2}">
  <div class="wrap">
    <div class="en-words backed">
      <h2>${t.enablement.h2}</h2>
      <p class="lead">${t.enablement.lead}</p>
    </div>
    ${enablementFigure(t.enablement)}
  </div>
</section>

<section class="world" data-world="ember" style="--h:150" data-label="${t.hearth.h2}" id="hearth">
  <div class="pin"><div class="wrap coaching-in">
    <div class="copy-block">
      <h2 class="r">${t.hearth.h2}</h2>
      <p class="lead r">${t.hearth.lead}</p>
      <a class="more r" href="/hearth">${t.hearth.members}${ARROW}</a>
    </div>
    <div class="r fig">${hearthFigure(t.hearth.figure)}</div>
  </div></div>
</section>

<section class="world end" data-world="ember" data-pin="off" data-label="${t.close}">
  ${talkClose(t.close, { work: "coaching" })}
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
