// Transcripts, the record of each session, and the follow-ups that come
// out of them.
//
// The owner attaches a transcript (pasted, or a .txt / .vtt / .srt / .md
// file) to a session; the model derives the record; the client and the
// owner both read it. Follow-ups derived from the record become a shared
// list with an owner (client or Elliot), a due date, and a done mark, and
// either side can add to it by hand. Notes for the next session are the
// client's channel to Elliot between sessions.
//
// Transcript text is visitor text: shown only through textContent on the
// page, handed to the model as marked untrusted data, never logged.

import { sql } from "../db.js";
import { HttpError, json, readJson, clampText } from "../http.js";
import { auditor } from "../audit.js";
import { allow } from "../auth.js";
import { findUserById } from "../users.js";
import { deriveTranscript, normalizeTranscript } from "../derive.js";
import * as mail from "../mail.js";

export const TRANSCRIPT_EVENTS = {
  added: "transcript.added",
  derived: "transcript.derived",
  deriveFailed: "transcript.derive_failed",
  deleted: "transcript.deleted",
  followUpAdded: "follow_up.added",
  followUpDone: "follow_up.done",
  followUpReopened: "follow_up.reopened",
  followUpDeleted: "follow_up.deleted",
  noteAdded: "note.added"
};

const MAX_TRANSCRIPT_CHARS = 400000;

function transcriptView(t, { withRaw = false } = {}) {
  return {
    id: t.id,
    bookingId: t.booking_id,
    userId: t.user_id,
    title: t.title,
    heldAt: t.held_at,
    source: t.source,
    status: t.status,
    derived: t.derived || null,
    derivedAt: t.derived_at,
    createdAt: t.created_at,
    chars: typeof t.raw === "string" ? t.raw.length : t.chars,
    raw: withRaw ? t.raw : undefined,
    member: t.member_email ? { id: t.user_id, email: t.member_email, name: t.member_name } : undefined
  };
}

function followUpView(f) {
  return {
    id: f.id, userId: f.user_id, transcriptId: f.transcript_id, owner: f.owner, text: f.text,
    dueAt: f.due_at, doneAt: f.done_at, createdAt: f.created_at, source: f.source
  };
}

async function loadTranscriptFor(context, id) {
  const rows = await sql()`
    select t.*, u.email as member_email, u.name as member_name from transcripts t join users u on u.id = t.user_id where t.id = ${id}
  `;
  const t = rows[0];
  if (!t) throw new HttpError(404, "Not found.");
  const mine = t.user_id === context.actor.user.id && context.actor.permissions.has("transcripts.own");
  if (!mine && !context.actor.permissions.has("transcripts.manage")) throw new HttpError(403, "You do not have access to that.");
  return t;
}

