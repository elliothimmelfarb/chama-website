// The home page as built (index.html) says, in this order: the first view
// (who we are, the stage, the doors), then four questions a visitor has,
// each answered in one sentence on paper, and the close. It says each thing once, and the
// change time lives on /engineering-department, not here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { SITE } from "../site/site.js";
import { home as t } from "../site/content/en/home.js";
import { text } from "../site/pages/home.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const doc = readFileSync(path.join(ROOT, "index.html"), "utf8");
const main = doc.slice(doc.indexOf("<main"), doc.indexOf("</main>"));
const words = (s) =>
  s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript>[\s\S]*?<\/noscript>/g, " ")
    .replace(/<\/?(?:span|a|b|em|strong)\b[^>]*>/g, "").replace(/<[^>]+>/g, " ").replace(/&#39;|&rsquo;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const worlds = [...main.matchAll(/<section class="world([^"]*)"([^>]*)>([\s\S]*?)(?=<section class="world|$)/g)].map((m) => ({
  cls: m[1], attrs: m[2], body: m[3],
  ground: /data-world="(\w+)"/.exec(m[2])[1],
  pinned: !/data-pin="off"/.test(m[2]),
  label: /data-label="([^"]+)"/.exec(m[2])?.[1],
  h2: words((/<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(m[3])?.[1] || "").replace(/<svg[\s\S]*?<\/svg>/g, "")),
}));

// Elliot's picks, 2026-11-19 ("Chama Homepage Picks"): after the first view,
// the questions people ask, all on paper, nothing pinned, no diagrams.
test("after the first view, home is four questions and the close, all on paper and none pinned", () => {
  assert.deepEqual(worlds.map((w) => w.ground), ["paper", "paper", "paper", "paper", "paper", "paper"]);
  assert.deepEqual(worlds.map((w) => w.pinned), [false, false, false, false, false, false]);
  assert.deepEqual(worlds.slice(1).map((w) => w.label), ["Why it matters", "Who we have worked with", "How we work", "Real people you can reach", "Talk to us"]);
  assert.match(worlds[0].body, /data-stage/, "the stage is on the first screen");
  assert.match(worlds[0].body, /data-doors/, "the doors are on the first screen");
  const asks = worlds.slice(1, 5).map((w) => words(/<p class="ask"[^>]*>([\s\S]*?)<\/p>/.exec(w.body)?.[1] || ""));
  assert.deepEqual(asks, [t.belief.ask, t.clients.ask, t.approach.ask, t.people.ask]);
  for (const a of asks) assert.match(a, /\?$/, `"${a}" is a question`);
});

