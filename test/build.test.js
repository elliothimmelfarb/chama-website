import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { build } from "../scripts/build.js";
import { readTree, stamp } from "../scripts/stamp.js";

test("every generated file on disk is exactly what npm run build makes from site/ (edit site/, then npm run build)", async () => {
  const built = await build();
  const tree = readTree();
  for (const [file, text] of built) tree.set(file, text);
  const stamped = stamp(tree);
  for (const file of built.keys()) {
    let onDisk;
    try {
      onDisk = readFileSync(file, "utf8");
    } catch {
      assert.fail(`${file} is missing. Run npm run build.`);
    }
    assert.equal(onDisk, stamped.get(file) ?? built.get(file), `${file} differs from site/. Run npm run build.`);
  }
});

test("the build is deterministic: two runs give the same files", async () => {
  const a = await build();
  const b = await build();
  assert.deepEqual([...a], [...b]);
});
