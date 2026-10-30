// Invoices through Stripe, for members who pay after the fact.
//
// The owner makes an invoice for one member from the sessions they held
// while billed after, the sessions recorded for them without a booking, a
// pack they asked for, or lines typed by hand. The Hearth makes the Stripe customer and invoice, finalizes it so it
// has a number and a page to pay on, marks those sessions invoiced (or the
// pack invoiced), and emails the member the link. The member sees every
// invoice in their account with a way to pay it.
//
// Stripe tells the Hearth what happened through the webhook
// (api/stripe-webhook.js), which calls applyStripeInvoice here. Paid is a
// compare-and-set, so a replayed event never adds credits twice.
//
// The Stripe account is shared with ShopIntake and AI Made Games, so the
// Hearth only ever follows invoices it made itself (metadata source=hearth).
// Until 2026-10-30 an invoice sent from the Stripe dashboard attached itself
// to the member with that email, and an AI Made Games promotion showed up in
// the owner's own account. ShopIntake's webhook still turns every paid
// invoice into a fatura notice, Hearth ones included, which is what the
// accountant needs.
//
// Paying for a pack by card before booking is Stripe Checkout, in checkout.js.

import { sql } from "../db.js";
import { HttpError, json, readJson, clampText, requestOrigin } from "../http.js";
import { audit, auditor } from "../audit.js";
import { findUserById } from "../users.js";
import * as mail from "../mail.js";
import * as stripe from "../stripe.js";
import { markPurchasePaid } from "./sessions.js";

export const INVOICE_EVENTS = {
  created: "invoice.created",
  voided: "invoice.voided",
  paid: "invoice.paid",
  reminded: "invoice.reminded"
};

const NOT_CONNECTED = "Stripe is not connected yet. Add STRIPE_SECRET_KEY in Vercel.";
const MAX_LINES = 50;
const MAX_LINE_CENTS = 10000000;

export function invoiceView(i) {
  return {
    id: i.id,
    userId: i.user_id,
    number: i.number || null,
    status: i.status,
    description: i.description || "",
    lines: Array.isArray(i.lines) ? i.lines : [],
    amountCents: i.amount_cents,
    currency: i.currency,
    purchaseId: i.purchase_id || null,
    // Only a live invoice has somewhere to pay; a paid one keeps its page as the receipt.
    hostedUrl: i.status === "open" || i.status === "paid" ? i.hosted_url || null : null,
    pdfUrl: i.pdf_url || null,
    dueAt: i.due_at || null,
    createdAt: i.created_at,
    paidAt: i.paid_at || null,
    voidedAt: i.voided_at || null,
    member: i.member_email ? { id: i.user_id, email: i.member_email, name: i.member_name } : undefined
  };
}

function validLines(raw) {
  if (!Array.isArray(raw) || !raw.length) throw new HttpError(400, "An invoice needs at least one line.");
  if (raw.length > MAX_LINES) throw new HttpError(400, `At most ${MAX_LINES} lines.`);
  return raw.map((line) => {
    const description = clampText(line?.description, 200).trim();
    const amountCents = Number(line?.amountCents);
    if (!description) throw new HttpError(400, "Every line needs a description.");
    if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > MAX_LINE_CENTS) {
      throw new HttpError(400, "Every line needs an amount in cents, a whole number above zero.");
    }
    return { description, amountCents };
  });
}

function money(cents, currency) {
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

async function ownerEmail() {
  const rows = await sql()`select email from users where role = 'owner' and status = 'active' order by created_at limit 1`;
  return rows[0]?.email || null;
}

async function mailMember(member, invoice, origin, { reminder = false } = {}) {
  const due = invoice.due_at ? new Date(invoice.due_at).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "Europe/Lisbon" }) : null;
  const total = money(invoice.amount_cents, invoice.currency);
  await mail.send({
    to: member.email,
    subject: `${reminder ? "Reminder: invoice" : "Invoice"} ${invoice.number || ""} from Chama Inteligente`.replace(/\s+/g, " ").trim(),
    text:
      `Hi ${member.name || "there"},\n\n` +
      `${reminder ? "A reminder about your" : "Here is your"} invoice for ${total}${due ? `, due ${due}` : ""}.\n\n` +
      `Pay it here: ${invoice.hosted_url}\n\n` +
      `It is also in the Hearth under Sessions, with every invoice you have had: ${origin}/hearth/sessions\n\n` +
      `Elliot Himmelfarb\nChama Inteligente`,
    idempotencyKey: reminder ? `invoice-${invoice.id}-reminder-${Date.now()}` : `invoice-${invoice.id}-issued`
  });
}

