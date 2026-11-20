// What other code depends on in the figure language (site/figures/kit.js):
// - the helpers return the geometry and the --p expressions figures expect,
//   every layer subject() draws is complete at --p 1 (low motion, no
//   JavaScript and print show --p 1), and a business that changes shape
//   only grows into room its boundary has already made;
// - no figure keeps its own copy of the shared helpers;
// - inside a figure's SVG, [data-p] goes on leaves or on a group of at most
//   three children, because everything inside an element whose --p changes
//   is restyled every frame (pages.md, frame cost).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as kit from "../site/figures/kit.js";
import { PAGES } from "../site/site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");

// A --p expression as a number: the CSS functions the helpers use, in JS.
function at(expr, p) {
  const js = expr
    .replace(/var\(--p\)/g, `(${p})`)
    .replace(/calc\(/g, "(")
    .replace(/clamp\(/g, "CLAMP(")
    .replace(/pow\(/g, "Math.pow(")
    .replace(/max\(/g, "Math.max(")
    .replace(/min\(/g, "Math.min(")
    .replace(/(\d)px/g, "$1");
  return Function("CLAMP", `return (${js});`)((a, v, b) => Math.min(Math.max(v, a), b));
}
// "0 calc(12px * (1 - x))" as ["0", "calc(...)"]: split on spaces outside parentheses
function topLevel(value) {
  const parts = [""];
  let depth = 0;
  for (const ch of value) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === " " && !depth) parts.push(""); else parts[parts.length - 1] += ch;
  }
  return parts.filter(Boolean);
}
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} is not ${b}`);

test("the timing helpers ramp where figures expect", () => {
  close(at(kit.c(0.2, 0.4), 0.1), 0, "c before a");
  close(at(kit.c(0.2, 0.4), 0.3), 0.5, "c halfway");
  close(at(kit.c(0.2, 0.4), 0.9), 1, "c after b");
  close(at(kit.ss(0, 1), 0.25), 0.15625, "smoothstep at a quarter");
  close(at(kit.out(0, 1), 0.5), 0.875, "ease-out cubic at half");
  close(at(kit.bump(0.5, 0.1), 0.5), 1, "bump at its middle");
  close(at(kit.bump(0.5, 0.1), 0.45), 0.5, "bump halfway up");
  close(at(kit.bump(0.5, 0.1), 0.7), 0, "bump past its width");
  assert.equal(kit.n(1 / 3), 0.3333);
});

test("the business is one irregular shape: nine points, the first at the top, clockwise", () => {
  const R = 100, pts = kit.shape(R);
  assert.equal(pts.length, 9);
  close(pts[0][0], 0, "first point centred");
  assert.ok(pts[0][1] < 0, "first point at the top");
  assert.ok(pts[1][0] > 0 && pts[1][1] < 0 && pts[3][1] > 0, "clockwise on screen (y down)");
  const radii = pts.map(([x, y]) => Math.hypot(x, y) / R);
  radii.forEach((r, i) => close(r, kit.BUSINESS[i], `point ${i} at its own distance`));
  assert.ok(Math.max(...radii) / Math.min(...radii) > 1.3, "it is irregular: no circle and no regular polygon");
  assert.ok(new Set(radii.map((r) => r.toFixed(2))).size >= 6, "its sides differ");
  // any list of nine radii is a business that has changed shape
  assert.equal(kit.shape(R, kit.BUSINESS.map((r) => r * 0.8)).length, 9);
});

// the commands of a path, without their numbers
const commands = (d) => d.replace(/-?\d+(\.\d+)?/g, "").replace(/\s+/g, "");
const numbers = (d) => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

test("blob() and curve() draw through every point, and two shapes of one business are the same commands", () => {
  const a = kit.blob(kit.shape(100)), b = kit.blob(kit.shape(100, kit.BUSINESS.map((r, i) => (i < 2 ? r * 1.4 : r))));
  assert.match(a, /^M[^MZ]+Z$/, "one closed run");
  assert.equal((a.match(/C/g) || []).length, 9, "a curve to each of the nine points");
  assert.equal(commands(a), commands(b), "so one can change into the other number by number");
  assert.equal(numbers(a).length, numbers(b).length);
  const line = kit.curve([[0, 0], [10, 0], [20, 5], [30, 0]]);
  assert.match(line, /^M0 0 C[^MZ]+ 30 0$/, "an open line from its first point to its last");
  assert.equal((line.match(/C/g) || []).length, 3);
  assert.equal(kit.poly([[0, -1.234], [2, 3]]), "M0 -1.23 L2 3 Z");
});

test("offset() pushes every point the same distance outward, and ticks() reach out from there", () => {
  const pts = kit.shape(100), d = 15, o = kit.offset(pts, d);
  pts.forEach((p, i) => {
    close(Math.hypot(o[i][0] - p[0], o[i][1] - p[1]), d, `point ${i} moved ${d}`);
    assert.ok(Math.hypot(...o[i]) > Math.hypot(...p), `point ${i} moved away from the centre`);
  });
  const t = kit.ticks(pts, 15, 24);
  assert.equal((t.match(/M/g) || []).length, 9, "one tick at each point");
  assert.match(t, /^M[-\d. ]+ L[-\d. ]+( M[-\d. ]+ L[-\d. ]+){8}$/);
});

// The engine's side of a shape that changes: worlds.js reads data-morph and
// writes d. Its functions are taken from the source and run here.
const engine = read("assets/worlds.js");
const shapeAt = (() => {
  const src = engine.slice(engine.indexOf("var NUM = "), engine.indexOf("// writes an element's --p"));
  assert.ok(src.length > 200, "found the engine's shapes");
  const sm = /function clamp[^\n]*\n\s*function sm[^\n]*/.exec(engine)[0];
  return Function(`${sm}\n${src}\nreturn function (attr, p) { return shapeAt(morphOf({ getAttribute: function () { return attr; } }), p); };`)();
})();

test("morph() writes what the engine reads: the shape that stands at each --p, eased between", () => {
  const attr = kit.morph([[0.2, 0], [0.4, 1], [0.6, 1], [0.8, 2]], ["M0 0 L10 0", "M0 0 L20 -4", "M0 0 L40 6.5"]);
  assert.equal(attr, "0.2:0 0.4:1 0.6:1 0.8:2|M0 0 L10 0|M0 0 L20 -4|M0 0 L40 6.5");
  assert.equal(shapeAt(attr, 0), "M0 0 L10 0", "the first shape before the first key");
  assert.equal(shapeAt(attr, 0.3), "M0 0 L15 -2", "halfway between two keys, halfway between their shapes");
  assert.equal(shapeAt(attr, 0.25), "M0 0 L11.6 -0.6", "eased: slow out of the first shape");
  assert.equal(shapeAt(attr, 0.5), "M0 0 L20 -4", "a shape stands between its two keys");
  assert.equal(shapeAt(attr, 1), "M0 0 L40 6.5", "the last shape from the last key on");
});

// every --p style a subject draws, as { property: value }
const styles = (svg) => [...svg.matchAll(/<(\w+) class="([^"]+)"[^>]*?data-p[^>]*?style="([^"]+)"/g)].map((m) => ({
  tag: m[1], cls: m[2],
  props: Object.fromEntries(m[3].split(";").filter(Boolean).map((d) => { const i = d.indexOf(":"); return [d.slice(0, i), d.slice(i + 1)]; })),
}));
const LAYERS = ["fx-body", "fx-ink", "fx-halo", "fx-fit", "fx-ticks"];

test("subject() draws the business flat: fill, ink, then the boundary over its halo, and its ticks", () => {
  const svg = kit.subject({ R: 100 });
  assert.deepEqual(styles(svg).map((l) => l.cls), LAYERS);
  assert.equal((svg.match(/data-p/g) || []).length, 5, "the protagonist restyles five elements a frame");
  for (const tag of svg.matchAll(/<path\b[^>]*>/g)) assert.match(tag[0], /\/>$/, "each layer is a leaf");
  assert.ok(!/gradient|ellipse|url\(#/.test(svg), "no gradient and no floor shadow: nothing soft or solid");
  const d = (cls) => new RegExp(`class="${cls}"[^>]* d="([^"]+)"`).exec(svg)[1];
  assert.equal(d("fx-body"), kit.blob(kit.shape(100)), "the fill is the business");
  assert.equal(d("fx-ink"), d("fx-body"), "the ink outline is its edge");
  assert.equal(d("fx-fit"), kit.blob(kit.offset(kit.shape(100), kit.FIT_GAP * 100)), "the boundary stands FIT_GAP of R outside");
  assert.equal(d("fx-halo"), d("fx-fit"));
});

