// original/ is the old site, frozen as it was on 2026-11-16 and served at
// /original. It must stay one closed place: everything it loads and every
// page it links to is under /original, except the live /privacy, /brand and
// /hearth, the banner's link home, and the chat's /api calls.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVE = path.join(ROOT, "original");
const PAGES = {
  "index.html": "/original",
  "coaching.html": "/original/coaching",
  "built.html": "/original/built",
  "clients.html": "/original/clients",
  "about.html": "/original/about",
  "agent.html": "/original/agent",
  "simple.html": "/original/simple",
  "simple/coaching.html": "/original/simple/coaching",
  "simple/built.html": "/original/simple/built",
  "simple/clients.html": "/original/simple/clients",
  "simple/about.html": "/original/simple/about",
};
const NOTE = 'This is the original chamainteligente.com, kept as it was. The current site is at <a href="/">chamainteligente.com</a>';
const read = (f) => readFileSync(path.join(ARCHIVE, f), "utf8");
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const texts = () => walk(ARCHIVE).filter((f) => /\.(html|js|css)$/.test(f)).map((f) => [path.relative(ARCHIVE, f), readFileSync(f, "utf8")]);

const ALLOWED = /^\/(original(?=$|[/?#])|privacy$|brand$|hearth$|api\/)/;

test("every page of the snapshot is there, unindexed, its own canonical, and says it is an archive", () => {
  for (const [file, address] of Object.entries(PAGES)) {
    const doc = read(file);
    assert.match(doc, /<meta name="robots" content="noindex">/, file);
    assert.equal([...doc.matchAll(/<link rel="canonical" href="([^"]*)">/g)].map((m) => m[1]).join(), `https://chamainteligente.com${address}`, file);
    assert.ok(doc.includes(NOTE), `${file} has no archive note`);
    assert.ok(!/application\/ld\+json|hreflang|rel="sitemap"/.test(doc), `${file} still describes itself as the live site`);
  }
});

test("the snapshot loads and links only to itself", () => {
  for (const [file, text] of texts()) {
    for (const m of text.matchAll(/["'`(]\/assets\//g)) assert.fail(`${file} asks for the new site's ${text.slice(m.index + 1, m.index + 40)}`);
    if (!file.endsWith(".html")) continue;
    const addresses = [
      ...[...text.matchAll(/\b(?:href|src|data-src|action|poster)="([^"]*)"/g)].map((m) => m[1]),
      ...[...text.matchAll(/\b(?:srcset|data-srcset)="([^"]*)"/g)].flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+/)[0])),
      ...[...text.matchAll(/location\.replace\("([^"]*)"/g)].map((m) => m[1]),
      ...[...text.matchAll(/"href_matches":\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1])),
    ]
      .map((u) => u.replace(/^https:\/\/chamainteligente\.com(?=\/)/, ""))
      .filter((u) => u.startsWith("/") && !u.startsWith("//") && u !== "/");
    const away = addresses.filter((u) => !ALLOWED.test(u));
    assert.deepEqual(away, [], `${file} leaves /original`);
    for (const u of addresses.filter((x) => /^\/original\/(assets\/|[\w-]+\.(png|svg)$)/.test(x))) {
      assert.ok(existsSync(path.join(ROOT, u.split(/[?#]/)[0])), `${file}: ${u} does not exist`);
    }
  }
});

test("the snapshot shows no email address but info@ and no phone number", () => {
  for (const [file, text] of texts()) {
    const emails = [...text.matchAll(/[\w.+-]+@[\w-]+\.[a-z]{2,}(?:\.[a-z]{2,})?\b/g)].map((m) => m[0]).filter((e) => !/\.(webp|png|svg)$/.test(e));
    assert.ok(emails.every((e) => e === "info@chamainteligente.com"), `${file}: ${emails}`);
    if (file.endsWith(".html")) assert.ok(!/(tel:|wa\.me|whatsapp\.com|\+351)/i.test(text), `${file} has a phone number`);
  }
});

test("the snapshot is not in the sitemap and no redirect catches it", () => {
  assert.ok(!readFileSync(path.join(ROOT, "sitemap.xml"), "utf8").includes("/original"));
  const { redirects } = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  for (const r of redirects.filter((x) => !x.has)) assert.ok(!r.source.startsWith("/original"), r.source);
});
