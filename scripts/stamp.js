// Every script and stylesheet under /assets is asked for by an address that
// carries a hash of its contents, "/assets/worlds.js?v=0123456789", and that
// address is cached for a year (vercel.json). The README's "Caching" section
// says why. Run `npm run stamp` after changing anything in assets/ or a page:
// it rewrites the versions in place and leaves a correct tree untouched.
// `npm run check` fails while any address is missing its version or carries
// a wrong one.
//
// A file's hash covers the versions it carries itself, so a change to
// flame.js also changes flame-worker.js (which imports it), agent.js (which
// starts the worker), worlds.js and the pages. That is why stamping repeats
// until nothing moves.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// An address as a quoted literal, with or without its version.
const ADDRESS = /(["'])\/assets\/([\w./-]+?\.(?:js|css))(?:\?v=([^"']*))?\1/g;
// Any mention of a script or stylesheet under /assets, quoted or not.
const MENTION = /\/assets\/[\w./-]+?\.(?:js|css)\b/g;
// An address put together at run time, which no stamp can reach.
const BUILT = /["'`]\/assets\/["'`]?\s*\+|`\/assets\/[^`]*\$\{/;

export const versionOf = (text) => createHash("sha256").update(text).digest("hex").slice(0, 10);

// The files that ask for assets: every page, the assets themselves, and the
// server code (none of which builds an address today). Tests are left out,
// since they name assets as paths to read.
export function isReferrer(file) {
  if (file.endsWith(".test.js") || file.startsWith("docs/") || file.startsWith("node_modules/")) return false;
  if (file.endsWith(".html")) return true;
  if (/^assets\/.+\.(js|css)$/.test(file)) return true;
  return /^(api|lib)\/.+\.js$/.test(file);
}

const isAsset = (file) => /^assets\/.+\.(js|css)$/.test(file);

function restamp(text, files) {
  return text.replace(ADDRESS, (whole, quote, name) => {
    const target = files.get("assets/" + name);
    return target === undefined ? whole : `${quote}/assets/${name}?v=${versionOf(target)}${quote}`;
  });
}

// files: Map of repo-relative path to contents. Returns a new Map with every
// address carrying its target's version.
export function stamp(files) {
  const out = new Map(files);
  for (let pass = 0; pass <= out.size; pass++) {
    const moved = [];
    for (const [file, text] of out) {
      if (!isReferrer(file)) continue;
      const next = restamp(text, out);
      if (next !== text) {
        out.set(file, next);
        moved.push(file);
      }
    }
    if (!moved.length) return out;
    if (pass === out.size) throw new Error(`These files ask for each other, so their versions never settle: ${moved.join(", ")}`);
  }
  return out;
}

// One line per address that is wrong, each naming its file.
export function problems(files) {
  const found = [];
  for (const [file, text] of files) {
    if (!isReferrer(file)) continue;
    if (BUILT.test(text)) found.push(`${file}: puts an /assets/ address together at run time. Write each address out whole, so it can carry its version.`);
    const quoted = new Set();
    for (const m of text.matchAll(ADDRESS)) {
      const [, , name, given] = m;
      quoted.add(m.index + 1);
      const target = files.get("assets/" + name);
      if (target === undefined) found.push(`${file}: /assets/${name} does not exist.`);
      else if (given === undefined) found.push(`${file}: /assets/${name} has no version.`);
      else if (given !== versionOf(target)) found.push(`${file}: /assets/${name} carries v=${given}, but the file is v=${versionOf(target)}.`);
    }
    for (const m of text.matchAll(MENTION)) {
      if (!quoted.has(m.index)) found.push(`${file}: ${m[0]} is not a quoted address, so it cannot carry a version.`);
    }
  }
  return found;
}

export function readTree(root = ROOT) {
  const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => f && (isReferrer(f) || isAsset(f)));
  const files = new Map();
  for (const f of listed) {
    try {
      files.set(f, readFileSync(path.join(root, f), "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const before = readTree();
  const after = stamp(before);
  const written = [];
  for (const [file, text] of after) {
    if (text !== before.get(file)) {
      writeFileSync(path.join(ROOT, file), text);
      written.push(file);
    }
  }
  console.log(written.length ? `Stamped ${written.join(", ")}` : "Every address already carries its version.");
  const left = problems(after);
  if (left.length) {
    console.error(left.join("\n"));
    process.exit(1);
  }
}
