import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { problems, readTree, stamp, versionOf } from "../scripts/stamp.js";

const tree = (entries) => new Map(Object.entries(entries));

test("every script and stylesheet address in the site carries its file's version (npm run stamp fixes this)", () => {
  assert.deepEqual(problems(readTree()), []);
});

test("a change deep in the chain reaches every file that leads to it", () => {
  const files = tree({
    "assets/flame.js": "fire",
    "assets/flame-worker.js": 'importScripts("/assets/flame.js");',
    "assets/agent.js": 'new Worker("/assets/flame-worker.js?v=0000000000");',
    "index.html": '<script src="/assets/agent.js"></script>'
  });
  const once = stamp(files);
  assert.deepEqual(problems(once), []);
  const worker = once.get("assets/flame-worker.js");
  assert.equal(worker, `importScripts("/assets/flame.js?v=${versionOf("fire")}");`);
  assert.match(once.get("index.html"), new RegExp(`agent\\.js\\?v=${versionOf(once.get("assets/agent.js"))}"`));

  const changed = stamp(new Map(once).set("assets/flame.js", "more fire"));
  for (const file of ["assets/flame-worker.js", "assets/agent.js", "index.html"]) assert.notEqual(changed.get(file), once.get(file), file);
});

test("stamping a stamped tree changes nothing", () => {
  const once = stamp(tree({ "assets/a.css": "a {}", "a.html": "<link href='/assets/a.css'>" }));
  assert.deepEqual([...stamp(once)], [...once]);
});

test("files that ask for each other are refused, naming them", () => {
  const files = tree({ "assets/a.js": '"/assets/b.js"', "assets/b.js": '"/assets/a.js"' });
  assert.throws(() => stamp(files), /assets\/a\.js.*assets\/b\.js|assets\/b\.js.*assets\/a\.js/);
});

test("each wrong address is named with its file", () => {
  const files = tree({
    "assets/a.js": "a",
    "page.html": [
      '<script src="/assets/a.js"></script>',
      '<script src="/assets/a.js?v=0123456789"></script>',
      '<script src="/assets/gone.js?v=0123456789"></script>',
      "<script src=/assets/a.js></script>",
      '<script src="assets/a.js"></script>',
      '<link rel="stylesheet" href="/assets/a.css.map">'
    ].join("\n"),
    "assets/b.js": 'load("/assets/" + name + ".js");',
    "assets/c.js": 'load("/assets/hearth-" + name + ".js");',
    "assets/d.js": 'importScripts("flame.js"); new Worker(src);',
    "page.test.js": 'read("/assets/a.js");'
  });
  assert.deepEqual(problems(files), [
    "page.html: /assets/a.js has no version.",
    `page.html: /assets/a.js carries v=0123456789, but the file is v=${versionOf("a")}.`,
    "page.html: /assets/gone.js does not exist, or is not added to git.",
    "page.html: /assets/a.js is not a quoted address, so it cannot carry a version.",
    "page.html: assets/a.js is a relative address. Write it from the root, /assets/..., so it can carry its version.",
    "assets/b.js: puts an /assets/ address together at run time. Write each address out whole, so it can carry its version.",
    "assets/c.js: puts an /assets/ address together at run time. Write each address out whole, so it can carry its version.",
    "assets/d.js: importScripts(\"flame.js\") does not start a quoted /assets/ address, so it cannot carry a version.",
    "assets/d.js: new Worker(src) does not start a quoted /assets/ address, so it cannot carry a version."
  ]);
});

// A symlink could point anywhere on the machine that runs the stamp, and a
// file nobody has added to git is not deployed: neither is part of the tree.
test("the tree is the committed files, never a symlink or an untracked file", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "stamp-"));
  const outside = mkdtempSync(path.join(tmpdir(), "outside-"));
  writeFileSync(path.join(outside, "x.js"), 'load("/assets/a.js");');
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "assets/a.js"), "a");
  symlinkSync(path.join(outside, "x.js"), path.join(dir, "assets/link.js"));
  const git = (...args) => execFileSync("git", args, { cwd: dir });
  git("init", "-q");
  git("add", "assets/a.js", "assets/link.js");
  writeFileSync(path.join(dir, "assets/new.js"), "not added");
  assert.deepEqual([...readTree(dir).keys()], ["assets/a.js"]);
});

// vercel.json caches a ?v= address for a year only when v is a version in
// this tree. Any other v (one worked out from the public repo before its
// deploy, or an old one) is revalidated, so it never pins a body for a year.
test("the year-long cache is given only to versions in this tree", () => {
  const config = JSON.stringify({ headers: [{ source: "/(.*)", headers: [] }] }, null, 2) + "\n";
  const once = stamp(tree({ "assets/a.js": "a", "assets/b.css": "b {}", "vercel.json": config }));
  const rules = JSON.parse(once.get("vercel.json")).headers.filter((r) => r.source === "/assets/(.*)\\.(js|css)");
  const versions = [versionOf("a"), versionOf("b {}")].sort();
  const cache = (r) => r.headers.find((h) => h.key === "Cache-Control").value;
  assert.deepEqual(rules.map((r) => [r.has?.[0].value ?? "missing", cache(r)]), [
    [{ inc: versions }, "public, max-age=31536000, immutable"],
    [{ ninc: versions }, "public, max-age=0, must-revalidate"],
    ["missing", "public, max-age=0, must-revalidate"],
  ]);
  assert.deepEqual(problems(once), []);
  assert.deepEqual([...stamp(once)], [...once]);
  assert.deepEqual(problems(new Map(once).set("assets/a.js", "changed")).filter((p) => p.startsWith("vercel.json")), [
    "vercel.json: the asset cache rules list other versions than the tree's. Run npm run stamp.",
  ]);
});
