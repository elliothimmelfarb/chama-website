// The retention sweep, on a cron.
//
// privacy.html promises: "We delete saved conversations and notes within 12
// months." Two prefixes carry that promise, so both are swept here. The
// kill switch and anything else under ops/ is not visitor data and is left
// alone.
//
// One failing delete must not end the sweep: a single blob that cannot be
// removed would otherwise keep every older one alive forever. Failures are
// counted and reported instead.

import { del, list } from "@vercel/blob";

const DAY_MS = 24 * 60 * 60 * 1000;

// Kept for the response body and for anything still reading the old name.
export const RETENTION_DAYS = 365;

export const RETENTION = [
  { prefix: "intake/", days: RETENTION_DAYS },
  { prefix: "chat/", days: RETENTION_DAYS }
];

export async function runCleanup(dependencies = {}) {
  const deps = { list, del, now: () => Date.now(), ...dependencies };
  const at = deps.now();

  let deleted = 0;
  let failed = 0;
  const swept = {};

  for (const { prefix, days } of RETENTION) {
    const cutoff = at - days * DAY_MS;
    let cursor;
    let removed = 0;

    do {
      let page;
      try {
        page = await deps.list({ prefix, limit: 1000, cursor });
      } catch (error) {
        console.error("Cleanup listing failed", prefix, error instanceof Error ? error.name : "UnknownError");
        failed += 1;
        break;
      }

      const expired = (page.blobs || []).filter(
        (blob) => new Date(blob.uploadedAt).getTime() < cutoff
      );

      if (expired.length) {
        try {
          await deps.del(expired.map((blob) => blob.url));
          removed += expired.length;
        } catch (error) {
          console.error("Cleanup delete failed", prefix, error instanceof Error ? error.name : "UnknownError");
          failed += expired.length;
        }
      }

      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    swept[prefix] = removed;
    deleted += removed;
  }

  return { deleted, failed, swept, retentionDays: RETENTION_DAYS };
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "POST") {
      return new Response("Method not allowed.", {
        status: 405,
        headers: { Allow: "GET, POST", "Cache-Control": "no-store" }
      });
    }

    const authorization = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;

    if (!secret || authorization !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const outcome = await runCleanup();

    return Response.json(
      { ok: true, ...outcome },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
};
