// The public pages come in two parallel versions: the simple version (/,
// /coaching, /about: the page as written) and the animated version (under
// /worlds: the same copy as a scroll through animated worlds). These tests
// guard the seams between them: each simple page's switch reaches its
// animated counterpart, each animated page offers its simple counterpart
// and otherwise never drops a reader back into the simple version, the
// animated pages' navigation reaches all three of them from the top and the
// bottom, and no public page asks another host for anything.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PAIRS = [
  { words: "/", worlds: "/worlds" },
  { words: "/coaching", worlds: "/worlds/coaching" },
  { words: "/about", worlds: "/worlds/about" },
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
  { label: "Software", url: "/worlds" },
  { label: "Coaching", url: "/worlds/coaching" },
  { label: "About", url: "/worlds/about" },
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

  test(`${worlds} offers ${words} as its simple version, in the hero and the footer`, () => {
    const html = read(worlds);
    const simple = links(html).filter((a) => a.simple);
    assert.ok(simple.length >= 2, "expected a simple-version link in the hero and in the footer");
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

test("/worlds/coaching keeps the way into the Hearth", () => {
  assert.ok(links(read("/worlds/coaching")).some((a) => a.href === "/hearth"), "no link to /hearth");
});

const PUBLIC = ["/", "/coaching", "/about", "/privacy", "/404", "/worlds", "/worlds/coaching", "/worlds/about"];

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
