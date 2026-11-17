// /engineering-department: the page a referred business owner lands on from
// a link, usually on a phone. Its first screen says what this is without
// the home page. Sections and grounds follow docs/DESIGN.md section 7; every
// world's contents sit in one .frame (section 14).
import { readFileSync } from "node:fs";
import { html, raw } from "../html.js";
import { SITE } from "../site.js";
import { page, talkField, talkClose, ARROW } from "../parts/chrome.js";
import { ed as t } from "../content/en/engineering-department.js";
import { changeSummary } from "../figures/proof.js";
import { contrast, VIEW } from "../figures/contrast.js";
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

// The contrast, the loop and the numbers share one box, so in the same
// cell their figures stand on the same spot: the loop's business is the
// contrast's "Yours", and the numbers' dots pour from where the loop parked.
const AR = `--ar:${+(VIEW[2] / VIEW[3]).toFixed(4)}`;

// Everything inside a figure box (.fig.r) restyles on every frame of its
// world's hold, because the engine writes --u on the box (pages.md, frame
// cost). Gradients never change, so each pinned world's <defs> move out of
// the box into one hidden .fx svg at the head of its pin, where their
// stops still take the world's ground colours.
function hoistDefs(main) {
  return raw(String(main).replace(/<section\b[\s\S]*?<\/section>/g, (world) => {
    if (/^<section\b[^>]*data-pin="off"/.test(world)) return world;
    const defs = [];
    const rest = world.replace(/<defs>([\s\S]*?)<\/defs>/g, (_, d) => (defs.push(d), ""));
    if (!defs.length) return world;
    return rest.replace('<div class="pin">', `<div class="pin"><svg class="fx ed-defs" aria-hidden="true" focusable="false"><defs>${defs.join("")}</defs></svg>`);
  }));
}

