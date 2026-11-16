import { html, raw } from "../html.js";
import { page, talkClose } from "../parts/chrome.js";
import { hearthPublic as t } from "../content/en/hearth-public.js";

// The Remember cards' gaps on a day axis: each hop longer than the last.
// Drawn complete; the ember part is the last, longest hop.
const gaps = () => {
  const x = (d) => 16 + (d * 288) / 35;
  const days = [0, ...t.gaps.days];
  const hops = days.slice(1).map((d, i) => {
    const a = x(days[i]), b = x(d), h = Math.min(54, 10 + (b - a) * 0.45);
    return { d: `M${a.toFixed(1)} 70Q${((a + b) / 2).toFixed(1)} ${(70 - h * 2).toFixed(1)} ${b.toFixed(1)} 70`, last: i === days.length - 2 };
  });
  return html`<figure class="hp-gaps" role="img" aria-label="${t.gaps.label}">
  <svg viewBox="0 0 320 100" aria-hidden="true" focusable="false">
    <path class="hp-axis" d="M16 70H304"/>
    ${hops.map((h) => html`<path class="${h.last ? "hp-hop hp-hot" : "hp-hop"}" d="${h.d}"/>`)}
    ${t.gaps.days.map((d) => html`<circle class="hp-dot" cx="${x(d).toFixed(1)}" cy="70" r="3.5"/>`)}
    ${t.gaps.days.map((d) => html`<text x="${x(d).toFixed(1)}" y="92" text-anchor="middle">${d}</text>`)}
  </svg>
  <figcaption class="small">${t.gaps.days.join(", ")} ${t.gaps.unit}</figcaption>
</figure>`;
};

const STYLE = raw(`<style>
.hp-first { padding: calc(56px + var(--s7)) 0 0; }
.hp-feats { margin-top: var(--s8); }
.hp-first .lead { margin-top: var(--s4); }
.hp-actions { display: flex; flex-wrap: wrap; gap: var(--s3); margin-top: var(--s6); }
.hp-actions .btn { height: 48px; padding: 0 22px; font-size: 0.9375rem; }
.hp-actions .btn-quiet { background: var(--surface); box-shadow: inset 0 0 0 1px var(--fg-2); }
.hp-feats { list-style: none; margin: 0; padding: 0; }
.hp-feat { display: grid; align-content: start; gap: var(--s3); padding: var(--s6) 0; border-top: 1px solid var(--line); }
.hp-feat:last-child { border-bottom: 1px solid var(--line); }
.hp-feat h2, .hp-more h2 { font-size: var(--t-h3); }
.hp-feat p { color: var(--fg-2); max-width: 52ch; text-wrap: pretty; }
.hp-gaps { margin: var(--s3) 0 0; max-width: 26rem; }
.hp-gaps svg { display: block; width: 100%; height: auto; overflow: visible; }
.hp-gaps text { font: 600 13px/1 var(--text); fill: var(--fg-2); font-variant-numeric: tabular-nums; }
.hp-gaps .hp-axis { stroke: var(--line-strong); stroke-width: 1; }
.hp-gaps .hp-hop { fill: none; stroke: var(--fg); stroke-width: 1.5; stroke-dasharray: 3 4; stroke-linecap: round; }
.hp-gaps .hp-hot { stroke: var(--accent); stroke-dasharray: none; stroke-width: 2; }
.hp-gaps .hp-dot { fill: var(--fg); }
.hp-gaps figcaption { margin-top: var(--s2); }
.hp-more { padding: var(--s8) 0 0; display: grid; gap: var(--s7); }
.hp-more p { margin-top: var(--s3); color: var(--fg-2); max-width: 52ch; }
.hp-member { margin-top: var(--s4); }
.hp-member a { color: var(--accent-text); font-weight: 600; text-underline-offset: 3px; }
@media (min-width: 1100px) {
  .hp-first { padding-top: calc(72px + var(--s9)); }
  .hp-first .lead { max-width: 46ch; }
  .hp-feats { display: grid; grid-template-columns: 1fr 1fr; column-gap: var(--s8); }
  .hp-feat:nth-last-child(2) { border-bottom: 1px solid var(--line); }
  .hp-more { grid-template-columns: 1fr 1fr; column-gap: var(--s8); }
}
</style>`);

export function render(p) {
  const main = html`${STYLE}
<section class="world hp-first" data-world="ember" data-pin="off">
  <div class="wrap">
    <h1><span class="half">${t.h1}</span></h1>
    <p class="lead">${t.lead}</p>
    <p class="hp-actions"><a class="btn btn-accent" href="${t.signIn.href}">${t.signIn.text}</a><a class="btn btn-quiet" href="${t.coaching.href}">${t.coaching.text}</a></p>
    <ul class="hp-feats">
      ${t.features.map((f) => html`<li class="hp-feat"><h2>${f.h2}</h2><p>${f.lead}</p>${f.figure === "gaps" ? gaps() : ""}</li>`)}
    </ul>
    <div class="hp-more">
      <div><h2>${t.private.h2}</h2><p>${t.private.lead}</p></div>
      <div><h2>${t.join.h2}</h2><p>${t.join.lead}</p><p class="hp-member">${t.member.before}<a href="${t.signIn.href}">${t.member.link}</a>${t.member.after}</p></div>
    </div>
  </div>
  ${talkClose(t.close)}
</section>`;
  return page(p, t, main);
}

export function text() {
  return [
    `# ${t.h1}`,
    t.lead,
    ...t.features.flatMap((f) => [`## ${f.h2}`, f.lead]),
    `## ${t.private.h2}`,
    t.private.lead,
    `## ${t.join.h2}`,
    t.join.lead,
  ].join("\n\n");
}
