// The opening stage on home (site/figures/stage.js) reads at a person's
// pace: each scene's sentence is shown whole for its scene and stays for
// its reading time, 1.4s plus 0.35s a word and never under 3.2s. The
// engine's clock, its seek points and the scene bar all follow those
// times, and what is on the sheet at each moment is evaluated from the
// same --p expressions the browser reads.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { stage, readingTime } from "../site/figures/stage.js";
import { home as t } from "../site/content/en/home.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const built = readFileSync(path.join(ROOT, "index.html"), "utf8");
const html = String(stage({ label: t.stageLabel, beats: t.stageBeats }));
const words = (s) => s.trim().split(/\s+/).length;
const T = +/data-duration="([\d.]+)"/.exec(html)[1];
const holds = t.stageBeats.map((b) => readingTime(b.say));
const starts = holds.map((_, i) => holds.slice(0, i).reduce((a, b) => a + b, 0));

// One declaration of an inline style, evaluated at a --p: the CSS functions
// the stage uses, in JS.
function value(style, prop, p) {
  const m = new RegExp(`(?:^|;)${prop}:([^;]*)`).exec(style);
  if (!m) return null;
  const js = m[1].replace(/var\(--p\)/g, `(${p})`).replace(/calc\(/g, "(").replace(/clamp\(/g, "CLAMP(").replace(/pow\(/g, "Math.pow(");
  return Function("CLAMP", `return (${js});`)((a, v, b) => Math.min(Math.max(v, a), b));
}
// every moving part of the drawing: its scene, its class and its style
const parts = [...html.matchAll(/<(\w+) class="([^"]*)" data-p data-s="(\d+)"[^>]*?style="([^"]*)"/g)].map((m) => ({ tag: m[1], cls: m[2], scene: +m[3], style: m[4] }));
const says = [...html.matchAll(/<p class="stage-say" data-p style="([^"]*)">([\s\S]*?)<\/p>/g)].map((m) => ({ style: m[1], text: m[2] }));
const shown = (part, p) => (value(part.style, "opacity", p) ?? 1) > 0.05;

test("a scene stays up for its reading time", () => {
  assert.equal(readingTime("Big companies have their own engineers."), 1.4 + 0.35 * 6);
  assert.equal(readingTime("A small, family-owned, AI-native business."), 3.2, "never under 3.2s");
  const long = "If it can be solved with something on a phone, a computer or in the cloud, we can do it.";
  assert.equal(readingTime(long), 1.4 + 0.35 * words(long));
});

test("the stage's clock is the sum of its scenes' reading times, and each scene starts where the one before ends", () => {
  assert.ok(Math.abs(T - holds.reduce((a, b) => a + b, 0)) < 0.01);
  const seeks = [...html.matchAll(/data-stage-seek="([\d.]+)"/g)].map((m) => +m[1]);
  assert.equal(seeks.length, t.stageBeats.length);
  seeks.forEach((s, i) => assert.ok(Math.abs(s * T - starts[i]) < 0.01, `scene ${i + 1} starts at ${s * T}s, not ${starts[i]}s`));
});

test("each sentence is shown whole for its whole scene, and only one at a time", () => {
  assert.equal(says.length, t.stageBeats.length);
  says.forEach(({ text }, i) => assert.equal(text.replace(/<[^>]+>/g, "").replace(/‑/g, "-").replace(/&#39;/g, "'").trim(), t.stageBeats[i].say));
  for (let i = 0; i < says.length; i++) {
    for (let s = starts[i] + 0.35; s <= starts[i] + holds[i] - 0.25; s += 0.1) {
      says.forEach((say, j) => {
        const o = value(say.style, "opacity", s / T);
        if (j === i) assert.ok(o > 0.999, `sentence ${i + 1} is at ${o} at ${s.toFixed(2)}s`);
        else assert.ok(o < 0.001, `sentence ${j + 1} shows at ${s.toFixed(2)}s, in scene ${i + 1}`);
      });
    }
  }
  assert.equal(value(says[0].style, "opacity", 0), 1, "the first sentence is there before the clock starts");
  assert.ok(!/stage-ph\b/.test(html), "no phrase-by-phrase reveal");
});

test("each low motion still shows its own scene, drawn whole, and nothing of another", () => {
  const stills = [...html.matchAll(/data-stage-still="([\d.]+)"/g)].map((m) => +m[1]);
  assert.equal(stills.length, t.stageBeats.length);
  assert.ok(parts.length > 40, `found the drawing's parts (${parts.length})`);
  stills.forEach((p, i) => {
    assert.ok(p * T > starts[i] + 0.78 * holds[i], `still ${i + 1} comes after its drawing ends`);
    for (const part of parts) {
      if (part.scene !== i) { assert.ok(!shown(part, p), `a ${part.cls} of scene ${part.scene + 1} shows in still ${i + 1}`); continue; }
      const off = value(part.style, "stroke-dashoffset", p);
      if (off !== null && /stage-(em|ink)/.test(part.cls) && shown(part, p)) assert.ok(Math.abs(off) < 0.005, `a ${part.cls} of scene ${i + 1} is ${Math.abs(off).toFixed(2)} undrawn in its still`);
    }
    assert.ok(parts.some((x) => x.scene === i && /stage-em/.test(x.cls) && shown(x, p)), `scene ${i + 1}'s line shows in its still`);
  });
});

test("the stage ends on the last scene alone", () => {
  const last = t.stageBeats.length - 1;
  for (const part of parts) {
    if (part.scene !== last) assert.ok(!shown(part, 1), `a ${part.cls} of scene ${part.scene + 1} shows at the end`);
    else if (/stage-(em|ink|tone)/.test(part.cls)) assert.ok(shown(part, 1), `scene ${last + 1}'s ${part.cls} is gone at the end`);
  }
});

test("the scene bar's segments are as long as their scenes", () => {
  const flex = [...html.matchAll(/class="stage-seg"[^>]*style="flex:\s*([\d.]+)/g)].map((m) => +m[1]);
  assert.deepEqual(flex, holds.map((h) => +h.toFixed(2)));
});

test("the built home page carries this stage", () => {
  assert.ok(built.includes(html), "index.html is built from this stage (npm run pages)");
});

// Elliot, 2026-11-19: "Software companies have engineers, and their
// customers wait in line" felt dense, so the stage opens on what the
// visitor gets (option A of five). With no queue in the words, scene 1
// draws the company and you, and no line at its door.
test("the stage opens on having your own engineers, with no queue drawn", () => {
  assert.deepEqual(t.stageBeats.slice(0, 2).map((b) => b.say), ["Big companies have their own engineers.", "Now your business can too."]);
  const ink = parts.filter((x) => x.scene === 0 && /stage-ink\b/.test(x.cls));
  assert.equal(ink.length, 1, `scene 1 draws only the company in ink, not a queue (${ink.length} ink parts)`);
});
