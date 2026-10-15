// Stripe, for invoices members pay after the fact.
//
// No SDK: the handful of calls the Hearth makes go over fetch, form encoded,
// so tests inject the fetch the same way google.js does. The secret key and
// the webhook signing secret live only in Vercel. Without the key every
// invoice route answers that Stripe is not connected, and nothing else in
// the room changes.
//
// The invoice Stripe hosts is the payment request. In Portugal the fatura
// still comes from certified software, so a Stripe invoice never replaces it.

import crypto from "node:crypto";

const API = "https://api.stripe.com";
const TOLERANCE_SECONDS = 300;

export function stripeConfig(env = process.env) {
  const read = (k) => (typeof env[k] === "string" ? env[k].trim() : "");
  const key = read("STRIPE_SECRET_KEY");
  const webhookSecret = read("STRIPE_WEBHOOK_SECRET");
  return { key, webhookSecret, configured: Boolean(key) };
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

// A draft invoice, its lines, then finalized so it has a number and a page
// to pay on. Every step carries an idempotency key from the Hearth's own
// invoice id, so a retry never makes a second invoice or a doubled line.
export async function issueInvoice({ id, customer, currency, description, daysUntilDue, lines }, options = {}) {
  const draft = await stripeRequest("POST", "/v1/invoices", {
    customer,
    currency: currency.toLowerCase(),
    collection_method: "send_invoice",
    days_until_due: daysUntilDue,
    auto_advance: false,
    pending_invoice_items_behavior: "exclude",
    description: description || undefined,
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
