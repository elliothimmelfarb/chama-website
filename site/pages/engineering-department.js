// /engineering-department: the page a referred business owner lands on from
// a link, usually on a phone. Its first screen says what this is without
// the home page. Sections and grounds follow docs/DESIGN.md section 7.
import { readFileSync } from "node:fs";
import { html, raw } from "../html.js";
import { SITE } from "../site.js";
import { page, talkField, talkClose, ARROW } from "../parts/chrome.js";
import { ed as t } from "../content/en/engineering-department.js";
import { proofChart } from "../figures/proof.js";
import { contrast } from "../figures/contrast.js";
import { loop, LAPS } from "../figures/loop.js";
import { beforeAfter, priceLine } from "../figures/plant.js";
import { own } from "../figures/own.js";

const MEDIA = "/assets/media/note-to-change-2026-11-16";
const CAPTIONS = JSON.parse(readFileSync(new URL("../../assets/media/captions.json", import.meta.url), "utf8"));

// Never "LA Metal" while the flag is off.
const numbersLead = () => (SITE.laMetalNamed ? t.numbers.leadNamed : t.numbers.lead);

const PLAY = raw(`<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.5v9l7.5-4.5z" fill="currentColor"/></svg>`);
const PAUSE = raw(`<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 3.5h2.5v9H4.5zM9 3.5h2.5v9H9z" fill="currentColor"/></svg>`);

// The recording: a poster that carries the meaning if the video never
// plays, the video over it, and the captions as text under it.
function recording() {
  const lines = CAPTIONS.wide.map((w, i) => ({ text: w.text, wide: w.start, tall: CAPTIONS.tall[i].start }));
  return html`<figure class="ed-rec" data-rec>
  <div class="ed-rec-frame">
    <picture>
      <source media="(max-width: 759px)" srcset="${MEDIA}-tall.webp" width="810" height="1440">
      <img src="${MEDIA}-wide.webp" width="1920" height="1080" alt="${t.recording.posterAlt}" loading="lazy" decoding="async">
    </picture>
    <video muted playsinline preload="none" aria-describedby="ed-rec-captions" data-tall="${MEDIA}-tall.mp4" data-wide="${MEDIA}-wide.mp4">
      <source media="(max-width: 759px)" src="${MEDIA}-tall.mp4" type="video/mp4">
      <source src="${MEDIA}-wide.mp4" type="video/mp4">
    </video>
  </div>
  <figcaption class="ed-rec-under">
    <button class="btn btn-quiet ed-rec-btn" type="button" data-rec-toggle><span class="ed-rec-play">${PLAY}${t.recording.play}</span><span class="ed-rec-pause">${PAUSE}${t.recording.pause}</span></button>
    <ol class="ed-rec-lines" id="ed-rec-captions">
      ${lines.map((l) => html`<li data-wide="${l.wide}" data-tall="${l.tall}">${l.text}</li>`)}
    </ol>
  </figcaption>
</figure>`;
}

