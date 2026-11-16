import { html, raw } from "../html.js";
import { page, talkClose } from "../parts/chrome.js";
import { privacy as t } from "../content/en/privacy.js";

const f = t.flow;

// "Where it goes": wide on desktop, tall on a phone, where the wide one's
// labels would fall under 12px. Still, not pinned: it is drawn complete.
// The one ember part is the route a message takes, from you to the reply.
const lines = (x, y, [head, ...rest], { anchor = "start", gap = 17, hot = -1 } = {}) => html`<text x="${x}" y="${y}" text-anchor="${anchor}"><tspan class="pv-h">${head}</tspan>${rest.map(
  (r, i) => html`<tspan x="${x}" dy="${gap}" class="${i === hot ? "pv-hot" : "pv-s"}">${r}</tspan>`,
)}</text>`;

const wide = () => html`<svg class="pv-fig pv-wide" viewBox="0 0 640 310" aria-hidden="true" focusable="false">
  <path class="pv-route" d="M92 160H202M298 150C350 140 372 72 424 70"/>
  <path class="pv-ln" d="M298 160H424"/>
  <path class="pv-ln pv-dash" d="M298 170C350 180 372 248 424 250"/>
  <circle class="pv-node" cx="72" cy="160" r="18"/>
  <rect class="pv-node" x="202" y="140" width="96" height="40" rx="20"/>
  <circle class="pv-dot" cx="430" cy="70" r="5"/><circle class="pv-dot" cx="430" cy="160" r="5"/><circle class="pv-dot" cx="430" cy="250" r="5"/>
  <text class="pv-s" x="147" y="148" text-anchor="middle">${f.edges.typed}</text>
  <text class="pv-s" x="147" y="182" text-anchor="middle">${f.edges.back}</text>
  ${lines(72, 204, f.nodes.you, { anchor: "middle" })}
  ${lines(250, 204, f.nodes.chat, { anchor: "middle" })}
  ${lines(446, 66, f.nodes.api)}
  ${lines(446, 156, f.nodes.store, { hot: 1 })}
  ${lines(446, 246, f.nodes.email)}
  <text class="pv-s" x="300" y="290" text-anchor="middle">${f.edges.asked}</text>
</svg>`;

const tall = () => html`<svg class="pv-fig pv-tall" viewBox="0 0 340 540" aria-hidden="true" focusable="false">
  <path class="pv-route" d="M50 60V150M50 186V260H104"/>
  <path class="pv-ln" d="M50 260V360H104"/>
  <path class="pv-ln pv-dash" d="M50 360V460H104"/>
  <circle class="pv-node" cx="50" cy="40" r="18"/>
  <rect class="pv-node" x="22" y="150" width="56" height="36" rx="18"/>
  <circle class="pv-dot" cx="110" cy="260" r="5"/><circle class="pv-dot" cx="110" cy="360" r="5"/><circle class="pv-dot" cx="110" cy="460" r="5"/>
  ${lines(80, 36, f.nodes.you)}
  <text class="pv-s" x="64" y="102">${f.edges.typed}</text>
  <text class="pv-s" x="64" y="120">${f.edges.back}</text>
  ${lines(94, 164, f.nodes.chat)}
  ${lines(126, 256, f.nodes.api)}
  ${lines(126, 356, f.nodes.store, { hot: 1 })}
  ${lines(126, 456, [...f.nodes.email, f.edges.asked])}
</svg>`;