const STYLE = raw(`<style>
/* /engineering-department. Type and colour from tokens.css and base.css,
   the frame and the figure language from worlds.css. */
.ed-first h1 { font-size: clamp(2.8rem, 1.6rem + 5vw, 4.5rem); }
.ed-first .lead { margin-top: var(--s4); }
.ed-first .talk-field { margin-top: var(--s5); }
.ed-first > .pin > .frame { padding-top: calc(var(--head) + var(--s8)); padding-bottom: var(--s8); }
.ed-first .fig { display: none; }
.frame > .words > h2 + .lead { margin-top: var(--s3); }
.frame > .words > .lead + .lead { margin-top: var(--s3); }
[data-page="engineering-department"] main [id] { scroll-margin-top: 72px; }

.fx.ed-defs { position: absolute; width: 0; height: 0; overflow: hidden; }

/* viewBox units per CSS pixel at each figure width (worlds.css, figures) */
.cx-svg, .loop-svg, .sum-svg, .own-svg { --sw: calc(480 / 330); }
.pl-svg { --sw: calc(440 / 330); }
@container fx (min-width: 480px) { .cx-svg, .loop-svg, .sum-svg, .own-svg { --sw: calc(480 / 520); } .pl-svg { --sw: calc(440 / 520); } }
@container fx (min-width: 600px) { .cx-svg, .loop-svg, .sum-svg, .own-svg { --sw: calc(480 / 700); } .pl-svg { --sw: calc(440 / 660); } }

/* The contrast: the company, grey and seen from a little above, and its queue */
.cx-co, .cx-co-top { stroke: var(--fx-ink-2); stroke-width: calc(1.5px * var(--sw)); stroke-linejoin: round; }
.cx-co { fill: var(--fx-old); fill-rule: evenodd; }
.cx-co-top { fill: color-mix(in srgb, var(--fg-2) 24%, var(--ground, var(--bg))); }
.cx-q { fill: url(#cx-q-body); stroke: var(--fx-ink); stroke-width: calc(1.5px * var(--sw)); stroke-linejoin: round; }

/* The loop */
/* Where the software's outline moves on its own (the loop's refits, the
   flight in "You own it"), the business arrives drawn but without its
   static fit, which would stay behind where the moving one has left. */
.fit-moves .fx-fit, .fit-moves .fx-halo { display: none; }
.loop-export { fill: var(--fx-light); stroke: var(--fx-ink); stroke-width: calc(1.5px * var(--sw)); stroke-linejoin: round; }
.loop-station { fill: var(--fx-halo); stroke: var(--fx-ink); stroke-width: calc(1.5px * var(--sw)); }
.loop-tail { fill: none; stroke: var(--accent); stroke-width: calc(4px * var(--sw)); stroke-linecap: round; }
.loop-stops { position: absolute; inset: 0; list-style: none; margin: 0; padding: 0; }
.loop-stops .at-top { --ty: calc(-100% - 12px); }
.loop-stops .at-bottom { --ty: 12px; }
.loop-stops .at-right { --tx: calc(-100% - 10px); --ty: calc(-100% - 14px); }
.loop-stops .at-left { --tx: 10px; --ty: calc(-100% - 14px); }
.loop-ledger { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: var(--t-small); max-width: 22rem; }
.loop-ledger li { display: flex; justify-content: space-between; gap: var(--s2); padding-top: 6px; border-top: 1px solid var(--line); white-space: nowrap; }
.loop-ledger .num { font-weight: 600; color: var(--accent-text); }
.loop-ledger span:first-child { color: var(--fg-2); }
.ed-loop .words { display: grid; gap: var(--s5); justify-items: start; }

/* The numbers: every request, on one sheet */
.sum-box { position: relative; }
.sum-sheet { fill: var(--fx-light); stroke: var(--line); stroke-width: calc(1px * var(--sw)); }
.sum-in { fill: var(--accent); }
.sum-later { fill: var(--fx-ink-2); fill-opacity: 0.6; }
.sum-caption { margin-top: var(--s4); max-width: 46ch; }

/* The plant: before and after, beside the week */
.pl-old, .pl-bar, .pl-sheet { stroke: var(--fx-ink-2); stroke-width: calc(1.25px * var(--sw)); stroke-linejoin: round; }
.pl-old { fill: var(--fx-old); }
.pl-bar { fill: var(--fx-body); }
.pl-sheet { fill: var(--fx-light); }
.pl-grid { fill: none; stroke: var(--fx-ink-2); stroke-opacity: 0.45; stroke-width: calc(1px * var(--sw)); }
.pl-gather { stroke-width: calc(1.25px * var(--sw)); stroke-dasharray: 2 5; stroke-linecap: round; }
.pl-head { fill: var(--accent); }
.ed-week { font: 600 var(--t-h3)/1.3 var(--display); letter-spacing: -0.015em; color: var(--fg-2); max-width: 30ch; }
.ed-week b { color: var(--fg); font-weight: 600; white-space: nowrap; }
.ed-plant .words > * + * { margin-top: var(--s5); }

/* The recording */
.ed-rec { margin: 0; }
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

/* You own it */
.own-plat { stroke: var(--fx-ink); stroke-opacity: 0.45; stroke-width: calc(1.25px * var(--sw)); stroke-dasharray: 1.5 6; stroke-linecap: round; }
.own-plat.is-yours { stroke-opacity: 0.8; stroke-dasharray: none; }
.own-ghost { stroke: var(--fx-ink-2); stroke-width: calc(1.25px * var(--sw)); stroke-linejoin: round; }

/* Price and the guarantee, set large, then how it starts under them */
.ed-price-shape { font: 600 var(--t-h2)/1.12 var(--display); letter-spacing: -0.025em; max-width: 24ch; text-wrap: balance; }
.ed-guarantee { margin-top: var(--s5); font: 600 var(--t-h2)/1.12 var(--display); letter-spacing: -0.025em; max-width: 24ch; color: var(--accent-text); text-wrap: balance; }
/* HTML, not an .fx: its sentences are words, so it paints with the
   semantic tokens rather than the figure tokens */
.pr-fig { margin: 0; --pr-ground: var(--ground, var(--bg)); }
.pr-line { --axis: 64px; --dot: 18px; position: relative; list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr 1fr 1.1fr; }
.pr-line::before { content: ""; position: absolute; left: 0; right: 0; top: var(--axis); height: 1.5px; translate: 0 -50%; background: var(--line-strong); }
.pr-line li { position: relative; padding: calc(var(--axis) + var(--dot)) var(--s6) 0 0; }
.pr-text { display: block; max-width: 24ch; font-size: var(--t-lead); line-height: 1.4; color: var(--fg); text-wrap: pretty; }
.pr-month .pr-text { color: var(--fg-2); }
.pr-step::before { content: ""; position: absolute; z-index: 1; left: 0; top: var(--axis); width: var(--dot); height: var(--dot); translate: 0 -50%; box-sizing: border-box; border-radius: 50%; background: var(--pr-ground); border: 1.75px solid var(--fg); }
.pr-step.is-due::before { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 0 3px var(--pr-ground); }
/* your old system runs above the axis until you switch it off */
.pr-old { position: absolute; left: calc(var(--dot) / 2); right: calc(var(--dot) / -2); top: calc(var(--axis) - 26px); height: 16px; background: repeating-linear-gradient(45deg, var(--line-strong) 0 1px, transparent 1px 6px), color-mix(in srgb, var(--fg-2) 14%, var(--pr-ground)); }
.pr-old span, .pr-tag { position: absolute; bottom: calc(100% + 8px); font: 600 var(--t-label)/1.2 var(--text); white-space: nowrap; }
.pr-old span { left: 0; color: var(--fg-2); }
.pr-tag { left: calc(var(--dot) / 2 - 1px); bottom: calc(100% - var(--axis) + var(--dot) / 2 + 8px + 16px); padding-left: 10px; color: var(--accent-text); }
.pr-tag::before { content: ""; position: absolute; left: 0; top: 0.1em; height: calc(16px + 8px + 1.2em); width: 2px; border-radius: 1px; background: var(--accent); }
@media (min-width: 1100px) { .pr-old span, .pr-tag { font-size: var(--t-small); } }
/* then the monthly fee: even ticks on a band that runs on, fading */
.pr-run { position: absolute; left: 0; right: 0; top: var(--axis); height: 14px; translate: 0 -50%; background: repeating-linear-gradient(90deg, var(--fg-2) 0 3px, transparent 3px 26px), linear-gradient(var(--line), var(--line)) 0 50% / 100% 6px no-repeat; -webkit-mask-image: linear-gradient(90deg, var(--fg) 30%, transparent); mask-image: linear-gradient(90deg, var(--fg) 30%, transparent); }

/* Questions */
.ed-qs h2 { margin-bottom: var(--s5); }
.ed-qs .qa h3 { font-size: var(--t-h3); }
.ed-qs .qa summary { min-height: 64px; }
@media (prefers-reduced-motion: no-preference) {
  :root:not([data-motion="low"]) .ed-qs { interpolate-size: allow-keywords; }
  :root:not([data-motion="low"]) .ed-qs .qa::details-content { block-size: 0; opacity: 0; overflow: clip; transition: block-size var(--dur-base) var(--ease-out), opacity var(--dur-base) var(--ease-out), content-visibility var(--dur-base) allow-discrete; }
  :root:not([data-motion="low"]) .ed-qs .qa[open]::details-content { block-size: auto; opacity: 1; }
}

/* The close: the blend into tides stands on its top edge */
.ed-close > .pin > .frame { padding-top: calc(20vh + var(--s7)); }
.ed-close .talk-close { padding: 0; margin: 0; }

@media (min-width: 1100px) {
  .ed-first > .pin > .frame { min-height: calc(88svh); }
  .ed-first .words { grid-column: 1 / span 6; }
  .ed-first h1 { max-width: 12ch; }
  .ed-first .fig { display: block; grid-column: 7 / -1; }
  .frame#recording > .words { grid-column: 1 / span 4; }
  .frame#recording > .ed-rec { grid-column: 5 / -1; }
  /* the price and its guarantee side by side, how it starts under both */
  .frame#price > .words { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--s5); align-items: start; }
  .frame#price .ed-guarantee { margin-top: 0; }
}
@media (min-width: 760px) and (max-width: 1099px) {
  .ed-first .words { grid-column: 1 / span 9; }
}
@media (max-width: 759px), (max-aspect-ratio: 9/10) {
  .ed-contrast .frame { --words-h: 12rem; }
  .ed-numbers .frame { --words-h: 15rem; }
  .ed-own .frame { --words-h: 13rem; }
  /* the loop: the heading, then the picture, then the ledger and the link */
  .ed-loop .frame { --words-h: 17rem; row-gap: var(--s3); }
  .ed-loop .words { display: contents; }
  .ed-loop h2 { order: 0; font-size: clamp(1.25rem, 1rem + 2vw, 1.75rem); }
  .ed-loop .fig { order: 1; }
  .ed-loop .loop-ledger-box { order: 2; }
  .ed-loop .more { order: 3; }
  .loop-ledger { gap: 2px; max-width: none; }
  .loop-ledger li { padding-top: 3px; }
  .ed-rec-frame { aspect-ratio: 9 / 16; width: min(100%, calc(70svh * 9 / 16)); margin-inline: auto; }
  /* how it starts runs down the column */
  .pr-line { --axis: 9px; grid-template-columns: minmax(0, 1fr); }
  .pr-line::before { left: var(--axis); right: auto; top: 0; bottom: 0; width: 1.5px; height: auto; translate: -50% 0; }
  .pr-line li { padding: 0 0 var(--s6) 44px; }
  .pr-step::before { left: 0; top: 0.7em; }
  .pr-old { left: calc(var(--axis) - 8px); right: auto; width: 16px; top: 0.7em; bottom: -0.7em; height: auto; }
  .pr-step:first-child { padding-top: 1.8em; }
  .pr-step:first-child::before, .pr-step:first-child .pr-old { top: calc(1.8em + 0.7em); }
  .pr-old span { left: 44px; top: -1.8em; bottom: auto; }
  .pr-tag { position: static; display: block; margin-bottom: 4px; padding-left: 0; }
  .pr-tag::before { display: none; }
  .pr-run { left: calc(var(--axis) - 7px); right: auto; top: 0; bottom: 0; width: 14px; height: auto; translate: 0 0; background: repeating-linear-gradient(180deg, var(--fg-2) 0 3px, transparent 3px 22px) 50% 0 / 12px 100% no-repeat; -webkit-mask-image: linear-gradient(var(--fg) 30%, transparent); mask-image: linear-gradient(var(--fg) 30%, transparent); }
}
</style>`);

