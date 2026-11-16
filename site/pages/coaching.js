import { html } from "../html.js";
import { page, talkField, talkClose, ARROW, MARK } from "../parts/chrome.js";
import { coaching as t } from "../content/en/coaching.js";
import { coachingFigure, effortFigure } from "../figures/coaching.js";

// Every rule that reads var(--p) sits on a [data-p] element (worlds.css).
const STYLE = html`<style>
.coaching-in { display: grid; gap: var(--s6); align-content: center; height: 100%; padding-top: 56px; padding-bottom: var(--s6); }
html:not(.pin) .coaching-in { height: auto; padding: 0; }
.coaching-sec { padding: var(--s8) 0 calc(var(--s8) + 20vh); }
.coaching-sec h2 { max-width: 22ch; }
.coaching-sec .lead { margin-top: var(--s4); }
.coaching-first { padding-bottom: calc(var(--s8) + 20vh); }
.coaching-first .lead { margin-top: var(--s4); }
.coaching-first .talk-field { margin-top: var(--s6); }
.coaching-in h2 { max-width: 20ch; }
.coaching-in .lead { margin-top: var(--s4); }

.coaching-fig { margin: 0; width: 100%; max-width: 46rem; }
.coaching-fig svg { width: 100%; height: auto; overflow: visible; }
.cf-tangle, .cf-line, .cf-head { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.cf-tangle { stroke: var(--fg); stroke-dasharray: 1; stroke-dashoffset: calc(1 - clamp(0, var(--p) / 0.4, 1)); }
.cf-ring { fill: none; stroke: var(--fg); stroke-width: 1.5; stroke-dasharray: 2 7; stroke-linecap: round; vector-effect: non-scaling-stroke; transform-box: fill-box; transform-origin: center; opacity: clamp(0.01, (var(--p) - 0.25) * 8, 1); transform: rotate(calc(var(--p) * 120deg)); }
.cf-mark { fill: var(--fg); opacity: clamp(0.01, (var(--p) - 0.32) * 8, 1); }
.cf-line { stroke: var(--accent); stroke-width: 3; stroke-dasharray: 1; stroke-dashoffset: calc(1 - clamp(0, (var(--p) - 0.45) / 0.4, 1)); }
.cf-head { stroke: var(--accent); stroke-width: 3; opacity: clamp(0.01, (var(--p) - 0.83) * 12, 1); }
.cf-labels { display: grid; grid-template-columns: 1fr 1fr 1fr; margin-top: var(--s3); font: 600 var(--t-label)/1.2 var(--text); letter-spacing: 0.01em; color: var(--fg-2); }
.cf-labels span:nth-child(2) { text-align: center; }
.cf-labels span:nth-child(3) { text-align: right; color: var(--fg); }

.coaching-who .qa summary h3 { font-size: var(--t-h3); }
.coaching-who ul { list-style: none; margin: var(--s6) 0 0; padding: 0; max-width: 46rem; }

.effort-fig { margin: 0; display: grid; gap: var(--s6); max-width: 40rem; width: 100%; }
.ef-row { display: grid; gap: var(--s2); }
.ef-name { font: 600 var(--t-label)/1.2 var(--text); letter-spacing: 0.01em; }
.ef-track { position: relative; height: 18px; }
.ef-ticks { position: absolute; left: 12.5%; right: 12.5%; top: 8px; height: 2px; background: var(--line-strong); }
.ef-at { position: absolute; inset: 0; }
.ef-at i { position: absolute; left: 87.5%; top: 1px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; }
.ef-then i { background: var(--fg); }
.ef-now i { background: var(--accent); }
.ef-now { transform: translateX(calc(-50% * clamp(0, (var(--p) - 0.2) / 0.55, 1))); }
.ef-ghost { position: absolute; left: 87.5%; top: 1px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--line-strong); }
.ef-levels { display: grid; grid-template-columns: repeat(4, 1fr); font-size: var(--t-fine); color: var(--fg-2); text-align: center; }

.coaching-video .frame { position: relative; margin-top: var(--s6); aspect-ratio: 16 / 9; max-width: 48rem; border-radius: var(--r-surface); background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); display: grid; place-items: center; padding: var(--s5); }
.coaching-video .frame .mark { width: clamp(48px, 9vw, 96px); height: auto; }
.coaching-video .frame p { position: absolute; left: var(--s5); right: var(--s5); bottom: var(--s5); max-width: 40ch; font: 500 var(--t-stage)/1.3 var(--display); letter-spacing: -0.01em; color: var(--fg); text-wrap: pretty; }

.coaching-shot { width: 100%; max-width: 44rem; }
.coaching-shot img { width: 100%; height: auto; border-radius: var(--r-surface); box-shadow: 0 0 0 1px var(--line), var(--shadow-float); }
.coaching-rise { transform: translateY(calc((1 - clamp(0, var(--p) * 2.5, 1)) * 16px)); }

@media (max-width: 1099px) {
  .coaching-in { padding-top: calc(56px + var(--s4)); gap: var(--s5); }
}
@media (min-width: 1100px) {
  .coaching-in { grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: center; padding-top: 72px; }
  .coaching-in > :first-child { grid-column: 1 / span 5; }
  .coaching-in > :last-child { grid-column: 7 / span 6; }
  .coaching-first { min-height: calc(100svh - 40px); display: grid; align-content: center; }
  .coaching-sec { padding-top: var(--s9); }
}
</style>`;

