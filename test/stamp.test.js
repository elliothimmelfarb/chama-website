import assert from "node:assert/strict";
import test from "node:test";

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
      "<script src=/assets/a.js></script>"
    ].join("\n"),
    "assets/b.js": 'load("/assets/" + name + ".js");',
    "page.test.js": 'read("/assets/a.js");'
  });
  assert.deepEqual(problems(files), [
    "page.html: /assets/a.js has no version.",
    `page.html: /assets/a.js carries v=0123456789, but the file is v=${versionOf("a")}.`,
    "page.html: /assets/gone.js does not exist.",
    "page.html: /assets/a.js is not a quoted address, so it cannot carry a version.",
    "assets/b.js: puts an /assets/ address together at run time. Write each address out whole, so it can carry its version."
  ]);
});
