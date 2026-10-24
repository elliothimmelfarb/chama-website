// The public pages come in two parallel versions: the animated version (/,
// /coaching, /about: the primary one, a scroll through animated worlds) and
// the low motion version (under /simple: the same copy as a plain page).
// These tests guard the seams between them: both versions carry the same
// motion switch, and each low motion page's switch reaches its animated
// counterpart and its links stay in the low motion
// version, each animated page offers its low motion counterpart (and sends
// a reader who chose it there) and otherwise never drops a reader into it,
// the animated pages' navigation reaches all three of them from the top and
// the bottom, the old /worlds addresses lead home, and no public page asks
// another host for anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PAIRS = [
  { words: "/simple", worlds: "/" },
  { words: "/simple/coaching", worlds: "/coaching" },
  { words: "/simple/about", worlds: "/about" },
  { words: "/simple/work", worlds: "/work" },
];

// The same mapping Vercel's cleanUrls applies: /x serves x.html, and a
// folder serves its index.html.
// /hearth is the public page for anyone signed out (see vercel.json).
function fileFor(url) {
  if (url === "/") return path.join(ROOT, "index.html");
  if (url === "/hearth") return path.join(ROOT, "hearth-public.html");
  const flat = path.join(ROOT, url.slice(1) + ".html");
  if (existsSync(flat)) return flat;
  return path.join(ROOT, url.slice(1), "index.html");
}

function read(url) {
  const file = fileFor(url);
  assert.ok(existsSync(file), `${url} has no page (${path.relative(ROOT, file)})`);
  return readFileSync(file, "utf8");
}

// The motion switch: one control on both versions, the animated version's
// header switch. Off on the animated pages, on (knob across, ember track)
// on the low motion pages, where it leads back to the animated page.
function motionToggle(html) {
  const header = /<header\b[\s\S]*?<\/header>/.exec(html);
  assert.ok(header, "the page has no header");
  const m = /<a\b([^>]*\bclass="motion-toggle\b[^"]*"[^>]*)>([\s\S]*?)<\/a>/.exec(header[0]);
  assert.ok(m, "the header has no motion switch (an <a class=\"motion-toggle\">)");
  return {
    tag: m[0],
    href: (/\bhref="([^"]*)"/.exec(m[1]) || [])[1],
    on: /\bclass="motion-toggle[^"]*\bon\b/.test(m[1]),
    motion: (/\bdata-motion="([^"]*)"/.exec(m[1]) || [])[1],
    track: /class="motion-track"/.test(m[2]),
    label: (/<span class="motion-label">([^<]*)<\/span>/.exec(m[2]) || [])[1],
  };
}

const SITE = [
  { label: "Software", url: "/" },
  { label: "Coaching", url: "/coaching" },
  { label: "About", url: "/about" },
  { label: "Work", url: "/work" },
];

function siteNavs(html) {
  return [...html.matchAll(/<nav\b[^>]*\bdata-site-nav\b[^>]*>[\s\S]*?<\/nav>/g)].map((m) => m[0]);
}

function links(html) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: (/\bhref="([^"]*)"/.exec(m[1]) || [])[1],
    current: /\baria-current="page"/.test(m[1]),
    simple: /\bdata-simple-version\b/.test(m[1]),
    text: m[2].replace(/<[^>]+>/g, "").trim(),
  }));
}

