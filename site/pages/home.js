import { html, raw } from "../html.js";
import { pageById } from "../site.js";
import { page, talkField, talkClose, ARROW } from "../parts/chrome.js";
import { home as t } from "../content/en/home.js";
import { common } from "../content/en/common.js";
import { GLYPHS } from "../figures/glyphs.js";
import { stage } from "../figures/stage.js";
import { logoStrip, CLIENTS } from "../parts/logos.js";

const doors = () => html`<ul class="doors" data-doors>
  ${t.doors.map(
    (d) => html`<li class="door" data-door="${d.id}"><a href="${pageById(d.id).path}">${GLYPHS[d.id]}<div><h2>${d.title}</h2><p>${d.line}</p></div>${ARROW}</a></li>`,
  )}
</ul>`;

// the round portrait: small on purpose (Elliot, 2026-11-19: the half-screen
// photo was "just too big")
const portrait = (alt) => html`<img class="portrait" src="/assets/family-2026-480.webp" srcset="/assets/family-2026-480.webp 480w, /assets/family-2026-720.webp 720w" sizes="(min-width: 760px) 176px, 128px" width="480" height="423" alt="${alt}" loading="lazy" decoding="async">`;

// The pen's marks on the H1: an underline, then a ring, each an inline svg
// over its words (the words stay plain text for search and screen readers).
// Each viewBox is in hundredths of an em at the box's usual size, so the
// stroke is real path units: Safari mis-dashes pathLength under
// vector-effect: non-scaling-stroke.
const PEN = {
  under: '<svg viewBox="0 0 520 16" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M8 10C114 5 286 13 512 6"/></svg>',
  ring: '<svg viewBox="0 0 480 112" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M70 12C200 3 380 3 436 12C474 19 476 94 434 102C330 112 130 112 42 102C4 94 4 20 44 12C80 7 130 5 190 5"/></svg>',
};
const marked = (half, marks = t.h1Marks) => {
  for (const [kind, phrase] of Object.entries(marks || {})) {
    const at = half.indexOf(phrase);
    if (at >= 0) return [half.slice(0, at), html`<span class="pen pen-${kind}">${phrase}${raw(PEN[kind])}</span>`, half.slice(at + phrase.length)];
  }
  return half;
};

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
.pen-ring { margin-inline: 0.2em 0.06em; }
.pen-ring svg { left: -9%; width: 127%; top: 0.12em; height: 1.04em; }
@keyframes pen { from { stroke-dashoffset: 1; } }
:root:not([data-motion="low"]) .first .pen-under path { animation: pen 500ms var(--ease-out) 1150ms both; }
:root:not([data-motion="low"]) .first .pen-ring path { animation: pen 750ms var(--ease-out) 1650ms both; }
:root.routed:not([data-motion="low"]) .first .pen-under path { animation-delay: 450ms; }
:root.routed:not([data-motion="low"]) .first .pen-ring path { animation-delay: 900ms; }
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
  /* the whole first view, doors and the founders line too, is one screen;
     the H1 gives way on a short screen so the doors stay in view */
  .first { min-height: 100svh; display: flex; flex-direction: column; padding-bottom: var(--s5); }
  .first-grid { flex: 1 0 auto; min-height: 0; padding-top: clamp(12px, 2.5svh, var(--s5)); }
  .first-words { padding: 0; }
  .first .descriptor { margin-bottom: var(--s4); }
  .first h1 { font-size: min(var(--t-display), max(2.25rem, 6.4svh)); }
  /* the stage's picture is sized by its width, so on a short screen it
     would set the row's height: cap it by what the screen has left */
  .first .stage-pic { width: min(100%, calc((100svh - 470px) * 540 / 260)); }
  .first-words .talk-field { margin-top: var(--s5); }
  .home-doors { margin-top: var(--s4); padding-bottom: 0; }
  .home-doors .door a { padding-block: 16px 18px; }
  .home-doors .door h2 { font-size: 1.25rem; }
  .home-also { margin-top: var(--s3); }
}
@media (min-width: 1100px) and (max-height: 760px), (min-width: 1100px) and (max-width: 1279px) {
  .first .descriptor { margin-bottom: var(--s3); }
  .first .home-sub { margin-top: var(--s3); }
  .first-words .talk-field { margin-top: var(--s4); }
  .first .home-sub { max-width: none; }
  .home-doors .doors { grid-template-columns: repeat(3, 1fr); }
  .home-doors .door a { padding-right: 20px; }
  .home-doors .door + .door a { padding-left: 20px; }
  .home-doors .door p { font-size: 0.9375rem; }
}
.home-doors { margin-top: var(--s5); padding-bottom: var(--s7); }
.home-also { margin-top: var(--s4); }
/* ---- after the first view: the questions people ask (Elliot's pick,
   2026-11-19). One paper ground, nothing pinned, no diagrams. Each section
   is a question and its answer: the question in ember at the left, the
   answer large beside it, a hairline above each pair. */
.home-q { display: grid; gap: var(--s4) 24px; padding-block: clamp(4.5rem, 12svh, 9rem) 0; }
.home-q-in { display: grid; gap: var(--s4) 24px; padding-top: var(--s5); border-top: 1px solid var(--line); }
.ask { font: 500 var(--t-h3)/1.25 var(--display); letter-spacing: -0.01em; color: var(--accent-text); max-width: 22ch; text-wrap: balance; }
.home-q h2 { max-width: 20ch; }
/* the people are the page's big claim, set larger */
.home-people .home-q h2 { font-size: clamp(2rem, 1.2rem + 3vw, 3.75rem); line-height: 1.04; letter-spacing: -0.03em; }
/* the pen marks one phrase in each answer as it comes into view, once
   (the first view's pen, carried down); whole where scroll timelines are
   missing, and in low or reduced motion */
