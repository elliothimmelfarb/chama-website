import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Replacing the check script once dropped `evals:conversations` while the
// README still told people to run it.
test("every npm script the README and CLAUDE.md name exists in package.json", () => {
  const { scripts } = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const docs = ["README.md", "CLAUDE.md"].map((f) => readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  const named = new Set([...docs.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1]));
  assert.ok(named.size >= 3);
  for (const name of named) assert.ok(scripts[name], `npm run ${name} is documented but not in package.json`);
});
