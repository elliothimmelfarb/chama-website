// The parts every public page shares: head, header (with the phone menu and
// the desktop Display popover), the Talk to us field and sheet, the footer,
// and page() that puts a page's <main> inside them.

import { html, raw } from "../html.js";
import { SITE, PAGES, url } from "../site.js";
import { BOOT } from "./boot.js";
import { common as c } from "../content/en/common.js";

export const MARK = raw(
  `<svg class="mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g transform="translate(2.06 0.06)" fill="var(--accent)"><path d="M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z"/><path d="M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z"/></g></svg>`,
);
export const ARROW = raw(
  `<svg class="arr" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4 10h11M11 5.5 15.5 10 11 14.5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
);
const DISPLAY_ICON = raw(
  `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg>`,
);
const MENU_ICON = raw(
  `<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M2 6h14M2 12h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
);
const CLOSE_ICON = raw(
  `<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M4 4l10 10M14 4 4 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
);

const navPages = () => PAGES.filter((p) => p.nav);

// Theme and Motion as two segmented controls. talk.js and the menu share
// them; the choice is stored and applied by assets/chrome.js.
const settings = (where) => html`
  <div class="settings" data-settings>
    <fieldset class="seg">
      <legend>${c.theme.label}</legend>
      ${["system", "light", "dark"].map(
        (v) => html`<label><input type="radio" name="theme-${where}" value="${v}" data-set-theme><span>${c.theme[v]}</span></label>`,
      )}
    </fieldset>
    <fieldset class="seg">
      <legend>${c.motion.label}</legend>
      ${["full", "low"].map(
        (v) => html`<label><input type="radio" name="motion-${where}" value="${v}" data-set-motion><span>${c.motion[v]}</span></label>`,
      )}
    </fieldset>
  </div>`;

export function head(page, { title, description, ogAlt }) {
  const canonical = url(page.path);
  return html`<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <script>${raw(BOOT)}</script>
  <style>@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto; } }</style>
  <link rel="preload" href="/assets/fonts/funnel-display-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/tokens.css">
  <link rel="stylesheet" href="/assets/base.css">
  <link rel="stylesheet" href="/assets/worlds.css">
  <script src="/assets/sky.js" defer></script>
  <script src="/assets/worlds.js" defer></script>
  <script src="/assets/chrome.js" defer></script>
  <script src="/assets/talk.js" defer fetchpriority="low"></script>
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#f3f0e8" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#161513" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="en" href="${canonical}">
  <link rel="alternate" hreflang="x-default" href="${canonical}">
  <link rel="sitemap" type="application/xml" href="/sitemap.xml">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${SITE.name}">
  <meta property="og:locale" content="en_US">
  <meta property="og:image" content="${url(page.ogImage || SITE.ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${ogAlt || title}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${url(page.ogImage || SITE.ogImage)}">
  <script type="application/ld+json">${raw(JSON.stringify(jsonLd(page, title, description)))}</script>
</head>`;
}

function jsonLd(page, title, description) {
  const org = {
    "@type": "ProfessionalService",
    "@id": url("/#organization"),
    name: SITE.name,
    alternateName: "Chama",
    legalName: SITE.legalName,
    url: url("/"),
    logo: url("/apple-touch-icon.png"),
    image: url(SITE.ogImage),
    email: c.footer.email,
    address: { "@type": "PostalAddress", addressLocality: "Lisbon", addressCountry: "PT" },
    areaServed: "Worldwide",
    founder: { "@type": "Person", name: "Elliot Himmelfarb" },
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      org,
      { "@type": "WebSite", "@id": url("/#website"), url: url("/"), name: SITE.name, publisher: { "@id": url("/#organization") }, inLanguage: "en" },
      { "@type": "WebPage", "@id": url(page.path) + "#webpage", url: url(page.path), name: title, description, isPartOf: { "@id": url("/#website") }, about: { "@id": url("/#organization") }, inLanguage: "en" },
    ],
  };
}

export function header(page) {
  const here = (p) => (p.id === page.id ? raw(' aria-current="page"') : "");
  return html`<a class="skip" href="#main">${c.skip}</a>
