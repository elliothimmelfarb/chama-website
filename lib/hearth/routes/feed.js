// The feed: what Elliot is looking at.
//
// Posts have a visibility: public (anyone, on /feed, in RSS, through the
// public MCP tool, once the owner has switched the public feed on), members
// (anyone signed in), clients (people with the client permission). Public
// posts get dated URLs, which is the cheap half of a track record. Bodies
// are plain text with blank lines between paragraphs; the page renders
// paragraphs, never markup.

import { sql } from "../db.js";
import { HttpError, json, readJson, clampText } from "../http.js";
import { auditor } from "../audit.js";

export const FEED_EVENTS = { posted: "feed.posted", updated: "feed.updated", deleted: "feed.deleted" };

const VISIBILITIES = ["public", "members", "clients"];
const KINDS = ["note", "link", "brief"];

export function postView(p, { withAuthor = true } = {}) {
  return {
    id: p.id, slug: p.slug, title: p.title, body: p.body, url: p.url, kind: p.kind, visibility: p.visibility,
    pinned: p.pinned, publishedAt: p.published_at, createdAt: p.created_at, updatedAt: p.updated_at,
    author: withAuthor && p.author_name !== undefined ? { name: p.author_name, id: p.author_id } : undefined
  };
}

export function slugFor(title, at = new Date()) {
  const base = String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "post";
  return `${at.toISOString().slice(0, 10)}-${base}`;
}

export function levelsFor(actor) {
  const levels = ["public"];
  if (actor && actor.permissions.has("feed.read")) levels.push("members");
  if (actor && actor.permissions.has("feed.read.clients")) levels.push("clients");
  return levels;
}

export async function publicPosts(limit = 30) {
  return await sql()`
    select p.*, u.name as author_name from feed_posts p left join users u on u.id = p.author_id
    where p.published_at is not null and p.visibility = 'public' order by p.pinned desc, p.published_at desc limit ${limit}
  `;
}

export async function publicPost(slug) {
  const rows = await sql()`
    select p.*, u.name as author_name from feed_posts p left join users u on u.id = p.author_id
    where p.slug = ${slug} and p.published_at is not null and p.visibility = 'public'
  `;
  return rows[0] || null;
}

export function registerFeedRoutes({ route, needs, readSettings }) {
  route("GET", "/feed", async (context) => {
    needs(context, "feed.read");
    const url = new URL(context.request.url);
    const before = url.searchParams.get("before") || "";
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    const levels = levelsFor(context.actor);
    const canWrite = context.actor.permissions.has("feed.write");
    const rows = await sql()`
      select p.*, u.name as author_name from feed_posts p left join users u on u.id = p.author_id
      where (${canWrite} or (p.published_at is not null and p.visibility = any(${levels})))
        and (${before} = '' or p.published_at < ${before}::timestamptz or (p.published_at is null and ${canWrite}))
      order by p.pinned desc, coalesce(p.published_at, p.created_at) desc limit ${limit}
    `;
    const settings = await readSettings();
    return json({ posts: rows.map((p) => postView(p)), canWrite, feedPublic: settings.feed_public, nextBefore: rows.length === limit ? rows[rows.length - 1].published_at : null });
  });

  route("GET", "/feed/:id", async (context, params) => {
    needs(context, "feed.read");
    const levels = levelsFor(context.actor);
    const canWrite = context.actor.permissions.has("feed.write");
    const rows = await sql()`
      select p.*, u.name as author_name from feed_posts p left join users u on u.id = p.author_id
      where (p.id::text = ${params.id} or p.slug = ${params.id}) and (${canWrite} or (p.published_at is not null and p.visibility = any(${levels})))
    `;
    if (!rows[0]) throw new HttpError(404, "Not found.");
    return json({ post: postView(rows[0]) });
  });

  route("POST", "/feed", async (context) => {
    needs(context, "feed.write");
    const body = await readJson(context.request, 512 * 1024);
    const post = validPost(body);
    const publish = body.publish !== false;
    const now = new Date();
    let slug = slugFor(post.title, now);
    for (let i = 0; i < 5; i += 1) {
      const clash = await sql()`select 1 from feed_posts where slug = ${slug}`;
      if (!clash[0]) break;
      slug = `${slugFor(post.title, now)}-${i + 2}`;
    }
    const rows = await sql()`
      insert into feed_posts (slug, author_id, title, body, url, kind, visibility, pinned, published_at)
      values (${slug}, ${context.actor.user.id}, ${post.title}, ${post.body}, ${post.url}, ${post.kind}, ${post.visibility}, ${post.pinned}, ${publish ? now.toISOString() : null})
      returning *
    `;
    await auditor(context, context.actor.user)(FEED_EVENTS.posted, rows[0].id, { visibility: post.visibility, published: publish });
    return json({ ok: true, post: postView(rows[0]) });
  });

  route("PATCH", "/feed/:id", async (context, params) => {
    needs(context, "feed.write");
    const body = await readJson(context.request, 512 * 1024);
    const existing = await sql()`select * from feed_posts where id = ${params.id}`;
    if (!existing[0]) throw new HttpError(404, "Not found.");
    const merged = validPost({ ...postView(existing[0]), ...body });
    let publishedAt = existing[0].published_at;
    if (body.publish === true && !publishedAt) publishedAt = new Date().toISOString();
    if (body.publish === false) publishedAt = null;
    await sql()`
      update feed_posts set title = ${merged.title}, body = ${merged.body}, url = ${merged.url}, kind = ${merged.kind}, visibility = ${merged.visibility},
        pinned = ${merged.pinned}, published_at = ${publishedAt}, updated_at = now() where id = ${params.id}
    `;
    await auditor(context, context.actor.user)(FEED_EVENTS.updated, params.id, { visibility: merged.visibility });
    return json({ ok: true });
  });

  route("DELETE", "/feed/:id", async (context, params) => {
    needs(context, "feed.write");
    await sql()`delete from feed_posts where id = ${params.id}`;
    await auditor(context, context.actor.user)(FEED_EVENTS.deleted, params.id);
    return json({ ok: true });
  });
}

function validPost(body) {
  const title = clampText(body.title, 200).trim();
  if (!title) throw new HttpError(400, "A post needs a title.");
  const url = typeof body.url === "string" && body.url ? body.url.trim() : null;
  if (url && !/^https?:\/\/[^\s]{1,500}$/.test(url)) throw new HttpError(400, "A link starts with http:// or https://");
  return {
    title,
    body: clampText(body.body, 20000),
    url,
    kind: KINDS.includes(body.kind) ? body.kind : url ? "link" : "note",
    visibility: VISIBILITIES.includes(body.visibility) ? body.visibility : "members",
    pinned: body.pinned === true
  };
}
