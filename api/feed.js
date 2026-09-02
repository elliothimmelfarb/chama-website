// /feed, /feed/<slug>, /feed.xml: the public side of the feed.
//
// Rendered here as plain HTML in the site's own paper, with no script and
// no external request, so the homepage's promise holds on this page too.
// Off until the owner switches `feed_public` on; until then every URL here
// says so. Post bodies are plain text: paragraphs are split on blank lines
// and every character is escaped, so a post can never carry markup.

import { configured, ready, sql } from "../lib/hearth/db.js";
import { publicPosts, publicPost } from "../lib/hearth/routes/feed.js";

const SITE = "https://chamainteligente.com";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function paragraphs(body) {
  return String(body || "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("\n");
}

function date(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

const STYLE = `
:root{--paper:#f3f0e8;--ink:#141412;--quiet:#66635c;--ember:#f4581f;--line:rgba(20,20,18,.24);--pad:clamp(1.25rem,4vw,4.5rem);--sans:"Helvetica Neue",Helvetica,Arial,sans-serif}
*{box-sizing:border-box}html{background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:16px;-webkit-font-smoothing:antialiased}
body{margin:0}a{color:inherit}a:hover{color:var(--ember)}
.frame{width:min(100%,48rem);margin:0 auto;padding:0 var(--pad)}
.mast{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;padding:clamp(1.2rem,2.4vw,2.3rem) 0 1.1rem;border-bottom:1px solid var(--ink)}
.mast a{text-decoration:none;font-weight:700;letter-spacing:-.02em}.mast small{color:var(--quiet);font-size:.72rem;letter-spacing:.14em;text-transform:uppercase}
h1{font-size:clamp(2rem,5vw,3.2rem);letter-spacing:-.03em;line-height:1;margin:2.5rem 0 .6rem}
.lede{color:var(--quiet);max-width:46ch;margin:0 0 2.5rem;line-height:1.5}
article{padding:1.8rem 0;border-top:1px solid var(--line)}article:first-of-type{border-top:0}
.kicker{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--quiet);margin:0 0 .5rem}
.kicker b{color:var(--ember)}
h2{font-size:1.5rem;letter-spacing:-.02em;margin:0 0 .6rem;line-height:1.15}h2 a{text-decoration:none}
article p{line-height:1.55;margin:0 0 .8rem}
.link{display:inline-block;margin-top:.2rem;font-size:.9rem;color:var(--ember);word-break:break-all}
footer{padding:3rem 0 4rem;color:var(--quiet);font-size:.8rem;border-top:1px solid var(--line);margin-top:2rem}
.empty{padding:3rem 0;color:var(--quiet)}
`;

function page({ title, description, canonical, body, noindex = false, feedLink = true }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow"}">
<meta name="theme-color" content="#f3f0e8">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${feedLink ? `<link rel="alternate" type="application/rss+xml" title="Chama Inteligente feed" href="${SITE}/feed.xml">` : ""}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${SITE}/og.png">
<style>${STYLE}</style>
</head>
<body>
<div class="frame">
<header class="mast"><a href="/">Chama Inteligente</a><small><a href="/feed" style="font-weight:400">The feed</a> · <a href="/hearth" style="font-weight:400">Members</a></small></header>
<main>
${body}
</main>
<footer>Chama Inteligente, Lda. Lisbon. <a href="/privacy">Privacy</a> · <a href="/feed.xml">RSS</a> · Agents: <a href="/mcp">MCP</a></footer>
</div>
</body>
</html>`;
}

function article(p, { standalone = false } = {}) {
  const url = `${SITE}/feed/${encodeURIComponent(p.slug)}`;
  const heading = standalone ? `<h1>${esc(p.title)}</h1>` : `<h2><a href="/feed/${encodeURIComponent(p.slug)}">${esc(p.title)}</a></h2>`;
  return `<article>
<p class="kicker"><time datetime="${esc(p.published_at)}">${date(p.published_at)}</time>${p.pinned ? " · <b>pinned</b>" : ""}${p.kind !== "note" ? ` · ${esc(p.kind)}` : ""}</p>
${heading}
${paragraphs(p.body)}
${p.url ? `<a class="link" href="${esc(p.url)}" rel="noopener">${esc(p.url)}</a>` : ""}
${standalone ? "" : `<p class="kicker" style="margin-top:.6rem"><a href="/feed/${encodeURIComponent(p.slug)}" style="text-decoration:none">permanent link</a></p>`}
</article>`.replace(/\$\{url\}/g, url);
}

async function feedPublic() {
  const rows = await sql()`select value from settings where key = 'feed_public'`;
  return rows[0] ? rows[0].value === true : false;
}

function closed() {
  return page({
    title: "The feed | Chama Inteligente",
    description: "What Elliot is looking at. Not open yet.",
    canonical: `${SITE}/feed`,
    noindex: true,
    feedLink: false,
    body: `<h1>The feed</h1><p class="lede">What Elliot is looking at, as it happens. Not open to the public yet. Members read it in the <a href="/hearth">Hearth</a>.</p>`
  });
}

function html(body, status = 200, cache = "public, max-age=60, s-maxage=300, stale-while-revalidate=600") {
  return new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cache } });
}

function rss(posts) {
  const items = posts.map((p) => `<item>
<title>${esc(p.title)}</title>
<link>${SITE}/feed/${encodeURIComponent(p.slug)}</link>
<guid isPermaLink="true">${SITE}/feed/${encodeURIComponent(p.slug)}</guid>
<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
<description>${esc(paragraphs(p.body) + (p.url ? `<p><a href="${esc(p.url)}">${esc(p.url)}</a></p>` : ""))}</description>
</item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Chama Inteligente: the feed</title>
<link>${SITE}/feed</link>
<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
<description>What Elliot Himmelfarb is looking at. AI coaching and custom software, Lisbon.</description>
<language>en</language>
${items}
</channel>
</rss>`;
}

export async function handleFeed(request) {
  const url = new URL(request.url);
  let path = url.pathname;
  if (path === "/api/feed") {
    const segments = url.searchParams.getAll("path");
    path = "/feed" + (segments.length ? "/" + segments.join("/") : "");
    if (url.searchParams.get("format") === "xml") path = "/feed.xml";
  }
  if (!configured()) return html(closed(), 503, "no-store");
  try {
    await ready();
    const open = await feedPublic();
    if (path === "/feed.xml") {
      if (!open) return new Response("The feed is not open yet.", { status: 404, headers: { "Cache-Control": "no-store" } });
      return new Response(rss(await publicPosts(50)), { status: 200, headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=900" } });
    }
    if (!open) return html(closed(), 404, "no-store");
    if (path === "/feed" || path === "/feed/") {
      const posts = await publicPosts(30);
      const body = `<h1>The feed</h1><p class="lede">What Elliot is looking at, as it happens. Dated, so you can see what he said when.</p>` +
        (posts.length ? posts.map((p) => article(p)).join("\n") : `<p class="empty">Nothing yet.</p>`);
      return html(page({ title: "The feed | Chama Inteligente", description: "What Elliot Himmelfarb is looking at: AI, coaching, and what has changed this week.", canonical: `${SITE}/feed`, body }));
    }
    const slug = decodeURIComponent(path.replace(/^\/feed\//, "")).slice(0, 120);
    const post = await publicPost(slug);
    if (!post) return html(page({ title: "Not found | Chama Inteligente", description: "", canonical: `${SITE}/feed`, noindex: true, body: `<h1>Not here</h1><p class="lede">There is no post at that address. <a href="/feed">The feed</a>.</p>` }), 404, "no-store");
    const summary = String(post.body || "").split(/\n\s*\n/)[0].slice(0, 200) || post.title;
    return html(page({ title: `${post.title} | Chama Inteligente`, description: summary, canonical: `${SITE}/feed/${encodeURIComponent(post.slug)}`, body: article(post, { standalone: true }) + `<p class="kicker" style="margin-top:2rem"><a href="/feed" style="text-decoration:none">All posts</a></p>` }));
  } catch (error) {
    console.error("Feed page failed", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    return html(closed(), 500, "no-store");
  }
}

export default {
  async fetch(request) {
    return await handleFeed(request);
  }
};