// What one member has waiting to be invoiced, for the owner's form.
async function sourcesFor(userId) {
  const [bookings, recorded, purchases, packs, settings] = await Promise.all([
    sql()`
      select id, starts_at, ends_at, status from bookings
      where user_id = ${userId} and billing = 'after' and invoiced_at is null
        and status in ('scheduled', 'completed', 'no_show') and starts_at < now()
      order by starts_at
    `,
    // Sessions recorded with no booking behind them, which is how most are
    // held: nothing else says they happened, so nothing else bills them.
    sql()`
      select id, title, held_at from transcripts
      where user_id = ${userId} and booking_id is null and invoice_id is null
      order by held_at
    `,
    sql()`
      select id, pack_name, sessions, status, amount_cents, discount_cents, currency from purchases
      where user_id = ${userId} and status in ('requested', 'invoiced')
        and not exists (select 1 from invoices i where i.purchase_id = purchases.id and i.status in ('open', 'paid', 'draft'))
      order by created_at
    `,
    sql()`select price_cents, sessions from packs where active and price_cents is not null order by sessions, price_cents`,
    sql()`select value from settings where key = 'session_price_cents'`
  ]);
  // A sensible default price for one session: the last one invoiced, else
  // the single-session pack, else the dearest per-session price on offer.
  const single = packs.find((p) => p.sessions === 1);
  const remembered = Number.isInteger(settings[0]?.value) ? settings[0].value : null;
  const perSession = remembered || (single ? single.price_cents : packs.length ? Math.max(...packs.map((p) => Math.round(p.price_cents / p.sessions))) : null);
  return {
    bookings: bookings.map((b) => ({ id: b.id, startsAt: b.starts_at, endsAt: b.ends_at, status: b.status })),
    recorded: recorded.map((t) => ({ id: t.id, title: t.title || "", heldAt: t.held_at })),
    purchases: purchases.map((p) => ({
      id: p.id, packName: p.pack_name, sessions: p.sessions, status: p.status,
      amountCents: p.amount_cents, discountCents: p.discount_cents, currency: p.currency
    })),
    sessionPriceCents: perSession
  };
}

// Undo what an invoice marked, once it is void: its sessions can be invoiced
// again and its pack goes back to requested.
async function releaseInvoice(invoice) {
  await sql()`update bookings set invoiced_at = null, invoice_id = null where invoice_id = ${invoice.id}`;
  await sql()`update transcripts set invoice_id = null where invoice_id = ${invoice.id}`;
  if (invoice.purchase_id) {
    await sql()`update purchases set status = 'requested', provider_ref = null where id = ${invoice.purchase_id} and status = 'invoiced'`;
  }
}