const STYLE = raw(`<style>
/* /engineering-department. Type and colour from tokens.css and base.css. */
.ed-first .wrap { padding-bottom: var(--s8); }
.ed-first .lead { margin-top: var(--s4); }
/* sized so the H1, not the lead, is the largest paint (the LCP) on a phone */
.ed-first h1 { font-size: clamp(2.8rem, 1.6rem + 5vw, 4.5rem); }
.ed-first .talk-field { margin-top: var(--s5); }

/* The words and figure of a pinned world, under the header. */
.ed-hold { position: relative; height: 100%; max-width: var(--max); margin: 0 auto; padding: calc(56px + var(--s4)) var(--gutter) var(--s4); display: flex; flex-direction: column; justify-content: center; gap: var(--s5); }
html:not(.pin) .ed-hold { height: auto; padding: 0; max-width: 46rem; margin: 0; }
.ed-words h2 + .lead { margin-top: var(--s3); }
.ed-figbox { min-width: 0; }

/* The contrast */
.cx { margin: 0; }
.cx-svg { width: 100%; height: auto; overflow: visible; }
.cx-co { fill: color-mix(in srgb, var(--fg) 6%, transparent); stroke: var(--fg-2); stroke-width: 1.5; }
.cx-q { fill: color-mix(in srgb, var(--fg) 7%, transparent); stroke: var(--fg); stroke-width: 1.5; stroke-linejoin: round; }
.cx-rule { stroke: var(--line-strong); stroke-width: 1; stroke-dasharray: 2 5; }
.cx-you { fill: color-mix(in srgb, var(--fg) 7%, transparent); stroke: var(--fg); stroke-width: 1.5; stroke-linejoin: round; }
.cx-fit { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linejoin: round; }
.cx-fit[pathLength] { stroke-dasharray: 1; }
.cx-labels { display: grid; grid-template-columns: 290fr 170fr; margin-top: var(--s2); font: 600 var(--t-label)/1.2 var(--text); color: var(--fg-2); }
.cx-labels span { text-align: center; }
.cx-labels span:first-child { padding-left: 12%; }

/* The loop */
.ed-loop h2 { max-width: 20ch; }
.loop-fig { position: relative; width: 100%; margin: 0 auto; }
.loop-svg { width: 100%; height: auto; overflow: visible; }
.loop-ring { fill: none; stroke: var(--fg); stroke-opacity: 0.45; stroke-width: 1.25; stroke-dasharray: 1.5 6; stroke-linecap: round; transform-origin: 0 0; }
.loop-you { fill: none; stroke: var(--fg); stroke-width: 1.5; stroke-linejoin: round; stroke-dasharray: 1; }
.loop-pulse { fill: var(--fg); stroke: none; }
.loop-svg .loop-you + .loop-pulse { fill-opacity: 0.16; }
.loop-fit { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linejoin: round; stroke-dasharray: 1; }
.loop-export { fill: none; stroke: var(--fg); stroke-width: 1.5; stroke-linejoin: round; }
.loop-stations circle { fill: var(--ground, var(--bg)); stroke: var(--fg); stroke-width: 1.5; }
.loop-tail { fill: none; stroke: var(--accent); stroke-width: 4; stroke-linecap: round; }
.loop-marker { fill: var(--accent); }
.loop-you-label, .loop-stops li { position: absolute; font: 600 var(--t-label)/1.2 var(--text); color: var(--fg); white-space: nowrap; }
.loop-you-label { translate: -50% -50%; color: var(--fg-2); }
.loop-stops { list-style: none; margin: 0; padding: 0; }
.loop-stops .at-top { translate: -50% calc(-100% - 12px); }
.loop-stops .at-bottom { translate: -50% 12px; }
.loop-stops .at-right { translate: calc(-100% - 10px) calc(-100% - 14px); }
.loop-stops .at-left { translate: 10px calc(-100% - 14px); }
.loop-notes { position: absolute; }
.loop-note { position: absolute; left: 0; top: 0; translate: -50% -50%; white-space: nowrap; padding: 5px 10px; border-radius: var(--r-pill); background: var(--surface); box-shadow: inset 0 0 0 1px var(--line); font: 600 var(--t-label)/1.2 var(--text); color: var(--fg); }
.loop-ledger { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: var(--t-small); }
.loop-ledger li { display: flex; justify-content: space-between; gap: var(--s2); padding-top: 4px; border-top: 1px solid var(--line); white-space: nowrap; }
.loop-ledger .num { font-weight: 600; color: var(--accent-text); }
.loop-ledger span:first-child { color: var(--fg-2); }
.ed-after { font: 600 var(--t-h3)/1.2 var(--display); letter-spacing: -0.015em; }
.ed-loop .more { margin-top: var(--s2); }

/* The numbers */
.ed-more-wrap, .ed-rec-wrap, .ed-flow { padding-top: var(--s7); padding-bottom: var(--s7); }
.ed-more .lead { max-width: 46ch; }
.ed-week { margin-top: var(--s5); font: 600 var(--t-h3)/1.3 var(--display); letter-spacing: -0.015em; color: var(--fg-2); max-width: 30ch; }
.ed-week b { color: var(--fg); font-weight: 600; white-space: nowrap; }
.ed-finds { margin-top: var(--s5); max-width: 46ch; }

/* Before and after, beside the plant's numbers */
.pl-fig { margin: var(--s6) 0 0; max-width: 30rem; }
.pl-fig svg { width: 100%; height: auto; overflow: visible; }
.pl-o, .pl-l, .pl-gather, .pl-biz, .pl-fit { fill: none; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.pl-o { stroke: var(--fg-2); stroke-width: 1.5; fill: var(--ground, var(--bg)); }
.pl-l { stroke: var(--fg-2); stroke-width: 1; stroke-opacity: 0.6; }
.pl-gather { stroke: var(--line-strong); stroke-width: 1.25; stroke-dasharray: 2 5; }
.pl-biz { stroke: var(--fg); stroke-width: 1.5; fill: color-mix(in srgb, var(--fg) 7%, var(--ground, var(--bg))); }
.pl-fit { stroke: var(--accent); stroke-width: 2.5; }
.pl-labels { display: grid; grid-template-columns: 11fr 7fr; gap: var(--s4); margin-top: var(--s3); font: 600 var(--t-label)/1.3 var(--text); color: var(--fg-2); }
.pl-labels span:last-child { text-align: center; color: var(--fg); }

/* The first screen: the loop's finished picture beside the words */
.ed-first-fig { display: none; }

/* The price, with how it starts drawn beside it */
.pr-fig { position: relative; margin: var(--s8) 0 0; max-width: 34rem; }
.pr-fig svg { width: 100%; height: auto; overflow: visible; }
.pr-axis { stroke: var(--line-strong); stroke-width: 1.5; }
.pr-step { fill: var(--ground, var(--bg)); stroke: var(--fg); stroke-width: 1.5; }
.pr-step.pr-hot { fill: var(--accent); stroke: var(--accent); }
.pr-due { stroke: var(--accent); stroke-width: 2; stroke-linecap: round; }
.pr-tick { stroke: var(--fg-2); stroke-width: 1.5; stroke-linecap: round; }
.pr-labels { position: relative; list-style: none; margin: var(--s2) 0 0; padding: 0; height: 3.4em; font: 600 var(--t-label)/1.25 var(--text); color: var(--fg-2); }
.pr-labels li { position: absolute; left: var(--x); top: 0; translate: -50% 0; max-width: 7.5em; text-align: center; }
.pr-labels li:first-child { translate: -8px 0; text-align: left; }
.pr-setup { position: absolute; left: 43.2%; top: 0; translate: -50% -60%; font: 600 var(--t-label)/1.25 var(--text); color: var(--accent-text); white-space: nowrap; }
.pr-labels .pr-monthly { translate: 0 0; text-align: left; max-width: 10em; }

/* The recording */
.ed-rec { margin: var(--s5) 0 0; }
.ed-rec-frame { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: var(--r-surface); overflow: hidden; background: var(--surface); box-shadow: 0 0 0 1px var(--line); }
.ed-rec-frame img, .ed-rec-frame video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ed-rec-under { display: grid; gap: var(--s4); margin-top: var(--s4); }
.ed-rec-btn { justify-self: start; background: var(--surface); box-shadow: inset 0 0 0 1px var(--fg-2); }
.ed-rec-btn > span { display: inline-flex; align-items: center; gap: 8px; }
.ed-rec-btn svg { width: 14px; height: 14px; }
[data-rec]:not([data-state]) .ed-rec-btn,
[data-rec][data-state="playing"] .ed-rec-play,
[data-rec]:not([data-state="playing"]) .ed-rec-pause { display: none; }
.ed-rec-lines { margin: 0; padding-left: 1.4em; display: grid; gap: var(--s2); max-width: 60ch; color: var(--fg-2); }
.ed-rec-lines li::marker { font-variant-numeric: tabular-nums; color: var(--fg-2); }
.ed-rec-lines li[data-now] { color: var(--fg); }
/* Playing in full motion, the captions are the line being said. */
:root:not([data-motion="low"]) [data-rec]:is([data-state="playing"], [data-state="paused"]) .ed-rec-lines { list-style: none; padding-left: 0; min-height: 3em; }
:root:not([data-motion="low"]) [data-rec]:is([data-state="playing"], [data-state="paused"]) .ed-rec-lines li:not([data-now]) { display: none; }
:root:not([data-motion="low"]) [data-rec]:is([data-state="playing"], [data-state="paused"]) .ed-rec-lines li[data-now] { font-size: var(--t-lead); }
:root[data-theme="dark"] .ed-rec-frame { box-shadow: 0 0 0 1px var(--line-strong); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .ed-rec-frame { box-shadow: 0 0 0 1px var(--line-strong); } }
@media (max-width: 759px) {
  .ed-rec-frame { aspect-ratio: 9 / 16; width: min(100%, calc(70svh * 9 / 16)); margin-inline: auto; }
}

/* You own it */
.own-fig { margin: 0; }
.own-svg { width: 100%; height: auto; overflow: visible; }
.own-ours { fill: none; stroke: var(--fg); stroke-opacity: 0.45; stroke-width: 1.25; stroke-dasharray: 1.5 6; stroke-linecap: round; }
.own-yours { fill: none; stroke: var(--fg); stroke-width: 1.5; }
.own-biz { fill: color-mix(in srgb, var(--fg) 7%, transparent); stroke: var(--fg); stroke-width: 1.5; stroke-linejoin: round; }
.own-fit { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linejoin: round; }
.own-labels { display: grid; grid-template-columns: 1fr 1fr; margin-top: var(--s2); font: 600 var(--t-label)/1.2 var(--text); color: var(--fg-2); text-align: center; }
.ed-own .lead + .lead { margin-top: var(--s3); }

/* Price and the guarantee, set large */
.ed-price-shape { font: 600 var(--t-h2)/1.12 var(--display); letter-spacing: -0.025em; max-width: 24ch; text-wrap: balance; }
.ed-guarantee { margin-top: var(--s5); font: 600 var(--t-h2)/1.12 var(--display); letter-spacing: -0.025em; max-width: 24ch; color: var(--accent-text); text-wrap: balance; }

/* Questions */
.ed-qs h2 { margin-bottom: var(--s5); }
.ed-qs .qa h3 { font-size: var(--t-h3); }
.ed-qs .qa summary { min-height: 56px; }
@media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="low"]) .ed-qs { interpolate-size: allow-keywords; }
  :root:not([data-motion="low"]) .ed-qs .qa::details-content { block-size: 0; opacity: 0; overflow: clip; transition: block-size var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out), content-visibility var(--dur-base) allow-discrete; }
  :root:not([data-motion="low"]) .ed-qs .qa[open]::details-content { block-size: auto; opacity: 1; }
}

/* How it starts */
.ed-steps { list-style: none; counter-reset: step; margin: var(--s5) 0 0; padding: 0; display: grid; gap: var(--s4); max-width: 40rem; }
.ed-steps li { counter-increment: step; display: grid; grid-template-columns: 2rem 1fr; gap: var(--s3); font-size: var(--t-lead); line-height: 1.45; color: var(--fg-2); }
.ed-steps li::before { content: counter(step); font: 600 var(--t-lead)/1.45 var(--display); color: var(--fg); font-variant-numeric: tabular-nums; }
.ed-starts .talk-close { padding-top: var(--s7); }
.ed-starts .ed-flow { padding-bottom: 0; }

[data-page="engineering-department"] main [id] { scroll-margin-top: 72px; }

@media (min-width: 1100px) {
  /* the next section's heading peeks over the fold */
  .ed-first .wrap { min-height: calc(88svh - 72px); display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: center; padding-bottom: var(--s8); }
  .ed-first-words { grid-column: 1 / span 6; }
  .ed-first h1 { max-width: 12ch; }
  .ed-first-fig { display: block; grid-column: 8 / span 5; max-width: 30rem; justify-self: end; width: 100%; }
  .ed-first-fig .loop-fig { width: 100%; }
  .ed-more-wrap > .pl-fig { grid-column: 8 / span 5; grid-row: 1 / span 3; align-self: center; margin: 0; max-width: none; }
  .ed-price .ed-flow:first-child { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: center; }
  .ed-price-words { grid-column: 1 / span 7; }
  .ed-price .pr-fig { grid-column: 8 / span 5; margin: 0; }
  .ed-hold { padding-top: calc(72px + var(--s5)); display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: center; align-content: center; }
  .ed-hold > .ed-words { grid-column: 1 / span 5; }
  /* on the grid the words stay above the horizon */
  .ed-numbers .ed-hold { align-content: start; align-items: start; padding-top: calc(72px + 12svh); }
  .ed-hold > .ed-figbox { grid-column: 7 / span 6; }
  .ed-loop .ed-hold > .ed-words { grid-column: 1 / span 4; display: grid; gap: var(--s5); }
  .ed-loop .ed-hold > .ed-figbox { grid-column: 6 / span 7; grid-row: 1; }
  .ed-loop .loop-fig { max-width: calc((100svh - 220px) * 480 / 340); }
  .loop-ledger { max-width: 20rem; gap: 6px; }
  html:not(.pin) .ed-hold { max-width: var(--max); margin: 0 auto; }
  .ed-more-wrap, .ed-rec-wrap, .ed-flow { padding-top: var(--s9); padding-bottom: var(--s9); }
  .ed-more-wrap { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; }
  .ed-more-wrap > * { grid-column: 1 / span 7; }
  .ed-rec-wrap { display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px; align-items: start; }
  .ed-rec-wrap > .ed-words { grid-column: 1 / span 4; }
  .ed-rec-wrap > .ed-rec { grid-column: 5 / span 8; margin: 0; }
}
@media (max-width: 1099px) {
  .ed-loop .ed-hold { gap: var(--s3); justify-content: flex-start; }
  .ed-loop h2 { font-size: clamp(1.375rem, 1rem + 2vw, 2rem); }
  .ed-loop .ed-figbox { order: 1; }
  .ed-loop .ed-words { display: contents; }
  .ed-loop .loop-ledger-box { order: 2; }
  .ed-loop .ed-close { order: 3; }
  .ed-loop .ed-after { font-size: var(--t-lead); }

  .loop-fig { width: min(100%, calc((100svh - 390px) * 480 / 340)); }
  /* the ledger sits right under the ring here, so the ring's pill would say it twice */
  .loop-notes { display: none; }
}
</style>`);