@supports (animation-timeline: view()) {
  @media (prefers-reduced-motion: no-preference) {
    :root:not([data-motion="low"]) .home-q .pen path { animation: pen linear both; animation-timeline: view(); animation-range: entry 100% cover 55%; }
  }
}
.home-q .lead { margin-top: var(--s4); }
.home-q .more { margin-top: var(--s5); }
.home-q .answer { min-width: 0; }
@media (min-width: 900px) {
  .home-q-in { grid-template-columns: repeat(12, 1fr); padding-top: var(--s6); }
  .ask { grid-column: 1 / span 4; padding-top: 0.45em; }
  .home-q .answer { grid-column: 5 / -1; }
}
/* why it matters: the five goals stand on rules, the two hopes in ember */
.goals { list-style: none; margin: var(--s6) 0 0; padding: 0; display: grid; gap: 0 var(--s4); }
.goal { padding: var(--s3) 0; border-top: 1px solid var(--line-strong); font: 500 var(--t-body)/1.3 var(--text); color: var(--fg); }
.goal.hope { border-top-color: var(--accent); color: var(--accent-text); }
@media (min-width: 760px) {
  .goals { grid-template-columns: repeat(5, 1fr); }
  .goal { border-top-width: 2px; padding-top: var(--s4); }
}
.home-clients .logos { padding: var(--s2) 0 0; gap: var(--s5) var(--s7); }
.home-clients .logo { width: calc(var(--lw) * 1.6px); height: calc(var(--lh) * 1.6px); background: color-mix(in srgb, var(--fg) 82%, transparent); }
/* real people you can reach: a small round portrait beside the answer */
.people { display: flex; align-items: center; gap: var(--s5); }
.portrait { flex: none; width: 128px; height: 128px; border-radius: 50%; object-fit: cover; object-position: 48% 30%; }
:root[data-theme="dark"] .portrait { box-shadow: 0 0 0 1px var(--line); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .portrait { box-shadow: 0 0 0 1px var(--line); } }
.people .small { margin-top: var(--s2); color: var(--fg-2); }
@media (min-width: 760px) { .portrait { width: 176px; height: 176px; } .people { gap: var(--s6); } }
@media (max-width: 479px) { .people { flex-direction: column; align-items: flex-start; } }
/* the close is the visitor's turn: their question, and the field to ask it */
.home-close .talk-close { padding: 0 0 var(--s9); max-width: none; margin: 0; }
@media (min-width: 900px) { .home-close .talk-close { grid-column: 5 / -1; } }
`;

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

<section class="world home-belief" data-world="paper" data-pin="off" data-label="${t.belief.label}">
  <div class="wrap home-q"><div class="home-q-in">
    <p class="ask">${t.belief.ask}</p>
    <div class="answer">
      <h2>${marked(t.belief.h2, t.belief.h2Mark)}</h2>
      <ul class="goals">${t.belief.reasons.map((r, i) => html`<li class="${i >= t.belief.hopesFrom ? "goal hope" : "goal"}">${i === t.belief.hopesFrom ? html`<span class="sr-only">${t.belief.hopesLabel} </span>` : ""}${r}</li>`)}</ul>
    </div>
  </div></div>
</section>

<section class="world home-clients" data-world="paper" data-pin="off" data-label="${t.clients.label}">
  <div class="wrap home-q"><div class="home-q-in">
    <p class="ask">${t.clients.ask}</p>
    <div class="answer">
      <div aria-label="${t.clients.logosLabel}" role="group">${logoStrip(CLIENTS)}</div>
      <a class="more" href="/work">${common.workLink}${ARROW}</a>
    </div>
  </div></div>
</section>

<section class="world home-approach" data-world="paper" data-pin="off" data-label="${t.approach.label}">
  <div class="wrap home-q"><div class="home-q-in">
    <p class="ask">${t.approach.ask}</p>
    <div class="answer">
      <h2>${marked(t.approach.h2, t.approach.h2Mark)}</h2>
      <p class="lead">${t.approach.line}</p>
    </div>
  </div></div>
</section>

<section class="world home-people" data-world="paper" data-pin="off" data-label="${t.people.label}">
  <div class="wrap home-q"><div class="home-q-in">
    <p class="ask">${t.people.ask}</p>
    <div class="answer">
      <div class="people">
        ${portrait(t.people.photoAlt)}
        <div>
          <h2>${marked(t.people.h2, t.people.h2Mark)}</h2>
          <p class="small">${t.people.caption}</p>
          <a class="more" href="${t.people.cta.href}">${t.people.cta.text}${ARROW}</a>
        </div>
      </div>
    </div>
  </div></div>
</section>

<section class="world end home-close" data-world="paper" data-pin="off" data-label="Talk to us">
  <div class="wrap home-q"><div class="home-q-in"><p class="ask">${t.close}</p>${talkClose()}</div></div>
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
    t.belief.ask,
    `## ${t.belief.h2}`,
    ...t.belief.reasons.map((r) => `- ${r}`),
    t.clients.ask,
    t.approach.ask,
    `## ${t.approach.h2}`,
    t.approach.line,
    t.people.ask,
    `## ${t.people.h2}`,
    t.people.caption,
  ].join("\n\n");
}