export function registerInvoiceRoutes({ route, needs }) {
  /* ---------- the member's side ---------- */

  // A person's own invoices are theirs to see whatever their role: a guest
  // can be billed before they are a client.
  route("GET", "/invoices", async (context) => {
    needs(context);
    const rows = await sql()`
      select * from invoices where user_id = ${context.actor.user.id} and status in ('open', 'paid', 'void', 'uncollectible')
      order by created_at desc limit 100
    `;
    return json({ invoices: rows.map(invoiceView) });
  });

  /* ---------- the owner's side ---------- */

  route("GET", "/admin/invoices", async (context) => {
    needs(context, "purchases.manage");
    const url = new URL(context.request.url);
    const memberId = url.searchParams.get("member") || "";
    const rows = await sql()`
      select i.*, u.email as member_email, u.name as member_name from invoices i join users u on u.id = i.user_id
      where (${memberId} = '' or i.user_id::text = ${memberId}) and i.status <> 'failed'
      order by i.created_at desc limit 300
    `;
    return json({ configured: stripe.stripeConfig().configured, invoices: rows.map(invoiceView) });
  });

  // Everyone with sessions waiting to be invoiced, booked or only recorded,
  // so billing a month is one click per person.
  route("GET", "/admin/invoice-ready", async (context) => {
    needs(context, "purchases.manage");
    const rows = await sql()`
      select u.id, u.email, u.name, count(*)::int as waiting, min(w.at) as first_at from (
        select user_id, starts_at as at from bookings
        where billing = 'after' and invoiced_at is null and status in ('scheduled', 'completed', 'no_show') and starts_at < now()
        union all
        select user_id, held_at as at from transcripts where booking_id is null and invoice_id is null
      ) w join users u on u.id = w.user_id
      group by u.id, u.email, u.name
      order by min(w.at)
    `;
    return json({
      configured: stripe.stripeConfig().configured,
      members: rows.map((r) => ({ id: r.id, email: r.email, name: r.name, waiting: r.waiting, firstAt: r.first_at }))
    });
  });

  route("GET", "/admin/invoice-sources/:userId", async (context, params) => {
    needs(context, "purchases.manage");
    const member = await findUserById(params.userId);
    if (!member) throw new HttpError(404, "Not found.");
    return json({
      configured: stripe.stripeConfig().configured,
      member: { id: member.id, email: member.email, name: member.name, billing: member.billing || "prebuy" },
      ...(await sourcesFor(member.id))
    });
  });

  route("POST", "/admin/invoices", async (context) => {
    needs(context, "purchases.manage");
    if (!stripe.stripeConfig().configured) throw new HttpError(503, NOT_CONNECTED);
    const body = await readJson(context.request);
    const member = await findUserById(String(body.userId || ""));
    if (!member) throw new HttpError(404, "Not found.");
    const lines = validLines(body.lines);
    const daysUntilDue = Number.isInteger(body.daysUntilDue) && body.daysUntilDue >= 0 && body.daysUntilDue <= 365 ? body.daysUntilDue : 14;
    const description = clampText(body.description, 500, { multiline: true });

    // Sessions on the invoice must be this member's, billed after, held and
    // not yet invoiced. Checked before Stripe hears about anything.
    const bookingIds = Array.isArray(body.bookingIds) ? [...new Set(body.bookingIds.map(String))].slice(0, 200) : [];
    if (bookingIds.length) {
      const held = await sql()`select id, user_id, billing, invoiced_at, starts_at, status from bookings where id = any(${bookingIds})`;
      const fine = held.filter((b) => b.user_id === member.id && b.billing === "after" && !b.invoiced_at && b.status !== "cancelled");
      if (fine.length !== bookingIds.length) throw new HttpError(400, "Some of those sessions are not this member's or are already invoiced. Reload and try again.");
    }
    const transcriptIds = Array.isArray(body.transcriptIds) ? [...new Set(body.transcriptIds.map(String))].slice(0, 200) : [];
    if (transcriptIds.length) {
      const recorded = await sql()`select id, user_id, booking_id, invoice_id from transcripts where id = any(${transcriptIds})`;
      const fine = recorded.filter((t) => t.user_id === member.id && !t.booking_id && !t.invoice_id);
      if (fine.length !== transcriptIds.length) throw new HttpError(400, "Some of those recorded sessions are not this member's or are already invoiced. Reload and try again.");
    }
    const sessionPrice = Number(body.sessionPriceCents);
    let purchase = null;
    if (body.purchaseId) {
      const rows = await sql()`select * from purchases where id = ${String(body.purchaseId)}`;
      purchase = rows[0];
      if (!purchase || purchase.user_id !== member.id || !["requested", "invoiced"].includes(purchase.status)) {
        throw new HttpError(400, "That pack request is not open for this member.");
      }
    }
    const currency = purchase?.currency || "EUR";
    const total = lines.reduce((sum, line) => sum + line.amountCents, 0);

    let customer;
    try {
      customer = await customerFor(member);
    } catch (error) {
      console.error("Stripe customer failed", error?.stripeMessage || error?.message || "UnknownError");
      throw new HttpError(502, `Stripe did not accept the customer: ${error?.stripeMessage || "unknown error"}`);
    }

    const created = await sql()`
      insert into invoices (user_id, status, description, lines, amount_cents, currency, purchase_id, created_by)
      values (${member.id}, 'draft', ${description}, ${JSON.stringify(lines)}::jsonb, ${total}, ${currency}, ${purchase?.id || null}, ${context.actor.user.id})
      returning *
    `;
    const local = created[0];
    let issued;
    try {
      issued = await stripe.issueInvoice({ id: local.id, customer, currency, description, daysUntilDue, lines });
    } catch (error) {
      await sql()`update invoices set status = 'failed' where id = ${local.id}`;
      console.error("Stripe invoice failed", error?.stripeMessage || error?.message || "UnknownError");
      throw new HttpError(502, `Stripe did not accept the invoice: ${error?.stripeMessage || "unknown error"}`);
    }
    const rows = await sql()`
      update invoices set stripe_invoice_id = ${issued.id}, number = ${issued.number || null}, status = ${issued.status || "open"},
        amount_cents = ${Number.isInteger(issued.amount_due) ? issued.amount_due : total},
        hosted_url = ${issued.hosted_invoice_url || null}, pdf_url = ${issued.invoice_pdf || null},
        due_at = ${issued.due_date ? new Date(issued.due_date * 1000).toISOString() : null}
      where id = ${local.id} returning *
    `;
    const invoice = rows[0] || local;
    if (bookingIds.length) {
      await sql()`update bookings set invoiced_at = now(), invoice_id = ${invoice.id} where id = any(${bookingIds}) and user_id = ${member.id} and invoiced_at is null`;
    }
    if (transcriptIds.length) {
      await sql()`update transcripts set invoice_id = ${invoice.id} where id = any(${transcriptIds}) and user_id = ${member.id} and invoice_id is null`;
    }
    // The price per session, so the next invoice starts from it.
    if ((bookingIds.length || transcriptIds.length) && Number.isInteger(sessionPrice) && sessionPrice > 0 && sessionPrice <= MAX_LINE_CENTS) {
      await sql()`
        insert into settings (key, value, updated_by) values ('session_price_cents', ${JSON.stringify(sessionPrice)}::jsonb, ${context.actor.user.id})
        on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by
      `;
    }
    if (purchase) {
      await sql()`update purchases set status = 'invoiced', provider = 'stripe', provider_ref = ${invoice.number || issued.id} where id = ${purchase.id} and status in ('requested', 'invoiced')`;
    }
    await auditor(context, context.actor.user)(INVOICE_EVENTS.created, invoice.id, { member: member.id, amount: invoice.amount_cents, sessions: bookingIds.length + transcriptIds.length, purchase: purchase?.id || null });

    let emailed = false;
    if (body.email !== false && invoice.hosted_url) {
      try {
        await mailMember(member, invoice, requestOrigin(context.request));
        emailed = true;
      } catch (error) {
        console.error("Invoice mail failed", error instanceof Error ? error.message : "UnknownError");
      }
    }
    return json({ ok: true, emailed, invoice: invoiceView(invoice) });
  });

  route("POST", "/admin/invoices/:id/void", async (context, params) => {
    needs(context, "purchases.manage");
    const rows = await sql()`select * from invoices where id = ${params.id}`;
    const invoice = rows[0];
    if (!invoice) throw new HttpError(404, "Not found.");
    if (invoice.status !== "open") throw new HttpError(400, "Only an open invoice can be voided.");
    try {
      await stripe.voidInvoice(invoice.stripe_invoice_id);
    } catch (error) {
      console.error("Stripe void failed", error?.stripeMessage || error?.message || "UnknownError");
      throw new HttpError(502, `Stripe did not void it: ${error?.stripeMessage || "unknown error"}`);
    }
    const voided = await sql()`update invoices set status = 'void', voided_at = now() where id = ${invoice.id} and status = 'open' returning *`;
    if (voided[0]) {
      await releaseInvoice(invoice);
      await auditor(context, context.actor.user)(INVOICE_EVENTS.voided, invoice.id);
    }
    return json({ ok: true });
  });

  route("POST", "/admin/invoices/:id/remind", async (context, params) => {
    needs(context, "purchases.manage");
    const rows = await sql()`select * from invoices where id = ${params.id}`;
    const invoice = rows[0];
    if (!invoice) throw new HttpError(404, "Not found.");
    if (invoice.status !== "open" || !invoice.hosted_url) throw new HttpError(400, "Only an open invoice can be sent again.");
    const member = await findUserById(invoice.user_id);
    if (!member) throw new HttpError(404, "Not found.");
    try {
      await mailMember(member, invoice, requestOrigin(context.request), { reminder: true });
    } catch (error) {
      console.error("Invoice reminder failed", error instanceof Error ? error.message : "UnknownError");
      throw new HttpError(502, "The email did not go out. Try again in a minute.");
    }
    await auditor(context, context.actor.user)(INVOICE_EVENTS.reminded, invoice.id);
    return json({ ok: true });
  });
}

