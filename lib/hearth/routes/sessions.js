// Sessions: packs, credits, availability, booking.
//
// The shape of the money is a ledger. A pack marked paid adds credits; a
// booking spends one; a cancellation in time gives it back; the owner can
// grant or remove by hand. A balance is a sum and nothing mutates a counter.
// Purchases move requested -> invoiced -> paid (or void) because in Portugal
// the invoice comes from certified software, so the owner issues it and
// then marks it paid here; a card processor can be added behind the same
// statuses later.
//
// Double bookings are refused by the database (an exclusion constraint on
// scheduled bookings), not by code that checks first.

import { sql } from "../db.js";
import { HttpError, json, readJson, clampText, requestOrigin } from "../http.js";
import { auditor } from "../audit.js";
import { findUserById } from "../users.js";
import { freeSlots, isValidZone } from "../time.js";
import { icsEvent } from "../ics.js";
import * as mail from "../mail.js";
import * as google from "../google.js";

export const SESSION_EVENTS = {
  packRequested: "purchase.requested",
  packInvoiced: "purchase.invoiced",
  packPaid: "purchase.paid",
  packVoided: "purchase.voided",
  creditGranted: "credit.granted",
  referralRewarded: "referral.rewarded",
  bookingCreated: "booking.created",
  bookingCancelled: "booking.cancelled",
  bookingMoved: "booking.moved",
  bookingUpdated: "booking.updated",
  availabilityUpdated: "availability.updated"
};

const PURCHASE_STATUSES = ["requested", "invoiced", "paid", "void"];

export async function creditBalance(userId) {
  const rows = await sql()`select coalesce(sum(delta), 0)::int as balance from credit_ledger where user_id = ${userId}`;
  return rows[0]?.balance || 0;
}

function bookingView(b, user) {
  return {
    id: b.id,
    userId: b.user_id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    status: b.status,
    meetingUrl: b.meeting_url || null,
    title: b.title,
    clientNote: b.client_note,
    ownerNote: user ? b.owner_note : undefined,
    createdAt: b.created_at,
    cancelledAt: b.cancelled_at,
    cancelReason: b.cancel_reason,
    member: b.member_email ? { id: b.user_id, email: b.member_email, name: b.member_name } : undefined,
    transcriptId: b.transcript_id || null
  };
}

async function busyBetween(from, to, exceptBookingId = null) {
  const bookings = await sql()`
    select starts_at, ends_at from bookings
    where status = 'scheduled' and ends_at > ${from.toISOString()} and starts_at < ${to.toISOString()}
      and (${exceptBookingId}::uuid is null or id <> ${exceptBookingId}::uuid)
  `;
  const blocks = await sql()`
    select starts_at, ends_at from availability_blocks
    where ends_at > ${from.toISOString()} and starts_at < ${to.toISOString()}
  `;
  return bookings.concat(blocks);
}

async function slotsFor(settings, from, to, exceptBookingId = null) {
  const rules = await sql()`select weekday, start_minute, end_minute, timezone, active from availability_rules where active`;
  const busy = await busyBetween(from, to, exceptBookingId);
  return freeSlots({
    rules, busy,
    minutes: settings.session_minutes,
    stepMinutes: 30,
    from, to,
    timeZone: settings.owner_timezone,
    noticeHours: settings.min_notice_hours
  });
}

