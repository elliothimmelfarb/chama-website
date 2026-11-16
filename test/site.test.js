// The public site as built from site/: every page exists and is reachable,
// asks no other host for anything, keeps the brand's rules, follows the
// visitor's theme from the first paint, and every old address still leads
// somewhere. test/build.test.js holds the files to their sources.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PAGES, SITE } from "../site/site.js";
import { BOOT } from "../site/parts/boot.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = (f) => readFileSync(path.join(ROOT, f), "utf8");
const built = PAGES.filter((p) => existsSync(path.join(ROOT, "site/pages", p.id + ".js")));
const html = Object.fromEntries(built.map((p) => [p.id, file(p.file)]));
const vercel = JSON.parse(file("vercel.json"));

// What a visitor reads: the page without scripts, styles, comments and tags.
const visible = (doc) =>
  doc
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");

test("every page in site/site.js has a source and a built file", () => {
  for (const p of PAGES) {
    assert.ok(existsSync(path.join(ROOT, "site/pages", p.id + ".js")), `site/pages/${p.id}.js is missing`);
    assert.ok(existsSync(path.join(ROOT, p.file)), `${p.file} is missing. Run npm run build.`);
  }
});

for (const p of built) {
  test(`${p.path} asks no other host for anything`, () => {
    const doc = html[p.id];
    const fetched = [
      ...doc.matchAll(/<(?:script|img|source|video|audio|iframe)\b[^>]*\s(?:src|poster)="([^"]+)"/g),
      ...doc.matchAll(/<link\b[^>]*rel="(?:stylesheet|preload|modulepreload|icon|apple-touch-icon)"[^>]*href="([^"]+)"/g),
      ...doc.matchAll(/url\(['"]?([^'")]+)/g),
      ...doc.matchAll(/srcset="([^"]+)"/g),
    ].flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+/)[0]));
    const away = fetched.filter((u) => /^(https?:)?\/\//.test(u) && !u.startsWith(SITE.origin));
    assert.deepEqual(away, []);
  });

  test(`${p.path} sets the visitor's theme and motion before any stylesheet`, () => {
    const doc = html[p.id];
    const boot = doc.indexOf(BOOT);
    assert.ok(boot > 0, "the boot snippet is missing or differs from site/parts/boot.js");
    assert.ok(boot < doc.indexOf('rel="stylesheet"'), "a stylesheet loads before the boot snippet");
    assert.match(doc, /<style>@media \(prefers-reduced-motion: no-preference\) \{ @view-transition \{ navigation: auto; \} \}<\/style>/);
  });

  test(`${p.path} keeps the brand's rules`, () => {
    const text = visible(html[p.id]);
    assert.ok(!/—/.test(html[p.id]), "an em dash");
    for (const retired of ["Your process, your words, your rules", "Your business, your rules", "whenever you ask", "intelligent flame is", "shrink-wrapped", "almost any"]) {
      assert.ok(!text.toLowerCase().includes(retired.toLowerCase()), `the retired line "${retired}"`);
    }
    // Pricing is a conversation; the price shape has no numbers.
    assert.ok(!/(€|\$|\bEUR\b|\bCAD\b|\bUSD\b)\s?\d/.test(text), "a price");
    assert.ok(!/(tel:|wa\.me|whatsapp\.com)/i.test(html[p.id]), "a phone or WhatsApp link");
    const emails = [...html[p.id].matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)].map((m) => m[0]).filter((e) => !e.endsWith(".webp") && !e.endsWith(".png"));
    assert.ok(emails.every((e) => e === "info@chamainteligente.com"), `an email address other than info@: ${emails}`);
    if (p.id !== "about") {
      assert.ok(!/\bShama\b/.test(text), `"Shama" outside About`);
      assert.ok(!/Rozalie/.test(text), "Rozalie named outside About");
    }
    if (!SITE.laMetalNamed) assert.ok(!/LA Metal/i.test(text), "LA Metal named while the flag is off");
  });

  test(`${p.path} has its own title, description and canonical`, () => {
    const doc = html[p.id];
    assert.match(doc, /<title>[^<]{10,}<\/title>/);
    assert.match(doc, /<meta name="description" content="[^"]{50,}">/);
    assert.ok(doc.includes(`<link rel="canonical" href="${SITE.origin}${p.path === "/404" ? "/404" : p.path}">`), "no canonical");
    assert.equal(/noindex/.test(/<meta name="robots" content="([^"]*)"/.exec(doc)[1]), !!p.noindex, "robots meta disagrees with site.js");
    JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(doc)[1]);
  });
}