for (const { words, worlds } of PAIRS) {
  test(`${words} carries the animated version's motion switch, shown on, leading to ${worlds}`, () => {
    const html = read(words);
    const t = motionToggle(html);
    assert.equal(t.href, worlds);
    assert.ok(t.on, "the switch is not shown on");
    assert.equal(t.motion, "full", "following the switch does not remember the animated choice");
    assert.ok(t.track, "the switch has no track and knob");
    assert.equal(t.label, motionToggle(read(worlds)).label, "the switch is labelled differently from the animated version's");
    assert.ok(!/view-switch-option/.test(html), "the old two-option switch is still on the page");
  });

  test(`${worlds} shows the motion switch off`, () => {
    assert.ok(!motionToggle(read(worlds)).on);
  });

  test(`${words} keeps its links between pages inside the low motion version`, () => {
    const html = read(words).replace(motionToggle(read(words)).tag, "");
    const animatedUrls = new Set(PAIRS.map((p) => p.worlds));
    const strays = links(html).map((a) => (a.href || "").replace(/[#?].*$/, "")).filter((h) => animatedUrls.has(h));
    assert.deepEqual(strays, [], `links out of the low motion version: ${strays.join(", ")}`);
  });

  test(`${worlds} sends a reader who chose low motion to ${words}`, () => {
    const head = /<head>[\s\S]*?<\/head>/.exec(read(worlds))[0];
    const m = /location\.replace\("([^"]+)"/.exec(head);
    assert.ok(m, "no low motion check in the head");
    assert.equal(m[1], words);
    assert.ok(head.indexOf("location.replace") < head.indexOf('rel="stylesheet"'), "the low motion check runs after the stylesheet is requested");
  });

  test(`${worlds} offers ${words} as its low motion version, at the top, in the hero and in the footer`, () => {
    const html = read(worlds);
    const simple = links(html).filter((a) => a.simple);
    assert.ok(simple.length >= 3, "expected a low motion link in the header, the hero and the footer");
    const header = /<header\b[\s\S]*?<\/header>/.exec(html);
    assert.ok(header && links(header[0]).some((a) => a.simple), "the header has no low motion switch");
    for (const a of simple) assert.equal(a.href, words);
    const footer = /<footer\b[\s\S]*<\/footer>/.exec(html);
    assert.ok(footer && links(footer[0]).some((a) => a.simple), "the footer has no simple-version link");
  });

  test(`${worlds} reaches Software, Coaching, About and Work from the top and the bottom`, () => {
    const html = read(worlds);
    const navs = siteNavs(html);
    assert.equal(navs.length, 2, "expected one site nav at the top and one in the footer");
    const footer = /<footer\b[\s\S]*<\/footer>/.exec(html);
    assert.ok(footer && siteNavs(footer[0]).length === 1, "the second site nav is not in the footer");
    for (const nav of navs) {
      const as = links(nav);
      for (const { label, url } of SITE) {
        const a = as.find((x) => x.text === label);
        assert.ok(a, `the nav has no ${label} link`);
        assert.equal(a.href, url, `${label} goes to the wrong page`);
        assert.equal(a.current, url === worlds, `${label} ${url === worlds ? "is not" : "is wrongly"} marked as the current page`);
      }
    }
  });

  test(`${worlds} links into the simple version only through its simple-version links`, () => {
    const wordsUrls = new Set(PAIRS.map((p) => p.words));
    const strays = links(read(worlds))
      .filter((a) => !a.simple && wordsUrls.has((a.href || "").replace(/[#?].*$/, "")))
      .map((a) => a.href);
    assert.deepEqual(strays, [], `links back into the simple version: ${strays.join(", ")}`);
  });
}

// The client logos on the Software and Coaching pages are a way into /work:
// each one opens that client's entry, in the same version of the site.
for (const [page, work] of [["/", "/work"], ["/coaching", "/work"], ["/simple", "/simple/work"], ["/simple/coaching", "/simple/work"]]) {
  test(`${page} shows client logos that each open their entry on ${work}`, () => {
    const row = /<(?:div|p|ul)\b[^>]*\bclass="[^"]*\bclients\b[^"]*"[\s\S]*?<\/(?:div|p|ul)>/.exec(read(page));
    assert.ok(row, "no client logo row (class=\"clients\")");
    const as = links(row[0]).filter((a) => /<img\b/.test(row[0]) && a.href && a.href.includes("#"));
    assert.ok(as.length >= 3, "expected at least three client logos linking to /work");
    const target = read(work);
    for (const a of as) {
      const [where, id] = a.href.split("#");
      assert.equal(where, work, `${a.href} leaves this version of the site`);
      assert.ok(new RegExp(`\\bid="${id}"`).test(target), `${work} has no entry #${id}`);
    }
  });
}

test("/coaching keeps the way into the Hearth", () => {
  assert.ok(links(read("/coaching")).some((a) => a.href === "/hearth"), "no link to /hearth");
});

// /hearth is two pages on one address: the public page about the Hearth
// for anyone without a session cookie (crawlers and link previews included),
// and the members' room for anyone with one. The room's own paths stay private.
test("/hearth serves the room only with the session cookie, and the public page otherwise", async () => {
  const { SESSION_COOKIE } = await import("../lib/hearth/auth.js");
  const { rewrites } = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const forHearth = rewrites.filter((r) => r.source === "/hearth");
  assert.equal(forHearth.length, 2, "expected two rewrites for /hearth");
  const [room, pub] = forHearth;
  assert.deepEqual(room.has, [{ type: "cookie", key: SESSION_COOKIE }], "the first /hearth rewrite must require the session cookie");
  assert.equal(room.destination, "/hearth-room");
  assert.ok(!pub.has && !pub.missing, "the fallback /hearth rewrite must be unconditional");
  assert.equal(pub.destination, "/hearth-public");
  assert.ok(rewrites.some((r) => r.source === "/hearth/:path*" && r.destination === "/hearth-room"), "the room's paths must reach the room");
  assert.ok(!existsSync(path.join(ROOT, "hearth.html")), "a hearth.html would be served at /hearth before the rewrites");
});

test("/hearth is indexable without a session and private with one", () => {
  const { headers } = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const robotsTag = (h) => h.headers.find((x) => x.key === "X-Robots-Tag");
  for (const h of headers.filter((x) => x.source === "/hearth")) {
    if (robotsTag(h)) assert.ok(h.has && h.has.some((c) => c.type === "cookie"), "an unconditional noindex on /hearth hides the public page");
  }
  assert.ok(headers.some((h) => h.source === "/hearth/(.*)" && robotsTag(h)), "the room's paths lost their noindex");
  const html = read("/hearth-public");
  assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(html), "the public page says noindex");
  for (const prop of ["og:title", "og:description", "og:image", "og:url"]) assert.ok(new RegExp(`<meta property="${prop}" content="[^"]+"`).test(html), `no ${prop}`);
  assert.ok(html.includes('<link rel="canonical" href="https://chamainteligente.com/hearth">'), "the canonical is not /hearth");
  assert.ok(!/\/assets\/hearth|\/api\//.test(html), "the public page loads the room or calls the API");
  const robots = readFileSync(path.join(ROOT, "robots.txt"), "utf8");
  assert.ok(!/^Disallow: \/hearth\s*$/m.test(robots), "robots.txt still disallows /hearth itself");
  assert.ok(/^Disallow: \/hearth\/$/m.test(robots), "robots.txt no longer disallows the room's paths");
});

test("the old /worlds addresses lead to the pages they became", () => {
  const { redirects } = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  for (const [from, to] of [["/worlds", "/"], ["/worlds/coaching", "/coaching"], ["/worlds/about", "/about"]]) {
    const r = redirects.find((x) => x.source === from && !x.has);
    assert.ok(r, `no redirect from ${from}`);
    assert.equal(r.destination, to);
  }
  assert.ok(!existsSync(path.join(ROOT, "worlds.html")) && !existsSync(path.join(ROOT, "worlds")), "a /worlds page would shadow its redirect");
});

const PUBLIC = ["/", "/coaching", "/about", "/work", "/privacy", "/brand", "/404", "/simple", "/simple/coaching", "/simple/about", "/simple/work", "/hearth-public"];

for (const url of PUBLIC) {
  test(`${url} requests nothing from another host`, () => {
    const html = read(url);
    const fetched = [];
    for (const m of html.matchAll(/<(script|img|source|iframe|video|audio)\b[^>]*\b(?:src|srcset)="([^"]+)"/g)) fetched.push(m[2]);
    for (const m of html.matchAll(/<link\b[^>]*>/g)) {
      const rel = /\brel="([^"]+)"/.exec(m[0]);
      const href = /\bhref="([^"]+)"/.exec(m[0]);
      if (rel && href && /\b(stylesheet|icon|apple-touch-icon|preload|modulepreload|prefetch|manifest)\b/.test(rel[1])) fetched.push(href[1]);
    }
    for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)/g)) fetched.push(m[1]);
    for (const m of html.matchAll(/@import\s+(?:url\()?['"]?([^'");]+)/g)) fetched.push(m[1]);
    const external = fetched.flatMap((v) => v.split(",").map((s) => s.trim().split(/\s+/)[0])).filter((u) => /^(https?:)?\/\//i.test(u));
    assert.deepEqual(external, [], `external requests: ${external.join(", ")}`);
  });
}

// Structured data that names parts of a page must name parts that exist:
// validator.schema.org reports a speakable selector that matches nothing as
// a severe error. Only #id and .class selectors are supported here.
function speakableSelectors(html) {
  const out = [];
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    if (v.speakable) [].concat(v.speakable.cssSelector || []).forEach((s) => out.push(s));
    Object.values(v).forEach(walk);
  };
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) walk(JSON.parse(m[1]));
  return out;
}

function matches(html, selector) {
  const id = /^#([\w-]+)$/.exec(selector);
  if (id) return new RegExp(`\\bid="${id[1]}"`).test(html);
  const cls = /^\.([\w-]+)$/.exec(selector);
  if (cls) return [...html.matchAll(/\bclass="([^"]*)"/g)].some((m) => m[1].split(/\s+/).includes(cls[1]));
  assert.fail(`unsupported speakable selector ${selector}`);
}

for (const url of PUBLIC) {
  test(`${url} names only elements that exist in its speakable structured data`, () => {
    const html = read(url);
    const missing = speakableSelectors(html).filter((s) => !matches(html, s));
    assert.deepEqual(missing, [], `speakable selectors with no match: ${missing.join(", ")}`);
  });
}

// The sitemap is what Search Console reads to decide what to crawl. Each entry
// must be the canonical address of an indexable page (an entry that points
// elsewhere is reported as "Alternate page" or "Page with redirect"), and an
// image it lists must be the card that page actually shares, so a renamed card
// does not leave the sitemap pointing at the retired one.
const SITEMAP = readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");
const ORIGIN = "https://chamainteligente.com";

for (const [, entry] of SITEMAP.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const loc = /<loc>([^<]+)<\/loc>/.exec(entry)[1];
  const url = loc.slice(ORIGIN.length) || "/";
  test(`the sitemap's ${url} is that page's canonical address, open to indexing`, () => {
    const html = read(url);
    assert.equal(/<link rel="canonical" href="([^"]+)"/.exec(html)?.[1], loc);
    assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(html), `${url} is noindex`);
  });
  for (const [, image] of entry.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)) {
    test(`the sitemap's image for ${url} is the card the page shares`, () => {
      assert.equal(image, /<meta property="og:image" content="([^"]+)"/.exec(read(url))?.[1]);
    });
  }
}