test("subject() is complete at --p 1, and blank before it arrives", () => {
  for (const opts of [{}, { warm: kit.WARM }, { owned: true }]) {
    for (const { cls, props } of styles(kit.subject({ R: 100, ...opts }))) {
      if (props.opacity) close(at(props.opacity, 1), 1, `${cls} opacity at 1`);
      if (props["stroke-dashoffset"]) close(at(props["stroke-dashoffset"], 1), 0, `${cls} drawn at 1`);
      if (props.opacity) assert.ok(at(props.opacity, 0) <= 0.011, `${cls} is not shown at 0`);
    }
  }
  const warm = styles(kit.subject({ R: 100, warm: kit.WARM }));
  assert.equal(warm.length, 6, "the warmth is one more element");
  assert.equal(warm[1].cls, "fx-body is-owned");
  assert.equal(styles(kit.subject({ R: 100, owned: true })).length, 5);
});

test("a protagonist that continues from the world before arrives drawn and costs nothing a frame", () => {
  const svg = kit.subject({ R: 100, drawn: true });
  assert.ok(!/data-p/.test(svg), "nothing on it reads --p");
  assert.ok(!/style=/.test(svg));
  for (const cls of LAYERS) assert.match(svg, new RegExp(`class="${cls}"`));
});

// The keys of a layer's data-morph, as [p, i] pairs, and its shapes.
const morphOf = (svg, cls) => {
  const m = new RegExp(`class="${cls}"[^>]* data-morph="([^"|]+)\\|([^"]+)" d="([^"]+)"`).exec(svg);
  return m && { keys: m[1].split(" ").map((k) => k.split(":").map(Number)), ds: m[2].split("|"), d: m[3] };
};

