// What /engineering-department promises, checked on the page that ships
// (engineering-department.html, built by npm run pages):
// - the change-time line is said once, as the numbers section's heading,
//   from SITE.changeTime;
// - the numbers figure draws the summary of every measured request from
//   SITE.changeCaption, not the four requests the loop's ledger shows;
// - nothing the page says is said again further down (Elliot asked for the
//   repeats to go), and the loop is shown once;
// - the first picture is the survey sheet, played from time, and it ends on
//   a complete still: the business with its own software round it;
// - one business runs through the page: the first picture ends on the shape
//   the contrast draws as "Yours", and the loop starts from it, at the same
//   place in the same box, arriving already drawn;
// - each lap of the loop is ask, make room, grow, and the laps finish by
//   0.84 of the hold;
// - every world sits in a .frame and is held to the fill floor.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SITE } from "../site/site.js";
import { ed as t } from "../site/content/en/engineering-department.js";

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
  const within = dots("sum-in"), all = dots("sum-slot");
  assert.equal(all, +requests, "one grey dot per request, on the sheet from the start");
  assert.equal(within, Math.round((+requests * +share) / 100), "the ones live within the hour are ember");
  assert.match(text(fig), new RegExp(`\\b${share}%`), "the share is in the frame");
  assert.ok(!/within the hour/.test(text(fig)), "no label repeats the heading's hour");
  assert.match(text(fig), /Every one the same day/);
});

test("nothing the page says is said again further down", () => {
  const page = text(MAIN);
  for (const phrase of ["within days", "any engineer", "the code and the data"]) {
    assert.equal(page.split(phrase).length - 1, 1, `"${phrase}" is said once`);
  }
  // the loop is shown once, in its own world, not again in the first screen
  assert.equal((MAIN.match(/class="fx-svg loop-svg"/g) || []).length, 1, "one loop on the page");
});

