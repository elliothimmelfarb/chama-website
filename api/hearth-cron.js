// The Hearth's hourly housekeeping, called by Vercel Cron with the same
// CRON_SECRET bearer as the other jobs.
//
// Three things, all idempotent: session reminders (a day before and an hour
// before, each sent once and recorded on the booking); pulling Meet
// transcripts for sessions that have ended, when Google is connected, and
// writing the record from them; and sweeping expired tokens, states and
// rate-limit windows so the small tables stay small.

import { configured, ready, sql } from "../lib/hearth/db.js";
import { json } from "../lib/hearth/http.js";
import * as mail from "../lib/hearth/mail.js";
import * as google from "../lib/hearth/google.js";
import { deriveAndStore } from "../lib/hearth/routes/transcripts.js";
import { audit } from "../lib/hearth/audit.js";

function authorized(request, env = process.env) {
  const secret = typeof env.CRON_SECRET === "string" ? env.CRON_SECRET.trim() : "";
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

async function settingValue(key, fallback) {
  const rows = await sql()`select value from settings where key = ${key}`;
  return rows[0] ? rows[0].value : fallback;
}

// Reminders go to the client only; the owner has the calendar. The window
// is generous (the job runs hourly) and the `reminded` column keeps each
// kind to one send.
export async function sendReminders(now = new Date()) {
  const meetingUrl = await settingValue("meeting_url", "");
  const kinds = [
    { key: "day", fromH: 23, toH: 25, text: "tomorrow" },
    { key: "hour", fromH: 0.75, toH: 1.5, text: "in about an hour" }
  ];
  let sent = 0;
  for (const kind of kinds) {
    const from = new Date(now.getTime() + kind.fromH * 3600000).toISOString();
    const to = new Date(now.getTime() + kind.toH * 3600000).toISOString();
    const rows = await sql()`
      select b.id, b.starts_at, b.ends_at, b.meeting_url, u.email, u.name, u.timezone
      from bookings b join users u on u.id = b.user_id
      where b.status = 'scheduled' and b.starts_at >= ${from} and b.starts_at < ${to}
        and not (${kind.key} = any(b.reminded)) and u.status = 'active'
      limit 50
    `;
    for (const b of rows) {
      const when = new Date(b.starts_at).toLocaleString("en-GB", { timeZone: b.timezone, dateStyle: "full", timeStyle: "short" });
      const link = b.meeting_url || meetingUrl;
      try {
        await mail.send({
          to: b.email,
          subject: `Your session with Elliot is ${kind.text}`,
          text: `${when} (${b.timezone}).\n\n${link ? "Join here: " + link : "The meeting link is in the Hearth."}\n\nYour sessions: https://chamainteligente.com/hearth/sessions\n\nElliot Himmelfarb\nChama Inteligente`,
          idempotencyKey: `reminder-${b.id}-${kind.key}`
        });
        await sql()`update bookings set reminded = array_append(reminded, ${kind.key}) where id = ${b.id}`;
        sent += 1;
      } catch (error) {
        console.error("Reminder failed", kind.key, error instanceof Error ? error.message : "UnknownError");
      }
    }
  }
  return sent;
}

// Sessions that ended, have a Meet code and no transcript yet: ask Meet.
// Each booking is tried once an hour for two days after it ends; Meet
// usually has the transcript within the hour, and a meeting that was never
// transcribed simply runs out of attempts.
export async function pullMeetTranscripts(now = new Date()) {
  if (!(await google.isConnected())) return { pulled: 0, checked: 0 };
  const owner = await sql()`select id from users where role = 'owner' and status = 'active' order by created_at limit 1`;
  if (!owner[0]) return { pulled: 0, checked: 0 };
  const rows = await sql()`
    select b.id, b.user_id, b.meeting_code, b.starts_at, b.ends_at, b.title, u.email, u.name
    from bookings b join users u on u.id = b.user_id left join transcripts t on t.booking_id = b.id
    where b.meeting_code is not null and t.id is null and b.status in ('scheduled', 'completed')
      and b.ends_at < ${new Date(now.getTime() - 15 * 60000).toISOString()}
      and b.ends_at > ${new Date(now.getTime() - 3 * 86400000).toISOString()}
      and b.meet_attempts < 48
      and (b.meet_checked_at is null or b.meet_checked_at < ${new Date(now.getTime() - 50 * 60000).toISOString()})
    order by b.ends_at limit 10
  `;
  let pulled = 0;
  const context = { actor: { user: { id: owner[0].id } }, actorKind: "system", actorRef: "cron", country: "", device: "cron" };
  for (const b of rows) {
    await sql()`update bookings set meet_attempts = meet_attempts + 1, meet_checked_at = now() where id = ${b.id}`;
    let found = null;
    try {
      found = await google.fetchTranscript({ meetingCode: b.meeting_code });
    } catch (error) {
      console.error("Meet transcript fetch failed", error instanceof Error ? `${error.name}: ${error.detail || error.message}` : "UnknownError");
      continue;
    }
    if (!found) continue;
    const inserted = await sql()`
      insert into transcripts (booking_id, user_id, title, held_at, source, raw, status, created_by)
      values (${b.id}, ${b.user_id}, ${b.title || ""}, ${b.starts_at}, 'meet', ${found.text}, 'new', ${owner[0].id})
      returning id
    `;
    const transcriptId = inserted[0].id;
    await audit({ actor: owner[0].id, actorKind: "system", actorRef: "cron", event: "google.transcript_pulled", target: transcriptId, meta: { booking: b.id, chars: found.text.length }, device: "cron" });
    const derived = await deriveAndStore(transcriptId, context);
    if (derived) {
      try {
        await mail.send({
          to: b.email,
          subject: `Your session record: ${derived.title || "the last session"}`,
          text: `The record of your session with Elliot is ready in the Hearth: the summary, the key points, and the follow-ups.\n\nhttps://chamainteligente.com/hearth/transcripts/${transcriptId}\n\nElliot Himmelfarb\nChama Inteligente`,
          idempotencyKey: `transcript-${transcriptId}-ready`
        });
      } catch (error) {
        console.error("Transcript ready mail failed", error instanceof Error ? error.message : "UnknownError");
      }
    }
    pulled += 1;
  }
  return { pulled, checked: rows.length };
}

export async function sweep() {
  await sql()`delete from email_tokens where expires_at < now() - interval '7 days'`;
  await sql()`delete from oauth_states where expires_at < now()`;
  await sql()`delete from rate_limits where window_start < now() - interval '1 day'`;
  await sql()`delete from oauth_codes where expires_at < now() - interval '1 day'`;
  await sql()`delete from login_sessions where expires_at < now() - interval '30 days' or (revoked_at is not null and revoked_at < now() - interval '30 days')`;
  await sql()`delete from audit_log where at < now() - interval '12 months'`;
}

export async function handleCron(request) {
  if (!authorized(request)) return json({ error: "Unauthorized." }, 401);
  if (!configured()) return json({ ok: false, reason: "unconfigured" }, 503);
  try {
    await ready();
    const reminders = await sendReminders();
    let meet = { pulled: 0, checked: 0 };
    try {
      meet = await pullMeetTranscripts();
    } catch (error) {
      console.error("Meet pull failed", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    }
    await sweep();
    console.info("Hearth cron", JSON.stringify({ reminders, meet }));
    return json({ ok: true, reminders, meet });
  } catch (error) {
    console.error("Hearth cron failed", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    return json({ ok: false }, 500);
  }
}

export default {
  async fetch(request) {
    return await handleCron(request);
  }
};