export function render(p) {
  const L = loop({ stations: t.loop.stations, you: t.loop.you, label: t.loop.ledgerLabel });
  const main = html`
${STYLE}
<section class="world first ed-first" data-world="paper" data-pin="off" data-label="${t.rail.first}">
  <div class="wrap">
    <div class="ed-first-words">
      <p class="descriptor">${t.who}</p>
      <h1><span class="half">${t.h1}</span></h1>
      <p class="lead">${t.lead}</p>
      ${talkField({ id: "ask-ed" })}
    </div>
    <div class="ed-first-fig" aria-hidden="true">${loop({ stations: t.loop.stations, you: t.loop.you, label: t.loop.ledgerLabel }).figure}</div>
  </div>
</section>

<section id="contrast" class="world ed-contrast" data-world="paper" style="--h:210" data-label="${t.rail.contrast}">
  <div class="pin"><div class="ed-hold">
    <div class="ed-words r">
      <h2>${t.contrast.h2}</h2>
      <p class="lead">${t.contrast.lead}</p>
    </div>
    <div class="ed-figbox r">${contrast({ them: t.contrast.them, you: t.contrast.you, label: t.contrast.h2 })}</div>
  </div></div>
</section>

<section id="loop" class="world ed-loop" data-world="ember" style="--h:460" data-label="${t.rail.loop}">
  <div class="pin"><div class="ed-hold">
    <div class="ed-words">
      <h2 class="r">${t.loop.h2}</h2>
      <div class="r loop-ledger-box">${L.ledger}</div>
      <div class="r ed-close">
        <p class="ed-after" data-p style="opacity:clamp(0.01, (var(--p) - 0.82) / 0.05, 1);translate:0 calc(8px - 8px * clamp(0, (var(--p) - 0.82) / 0.05, 1))">${t.loop.after}</p>
        <a class="more" href="/agent" data-talk>${t.loop.cta}${ARROW}</a>
      </div>
    </div>
    <div class="ed-figbox r">${L.figure}</div>
  </div></div>
</section>

<section id="numbers" class="world ed-numbers" data-world="grid" style="--h:200" data-label="${t.rail.numbers}">
  <div class="pin"><div class="ed-hold">
    <div class="ed-words r"><h2>${t.numbers.h2}</h2></div>
    <div class="ed-figbox r"><div class="backed">${proofChart({ caption: t.numbers.caption })}</div></div>
  </div></div>
</section>

<section class="world ed-more" data-world="grid" data-pin="off" data-label="${t.rail.recording}">
  <div class="wrap ed-more-wrap">
    <p class="lead backed">${numbersLead()}</p>
    ${beforeAfter(t.numbers.figure)}
    <p class="ed-week backed"><b class="num">${t.numbers.week[0].value}</b> ${t.numbers.week[0].text}, and <b class="num">${t.numbers.week[1].value}</b> ${t.numbers.week[1].text}.</p>
    <p class="lead ed-finds backed">${t.numbers.finds}</p>
  </div>
  <div id="recording" class="wrap ed-rec-wrap">
    <div class="ed-words">
      <h2>${t.recording.h2}</h2>
      <p class="lead">${t.recording.lead}</p>
    </div>
    ${recording()}
  </div>
</section>

<section id="own" class="world ed-own" data-world="paper" style="--h:190" data-label="${t.rail.own}">
  <div class="pin"><div class="ed-hold">
    <div class="ed-words r">
      <h2>${t.own.h2}</h2>
      <p class="lead">${t.own.lead}</p>
      <p class="lead">${t.own.disappear}</p>
    </div>
    <div class="ed-figbox r">${own({ ours: t.own.ours, yours: t.own.yours })}</div>
  </div></div>
</section>

<section class="world ed-price" data-world="paper" data-pin="off" data-label="${t.rail.price}">
  <div id="price" class="wrap ed-flow">
    <div class="ed-price-words">
      <h2 class="ed-price-shape">${t.price.h2}</h2>
      <p class="ed-guarantee">${t.price.guarantee}</p>
    </div>
    ${priceLine(t.price.line)}
  </div>
  <div id="questions" class="wrap ed-flow ed-qs">
    <h2>${t.objections.h2}</h2>
    <div class="ed-qa-list">
      ${t.objections.items.map(
        (o) => html`<details class="qa"><summary><h3>${o.q}</h3></summary><div class="qa-a">${o.a.map((a) => html`<p>${a}</p>`)}</div></details>`,
      )}
    </div>
  </div>
</section>

<section id="starts" class="world ed-starts" data-world="tides" data-pin="off" data-label="${t.rail.starts}">
  <div class="wrap ed-flow">
    <h2>${t.starts.h2}</h2>
    <ol class="ed-steps">${t.starts.steps.map((s) => html`<li>${s}</li>`)}</ol>
  </div>
  ${talkClose(t.close, { work: "engineering-department" })}
</section>`;
  return page(p, t, main);
}

export function text() {
  return [
    t.who,
    `# ${t.h1}`,
    t.lead,
    `## ${t.contrast.h2}`,
    t.contrast.lead,
    `## ${t.loop.h2}`,
    `${t.loop.ledgerLabel}: ${LAPS.map((e) => `${e.label}, ${e.minutes} min`).join("; ")}.`,
    `## ${t.numbers.h2}`,
    t.numbers.caption,
    numbersLead(),
    `${t.numbers.week[0].value} ${t.numbers.week[0].text}, and ${t.numbers.week[1].value} ${t.numbers.week[1].text}.`,
    t.numbers.finds,
    `## ${t.recording.h2}`,
    t.recording.lead,
    ...CAPTIONS.wide.map((c) => `- ${c.text}`),
    `## ${t.own.h2}`,
    t.own.lead,
    t.own.disappear,
    `## ${t.price.h2}`,
    t.price.guarantee,
    `## ${t.objections.h2}`,
    ...t.objections.items.map((o) => `### ${o.q}\n\n${o.a.join("\n\n")}`),
    `## ${t.starts.h2}`,
    ...t.starts.steps.map((s, i) => `${i + 1}. ${s}`),
  ].join("\n\n");
}
