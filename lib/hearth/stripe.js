// Stripe, the card processor behind the Hearth's purchase statuses.
//
// Two things only: create a hosted Checkout Session (the member leaves for
// checkout.stripe.com and comes back, so no Stripe script ever runs on this
// domain), and verify a webhook's signature. Plain fetch and node:crypto, no
// SDK. Card payment exists only while both secrets are set in Vercel; without
// them the room keeps the invoice-first flow and nothing here is reachable.

import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";
const TOLERANCE_SECONDS = 300;

export function configured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

// Stripe-Signature is "t=<unix>,v1=<hex>[,v1=<hex>...]"; v1 is HMAC-SHA256 of
// "<t>.<raw body>" under the endpoint secret. An old timestamp is refused so
// a captured delivery cannot be replayed later.
export function verifySignature(raw, header, secret = process.env.STRIPE_WEBHOOK_SECRET, now = Date.now()) {
  if (!secret || typeof header !== "string") return false;
  let at = null;
  const signatures = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=");
    if (key === "t") at = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  if (!Number.isInteger(at) || !signatures.length) return false;
  if (Math.abs(now / 1000 - at) > TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${at}.${raw}`).digest("hex"));
  return signatures.some((signature) => {
    const given = Buffer.from(signature);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