test("no diagram below the first view: the stage is the page's only figure", () => {
  for (const w of worlds.slice(1)) {
    assert.doesNotMatch(w.body.replace(/<span class="pen pen-\w+">[^<]*<svg[\s\S]*?<\/svg>/g, ""), /<svg\b(?![^>]*class="arr)/, `${w.label} draws a figure`);
    assert.doesNotMatch(w.body, /data-fill|style="--h:/, `${w.label} is still sized as a pinned world`);
  }
});

test("why it matters: the short belief sentence over the five goals, the two hopes marked", () => {
  const w = worlds[1];
  assert.equal(w.h2, t.belief.h2);
  const goals = [...w.body.matchAll(/<li class="goal( hope)?">([\s\S]*?)<\/li>/g)].map((m) => [words(m[2].replace(/<span class="sr-only">[^<]*<\/span>/, "")), !!m[1]]);
  assert.match(w.body, /<span class="sr-only">and two we hope for: <\/span>/, "the hopes are named for screen readers, not by colour alone");
  assert.deepEqual(goals, t.belief.reasons.map((r, i) => [r, i >= t.belief.hopesFrom]));
});

test("who we have worked with: the plant line to the engineering page, the logos and the work page", () => {
  const w = worlds[2];
  const plant = SITE.laMetalNamed ? t.clients.lineNamed : t.clients.line;
  assert.equal(w.h2, plant, "the answer is the heading");
  const link = /<a [^>]*href="\/engineering-department"[^>]*>([\s\S]*?)<\/a>/.exec(w.body);
  assert.ok(link, "the plant line links to the engineering page");
  assert.equal(words(link[1]), plant);
  assert.match(w.body, /<ul class="logos"/);
  assert.match(w.body, /<a [^>]*href="\/work"[^>]*>Everything we(&#39;|')ve built/);
});

test("real people you can reach: a round portrait, not the half-screen photo", () => {
  const w = worlds[4];
  assert.equal(w.h2, t.people.h2);
  assert.match(w.body, /<img class="portrait"[^>]*alt="Elliot and Annie, smiling/);
  const sizes = /<img class="portrait"[^>]*sizes="([^"]+)"/.exec(w.body)[1].replace(/\([^)]*\)/g, "");
  for (const px of sizes.match(/\d+(?=px)/g)) assert.ok(+px <= 200, `the portrait asks for ${px}px, not a small picture`);
  assert.match(w.body, /<a [^>]*href="\/about"/);
});

test("the line under the headline is Elliot's pick, and the descriptor does not repeat it", () => {
  assert.equal(t.sub, "A small family business in Lisbon. You work with us directly.");
  assert.doesNotMatch(t.descriptor, /family|Lisbon/);
});

// Elliot, 2026-11-17: "ready to solve any problem" is the main line, and the
// ember pen marks it up (concept C on the phone first screen board).
test("the H1 is the ready-to-solve line, with the pen's two marks on it", () => {
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(main)[1];
  assert.equal(words(h1.replace(/<svg[\s\S]*?<\/svg>/g, "")), "We're ready to solve any problem that can be solved with software.");
  const marks = [...h1.matchAll(/<span class="pen pen-(\w+)">([^<]*)<svg [^>]*aria-hidden="true"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(marks, [["under", "any problem"], ["ring", "software"]]);
  assert.match(text(), /^# We're ready to solve any problem that can be solved with software\.$/m);
});

// The header's logo is <svg class="mark">: a home rule on .mark once
// turned it into a dashed outline (2026-11-17 review).
test("home's own styles never reach the header logo", () => {
  const logo = /<svg class="([^"]+)"[^>]*viewBox="0 0 64 64"/.exec(doc)[1].split(/\s+/);
  const css = [...main.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const c of logo) assert.doesNotMatch(css, new RegExp(`\\.${c}(?![\\w-])`), `home styles select .${c}, the logo's class`);
});

test("the change time and the proof bars have left home", () => {
  assert.ok(!words(main).includes(SITE.changeTime), SITE.changeTime);
  assert.ok(!/class="bars\b/.test(main), "the proof bars");
  assert.ok(!text().includes(SITE.changeTime));
});

test("no line is said twice on home", () => {
  const sentences = words(main).split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.split(" ").length >= 4);
  const seen = new Map();
  for (const s of sentences) seen.set(s, (seen.get(s) || 0) + 1);
  assert.deepEqual([...seen].filter(([, n]) => n > 1), []);
});

test("home's machine-readable text follows the page", () => {
  const lines = text().split("\n\n");
  const at = (s) => { const i = lines.findIndex((l) => l.includes(s)); assert.ok(i >= 0, `text() is missing "${s}"`); return i; };
  const order = [t.descriptor, t.h1[0], t.sub, t.stageLabel, t.doors[0].title, t.also,
    t.belief.ask, `## ${t.belief.h2}`, t.belief.reasons[4], t.clients.ask, SITE.laMetalNamed ? t.clients.lineNamed : t.clients.line,
    t.approach.ask, `## ${t.approach.h2}`, t.approach.line, t.people.ask, `## ${t.people.h2}`].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "in the page's order");
});

// The 2026-11-19 review: the first view's pen carried down, one phrase
// marked in each answer, so the questions belong to the same page.
test("the pen marks one phrase in each answer", () => {
  const want = [t.belief.h2Mark, t.clients.h2Mark, t.approach.h2Mark, t.people.h2Mark].map((m) => Object.entries(m)[0]);
  const plantHasIt = (SITE.laMetalNamed ? t.clients.lineNamed : t.clients.line).includes(want[1][1]);
  worlds.slice(1, 5).forEach((w, i) => {
    const marks = [...w.body.matchAll(/<span class="pen pen-(\w+)">([^<]*)<svg [^>]*aria-hidden="true"/g)].map((m) => [m[1], m[2]]);
    assert.deepEqual(marks, i === 1 && !plantHasIt ? [] : [want[i]], w.label);
  });
});
