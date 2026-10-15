import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { formEncode, verifyWebhook, stripeRequest } from "./stripe.js";

const SECRET = "whsec_test_secret";

function signed(body, { secret = SECRET, at = Math.floor(Date.now() / 1000) } = {}) {
  const v1 = crypto.createHmac("sha256", secret).update(`${at}.${body}`).digest("hex");
  return `t=${at},v1=${v1}`;
}

test("form encoding flattens nested objects the way Stripe reads them", () => {
  const text = formEncode({ customer: "cus_1", metadata: { hearth_invoice_id: "abc" }, auto_advance: false });
  assert.equal(text, "customer=cus_1&metadata%5Bhearth_invoice_id%5D=abc&auto_advance=false");
});

test("a correctly signed event is accepted and parsed", () => {
  const body = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
  const event = verifyWebhook(body, signed(body), SECRET);
  assert.equal(event.type, "invoice.paid");
});

test("a tampered body, a wrong secret or an old timestamp is refused", () => {
  const body = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
  assert.equal(verifyWebhook(body.replace("paid", "voided"), signed(body), SECRET), null);
  assert.equal(verifyWebhook(body, signed(body, { secret: "whsec_other" }), SECRET), null);
  assert.equal(verifyWebhook(body, signed(body, { at: Math.floor(Date.now() / 1000) - 3600 }), SECRET), null);
  assert.equal(verifyWebhook(body, "", SECRET), null);
});

test("a request carries the key and idempotency key, and a Stripe error becomes a thrown error", async () => {
  let seen;
  const fetch = async (url, init) => {
    seen = { url, init };
    return new Response(JSON.stringify({ error: { message: "No such customer" } }), { status: 400 });
  };
  await assert.rejects(
    stripeRequest("POST", "/v1/invoices", { customer: "cus_x" }, { key: "sk_test_1", idempotencyKey: "k-1", fetch }),
    /StripeRequestFailed/
  );
  assert.equal(seen.url, "https://api.stripe.com/v1/invoices");
  assert.equal(seen.init.headers.Authorization, "Bearer sk_test_1");
  assert.equal(seen.init.headers["Idempotency-Key"], "k-1");
});