// ---- the business, from the first picture to the loop -------------------------
// One declaration of an inline style at a --p: the CSS functions the figures use, in JS.
function value(style, prop, p) {
  const m = new RegExp(`(?:^|;)${prop}:([^;]*)`).exec(style);
  if (!m) return null;
  const js = m[1].replace(/var\(--p\)/g, `(${p})`).replace(/calc\(/g, "(").replace(/clamp\(/g, "CLAMP(").replace(/pow\(/g, "Math.pow(").replace(/min\(/g, "Math.min(").replace(/max\(/g, "Math.max(");
  return Function("CLAMP", `return (${js});`)((a, v, b) => Math.min(Math.max(v, a), b));
}
const tagOf = (s, cls) => new RegExp(`<\\w+ class="${cls}"[^>]*>`).exec(s)?.[0];
const styleOf = (tag) => /style="([^"]*)"/.exec(tag)?.[1] ?? "";
const dOf = (tag) => / d="([^"]+)"/.exec(tag)[1];
// a layer's data-morph: its [p, i] keys and its shapes
const morphOf = (tag) => {
  const m = /data-morph="([^"|]+)\|([^"]+)"/.exec(tag);
  return m && { keys: m[1].split(" ").map((k) => k.split(":").map(Number)), ds: m[2].split("|") };
};
const box = (s) => /<svg class="fx-svg [^"]*" viewBox="([^"]+)"/.exec(s)[1].split(" ").map(Number);
const first = sections[0];

test("the first picture is the survey sheet, played from time", () => {
  assert.match(first, /^<section class="world first ed-first"[^>]*data-pin="off"/, "the first world scrolls; nothing in it waits for the scroll");
  const stage = /<figure class="fx sv" data-stage data-duration="([\d.]+)"[^>]*aria-label="([^"]+)"/.exec(first);
  assert.ok(stage, "the picture is a [data-stage]: the engine plays its --p from time");
  assert.ok(+stage[1] >= 12 && +stage[1] <= 20, `the story plays in ${stage[1]}s`);
  assert.ok(!/data-stage-seek/.test(first), "it has no seek points, so low motion shows it complete, at --p 1");
  for (const action of ["play", "pause", "replay"]) assert.match(first, new RegExp(`data-stage-action="${action}"`), `it can be ${action}ed: it moves for more than five seconds`);
  const said = text(first);
  for (const word of [t.survey.unused, t.survey.missing, t.survey.twice, ...t.survey.shelf, t.survey.own]) assert.ok(said.includes(word), `the sheet says "${word}"`);
  assert.equal((first.match(/<span class="fx-lb sv-lb[^"]*" data-p aria-hidden="true"/g) || []).length, 7, "its lettering comes and goes, so the figure's label tells the story to a screen reader");
  assert.ok(stage[2].length > 200);
  assert.equal((first.match(/class="sv-box"/g) || []).length, 3, "three boxes are laid over the business");
  assert.equal((first.match(/class="fx-ripple"/g) || []).length, 6, "it asks for room twice, in three rings each");
});

test("the first picture ends on a complete still: the business and its own software, the boxes gone", () => {
  const shownAt = (tag, p) => value(styleOf(tag), "opacity", p) ?? 1;
  const tags = [...first.matchAll(/<(?:rect|path|circle|span) class="([^"]+)" data-p[^>]*>/g)].map((m) => ({ cls: m[1], tag: m[0] }));
  assert.ok(tags.length > 25, `found the sheet's parts (${tags.length})`);
  for (const { cls, tag } of tags) {
    const o = shownAt(tag, 1);
    if (/sv-(unused|twice|box|lead|missing)|fx-ripple/.test(cls)) assert.ok(o < 0.001, `${cls} is gone at the end`);
    if (/^fx-(body|ink|halo|fit|ticks)/.test(cls)) assert.ok(o > 0.999, `${cls} stands at the end`);
    const off = value(styleOf(tag), "stroke-dashoffset", 1);
    if (off !== null) assert.ok(Math.abs(off) < 1e-6, `${cls} is drawn whole at the end`);
  }
  const caps = tags.filter((x) => /sv-cap/.test(x.cls));
  assert.equal(caps.length, 4);
  assert.deepEqual(caps.map((x) => shownAt(x.tag, 1) > 0.999), [false, false, false, true], "only \"Your own software\" is left under the sheet");
  assert.match(caps[3].tag, /is-hot/);
  // before the boundary is drawn, the boxes have gone
  const fit = styleOf(tagOf(first, "fx-fit")), boxed = tagOf(first, "sv-box");
  let p = 0.3;
  assert.ok(shownAt(boxed, p) > 0.999, "the first box is on the business a third of the way in");
  while (shownAt(boxed, p) > 0.001) p += 0.001;
  assert.ok(value(fit, "opacity", p) < 0.001, "the boundary comes once the boxes have gone");
});

test("one business runs through the page: the first picture ends on it, the contrast draws it, the loop starts from it", () => {
  const contrast = world("contrast"), loop = world("loop");
  const yours = dOf(tagOf(contrast, "fx-ink"));
  const hero = tagOf(first, "fx-ink"), heroMorph = morphOf(hero);
  assert.equal(dOf(hero), yours, "the first picture ends on the contrast's shape");
  assert.equal(heroMorph.ds[heroMorph.ds.length - 1], yours);
  assert.ok(new Set(heroMorph.ds).size >= 4, "and the business has changed shape on the way there");
  // each box centred on its cell's centre: the business stands on the same spot
  const centred = (b) => Math.abs(b[0] + b[2] / 2) < 1e-6 && Math.abs(b[1] + b[3] / 2) < 1e-6;
  assert.ok(centred(box(first)) && centred(box(contrast)), "both sheets are centred on the business");
  assert.ok(Math.abs(box(first)[2] / box(first)[3] - box(contrast)[2] / box(contrast)[3]) < 0.01, "and are the same proportions");
  const where = (s) => /<g transform="([^"]+)">\s*<path class="fx-body/.exec(s)[1];
  assert.equal(where(first), "translate(0 0)");
  // the loop carries it on: the same box and place, starting from the same shape, already drawn
  assert.deepEqual(box(loop), box(contrast), "the same box, so the same cell gives the same place");
  assert.equal(where(loop), where(contrast), "standing on the same spot");
  const ink = tagOf(loop, "fx-ink");
  assert.equal(morphOf(ink).ds[0], yours, "the loop's business starts as the contrast's");
  assert.ok(!/style=/.test(ink), "it arrives drawn: none of its styles reads --p");
  assert.match(tagOf(contrast, "fx-ink"), /data-p style=/, "the contrast is where it is drawn");
});

