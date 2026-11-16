// The engine's contracts that a reading of the source can hold
// (assets/worlds.js, assets/worlds.css, assets/sky.js):
// - --u, --e and --p are registered not to inherit, so a scroll frame
//   restyles only the elements worlds.js writes them on, and every rule that
//   reads one sits on such an element, never on a container of a world's
//   contents (Chrome restyles everything inside an element whose custom
//   property changes, inherited or not);
// - the pinned layout's class, html.pin, never meets a rule for the pin
//   element, and the engine and the boot snippet agree on when it is set;
// - the router's pages are the site's, the sky's grounds are the engine's,
//   and each ground's main colour in the sky is its --ground in tokens.css;
// - nothing cut from the engine comes back.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const JS = read("assets/worlds.js");
const CSS = strip(read("assets/worlds.css"));
const SKY = read("assets/sky.js");
const FIXTURE = read("test/fixtures/engine.html");

// Flat rules (selectors and body), with @media and @supports unwrapped.
function rules(css) {
  const out = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const head = m[1].replace(/^[\s\S]*\{/, "").trim();
    out.push({ selectors: head.split(/,(?![^(]*\))/).map((s) => s.trim()), body: m[2] });
  }
  return out;
}
const RULES = rules(CSS);
const FIX_RULES = rules(strip(/<style>([\s\S]*?)<\/style>/.exec(FIXTURE)[1]));

const listOf = (name) => (new RegExp(`var ${name} = "([^"]+)"`).exec(JS)?.[1] ?? "").split(",").map((s) => s.trim().split(/\s+/));
const U_READERS = listOf("U_READERS");
const P_READERS = listOf("P_READERS");

// whether a selector's last compound is (or the pseudo-element of) a reader
const has = (compound, part) => part.startsWith("[")
  ? compound.includes(part)
  : new RegExp(part.startsWith(".") ? `\\${part}(?![\\w-])` : `^${part}(?![\\w-])`).test(compound);
function lastCompound(selector) {
  const plain = selector.replace(/::?(?:before|after)$/, "").replace(/:not\([^)]*\)/g, "");
  const parts = plain.split(/\s+|>/).filter(Boolean);
  return { parts, last: parts[parts.length - 1] ?? "" };
}
const onReader = (selector, readers) => {
  const { parts, last } = lastCompound(selector);
  return readers.some((r) => has(last, r[r.length - 1]) && r.slice(0, -1).every((a) => parts.slice(0, -1).some((p) => has(p, a))));
};

const CONTAINERS = [".world", ".pin", ".copy", "[data-stage]", ".made-stage", ".made-ticks", ".made"];

test("--u, --e and --p are registered not to inherit, and --p starts complete", () => {
  for (const name of ["--u", "--e", "--p"]) {
    const reg = RULES.find((r) => r.selectors[0] === `@property ${name}`);
    assert.ok(reg, `${name} is registered`);
    assert.match(reg.body, /inherits:\s*false/, `${name} must not inherit`);
  }
  // a figure is drawn whole wherever nothing writes --p
  assert.match(RULES.find((r) => r.selectors[0] === "@property --p").body, /initial-value:\s*1\b/);
  const u = /initial-value:\s*([-\d.]+)/.exec(RULES.find((r) => r.selectors[0] === "@property --u").body)[1];
  const world = RULES.find((r) => r.selectors.includes(".world") && /--u:/.test(r.body));
  assert.equal(/--u:\s*([-\d.]+)/.exec(world?.body ?? "")?.[1], u, ".world starts --u where the registration does");
});

