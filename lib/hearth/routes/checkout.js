// Paying for a pack by card, through Stripe's hosted Checkout.
//
// A member asks for a pack the usual way (a purchase, status requested), and
// "Pay by card" sends them to checkout.stripe.com for that purchase. Nothing
// from Stripe runs on this domain. Three things can tell the Hearth the card
// was paid, and all three end in settleCheckout:
//
// - the member coming back to /hearth/sessions/packs, which asks Stripe about
//   the session the purchase remembers;
// - Stripe's webhook (api/stripe-webhook.js), on checkout.session.completed
//   or checkout.session.async_payment_succeeded;
// - the hourly sweep in api/hearth-cron.js, for a member who closed the tab
//   and a webhook endpoint that was never told about Checkout events.
//
// Paid is the same compare-and-set as the owner's Mark paid, so whichever
// arrives first adds the credits and the others add nothing. The purchase is
// found only through the session the Hearth made: metadata the server wrote,
// or the session id it stored. Nothing a visitor sends is believed.
//
// Card payment shows in the room only while Stripe is connected and the
// owner has turned it on under Purchases (settings.card_checkout). Stripe's
// receipt is not a fatura: every card payment emails the owner what the
// accountant needs, and Stripe also issues a paid invoice, which the
// account's existing invoice.paid notice reaches.

import { sql } from "../db.js";
import { HttpError, json, requestOrigin } from "../http.js";
import { audit, auditor } from "../audit.js";
import { findUserById } from "../users.js";
import * as mail from "../mail.js";
import * as stripe from "../stripe.js";
import { markPurchasePaid } from "./sessions.js";
import { customerFor } from "./invoices.js";

export const CHECKOUT_EVENTS = {
  started: "purchase.checkout_started",
  duplicate: "purchase.card_duplicate"
};

const SITE = "https://chamainteligente.com";
const SYSTEM = { actor: null, actorKind: "system", actorRef: "stripe", country: "", device: "" };
// Stripe refuses a euro charge under 50 cents.
const MIN_CENTS = 50;
// Long enough for a bank-debit method to clear; a card settles in seconds.
const SWEEP_DAYS = 15;
const UNAVAILABLE = "Card payment is not available. Ask for the pack and Elliot will send an invoice.";
const BROKEN = "Card payment is not working right now. Elliot has been told, and he can send you an invoice instead.";

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

async function tellOwner({ subject, text, idempotencyKey }) {
  const owner = await ownerEmail();
  if (!owner) return;
  try {
    await mail.send({ to: owner, subject, text, idempotencyKey });
  } catch (error) {
    console.error("Checkout owner mail failed", error instanceof Error ? error.message : "UnknownError");
  }
}

function dashboardLink(session) {
  return typeof session.payment_intent === "string" ? `https://dashboard.stripe.com/payments/${session.payment_intent}` : "";
}

// What the buyer typed at checkout, for the fatura. Visitor text: it goes to
// the owner labelled as such and is never acted on.
function billingLines(session) {
  const d = session.customer_details || {};
  const a = d.address || {};
  const address = [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(" "), a.state, a.country].filter(Boolean).join(", ");
  const taxIds = Array.isArray(d.tax_ids) ? d.tax_ids.map((t) => `${t.value} (${t.type})`).join(", ") : "";
  return [
    `Name: ${d.name || "not given"}`,
    `Email: ${d.email || "not given"}`,
    `Address: ${address || "not given"}`,
    `Tax ID: ${taxIds || "none given"}`
  ].map((line) => line.slice(0, 300)).join("\n");
}

// A pack paid by card no longer needs the invoice Elliot may have sent for
// it, and leaving it open invites a second payment.
async function voidOpenInvoices(purchaseId) {
  const rows = await sql()`select id, stripe_invoice_id, number from invoices where purchase_id = ${purchaseId} and status = 'open'`;
  const voided = [];
  const stuck = [];
  for (const invoice of rows) {
    try {
      if (invoice.stripe_invoice_id) await stripe.voidInvoice(invoice.stripe_invoice_id);
      await sql()`update invoices set status = 'void', voided_at = now() where id = ${invoice.id} and status = 'open'`;
      voided.push(invoice.number || invoice.stripe_invoice_id || invoice.id);
    } catch (error) {
      console.error("Checkout invoice void failed", error?.stripeMessage || error?.message || "UnknownError");
      stuck.push(invoice.number || invoice.stripe_invoice_id || invoice.id);
    }
  }
  return { voided, stuck };
}