function parseInstant(value) {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

async function ownerEmail() {
  const rows = await sql()`select email, name from users where role = 'owner' and status = 'active' order by created_at limit 1`;
  return rows[0] || null;
}

// When Google is connected every booking gets its own Meet room on
// Elliot's calendar, with the client invited. A failure here is logged and
// the booking stands with the standing meeting link instead.
async function attachMeeting(booking, member) {
  try {
    if (!(await google.isConnected())) return booking;
    const meeting = await google.createMeeting({
      bookingId: booking.id, startsAt: booking.starts_at, endsAt: booking.ends_at,
      clientEmail: member.email, clientName: member.name, title: booking.title || ""
    });
    const rows = await sql()`update bookings set google_event_id = ${meeting.eventId}, meeting_code = ${meeting.meetingCode}, meeting_url = coalesce(${meeting.meetUrl}, meeting_url) where id = ${booking.id} returning *`;
    return rows[0] || booking;
  } catch (error) {
    console.error("Google meeting failed", error instanceof Error ? `${error.name}: ${error.detail || error.message}` : "UnknownError");
    return booking;
  }
}

async function moveMeeting(booking) {
  if (!booking.google_event_id) return;
  try {
    await google.moveMeeting({ eventId: booking.google_event_id, startsAt: booking.starts_at, endsAt: booking.ends_at });
  } catch (error) {
    console.error("Google meeting move failed", error instanceof Error ? `${error.name}: ${error.detail || error.message}` : "UnknownError");
  }
}

async function cancelMeeting(booking) {
  if (!booking.google_event_id) return;
  try {
    await google.cancelMeeting({ eventId: booking.google_event_id });
  } catch (error) {
    console.error("Google meeting cancel failed", error instanceof Error ? `${error.name}: ${error.detail || error.message}` : "UnknownError");
  }
}

// Confirmation mail to both sides with the calendar file attached. Failures
// are logged by name; the booking stands either way.
async function sendBookingMail({ request, booking, member, settings, kind }) {
  const owner = await ownerEmail();
  const when = new Date(booking.starts_at);
  const inZone = (tz) => when.toLocaleString("en-GB", { timeZone: tz, dateStyle: "full", timeStyle: "short" }) + ` (${tz})`;
  const hearthUrl = `${requestOrigin(request)}/hearth/sessions`;
  const link = booking.meeting_url || settings.meeting_url || "";
  const cancelled = kind === "cancelled";
  const ics = icsEvent({
    uid: booking.id,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    summary: cancelled ? "Cancelled: session with Elliot Himmelfarb" : "Session with Elliot Himmelfarb",
    description: link ? `Join: ${link}` : "The meeting link is in the Hearth.",
    url: link || hearthUrl,
    organizerEmail: owner?.email,
    attendeeEmail: member.email,
    sequence: cancelled ? 1 : 0,
    cancelled
  });
  const attachments = [{ filename: "session.ics", content: Buffer.from(ics).toString("base64") }];
  const clientText = cancelled
    ? `Your session on ${inZone(member.timezone)} has been cancelled.\n\nYour sessions: ${hearthUrl}`
    : `Your session with Elliot is booked for ${inZone(member.timezone)}.\n\n${link ? "Join here: " + link : "The meeting link will be in the Hearth before the session."}\n\nIf there is something you want to work on, add a note in the Hearth before the session: ${hearthUrl}\n\nNeed to move it? You can reschedule or cancel in the Hearth up to ${settings.cancel_notice_hours} hours before.`;
  try {
    await mail.send({
      to: member.email,
      subject: cancelled ? "Session cancelled" : `Session booked: ${when.toLocaleDateString("en-GB", { timeZone: member.timezone, dateStyle: "medium" })}`,
      text: clientText + "\n\nElliot Himmelfarb\nChama Inteligente\nhttps://chamainteligente.com",
      attachments,
      idempotencyKey: `booking-${booking.id}-${kind}-client`
    });
  } catch (error) {
    console.error("Booking mail (client) failed", error instanceof Error ? error.message : "UnknownError");
  }
  if (owner) {
    try {
      await mail.send({
        to: owner.email,
        subject: (cancelled ? "Cancelled: " : "Booked: ") + `${member.name || member.email} on ${when.toLocaleDateString("en-GB", { timeZone: settings.owner_timezone, dateStyle: "medium" })}`,
        text: `${member.name || "A client"} <${member.email}>\n${inZone(settings.owner_timezone)}\n${booking.client_note ? "\nTheir note (untrusted, as written):\n" + booking.client_note + "\n" : ""}\n${hearthUrl}`,
        attachments,
        idempotencyKey: `booking-${booking.id}-${kind}-owner`
      });
    } catch (error) {
      console.error("Booking mail (owner) failed", error instanceof Error ? error.message : "UnknownError");
    }
  }
}

export function registerSessionRoutes({ route, needs, readSettings }) {
  /* ---------- packs and credits, the client's side ---------- */

  route("GET", "/packs", async (context) => {
    needs(context, "packs.buy");
    const packs = await sql()`select id, name, description, sessions, minutes, price_cents, currency from packs where active order by position, created_at`;
    const referral = await sql()`
      select reward from referral_events where referred_id = ${context.actor.user.id} and status = 'signed_up'
    `;
    return json({ packs: packs.map(packView), pendingReferral: referral.length > 0 });
  });

  route("GET", "/credits", async (context) => {
    needs(context, "sessions.own");
    const userId = context.actor.user.id;
    const [balance, ledger, purchases, rewards] = await Promise.all([
      creditBalance(userId),
      sql()`select id, delta, reason, ref_id, note, created_at from credit_ledger where user_id = ${userId} order by created_at desc limit 100`,
      sql()`select id, pack_name, sessions, status, amount_cents, discount_cents, currency, note, created_at, paid_at from purchases where user_id = ${userId} order by created_at desc`,
      sql()`select reward, rewarded_at from referral_events where referrer_id = ${userId} and status = 'rewarded' order by rewarded_at desc`
    ]);
    return json({
      balance,
      ledger,
      purchases: purchases.map(purchaseView),
      pendingDiscount: await pendingDiscount(userId),
      rewards
    });
  });

  route("POST", "/purchases", async (context) => {
    needs(context, "packs.buy");
    const body = await readJson(context.request);
    const packs = await sql()`select * from packs where id = ${String(body.packId || "")} and active`;
    const pack = packs[0];
    if (!pack) throw new HttpError(404, "That pack is not available.");
    const open = await sql()`select count(*)::int as n from purchases where user_id = ${context.actor.user.id} and status in ('requested', 'invoiced')`;
    if ((open[0]?.n || 0) >= 2) throw new HttpError(400, "You already have a pack request open. Elliot will be in touch.");
    const discount = await pendingDiscount(context.actor.user.id);
    const amount = pack.price_cents ?? null;
    const discountCents = amount && discount ? Math.round((amount * discount.percent) / 100) : 0;
    const rows = await sql()`
      insert into purchases (user_id, pack_id, pack_name, sessions, status, amount_cents, discount_cents, currency, note)
      values (${context.actor.user.id}, ${pack.id}, ${pack.name}, ${pack.sessions}, 'requested', ${amount}, ${discountCents}, ${pack.currency}, ${clampText(body.note, 1000)})
      returning *
    `;
    const purchase = rows[0];
    await auditor(context, context.actor.user)(SESSION_EVENTS.packRequested, purchase.id, { pack: pack.name, sessions: pack.sessions });
    const owner = await ownerEmail();
    if (owner) {
      try {
        await mail.send({
          to: owner.email,
          subject: `Pack requested: ${context.actor.user.name || context.actor.user.email}`,
          text: `${context.actor.user.name || "A member"} <${context.actor.user.email}> asked for ${pack.name} (${pack.sessions} sessions).${purchase.note ? "\n\nTheir note (untrusted, as written):\n" + purchase.note : ""}\n\nIssue the invoice, then mark it paid in the Hearth: ${requestOrigin(context.request)}/hearth/admin/purchases`,
          idempotencyKey: `purchase-${purchase.id}-requested`
        });
      } catch (error) {
        console.error("Purchase mail failed", error instanceof Error ? error.message : "UnknownError");
      }
    }
    return json({ ok: true, purchase: purchaseView(purchase) });
  });

  /* ---------- slots and bookings, the client's side ---------- */

  route("GET", "/slots", async (context) => {
    needs(context, "sessions.own");
    const settings = await readSettings();
    const url = new URL(context.request.url);
    const now = new Date();
    const from = parseInstant(url.searchParams.get("from")) || now;
    const horizon = new Date(now.getTime() + settings.booking_horizon_days * 86400000);
    let to = parseInstant(url.searchParams.get("to")) || new Date(from.getTime() + 14 * 86400000);
    if (to > horizon) to = horizon;
    if (to.getTime() - from.getTime() > 45 * 86400000) to = new Date(from.getTime() + 45 * 86400000);
    const except = url.searchParams.get("except");
    const slots = await slotsFor(settings, from, to, except && /^[0-9a-f-]{36}$/.test(except) ? except : null);
    return json({
      minutes: settings.session_minutes,
      timezone: context.actor.user.timezone,
      horizon: horizon.toISOString(),
      slots: slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() }))
    });
  });

  route("GET", "/bookings", async (context) => {
    needs(context, "sessions.own");
    const rows = await sql()`
      select b.*, t.id as transcript_id from bookings b
      left join transcripts t on t.booking_id = b.id
      where b.user_id = ${context.actor.user.id} order by b.starts_at desc limit 200
    `;
    const settings = await readSettings();
    return json({
      bookings: rows.map((b) => bookingView(b)),
      balance: await creditBalance(context.actor.user.id),
      meetingUrl: settings.meeting_url || null,
      cancelNoticeHours: settings.cancel_notice_hours
    });
  });

  route("POST", "/bookings", async (context) => {
    needs(context, "sessions.own");
    const body = await readJson(context.request);
    const settings = await readSettings();
    const startsAt = parseInstant(body.startsAt);
    if (!startsAt) throw new HttpError(400, "Pick a time.");
    const endsAt = new Date(startsAt.getTime() + settings.session_minutes * 60000);
    const user = context.actor.user;
    // The requested start must be one the calculator would offer right now.
    const offered = await slotsFor(settings, new Date(startsAt.getTime() - 1), new Date(endsAt.getTime() + 1));
    if (!offered.some((s) => s.startsAt.getTime() === startsAt.getTime())) throw new HttpError(409, "That time is not available.");
    // Spend the credit only if there is one: the ledger insert carries the
    // balance check, so two quick bookings cannot both spend the last credit.
    const spent = await sql()`
      insert into credit_ledger (user_id, delta, reason, note, created_by)
      select ${user.id}, -1, 'booking', '', ${user.id}
      where (select coalesce(sum(delta), 0) from credit_ledger where user_id = ${user.id}) >= 1
      returning id
    `;
    if (!spent[0]) throw new HttpError(402, "You have no session credits left. Ask for a pack first.");
    let booking;
    try {
      const rows = await sql()`
        insert into bookings (user_id, starts_at, ends_at, status, credit_id, client_note, meeting_url)
        values (${user.id}, ${startsAt.toISOString()}, ${endsAt.toISOString()}, 'scheduled', ${spent[0].id}, ${clampText(body.note, 2000)}, ${settings.meeting_url || null})
        returning *
      `;
      booking = rows[0];
      await sql()`update credit_ledger set ref_id = ${booking.id} where id = ${spent[0].id}`;
    } catch (error) {
      await sql()`delete from credit_ledger where id = ${spent[0].id}`;
      if (/exclusion|overlap|bookings_starts_at_ends_at_excl|conflict/i.test(String(error?.message))) {
        throw new HttpError(409, "Someone just took that time. Pick another.");
      }
      throw error;
    }
    booking = await attachMeeting(booking, user);
    await auditor(context, user)(SESSION_EVENTS.bookingCreated, booking.id, { startsAt: booking.starts_at });
    await sendBookingMail({ request: context.request, booking, member: user, settings, kind: "booked" });
    return json({ ok: true, booking: bookingView(booking), balance: await creditBalance(user.id) });
  });

  route("POST", "/bookings/:id/cancel", async (context, params) => {
    needs(context, "sessions.own");
    const user = context.actor.user;
    const rows = await sql()`select * from bookings where id = ${params.id} and user_id = ${user.id}`;
    const booking = rows[0];
    if (!booking) throw new HttpError(404, "Not found.");
    if (booking.status !== "scheduled") throw new HttpError(400, "That session is not scheduled.");
    const settings = await readSettings();
    const body = await readJson(context.request);
    const hoursAway = (new Date(booking.starts_at).getTime() - Date.now()) / 3600000;
    const refund = hoursAway >= settings.cancel_notice_hours;
    await sql()`update bookings set status = 'cancelled', cancelled_at = now(), cancel_reason = ${clampText(body.reason, 500)} where id = ${booking.id}`;
    await cancelMeeting(booking);
    if (refund && booking.credit_id) {
      await sql()`insert into credit_ledger (user_id, delta, reason, ref_id, note, created_by) values (${user.id}, 1, 'cancel', ${booking.id}, 'cancelled in time', ${user.id})`;
    }
    await auditor(context, user)(SESSION_EVENTS.bookingCancelled, booking.id, { refund });
    await sendBookingMail({ request: context.request, booking: { ...booking, status: "cancelled" }, member: user, settings, kind: "cancelled" });
    return json({ ok: true, refund, balance: await creditBalance(user.id) });
  });

  route("POST", "/bookings/:id/move", async (context, params) => {
    needs(context, "sessions.own");
    const user = context.actor.user;
    const rows = await sql()`select * from bookings where id = ${params.id} and user_id = ${user.id}`;
    const booking = rows[0];
    if (!booking) throw new HttpError(404, "Not found.");
    if (booking.status !== "scheduled") throw new HttpError(400, "That session is not scheduled.");
    const settings = await readSettings();
    const hoursAway = (new Date(booking.starts_at).getTime() - Date.now()) / 3600000;
    if (hoursAway < settings.cancel_notice_hours) throw new HttpError(400, `Sessions can be moved up to ${settings.cancel_notice_hours} hours before they start.`);
    const body = await readJson(context.request);
    const startsAt = parseInstant(body.startsAt);
    if (!startsAt) throw new HttpError(400, "Pick a time.");
    const endsAt = new Date(startsAt.getTime() + settings.session_minutes * 60000);
    const offered = await slotsFor(settings, new Date(startsAt.getTime() - 1), new Date(endsAt.getTime() + 1), booking.id);
    if (!offered.some((s) => s.startsAt.getTime() === startsAt.getTime())) throw new HttpError(409, "That time is not available.");
    let moved;
    try {
      const updated = await sql()`
        update bookings set starts_at = ${startsAt.toISOString()}, ends_at = ${endsAt.toISOString()} where id = ${booking.id} returning *
      `;
      moved = updated[0];
    } catch (error) {
      if (/exclusion|overlap|excl|conflict/i.test(String(error?.message))) throw new HttpError(409, "Someone just took that time. Pick another.");
      throw error;
    }
    await moveMeeting(moved);
    await auditor(context, user)(SESSION_EVENTS.bookingMoved, booking.id, { from: booking.starts_at, to: moved.starts_at });
    await sendBookingMail({ request: context.request, booking: moved, member: user, settings, kind: "booked" });
    return json({ ok: true, booking: bookingView(moved) });
  });

  /* ---------- the owner's side ---------- */

  route("GET", "/admin/packs", async (context) => {
    needs(context, "packs.manage");
    const rows = await sql()`select * from packs order by position, created_at`;
    return json({ packs: rows.map((p) => ({ ...packView(p), active: p.active, position: p.position })) });
  });

  route("POST", "/admin/packs", async (context) => {
    needs(context, "packs.manage");
    const body = await readJson(context.request);
    const pack = validPack(body);
    const rows = await sql()`
      insert into packs (name, description, sessions, minutes, price_cents, currency, active, position)
      values (${pack.name}, ${pack.description}, ${pack.sessions}, ${pack.minutes}, ${pack.priceCents}, ${pack.currency}, ${pack.active}, ${pack.position})
      returning *
    `;
    return json({ ok: true, pack: packView(rows[0]) });
  });

  route("PATCH", "/admin/packs/:id", async (context, params) => {
    needs(context, "packs.manage");
    const body = await readJson(context.request);
    const existing = await sql()`select * from packs where id = ${params.id}`;
    if (!existing[0]) throw new HttpError(404, "Not found.");
    const pack = validPack({ ...packView(existing[0]), active: existing[0].active, position: existing[0].position, ...body });
    await sql()`
      update packs set name = ${pack.name}, description = ${pack.description}, sessions = ${pack.sessions}, minutes = ${pack.minutes},
        price_cents = ${pack.priceCents}, currency = ${pack.currency}, active = ${pack.active}, position = ${pack.position}
      where id = ${params.id}
    `;
    return json({ ok: true });
  });

  route("DELETE", "/admin/packs/:id", async (context, params) => {
    needs(context, "packs.manage");
    // Packs that were ever bought stay, switched off, so purchases keep their reference.
    const used = await sql()`select count(*)::int as n from purchases where pack_id = ${params.id}`;
    if ((used[0]?.n || 0) > 0) await sql()`update packs set active = false where id = ${params.id}`;
    else await sql()`delete from packs where id = ${params.id}`;
    return json({ ok: true });
  });

  route("GET", "/admin/purchases", async (context) => {
    needs(context, "purchases.manage");
    const url = new URL(context.request.url);
    const status = url.searchParams.get("status") || "";
    const rows = await sql()`
      select p.*, u.email as member_email, u.name as member_name from purchases p join users u on u.id = p.user_id
      where (${status} = '' or p.status = ${status}) order by p.created_at desc limit 300
    `;
    return json({ purchases: rows.map((p) => ({ ...purchaseView(p), member: { id: p.user_id, email: p.member_email, name: p.member_name } })) });
  });

  route("PATCH", "/admin/purchases/:id", async (context, params) => {
    needs(context, "purchases.manage");
    const body = await readJson(context.request);
    const rows = await sql()`select * from purchases where id = ${params.id}`;
    const purchase = rows[0];
    if (!purchase) throw new HttpError(404, "Not found.");
    const actor = context.actor.user;
    const log = auditor(context, actor);
    if (typeof body.amountCents === "number" && Number.isInteger(body.amountCents) && body.amountCents >= 0) {
      await sql()`update purchases set amount_cents = ${body.amountCents} where id = ${purchase.id}`;
    }
    if (typeof body.discountCents === "number" && Number.isInteger(body.discountCents) && body.discountCents >= 0) {
      await sql()`update purchases set discount_cents = ${body.discountCents} where id = ${purchase.id}`;
    }
    if (typeof body.providerRef === "string") {
      await sql()`update purchases set provider_ref = ${clampText(body.providerRef, 200)} where id = ${purchase.id}`;
    }
    if (typeof body.status === "string" && body.status !== purchase.status) {
      if (!PURCHASE_STATUSES.includes(body.status)) throw new HttpError(400, "Unknown status.");
      if (purchase.status === "paid") throw new HttpError(400, "A paid purchase cannot change status. Adjust credits by hand instead.");
      if (body.status === "paid") {
        await sql()`update purchases set status = 'paid', paid_at = now() where id = ${purchase.id}`;
        await sql()`insert into credit_ledger (user_id, delta, reason, ref_id, note, created_by) values (${purchase.user_id}, ${purchase.sessions}, 'purchase', ${purchase.id}, ${purchase.pack_name}, ${actor.id})`;
        // A referred member's first paid pack: the person who sent them is
        // rewarded the way settings say, and a client is a client now.
        await sql()`update users set role = 'client' where id = ${purchase.user_id} and role = 'guest'`;
        await rewardReferrer(purchase, context);
        await log(SESSION_EVENTS.packPaid, purchase.id, { sessions: purchase.sessions, user: purchase.user_id });
        const member = await findUserById(purchase.user_id);
        if (member) {
          try {
            await mail.send({
              to: member.email,
              subject: `${purchase.sessions} sessions added`,
              text: `Your ${purchase.pack_name} is paid and ${purchase.sessions} session credits are in your account. Book the first one whenever you are ready: ${requestOrigin(context.request)}/hearth/sessions\n\nElliot Himmelfarb\nChama Inteligente`,
              idempotencyKey: `purchase-${purchase.id}-paid`
            });
          } catch (error) {
            console.error("Purchase paid mail failed", error instanceof Error ? error.message : "UnknownError");
          }
        }
      } else if (body.status === "void") {
        await sql()`update purchases set status = 'void', voided_at = now() where id = ${purchase.id}`;
        await log(SESSION_EVENTS.packVoided, purchase.id);
      } else {
        await sql()`update purchases set status = ${body.status} where id = ${purchase.id}`;
        await log(SESSION_EVENTS.packInvoiced, purchase.id);
      }
    }
    return json({ ok: true });
  });

  route("POST", "/admin/credits", async (context) => {
    needs(context, "purchases.manage");
    const body = await readJson(context.request);
    const user = await findUserById(String(body.userId || ""));
    if (!user) throw new HttpError(404, "Not found.");
    const delta = Number(body.delta);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) throw new HttpError(400, "Enter a whole number of credits.");
    await sql()`insert into credit_ledger (user_id, delta, reason, note, created_by) values (${user.id}, ${delta}, 'grant', ${clampText(body.note, 300)}, ${context.actor.user.id})`;
    if (delta > 0) await sql()`update users set role = 'client' where id = ${user.id} and role = 'guest'`;
    await auditor(context, context.actor.user)(SESSION_EVENTS.creditGranted, user.id, { delta });
    return json({ ok: true, balance: await creditBalance(user.id) });
  });

  route("GET", "/admin/members/:id/credits", async (context, params) => {
    needs(context, "purchases.manage");
    const ledger = await sql()`select id, delta, reason, ref_id, note, created_at from credit_ledger where user_id = ${params.id} order by created_at desc limit 100`;
    return json({ balance: await creditBalance(params.id), ledger });
  });

  route("GET", "/admin/availability", async (context) => {
    needs(context, "availability.manage");
    const rules = await sql()`select id, weekday, start_minute, end_minute, timezone, active from availability_rules order by weekday, start_minute`;
    const blocks = await sql()`select id, starts_at, ends_at, reason from availability_blocks where ends_at > now() - interval '1 day' order by starts_at`;
    const settings = await readSettings();
    return json({ rules, blocks, timezone: settings.owner_timezone, sessionMinutes: settings.session_minutes });
  });

  route("PUT", "/admin/availability", async (context) => {
    needs(context, "availability.manage");
    const body = await readJson(context.request);
    const settings = await readSettings();
    const rules = Array.isArray(body.rules) ? body.rules.slice(0, 50) : [];
    const clean = rules.map((r) => {
      const weekday = Number(r.weekday), start = Number(r.startMinute), end = Number(r.endMinute);
      const tz = typeof r.timezone === "string" && isValidZone(r.timezone) ? r.timezone : settings.owner_timezone;
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new HttpError(400, "Weekday out of range.");
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || end <= start) throw new HttpError(400, "A window needs a start before its end, within the day.");
      return { weekday, start, end, tz, active: r.active !== false };
    });
    await sql()`delete from availability_rules`;
    for (const r of clean) {
      await sql()`insert into availability_rules (weekday, start_minute, end_minute, timezone, active) values (${r.weekday}, ${r.start}, ${r.end}, ${r.tz}, ${r.active})`;
    }
    await auditor(context, context.actor.user)(SESSION_EVENTS.availabilityUpdated, null, { rules: clean.length });
    return json({ ok: true });
  });

  route("POST", "/admin/blocks", async (context) => {
    needs(context, "availability.manage");
    const body = await readJson(context.request);
    const startsAt = parseInstant(body.startsAt), endsAt = parseInstant(body.endsAt);
    if (!startsAt || !endsAt || endsAt <= startsAt) throw new HttpError(400, "A block needs a start before its end.");
    const rows = await sql()`insert into availability_blocks (starts_at, ends_at, reason) values (${startsAt.toISOString()}, ${endsAt.toISOString()}, ${clampText(body.reason, 200)}) returning *`;
    return json({ ok: true, block: rows[0] });
  });

  route("DELETE", "/admin/blocks/:id", async (context, params) => {
    needs(context, "availability.manage");
    await sql()`delete from availability_blocks where id = ${params.id}`;
    return json({ ok: true });
  });

  route("GET", "/admin/bookings", async (context) => {
    needs(context, "sessions.manage");
    const url = new URL(context.request.url);
    const from = parseInstant(url.searchParams.get("from")) || new Date(Date.now() - 30 * 86400000);
    const to = parseInstant(url.searchParams.get("to")) || new Date(Date.now() + 90 * 86400000);
    const memberId = url.searchParams.get("member") || "";
    const rows = await sql()`
      select b.*, u.email as member_email, u.name as member_name, t.id as transcript_id
      from bookings b join users u on u.id = b.user_id left join transcripts t on t.booking_id = b.id
      where b.starts_at >= ${from.toISOString()} and b.starts_at < ${to.toISOString()}
        and (${memberId} = '' or b.user_id::text = ${memberId})
      order by b.starts_at
    `;
    const settings = await readSettings();
    return json({ bookings: rows.map((b) => bookingView(b, true)), timezone: settings.owner_timezone, sessionMinutes: settings.session_minutes });
  });

  route("POST", "/admin/bookings", async (context) => {
    needs(context, "sessions.manage");
    const body = await readJson(context.request);
    const member = await findUserById(String(body.userId || ""));
    if (!member) throw new HttpError(404, "Not found.");
    const settings = await readSettings();
    const startsAt = parseInstant(body.startsAt);
    if (!startsAt) throw new HttpError(400, "Pick a time.");
    const minutes = Number.isInteger(body.minutes) && body.minutes > 0 && body.minutes <= 480 ? body.minutes : settings.session_minutes;
    const endsAt = new Date(startsAt.getTime() + minutes * 60000);
    let creditId = null;
    if (!body.free) {
      const spent = await sql()`
        insert into credit_ledger (user_id, delta, reason, note, created_by)
        select ${member.id}, -1, 'booking', 'booked by Elliot', ${context.actor.user.id}
        where (select coalesce(sum(delta), 0) from credit_ledger where user_id = ${member.id}) >= 1
        returning id
      `;
      if (!spent[0]) throw new HttpError(402, "This member has no credits. Tick Free to book without one.");
      creditId = spent[0].id;
    }
    let booking;
    try {
      const rows = await sql()`
        insert into bookings (user_id, starts_at, ends_at, status, credit_id, owner_note, title, meeting_url)
        values (${member.id}, ${startsAt.toISOString()}, ${endsAt.toISOString()}, 'scheduled', ${creditId}, ${clampText(body.note, 2000)}, ${clampText(body.title, 200)}, ${settings.meeting_url || null})
        returning *
      `;
      booking = rows[0];
      if (creditId) await sql()`update credit_ledger set ref_id = ${booking.id} where id = ${creditId}`;
    } catch (error) {
      if (creditId) await sql()`delete from credit_ledger where id = ${creditId}`;
      if (/exclusion|overlap|excl|conflict/i.test(String(error?.message))) throw new HttpError(409, "That time overlaps another session.");
      throw error;
    }
    booking = await attachMeeting(booking, member);
    await sql()`update users set role = 'client' where id = ${member.id} and role = 'guest'`;
    await auditor(context, context.actor.user)(SESSION_EVENTS.bookingCreated, booking.id, { for: member.id, byOwner: true });
    await sendBookingMail({ request: context.request, booking, member, settings, kind: "booked" });
    return json({ ok: true, booking: bookingView(booking, true) });
  });

  route("PATCH", "/admin/bookings/:id", async (context, params) => {
    needs(context, "sessions.manage");
    const body = await readJson(context.request);
    const rows = await sql()`select * from bookings where id = ${params.id}`;
    const booking = rows[0];
    if (!booking) throw new HttpError(404, "Not found.");
    const log = auditor(context, context.actor.user);
    if (typeof body.status === "string" && body.status !== booking.status) {
      if (!["scheduled", "completed", "cancelled", "no_show"].includes(body.status)) throw new HttpError(400, "Unknown status.");
      await sql()`update bookings set status = ${body.status}, cancelled_at = ${body.status === "cancelled" ? new Date().toISOString() : null} where id = ${booking.id}`;
      if (body.status === "cancelled") await cancelMeeting(booking);
      if (body.status === "cancelled" && booking.credit_id && body.refund !== false) {
        await sql()`insert into credit_ledger (user_id, delta, reason, ref_id, note, created_by) values (${booking.user_id}, 1, 'cancel', ${booking.id}, 'cancelled by Elliot', ${context.actor.user.id})`;
        const member = await findUserById(booking.user_id);
        const settings = await readSettings();
        if (member) await sendBookingMail({ request: context.request, booking: { ...booking, status: "cancelled" }, member, settings, kind: "cancelled" });
      }
      await log(body.status === "cancelled" ? SESSION_EVENTS.bookingCancelled : SESSION_EVENTS.bookingUpdated, booking.id, { status: body.status });
    }
    if (typeof body.ownerNote === "string") await sql()`update bookings set owner_note = ${clampText(body.ownerNote, 4000)} where id = ${booking.id}`;
    if (typeof body.title === "string") await sql()`update bookings set title = ${clampText(body.title, 200)} where id = ${booking.id}`;
    if (typeof body.meetingUrl === "string") {
      if (body.meetingUrl && !/^https:\/\/[^\s]{1,500}$/.test(body.meetingUrl)) throw new HttpError(400, "A meeting link starts with https://");
      await sql()`update bookings set meeting_url = ${body.meetingUrl || null} where id = ${booking.id}`;
    }
    return json({ ok: true });
  });
}

