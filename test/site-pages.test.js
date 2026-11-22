// The page list the "Talk to us" agent links from. The agent may only send a
// visitor to a page that is live, so "live" here has to agree with what the
// deployment actually serves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { PAGES, livePages, pageUrl, isLiveSiteUrl, sitePagesForPrompt } from "../lib/site-pages.js";
import { SYSTEM_PROMPT } from "../api/chat-prompt.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vercel = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));

// cleanUrls serves /x from x.html or x/index.html; a rewrite serves it from
// whatever its destination names.
function served(pagePath) {
  if (pagePath === "/") return existsSync(path.join(ROOT, "index.html"));
  const rel = pagePath.slice(1);
  if (existsSync(path.join(ROOT, `${rel}.html`))) return true;
  if (existsSync(path.join(ROOT, rel, "index.html"))) return true;
  return (vercel.rewrites || []).some(
    (rule) => rule.source === pagePath && existsSync(path.join(ROOT, `${rule.destination.slice(1)}.html`))
  );
}

function redirected(pagePath) {
  return (vercel.redirects || []).some((rule) => rule.source === pagePath && !rule.has);
}

test("every page has a path, a title and a line on what it covers", () => {
  const seen = new Set();
  for (const page of PAGES) {
    assert.match(page.path, /^\/[a-z0-9-]*$/, page.path);
    assert.ok(!seen.has(page.path), `${page.path} is listed twice`);
    seen.add(page.path);
    assert.ok(page.title && page.title.trim(), `${page.path} has no title`);
    assert.ok(page.covers && page.covers.length >= 20, `${page.path} says too little about what it covers`);
    assert.equal(typeof page.live, "boolean", `${page.path} must say whether it is live`);
  }
});

test("a page marked live is served and is not redirected away", () => {
  for (const page of livePages()) {
    assert.ok(served(page.path), `${page.path} is marked live but nothing serves it`);
    assert.ok(!redirected(page.path), `${page.path} is marked live but vercel.json redirects it`);
  }
});

// The reverse: a page that has landed must be switched on, or the agent
// never learns it exists.
test("a page that is served and not redirected is marked live", () => {
  for (const page of PAGES.filter((entry) => !entry.live)) {
    assert.ok(
      !served(page.path) || redirected(page.path),
      `${page.path} is served now: set live: true in lib/site-pages.js`
    );
  }
});

test("the prompt lists every live page by its full address and no page that is not live", () => {
  const section = sitePagesForPrompt();
  for (const page of PAGES) {
    const url = pageUrl(page.path);
    const listed = section.split("\n").some((line) => line.startsWith(`- ${url} `));
    assert.equal(listed, page.live, `${url} live=${page.live} but listed=${listed}`);
  }
  assert.ok(SYSTEM_PROMPT.includes(section), "the system prompt carries the page list");
});

test("only addresses of live pages count as links the agent may give", () => {
  assert.equal(isLiveSiteUrl("https://chamainteligente.com/"), true);
  assert.equal(isLiveSiteUrl("https://chamainteligente.com"), true);
  assert.equal(isLiveSiteUrl("chamainteligente.com/coaching"), true);
  assert.equal(isLiveSiteUrl("https://chamainteligente.com/coaching#members"), true);
  assert.equal(isLiveSiteUrl("https://chamainteligente.com/no-such-page"), false);
  for (const page of PAGES.filter((entry) => !entry.live)) {
    assert.equal(isLiveSiteUrl(pageUrl(page.path)), false, page.path);
  }
});

// A page added to the site but not to the list would stay invisible to the
// agent. Pages that are not for visitors to be sent to are named here.
const NOT_FOR_LINKING = new Set(["/404", "/admin", "/hearth-public", "/simple"]);

test("every page the site serves is in the list, or named as one not to link to", async () => {
  const { readdirSync } = await import("node:fs");
  const listed = new Set(PAGES.map((page) => page.path));
  const files = readdirSync(ROOT).filter((name) => name.endsWith(".html"));
  for (const file of files) {
    const pagePath = file === "index.html" ? "/" : `/${file.replace(/\.html$/, "")}`;
    if (NOT_FOR_LINKING.has(pagePath) || redirected(pagePath)) continue;
    assert.ok(listed.has(pagePath), `${file} is a page: add it to lib/site-pages.js`);
  }
});

test("only our own domain counts, not one that starts the same", () => {
  assert.equal(isLiveSiteUrl("https://chamainteligente.company/"), false);
  assert.equal(isLiveSiteUrl("https://chamainteligente.com.evil.example/"), false);
  assert.equal(isLiveSiteUrl("https://chamainteligente.com/coaching."), false);
  assert.equal(isLiveSiteUrl("https://chamainteligente.com/coaching?ref=x"), true);
});
