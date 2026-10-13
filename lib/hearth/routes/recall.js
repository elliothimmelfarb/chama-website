// Remember cards: the routes behind the review on a record, the Remember
// page and the count on Home. The schedule itself is lib/hearth/recall.js.
//
// A card belongs to the member whose record it came from. Only they review
// it; the owner writes a record's cards and can read them, never answer
// them.

import { sql } from "../db.js";
import { HttpError, json, readJson, clampText } from "../http.js";
import { auditor } from "../audit.js";
import { RESULTS, firstDue, nextReview } from "../recall.js";

export const RECALL_EVENTS = { cardsSet: "cards.set" };
const KINDS = ["recall", "apply", "words"];

function cardView(c) {
  return {
    id: c.id, recordId: c.transcript_id, kind: c.kind, front: c.front, back: c.back,
    step: c.step, dueAt: c.due_at, reviews: c.reviews, retired: Boolean(c.retired_at),
    recordTitle: c.record_title || undefined, heldAt: c.held_at || undefined
  };
}

export function registerRecallRoutes({ route, needs }) {
  route("GET", "/cards/due", async (context) => {
    needs(context, "transcripts.own");
    const rows = await sql()`
      select c.*, t.title as record_title, t.held_at from recall_cards c left join transcripts t on t.id = c.transcript_id
      where c.user_id = ${context.actor.user.id} and c.retired_at is null and c.due_at <= now()
      order by c.due_at, c.position limit 50
    `;
    return json({ cards: rows.map(cardView) });
  });

  route("GET", "/cards", async (context) => {
    needs(context);
    const url = new URL(context.request.url);
    const recordId = url.searchParams.get("record") || "";
    if (!recordId) throw new HttpError(400, "Which record?");
    const owners = await sql()`select user_id from transcripts where id = ${recordId}`;
    if (!owners[0]) throw new HttpError(404, "Not found.");
    const mine = owners[0].user_id === context.actor.user.id && context.actor.permissions.has("transcripts.own");
    if (!mine && !context.actor.permissions.has("transcripts.manage")) throw new HttpError(403, "You do not have access to that.");
    const rows = await sql()`select * from recall_cards where transcript_id = ${recordId} order by position`;
    return json({ cards: rows.map(cardView) });
  });

  route("POST", "/cards/:id/review", async (context, params) => {
    needs(context, "transcripts.own");
    const body = await readJson(context.request);
    const rows = await sql()`select * from recall_cards where id = ${params.id}`;
    const card = rows[0];
    if (!card) throw new HttpError(404, "Not found.");
    if (card.user_id !== context.actor.user.id) throw new HttpError(403, "That card is someone else's.");
    if (!RESULTS.includes(body.result)) throw new HttpError(400, "Answer with again, hard or good.");
    const next = nextReview({ step: card.step, result: body.result });
    const updated = await sql()`
      update recall_cards set step = ${next.step}, due_at = ${next.dueAt}, last_result = ${body.result}, reviewed_at = now(),
        reviews = reviews + 1, retired_at = ${next.retired ? new Date().toISOString() : null}
      where id = ${card.id} returning *
    `;
    return json({ ok: true, card: cardView(updated[0] || { ...card, step: next.step, due_at: next.dueAt }) });
  });

  // Replaces a record's cards. Meant for writing a record, before the
  // member has reviewed anything; replacing resets their progress.
  route("PUT", "/admin/transcripts/:id/cards", async (context, params) => {
    needs(context, "transcripts.manage");
    const body = await readJson(context.request);
    const rows = await sql()`select id, user_id from transcripts where id = ${params.id}`;
    const t = rows[0];
    if (!t) throw new HttpError(404, "Not found.");
    const cards = (Array.isArray(body.cards) ? body.cards : []).slice(0, 12)
      .map((c) => ({ kind: KINDS.includes(c?.kind) ? c.kind : "recall", front: clampText(c?.front, 600).trim(), back: clampText(c?.back, 1200).trim() }))
      .filter((c) => c.front && c.back);
    await sql()`delete from recall_cards where transcript_id = ${t.id}`;
    const due = firstDue();
    let position = 0;
    for (const c of cards) {
      await sql()`
        insert into recall_cards (user_id, transcript_id, position, kind, front, back, due_at, created_by)
        values (${t.user_id}, ${t.id}, ${position++}, ${c.kind}, ${c.front}, ${c.back}, ${due}, ${context.actor.user.id})
      `;
    }
    await auditor(context, context.actor.user)(RECALL_EVENTS.cardsSet, t.id, { cards: cards.length });
    return json({ ok: true, cards: cards.length });
  });
}
