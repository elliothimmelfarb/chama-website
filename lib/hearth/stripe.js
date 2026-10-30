// Stripe, for invoices members pay after the fact and packs paid by card.
//
// No SDK: the handful of calls the Hearth makes go over fetch, form encoded,
// so tests inject the fetch the same way google.js does. The secret key and
// the webhook signing secret live only in Vercel. Without the key every
// invoice route answers that Stripe is not connected, and nothing else in
// the room changes.
//
// The invoice Stripe hosts is the payment request. In Portugal the fatura
// still comes from certified software, so a Stripe invoice never replaces it.
//
// Card payment for a pack is Stripe's hosted Checkout: the member leaves for
// checkout.stripe.com and comes back, so no Stripe script runs on this domain.

import crypto from "node:crypto";

const API = "https://api.stripe.com";
const TOLERANCE_SECONDS = 300;

export function stripeConfig(env = process.env) {
  const read = (k) => (typeof env[k] === "string" ? env[k].trim() : "");
  const key = read("STRIPE_SECRET_KEY");
  const webhookSecret = read("STRIPE_WEBHOOK_SECRET");
  return { key, webhookSecret, configured: Boolean(key) };
}

// Card payment shows in the room only when Stripe is connected and the owner
// has turned it on under Purchases.
export function cardCheckoutOn(settings, env = process.env) {
  return stripeConfig(env).configured && settings?.card_checkout === true;
}

