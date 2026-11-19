// The home page as built (index.html) says what docs/DESIGN.md section 7
// ("/ Home") says it does, in that order: who we are and the stage, the
// doors, what we believe and what we help you do, what we can do with day
// one, who we have worked with, done for you and taught, real people you
// can reach, and the close. It says each thing once, and the change time
// lives on /engineering-department, not here.

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
  h2: words(/<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(m[3])?.[1] || ""),
}));

// Elliot's own sentence, 2026-11-16: the home page's values statement.
const VALUES = "We believe that through using and teaching AI we can enable people to spend more time doing human things and accomplish more of their goals.";

test("home is seven sections in the order and on the grounds DESIGN.md gives", () => {
  assert.deepEqual(worlds.map((w) => w.ground), ["paper", "tides", "grid", "grid", "ember", "ember", "ember"]);
  assert.deepEqual(worlds.map((w) => w.pinned), [false, true, true, false, true, true, false]);
  assert.deepEqual(worlds.slice(1).map((w) => w.label), ["What we believe", "What we can do", "Who we have worked with", "How we work", "Real people you can reach", "Talk to us"]);
  assert.match(worlds[0].body, /data-stage/, "the stage is on the first screen");
  assert.match(worlds[0].body, /data-doors/, "the doors are on the first screen");
});

test("the belief section's heading is Elliot's values sentence, word for word, with the goals under it", () => {
  assert.equal(worlds[1].h2, VALUES);
  assert.ok(words(worlds[1].body).includes(t.belief.line));
  assert.equal(t.belief.line, "We help you make money, save money and stay compliant, while you enjoy your business more and do things with it you couldn't before.");
});

test("what we can do and day one share one pinned world whose words take turns", () => {
  const w = worlds[2], h2s = [...w.body.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => words(m[1]));
  assert.deepEqual(h2s, ["What you have to do, made easier. What you wish you could do, made possible.", "Every new AI capability is ours on day one."]);
  assert.ok(words(w.body).includes("We take on things no one has ever done before."));
  assert.match(w.body, /class="[^"]*\bslot\b/, "the two beats stand in one .slot");
  // the second beat comes in inside the hold, after the first has gone
  const ins = [...w.body.matchAll(/--in:\s*([\d.]+)/g)].map((m) => +m[1]), outs = [...w.body.matchAll(/--out:\s*([\d.]+)/g)].map((m) => +m[1]);
  assert.ok(ins.length && outs.length && Math.min(...ins) >= Math.max(...outs), "the day one words arrive once the first beat's have left");
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

test("who we have worked with: a visible heading, the plant line to the engineering page, the logos and the work page", () => {
  const w = worlds[3];
  assert.equal(w.h2, "Who we have worked with");
  assert.ok(!/class="[^"]*sr-only[^"]*"[^>]*>Who we have/.test(w.body), "the heading is visible");
  const plant = SITE.laMetalNamed ? t.clients.lineNamed : t.clients.line;
  const link = /<a [^>]*href="\/engineering-department"[^>]*>([\s\S]*?)<\/a>/.exec(w.body);
  assert.ok(link, "the plant line links to the engineering page");
  assert.equal(words(link[1]), plant);
  assert.match(w.body, /<ul class="logos">/);
  assert.match(w.body, /<a [^>]*href="\/work"[^>]*>Everything we(&#39;|')ve built/);
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
  // the stage's third beat no longer repeats the sub-line or the people heading
  assert.equal(t.stageBeats[2].say, "We're a small, family-owned, AI-native business.");
});

test("home's machine-readable text follows the page, with the stage's sentences and Elliot's sentence", () => {
  const lines = text().split("\n\n");
  const at = (s) => { const i = lines.findIndex((l) => l.includes(s)); assert.ok(i >= 0, `text() is missing "${s}"`); return i; };
  const order = [t.descriptor, t.h1[0], t.sub, "How Chama works, in eight short scenes", "More time for human things", t.doors[0].title, t.also,
    `## ${VALUES}`, t.belief.line, `## ${t.cando.h2}`, t.cando.line, `## ${t.dayOne.h2}`, t.dayOne.line, `## ${t.clients.h2}`,
    SITE.laMetalNamed ? t.clients.lineNamed : t.clients.line, `## ${t.approach.h2}`, t.approach.line, `## ${t.people.h2}`].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "in the page's order");
  assert.equal(t.description, "A small, family-owned, AI-native business in Lisbon, working worldwide. We're ready to solve any problem that can be solved with software, and teach you to use AI yourself: your own engineering department, websites, apps and products, and AI fluency coaching.");
});