test("every rule that reads --u or --e is on an element worlds.js writes them on", () => {
  assert.ok(U_READERS.length >= 2, "worlds.js lists the elements it writes --u on (U_READERS)");
  let checked = 0;
  for (const { selectors, body } of [...RULES, ...FIX_RULES]) {
    if (!/var\(--[ue]\)/.test(body)) continue;
    for (const s of selectors) {
      checked++;
      assert.ok(onReader(s, U_READERS), `"${s}" reads --u or --e, but worlds.js does not write them there (U_READERS)`);
    }
  }
  assert.ok(checked >= 3, "the rules that read --u and --e were found");
  assert.match(JS, /setProperty\("--e"/);
});

test("every rule that reads --p is on a [data-p] element", () => {
  assert.deepEqual(P_READERS, [["[data-p]"]]);
  const sheets = [CSS, ...readdirSync(path.join(ROOT, "assets")).filter((f) => f.endsWith(".css")).map((f) => strip(read(`assets/${f}`)))];
  let checked = 0;
  for (const { selectors, body } of [...sheets.flatMap(rules), ...FIX_RULES]) {
    if (!/var\(--p[,)]/.test(body)) continue;
    for (const s of selectors) {
      checked++;
      assert.ok(onReader(s, P_READERS), `"${s}" reads --p, but --p is written only on [data-p] elements`);
    }
  }
  assert.ok(checked >= 2, "the fixture's figure rules were found");
});

test("no container of a world's contents is a reader", () => {
  for (const box of CONTAINERS) {
    assert.ok(![...U_READERS, ...P_READERS].some((r) => r.some((part) => has(part, box))), `${box} holds a world's contents, so writing on it every frame restyles all of them`);
  }
  // and no page marks one with data-p
  const pages = [FIXTURE, ...readdirSync(ROOT).filter((f) => f.endsWith(".html")).map(read)];
  for (const html of pages) {
    for (const m of html.matchAll(/<[a-z][^>]*\sdata-p(?=[\s>])[^>]*>/g)) {
      assert.ok(!/class="[^"]*\b(world|pin|copy)\b|data-stage(?=[\s>=])/.test(m[0]), `${m[0]} is a container marked data-p`);
    }
  }
});

test("html.pin never meets a rule for the pin element", () => {
  // <html> carries the class pin, so a rule whose first compound is a bare
  // .pin styles the root, or everything in the page (it made the whole page
  // a clipped, sticky 100svh box). Only a .pin with an ancestor is the element.
  for (const { selectors } of RULES) {
    for (const s of selectors) {
      if (s.startsWith("@") || s.startsWith(":is(")) continue;
      const first = s.split(/\s+|>|~|\+/).filter(Boolean)[0].replace(/:not\([^)]*\)/g, "");
      assert.ok(!/\.pin(?![\w-])/.test(first) || /^(html|:root)/.test(first), `"${s}" matches <html class="pin"> too; write .world > .pin`);
    }
  }
  assert.ok(!/closest\("\.pin"\)/.test(JS), "closest(\".pin\") finds <html> outside a pin");
  assert.ok(!/html\.js\b|:not\(\.js\)|classList\.(add|toggle)\("js"/.test(CSS + JS), "the pinned layout is html.pin now");
});

test("the engine and the boot snippet set html.pin on the same query", () => {
  const engine = /var PIN_QUERY = "([^"]+)"/.exec(JS)?.[1];
  assert.ok(engine, "worlds.js names its query PIN_QUERY");
  assert.match(JS, /pinned = !LOW && \w+\.matches && !printing/);
  const boot = /export const PIN_QUERY = "([^"]+)"/.exec(read("site/parts/boot.js"))?.[1];
  assert.equal(boot, engine, "site/parts/boot.js and worlds.js disagree on where the worlds are pinned");
  assert.ok(FIXTURE.includes(`matchMedia("${engine}")`), "the fixture's boot uses another query");
});

test("the router's pages are the site's inRouter pages", async () => {
  const { PAGES } = await import(path.join(ROOT, "site/site.js"));
  const want = PAGES.filter((p) => p.inRouter).map((p) => p.path).sort();
  const have = [...(/var PAGES = \{([^}]*)\}/.exec(JS)?.[1] ?? "").matchAll(/"([^"]+)":/g)].map((m) => m[1]).sort();
  assert.deepEqual(have, want);
});