// Stripe reads nested parameters as bracketed keys: metadata[a]=b, lines[0][x]=y.
export function formEncode(params, prefix = "") {
  const parts = [];
  for (const [name, value] of Object.entries(params || {})) {
    if (value === undefined || value === null) continue;
    const key = prefix ? `${prefix}[${name}]` : name;
    if (typeof value === "object") {
      const inner = formEncode(value, key);
      if (inner) parts.push(inner);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join("&");
}

export async function stripeRequest(method, path, params = {}, options = {}) {
  const key = options.key || stripeConfig().key;
  if (!key) throw new Error("StripeUnconfigured");
  const doFetch = options.fetch || globalThis.fetch;
  const headers = { Authorization: `Bearer ${key}` };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  let url = API + path;
  const init = { method, headers };
  const body = formEncode(params);
  if (method === "GET") {
    if (body) url += "?" + body;
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = body;
  }
  const response = await doFetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Stripe's message names the problem, never a secret; keep it for the log.
    const error = new Error("StripeRequestFailed");
    error.stripeMessage = String(data?.error?.message || response.status).slice(0, 300);
    error.status = response.status;
    throw error;
  }
  return data;
}

// The Stripe-Signature header: t=<unix>,v1=<hex hmac of "t.body">. Returns
// the parsed event, or null for anything that does not check out.
export function verifyWebhook(rawBody, header, secret, now = Date.now()) {
  if (!secret || typeof header !== "string" || !header) return null;
  let at = null;
  const signatures = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") at = Number(v);
    if (k === "v1" && v) signatures.push(v);
  }
  if (!Number.isFinite(at) || !signatures.length) return null;
  if (Math.abs(now / 1000 - at) > TOLERANCE_SECONDS) return null;
  const expected = crypto.createHmac("sha256", secret).update(`${at}.${rawBody}`).digest();
  const match = signatures.some((hex) => {
    const given = Buffer.from(hex, "hex");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  if (!match) return null;
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

/* ---------- the calls the Hearth makes ---------- */

// A customer Elliot already made in the dashboard for this email is reused,
// so one person never ends up as two customers.
export async function createCustomer({ email, name, userId }, options = {}) {
  const existing = await stripeRequest("GET", "/v1/customers", { email, limit: 1 }, options);
  if (Array.isArray(existing?.data) && existing.data[0]?.id) return existing.data[0];
  return await stripeRequest("POST", "/v1/customers", {
    email, name: name || undefined, metadata: { hearth_user_id: userId }
  }, { ...options, idempotencyKey: `hearth-customer-${userId}` });
}

// Who the invoice is made out to: a business's legal name and address, and
// "reverse" when it pays no IVA, so Stripe prints "Reverse charge" too.
export async function updateCustomerBilling(customer, { name, address, reverseCharge }, options = {}) {
  return await stripeRequest("POST", `/v1/customers/${customer}`, {
    name: name || undefined,
    address: address?.line1 ? address : undefined,
    tax_exempt: reverseCharge ? "reverse" : "none"
  }, options);
}

// The Hearth's one IVA rate, 23 percent on top of the price. Found by its
// metadata if it already exists, so the account never collects duplicates.
export async function findOrCreateIvaRate(percentage, options = {}) {
  const list = await stripeRequest("GET", "/v1/tax_rates", { active: true, limit: 100 }, options);
  const found = (list?.data || []).find((r) => r.metadata?.source === "hearth" && Number(r.percentage) === percentage && !r.inclusive);
  if (found) return found.id;
  const made = await stripeRequest("POST", "/v1/tax_rates", {
    display_name: "IVA", percentage, inclusive: false, country: "PT", jurisdiction: "Portugal",
    tax_type: "vat", description: `Portuguese IVA, ${percentage} percent`, metadata: { source: "hearth" }
  }, { ...options, idempotencyKey: `hearth-iva-rate-${percentage}` });
  return made.id;
}

// A draft invoice, its lines, then finalized so it has a number and a page
// to pay on. Every step carries an idempotency key from the Hearth's own
// invoice id, so a retry never makes a second invoice or a doubled line.
export async function issueInvoice({ id, customer, currency, description, daysUntilDue, lines, taxRate, footer, taxId, taxIdName }, options = {}) {
  const draft = await stripeRequest("POST", "/v1/invoices", {
    customer,
    currency: currency.toLowerCase(),
    collection_method: "send_invoice",
    days_until_due: daysUntilDue,
    auto_advance: false,
    pending_invoice_items_behavior: "exclude",
    description: description || undefined,
    // IVA at 23 percent on top, or none with the reason in the footer.
    default_tax_rates: taxRate ? [taxRate] : undefined,
    footer: footer || undefined,
    custom_fields: taxId ? [{ name: `Customer ${taxIdName || "tax ID"}`.slice(0, 40), value: taxId.slice(0, 140) }] : undefined,
    // Card is always offered on Stripe's page, whatever the account's
    // invoice defaults say: members pay in a few clicks without a bank form.
    payment_settings: { payment_method_types: ["card"] },
    metadata: { source: "hearth", hearth_invoice_id: id }
  }, { ...options, idempotencyKey: `hearth-invoice-${id}` });
  for (const [index, line] of lines.entries()) {
    await stripeRequest("POST", "/v1/invoiceitems", {
      customer,
      invoice: draft.id,
      currency: currency.toLowerCase(),
      amount: line.amountCents,
      description: line.description
    }, { ...options, idempotencyKey: `hearth-invoice-${id}-line-${index}` });
  }
  return await stripeRequest("POST", `/v1/invoices/${draft.id}/finalize`, { auto_advance: false }, {
    ...options, idempotencyKey: `hearth-invoice-${id}-finalize`
  });
}

export async function voidInvoice(stripeInvoiceId, options = {}) {
  return await stripeRequest("POST", `/v1/invoices/${stripeInvoiceId}/void`, {}, options);
}

export async function deleteDraft(stripeInvoiceId, options = {}) {
  return await stripeRequest("DELETE", `/v1/invoices/${stripeInvoiceId}`, {}, options);
}

// A hosted Checkout Session for one pack. Stripe asks for the billing
// address and lets a business add its tax ID, both of which the fatura
// needs. invoice_creation makes Stripe issue a paid invoice too, so the
// payment reaches the accountant the same way every other paid invoice on
// this account does. The idempotency key comes from the caller, so a double
// click returns the same session instead of a second one to pay.
export async function createCheckoutSession({ purchaseId, customer, currency, amountCents, name, description, successUrl, cancelUrl, idempotencyKey }, options = {}) {
  const metadata = { source: "hearth", hearth_purchase_id: purchaseId };
  return await stripeRequest("POST", "/v1/checkout/sessions", {
    mode: "payment",
    customer,
    customer_update: { name: "auto", address: "auto" },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    client_reference_id: purchaseId,
    line_items: {
      0: {
        quantity: 1,
        price_data: {
          currency: currency.toLowerCase(),
          unit_amount: amountCents,
          product_data: { name, description: description || undefined }
        }
      }
    },
    invoice_creation: {
      enabled: true,
      invoice_data: { description: `${name}, Chama Inteligente`, metadata }
    },
    payment_intent_data: { description: name, metadata },
    metadata,
    success_url: successUrl,
    cancel_url: cancelUrl
  }, { ...options, idempotencyKey });
}

export async function retrieveCheckoutSession(id, options = {}) {
  return await stripeRequest("GET", `/v1/checkout/sessions/${encodeURIComponent(id)}`, {}, options);
}