const STYLE = raw(`<style>
.pv { padding: calc(56px + var(--s7)) 0 var(--s8); }
.pv-col { max-width: 65ch; }
.pv h1 { max-width: 14ch; }
.pv-sec { margin-top: var(--s8); }
.pv-sec h2 { font-size: var(--t-h3); margin-bottom: var(--s4); }
.pv-sec p { max-width: 65ch; text-wrap: pretty; }
.pv-sec p + p { margin-top: var(--s3); }
.pv-sec a { text-underline-offset: 3px; text-decoration-color: var(--accent-text); }
.pv-addr { margin-top: var(--s3); color: var(--fg-2); }
.pv-eff { margin-top: var(--s8); }
.pv-figure { margin: var(--s2) 0 var(--s6); }
.pv-figure figcaption { margin-top: var(--s3); }
.pv-fig { display: block; width: 100%; height: auto; overflow: visible; }
.pv-fig text { font: 400 13px/1 var(--text); fill: var(--fg-2); }
.pv-fig .pv-h { font-weight: 600; font-size: 14px; fill: var(--fg); }
.pv-fig .pv-hot { fill: var(--accent-text); }
.pv-fig .pv-route { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; }
.pv-fig .pv-ln { fill: none; stroke: var(--line-strong); stroke-width: 1.5; }
.pv-fig .pv-dash { stroke-dasharray: 4 5; }
.pv-fig .pv-node { fill: var(--surface); stroke: var(--fg); stroke-width: 1.5; }
.pv-fig .pv-dot { fill: var(--fg); }
.pv-wide { display: none; }
.pv-tall { max-width: 24rem; }
@media (min-width: 640px) { .pv-wide { display: block; max-width: 44rem; } .pv-tall { display: none; } }
@media (min-width: 1100px) {
  .pv { padding-top: calc(72px + var(--s8)); }
  .pv-col { margin-left: calc((100% + 24px) / 12 * 2); }
}
</style>`);

const section = (s, extra) => html`<section class="pv-sec" aria-labelledby="pv-${s.id}">
  <h2 id="pv-${s.id}">${s.h2}</h2>
  ${extra || ""}
  ${(s.paras || []).map((x) => html`<p>${x}</p>`)}
</section>`;

export function render(p) {
  const main = html`${STYLE}
<section class="world pv" data-world="paper" data-pin="off" data-strip>
  <div class="wrap"><div class="pv-col">
    <h1><span class="half">${t.h1}</span></h1>
    <section class="pv-sec" aria-labelledby="pv-who">
      <h2 id="pv-who">${t.who.h2}</h2>
      <p>${t.who.lead}</p>
      <p class="pv-addr">${t.who.registry}<br>${t.who.address[0]}<br>${t.who.address[1]}</p>
    </section>
    ${section({ id: "chat", ...t.chat })}
    ${section({ id: "details", ...t.details })}
    ${section(
      { id: "flow", ...f },
      html`<figure class="pv-figure" role="img" aria-label="${f.label}">${wide()}${tall()}<figcaption class="small">${f.note}</figcaption></figure>`,
    )}
    ${section({ id: "hearth", ...t.hearth })}
    ${section({ id: "keep", ...t.keep })}
    <section class="pv-sec" aria-labelledby="pv-rights">
      <h2 id="pv-rights">${t.rights.h2}</h2>
      <p>${t.rights.before}<a href="mailto:${t.rights.email}">${t.rights.email}</a>${t.rights.after}</p>
      <p>${t.rights.complain}</p>
    </section>
    <p class="small pv-eff">${t.effective}</p>
  </div></div>
  ${talkClose()}
</section>`;
  return page(p, t, main);
}

export function text() {
  return [
    `# ${t.h1}`,
    `## ${t.who.h2}`,
    t.who.lead,
    [t.who.registry, ...t.who.address].join("\n"),
    `## ${t.chat.h2}`,
    ...t.chat.paras,
    `## ${t.details.h2}`,
    ...t.details.paras,
    `## ${f.h2}`,
    f.label,
    ...f.paras,
    `## ${t.hearth.h2}`,
    ...t.hearth.paras,
    `## ${t.keep.h2}`,
    ...t.keep.paras,
    `## ${t.rights.h2}`,
    t.rights.before + t.rights.email + t.rights.after,
    t.rights.complain,
    t.effective,
  ].join("\n\n");
}
