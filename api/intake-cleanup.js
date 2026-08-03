import { del, list } from "@vercel/blob";

const RETENTION_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

export default {
  async fetch(request) {
    const authorization = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET;

    if (!secret || authorization !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const cutoff = Date.now() - RETENTION_DAYS * DAY_MS;
    let cursor;
    let deleted = 0;

    do {
      const page = await list({ prefix: "intake/", limit: 1000, cursor });
      const expired = page.blobs.filter(
        (blob) => new Date(blob.uploadedAt).getTime() < cutoff
      );

      if (expired.length) {
        await del(expired.map((blob) => blob.url));
        deleted += expired.length;
      }

      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    return Response.json(
      { ok: true, deleted, retentionDays: RETENTION_DAYS },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
};
