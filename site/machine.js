// The files machines read: sitemap.xml, llms.txt and llms-full.txt. They are
// built from the same pages and copy as the HTML, so they cannot drift.

import { url } from "./site.js";

const xml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function sitemap(site, pages) {
  const entries = pages
    .filter((p) => !p.noindex)
    .map(
      (p) => `  <url>
    <loc>${xml(url(p.path))}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <priority>${p.priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${xml(url(p.path))}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${xml(url(p.path))}"/>
  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries}
</urlset>
`;
}

export const SUMMARY =
  "Chama Inteligente is a small, family-owned, AI-native business in Lisbon, working worldwide. It solves any software problem, gives businesses their own engineering department, builds websites, apps and products, and coaches individuals and teams in AI fluency.";

export function llms(site, pages) {
  const list = pages
    .filter((p) => !p.noindex)
    .map((p) => `- [${p.title}](${url(p.path)}): ${p.summary}`)
    .join("\n");
  return `# ${site.name}

> ${SUMMARY}

"Chama" is Portuguese for flame. The full name means "intelligent flame".

## Pages

${list}

## Optional

- [Full text](${url("/llms-full.txt")}): every word of the public site in one plain-text file
`;
}

export function llmsFull(site, rendered) {
  const body = rendered
    .filter((r) => r.text)
    .map((r) => `## ${r.page.title} (${url(r.page.path)})\n\n${r.text.trim()}\n`)
    .join("\n---\n\n");
  return `# ${site.name}: full site text

> ${SUMMARY}

This file is the complete visible text of ${site.origin}, in reading order, for AI crawlers and agents that prefer plain text to HTML. It adds nothing the pages do not say.

${site.legalName} is a Portuguese company (NIPC ${site.nipc}) based in Lisbon.

---

${body}`;
}