test("a business that grows: every layer changes shape, the boundary before the business", () => {
  const bigger = kit.BUSINESS.map((r, i) => (i === 2 ? r * 1.3 : r));
  const grows = { shapes: [kit.BUSINESS, bigger], fit: [[0.3, 0], [0.4, 1]], body: [[0.5, 0], [0.6, 1]] };
  const svg = kit.subject({ R: 100, drawn: true, grows });
  const body = morphOf(svg, "fx-body"), ink = morphOf(svg, "fx-ink"), fit = morphOf(svg, "fx-fit"), halo = morphOf(svg, "fx-halo"), tk = morphOf(svg, "fx-ticks");
  for (const [name, layer] of Object.entries({ body, ink, fit, halo, tk })) {
    assert.ok(layer, `${name} changes shape`);
    assert.equal(layer.d, layer.ds[layer.ds.length - 1], `${name}'s d is its last shape, which shows wherever nothing writes --p`);
    assert.equal(new Set(layer.ds.map(commands)).size, 1, `${name}'s shapes are the same commands`);
  }
  assert.deepEqual(body.keys, grows.body);
  assert.deepEqual(ink.keys, grows.body);
  assert.deepEqual(fit.keys, grows.fit);
  assert.deepEqual(tk.keys, grows.fit, "the ticks move with the boundary");
  assert.equal(body.ds[0], kit.blob(kit.shape(100)));
  assert.equal((svg.match(/\sdata-p\b/g) || []).length, 5, "a drawn protagonist that grows has the engine write its five layers");
  assert.ok(!/style=/.test(svg), "and still reads no --p in its styles");
});