// One Checkout Session, from whichever path saw it. Returns what it did.
export async function settleCheckout(session, { origin = SITE } = {}) {
  const purchaseId = session?.metadata?.source === "hearth" ? session.metadata.hearth_purchase_id : null;
  // The Stripe account is shared with ShopIntake; its sessions are not ours.
  if (!purchaseId || typeof session.id !== "string") return "not-ours";
  if (session.payment_status !== "paid") return "unpaid";
  const rows = await sql()`select * from purchases where id = ${String(purchaseId)}`;
  const purchase = rows[0];
  if (!purchase) return "no-purchase";
  const member = await findUserById(purchase.user_id);
  const who = member ? `${member.name || "A member"} <${member.email}>` : "A member";
  const amount = money(Number(session.amount_total) || 0, String(session.currency || purchase.currency || "EUR").toUpperCase());

  const marked = await markPurchasePaid(purchase, { context: SYSTEM, origin, provider: "stripe_checkout", providerRef: session.id });
  if (marked) {
    const { voided, stuck } = await voidOpenInvoices(purchase.id);
    const invoiceNote = [
      voided.length ? `The open invoice ${voided.join(", ")} for this pack was voided in Stripe.` : "",
      stuck.length ? `The invoice ${stuck.join(", ")} for this pack is still open and could not be voided. Void it in Stripe so they are not asked to pay twice.` : ""
    ].filter(Boolean).join("\n");
    await tellOwner({
      subject: `Card payment: ${member?.name || member?.email || "a member"}, ${purchase.pack_name}`,
      text:
        `${who} paid ${amount} by card for ${purchase.pack_name} (${purchase.sessions} sessions). The credits are in their account.\n\n` +
        `For the fatura, as they entered it at checkout (untrusted, as written):\n${billingLines(session)}\n\n` +
        (invoiceNote ? invoiceNote + "\n\n" : "") +
        `Stripe: ${dashboardLink(session) || session.id}\n\n` +
        `Issue the fatura from the certified software as usual.\n\n${origin}/hearth/admin/purchases`,
      idempotencyKey: `checkout-${session.id}-paid-owner`
    });
    return "paid";
  }

  // Someone else marked it first. If it was this very payment, it is a
  // repeat. Otherwise the pack was already paid another way, or voided, and
  // this card payment is one too many: no credits, and the owner decides
  // whether to refund it.
  const now = (await sql()`select status, provider_ref from purchases where id = ${purchase.id}`)[0];
  if (now?.status === "paid" && now.provider_ref === session.id) return "already-paid";
  await audit({ ...SYSTEM, event: CHECKOUT_EVENTS.duplicate, target: purchase.id, meta: { session: session.id, status: now?.status || null } });
  await tellOwner({
    subject: `Check this card payment: ${member?.name || member?.email || "a member"}, ${purchase.pack_name}`,
    text:
      `${who} paid ${amount} by card for ${purchase.pack_name}, but that pack was already ${now?.status === "void" ? "voided" : "paid another way"}. No credits were added for this payment.\n\n` +
      `If it should not stand, refund it in Stripe: ${dashboardLink(session) || session.id}\n\n${origin}/hearth/admin/purchases`,
    idempotencyKey: `checkout-${session.id}-duplicate-owner`
  });
  return "duplicate";
}

// The hourly safety net: every purchase with a recent session that is not
// settled yet is checked with Stripe once.
export async function sweepCheckouts({ now = new Date() } = {}) {
  if (!stripe.stripeConfig().configured) return { checked: 0, paid: 0 };
  const since = new Date(now.getTime() - SWEEP_DAYS * 86400000).toISOString();
  const rows = await sql()`
    select id, checkout_session_id from purchases
    where checkout_session_id is not null and status in ('requested', 'invoiced') and checkout_started_at > ${since}
    order by checkout_started_at limit 20
  `;
  let paid = 0;
  for (const row of rows) {
    try {
      const session = await stripe.retrieveCheckoutSession(row.checkout_session_id);
      if (session.status === "expired") {
        await sql()`update purchases set checkout_session_id = null where id = ${row.id} and checkout_session_id = ${row.checkout_session_id}`;
        continue;
      }
      if ((await settleCheckout(session)) === "paid") paid += 1;
    } catch (error) {
      console.error("Checkout sweep failed", error?.stripeMessage || error?.message || "UnknownError");
    }
  }
  return { checked: rows.length, paid };
}