test("each lap of the loop is ask, make room, grow, and the laps finish by 0.84", () => {
  const loop = world("loop");
  const body = morphOf(tagOf(loop, "fx-ink")), fit = morphOf(tagOf(loop, "fx-fit"));
  assert.equal(body.ds.length, 5, "the business as it starts, and after each of four laps");
  const rings = [...loop.matchAll(/<circle class="fx-ripple" data-p[^>]*>/g)].map((m) => styleOf(m[0]));
  assert.equal(rings.length, 12, "four asks of three rings");
  const seen = (style) => { const ps = []; for (let p = 0; p <= 1.0001; p += 0.002) if (value(style, "opacity", p) > 0.01) ps.push(p); return [ps[0], ps[ps.length - 1]]; };
  for (let lap = 0; lap < 4; lap++) {
    const ask = seen(rings[lap * 3])[0];
    const [room0, room1] = [fit.keys[lap * 2][0], fit.keys[lap * 2 + 1][0]];
    const [grow0, grow1] = [body.keys[lap * 2][0], body.keys[lap * 2 + 1][0]];
    assert.deepEqual([fit.keys[lap * 2][1], fit.keys[lap * 2 + 1][1]], [lap, lap + 1]);
    assert.deepEqual([body.keys[lap * 2][1], body.keys[lap * 2 + 1][1]], [lap, lap + 1]);
    assert.ok(ask < room0, `lap ${lap + 1}: the business asks (${ask.toFixed(3)}) before the boundary moves (${room0})`);
    assert.ok(room1 <= grow0, `lap ${lap + 1}: the boundary has made the room (${room1}) before the business grows (${grow0})`);
    assert.ok(grow0 < grow1 && grow1 <= 0.84 + 1e-9, `lap ${lap + 1}: the business has grown by ${grow1}`);
    if (lap) assert.ok(body.keys[lap * 2 - 1][0] < ask, `lap ${lap + 1} asks after lap ${lap} has grown`);
  }
  // the ledger still fills a row a lap, and all four stand by 0.84
  const rows = [...loop.matchAll(/<li data-p style="([^"]*)"><span>/g)].map((m) => m[1]);
  assert.equal(rows.length, 4);
  rows.forEach((style, k) => {
    assert.ok(value(style, "opacity", 0.84) > 0.999, `row ${k + 1} stands by 0.84`);
    assert.ok(value(style, "opacity", fit.keys[k * 2][0] - 0.001) < 0.01, `row ${k + 1} arrives as the boundary makes room`);
  });
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

// Elliot, 2026-11-19: the page says the home stage's opening pair, and the
// lead says what the contrast figure's queue means.
test("the contrast opens on having your own engineers", () => {
  const contrast = sections.find((s) => /<h2[^>]*>Big companies have their own engineers\. Now your business can too\.<\/h2>/.test(s));
  assert.ok(contrast, "the contrast heading is the home stage's opening pair");
  assert.match(text(contrast), /Software bought off the shelf puts you in line behind its other customers\. Your engineers work only for you\./);
  assert.match(contrast, /<figure[^>]*aria-label="Customers wait in line at an off-the-shelf software company\./, "the figure's label says what it draws");
});

// The recording's captions used to be the whole list until the video
// played, then only the line being said, at a larger size. So the box
// shrank by 104px as the video started (at 1440x900) and changed height
// again at every caption that wrapped differently, while the visitor was
// scrolling past it: everything below jumped, and the last world's words,
// held still by a stand measured before the jump, dropped about 56px as
// their pin let go (Elliot, 2026-11-20: "something fighting the
// scrolling"). Wherever the video can play, the captions now take turns in
// one cell as tall as the tallest line, from the first paint.
test("the recording's caption box is one height whatever line is being said", () => {
  const css = [...HTML.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
  const lines = rules.filter((r) => /\.ed-rec-lines/.test(r.sel));
  assert.ok(!lines.some((r) => /data-state/.test(r.sel)), "the layout waits for no script: the box is one height from the first paint, and Back lands on the page it measured");
  assert.ok(!lines.some((r) => /\bli\b/.test(r.sel) && /display:\s*none|visibility:\s*hidden/.test(r.body)), "a line not being said keeps its room, and screen readers still reach it");
  const block = /@media \(scripting: enabled\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const cell = [...block.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] })).find((r) => /\.ed-rec-lines li$/.test(r.sel));
  assert.ok(cell, "only where scripts run (the video can play) do the lines take turns");
  assert.match(cell.sel, /:root:not\(\[data-motion="low"\]\)/, "and only in full motion (low motion keeps the list)");
  assert.match(cell.body, /grid-area:\s*1 \/ 1/, "every line stands in the same cell");
  assert.match(cell.body, /font-size:\s*var\(--t-lead\)/, "every line at the size it is said at, so the cell fits the tallest");
  assert.ok(/li:not\(\[data-now\]\)\s*\{[^}]*opacity:\s*0/.test(block), "the lines not being said are transparent");
  assert.match(MAIN, /<ol class="ed-rec-lines"[^>]*>\s*<li data-now/, "the first line is the one shown before the script runs");
});
