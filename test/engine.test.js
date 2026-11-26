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
    "in-room", "room-pinned", "foot-over", "flame-room", "flame.js", "flame-worker", "ChamaFlame", "themeMeta", "lastTheme",
    // the old header's
    "data-motion-toggle", "markMotion", "headLift", "talkDrop", "head-compact", "past-hero", "last-world", "at-end",
    "offer-switch", "thumbOf", "placeThumb", "placeSwitches", "worlds-members", "nav-talk"];
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
  for (const attr of ["data-stage-action", "data-stage-seek", "data-stage-still", "data-stage-step", "data-stage-count", "data-delay", "data-duration"]) assert.ok(JS.includes(attr), `worlds.js handles ${attr}`);
  for (const state of ["idle", "playing", "paused", "ended"]) assert.ok(JS.includes(`"${state}"`), `a stage can be ${state}`);
  assert.match(JS, /document\.addEventListener\("click", function \(e\) \{\n\s*var b = e\.target\.closest && e\.target\.closest\("\[data-stage-action\], \[data-stage-seek\], \[data-stage-step\]"\)/);
  assert.match(JS, /if \(!LOW && window\.fetch/, "the router is off in low motion");
  assert.match(JS, /var GL = !LOW &&/, "no WebGL in low motion");
  assert.match(CSS, /html\[data-motion="low"\] \[data-stage-action\]/, "low motion hides play, pause and replay");
});

test("two sections in a row on the same ground do not blend into each other", () => {
  // the blend's position (b) is only ever set when the grounds differ
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

test("a change of ground is a hairline where there is no sky", () => {
  const rule = RULES.find((r) => { const sel = r.selectors.join(","); return sel.includes("::before") && sel.startsWith("html:not(.gl)") && /var\(--line-strong\)/.test(r.body); });
  assert.ok(rule, "worlds.css draws the hairline between grounds");
  const sel = rule.selectors.join(",");
  assert.match(sel, /^html:not\(\.gl\):not\(\.pin\)/);
  for (const g of ["paper", "grid", "tides", "ember"]) assert.ok(sel.includes(`.world[data-world="${g}"] + .world:not([data-world="${g}"])`), `no hairline after ${g}`);
  assert.match(rule.body, /height:\s*1px/);
  assert.ok(!/mask/.test(rule.body), "the hairline has no torn edge: the fire is gone (2026-11-16)");
});

test("one ground blends into the next without fire, and a page change is a short dissolve", () => {
  const main = /"void main\(\) \{",([\s\S]*?)\]\.join/.exec(SKY)[1];
  for (const fire of ["rim", "burned", "0.34, 0.2, 0.12", "1.0, 0.42, 0.1"]) assert.ok(!main.includes(fire), `the shader still draws the fire (${fire})`);
  assert.match(main, /smoothstep\(-0\.2/, "the edge between two grounds is soft, a fifth of the screen either side");
  const fade = +/var FADE = (\d+)/.exec(JS)?.[1];
  assert.ok(fade > 0 && fade <= 350, `the page change dissolves in at most 350ms (FADE is ${fade})`);
  assert.ok(!/var BURN\b/.test(JS), "the router's burn is gone");
  assert.ok(!/--wipe/.test(CSS) && !/--wipe/.test(JS), "nothing masks the new page behind a fire line");
});

test("after a router trip the header, the menu and the body name the new page", () => {
  const current = /function setCurrent\(path\) \{([\s\S]*?)\n  \}/.exec(JS)[1];
  assert.ok(current.includes('".top .nav-link, .menu-pages a"'), "setCurrent marks the header's pages and the menu's");
  const chrome = read("site/parts/chrome.js");
  assert.match(chrome, /class="nav-link"/, "the header's page links are .nav-link");
  assert.match(chrome, /class="menu-pages"/, "the menu's pages are under .menu-pages");
  assert.match(chrome, /<body data-page=/, "each page names itself on <body>");
  const swap = /function swap\(doc\) \{([\s\S]*?)\n  \}/.exec(JS)[1];
  assert.match(swap, /document\.body\.setAttribute\("data-page", doc\.body\.getAttribute\("data-page"\)\)/);
});

test("a rail button is named, from data-label or the section's first heading", () => {
  assert.match(JS, /sec\.getAttribute\("data-label"\) \|\| \(\(sec\.querySelector\("h1, h2, h3"\)/);
  assert.match(JS, /if \(!name\) li\.hidden = true;/);
});

test("if worlds.js never runs, the boot snippet takes html.pin back", () => {
  const boot = read("site/parts/boot.js");
  assert.match(boot, /if\(!d\.dataset\.engine\)d\.classList\.remove\("pin"\)/);
  assert.match(JS, /root\.dataset\.engine = "on";/);
  // set at the top, before anything that could stop the engine early
  assert.ok(JS.indexOf('root.dataset.engine = "on"') < JS.indexOf("if (!document.querySelector(\".world\")) return;"));
});

test("a leaving world's words stand still, each gone before the next words or its pin's edge reach it", () => {
  const r = RULES.find((x) => x.selectors.includes(".r") && /transform:/.test(x.body));
  assert.ok(r, "worlds.css styles .r");
  assert.match(r.body, /clamp\(0, var\(--u\) - 1, var\(--sx, 0\)\) \* var\(--pl, 0px\)/, "a .r gives back its pin's travel for the first --sx of the exit");
  const gone = /function goneOf\(k\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  const must = /function mustGo\([^)]*\) \{([\s\S]*?)\n  \}/.exec(JS)[1];
  assert.match(must, /len \+ next \* AH - foot - MEET_GAP \* AH/, "a word is gone before the next world's first words would reach it");
  assert.match(must, /edge = len - foot/, "its own pin's clipping edge reaches its foot");
  assert.match(must, /!ride \? Math\.min\(meet, edge\)/, "and a part with its world showing above it is gone by then, so nothing rides up across another part");
  assert.match(gone, /o\.foot <= b\.y \+ 1 && o\.l < b\.r && b\.l < o\.r/, "a part rides only where nothing of its world is above it");
  assert.match(gone, /mustGo\(/);
  assert.match(gone, /closest\("\.world > \.pin \.r"\)/, "a .r inside another takes the outer one's exit and does not stand on its own");
  assert.match(JS, /setVar\(el, "--sx"/, "measure() writes --sx");
  for (const v of ["--sx", "--pl"]) assert.match(CSS, new RegExp(`@property ${v} \\{[^}]*inherits: false`), `${v} is registered not to inherit, or a nested .r would move twice`);
  assert.match(JS, /setVar\(el, "--pl"/, "measure() writes --pl");
});

// A phone scrolls on its compositor, a frame or more ahead of any script, so
// a word held still by a translate written each frame rides up with the page
// and snaps back down: it shakes for the whole exit (Elliot, 2026-11-17: "a
// lot of things bouncing up and down" on home). Where the scroll can drive
// an animation, the hold is one, on the root's scroll timeline, and the
// frame writes no position for it.
test("where the scroll can drive it, a leaving word is held still by the scroll itself, not by a frame", () => {
  assert.match(JS, /CSS\.supports\("animation-timeline: scroll\(\)"\)/, "the engine asks whether the scroll can drive an animation");
  const sup = /@supports \(animation-timeline: scroll\(\)\) \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
  assert.match(sup, /\.r\[data-stand\][^{]*\{[^}]*animation:\s*stand linear both;[^}]*animation-timeline:\s*scroll\(root\);[^}]*animation-range:\s*var\(--rel\) calc\(var\(--rel\) \+ var\(--stand\)\)/, "a standing .r runs `stand` over its stretch of the root's scroll");
  assert.match(CSS, /@keyframes stand \{\s*from \{ translate: 0 0; \}\s*to \{ translate: 0 var\(--stand\); \}\s*\}/, "and gives back exactly the pin's travel over it");
  const measure = /function measure\(\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  const setStand = /function setStand\([^)]*\) \{([\s\S]*?)\n  \}\n/.exec(JS)?.[1] ?? "";
  for (const v of ["--stand", "--rel"]) assert.match(setStand, new RegExp(`setVar\\(el, "${v}"`), `measure() writes ${v} once per layout`);
  assert.match(measure, /setStand\(el, x, tops\[k\] \+ hs\[k\] - pins\[k\], pins\[k\], moved\)/, "the stretch starts where the sticky pin lets go");
  assert.match(setStand, /toggleAttribute\("data-stand", !!x\)/, "a word that stands is marked, or the animation never applies");
  // test/shots' "grows 56px in its first frame" holds this in a browser
  assert.match(measure, /moved\.forEach\(function \(el\) \{\s*el\.getAnimations\(\)\.forEach\(function \(a\) \{ if \(a\.animationName === "stand"\) a\.play\(\); \}\);/, "a stand that moved makes Chrome read its range again");
  for (const v of ["--rel", "--stand"]) assert.match(CSS, new RegExp(`@property ${v} \\{[^}]*inherits: false`), `${v} is registered not to inherit, or a figure box restyles its subtree`);
  // the router's rise must not replace the stand (Back can land in its stretch)
  assert.ok(RULES.some((x) => x.selectors.some((t) => t.startsWith("html.nav-enter") && t.includes("[data-stand]")) && /animation-composition:\s*replace, add/.test(x.body) && /scroll\(root\)/.test(x.body)), "a standing word keeps its stand while it rises in");
  assert.match(/function shiftOf\(el\) \{([\s\S]*?)\n  \}/.exec(JS)?.[1] ?? "", /cs\.translate/, "a measure taken past a stretch subtracts the stand too, or every stand is measured from where it stands");
  const frame = /function frame\(now\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1] + /function setU\([^)]*\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.ok(!/--stand|--rel|data-stand|--sx|--pl/.test(frame), "no frame writes the hold");
  // in one column, and where the router's rise is playing, nothing stands
  assert.ok(RULES.some((x) => x.selectors.includes("html:not(.pin) .r") && /animation:\s*none/.test(x.body)), "a word stops standing when the layout leaves pinned (print keeps data-stand)");
});

// /build's devices stood still through a translate that drawDevices wrote
// each frame, so on a composited scroll the last thing (Alves Teamware)
// rode up 25px with the page and snapped back as its pin let go (Elliot,
// 2026-11-20: "jiggles and bounces before going to the next page"). The
// stage now stands the way a word does, and the frame writes only its fade
// and its lift, on a property the stand does not use.
test("where the scroll can drive it, /build's devices stand on the scroll itself, not from a frame", () => {
  const sup = /@supports \(animation-timeline: scroll\(\)\) \{([\s\S]*?)\n\}/.exec(CSS)?.[1] ?? "";
  const stand = /([^{}]+)\{[^}]*animation:\s*stand linear both;[^}]*animation-timeline:\s*scroll\(root\);[^}]*\}/.exec(sup)?.[1] ?? "";
  assert.ok(stand.split(",").map((s) => s.trim()).includes(".made-stage[data-stand]"), "the devices' stage runs `stand` over its stretch of the root's scroll");
  const measure = /function measure\(\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.match(measure, /ds = held\[k\] \? devStay\[k\][\s\S]*setStand\(D\.stage, ds, tops\[k\] \+ hs\[k\] - pins\[k\], pins\[k\], moved\)/, "measure() writes where the devices' pin lets go and how far the stage stands past it, from the devices' own stay, and marks it");
  const frame = /function frame\(now\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  const call = /drawDevices\(sections\[i\], l, ts, [^;]*\);/.exec(frame)?.[0] ?? "";
  assert.match(call, /SCROLL_DRIVEN \? 0 :/, "the frame passes the stand only where the scroll cannot drive it");
  const draw = /function drawDevices\([^)]*\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.match(draw, /put\(D\.stage, "transform", /, "the lift goes on transform, which the stand's animation does not override");
  const gone = /function goneOf\(k\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.match(gone, /dSh = shiftOf\(D\.stage\)/, "a measure taken past the stretch reads the devices from their place, not from where they stand");
  assert.ok(RULES.some((x) => x.selectors.includes("html:not(.pin) .made-stage") && /animation:\s*none/.test(x.body)), "the stage stops standing when the layout leaves pinned");
});

// ---- the motion system: six named moves ----------
const TOKENS = strip(read("assets/tokens.css"));
const rootVar = (css, name) => new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
const STAGGER_MAX = +(/\bSTAGGER_MAX = (\d+)/.exec(JS)?.[1] ?? NaN);
// a time in a rule, in ms, with the tokens and the engine's longest --i put in
function timeMs(expr) {
  const e = expr.replace(/var\(--i, 0\)/g, String(STAGGER_MAX)).replace(/var\((--[\w-]+)\)/g, (_, n) => rootVar(TOKENS, n) ?? rootVar(CSS, n) ?? n).trim();
  const unit = (u) => (u === "s" ? 1000 : 1);
  const calc = /^calc\(([\d.]+)\s*\*\s*([\d.]+)(m?s)\)$/.exec(e);
  if (calc) return +calc[1] * +calc[2] * unit(calc[3]);
  const t = /^([\d.]+)(m?s)$/.exec(e);
  return t ? +t[1] * unit(t[2]) : NaN;
}
const words = (v) => v.match(/(?:[^\s(]+|\([^)]*\))+/g) ?? [];
// A rule's animation lists with the entries on a scroll timeline left out:
// those have no time (linear is the scroll itself), and the rest keep theirs.
const topList = (v) => v.split(/,(?![^(]*\))/).map((x) => x.trim());
function timedOnly(body) {
  const tl = /animation-timeline:([^;]+)/.exec(body);
  if (!tl) return body;
  const keep = topList(tl[1]).map((t) => !/^scroll\(/.test(t));
  if (keep.every(Boolean)) return body;
  if (!keep.some(Boolean)) return "";
  return body.replace(/(animation(?:-[a-z]+)?):([^;]+)/g, (m, prop, v) => {
    const parts = topList(v);
    return parts.length === keep.length ? `${prop}: ${parts.filter((_, i) => keep[i]).join(", ")}` : m;
  });
}

test("the new page's words have finished rising before .nav-enter comes off", () => {
  const enter = +/var FADE = \d+, ENTER = (\d+)/.exec(JS)[1];
  let longest = 0;
  for (const { selectors, body: all } of RULES) {
    if (!selectors.some((x) => x.startsWith("html.nav-enter"))) continue;
    const body = timedOnly(all);
    const a = /animation:([^;]+)/.exec(body);
    const d = /animation-delay:([^;]+)/.exec(body);
    if (!a && !d) continue;
    // a rule that only staggers the rise takes the rise's duration
    const times = a ? words(a[1].replace(/var\(--ease[\w-]*\)/g, "")).map(timeMs).filter((n) => !Number.isNaN(n)) : [timeMs("var(--dur-arrive-ui)")];
    const delay = d ? timeMs(d[1]) : times[1] ?? 0;
    assert.ok(times.length >= 1 && !Number.isNaN(delay), `${selectors[0]}: its timing could not be read`);
    longest = Math.max(longest, times[0] + delay);
  }
  assert.ok(longest > 0, "the .nav-enter animations were found");
  assert.ok(enter >= longest, `ENTER (${enter}ms) ends before the longest .nav-enter animation (${longest}ms)`);
});

const SOURCES = readdirSync(path.join(ROOT, "site/pages")).filter((f) => f.endsWith(".js")).map((f) => [`site/pages/${f}`, read(`site/pages/${f}`)]);
const BUILT = readdirSync(ROOT).filter((f) => f.endsWith(".html")).map((f) => [f, read(f)]);

test("words arrive on one scale: --arrive-at, --arrive-k, --stagger and the figure's --fig-at", () => {
  for (const [name, want] of [["--arrive-at", "-0.6"], ["--arrive-k", "4"], ["--stagger", "0.05"], ["--fig-at", "-0.4"]]) {
    assert.equal(rootVar(CSS, name), want, `worlds.css :root sets ${name}`);
  }
  for (const name of ["--rise", "--lift", "--dur-arrive-ui", "--dur-leave", "--dur-swap-in", "--dur-swap-out", "--swap-gap", "--stagger-ms"]) {
    assert.ok(rootVar(TOKENS, name), `tokens.css sets ${name}`);
  }
  const r = RULES.find((x) => x.selectors.length === 1 && x.selectors[0] === ".r");
  assert.match(r.body, /--in:\s*calc\(var\(--arrive-at\) \+ var\(--i, 0\) \* var\(--stagger\)\)/, "a word's arrival is its place in the ladder");
  assert.match(r.body, /--k:\s*var\(--arrive-k\)/);
  assert.match(r.body, /var\(--t\) \* \(2 - var\(--t\)\)/, "the arrival eases out");
  assert.match(r.body, /var\(--rise\)/);
  assert.match(r.body, /var\(--lift\)/);
  assert.ok(!/\d+px/.test(r.body.replace(/var\(--pl, 0px\)/, "")), ".r takes its distances from tokens");
  const fig = RULES.find((x) => x.selectors.some((s) => /^\.r\.fig$|^\.fig\.r$/.test(s)));
  assert.match(fig?.body ?? "", /--in:\s*max\(var\(--fig-at\), calc\(var\(--arrive-at\) \+ var\(--i, 0\) \* var\(--stagger\)\)\)/, "a figure box arrives after the words, and no earlier than --fig-at");
  // the shade behind the words comes in with the first of them
  const shade = RULES.find((x) => x.selectors.includes(".pin-shade") && /opacity/.test(x.body));
  assert.match(shade.body, /var\(--arrive-at\)/);
});

test("the engine writes each word's place, --i, and no page does", () => {
  assert.equal(STAGGER_MAX, 5);
  assert.match(JS, /setVar\([^)]*"--i"/, "worlds.js writes --i");
  // a figure may use --i inside itself; a word (.r) never sets its own
  for (const [file, text] of [...SOURCES, ...BUILT]) {
    for (const [tag] of text.matchAll(/<[a-z][^>]*\bclass="[^"]*\br\b[^"]*"[^>]*>/g)) assert.ok(!/--i\s*:/.test(tag), `${file}: ${tag} writes --i; the engine does`);
    assert.ok(!/\.r\b[^{}]*\{[^}]*--i\s*:/.test(text), `${file} sets a .r's --i in a rule; the engine does`);
  }
});

test("a world leaves as one: one start, a short stagger, one span", () => {
  for (const [name, want] of [["EXIT_AT", 0.12], ["EXIT_SPAN", 0.2], ["EXIT_STAGGER", 0.03]]) {
    assert.equal(+(new RegExp(`\\b${name} = ([\\d.]+)`).exec(JS)?.[1]), want, `worlds.js sets ${name}`);
  }
  for (const gone of ["EXIT_MIN", "STAY_MAX"]) assert.ok(!new RegExp(`\\b${gone}\\b`).test(JS), `${gone} gave each word its own exit`);
  const exitOf = /function exitOf\([^)]*\) \{([\s\S]*?)\n  \}/.exec(JS)[1];
  assert.match(exitOf, /EXIT_SPAN/, "every fade lasts EXIT_SPAN");
  const gone = /function goneOf\(k\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  const from = /function leaveFrom\([^)]*\) \{([\s\S]*?)\n  \}/.exec(JS)?.[1] ?? "";
  assert.match(from, /EXIT_AT/, "a world starts to leave at EXIT_AT after its release");
  assert.match(from, /arriveAt/, "or later, with the next world's arriving words, when that world scrolls in as flow");
  assert.match(gone, /leaveFrom\(/);
  assert.match(gone, /Math\.min\(own, by\[at\]\)/, "and a part leaves earlier only where its own guard needs it");
  assert.match(gone, /EXIT_STAGGER/, "and its words go in their order");
  assert.ok(!/ex \* ex/.test(JS), "/build's devices leave on the words' curve");
});

test("where a world must leave early, the next one's words come as it fades, never before they can be seen", () => {
  assert.equal(+(/ARRIVE_EARLIEST = (-[\d.]+)/.exec(JS)?.[1]), -0.85);
  const measure = /function measure\(\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.match(measure, /Math\.max\(ARRIVE_EARLIEST, /, "no earlier than ARRIVE_EARLIEST");
  assert.match(measure, /if \(want < base - 0\.001\) at = /, "and only ever earlier than the world's own arrival");
  assert.match(measure, /setVar\(pinOf\[k\], "--arrive-at", at\)/, "written once per layout on the pin, through setVar");
  assert.ok(!/setProperty\("--arrive-at"/.test(JS), "no frame writes --arrive-at");
});

test("a world's words arrive as they come into view, and the world before waits for them", () => {
  assert.equal(+(/SEEN = ([\d.]+)/.exec(JS)?.[1]), 0.9, "words count as seen once their top is 90% down the screen");
  const of = /function arriveOf\(k\) \{([\s\S]*?)\n  \}/.exec(JS)?.[1] ?? "";
  assert.match(of, /Math\.max\(arriveAt, firstWords\(k\) - SEEN\)/, "a world whose first words sit low on its pin arrives later, when they show");
  const from = /function leaveFrom\([^)]*\) \{([\s\S]*?)\n  \}/.exec(JS)?.[1] ?? "";
  assert.match(from, /arrives\[k \+ 1\]/, "the world before leaves on the next world's own arrival");
  const measure = /function measure\(\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.match(measure, /arrives = sections\.map/, "measured in the read phase");
  assert.match(measure, /var base = arrives\[k\]/, "and written on the pin when it differs from --arrive-at");
});

test("a leaving part waits for the next world's words only where they share its columns", () => {
  const boxes = /function nextBoxes\(k\) \{([\s\S]*?)\n  \}/.exec(JS)?.[1] ?? "";
  assert.match(boxes, /getBoundingClientRect/, "the next world's parts are measured with their columns");
  const over = /function nextOver\([^)]*\) \{([\s\S]*?)\n  \}/.exec(JS)?.[1] ?? "";
  assert.match(over, /o\.l < r && o\.r > l/, "only parts that overlap it horizontally count");
  const gone = /function goneOf\(k\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.match(gone, /mustGo\(len, b\.y, b\.foot, blend, nextOver\(/, "each part's guard reads the next world's top over its own columns");
});

// On a phone the parts are stacked, so a figure under standing words could
// not stand as long (the next words rise through it) and went half a screen
// early: home's "How we work" showed a heading alone over bare ground, worst
// when scrolling back up (Elliot, 2026-11-17). A stacked world now stands as
// one, as far as its least able part, then rides up as plain scroll.
// test/shots checks the result on every page ("stacked world split").
test("a world stacked in one column stands as one, then rides up whole", () => {
  const gone = /function goneOf\(k\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.match(gone, /stacked = stacked && box\.every\(function \(o\) \{ return o\.l < b\.r && b\.l < o\.r; \}\)/, "stacked: every part shares a column with every other");
  assert.match(gone, /stand = Math\.min\(stand, mustGo\(len, b\.y, b\.foot, blend, nextOver\(nb, b\.l, b\.r\), top, false\)\)/, "the shared stand is the least any part can stand without riding");
  assert.match(gone, /by\[j\] = whole \? \(b\.foot > len \? len - b\.foot : stand \+ b\.y - top\) : mustGo\(/, "then each part rides up and is gone before the header, or by its pin's edge if it reaches past it");
  assert.match(gone, /whole \? clamp\(stand \/ len\)/, "every part stands the same distance");
  assert.match(gone, /whole \? Math\.min\(own, first\) : own/, "and the shade goes with its first part");
  assert.match(gone, /whole: whole/, "goneOf reports it");
  const measure = /function measure\(\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.match(measure, /rides\[k\] = !!g\.whole && held\[k \+ 1\]/, "measure() keeps which worlds ride into a pinned one");
  assert.match(measure, /if \(rides\[k - 1\]\) want = Math\.max\(ARRIVE_EARLIEST, base - \(1 - SEEN\) - 1 \/ arriveK\)/, "after a riding world, the next words are whole as they come into view");
  assert.ok(!/RIDE_GAP/.test(JS), "no threshold decides it");
});

test("a settled reader is not written while its --u changes nothing", () => {
  const measure = /function measure\(\) \{([\s\S]*?)\n  \}\n/.exec(JS)[1];
  assert.match(measure, /settle\[k\] = /, "measure() works out, per reader, the stretch of --u in which its style cannot change");
  const set = /function setU\([^)]*\) \{([\s\S]*?)\n  \}/.exec(JS)[1];
  assert.match(set, /settle\[k\]/, "setU() holds a settled reader's --u at the start of that stretch");
  assert.match(set, /lastV\[k\]\[j\]/, "and writes --u only when the held value changes");
});

test("no page overrides the motion scale", () => {
  for (const [file, text] of [...SOURCES, ...BUILT]) {
    // .ef-now's --k is its own figure's variable, not a .r's
    assert.ok(!/--k\s*:\s*\d/.test(text), `${file} sets --k; the arrival has one speed`);
    assert.ok(!/--(in|out)\s*:[^;"]*!important/.test(text), `${file} forces --in or --out`);
    for (const m of text.matchAll(/style="[^"]*--in:\s*(-?[\d.]+)/g)) {
      assert.ok(+m[1] >= 0 && +m[1] <= 0.5, `${file}: --in ${m[1]} is outside the hold's beats (0 to 0.5)`);
    }
  }
});

test("timed moves in worlds.css use the motion tokens", () => {
  for (const { selectors, body } of RULES) {
    // the H1's two halves are their own focal entrance (base.css), replayed shorter after a page change
    if (selectors[0].startsWith("html.routed h1")) continue;
    for (const m of timedOnly(body).matchAll(/(?:transition|animation)(?:-[a-z]+)?:([^;]+)/g)) {
      assert.ok(!/cubic-bezier|\bease\b|\blinear\b|\d+m?s\b/.test(m[1].replace(/var\([^)]*\)/g, "").replace(/(?<![\d.])0s\b/g, "")), `${selectors[0]}: "${m[1].trim()}" names its own timing`);
    }
  }
  assert.equal(rootVar(CSS, "--press"), "scale var(--dur-press) var(--ease-out)");
});

test("after a page change every pinned word rises in, in its order", () => {
  const pinned = RULES.filter((x) => x.selectors.some((s) => s.startsWith("html.nav-enter main .world > .pin .r")));
  assert.ok(pinned.length, "the router's rise reaches the words of every pin");
  assert.ok(pinned.some((x) => /animation: rise var\(--dur-arrive-ui\) var\(--ease-out\)/.test(x.body)), "they rise on Arrive's time");
  assert.match(pinned.map((x) => x.body).join(""), /animation-delay:\s*calc\(var\(--i, 0\) \* var\(--stagger-ms\)\)/);
});


test("/build's opening stretch is the devices world's data-open, and its hold agrees", () => {
  // The H1 opens the devices world, so the stretch before the first thing
  // is short (data-open, in hundredths of a screen) and drawDevices reads it
  // from the section rather than a constant only that page could use.
  const intro = /function devicesIntro\(([^)]*)\) \{([^\n]*)\}/.exec(JS);
  assert.ok(intro, "worlds.js has devicesIntro");
  assert.match(JS, /getAttribute\("data-open"\)/, "the opening stretch comes from the section");
  assert.ok(!/devicesIntro\(n\)/.test(JS), "every caller passes the world's own opening");
  const html = read("build.html");
  const tag = /<section\b[^>]*\bdevices-world\b[^>]*>/.exec(html)[0];
  const open = +(/\sdata-open="(\d+)"/.exec(tag)?.[1]);
  const h = +(/--h:\s*(\d+)/.exec(tag)?.[1]);
  const n = (html.match(/<article class="made"/g) || []).length;
  assert.ok(open > 0 && open < 90, `the opening is shorter than a thing's stretch (${open})`);
  assert.equal(h, 100 + open + 135 * n, "--h is the pin, the opening and 135 for each thing");
});

// A [data-p][data-morph] path changes shape only through setProgress, so every
// place that writes --p must go through it, or the businesses stop growing in
// every browser while every other test still passes.
test("every write of --p goes through setProgress, which also writes a path's shape", () => {
  const body = (name) => {
    const at = JS.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `${name} is in worlds.js`);
    return JS.slice(at, JS.indexOf("\n  }\n", at));
  };
  const writes = [...JS.matchAll(/setProperty\("--p"/g)].map((m) => m.index);
  const sp = JS.indexOf("function setProgress(");
  const spEnd = JS.indexOf("\n  }\n", sp);
  assert.ok(writes.length > 0 && writes.every((i) => i > sp && i < spEnd), "--p is set only inside setProgress");
  for (const name of ["stageWrite", "setP", "layFlat"]) assert.match(body(name), /setProgress\(/, `${name} writes through setProgress`);
});

// A path that only changes shape reads no --p, and writing it every frame
// restyles it for nothing (pages.md, "Frame cost and scrolling").
test("setProgress writes --p only on an element whose style reads it", () => {
  const at = JS.indexOf("function setProgress(");
  const fn = JS.slice(at, JS.indexOf("\n  }\n", at));
  assert.match(fn, /var\\\(--p\\\)|--p\\\)/, "it checks the element's own style for var(--p)");
});

// Print shows each stage finished: a stage's readers carry an inline --p and
// a written d, so the print layout alone cannot reset them.
test("printing shows every stage complete, and the page returns to where it was", () => {
  const before = JS.slice(JS.indexOf('addEventListener("beforeprint"'), JS.indexOf("\n", JS.indexOf('addEventListener("beforeprint"')));
  const after = JS.slice(JS.indexOf('addEventListener("afterprint"'), JS.indexOf("\n", JS.indexOf('addEventListener("afterprint"')));
  assert.match(before, /stagesFor(Print|print)\(true\)/);
  assert.match(after, /stagesFor(Print|print)\(false\)/);
  const at = JS.indexOf("function stagesForPrint(");
  assert.ok(at >= 0);
  assert.match(JS.slice(at, JS.indexOf("\n  }\n", at)), /setProgress\(el, 1\)/);
});
