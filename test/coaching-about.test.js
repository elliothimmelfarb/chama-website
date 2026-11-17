// /coaching and /about as built (docs/DESIGN.md section 7 and "The frame and
// the figure language"):
// - every world holds its contents in one .frame with a named layout, and
//   opts into the shots rig's fill check, so empty frames cannot come back;
// - every figure part that reads --p is whole at --p 1 (low motion, no
//   JavaScript and print show 1), adds nothing after 0.75 of its hold, and
//   never fades in over less than 0.05 of it;
// - each figure restyles at most 24 elements a frame;
// - a stage can be paused and played again;
// - /about no longer repeats the home page's "ours on day one" paragraph.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAGES = { coaching: "coaching.html", about: "about.html" };
const html = Object.fromEntries(Object.entries(PAGES).map(([id, f]) => [id, readFileSync(path.join(ROOT, f), "utf8")]));
const main = (doc) => /<main\b[\s\S]*<\/main>/.exec(doc)[0].replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
const LAYOUTS = ["split", "wide", "index", "statement", "pair"];

// A --p expression as a number at p: the CSS functions the figures use, in JS.
// Any custom property other than --p (a label's --tx, --ty) counts as 0.
function at(expr, p) {
  const js = expr
    .replace(/var\(--p\)/g, `(${p})`)
    .replace(/var\(--[\w-]+(?:,\s*[^()]*)?\)/g, "0")
    .replace(/calc\(/g, "(")
    .replace(/clamp\(/g, "CLAMP(")
    .replace(/pow\(/g, "Math.pow(")
    .replace(/max\(/g, "Math.max(")
    .replace(/min\(/g, "Math.min(")
    .replace(/(\d)(px|deg|%)/g, "$1");
  return Function("CLAMP", `return (${js});`)((a, v, b) => Math.min(Math.max(v, a), b));
}
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
// every [data-p] element with an inline style, as { tag, cls, props }
const parts = (doc) =>
  [...main(doc).matchAll(/<([a-z]+)\b([^>]*\sdata-p\b[^>]*)>/g)]
    .map((m) => ({ tag: m[1], cls: /class="([^"]*)"/.exec(m[2])?.[1] || "", style: /style="([^"]*)"/.exec(m[2])?.[1] || "" }))
    .filter((e) => /var\(--p\)/.test(e.style))
    .map((e) => ({ ...e, props: Object.fromEntries(e.style.split(/;(?![^(]*\))/).filter((d) => d.includes(":")).map((d) => { const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; })) }));
const near = (a, b) => Math.abs(a - b) < 1e-6;
// the value a property shows at p, as a list of numbers
const value = (v, p) => topLevel(v).filter((x) => /var\(--p\)|\d/.test(x) && !/^[a-z-]+$/.test(x)).map((x) => at(x, p));

for (const [id, doc] of Object.entries(html)) {
  test(`every world on /${id} sits in one .frame with a layout, and opts into the fill check`, () => {
    const worlds = [...main(doc).matchAll(/<section\b([^>]*\bclass="[^"]*\bworld\b[^"]*"[^>]*)>\s*<div class="pin">\s*(<div\b[^>]*>)?/g)];
    const all = main(doc).match(/<section\b[^>]*\bclass="[^"]*\bworld\b/g) || [];
    assert.ok(all.length >= 3, "found the worlds");
    assert.equal(worlds.length, all.length, "every world's first child is its .pin");
    for (const [, attrs, frame] of worlds) {
      assert.match(attrs, /\sdata-fill(?=[\s=]|$)/, `<section${attrs}> is not checked for fill`);
      assert.ok(frame && /class="frame"/.test(frame), `<section${attrs}>'s pin does not hold a .frame`);
      const layout = /data-layout="([^"]+)"/.exec(frame)?.[1];
      assert.ok(LAYOUTS.includes(layout), `<section${attrs}>'s frame names no layout (${layout})`);
    }
  });

  test(`the figures on /${id} are whole at --p 1, still after 0.75, and never blink`, () => {
    const ps = parts(doc);
    assert.ok(ps.length >= 3, `found the figures' moving parts (${ps.length})`);
    for (const { cls, props } of ps) {
      const name = `<${cls}>`;
      // a point travelling a stroke as it draws may leave once the stroke is
      // whole; every other part is in the finished picture
      const travels = !!props["offset-path"] && at(props.opacity || "1", 0) < 0.011;
      if (props.opacity) {
        if (!travels) assert.ok(at(props.opacity, 1) >= 0.99, `${name} is not shown at --p 1`);
        // every opacity window is at least 0.05 of the hold wide
        for (const m of props.opacity.matchAll(/clamp\(0, \(var\(--p\) - [\d.]+\) \/ ([\d.]+), 1\)/g)) assert.ok(+m[1] >= 0.05 - 1e-9, `${name} fades over ${m[1]} of its hold`);
      }
      if (props["stroke-dashoffset"]) assert.ok(near(at(props["stroke-dashoffset"], 1), 0), `${name} is not drawn at --p 1`);
      if (props.scale) assert.ok(near(at(props.scale, 1), 1), `${name} is not at its size at --p 1`);
      if (props["offset-distance"]) assert.ok(near(at(props["offset-distance"], 1), 100) || near(at(props["offset-distance"], 1), 0), `${name} is not at an end of its path at --p 1`);
      for (const [prop, v] of Object.entries(props)) {
        if (!/var\(--p\)/.test(v) || !/^(opacity|stroke-dashoffset|scale|translate|rotate|offset-distance|fill-opacity)$/.test(prop)) continue;
        const a = value(v, 0.75), b = value(v, 1);
        assert.ok(a.every((x, i) => near(x, b[i])), `${name}'s ${prop} still changes after 0.75 of the hold`);
      }
    }
  });

  test(`each figure on /${id} restyles at most 24 elements a frame`, () => {
    const figs = [...main(doc).matchAll(/<figure\b[\s\S]*?<\/figure>/g)].map((m) => m[0]);
    assert.ok(figs.length >= 1);
    for (const fig of figs) {
      let cost = 0;
      const stack = [];
      for (const m of fig.matchAll(/<(\/?)([a-zA-Z]+)\b([^>]*?)(\/?)>/g)) {
        const [, closing, tag, attrs, self] = m;
        if (/^(br|img|input|source|meta|link)$/i.test(tag)) continue;
        if (closing) { stack.pop(); continue; }
        // an element restyles when it reads --p, or sits inside one that does
        const reads = /\sdata-p\b/.test(attrs) || stack.some(Boolean);
        if (reads) cost++;
        if (!self) stack.push(reads);
      }
      assert.ok(cost <= 24, `${/class="([^"]*)"/.exec(fig)[1]} restyles ${cost} elements a frame`);
    }
  });

  test(`every stage on /${id} can be paused and played again`, () => {
    const stages = [...main(doc).matchAll(/<figure\b[^>]*\sdata-stage\b[\s\S]*?<\/figure>/g)].map((m) => m[0]);
    for (const s of stages) {
      for (const action of ["play", "pause", "replay"]) assert.match(s, new RegExp(`data-stage-action="${action}"`), `a stage with no ${action} button`);
      assert.match(s, /data-duration="\d/);
    }
  });
}

test("/about keeps Elliot's #15 sentence and leaves 'ours on day one' to the home page", () => {
  const text = main(html.about).replace(/<[^>]+>/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  assert.ok(text.includes("Engineers who learned the craft before AI, weren't afraid of it, and mastered it, can now build anything, fast."));
  assert.ok(!/ours on day one/i.test(text), "the home page carries #13");
  assert.ok(!/levelling up fast/i.test(text), "the home page carries #13");
});