// Runs the model on a transcript and stores the record, plus the follow-ups
// it names. Failures leave the transcript in status 'failed' with the raw
// text intact, so the owner can try again.
export async function deriveAndStore(transcriptId, context) {
  const rows = await sql()`select t.*, u.name as member_name from transcripts t join users u on u.id = t.user_id where t.id = ${transcriptId}`;
  const t = rows[0];
  if (!t) return null;
  await sql()`update transcripts set status = 'deriving' where id = ${t.id}`;
  try {
    const { derived, usage, model } = await deriveTranscript(t.raw, { heldAt: t.held_at, clientName: t.member_name });
    await sql()`
      update transcripts set derived = ${JSON.stringify(derived)}::jsonb, derived_at = now(), derived_model = ${model}, status = 'ready',
        title = case when title = '' then ${derived.title} else title end
      where id = ${t.id}
    `;
    // Derived follow-ups replace earlier derived ones for this transcript;
    // hand-written ones stay.
    await sql()`delete from follow_ups where transcript_id = ${t.id} and source = 'derived' and done_at is null`;
    for (const text of derived.followUpsClient) {
      await sql()`insert into follow_ups (user_id, transcript_id, owner, text, source, created_by) values (${t.user_id}, ${t.id}, 'client', ${text}, 'derived', ${context.actor.user.id})`;
    }
    for (const text of derived.followUpsCoach) {
      await sql()`insert into follow_ups (user_id, transcript_id, owner, text, source, created_by) values (${t.user_id}, ${t.id}, 'coach', ${text}, 'derived', ${context.actor.user.id})`;
    }
    if (t.booking_id) await sql()`update bookings set status = 'completed' where id = ${t.booking_id} and status = 'scheduled'`;
    await auditor(context, context.actor.user)(TRANSCRIPT_EVENTS.derived, t.id, { model, ...usage, followUps: derived.followUpsClient.length + derived.followUpsCoach.length });
    return derived;
  } catch (error) {
    await sql()`update transcripts set status = 'failed' where id = ${t.id}`;
    console.error("Transcript derivation failed", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    await auditor(context, context.actor.user)(TRANSCRIPT_EVENTS.deriveFailed, t.id, { error: error instanceof Error ? error.name : "UnknownError" });
    return null;
  }
}

export function registerTranscriptRoutes({ route, needs }) {
  /* ---------- reading, both sides ---------- */

  route("GET", "/transcripts", async (context) => {
    needs(context);
    const url = new URL(context.request.url);
    const memberId = url.searchParams.get("member") || "";
    const manage = context.actor.permissions.has("transcripts.manage");
    if (!manage) needs(context, "transcripts.own");
    const userId = manage && memberId ? memberId : manage && !memberId ? null : context.actor.user.id;
    const rows = await sql()`
      select t.id, t.booking_id, t.user_id, t.title, t.held_at, t.source, t.status, t.derived_at, t.created_at, length(t.raw) as chars,
             (t.derived->>'summary') as summary, u.email as member_email, u.name as member_name
      from transcripts t join users u on u.id = t.user_id
      where (${userId}::uuid is null or t.user_id = ${userId}::uuid)
      order by t.held_at desc limit 200
    `;
    return json({ transcripts: rows.map((t) => ({ ...transcriptView(t), summary: t.summary || "" })) });
  });

  route("GET", "/transcripts/:id", async (context, params) => {
    needs(context);
    const t = await loadTranscriptFor(context, params.id);
    const followUps = await sql()`select * from follow_ups where transcript_id = ${t.id} order by created_at`;
    return json({ transcript: transcriptView(t, { withRaw: true }), followUps: followUps.map(followUpView) });
  });

  route("GET", "/search", async (context) => {
    needs(context, "transcripts.own");
    const url = new URL(context.request.url);
    const q = clampText(url.searchParams.get("q") || "", 200).trim();
    if (q.length < 2) return json({ results: [] });
    const rows = await sql()`
      select id, title, held_at, ts_headline('english', raw, plainto_tsquery('english', ${q}), 'MaxFragments=2, MaxWords=24, MinWords=12') as snippet
      from transcripts
      where user_id = ${context.actor.user.id} and (to_tsvector('english', raw) @@ plainto_tsquery('english', ${q}) or to_tsvector('english', coalesce(derived::text, '')) @@ plainto_tsquery('english', ${q}))
      order by held_at desc limit 20
    `;
    return json({ results: rows.map((r) => ({ id: r.id, title: r.title, heldAt: r.held_at, snippet: r.snippet })) });
  });

  /* ---------- follow-ups ---------- */

  route("GET", "/follow-ups", async (context) => {
    needs(context);
    const url = new URL(context.request.url);
    const manage = context.actor.permissions.has("transcripts.manage");
    const memberId = url.searchParams.get("member") || "";
    if (!manage) needs(context, "transcripts.own");
    const userId = manage && memberId ? memberId : manage && !memberId ? null : context.actor.user.id;
    const rows = await sql()`
      select f.*, u.email as member_email, u.name as member_name from follow_ups f join users u on u.id = f.user_id
      where (${userId}::uuid is null or f.user_id = ${userId}::uuid)
      order by (f.done_at is not null), coalesce(f.due_at, f.created_at + interval '365 days'), f.created_at
      limit 300
    `;
    return json({ followUps: rows.map((f) => ({ ...followUpView(f), member: { id: f.user_id, email: f.member_email, name: f.member_name } })) });
  });

  route("POST", "/follow-ups", async (context) => {
    needs(context);
    const body = await readJson(context.request);
    const manage = context.actor.permissions.has("transcripts.manage");
    if (!manage) needs(context, "transcripts.own");
    const userId = manage && typeof body.userId === "string" ? body.userId : context.actor.user.id;
    const text = clampText(body.text, 1000).trim();
    if (!text) throw new HttpError(400, "Enter the follow-up text.");
    const owner = body.owner === "coach" ? "coach" : "client";
    const dueAt = typeof body.dueAt === "string" && !Number.isNaN(Date.parse(body.dueAt)) ? new Date(body.dueAt).toISOString() : null;
    const rows = await sql()`
      insert into follow_ups (user_id, transcript_id, owner, text, due_at, source, created_by)
      values (${userId}, ${typeof body.transcriptId === "string" ? body.transcriptId : null}, ${owner}, ${text}, ${dueAt}, 'manual', ${context.actor.user.id})
      returning *
    `;
    await auditor(context, context.actor.user)(TRANSCRIPT_EVENTS.followUpAdded, rows[0].id, { owner });
    return json({ ok: true, followUp: followUpView(rows[0]) });
  });

  async function loadFollowUp(context, id) {
    const rows = await sql()`select * from follow_ups where id = ${id}`;
    const f = rows[0];
    if (!f) throw new HttpError(404, "Not found.");
    const mine = f.user_id === context.actor.user.id && context.actor.permissions.has("transcripts.own");
    if (!mine && !context.actor.permissions.has("transcripts.manage")) throw new HttpError(403, "You do not have access to that.");
    return f;
  }

  route("PATCH", "/follow-ups/:id", async (context, params) => {
    needs(context);
    const f = await loadFollowUp(context, params.id);
    const body = await readJson(context.request);
    const log = auditor(context, context.actor.user);
    if (typeof body.done === "boolean") {
      await sql()`update follow_ups set done_at = ${body.done ? new Date().toISOString() : null} where id = ${f.id}`;
      await log(body.done ? TRANSCRIPT_EVENTS.followUpDone : TRANSCRIPT_EVENTS.followUpReopened, f.id);
    }
    if (typeof body.text === "string" && body.text.trim()) await sql()`update follow_ups set text = ${clampText(body.text, 1000).trim()} where id = ${f.id}`;
    if (body.dueAt === null) await sql()`update follow_ups set due_at = null where id = ${f.id}`;
    else if (typeof body.dueAt === "string" && !Number.isNaN(Date.parse(body.dueAt))) await sql()`update follow_ups set due_at = ${new Date(body.dueAt).toISOString()} where id = ${f.id}`;
    if (body.owner === "coach" || body.owner === "client") await sql()`update follow_ups set owner = ${body.owner} where id = ${f.id}`;
    return json({ ok: true });
  });

  route("DELETE", "/follow-ups/:id", async (context, params) => {
    needs(context);
    const f = await loadFollowUp(context, params.id);
    await sql()`delete from follow_ups where id = ${f.id}`;
    await auditor(context, context.actor.user)(TRANSCRIPT_EVENTS.followUpDeleted, f.id);
    return json({ ok: true });
  });

  /* ---------- notes for the next session ---------- */

  route("GET", "/notes", async (context) => {
    needs(context);
    const manage = context.actor.permissions.has("transcripts.manage");
    const url = new URL(context.request.url);
    const memberId = url.searchParams.get("member") || "";
    if (!manage) needs(context, "sessions.own");
    const userId = manage && memberId ? memberId : manage && !memberId ? null : context.actor.user.id;
    const rows = await sql()`
      select n.*, u.email as member_email, u.name as member_name from session_notes n join users u on u.id = n.user_id
      where (${userId}::uuid is null or n.user_id = ${userId}::uuid) order by n.created_at desc limit 100
    `;
    return json({ notes: rows.map((n) => ({ id: n.id, userId: n.user_id, text: n.text, createdAt: n.created_at, via: n.created_via, readAt: n.read_at, member: { email: n.member_email, name: n.member_name } })) });
  });

  route("POST", "/notes", async (context) => {
    needs(context, "sessions.own");
    const body = await readJson(context.request);
    const text = clampText(body.text, 4000).trim();
    if (!text) throw new HttpError(400, "Enter the note text.");
    const rows = await sql()`insert into session_notes (user_id, text, created_via) values (${context.actor.user.id}, ${text}, ${context.actorKind === "user" ? "web" : "agent"}) returning *`;
    await auditor(context, context.actor.user)(TRANSCRIPT_EVENTS.noteAdded, rows[0].id);
    return json({ ok: true, note: { id: rows[0].id, text: rows[0].text, createdAt: rows[0].created_at } });
  });

  route("POST", "/admin/notes/:id/read", async (context, params) => {
    needs(context, "transcripts.manage");
    await sql()`update session_notes set read_at = now() where id = ${params.id} and read_at is null`;
    return json({ ok: true });
  });

  /* ---------- the owner's side: adding and deriving ---------- */

  route("POST", "/admin/transcripts", async (context) => {
    needs(context, "transcripts.manage");
    if (!(await allow(`derive:${context.actor.user.id}`, 30, 3600))) throw new HttpError(429, "Hourly limit reached. Try again later.");
    const body = await readJson(context.request, 2 * 1024 * 1024);
    const member = await findUserById(String(body.userId || ""));
    if (!member) throw new HttpError(404, "Not found.");
    const raw = normalizeTranscript(body.text, typeof body.filename === "string" ? body.filename : "");
    if (raw.length < 40) throw new HttpError(400, "That transcript is too short.");
    if (raw.length > MAX_TRANSCRIPT_CHARS) throw new HttpError(413, "That transcript is too long. Split it in two.");
    let bookingId = null;
    let heldAt = typeof body.heldAt === "string" && !Number.isNaN(Date.parse(body.heldAt)) ? new Date(body.heldAt).toISOString() : null;
    if (typeof body.bookingId === "string" && body.bookingId) {
      const b = await sql()`select id, starts_at, user_id from bookings where id = ${body.bookingId}`;
      if (!b[0] || b[0].user_id !== member.id) throw new HttpError(400, "That session does not belong to this member.");
      const existing = await sql()`select id from transcripts where booking_id = ${b[0].id}`;
      if (existing[0]) throw new HttpError(409, "That session already has a transcript.");
      bookingId = b[0].id;
      heldAt = heldAt || b[0].starts_at;
    }
    const source = typeof body.filename === "string" && body.filename ? "file" : "paste";
    const rows = await sql()`
      insert into transcripts (booking_id, user_id, title, held_at, source, raw, status, created_by)
      values (${bookingId}, ${member.id}, ${clampText(body.title, 200)}, ${heldAt || new Date().toISOString()}, ${source}, ${raw}, 'new', ${context.actor.user.id})
      returning *
    `;
    const t = rows[0];
    await auditor(context, context.actor.user)(TRANSCRIPT_EVENTS.added, t.id, { for: member.id, chars: raw.length, source });
    const derived = body.derive === false ? null : await deriveAndStore(t.id, context);
    if (derived) {
      try {
        await mail.send({
          to: member.email,
          subject: `Your session record: ${derived.title || "the last session"}`,
          text: `The record of your session with Elliot is ready in the Hearth: the summary, the key points, and the follow-ups.\n\nhttps://chamainteligente.com/hearth/transcripts/${t.id}\n\nElliot Himmelfarb\nChama Inteligente`,
          idempotencyKey: `transcript-${t.id}-ready`
        });
      } catch (error) {
        console.error("Transcript ready mail failed", error instanceof Error ? error.message : "UnknownError");
      }
    }
    const fresh = await sql()`select * from transcripts where id = ${t.id}`;
    return json({ ok: true, transcript: transcriptView(fresh[0]) });
  });

  route("POST", "/admin/transcripts/:id/derive", async (context, params) => {
    needs(context, "transcripts.manage");
    if (!(await allow(`derive:${context.actor.user.id}`, 30, 3600))) throw new HttpError(429, "Hourly limit reached. Try again later.");
    const rows = await sql()`select id from transcripts where id = ${params.id}`;
    if (!rows[0]) throw new HttpError(404, "Not found.");
    const derived = await deriveAndStore(params.id, context);
    if (!derived) throw new HttpError(502, "The record could not be written this time. Try again in a minute.");
    return json({ ok: true, derived });
  });

  route("PATCH", "/admin/transcripts/:id", async (context, params) => {
    needs(context, "transcripts.manage");
    const body = await readJson(context.request);
    const rows = await sql()`select id from transcripts where id = ${params.id}`;
    if (!rows[0]) throw new HttpError(404, "Not found.");
    if (typeof body.title === "string") await sql()`update transcripts set title = ${clampText(body.title, 200)} where id = ${params.id}`;
    if (typeof body.heldAt === "string" && !Number.isNaN(Date.parse(body.heldAt))) await sql()`update transcripts set held_at = ${new Date(body.heldAt).toISOString()} where id = ${params.id}`;
    return json({ ok: true });
  });

  route("DELETE", "/admin/transcripts/:id", async (context, params) => {
    needs(context, "transcripts.manage");
    await sql()`delete from transcripts where id = ${params.id}`;
    await auditor(context, context.actor.user)(TRANSCRIPT_EVENTS.deleted, params.id);
    return json({ ok: true });
  });

}