/* ---------- shapes and validation ---------- */

function packView(p) {
  return {
    id: p.id, name: p.name, description: p.description, sessions: p.sessions, minutes: p.minutes,
    priceCents: p.price_cents ?? p.priceCents ?? null, currency: p.currency
  };
}

function purchaseView(p) {
  return {
    id: p.id, packName: p.pack_name, sessions: p.sessions, status: p.status, amountCents: p.amount_cents,
    discountCents: p.discount_cents, currency: p.currency, note: p.note, createdAt: p.created_at, paidAt: p.paid_at, providerRef: p.provider_ref
  };
}

function validPack(body) {
  const name = clampText(body.name, 80).trim();
  const sessions = Number(body.sessions);
  const minutes = Number(body.minutes ?? 60);
  if (!name) throw new HttpError(400, "A pack needs a name.");
  if (!Number.isInteger(sessions) || sessions < 1 || sessions > 100) throw new HttpError(400, "Sessions: a whole number from 1 to 100.");
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 480) throw new HttpError(400, "Minutes: a whole number from 15 to 480.");
  const priceCents = body.priceCents === null || body.priceCents === undefined || body.priceCents === "" ? null : Number(body.priceCents);
  if (priceCents !== null && (!Number.isInteger(priceCents) || priceCents < 0)) throw new HttpError(400, "Price in cents, whole number.");
  const currency = typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency) ? body.currency : "EUR";
  return {
    name, description: clampText(body.description, 600), sessions, minutes, priceCents, currency,
    active: body.active !== false, position: Number.isInteger(body.position) ? body.position : 0
  };
}