const hearthShot = (alt) => html`<img src="/assets/built/the-hearth-thumb-1080.webp" srcset="/assets/built/the-hearth-thumb-320.webp 320w, /assets/built/the-hearth-thumb-640.webp 640w, /assets/built/the-hearth-thumb-1080.webp 1080w" sizes="(min-width: 1100px) 44vw, calc(100vw - 32px)" width="1080" height="675" alt="${alt}" loading="lazy" decoding="async">`;

export function render(p) {
  const main = html`${STYLE}
<section class="world first coaching-first" data-world="tides" data-pin="off" data-label="Coaching">
  <div class="wrap">
    <h1><span class="half">${t.h1}</span></h1>
    <p class="lead">${t.lead}</p>
    ${talkField({ id: "ask-coaching" })}
  </div>
</section>

<section class="world" data-world="tides" style="--h:230" data-label="A session">
  <div class="pin"><div class="wrap coaching-in">
    <div class="copy-block">
      <h2 class="r">${t.figure.h2}</h2>
      <p class="lead r">${t.figure.lead}</p>
    </div>
    <div class="r">${coachingFigure(t.figure)}</div>
  </div></div>
</section>

<section class="world coaching-sec coaching-who" data-world="paper" data-pin="off" data-label="${t.forms.h2}">
  <div class="wrap">
    <h2>${t.forms.h2}</h2>
    <ul>
      ${t.forms.items.map(
        (f) => html`<li><details class="qa"><summary><h3>${f.q}</h3></summary><div class="qa-a">${f.a.map((a) => html`<p>${a}</p>`)}</div></details></li>`,
      )}
    </ul>
  </div>
</section>

<section class="world" data-world="grid" style="--h:190" data-label="New models">
  <div class="pin"><div class="wrap coaching-in">
    <div class="copy-block">
      <h2 class="r">${t.example.h2}</h2>
      <p class="lead r">${t.example.lead}</p>
    </div>
    <div class="r">${effortFigure(t.example.figure)}</div>
  </div></div>
</section>

<section class="world coaching-sec" data-world="grid" data-pin="off" data-label="${t.enablement.h2}">
  <div class="wrap">
    <h2>${t.enablement.h2}</h2>
    <p class="lead">${t.enablement.lead}</p>
  </div>
</section>

<section class="world coaching-sec coaching-video" data-world="paper" data-pin="off" data-label="${t.video.h2}">
  <div class="wrap">
    <h2>${t.video.h2}</h2>
    <div class="frame" role="img" aria-label="${t.video.label}">${MARK}<p>${t.video.soon}</p></div>
  </div>
</section>

<section class="world" data-world="ember" style="--h:170" data-label="${t.hearth.h2}" id="hearth">
  <div class="pin"><div class="wrap coaching-in">
    <div class="copy-block">
      <h2 class="r">${t.hearth.h2}</h2>
      <p class="lead r">${t.hearth.lead}</p>
      <a class="more r" href="/hearth">${t.hearth.members}${ARROW}</a>
    </div>
    <div class="r"><div class="coaching-shot coaching-rise" data-p>${hearthShot(t.hearth.shotAlt)}</div></div>
  </div></div>
</section>

<section class="world end" data-world="tides" data-pin="off" data-label="${t.close}">
  ${talkClose(t.close)}
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