export function registerCheckoutRoutes({ route, needs, readSettings }) {
  async function ownPurchase(context, id) {
    const rows = await sql()`select * from purchases where id = ${id} and user_id = ${context.actor.user.id}`;
    if (!rows[0]) throw new HttpError(404, "Not found.");
    return rows[0];
  }

  route("POST", "/purchases/:id/checkout", async (context, params) => {
    needs(context, "packs.buy");
    if (!stripe.cardCheckoutOn(await readSettings())) throw new HttpError(404, UNAVAILABLE);
    const user = context.actor.user;
    const purchase = await ownPurchase(context, params.id);
    if (purchase.status === "paid") return json({ paid: true });
    if (purchase.status === "invoiced") throw new HttpError(400, "This pack has an invoice already. Pay it from the invoice under Sessions.");
    if (purchase.status !== "requested") throw new HttpError(400, "This request is closed. Ask for the pack again.");
    if (purchase.amount_cents === null || purchase.amount_cents === undefined) throw new HttpError(400, UNAVAILABLE);
    const net = purchase.amount_cents - (purchase.discount_cents || 0);
    if (net < MIN_CENTS) throw new HttpError(400, UNAVAILABLE);
    const origin = requestOrigin(context.request);

    // The session already made for this purchase, while it can still be
    // paid, rather than a second one.
    if (purchase.checkout_session_id) {
      let existing = null;
      try {
        existing = await stripe.retrieveCheckoutSession(purchase.checkout_session_id);
      } catch (error) {
        console.error("Checkout lookup failed", error?.stripeMessage || error?.message || "UnknownError");
      }
      if (existing?.status === "open" && existing.url) return json({ url: existing.url });
      if (existing?.status === "complete") {
        const outcome = await settleCheckout(existing, { origin });
        if (outcome === "paid" || outcome === "already-paid") return json({ paid: true });
        if (existing.payment_status === "unpaid") return json({ processing: true });
      }
    }

    let session;
    try {
      const customer = await customerFor(user);
      session = await stripe.createCheckoutSession({
        purchaseId: purchase.id,
        customer,
        currency: purchase.currency || "EUR",
        amountCents: net,
        name: purchase.pack_name,
        description: `${purchase.sessions} coaching session${purchase.sessions === 1 ? "" : "s"} with Elliot Himmelfarb`,
        successUrl: `${origin}/hearth/sessions/packs?checkout=done&purchase=${encodeURIComponent(purchase.id)}`,
        cancelUrl: `${origin}/hearth/sessions/packs?checkout=cancelled`,
        idempotencyKey: `hearth-checkout-${purchase.id}-${purchase.checkout_session_id || "first"}-${net}`
      });
    } catch (error) {
      const reason = error?.stripeMessage || error?.message || "unknown error";
      console.error("Checkout session failed", reason);
      await tellOwner({
        subject: "Card payment failed to start",
        text:
          `${user.name || "A member"} <${user.email}> tried to pay for ${purchase.pack_name} by card, and Stripe refused to start the checkout:\n\n${reason}\n\n` +
          `They were told you can send an invoice instead. If the key cannot make Checkout Sessions, turn card payment off under Purchases until it can.\n\n${origin}/hearth/admin/purchases`,
        idempotencyKey: `checkout-${purchase.id}-failed-${new Date().toISOString().slice(0, 10)}`
      });
      throw new HttpError(502, BROKEN);
    }
    if (typeof session?.url !== "string" || !session.url.startsWith("https://")) throw new HttpError(502, BROKEN);
    await sql()`update purchases set checkout_session_id = ${session.id}, checkout_started_at = now() where id = ${purchase.id} and status = 'requested'`;
    await auditor(context, user)(CHECKOUT_EVENTS.started, purchase.id, { amount: net, session: session.id });
    return json({ url: session.url });
  });

  // The member is back from Stripe. Whatever the address bar says, the answer
  // comes from Stripe about the session this purchase remembers.
  route("POST", "/purchases/:id/checkout/confirm", async (context, params) => {
    needs(context, "packs.buy");
    const purchase = await ownPurchase(context, params.id);
    if (purchase.status === "paid") return json({ status: "paid", sessions: purchase.sessions });
    if (!purchase.checkout_session_id || !stripe.stripeConfig().configured) return json({ status: "unknown" });
    let session;
    try {
      session = await stripe.retrieveCheckoutSession(purchase.checkout_session_id);
    } catch (error) {
      console.error("Checkout confirm failed", error?.stripeMessage || error?.message || "UnknownError");
      return json({ status: "unknown" });
    }
    const outcome = await settleCheckout(session, { origin: requestOrigin(context.request) });
    if (outcome === "paid" || outcome === "already-paid") return json({ status: "paid", sessions: purchase.sessions });
    if (session.status === "complete") return json({ status: "processing" });
    return json({ status: "open" });
  });
}
