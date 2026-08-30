// What the admin area reads.
//
// One GET endpoint behind the session cookie from api/admin-auth.js, with four
// views over the same two private blob prefixes the rest of the site writes to:
// intake/ (contact requests, api/intake.js) and chat/ (transcripts,
// api/chat.js), plus the watchdog's kill switch.
//
// Everything it returns is untrusted data. Visitor text passes through as JSON
// and the page renders it as text, never as markup, and none of it is ever
// logged here. Reads are capped three ways (count, bytes, pagination) so no
// amount of stored history can turn one dashboard load into an unbounded job.

import { get, list } from "@vercel/blob";

import {
  MESSAGES as AUTH_MESSAGES,
  adminConfig,
  isSameOrigin,
  json,
  requireAdmin
} from "./admin-auth.js";

export const KILL_SWITCH_KEY = "ops/kill-switch.json";

export const MESSAGES = {
  unauthorized: "Sign in to see this.",
  unreadable: "That view could not be read."
};

const LIMITS = {
  results: 200,
  totalBytes: 4 * 1024 * 1024,
  concurrency: 10,
  pages: 20,
  days: 30
};

const DAY_MS = 24 * 60 * 60 * 1000;

// The only shape a conversation blob key is allowed to have. A path from the
// query string is never fetched until it matches this, so the view cannot be
// turned into a reader for arbitrary keys in the store.
const CONVERSATION_PATHNAME = /^chat\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9-]{8,64}\.json$/;

export function isConversationPathname(value) {
  return typeof value === "string" && CONVERSATION_PATHNAME.test(value);
}

export function dayFromPathname(pathname) {
  const match = /^(?:chat|intake)\/(\d{4}-\d{2}-\d{2})\//.exec(String(pathname || ""));
  return match ? match[1] : null;
}

export function utcDay(at) {
  return new Date(at).toISOString().slice(0, 10);
}

// The last n days as ISO strings, oldest first, so a day with nothing in it is
// still a zero in the chart rather than a gap.
export function dayRange(at, days = LIMITS.days) {
  const range = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    range.push(utcDay(at - back * DAY_MS));
  }
  return range;
}

function clampDays(value) {
  if (value === null || value === undefined || value === "") return LIMITS.days;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return LIMITS.days;
  return Math.min(90, Math.max(1, Math.floor(parsed)));
}

// Newest first, then capped by count and by total bytes. Both caps drop the
// oldest first and the caller reports that a cap was hit.
export function selectRecent(blobs, { at, days, cap = LIMITS.results, totalBytes = LIMITS.totalBytes }) {
  const earliest = utcDay(at - (days - 1) * DAY_MS);

  const inRange = blobs
    .filter((blob) => {
      const day = dayFromPathname(blob.pathname);
      return day !== null && day >= earliest;
    })
    .sort((left, right) => new Date(right.uploadedAt) - new Date(left.uploadedAt));

  const selected = [];
  let bytes = 0;

  for (const blob of inRange) {
    if (selected.length >= cap) break;
    const size = Number(blob.size) || 0;
    if (selected.length && bytes + size > totalBytes) break;
    bytes += size;
    selected.push(blob);
  }

  return { selected, capped: selected.length < inRange.length, total: inRange.length };
}

export function countByDay(blobs, range) {
  const counts = new Map(range.map((day) => [day, 0]));
  for (const blob of blobs) {
    const day = dayFromPathname(blob.pathname);
    if (day !== null && counts.has(day)) counts.set(day, counts.get(day) + 1);
  }
  return counts;
}

// One row per conversation for the list view: enough to scan, not the whole
// transcript. The preview is visitor text and is truncated, never logged.
export function summarizeConversation(record, blob) {
  const turns = Array.isArray(record?.turns) ? record.turns : [];
  const toolEvents = Array.isArray(record?.toolEvents) ? record.toolEvents : [];
  const userTurns = turns.filter((turn) => turn?.role === "user");
  const firstUser = userTurns.find((turn) => typeof turn.content === "string");

  return {
    pathname: blob.pathname,
    conversationId:
      typeof record?.conversationId === "string" && record.conversationId
        ? record.conversationId
        : String(blob.pathname || "").split("/").pop()?.replace(/\.json$/, "") || "unknown",
    day: dayFromPathname(blob.pathname),
    updatedAt: typeof record?.updatedAt === "string" ? record.updatedAt : blob.uploadedAt,
    turnCount: turns.length,
    userTurns: userTurns.length,
    noteSent: toolEvents.some((event) => event?.name === "send_note_to_elliot"),
    preview: firstUser ? firstUser.content.slice(0, 140) : ""
  };
}

async function listAll(deps, prefix) {
  const blobs = [];
  let cursor;
  for (let page = 0; page < LIMITS.pages; page += 1) {
    const result = await deps.list({ prefix, limit: 1000, cursor });
    blobs.push(...(result?.blobs || []));
    cursor = result?.hasMore ? result.cursor : undefined;
    if (!cursor) break;
  }
  return blobs;
}

