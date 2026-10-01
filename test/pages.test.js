// The public pages come in two parallel versions, Words (the page as
// written) and Worlds (the same copy as a scroll through animated worlds).
// These tests guard the seams between them: each page's switch reaches its
// counterpart, a Worlds page never drops a reader back into Words by any
// other link, and no public page asks another host for anything.

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

for (const { words, worlds } of PAIRS) {
  test(`${words} switches to ${worlds}`, () => {
    assert.equal(switchLink(read(words), "Worlds"), worlds);
  });

  test(`${worlds} switches back to ${words}`, () => {
    assert.equal(switchLink(read(worlds), "Words"), words);
  });

  test(`${worlds} links only to Worlds pages outside its switch`, () => {
    const html = read(worlds).replace(viewSwitch(read(worlds)) || "", "");
    const wordsUrls = new Set(PAIRS.map((p) => p.words));
    const strays = [...html.matchAll(/<a\b[^>]*\bhref="([^"#?]*)/g)]
      .map((m) => m[1])
      .filter((href) => wordsUrls.has(href));
    assert.deepEqual(strays, [], `links back into Words: ${strays.join(", ")}`);
  });
}

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
