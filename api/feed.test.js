import assert from "node:assert/strict";
import test from "node:test";

import { useClient } from "../lib/hearth/db.js";
import { fakeDb, makeRequest } from "../lib/hearth/test-helpers.js";
import { handleFeed, routeFor } from "./feed.js";

// A dummy connection string is enough: useClient means neon() is never called
// and ready() resolves without touching a database.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";

const HOST = "chamainteligente.com";

function post(overrides = {}) {
  return {
    id: "p1",
    slug: "2026-09-19-a-post",
    title: "A post",
    body: "Ampersands & angle brackets <script>alert(1)</script>\n\nA second paragraph.",
    url: null,
    kind: "note",
    visibility: "public",
    pinned: false,
    published_at: "2026-09-19T09:00:00.000Z",
    created_at: "2026-09-19T09:00:00.000Z",
    updated_at: "2026-09-19T09:00:00.000Z",
    author_name: "Elliot",
    ...overrides
  };
}

// `open` is the feed_public setting; `posts` is what the feed holds.
function db({ open = true, posts = [] } = {}) {
  const client = fakeDb([
    [/from settings where key = 'feed_public'/, [{ value: open }]],
    [/where p\.slug =/, ({ values }) => posts.filter((p) => p.slug === values[0])],
    [/where p\.published_at is not null/, posts]
  ]);
  useClient(client);
  return client;
}

function get(path, options = {}) {
  return makeRequest(`https://${HOST}${path}`, options);
}

async function text(response) {
  return await response.text();
}

test("says the feed is not open when the owner has not switched it on", async () => {
  db({ open: false, posts: [post()] });

  const response = await handleFeed(get("/api/feed"));
  const body = await text(response);

  assert.equal(response.status, 404);
  assert.match(body, /Not open to the public yet/);
  assert.match(body, /noindex/);
});

test("renders the open feed with every character of a post escaped", async () => {
  db({ posts: [post()] });

  const response = await handleFeed(get("/api/feed"));
  const body = await text(response);

  assert.equal(response.status, 200);
  assert.match(body, /Ampersands &amp; angle brackets &lt;script&gt;/);
  assert.equal(body.includes("<script>"), false);
  assert.match(body, /<p>A second paragraph\.<\/p>/);
  assert.match(body, /href="\/feed\/2026-09-19-a-post"/);
});

test("escapes an RSS description once, not twice", async () => {
  db({ posts: [post()] });

  const response = await handleFeed(get("/api/feed?format=xml"));
  const body = await text(response);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /application\/rss\+xml/);
  assert.match(body, /&amp; angle brackets/);
  assert.equal(body.includes("&amp;amp;"), false);
  assert.equal(body.includes("]]>"), true, "the description is one CDATA block");
});

test("a slug with a stray percent sign is a 404, not a crash", async () => {
  db({ posts: [post()] });

  const response = await handleFeed(get("/feed/100%"));

  assert.equal(response.status, 404);
  assert.match(await text(response), /There is no post at that address/);
});

test("reads the slug from the rewrite without decoding it a second time", async () => {
  // The rewrite hands over ?path=, which URLSearchParams has already decoded.
  assert.deepEqual(routeFor(new URL("https://x/api/feed?path=a%2Bb%25c")), {
    path: "/feed/a+b%c",
    slug: "a+b%c"
  });
  assert.deepEqual(routeFor(new URL("https://x/feed/a%20b")), { path: "/feed/a%20b", slug: "a b" });
  assert.equal(routeFor(new URL("https://x/feed/100%")).bad, true);
});

test("links a post's url only when it is really http or https", async () => {
  db({ posts: [post({ url: "javascript:alert(1)" })] });
  const dangerous = await text(await handleFeed(get("/api/feed")));
  assert.equal(dangerous.includes("javascript:"), false);

  db({ posts: [post({ url: "https://example.com/x?a=1&b=2" })] });
  const good = await text(await handleFeed(get("/api/feed")));
  assert.match(good, /href="https:\/\/example\.com\/x\?a=1&amp;b=2"/);
});

test("refuses every method but GET and HEAD, and says which are allowed", async () => {
  const response = await handleFeed(get("/api/feed", { method: "POST" }));

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});