// A percent-off reward waiting to be applied to the referrer's next pack.
async function pendingDiscount(userId) {
  const rows = await sql()`
    select id, reward from referral_events where referrer_id = ${userId} and status = 'rewarded'
      and reward->>'type' = 'percent_off' and (reward->>'applied')::boolean is not true
    order by rewarded_at limit 1
  `;
  if (!rows[0]) return null;
  return { eventId: rows[0].id, percent: Number(rows[0].reward.amount) || 0 };
}

async function rewardReferrer(purchase, context) {
  const events = await sql()`select * from referral_events where referred_id = ${purchase.user_id} and status = 'signed_up'`;
  const event = events[0];
  if (!event) {
    // If this purchase used a pending discount, mark it applied.
    const pending = await pendingDiscount(purchase.user_id);
    if (pending && purchase.discount_cents > 0) {
      await sql()`update referral_events set reward = reward || '{"applied": true}'::jsonb where id = ${pending.eventId}`;
    }
    return;
  }
  const settings = await (async () => {
    const rows = await sql()`select value from settings where key = 'referral_reward'`;
    return rows[0]?.value || { type: "session_credit", amount: 1 };
  })();
  const reward = { type: settings.type, amount: Number(settings.amount) || 0, purchase: purchase.id };
  if (reward.type === "session_credit" && reward.amount > 0) {
    await sql()`insert into credit_ledger (user_id, delta, reason, ref_id, note, created_by) values (${event.referrer_id}, ${reward.amount}, 'referral', ${event.id}, 'referral reward', ${context.actor.user.id})`;
    await sql()`update users set role = 'client' where id = ${event.referrer_id} and role = 'guest'`;
  }
  await sql()`update referral_events set status = 'rewarded', reward = ${JSON.stringify(reward)}::jsonb, rewarded_at = now() where id = ${event.id}`;
  await auditor(context, context.actor.user)(SESSION_EVENTS.referralRewarded, event.referrer_id, { referred: purchase.user_id, reward });
  const referrer = await findUserById(event.referrer_id);
  if (referrer) {
    try {
      await mail.send({
        to: referrer.email,
        subject: "Someone you sent became a client",
        text: reward.type === "session_credit"
          ? `A person you referred just bought their first pack. ${reward.amount} session credit${reward.amount === 1 ? "" : "s"} ${reward.amount === 1 ? "is" : "are"} in your account as thanks.\n\nElliot Himmelfarb\nChama Inteligente`
          : `A person you referred just bought their first pack. ${reward.amount}% off your next pack is waiting; it applies itself when you ask for one.\n\nElliot Himmelfarb\nChama Inteligente`,
        idempotencyKey: `referral-${event.id}-rewarded`
      });
    } catch (error) {
      console.error("Referral mail failed", error instanceof Error ? error.message : "UnknownError");
    }
  }
}
