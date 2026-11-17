// What /engineering-department promises, checked on the page that ships
// (engineering-department.html, built by npm run pages):
// - the change-time line is said once, as the numbers section's heading,
//   from SITE.changeTime;
// - the numbers figure draws the summary of every measured request from
//   SITE.changeCaption, not the four requests the loop's ledger shows;
// - the loop's business continues the contrast's "Yours": the same pentagon
//   at the same place in the same box, arriving already drawn;
// - every world sits in a .frame and is held to the fill floor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SITE } from "../site/site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = readFileSync(path.join(ROOT, "engineering-department.html"), "utf8");
const MAIN = /<main\b[\s\S]*<\/main>/.exec(HTML)[0];
const sections = [...MAIN.matchAll(/<section\b[^>]*class="world[^"]*"[\s\S]*?(?=<section\b[^>]*class="world|<\/main>)/g)].map((m) => m[0]);
const world = (id) => sections.find((s) => new RegExp(`^<section id="${id}"`).test(s));
const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/\s+/g, " ");

test("the change-time line is said once, as the numbers heading", () => {
  const line = SITE.changeTime.replace(/\.$/, "");
  assert.equal(text(MAIN).split(line).length - 1, 1, `"${line}" appears once on the page`);
  assert.match(world("numbers"), new RegExp(`<h2[^>]*>${SITE.changeTime.replace(/\./g, "\\.")}</h2>`));
  const description = /<meta name="description" content="([^"]*)"/.exec(HTML)[1];
  assert.ok(!description.includes(line), "the meta description does not repeat it");
});

test("the numbers figure draws every measured request, not the loop's four", () => {
  const [, requests, share] = /across (\d+) requests[\s\S]*?(\d+)% were live within the hour/.exec(SITE.changeCaption);
  const fig = world("numbers");
  assert.ok(!/class="bars/.test(fig), "the four bars are the loop's ledger; this section shows the summary");
  const dots = (cls) => [...fig.matchAll(new RegExp(`<path class="[^"]*\\b${cls}\\b[^"]*"[^>]*\\bd="([^"]*)"`, "g"))].reduce((sum, m) => sum + (m[1].match(/a/g) || []).length / 2, 0);
  const within = dots("sum-in"), later = dots("sum-later");
  assert.equal(within + later, +requests, "one dot per request");
  assert.equal(within, Math.round((+requests * +share) / 100), "the ones live within the hour are ember");
  assert.match(text(fig), new RegExp(`${share}% were live within the hour`));
  assert.match(text(fig), /Every one the same day/);
});

test("the loop's business continues the contrast's, at the same size and place, already drawn", () => {
  const box = (s) => /<svg class="fx-svg [^"]*" viewBox="([^"]+)"/.exec(s)[1];
  const ink = (s) => /<path class="fx-ink"[^>]*\bd="([^"]+)"/.exec(s);
  const at = (s, id) => new RegExp(`<g transform="([^"]+)">\\s*<ellipse class="fx-floor"[^>]*url\\(#${id}-floor\\)`).exec(s)[1];
  const contrast = world("contrast"), loop = world("loop");
  assert.equal(box(loop), box(contrast), "the same box, so the same cell gives the same place");
  assert.equal(ink(loop)[1], ink(contrast)[1], "the same pentagon");
  assert.equal(at(loop, "loop-b"), at(contrast, "cx"), "standing on the same spot");
  assert.ok(!/data-p/.test(ink(loop)[0]), "the loop's business arrives drawn: nothing on it reads --p");
  assert.match(ink(contrast)[0], /data-p/, "the contrast is where it is first drawn");
});

test("every world sits in a frame, and is held to the fill floor", () => {
  assert.ok(sections.length >= 7, `found the worlds (${sections.length})`);
  for (const s of sections) {
    const open = /^<section\b[^>]*>/.exec(s)[0];
    assert.match(s, /class="frame"/, `${open} has a .frame`);
    assert.match(open, /\bdata-fill\b/, `${open} is marked data-fill`);
  }
  assert.ok(!/ed-after|ed-hold/.test(HTML), "the loop's closing line and the old hold grid are gone");
});
