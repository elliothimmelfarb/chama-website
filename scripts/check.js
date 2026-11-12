import { execFileSync, spawnSync } from "node:child_process";

const DIRS = ["api", "lib", "assets", "evals", "test", "scripts"];

const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "--", ...DIRS],
  { encoding: "utf8" },
)
  .split("\n")
  .filter((f) => /\.(js|mjs)$/.test(f));

const run = (args) => {
  const { status } = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (status !== 0) process.exit(status ?? 1);
};

for (const f of files) run(["--check", f]);
run(["--test", ...files.filter((f) => f.endsWith(".test.js"))]);
