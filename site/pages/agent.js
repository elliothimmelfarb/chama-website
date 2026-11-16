import { html, raw } from "../html.js";
import { page } from "../parts/chrome.js";
import { agent as t } from "../content/en/agent.js";
import { common as c } from "../content/en/common.js";

// talk.js draws the chat into [data-agent] (ChamaTalk.mount, page mode). It
// is a deferred script, so it has run by DOMContentLoaded. /agent is not in
// the router, so this inline script runs on every visit.
const MOUNT = raw(`<script>document.addEventListener("DOMContentLoaded",function(){var el=document.querySelector("[data-agent]");if(el&&window.ChamaTalk)window.ChamaTalk.mount(el,{mode:"page"});});</script>`);

const STYLE = raw(`<style>
.ag { padding-top: 56px; }
.ag-ns { max-width: 44rem; margin: 0 auto; padding: var(--s5) var(--gutter) var(--s8); }
.ag-ns .lead { margin-top: var(--s4); }
.ag-form { display: grid; gap: var(--s4); margin-top: var(--s6); }
.ag-form label { display: grid; gap: var(--s2); font: 600 var(--t-label)/1.2 var(--text); color: var(--fg-2); }
.ag-form input, .ag-form textarea { font: 400 1rem/1.4 var(--text); color: var(--fg); background: var(--surface); border: 0; border-radius: var(--r-pill); box-shadow: inset 0 0 0 1px var(--fg-2); padding: 12px 18px; }
.ag-form textarea { border-radius: var(--r-surface); min-height: 8rem; resize: vertical; }
.ag-form .ag-hint { font: 400 var(--t-small)/1.4 var(--text); color: var(--fg-2); }
.ag-form .ag-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.ag-fine { margin-top: var(--s5); }
.ag-form .btn { justify-self: start; height: 48px; padding: 0 24px; }
@media (min-width: 1100px) { .ag { padding-top: 72px; } }
</style>`);

const fallback = () => html`<noscript><div class="ag-ns">
  <h1>${t.h1}</h1>
  <p class="lead">${t.noscript.lead}</p>
  <form class="ag-form" action="/api/intake" method="post">
    <label>${t.noscript.name}<input name="name" autocomplete="name" required maxlength="120"></label>
    <label>${t.noscript.email}<input name="email" type="email" autocomplete="email" maxlength="254"></label>
    <label>${t.noscript.phone}<input name="whatsappNumber" type="tel" autocomplete="tel" maxlength="50"></label>
    <p class="ag-hint">${t.noscript.contactHint}</p>
    <label>${t.noscript.request}<textarea name="request" required maxlength="4000"></textarea></label>
    <input class="ag-hp" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn btn-accent" type="submit">${t.noscript.submit}</button>
  </form>
  <p class="small ag-fine">${c.talk.privacy} <a href="/privacy">${c.talk.privacyLink}</a></p>
</div></noscript>`;

export function render(p) {
  const main = html`${STYLE}
<section class="world ag" data-world="paper" data-pin="off">
  <div data-agent>${fallback()}</div>
</section>
${MOUNT}`;
  return page(p, t, main);
}

export function text() {
  return "";
}
