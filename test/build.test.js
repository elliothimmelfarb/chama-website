import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { build } from "../scripts/build.js";
import { readTree, stamp } from "../scripts/stamp.js";

test("every generated file on disk is exactly what npm run pages makes from site/ (edit site/, then npm run pages)", async () => {
  const built = await build();
  const tree = readTree();
  for (const [file, text] of built) tree.set(file, text);
  const stamped = stamp(tree);
  for (const file of built.keys()) {
    let onDisk;
    try {
      onDisk = readFileSync(file, "utf8");
    } catch {
      assert.fail(`${file} is missing. Run npm run pages.`);
    }
    assert.equal(onDisk, stamped.get(file) ?? built.get(file), `${file} differs from site/. Run npm run pages.`);
  }
});

test("the build is deterministic: two runs give the same files", async () => {
  const a = await build();
  const b = await build();
  assert.deepEqual([...a], [...b]);
});

test("llms.txt names every page by its own title and summary", async () => {
  const llms = (await build()).get("llms.txt");
  const rows = [...llms.matchAll(/^- \[([^\]]+)\]\((\S+)\): (.*)$/gm)].filter((m) => !m[2].endsWith("llms-full.txt"));
  assert.ok(rows.length >= 8);
  for (const [, title, href, summary] of rows) {
    assert.ok(summary.length > 40, `${href} has no summary`);
    assert.equal(title === "Home", href === "https://chamainteligente.com/", `${href} is titled ${title}`);
  }
});

// Vercel runs a package.json "build" script on every deploy, and scripts/
// is not uploaded (.vercelignore), so a script named build fails the deploy
// (2026-11-16). The pages are built here and committed.
test("package.json has no build script for Vercel to run", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts.build, undefined);
});