test("a ripple is three rings that leave one after another and are gone when it ends", () => {
  const rings = styles(kit.ripple([10, 20], 0.2, 0.4));
  assert.equal(rings.length, 3);
  rings.forEach(({ cls, props }, i) => {
    assert.equal(cls, "fx-ripple");
    for (const p of [0, 0.19, 0.41, 1]) assert.ok(at(props.opacity, p) < 0.001, `ring ${i} is not shown at ${p}`);
    assert.ok(at(props.scale, 0.2) < 0.1 && at(props.scale, 0.4) <= 1.0001, `ring ${i} grows from its point`);
  });
  const peak = (r) => [0.2, 0.22, 0.24, 0.26, 0.28, 0.3, 0.32, 0.34, 0.36, 0.38].find((p) => at(r.props.opacity, p) > 0.4);
  assert.ok(peak(rings[0]) < peak(rings[1]) && peak(rings[1]) < peak(rings[2]), "one after another");
});

test("nothing inside a figure fades in over less than 0.05 of its hold", () => {
  const windows = (s) => [...s.matchAll(/clamp\(0, \(var\(--p\) - [\d.]+\) \/ ([\d.]+), 1\)/g)].map((m) => +m[1]);
  const fades = [kit.ARRIVE, kit.DRAW, kit.FIT, kit.TICKS, kit.WARM, kit.label(0.5)]
    .flatMap((s) => s.split(";").filter((d) => d.startsWith("opacity")));
  assert.ok(fades.length >= 6);
  for (const f of fades) for (const w of windows(f)) assert.ok(w >= 0.05 - 1e-9, `"${f.slice(0, 60)}..." fades over ${w}`);
});

test("place() and label() put an HTML label on its part", () => {
  assert.equal(kit.place([-100, -50, 200, 100], 0, 0), "--x:50%;--y:50%");
  assert.equal(kit.place([0, 0, 400, 200], 100, 150), "--x:25%;--y:75%");
  const l = kit.label(0.3);
  close(at(/opacity:(.*?);/.exec(l)[1], 1), 1, "label shown at 1");
});

test("no figure keeps its own copy of the shared helpers", () => {
  for (const f of readdirSync(path.join(ROOT, "site/figures"))) {
    if (f === "kit.js" || !f.endsWith(".js")) continue;
    const src = read(`site/figures/${f}`);
    for (const name of ["n", "c", "ss", "out", "bump", "poly", "shape", "blob", "curve", "offset", "ticks", "morph", "ripple"]) {
      assert.ok(!new RegExp(`(?:const|function|let)\\s+${name}\\s*(?:=|\\()`).test(src), `site/figures/${f} defines its own ${name}; import it from kit.js`);
    }
    assert.ok(!/from "\.\/stage\.js"/.test(src) || f === "stage.js", `site/figures/${f} imports geometry from stage.js; import it from kit.js`);
  }
});

// The SVG elements of a page, with their [data-p] and children counted.
// Parsed by depth from each outermost <svg>, so an svg nested inside
// another (the door glyphs inside the stage) neither ends the walk early
// nor hides the groups after it.
function svgParts(html) {
  const out = [], stack = [];
  for (const m of html.matchAll(/<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g)) {
    const [, closing, tag, attrs, self] = m;
    if (!stack.length && tag !== "svg") continue;
    if (closing) { const el = stack.pop(); if (el) out.push(el); continue; }
    const el = { tag, p: /\sdata-p\b/.test(attrs), cls: /class="([^"]*)"/.exec(attrs)?.[1] || "", descendants: 0 };
    for (const parent of stack) parent.descendants++;
    if (self) out.push(el); else stack.push(el);
  }
  return out;
}

