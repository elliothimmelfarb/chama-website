// What other code depends on in the figure language (site/figures/kit.js):
// - the helpers return the geometry and the --p expressions figures expect,
//   and every layer subject() draws is complete at --p 1 (low motion, no
//   JavaScript and print show --p 1);
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

test("the pentagon is regular, top first, clockwise, squashed to 0.86", () => {
  const R = 100, pts = kit.pent(R);
  assert.equal(pts.length, 5);
  close(pts[0][0], 0, "first vertex centred");
  close(pts[0][1], -R * kit.SQUASH, "first vertex at the top");
  assert.ok(pts[1][0] > 0 && pts[1][1] < 0 && pts[2][1] > 0, "clockwise on screen (y down)");
  pts.forEach(([x, y], i) => close(Math.hypot(x, y / kit.SQUASH), R, `vertex ${i} on the circle`));
  assert.equal(kit.SQUASH, 0.86);
  // seen square on, as the stage and the queue draw it
});

test("grow puts every edge of the outline the same distance outside", () => {
  const pts = kit.pent(100), d = 20, g = kit.grow(pts, d);
  for (let i = 0; i < 5; i++) {
    const [a, b] = [pts[i], pts[(i + 1) % 5]], [p] = [g[i]];
    const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey);
    // distance from the grown corner to the original edge's line, outward
    const dist = ((p[0] - a[0]) * ey - (p[1] - a[1]) * ex) / l;
    close(Math.abs(dist), d, `edge ${i}`);
  }
  assert.equal(kit.poly([[0, -1.234], [2, 3]]), "M0 -1.23 L2 3 Z");
});

// every --p style a subject draws, as { property: value }
const styles = (svg) => [...svg.matchAll(/<(\w+) class="([^"]+)"[^>]*?data-p[^>]*?style="([^"]+)"/g)].map((m) => ({
  tag: m[1], cls: m[2],
  props: Object.fromEntries(m[3].split(";").filter(Boolean).map((d) => { const i = d.indexOf(":"); return [d.slice(0, i), d.slice(i + 1)]; })),
}));

test("subject() draws the five layers in order, each a leaf, unique ids", () => {
  const svg = kit.subject({ id: "t", R: 100 });
  const layers = styles(svg);
  assert.deepEqual(layers.map((l) => l.cls), ["fx-floor", "fx-body", "fx-ink", "fx-halo", "fx-fit"]);
  assert.equal((svg.match(/data-p/g) || []).length, 5, "the protagonist restyles five elements a frame");
  for (const tag of svg.matchAll(/<(path|ellipse)\b[^>]*>/g)) assert.match(tag[0], /\/>$/, "each layer is a leaf");
  const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.every((id) => id.startsWith("t-")), "ids carry the instance's id");
  assert.equal(new Set(ids).size, ids.length);
  for (const ref of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(ref[1]), `${ref[1]} is defined`);
  // the floor sits under the shape, and the fit outside it
  assert.match(svg, /cy="(\d+(\.\d+)?)"/);
  assert.ok(+/class="fx-floor"[^>]*cy="([\d.]+)"/.exec(svg)[1] > 100 * kit.SQUASH * Math.cos(Math.PI / 5));
});

test("subject() is complete at --p 1, and blank before it arrives", () => {
  for (const opts of [{}, { warm: kit.WARM }, { owned: true }]) {
    for (const { cls, props } of styles(kit.subject({ id: "t", R: 100, ...opts }))) {
      if (props.opacity) close(at(props.opacity, 1), 1, `${cls} opacity at 1`);
      if (props["stroke-dashoffset"]) close(at(props["stroke-dashoffset"], 1), 0, `${cls} drawn at 1`);
      if (props.scale) close(at(props.scale, 1), 1, `${cls} scale at 1`);
      if (props.translate) for (const part of topLevel(props.translate)) close(at(part, 1), 0, `${cls} in place at 1`);
      if (props.opacity) assert.ok(at(props.opacity, 0) <= 0.011, `${cls} is not shown at 0`);
    }
  }
  const warm = styles(kit.subject({ id: "t", R: 100, warm: kit.WARM }));
  assert.equal(warm.length, 6, "the warmth is one more element");
  assert.equal(styles(kit.subject({ id: "t", R: 100, owned: true })).length, 5);
});

test("a protagonist that continues from the world before arrives drawn and costs nothing a frame", () => {
  const svg = kit.subject({ id: "t", R: 100, drawn: true });
  assert.ok(!/data-p/.test(svg), "nothing on it reads --p");
  assert.ok(!/style=/.test(svg));
  for (const cls of ["fx-floor", "fx-body", "fx-ink", "fx-halo", "fx-fit"]) assert.match(svg, new RegExp(`class="${cls}"`));
});

test("nothing inside a figure fades in over less than 0.05 of its hold", () => {
  const windows = (s) => [...s.matchAll(/clamp\(0, \(var\(--p\) - [\d.]+\) \/ ([\d.]+), 1\)/g)].map((m) => +m[1]);
  const fades = [kit.ARRIVE.floor, kit.ARRIVE.body, kit.DRAW, kit.FIT, kit.WARM, kit.label(0.5)]
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
    for (const name of ["n", "c", "ss", "out", "bump", "poly", "grow", "ease"]) {
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

test("subject() without its outline has no halo or fit, and fills() names its paint", () => {
  const bare = kit.subject({ id: "t", R: 50, outline: false });
  assert.ok(!/fx-halo|fx-fit/.test(bare), "outline: false leaves out the halo and the fit");
  assert.equal((bare.match(/\sdata-p\b/g) || []).length, 3, "three moving parts: floor, body, ink");
  const f = kit.fills("t");
  for (const k of ["body", "floor"]) assert.ok(bare.includes(`id="${f[k].slice(5, -1)}"`), `fills().${k} points at a gradient subject() defines`);
});
