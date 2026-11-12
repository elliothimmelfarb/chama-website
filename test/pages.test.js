// The public pages come in two parallel versions: the animated version (/,
// /coaching, /built, /clients, /about: the primary one, a scroll through animated worlds) and
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
  { words: "/simple/clients", worlds: "/clients" },
  { words: "/simple/built", worlds: "/built" },
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
  { label: "Clients", url: "/clients" },
  { label: "Built", url: "/built" },
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

  test(`${worlds} reaches Software, Coaching, Built, Clients and About from the top and the bottom`, () => {
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

  // worlds.js is deferred, so a page that waited for it to set html.js
  // painted its no-JavaScript layout first and then jumped (on /built, eight
  // things' words over each other while they faded out together).
  test(`${worlds} sets html.js before its first paint`, () => {
    const head = /<head>[\s\S]*?<\/head>/.exec(read(worlds))[0];
    const at = head.search(/documentElement\.classList\.add\("js"\)/);
    assert.ok(at >= 0, "no inline script in the head adds the js class");
    assert.ok(at < head.indexOf('rel="stylesheet"'), "the js class is added after the stylesheet is requested");
    const short = /var SHORT = window\.matchMedia\("([^"]+)"\)/.exec(readFileSync(path.join(ROOT, "assets/worlds.js"), "utf8"));
    assert.ok(short && head.includes(`matchMedia("${short[1]}").matches) document.documentElement.classList.add("js")`), "the head and worlds.js disagree on where the worlds are pinned");
  });

  test(`${words} reaches the five pages from the top, inside the low motion version`, () => {
    const header = /<header\b[\s\S]*?<\/header>/.exec(read(words));
    assert.ok(header, "the page has no header");
    const nav = siteNavs(header[0]);
    assert.equal(nav.length, 1, "the header has no site nav (a <nav data-site-nav>)");
    const as = links(nav[0]);
    const byUrl = Object.fromEntries(PAIRS.map((p) => [p.worlds, p.words]));
    for (const { label, url } of SITE) {
      const a = as.find((x) => x.text === label);
      assert.ok(a, `the nav has no ${label} link`);
      assert.equal(a.href, byUrl[url], `${label} goes to the wrong page`);
      assert.equal(a.current, byUrl[url] === words, `${label} ${byUrl[url] === words ? "is not" : "is wrongly"} marked as the current page`);
    }
    assert.ok(links(header[0]).some((a) => a.href === "/simple" && /wordmark/.test(header[0])), "the lockup is not a link home");
  });

  test(`${worlds} links into the simple version only through its simple-version links`, () => {
    const wordsUrls = new Set(PAIRS.map((p) => p.words));
    const strays = links(read(worlds))
      .filter((a) => !a.simple && wordsUrls.has((a.href || "").replace(/[#?].*$/, "")))
      .map((a) => a.href);
    assert.deepEqual(strays, [], `links back into the simple version: ${strays.join(", ")}`);
  });
}

// The client logos on the Software and Coaching pages are a way into /clients:
// each one opens that client's entry, in the same version of the site.
for (const [page, work] of [["/", "/clients"], ["/coaching", "/clients"], ["/simple", "/simple/clients"], ["/simple/coaching", "/simple/clients"]]) {
  test(`${page} shows client logos that each open their entry on ${work}`, () => {
    const row = /<(?:div|p|ul)\b[^>]*\bclass="[^"]*\bclients\b[^"]*"[\s\S]*?<\/(?:div|p|ul)>/.exec(read(page));
    assert.ok(row, "no client logo row (class=\"clients\")");
    const as = links(row[0]).filter((a) => /<img\b/.test(row[0]) && a.href && a.href.includes("#"));
    assert.ok(as.length >= 3, "expected at least three client logos linking to /clients");
    const target = read(work);
    for (const a of as) {
      const [where, id] = a.href.split("#");
      assert.equal(where, work, `${a.href} leaves this version of the site`);
      assert.ok(new RegExp(`\\bid="${id}"`).test(target), `${work} has no entry #${id}`);
    }
  });
}

// Our friends live on About, as the people we send someone to when they fit
// better than we do.
for (const [page, work] of [["/", "/about"], ["/coaching", "/about"], ["/simple", "/simple/about"], ["/simple/coaching", "/simple/about"]]) {
  test(`${page} shows our friends under the clients, each opening their entry on ${work}`, () => {
    const row = /<div\b[^>]*\bclass="[^"]*\bfriends\b[^"]*"[\s\S]*?<\/div>/.exec(read(page));
    assert.ok(row, "no friends row (class=\"clients friends\")");
    const target = read(work);
    for (const a of links(row[0]).filter((x) => x.href)) {
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

// /work became /clients on 2026-10-26, and links to a client on it
// (/work#springlar) are out in the world.
test("the old /work addresses lead to /clients", () => {
  const { redirects } = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  for (const [from, to] of [["/work", "/clients"], ["/work.html", "/clients"], ["/simple/work", "/simple/clients"], ["/simple/work.html", "/simple/clients"]]) {
    const r = redirects.find((x) => x.source === from && !x.has);
    assert.ok(r, `no redirect from ${from}`);
    assert.equal(r.destination, to);
  }
  assert.ok(!existsSync(path.join(ROOT, "work.html")) && !existsSync(path.join(ROOT, "simple", "work.html")), "a /work page would shadow its redirect");
});

// /built shows what we have made, each thing on a laptop and a phone whose
// screens scroll with the page (drawDevices in assets/worlds.js). Both
// versions list the same things under the same anchors, every picture is a
// file in this repository, and each thing either links out or says it is
// private.
function builtItems(html, tag) {
  return [...html.matchAll(new RegExp(`<article\\b[^>]*\\bclass="[^"]*\\b${tag}\\b[^"]*"[^>]*>[\\s\\S]*?</article>`, "g"))].map((m) => ({
    html: m[0],
    id: (/\bid="([^"]+)"/.exec(m[0]) || [])[1],
    name: (/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/.exec(m[0]) || [])[1],
    images: [...m[0].matchAll(/\b(?:src|data-src)="([^"]+)"/g)].map((x) => x[1]),
  }));
}

test("/built and /simple/built list the same things, in the same order, under the same anchors", () => {
  const worlds = builtItems(read("/built"), "made");
  const words = builtItems(read("/simple/built"), "entry");
  assert.ok(worlds.length >= 3, "expected at least three things on /built");
  assert.deepEqual(words.map((x) => [x.id, x.name]), worlds.map((x) => [x.id, x.name]));
  for (const x of worlds) assert.ok(x.id && x.name, "a thing on /built has no id or no name");
});

for (const [url, tag] of [["/built", "made"], ["/simple/built", "entry"]]) {
  test(`${url} shows each thing with pictures kept in this repository, and a way out or a reason there is none`, () => {
    for (const x of builtItems(read(url), tag)) {
      assert.ok(x.images.length >= 1, `${x.id} has no picture`);
      for (const src of x.images) {
        assert.ok(src.startsWith("/assets/built/"), `${x.id} loads ${src} from outside /assets/built/`);
        assert.ok(existsSync(path.join(ROOT, src)), `${src} is not in the repository`);
      }
      const out = links(x.html).some((a) => /^https:\/\//.test(a.href || ""));
      assert.ok(out || /class="[^"]*\bprivate\b/.test(x.html), `${x.id} neither links to the thing nor says it is private`);
    }
  });
}

// The progress bar is also the way to each thing by keyboard, since the
// things not on the screens are out of the tab order.
test("/built's progress bar links to every thing, in order", () => {
  const html = read("/built");
  const bar = /<nav\b[^>]*\bclass="made-ticks"[\s\S]*?<\/nav>/.exec(html);
  assert.ok(bar, "no progress bar (nav.made-ticks)");
  const as = [...bar[0].matchAll(/<a\b[^>]*\bhref="#([^"]+)"[^>]*\baria-label="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(as, builtItems(html, "made").map((x) => [x.id, x.name]));
});

test("the scroll through /built is as long as the things on it need", () => {
  const html = read("/built");
  const n = builtItems(html, "made").length;
  const h = +(/<section\b[^>]*\bdata-scene="devices"[^>]*--h:\s*(\d+)/.exec(html) || [])[1];
  assert.equal(h, 190 + 135 * n, "raise the devices world's --h by 135 for each thing added");
});

test("the router and llms-full.txt know /built", () => {
  assert.match(readFileSync(path.join(ROOT, "assets/worlds.js"), "utf8"), /var PAGES = \{[^}]*"\/built": 1/);
  assert.ok(readFileSync(path.join(ROOT, "llms-full.txt"), "utf8").includes("(https://chamainteligente.com/built)"));
  assert.ok(readFileSync(path.join(ROOT, "llms.txt"), "utf8").includes("](https://chamainteligente.com/built)"));
});

// The animated pages leave for the plain ones (the low motion version, the
// Hearth, privacy, the flame's own page) as full loads, so they ask the
// browser to fetch those on hover or press. The router fetches its own
// pages itself, so the rules leave those alone; files are never fetched
// ahead; and a pattern is a path, so it can only ever reach this host.
function speculationMatches(html, href) {
  const rules = [...html.matchAll(/<script type="speculationrules">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1]).prefetch || []);
  const where = (w) => {
    if (w.and) return w.and.every(where);
    if (w.or) return w.or.some(where);
    if (w.not) return !where(w.not);
    return [].concat(w.href_matches).some((p) => {
      assert.match(p, /^\/(?!\/)/, `speculation rule pattern ${p} is not a path on this host`);
      return new URLPattern(p, "https://chamainteligente.com").test(new URL(href, "https://chamainteligente.com"));
    });
  };
  return rules.some((r) => r.source === "document" && where(r.where));
}

for (const { worlds } of PAIRS) {
  test(`${worlds} has the browser fetch the plain pages it leaves for, and nothing the router fetches`, () => {
    const html = read(worlds);
    for (const href of ["/simple", "/simple/coaching", "/hearth", "/privacy", "/agent", "/agent?say=hello"]) assert.ok(speculationMatches(html, href), `${href} is not fetched ahead`);
    for (const { url } of SITE) assert.ok(!speculationMatches(html, url) && !speculationMatches(html, url + "#x"), `${url} is fetched by both the browser and the router`);
    for (const href of ["/brand/chama-media-kit.zip", "/sitemap.xml", "/assets/worlds.css"]) assert.ok(!speculationMatches(html, href), `${href} is a file, fetched ahead for nothing`);
  });
}

const PUBLIC = ["/","/coaching", "/about", "/clients", "/privacy", "/brand", "/404", "/simple", "/simple/coaching", "/simple/about", "/simple/clients", "/built", "/simple/built", "/hearth-public"];

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

// The chat transcript on / marks each message .turn, and index.html loads
// worlds.css. A bare .turn rule there hid every chat message (2026-10-22 to
// 2026-11-01), so the clients wheel's turns are styled only inside .turns.
// Two @keyframes with one name: the later silently replaces the earlier
// everywhere, which lost the hero's blur-in (2026-11-11).
for (const sheet of ["assets/worlds.css", "assets/site.css"]) {
  test(`${sheet} names each @keyframes once`, () => {
    const names = [...readFileSync(path.join(ROOT, sheet), "utf8").matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
    const twice = names.filter((n, i) => names.indexOf(n) !== i);
    assert.deepEqual(twice, [], `defined more than once: ${twice.join(", ")}`);
  });
}

test("worlds.css never hides a bare .turn, which would hide the chat's messages", () => {
  const css = readFileSync(path.join(ROOT, "assets/worlds.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/opacity:\s*0|visibility:\s*hidden/.test(rule[2])) continue;
    for (const selector of rule[1].split(",")) {
      assert.ok(!/(^|\s)\.turn(?![\w-])/.test(selector.trim()) || /\.turns\s/.test(selector), `bare .turn in "${selector.trim()}"`);
    }
  }
});

// Chrome scores Largest Contentful Paint when an element first paints with
// any opacity. The hero's words and its logo row fade in from almost nothing;
// starting them at exactly 0 made the last logo to catch the LCP, 2.4 s after
// the words were readable (2026-11-11).
test("the hero's words and logos count as painted from their first frame", () => {
  const css = readFileSync(path.join(ROOT, "assets/worlds.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const name of ["arrive", "catch"]) {
    const frames = [...css.matchAll(new RegExp(`@keyframes ${name}\\s*\\{\\s*(?:from|0%)\\s*\\{([^}]*)\\}`, "g"))];
    assert.ok(frames.length, `no @keyframes ${name}`);
    for (const f of frames) assert.ok(!/opacity:\s*0\s*[;}]|opacity:\s*0$/.test(f[1].trim()), `@keyframes ${name} starts at opacity 0`);
  }
});

// Pictures come in several widths and the browser picks one from srcset by
// the w descriptor, never by looking at the file. A descriptor wider than its
// file makes the page soft wherever that copy is picked, and nothing else
// would show it.
function pixelWidth(file) {
  const b = readFileSync(file);
  if (b.toString("ascii", 0, 4) === "RIFF") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return 1 + b.readUIntLE(24, 3);
    if (chunk === "VP8L") return 1 + (b.readUInt16LE(21) & 0x3fff);
    return b.readUInt16LE(26) & 0x3fff;
  }
  for (let i = 2; i < b.length; ) {
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return b.readUInt16BE(i + 7);
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`${file}: not a WebP or JPEG`);
}

function imgs(html) {
  return [...html.matchAll(/<img\b[^>]*>/g)].map((m) => {
    const attr = (k) => (new RegExp(`\\s${k}="([^"]*)"`).exec(m[0]) || [])[1];
    const set = attr("srcset") || attr("data-srcset");
    return {
      tag: m[0], src: attr("src") || attr("data-src"), sizes: attr("sizes"), lazy: !!attr("data-src"), high: attr("fetchpriority") === "high",
      set: set ? set.split(",").map((c) => { const [url, w] = c.trim().split(/\s+/); return { url, w: parseInt(w) }; }) : null,
    };
  });
}
const outsideNoscript = (html) => html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");

for (const url of PUBLIC) {
  test(`${url}: every srcset width is the width of its file`, () => {
    for (const img of imgs(read(url)).filter((x) => x.set)) {
      assert.ok(img.sizes, `${img.src} has a srcset but no sizes, so it is picked as if it filled the window`);
      for (const c of img.set) {
        if (!c.url.startsWith("/")) continue;
        const file = path.join(ROOT, c.url);
        assert.ok(existsSync(file), `${c.url} is not in the repository`);
        assert.equal(pixelWidth(file), c.w, `${c.url} is not ${c.w} pixels wide`);
      }
    }
  });
}

// On a phone /built's first screen is two pictures. The first thing's pair
// loads at once and first; every other thing's waits for worlds.js
// (devicesLoad), which fetches the next only once the pair on the screens has
// arrived. Each picture offers a copy small enough for a phone's screen.
test("/built loads the first thing's pictures first and offers each picture at phone size", () => {
  const shots = imgs(outsideNoscript(read("/built"))).filter((x) => x.src.startsWith("/assets/built/"));
  assert.ok(shots.length >= 6);
  shots.forEach((x, i) => {
    assert.equal(x.lazy, i >= 2, `${x.src} ${i < 2 ? "must load at once" : "must wait for its turn (data-src)"}`);
    assert.equal(x.high, i < 2, `${x.src} ${i < 2 ? "needs" : "must not have"} fetchpriority="high"`);
    assert.ok(x.set, `${x.src} has no srcset`);
    const small = Math.min(...x.set.map((c) => c.w));
    assert.ok(small <= (/-phone/.test(x.src) ? 160 : 640), `${x.src}: the smallest copy is ${small} wide`);
    assert.equal(Math.max(...x.set.map((c) => c.w)), +/width="(\d+)"/.exec(x.tag)[1], `${x.src}: the full-size picture is missing from srcset`);
  });
});

// The low motion /built shows the top of each picture in a small frame:
// cropped copies, never the full-length screenshots. The first thing's
// frames are on the first screen of a phone and are its LCP, so they load
// at once; the rest wait until they are near.
test("/simple/built shows cropped thumbnails, not the full screenshots", () => {
  imgs(read("/simple/built")).filter((x) => x.src.startsWith("/assets/built/")).forEach((x, i) => {
    assert.equal(/loading="lazy"/.test(x.tag), i >= 2, `${x.src} ${i < 2 ? "must load at once" : "must be lazy"}`);
    assert.equal(x.high, i < 2, `${x.src} ${i < 2 ? "needs" : "must not have"} fetchpriority="high"`);
    assert.match(x.src, /-thumb-\d+\.webp$/);
    for (const c of x.set) assert.ok(c.w <= 1080, `${c.url} is larger than a thumbnail needs`);
  });
});

// The logo rows in the heroes show each mark at most 154 CSS px wide.
test("the hero logo rows load copies sized for them, not the masters", () => {
  for (const url of ["/", "/coaching", "/simple", "/simple/coaching"]) {
    const rows = [...read(url).matchAll(/<div class="clients[^"]*">[\s\S]*?<\/div>/g)].map((m) => m[0]).join("");
    const logos = imgs(rows);
    assert.ok(logos.length >= 4, `${url} has no logo row`);
    for (const x of logos) assert.ok(pixelWidth(path.join(ROOT, x.src)) <= 3.5 * parseInt(x.sizes), `${url}: ${x.src} is far wider than a 3x screen needs at ${x.sizes}`);
  }
});

// worlds.css registers --u as not inherited, so a scroll frame restyles only
// the elements that read it, and worlds.js writes it on each of them
// (U_READERS). A rule that reads --u anywhere else would sit at the initial
// value for ever, and a browser without @property, where --u still inherits
// from .world, must start every reader at that same value.
test("every rule that reads --u is on an element worlds.js writes it on", () => {
  const css = readFileSync(path.join(ROOT, "assets/worlds.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const js = readFileSync(path.join(ROOT, "assets/worlds.js"), "utf8");
  const readers = (/var U_READERS = "([^"]+)"/.exec(js)?.[1] ?? "").split(",").map((s) => s.trim().split(/\s+/));
  assert.ok(readers.length >= 4, "worlds.js lists the elements it writes --u on");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selectors: m[1].split(",").map((s) => s.trim()), body: m[2] }));
  const reg = rules.find((r) => r.selectors[0] === "@property --u");
  assert.ok(reg, "--u is registered");
  assert.match(reg.body, /inherits:\s*false/);
  const initial = /initial-value:\s*([-\d.]+)/.exec(reg.body)?.[1];
  const world = rules.find((r) => r.selectors.includes(".world") && /--u:/.test(r.body));
  assert.equal(/--u:\s*([-\d.]+)/.exec(world?.body ?? "")?.[1], initial, ".world starts --u where the registration does");
  const inherits = new Set(rules.filter((r) => /--u:\s*inherit\b/.test(r.body)).flatMap((r) => r.selectors));
  const has = (compound, part) => new RegExp(part.startsWith(".") ? `\\${part}(?![\\w-])` : `^${part}(?![\\w-])`).test(compound);
  const split = (selector) => {
    const pseudo = /::?(?:before|after)$/.exec(selector)?.[0] ?? "";
    const parts = selector.slice(0, selector.length - pseudo.length).split(/\s+/);
    return { pseudo, parts, last: parts[parts.length - 1] };
  };
  const onReader = ({ parts, last }) => readers.some((r) => has(last, r[r.length - 1]) && r.slice(0, -1).every((a) => parts.slice(0, -1).some((p) => has(p, a))));
  let checked = 0;
  for (const rule of rules) {
    if (!/var\(--u\)/.test(rule.body)) continue;
    for (const selector of rule.selectors) {
      checked++;
      const sel = split(selector);
      assert.ok(onReader(sel), `"${selector}" reads --u, but worlds.js does not write it there (U_READERS)`);
      if (sel.pseudo) assert.ok(inherits.has(sel.last + sel.pseudo), `"${selector}" reads --u but never takes it from its element (--u: inherit)`);
    }
  }
  assert.ok(checked >= 6, "the rules that read --u were found");

  // A variable worked out from --u and registered not to inherit (--e, the
  // exit) is the same: every element that reads it must work it out itself,
  // from its own --u, or it sits at its initial value and nothing fades.
  const derived = rules
    .filter((r) => /^@property --[\w-]+$/.test(r.selectors[0]) && /inherits:\s*false/.test(r.body))
    .map((r) => r.selectors[0].slice("@property ".length))
    .filter((n) => n !== "--u" && rules.some((r) => new RegExp(`${n}:[^;]*var\\(--u\\)`).test(r.body)));
  assert.ok(derived.includes("--e"), "--e is worked out from --u and does not inherit");
  for (const name of derived) {
    const declared = rules.filter((r) => new RegExp(`(^|[;\\s])${name}:`).test(r.body)).flatMap((r) => r.selectors.map(split));
    for (const rule of rules) {
      if (!rule.body.includes(`var(${name})`)) continue;
      for (const selector of rule.selectors) {
        const sel = split(selector);
        assert.ok(onReader(sel), `"${selector}" reads ${name}, which needs --u there, but worlds.js does not write it (U_READERS)`);
        const works = declared.some((d) => d.pseudo === sel.pseudo && d.last.match(/\.[\w-]+/g)?.every((c) => has(sel.last, c)));
        assert.ok(works, `"${selector}" reads ${name} but never works it out (${name} does not inherit)`);
      }
    }
  }
});
