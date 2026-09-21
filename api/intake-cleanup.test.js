import assert from "node:assert/strict";
import test from "node:test";

import cleanup, { RETENTION, RETENTION_DAYS, runCleanup } from "./intake-cleanup.js";

const NOW = Date.parse("2026-09-19T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function blob(prefix, daysAgo, id = `${prefix}${daysAgo}`) {
  const uploadedAt = new Date(NOW - daysAgo * DAY_MS).toISOString();
  return {
    pathname: `${prefix}${uploadedAt.slice(0, 10)}/${id}.json`,
    url: `https://store.blob.vercel-storage.com/${prefix}${id}.json`,
    uploadedAt
  };
}

// The blob store, stubbed. `blobs` is everything it holds; `failDelete` makes
// every delete throw, the way an outage would.
function fakeDeps(blobs, { failDelete = false, failList = false } = {}) {
  const calls = { list: [], del: [] };
  return {
    calls,
    now: () => NOW,
    list: async (options) => {
      calls.list.push(options);
      if (failList) throw new Error("BlobListFailed");
      return { blobs: blobs.filter((entry) => entry.pathname.startsWith(options.prefix)), hasMore: false };
    },
    del: async (urls) => {
      calls.del.push(urls);
      if (failDelete) throw new Error("BlobDeleteFailed");
    }
  };
}

test("sweeps both the notes and the conversations, which privacy.html promises for 12 months", async () => {
  assert.deepEqual(RETENTION.map((entry) => entry.prefix).sort(), ["chat/", "intake/"]);
  assert.equal(RETENTION_DAYS, 365);

  const deps = fakeDeps([
    blob("intake/", 400),
    blob("intake/", 10),
    blob("chat/", 400),
    blob("chat/", 366),
    blob("chat/", 10)
  ]);

  const outcome = await runCleanup(deps);

  assert.deepEqual(outcome.swept, { "intake/": 1, "chat/": 2 });
  assert.equal(outcome.deleted, 3);
  assert.equal(outcome.failed, 0);
  assert.deepEqual(deps.calls.list.map((options) => options.prefix), ["intake/", "chat/"]);
});

test("keeps everything younger than the cutoff and drops everything older", async () => {
  const deps = fakeDeps([
    blob("chat/", 364, "young"),
    blob("chat/", 365.5, "old")
  ]);

  const outcome = await runCleanup(deps);

  assert.equal(outcome.deleted, 1);
  assert.deepEqual(deps.calls.del, [["https://store.blob.vercel-storage.com/chat/old.json"]]);
});

test("counts a failing delete without abandoning the sweep", async () => {
  const deps = fakeDeps([blob("intake/", 400), blob("chat/", 400)], { failDelete: true });

  const outcome = await runCleanup(deps);

  assert.equal(outcome.deleted, 0);
  assert.equal(outcome.failed, 2);
  assert.equal(deps.calls.del.length, 2, "both prefixes were still attempted");
});

test("counts a failing listing without abandoning the other prefix", async () => {
  const deps = fakeDeps([blob("intake/", 400)], { failList: true });

  const outcome = await runCleanup(deps);

  assert.equal(outcome.failed, 2);
  assert.equal(outcome.deleted, 0);
});

function request(method = "GET", headers = {}) {
  return new Request("https://chamainteligente.com/api/intake-cleanup", { method, headers });
}

test("refuses a request without the cron secret", async () => {
  process.env.CRON_SECRET = "s3cret";

  assert.equal((await cleanup.fetch(request())).status, 401);
  assert.equal((await cleanup.fetch(request("GET", { authorization: "Bearer wrong" }))).status, 401);
  // The secret is checked before the method, so a stranger gets 401, not 405.
  assert.equal((await cleanup.fetch(request("PUT"))).status, 401);
});

test("refuses every method but GET and POST, and says which are allowed", async () => {
  process.env.CRON_SECRET = "s3cret";

  const response = await cleanup.fetch(request("DELETE", { authorization: "Bearer s3cret" }));

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, POST");
});