// Software and coaching carry equal weight. A link preview or an agent's
// summary built from any of these should name both.
for (const url of ["/", "/simple"]) {
  test(`${url} names both software and coaching in every description a link preview reads`, () => {
    const html = read(url);
    for (const tag of ['name="description"', 'property="og:description"', 'name="twitter:description"']) {
      const content = new RegExp(`<meta ${tag} content="([^"]+)"`).exec(html)?.[1] ?? "";
      assert.match(content, /software/i, `${tag} on ${url}`);
      assert.match(content, /coach/i, `${tag} on ${url}`);
    }
  });
}

test("llms.txt names both software and coaching in its summary line", () => {
  const summary = /^> (.+)$/m.exec(readFileSync(path.join(ROOT, "llms.txt"), "utf8"))?.[1] ?? "";
  assert.match(summary, /software/i);
  assert.match(summary, /coach/i);
});

// The media kit is how people linking to us find the logo. A renamed file
// would leave the page or llms.txt pointing at nothing.
test("every media kit file linked from /brand and llms.txt exists", () => {
  const text = read("/brand") + readFileSync(path.join(ROOT, "llms.txt"), "utf8");
  const links = [...new Set(text.match(/\/brand\/kit\/[\w.-]+/g))];
  assert.ok(links.length >= 7, "the kit's files are linked");
  for (const link of links) assert.ok(existsSync(path.join(ROOT, link)), `${link} is missing`);
});

for (const url of PUBLIC) {
  test(`${url} links the media kit from its footer`, () => {
    const footer = /<footer\b[\s\S]*<\/footer>/.exec(read(url));
    assert.ok(footer, "the page has no footer");
    const a = links(footer[0]).find((x) => x.href === "/brand");
    assert.ok(a, "the footer has no link to /brand");
    assert.equal(a.text, "Media kit");
    assert.equal(a.current, url === "/brand", `the link ${url === "/brand" ? "is not" : "is wrongly"} marked as the current page`);
  });
}