test("the sitemap lists exactly the indexable pages", () => {
  const locs = [...file("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  assert.deepEqual(locs, PAGES.filter((p) => !p.noindex).map((p) => SITE.origin + p.path).sort());
});

test("no stylesheet or page writes a colour outside tokens.css", () => {
  const sheets = ["assets/base.css", "assets/talk.css"].filter((f) => existsSync(path.join(ROOT, f)));
  for (const f of sheets) assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/.test(file(f).replace(/\/\*[\s\S]*?\*\//g, "")), `${f} writes a colour`);
  for (const p of built) {
    for (const [, css] of html[p.id].matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      assert.ok(!/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/.test(css), `${p.file} writes a colour in its <style>`);
    }
  }
});

test("each @keyframes name is defined once across the shared stylesheets", () => {
  const names = ["assets/base.css", "assets/worlds.css", "assets/talk.css"]
    .filter((f) => existsSync(path.join(ROOT, f)))
    .flatMap((f) => [...file(f).matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i), []);
});

test("every old address redirects to a page that exists, in one step", () => {
  const pages = new Set(PAGES.map((p) => p.path));
  const sources = new Set(vercel.redirects.filter((r) => !r.has).map((r) => r.source));
  for (const old of ["/built", "/clients", "/work.html", "/simple", "/simple/coaching", "/simple/about", "/simple/built", "/simple/clients", "/training", "/worlds"]) {
    const r = vercel.redirects.find((x) => x.source === old || x.source === old.replace(/\.html$/, ""));
    if (old === "/work.html") continue; // cleanUrls serves /work
    assert.ok(r, `${old} has no redirect`);
    assert.ok(pages.has(r.destination), `${old} leads to ${r.destination}, which is not a page`);
    assert.ok(!sources.has(r.destination), `${old} redirects twice`);
  }
  for (const p of PAGES) assert.ok(!sources.has(p.path), `${p.path} is a page and a redirect source`);
});

test("the pages the old site served are gone, so nothing serves them before the redirects", () => {
  for (const f of ["built.html", "clients.html", "simple.html", "simple/coaching.html"]) assert.ok(!existsSync(path.join(ROOT, f)), `${f} still exists`);
});

// /hearth is two pages on one address: the public page for anyone without
// a session cookie, and the members' room for anyone with one.
test("/hearth serves the room only with the session cookie, and the public page otherwise", async () => {
  const { SESSION_COOKIE } = await import("../lib/hearth/auth.js");
  const forHearth = vercel.rewrites.filter((r) => r.source === "/hearth");
  assert.equal(forHearth.length, 2);
  const [room, pub] = forHearth;
  assert.deepEqual(room.has, [{ type: "cookie", key: SESSION_COOKIE }]);
  assert.equal(room.destination, "/hearth-room");
  assert.ok(!pub.has && !pub.missing);
  assert.equal(pub.destination, "/hearth-public");
  assert.ok(vercel.rewrites.some((r) => r.source === "/hearth/:path*" && r.destination === "/hearth-room"));
  assert.ok(!existsSync(path.join(ROOT, "hearth.html")), "a hearth.html would be served at /hearth before the rewrites");
});

test("/hearth is indexable without a session and the room's paths are not", () => {
  const robotsTag = (h) => h.headers.find((x) => x.key === "X-Robots-Tag");
  for (const h of vercel.headers.filter((x) => x.source === "/hearth")) {
    if (robotsTag(h)) assert.ok(h.has && h.has.some((c) => c.type === "cookie"));
  }
  assert.ok(vercel.headers.some((h) => h.source === "/hearth/(.*)" && robotsTag(h)));
  const robots = file("robots.txt");
  assert.ok(!/^Disallow: \/hearth\s*$/m.test(robots));
  assert.ok(/^Disallow: \/hearth\/$/m.test(robots));
});

test("every media kit file linked from /brand and llms.txt exists", () => {
  if (!html.brand) return;
  const links = [...new Set((html.brand + file("llms.txt")).match(/\/brand\/kit\/[\w.-]+/g) || [])];
  for (const link of links) assert.ok(existsSync(path.join(ROOT, link)), `${link} is missing`);
});
