// Stripe's webhook: what happened to an invoice, signed with
// STRIPE_WEBHOOK_SECRET.
//
// Its own function rather than a Hearth route because it must read the raw
// body to check the signature, and because the Hearth refuses cross-site
// posts by origin. Anything unsigned or badly signed changes nothing. Every
// handled event is idempotent, so Stripe retrying is harmless.

import { configured, ready } from "../lib/hearth/db.js";
import { json } from "../lib/hearth/http.js";
import { stripeConfig, verifyWebhook } from "../lib/hearth/stripe.js";
import { applyStripeInvoice } from "../lib/hearth/routes/invoices.js";

const INVOICE_EVENTS = new Set([
  "invoice.finalized",
  "invoice.paid",
  "invoice.voided",
  "invoice.marked_uncollectible"
]);

export async function handleStripeWebhook(request) {
  if (request.method !== "POST") return json({ error: "Not found." }, 405);
  const { webhookSecret } = stripeConfig();
  if (!webhookSecret || !configured()) return json({ error: "Not configured." }, 503);
  const raw = await request.text();
  const event = verifyWebhook(raw, request.headers.get("stripe-signature"), webhookSecret);
  if (!event) return json({ error: "Bad signature." }, 400);
  if (!INVOICE_EVENTS.has(event.type)) return json({ received: true });
  try {
    await ready();
    const outcome = await applyStripeInvoice(event.data?.object);
    console.log("Stripe event", event.type, outcome);
    return json({ received: true });
  } catch (error) {
    // A 500 makes Stripe retry later, which is what we want.
    console.error("Stripe event failed", event.type, error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    return json({ error: "Failed." }, 500);
  }
}

export default {
  async fetch(request) {
    return await handleStripeWebhook(request);
  }
};
