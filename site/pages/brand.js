import { html, raw } from "../html.js";
import { page, talkClose, ARROW } from "../parts/chrome.js";
import { brand as t } from "../content/en/brand.js";

// The files stay in brand/kit/: other sites link to them there.
const KIT = "/brand/kit/";

// The logo and swatch tiles are fixed colours in both themes (a tile shows
// the file as it will look on light or on dark), so they use the primitive
// tokens, never the theme's --bg and --fg.
const STYLE = raw(`<style>
.bd { padding: calc(56px + var(--s7)) 0 var(--s8); }
.bd-col > .lead { margin-top: var(--s4); }
.bd-zip { margin-top: var(--s5); }
.bd-sec { margin-top: var(--s8); }
.bd-sec > h2 { font-size: var(--t-h3); margin-bottom: var(--s4); }
.bd-sec > p { max-width: 65ch; }
.bd-sec > p + p { margin-top: var(--s3); }
.bd-sec a { text-underline-offset: 3px; text-decoration-color: var(--accent-text); }
.bd-quotes { list-style: none; margin: var(--s4) 0; padding: 0; display: grid; gap: var(--s3); }
.bd-quotes li { font: 500 var(--t-lead)/1.4 var(--display); max-width: 50ch; padding: var(--s3) 0; border-top: 1px solid var(--line); }

.bd-tiles { display: grid; gap: var(--s4); }
.bd-tile { margin: 0; }
.bd-tile .bd-swatch { display: grid; place-items: center; aspect-ratio: 16 / 7; border-radius: var(--r-surface); padding: var(--s6); box-shadow: inset 0 0 0 1px var(--line); }
.bd-tile img { width: min(100%, 320px); height: auto; }
.bd-on-light { background: var(--paper); }
.bd-on-dark { background: var(--ink); }
.bd-tile figcaption { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--s2) var(--s4); margin-top: var(--s3); font-size: var(--t-small); color: var(--fg-2); }
.bd-dl { font-weight: 600; color: var(--accent-text); text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
.bd-dl .arr { width: 16px; height: 16px; rotate: 90deg; }
.bd-files { list-style: none; margin: var(--s5) 0 var(--s4); padding: 0; }
.bd-files li { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--s1) var(--s4); padding: var(--s3) 0; border-top: 1px solid var(--line); font-size: var(--t-small); }
.bd-files li:last-child { border-bottom: 1px solid var(--line); }
.bd-files span { color: var(--fg-2); }
.bd-rules { margin: 0; padding-left: 1.2em; max-width: 65ch; display: grid; gap: var(--s2); }
.bd-rules li::marker { color: var(--accent-text); }

.bd-swatches { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s3); }
.bd-sw { display: grid; align-content: space-between; min-height: 132px; padding: var(--s4); border-radius: var(--r-surface); box-shadow: inset 0 0 0 1px var(--line); }
.bd-sw b { font: 600 var(--t-h3)/1.15 var(--display); letter-spacing: -0.015em; }
.bd-sw span { font: 500 var(--t-small)/1.4 var(--text); }
.bd-sw .num { font-variant-numeric: tabular-nums; }
.bd-c-ember { background: var(--ember); color: var(--ink); }
.bd-c-ink { background: var(--ink); color: var(--paper); }
.bd-c-paper { background: var(--paper); color: var(--ink); }
.bd-note { margin-top: var(--s4); }

.bd-fonts { list-style: none; margin: var(--s5) 0 0; padding: 0; }
.bd-font { padding: var(--s5) 0; border-top: 1px solid var(--line); display: grid; gap: var(--s3); }
.bd-font:last-child { border-bottom: 1px solid var(--line); }
.bd-font-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: var(--s2) var(--s4); font-size: var(--t-small); }
.bd-font-head b { font-size: var(--t-body); }
.bd-font-head span { color: var(--fg-2); }
.bd-sample { font-size: clamp(1.75rem, 1.2rem + 2.4vw, 3rem); line-height: 1.1; letter-spacing: -0.02em; text-wrap: balance; }
.bd-f-display { font-family: var(--display); font-weight: 600; }
.bd-f-text { font-family: var(--text); font-weight: 400; letter-spacing: 0; }
.bd-weights { display: flex; flex-wrap: wrap; gap: var(--s4); font-size: var(--t-lead); color: var(--fg-2); }

@media (min-width: 760px) {
  .bd-tiles { grid-template-columns: 1fr 1fr; }
  .bd-swatches { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1100px) {
  .bd { padding-top: calc(72px + var(--s8)); }
  .bd-col { max-width: 62rem; }
}
</style>`);