// A fixed pool rather than one Promise.all over everything: two hundred blob
// reads opened at once is a way to be rate limited by the store.
async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;

  const runners = [];
  for (let slot = 0; slot < Math.min(limit, items.length); slot += 1) {
    runners.push(
      (async () => {
        while (true) {
          const index = next;
          next += 1;
          if (index >= items.length) return;
          results[index] = await worker(items[index], index);
        }
      })()
    );
  }

  await Promise.all(runners);
  return results;
}

async function readBlobText(result) {
  if (!result) return null;
  if (typeof result.text === "function") return await result.text();
  if (result.stream) return await new Response(result.stream).text();
  return null;
}

async function readJson(deps, key) {
  try {
    const text = await readBlobText(await deps.get(key, { access: "private" }));
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("Admin blob read failed", error instanceof Error ? error.name : "UnknownError");
    return null;
  }
}

async function readRecords(deps, blobs) {
  const records = await mapWithLimit(blobs, LIMITS.concurrency, (blob) =>
    readJson(deps, blob.url || blob.pathname)
  );
  return records.map((record, index) => ({ record, blob: blobs[index] })).filter((entry) => entry.record);
}

export async function readFlame(deps) {
  const record = await readJson(deps, KILL_SWITCH_KEY);
  return {
    killed: record?.disabled === true,
    reason: typeof record?.reason === "string" ? record.reason : null,
    at: typeof record?.at === "string" ? record.at : null,
    chatDisabledEnv: Boolean(deps.env.CHAT_DISABLED)
  };
}

export function buildSummary({ flame, intakeBlobs, chatBlobs, conversations, at, days }) {
  const range = dayRange(at, days);
  const chatCounts = countByDay(chatBlobs, range);
  const intakeCounts = countByDay(intakeBlobs, range);

  const uploads = [...chatBlobs, ...intakeBlobs]
    .map((blob) => blob.uploadedAt)
    .filter(Boolean)
    .sort();

  return {
    flame,
    totals: {
      intakes: intakeBlobs.length,
      conversations: chatBlobs.length,
      notesSent: conversations.filter((entry) => entry.noteSent).length,
      lastActivity: uploads.length ? uploads[uploads.length - 1] : null
    },
    days: range.map((day) => ({
      day,
      conversations: chatCounts.get(day) || 0,
      intakes: intakeCounts.get(day) || 0
    }))
  };
}

export async function handleAdminData(request, dependencies = {}) {
  const deps = {
    list,
    get,
    now: () => Date.now(),
    env: process.env,
    ...dependencies
  };

  if (request.method !== "GET") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { Allow: "GET", "Cache-Control": "no-store" }
    });
  }

  if (!isSameOrigin(request)) {
    return json({ error: AUTH_MESSAGES.refused }, 403);
  }

  const config = deps.config || adminConfig(deps.env);
  if (!config.configured) {
    return json({ error: AUTH_MESSAGES.unconfigured }, 503);
  }

  const session = requireAdmin(request, { ...deps, config });
  if (!session) {
    return json({ error: MESSAGES.unauthorized }, 401);
  }

  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "summary";
  const days = clampDays(url.searchParams.get("days"));
  const at = deps.now();

  try {
    if (view === "conversation") {
      const pathname = url.searchParams.get("path");
      if (!isConversationPathname(pathname)) {
        return json({ error: MESSAGES.unreadable }, 400);
      }
      const record = await readJson(deps, pathname);
      if (!record) return json({ error: MESSAGES.unreadable }, 404);
      return json({ conversation: { ...record, pathname } });
    }

    if (view === "intakes") {
      const blobs = await listAll(deps, "intake/");
      const { selected, capped } = selectRecent(blobs, { at, days });
      const entries = await readRecords(deps, selected);
      return json({
        capped,
        intakes: entries.map(({ record, blob }) => ({
          ...record,
          pathname: blob.pathname,
          uploadedAt: blob.uploadedAt
        }))
      });
    }

    if (view === "conversations") {
      const blobs = await listAll(deps, "chat/");
      const { selected, capped } = selectRecent(blobs, { at, days });
      const entries = await readRecords(deps, selected);
      return json({
        capped,
        conversations: entries.map(({ record, blob }) => summarizeConversation(record, blob))
      });
    }

    if (view !== "summary") {
      return json({ error: MESSAGES.unreadable }, 400);
    }

    const [flame, intakeBlobs, chatBlobs] = await Promise.all([
      readFlame(deps),
      listAll(deps, "intake/"),
      listAll(deps, "chat/")
    ]);

    // notesSent needs the transcripts themselves, so the summary reads the same
    // capped window the conversations view does rather than the whole store.
    const { selected } = selectRecent(chatBlobs, { at, days });
    const entries = await readRecords(deps, selected);
    const conversations = entries.map(({ record, blob }) => summarizeConversation(record, blob));

    return json(buildSummary({ flame, intakeBlobs, chatBlobs, conversations, at, days }));
  } catch (error) {
    console.error("Admin data read failed", error instanceof Error ? error.name : "UnknownError");
    return json({ error: MESSAGES.unreadable }, 502);
  }
}

export default {
  async fetch(request) {
    return await handleAdminData(request);
  }
};