// Groups that predate the rule, each with the rebuild that removes it.
// Delete an entry when its figure is rebuilt; the test fails on an entry
// that no page has any more.
const KNOWN = {};

test("inside a figure, [data-p] is on a leaf or a group of at most three", () => {
  const files = PAGES.map((p) => p.file);
  let checked = 0;
  const known = new Set();
  for (const file of files) {
    for (const el of svgParts(read(file)).filter((e) => e.p)) {
      checked++;
      if (!el.descendants) continue;
      const exempt = Object.keys(KNOWN).find((k) => el.cls.split(/\s+/).includes(k));
      if (exempt) { known.add(exempt); continue; }
      assert.equal(el.tag, "g", `${file}: <${el.tag} class="${el.cls}" data-p> has children; put data-p on its parts`);
      assert.ok(el.descendants <= 3, `${file}: <g class="${el.cls}" data-p> restyles ${el.descendants} elements inside it each frame; put data-p on each part`);
    }
  }
  assert.ok(checked > 20, `found the figures (${checked} parts)`);
  for (const k of Object.keys(KNOWN)) assert.ok(known.has(k), `KNOWN lists ${k}, which no page has any more; delete the entry`);
});

test("every id on a built page is unique", () => {
  for (const { file } of PAGES) {
    const html = read(file), seen = new Map();
    for (const [, id] of html.matchAll(/\sid="([^"]+)"/g)) seen.set(id, (seen.get(id) || 0) + 1);
    const twice = [...seen].filter(([, k]) => k > 1).map(([id]) => id);
    assert.deepEqual(twice, [], `${file} has ids more than once: ${twice.join(", ")}`);
  }
});

test("subject() without its outline is the business before it has its software", () => {
  const bare = kit.subject({ R: 50, outline: false });
  assert.ok(!/fx-halo|fx-fit|fx-ticks/.test(bare), "outline: false leaves out the halo, the boundary and the ticks");
  assert.equal((bare.match(/\sdata-p\b/g) || []).length, 2, "two moving parts: the fill and the ink");
});

// On every built page, wherever a business changes shape, its boundary has
// made the room before the business grows into it: the business never
// crosses its boundary.
test("on the built pages a business only grows into room its boundary has already made", () => {
  let found = 0;
  for (const { file } of PAGES) {
    const html = read(file);
    for (const g of html.matchAll(/<path class="fx-body[^"]*" data-p[^>]*data-morph[\s\S]*?<path class="fx-ticks"[^>]*>/g)) {
      const body = morphOf(g[0], "fx-ink"), fit = morphOf(g[0], "fx-fit");
      assert.ok(body && fit, `${file}: a business that changes has a boundary that changes`);
      found++;
      // when each layer has fully reached shape i, and when it starts to leave it
      const reached = (keys, i) => keys.find(([, k]) => k === i)?.[0] ?? 0;
      const leaves = (keys, i) => [...keys].reverse().find(([, k]) => k === i)?.[0] ?? 0;
      const last = body.keys[body.keys.length - 1][1];
      assert.equal(fit.keys[fit.keys.length - 1][1], last, `${file}: both end on the same shape`);
      for (let i = fit.keys[0][1] + 1; i <= last; i++) {
        assert.ok(reached(fit.keys, i) <= leaves(body.keys, i - 1) + 1e-9, `${file}: the boundary is at shape ${i} (by ${reached(fit.keys, i)}) before the business leaves shape ${i - 1} (at ${leaves(body.keys, i - 1)})`);
      }
    }
  }
  assert.ok(found >= 2, `found the businesses that grow (${found}): the first picture and the loop on /engineering-department`);
});