const dl = (file, label = file) => html`<a class="bd-dl" href="${KIT + file}" download>${label}${ARROW}</a>`;

export function render(p) {
  const main = html`${STYLE}
<section class="world bd" data-world="paper" data-pin="off" data-strip>
  <div class="wrap"><div class="bd-col">
    <h1><span class="half">${t.h1}</span></h1>
    <p class="lead">${t.lead}</p>
    <p class="bd-zip"><a class="btn btn-quiet" href="${t.zip.href}" download>${t.zip.text}</a></p>

    <section class="bd-sec" aria-labelledby="bd-describe">
      <h2 id="bd-describe">${t.describe.h2}</h2>
      <p>${t.describe.lead}</p>
      <ul class="bd-quotes">${t.describe.lines.map((l) => html`<li>${l}</li>`)}</ul>
      <p>${t.describe.after}</p>
    </section>

    <section class="bd-sec" aria-labelledby="bd-logo">
      <h2 id="bd-logo">${t.logo.h2}</h2>
      <div class="bd-tiles">
        ${[["light", t.logo.light], ["dark", t.logo.dark]].map(
          ([k, l]) => html`<figure class="bd-tile"><div class="bd-swatch bd-on-${k}"><img src="${KIT + l.file}" width="2596" height="637" alt="${t.logo.imgAlt}" loading="lazy" decoding="async"></div><figcaption><span>${l.label}: ${l.note}</span>${dl(l.file)}</figcaption></figure>`,
        )}
      </div>
      <ul class="bd-files">
        ${t.logo.files.map((x) => html`<li>${dl(x.file)}<span>${x.note}</span></li>`)}
      </ul>
      <p>${t.logo.alt}</p>
    </section>

    <section class="bd-sec" aria-labelledby="bd-rules">
      <h2 id="bd-rules">${t.rules.h2}</h2>
      <ul class="bd-rules">${t.rules.items.map((r) => html`<li>${r}</li>`)}</ul>
    </section>

    <section class="bd-sec" aria-labelledby="bd-colours">
      <h2 id="bd-colours">${t.colours.h2}</h2>
      <ul class="bd-swatches">
        ${t.colours.swatches.map(
          (s) => html`<li class="bd-sw bd-c-${s.token}"><b>${s.name}</b><span><span class="num">${s.hex}</span><br>${s.contrast}</span></li>`,
        )}
      </ul>
      <p class="small bd-note">${t.colours.note}</p>
    </section>

    <section class="bd-sec" aria-labelledby="bd-fonts">
      <h2 id="bd-fonts">${t.fonts.h2}</h2>
      <p>${t.fonts.lead} <a href="${t.fonts.licence.href}">${t.fonts.licence.text}</a>.</p>
      <ul class="bd-fonts">
        ${t.fonts.items.map(
          (f) => html`<li class="bd-font"><div class="bd-font-head"><b>${f.name}</b><span>${f.use}</span><a class="bd-dl" href="${f.href}" download>${t.fonts.download}${ARROW}</a></div><p class="bd-sample bd-f-${f.family}">${f.sample}</p><p class="bd-weights bd-f-${f.family}" aria-hidden="true"><span style="font-weight:300">Aa</span><span style="font-weight:400">Aa</span><span style="font-weight:600">Aa</span><span style="font-weight:800">Aa</span></p></li>`,
        )}
      </ul>
    </section>

    <section class="bd-sec" aria-labelledby="bd-questions">
      <h2 id="bd-questions">${t.questions.h2}</h2>
      <p>${t.questions.before}<a href="mailto:${t.questions.email}">${t.questions.email}</a>${t.questions.after}<a href="${t.questions.guidelines.href}">${t.questions.guidelines.text}</a>${t.questions.end}</p>
    </section>
  </div></div>
  ${talkClose()}
</section>`;
  return page(p, t, main);
}

export function text() {
  return [
    `# ${t.h1}`,
    t.lead,
    `## ${t.describe.h2}`,
    t.describe.lead,
    ...t.describe.lines.map((l) => `- ${l}`),
    t.describe.after,
    `## ${t.rules.h2}`,
    ...t.rules.items.map((r) => `- ${r}`),
    `## ${t.colours.h2}`,
    ...t.colours.swatches.map((s) => `- ${s.name} ${s.hex}: ${s.contrast}`),
    t.colours.note,
    `## ${t.fonts.h2}`,
    t.fonts.lead,
    ...t.fonts.items.map((f) => `- ${f.name}: ${f.use}`),
  ].join("\n\n");
}