export function render(p) {
  const L = loop({ id: "loop-b", stations: t.loop.stations, you: t.loop.you, label: t.loop.ledgerLabel });
  const main = html`
${STYLE}
<section class="world first ed-first" data-world="paper" data-pin="off" data-pad="off" data-fill data-label="${t.rail.first}">
  <div class="pin"><div class="frame">
    <div class="words">
      <p class="descriptor">${t.who}</p>
      <h1><span class="half">${t.h1}</span></h1>
      <p class="lead">${t.lead}</p>
      ${talkField({ id: "ask-ed" })}
    </div>
    <div class="fig" style="${AR}" aria-hidden="true">${loop({ id: "loop-a", stations: t.loop.stations, you: t.loop.you, label: t.loop.ledgerLabel }).figure}</div>
  </div></div>
</section>

<section id="contrast" class="world ed-contrast" data-world="paper" data-fill style="--h:190" data-label="${t.rail.contrast}">
  <div class="pin"><div class="frame">
    <div class="words">
      <h2 class="r">${t.contrast.h2}</h2>
      <p class="lead r">${t.contrast.lead}</p>
    </div>
    <div class="fig r" style="${AR}">${contrast({ them: t.contrast.them, you: t.contrast.you, label: t.contrast.h2 })}</div>
  </div></div>
</section>

<section id="loop" class="world ed-loop" data-world="ember" data-fill style="--h:400" data-label="${t.rail.loop}">
  <div class="pin"><div class="frame">
    <div class="words">
      <h2 class="r">${t.loop.h2}</h2>
      <div class="r loop-ledger-box">${L.ledger}</div>
      <a class="more r" href="/agent" data-talk>${t.loop.cta}${ARROW}</a>
    </div>
    <div class="fig r" style="${AR}">${L.figure}</div>
  </div></div>
</section>

<section id="numbers" class="world ed-numbers" data-world="grid" data-fill style="--h:170" data-label="${t.rail.numbers}">
  <div class="pin"><div class="frame">
    <div class="words backed">
      <h2 class="r">${t.numbers.h2}</h2>
      <p class="lead r">${numbersLead()}</p>
      <p class="small r sum-caption">${t.numbers.summary.caption}</p>
    </div>
    <div class="fig r" style="${AR}"><div class="backed">${changeSummary(t.numbers.summary)}</div></div>
  </div></div>
</section>

<section class="world ed-more" data-world="grid" data-pin="off" data-pad="off" data-fill data-label="${t.rail.recording}">
  <div class="pin">
    <div class="frame ed-plant" data-flip>
      <div class="words">
        <p class="lead backed">${t.numbers.replaced}</p>
        <p class="ed-week backed"><b class="num">${t.numbers.week[0].value}</b> ${t.numbers.week[0].text}, and <b class="num">${t.numbers.week[1].value}</b> ${t.numbers.week[1].text}.</p>
        <p class="lead backed">${t.numbers.finds}</p>
      </div>
      <div class="fig" style="--ar:${440 / 330}"><div class="backed">${beforeAfter(t.numbers.figure)}</div></div>
    </div>
    <div id="recording" class="frame">
      <div class="words backed">
        <h2>${t.recording.h2}</h2>
        <p class="lead">${t.recording.lead}</p>
      </div>
      ${recording()}
    </div>
  </div>
</section>

<section id="own" class="world ed-own" data-world="paper" data-fill style="--h:160" data-label="${t.rail.own}">
  <div class="pin"><div class="frame" data-flip>
    <div class="words">
      <h2 class="r">${t.own.h2}</h2>
      <p class="lead r">${t.own.lead}</p>
      <p class="lead r">${t.own.disappear}</p>
    </div>
    <div class="fig r" style="--ar:${480 / 360}">${own({ ours: t.own.ours, yours: t.own.yours })}</div>
  </div></div>
</section>

<section class="world ed-price" data-world="paper" data-pin="off" data-pad="off" data-fill data-label="${t.rail.price}">
  <div class="pin">
    <div id="price" class="frame" data-layout="wide">
      <div class="words">
        <h2 class="ed-price-shape">${t.price.h2}</h2>
        <p class="ed-guarantee">${t.price.guarantee}</p>
      </div>
      ${priceLine(t.price.line)}
    </div>
    <div id="questions" class="frame ed-qs" data-layout="pair">
      <div class="words"><h2>${t.objections.h2}</h2></div>
      <div class="ed-qa-list">
        ${t.objections.items.map(
          (o) => html`<details class="qa"><summary><h3>${o.q}</h3></summary><div class="qa-a">${o.a.map((a) => html`<p>${a}</p>`)}</div></details>`,
        )}
      </div>
    </div>
  </div>
</section>

<section id="close" class="world ed-close" data-world="tides" data-pin="off" data-pad="off" data-fill data-label="${t.rail.close}">
  <div class="pin"><div class="frame" data-layout="statement">
    <div class="words">${talkClose(t.close, { work: "engineering-department" })}</div>
  </div></div>
</section>`;
  return page(p, t, hoistDefs(main));
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
    numbersLead(),
    t.numbers.summary.label,
    t.numbers.replaced,
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
    ...t.price.line.steps.map((s, i) => `${i + 1}. ${s}`),
    `## ${t.objections.h2}`,
    ...t.objections.items.map((o) => `### ${o.q}\n\n${o.a.join("\n\n")}`),
  ].join("\n\n");
}