// The member's Stripe customer, made the first time Stripe needs one.
export async function customerFor(member) {
  if (member.stripe_customer_id) return member.stripe_customer_id;
  const customer = (await stripe.createCustomer({ email: member.email, name: member.name, userId: member.id })).id;
  await sql()`update users set stripe_customer_id = ${customer} where id = ${member.id}`;
  return customer;
}

/* ---------- what Stripe tells us ---------- */

const SYSTEM = { actor: null, actorKind: "system", actorRef: "stripe", country: "", device: "" };

// One Stripe invoice object, whatever event carried it: find or attach the
// Hearth's row, then follow Stripe's status. Returns what it did, for the log.
export async function applyStripeInvoice(object, { origin = "https://chamainteligente.com" } = {}) {
  if (!object || typeof object.id !== "string") return "ignored";
  const known = await sql()`select * from invoices where stripe_invoice_id = ${object.id}`;
  let invoice = known[0];
  if (!invoice && object.metadata?.hearth_invoice_id) {
    // Made here, and Stripe's event beat the row's update.
    const byId = await sql()`select * from invoices where id = ${String(object.metadata.hearth_invoice_id)} and stripe_invoice_id is null`;
    invoice = byId[0];
    if (invoice) await sql()`update invoices set stripe_invoice_id = ${object.id} where id = ${invoice.id}`;
  }
  // Anything else on the shared account (ShopIntake, AI Made Games, an
  // invoice sent from the dashboard) is not the Hearth's business.
  if (!invoice) return "not-ours";

  if (object.status === "paid") {
    const claimed = await sql()`
      update invoices set status = 'paid', paid_at = now(), hosted_url = coalesce(${object.hosted_invoice_url || null}, hosted_url),
        pdf_url = coalesce(${object.invoice_pdf || null}, pdf_url)
      where id = ${invoice.id} and status <> 'paid' returning *
    `;
    if (!claimed[0]) return "already-paid";
    await audit({ ...SYSTEM, event: INVOICE_EVENTS.paid, target: invoice.id, meta: { amount: Number(object.amount_paid) || null } });
    if (claimed[0].purchase_id) {
      const purchases = await sql()`select * from purchases where id = ${claimed[0].purchase_id}`;
      if (purchases[0]) await markPurchasePaid(purchases[0], { context: SYSTEM, origin });
    }
    const owner = await ownerEmail();
    const member = await findUserById(invoice.user_id);
    if (owner) {
      try {
        await mail.send({
          to: owner,
          subject: `Invoice paid: ${member?.name || member?.email || "a member"}`,
          text: `${invoice.number || "An invoice"} for ${money(Number(object.amount_paid) || invoice.amount_cents, invoice.currency)} was paid through Stripe.${claimed[0].purchase_id ? " The pack's credits are in their account." : ""}\n\nIssue the fatura from the certified software as usual.\n\n${origin}/hearth/admin/invoices`,
          idempotencyKey: `invoice-${invoice.id}-paid-owner`
        });
      } catch (error) {
        console.error("Invoice paid mail failed", error instanceof Error ? error.message : "UnknownError");
      }
    }
    return "paid";
  }
  if (object.status === "void") {
    const voided = await sql()`update invoices set status = 'void', voided_at = now() where id = ${invoice.id} and status <> 'void' and status <> 'paid' returning *`;
    if (voided[0]) {
      await releaseInvoice(invoice);
      await audit({ ...SYSTEM, event: INVOICE_EVENTS.voided, target: invoice.id });
    }
    return "void";
  }
  if (object.status === "uncollectible") {
    await sql()`update invoices set status = 'uncollectible' where id = ${invoice.id} and status = 'open'`;
    return "uncollectible";
  }
  if (object.status === "open") {
    await sql()`
      update invoices set number = coalesce(${object.number || null}, number), hosted_url = coalesce(${object.hosted_invoice_url || null}, hosted_url),
        pdf_url = coalesce(${object.invoice_pdf || null}, pdf_url)
      where id = ${invoice.id}
    `;
    return "open";
  }
  return "ignored";
}
