import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { useClient } from "../db.js";
import { fakeDb, makeRequest } from "../test-helpers.js";
import { handleHearth } from "../../../api/hearth.js";

process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_EMAIL_DOMAIN;
process.env.ADMIN_EMAILS = "";
process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";

const HOST = "chamainteligente.com";

const PURCHASE = {
  id: "purchase-1",
  user_id: "member-1",
  pack_id: "pack-1",
  pack_name: "Four sessions",
  sessions: 4,
  status: "requested",
  amount_cents: 40000,
  discount_cents: 0,
  currency: "EUR",
  note: ""
};

// Signs a payload the way Stripe does: v1 is HMAC-SHA256 over "t.body".
function signed(payload, { secret = process.env.STRIPE_WEBHOOK_SECRET, at = Math.floor(Date.now() / 1000) } = {}) {
  const raw = JSON.stringify(payload);
  const v1 = createHmac("sha256", secret).update(`${at}.${raw}`).digest("hex");
  return makeRequest(`https://${HOST}/api/hearth/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": `t=${at},v1=${v1}` },
    body: raw
  });
}

function completed({ paymentStatus = "paid", type = "checkout.session.completed" } = {}) {
  return {
    id: "evt_1",
    type,
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        client_reference_id: "purchase-1",
        metadata: { purchase_id: "purchase-1" },
        payment_status: paymentStatus,
        amount_total: 40000,
        currency: "eur",
        customer_details: { email: "member@example.com", name: "Member" }
      }
    }
  };
}

// The compare-and-set that claims the purchase answers with the row only the
// first time, the way Postgres would for two deliveries of the same event.
function webhookDb({ claimed = true } = {}) {
  return fakeDb([
    [/update purchases set status = 'paid'/, claimed ? [{ ...PURCHASE, status: "paid" }] : []],
    [/from referral_events where referred_id/, []]
  ]);
}

async function quiet(run) {
  const was = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = was;
  }
}

test("a paid checkout session adds the pack's credits to the member", async () => {
  const db = webhookDb();
  useClient(db);
  const response = await quiet(() => handleHearth(signed(completed())));
  assert.equal(response.status, 200);
  const credit = db.matching(/insert into credit_ledger/);
  assert.equal(credit.length, 1);
  assert.ok(/'purchase'/.test(credit[0].text));
  assert.deepEqual(credit[0].values.slice(0, 3), ["member-1", 4, "purchase-1"]);
});