<header class="top" data-top>
  <a class="lockup" href="/" aria-label="${c.home}">${MARK}<span>${c.lockup}</span></a>
  <nav class="nav" aria-label="${c.pagesLabel}">
    ${navPages().map((p) => html`<a class="nav-link" href="${p.path}"${here(p)}>${c.navLabels[p.id]}</a>`)}
  </nav>
  <div class="top-end">
    <button class="btn btn-quiet display-btn" type="button" popovertarget="display">${DISPLAY_ICON}<span>${c.display}</span></button>
    <a class="btn btn-accent talk-btn" href="/agent" data-talk>${c.talk.button}</a>
    <button class="btn btn-quiet icon-btn menu-btn" type="button" popovertarget="menu" aria-label="${c.menu}">${MENU_ICON}</button>
  </div>
  <div class="pop display-pop" id="display" popover>
    ${settings("display")}
    <p class="pop-note">${c.motion.note}</p>
  </div>
  <div class="pop menu" id="menu" popover>
    <div class="menu-head">
      <span class="menu-title">${c.menu}</span>
      <button class="btn btn-quiet icon-btn" type="button" popovertarget="menu" popovertargetaction="hide" aria-label="${c.close}">${CLOSE_ICON}</button>
    </div>
    <ul class="menu-pages">
      ${navPages().map(
        (p) => html`<li><a href="${p.path}"${here(p)}><span class="menu-name">${c.navLabels[p.id]}</span><span class="menu-line">${c.menuLines[p.id]}</span></a></li>`,
      )}
    </ul>
    ${settings("menu")}
    <a class="menu-members" href="/hearth">${c.members}</a>
  </div>
</header>`;
}

// The field that opens the conversation: the cycling phrase as its label,
// the button always "Talk to us". talk.js takes over the submit; without
// JavaScript it posts to /agent, which still works.
let fieldCount = 0;
export function talkField({ id } = {}) {
  const fid = id || `ask-${++fieldCount}`;
  return html`<form class="talk-field" action="/agent" method="get" data-talk-form>
  <label class="cycle" for="${fid}"><span class="sr-only">${c.talk.srLabel}</span><span class="cycle-words" aria-hidden="true" data-cycle>${c.talk.phrases.map((p, i) => html`<span${i === 0 ? raw(' class="on"') : ""}>${p}</span>`)}</span></label>
  <div class="field"><input id="${fid}" name="q" placeholder="${c.talk.placeholder}" autocomplete="off" enterkeyhint="send"><button class="btn btn-accent" type="submit">${c.talk.button}</button></div>
</form>`;
}

// The closing block of every page.
export function talkClose(line) {
  return html`<section class="talk-close" aria-label="${c.talk.button}">
  ${line ? html`<p class="talk-close-line">${line}</p>` : ""}
  ${talkField()}
</section>`;
}

export function footer() {
  return html`<footer class="foot">
  <div class="foot-who">
    <a class="lockup" href="/" aria-label="${c.home}">${MARK}<span>${c.lockup}</span></a>
    <p>${c.footer.where}</p>
  </div>
  <nav class="foot-pages" aria-label="${c.pagesLabel}">
    <ul>
      ${navPages().map((p) => html`<li><a href="${p.path}">${c.navLabels[p.id]}</a></li>`)}
      <li><a href="/hearth">${c.membersShort}</a></li>
      <li><a href="/brand">${c.footer.brand}</a></li>
      <li><a href="/privacy">${c.footer.privacy}</a></li>
    </ul>
  </nav>
  <div class="foot-settings">${settings("foot")}</div>
  <p class="foot-legal">${c.footer.legal} <a href="mailto:${c.footer.email}">${c.footer.email}</a></p>
</footer>`;
}

// A whole document: head, header, the page's <main>, footer.
export function page(p, meta, main) {
  fieldCount = 0;
  return html`<!doctype html>
<html lang="en">
${head(p, meta)}
<body data-page="${p.id}">
${header(p)}
<main id="main">
${main}
</main>
${footer()}
</body>
</html>
`;
}
