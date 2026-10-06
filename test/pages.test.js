// The public pages come in two parallel versions: the animated version (/,
// /coaching, /about: the primary one, a scroll through animated worlds) and
// the low motion version (under /simple: the same copy as a plain page).
// These tests guard the seams between them: each low motion page's switch
// reaches its animated counterpart and its links stay in the low motion
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
];

// The same mapping Vercel's cleanUrls applies: /x serves x.html, and a
// folder serves its index.html.
function fileFor(url) {
  if (url === "/") return path.join(ROOT, "index.html");
  const flat = path.join(ROOT, url.slice(1) + ".html");
  if (existsSync(flat)) return flat;
  return path.join(ROOT, url.slice(1), "index.html");
}

function read(url) {
  const file = fileFor(url);
  assert.ok(existsSync(file), `${url} has no page (${path.relative(ROOT, file)})`);
  return readFileSync(file, "utf8");
}

function viewSwitch(html) {
  const m = /<nav\b[^>]*\bdata-view-switch\b[^>]*>([\s\S]*?)<\/nav>/.exec(html);
  return m ? m[0] : null;
}

function switchLink(html, label) {
  const nav = viewSwitch(html);
  assert.ok(nav, "the page has no view switch (a <nav data-view-switch>)");
  const re = new RegExp(`<a\\b[^>]*href="([^"]+)"[^>]*>(?:(?!</a>)[\\s\\S])*${label}`, "i");
  const m = re.exec(nav);
  assert.ok(m, `the switch has no ${label} link`);
  return m[1];
}

const SITE = [
  { label: "Software", url: "/" },
  { label: "Coaching", url: "/coaching" },
  { label: "About", url: "/about" },
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
  test(`${words} switches to ${worlds}`, () => {
    assert.equal(switchLink(read(words), "Animated"), worlds);
  });

  test(`${words} keeps its links between pages inside the low motion version`, () => {
    const html = read(words).replace(/<nav\b[^>]*\bdata-view-switch\b[\s\S]*?<\/nav>/, "");
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

  test(`${worlds} reaches Software, Coaching and About from the top and the bottom`, () => {
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

test("/coaching keeps the way into the Hearth", () => {
  assert.ok(links(read("/coaching")).some((a) => a.href === "/hearth"), "no link to /hearth");
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

const PUBLIC = ["/", "/coaching", "/about", "/privacy", "/404", "/simple", "/simple/coaching", "/simple/about"];

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