test("the sky paints the engine's grounds, each in its --ground colour", () => {
  const grounds = JSON.parse(/var GROUNDS = (\[[^\]]*\])/.exec(SKY)[1].replace(/'/g, '"'));
  const engine = Object.entries(JSON.parse(/var GROUND = (\{[^}]*\})/.exec(JS)[1].replace(/(\w+):/g, '"$1":'))).sort((a, b) => a[1] - b[1]).map((e) => e[0]);
  assert.deepEqual(engine, grounds);
  assert.match(SKY, /"uTheme"/, "the sky takes the theme as a uniform");

  // the colour a reader sees most of, per ground: its --ground in tokens.css
  const tokens = read("assets/tokens.css");
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const light = { paper: /--bg:\s*(#[0-9a-f]{6})/.exec(tokens)[1] };
  const dark = { paper: /:root\[data-theme="dark"\]\s*\{[^}]*--bg:\s*(#[0-9a-f]{6})/.exec(tokens)[1] };
  for (const g of ["grid", "tides", "ember"]) {
    light[g] = new RegExp(`^\\[data-world="${g}"\\]\\s*\\{[^}]*--ground:\\s*(#[0-9a-f]{6})`, "m").exec(tokens)[1];
    dark[g] = new RegExp(`:root\\[data-theme="dark"\\] \\[data-world="${g}"\\]\\s*\\{[^}]*--ground:\\s*(#[0-9a-f]{6})`).exec(tokens)[1];
  }
  const MAIN = { paper: ["PAPER", "base"], grid: ["GRID", "top"], tides: ["TIDES", "deep"], ember: ["EMBER_GROUND", "base"] };
  for (const g of grounds) {
    const [name, key] = MAIN[g];
    const block = new RegExp(`var ${name} = \\{([\\s\\S]*?)\\n  \\};`).exec(SKY)[1];
    const pair = JSON.parse(new RegExp(`\\b${key}: (\\[\\[.*?\\]\\])`).exec(block)[1]);
    // the dark tides keep today's two-tone Atlantic, whose mean is the token
    const darkSky = g === "tides" ? pair[1].map((v, i) => (v + JSON.parse(/\bmid: (\[\[.*?\]\])/.exec(block)[1])[1][i]) / 2) : pair[1];
    for (const [theme, sky, token] of [["light", pair[0], light[g]], ["dark", darkSky, dark[g]]]) {
      hex(token).forEach((v, i) => assert.ok(Math.abs(v - sky[i]) <= 0.025, `${g} ${theme}: the sky's ${key} is not tokens.css's ${token}`));
    }
  }
});

test("nothing cut from the engine comes back", () => {
  const gone = ["actors", "SCENES", "shapeState", "drawShape", "drawWheel", "drawCoil", "drawCurve", "drawSession", "drawReleases", "drawKeepers", "drawFamily", "drawTimeline",
    "seedParticles", "updateParticles", "drawParticles", "stackOf", "markGone", "placeCaps", "mountRoom", "keptRoom", "toRoom",
    "in-room", "room-pinned", "foot-over", "flame-room", "flame.js", "flame-worker", "ChamaFlame", "themeMeta", "lastTheme"];
  for (const word of gone) {
    for (const [file, text] of [["worlds.js", JS], ["worlds.css", CSS], ["sky.js", SKY]]) {
      assert.ok(!new RegExp(`(?<![\\w-])${word.replace(/[.]/g, "\\.")}(?![\\w-])`).test(text), `${file} still mentions ${word}`);
    }
  }
  // the per-world text themes: colour is the theme's and the ground's (tokens.css)
  assert.ok(!/\[data-theme="(paper|grid|forge|night|tides|flame)"\]/.test(CSS));
  assert.ok(!/setAttribute\("data-theme"/.test(JS), "the engine never sets a theme");
  // and no colour of its own in worlds.css
  assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(CSS), "worlds.css writes a colour; take it from tokens.css");
  assert.ok(existsSync(path.join(ROOT, "assets/tokens.css")));
});

test("a stage's controls are delegated from document, and low motion stops autoplay and the router", () => {
  for (const attr of ["data-stage-action", "data-stage-seek", "data-stage-still", "data-stage-step", "data-stage-count", "data-delay", "data-duration", "data-motion-toggle"]) assert.ok(JS.includes(attr), `worlds.js handles ${attr}`);
  for (const state of ["idle", "playing", "paused", "ended"]) assert.ok(JS.includes(`"${state}"`), `a stage can be ${state}`);
  assert.match(JS, /document\.addEventListener\("click", function \(e\) \{\n\s*var b = e\.target\.closest && e\.target\.closest\("\[data-stage-action\], \[data-stage-seek\], \[data-stage-step\]"\)/);
  assert.match(JS, /if \(!LOW && window\.fetch/, "the router is off in low motion");
  assert.match(JS, /var GL = !LOW &&/, "no WebGL in low motion");
  assert.match(CSS, /html\[data-motion="low"\] \[data-stage-action\]/, "low motion hides play, pause and replay");
});

test("two sections in a row on the same ground do not burn into each other", () => {
  // the fire line's position (b) is only ever set when the grounds differ
  const state = /function scrollState\(\) \{([\s\S]*?)\n  \}/.exec(JS)[1];
  const sets = [...state.matchAll(/^\s*(.*)\bb = (?!0[,;])/gm)].map((m) => m[1]);
  assert.ok(sets.length >= 1, "scrollState sets b");
  for (const before of sets) assert.match(before, /if \(worldOf\[i\] !== worldOf\[i \+ 1\]\)/, "b is set without checking the grounds differ");
});

test("the one-column padding on a pin leaves out a world that pads itself (data-pad=\"off\")", () => {
  let checked = 0;
  for (const { selectors, body } of RULES) {
    if (!/(^|;)\s*padding(-top|-bottom|-inline)?\s*:/.test(body)) continue;
    for (const s of selectors) {
      if (!/\.world[^,]*\) > \.pin$/.test(s) || !s.startsWith(":is(")) continue;
      checked++;
      assert.match(s, /:not\(\[data-pad="off"\]\) > \.pin$/, `"${s}" pads a pin that asked for none`);
    }
  }
  assert.ok(checked >= 3, "the column's padding rules were found");
});

test("the router tells the page's other scripts when a new <main> is in place and measured", () => {
  const go = /function go\(u, push\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  const at = (needle) => go.indexOf(needle);
  assert.ok(at('dispatchEvent(new CustomEvent("chama:swapped"))') > 0, "go() dispatches chama:swapped");
  for (const before of ["swap(doc)", "bind()", "resize()"]) assert.ok(at(before) >= 0 && at(before) < at("chama:swapped"), `chama:swapped comes before ${before}`);
});

test("a stage's step buttons are marked at the ends with aria-disabled, never disabled", () => {
  assert.match(JS, /setAttribute\("aria-disabled", "true"\)/);
  assert.ok(!/\.disabled = |setAttribute\("disabled"/.test(JS), "disabled takes the button out of the focus order");
});

test("every pinned world on a built page sets --h, its hold", async () => {
  // without --h a pinned world has no hold and its words never become
  // readable (the home page had three); worlds.css falls back to 150, but the
  // page should say how long each world holds
  const { PAGES } = await import(path.join(ROOT, "site/site.js"));
  const built = PAGES.map((p) => p.file).filter((f) => existsSync(path.join(ROOT, f)));
  assert.ok(built.length >= 1, "no built page was found");
  for (const file of built) {
    for (const [tag] of read(file).matchAll(/<section\b[^>]*\bclass="[^"]*\bworld\b[^"]*"[^>]*>/g)) {
      if (/\sdata-pin="off"/.test(tag)) continue;
      assert.match(tag, /\sstyle="[^"]*--h:\s*\d/, `${file}: ${tag} is pinned with no --h`);
    }
  }
});

test("the char line marks only a change of ground, and only where there is no sky", () => {
  const rule = RULES.find((r) => { const sel = r.selectors.join(","); return sel.includes("::before") && sel.startsWith("html:not(.gl)") && /var\(--accent\)/.test(r.body); });
  assert.ok(rule, "worlds.css draws the char line");
  const sel = rule.selectors.join(",");
  assert.match(sel, /^html:not\(\.gl\):not\(\.pin\)/);
  for (const g of ["paper", "grid", "tides", "ember"]) assert.ok(sel.includes(`.world[data-world="${g}"] + .world:not([data-world="${g}"])`), `no char line after ${g}`);
  assert.match(rule.body, /top:\s*-64px/);
});

