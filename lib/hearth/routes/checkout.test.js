import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { afterEach } from "node:test";

import { useClient } from "../db.js";
import { fakeDb, makeRequest } from "../test-helpers.js";
import { SESSION_COOKIE } from "../auth.js";
import { ROLE_DEFAULTS } from "../permissions.js";
import { handleHearth } from "../../../api/hearth.js";
import { handleStripeWebhook } from "../../../api/stripe-webhook.js";
import { sweepCheckouts } from "./checkout.js";

// No network: Stripe is a stubbed fetch, the database is the fake client and
// mail stays unconfigured.
process.env.DATABASE_URL = "postgres://hearth:test@localhost/hearth";
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_EMAIL_DOMAIN;
process.env.ADMIN_EMAILS = "";
process.env.STRIPE_SECRET_KEY = "sk_test_hearth";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_hearth";

const HOST = "chamainteligente.com";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function hearth(path, { cookie, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = `${SESSION_COOKIE}=${cookie}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  return makeRequest(`https://${HOST}/api/hearth${path}`, { ...options, headers });
}

const MEMBER = {
  id: "actor-1", email: "member@example.com", name: "Member", role: "client", status: "active",
  timezone: "Europe/Lisbon", referral_code: "abcd2345", created_at: "2026-09-01T10:00:00.000Z",
  email_verified_at: "2026-09-01T10:00:00.000Z", notes: "", referred_by: null, billing: "prebuy",
  stripe_customer_id: "cus_member"
};

const PURCHASE = {
  id: "purchase-1", user_id: "actor-1", pack_id: "pack-1", pack_name: "Four sessions", sessions: 4,
  status: "requested", provider: "invoice", provider_ref: null, amount_cents: 40000, discount_cents: 4000,
  currency: "EUR", note: "", checkout_session_id: null
};

function signedIn({ card = true, extra = [] } = {}) {
  return fakeDb([
    ...extra,
    [/select id, user_id, expires_at, last_seen_at, revoked_at/, [{
      id: "session-1", user_id: "actor-1", expires_at: new Date(Date.now() + 3600000).toISOString(),
      last_seen_at: new Date().toISOString(), revoked_at: null
    }]],
    [/count\(\*\)::int as n from users/, [{ n: 1 }]],
    [/select \* from users where id/, [MEMBER]],
    [/select \* from roles where name/, [{ name: "client", label: "client", permissions: ROLE_DEFAULTS.find((r) => r.name === "client").permissions }]],
    [/from user_permissions/, []],
    [/select key, value from settings/, card ? [{ key: "card_checkout", value: true }] : []]
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

function session(overrides = {}) {
  return {
    id: "cs_1", object: "checkout.session", status: "complete", payment_status: "paid",
    url: null, amount_total: 36000, currency: "eur", payment_intent: "pi_1",
    metadata: { source: "hearth", hearth_purchase_id: "purchase-1" },
    customer_details: { name: "Member Lda", email: "member@example.com", address: { line1: "Rua 1", city: "Lisboa", postal_code: "1000-001", country: "PT" }, tax_ids: [{ type: "eu_vat", value: "PT123456789" }] },
    ...overrides
  };
}

// A Stripe that answers the Checkout calls and remembers them.
function fakeStripe({ existing = null, refuse = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({ path: (init.method === "GET" ? "GET " : "") + path, body: String(init.body || ""), headers: init.headers });
    if (path === "/v1/checkout/sessions" && init.method === "POST") {
      if (refuse) return Response.json({ error: { message: "The provided key does not have the required permissions" } }, { status: 403 });
      return Response.json({ id: "cs_new", status: "open", url: "https://checkout.stripe.com/c/pay/cs_new" });
    }
    if (path.startsWith("/v1/checkout/sessions/") && existing) return Response.json(existing);
    if (path.startsWith("/v1/invoices/") && path.endsWith("/void")) return Response.json({ status: "void" });
    return Response.json({ error: { message: "unexpected" } }, { status: 404 });
  };
  return calls;
}

/* ---------- starting a checkout ---------- */

test("Pay by card makes a hosted Checkout Session for the pack's price less the discount", async () => {
  const stripe = fakeStripe();
  const db = signedIn({ extra: [[/select \* from purchases where id = \$1 and user_id/, [PURCHASE]]] });
  useClient(db);
  const response = await quiet(() => handleHearth(hearth("/purchases/purchase-1/checkout", { method: "POST", cookie: "t", body: "{}" })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { url: "https://checkout.stripe.com/c/pay/cs_new" });
  assert.equal(stripe.length, 1);
  const body = new URLSearchParams(stripe[0].body);
  assert.equal(body.get("mode"), "payment");
  assert.equal(body.get("customer"), "cus_member");
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "36000");
  assert.equal(body.get("line_items[0][price_data][currency]"), "eur");
  assert.equal(body.get("metadata[source]"), "hearth");
  assert.equal(body.get("metadata[hearth_purchase_id]"), "purchase-1");
  assert.equal(body.get("billing_address_collection"), "required");
  assert.equal(body.get("tax_id_collection[enabled]"), "true");
  assert.equal(body.get("invoice_creation[enabled]"), "true");
  assert.equal(body.get("success_url"), `https://${HOST}/hearth/sessions/packs?checkout=done&purchase=purchase-1`);
  assert.equal(stripe[0].headers["Idempotency-Key"], "hearth-checkout-purchase-1-first-36000");
  const stored = db.matching(/update purchases set checkout_session_id/)[0];
  assert.deepEqual(stored.values, ["cs_new", "purchase-1"]);
});

test("a session still open is handed back instead of a second one", async () => {
  const stripe = fakeStripe({ existing: session({ id: "cs_old", status: "open", payment_status: "unpaid", url: "https://checkout.stripe.com/c/pay/cs_old" }) });
  useClient(signedIn({ extra: [[/select \* from purchases where id = \$1 and user_id/, [{ ...PURCHASE, checkout_session_id: "cs_old" }]]] }));
  const response = await quiet(() => handleHearth(hearth("/purchases/purchase-1/checkout", { method: "POST", cookie: "t", body: "{}" })));
  assert.deepEqual(await response.json(), { url: "https://checkout.stripe.com/c/pay/cs_old" });
  assert.deepEqual(stripe.map((c) => c.path), ["GET /v1/checkout/sessions/cs_old"]);
});

test("with card payment off, or for someone else's purchase, Stripe is never called", async () => {
  const stripe = fakeStripe();
  useClient(signedIn({ card: false, extra: [[/select \* from purchases where id = \$1 and user_id/, [PURCHASE]]] }));
  const off = await quiet(() => handleHearth(hearth("/purchases/purchase-1/checkout", { method: "POST", cookie: "t", body: "{}" })));
  assert.equal(off.status, 404);
  const db = signedIn();
  useClient(db);
  const theirs = await quiet(() => handleHearth(hearth("/purchases/purchase-9/checkout", { method: "POST", cookie: "t", body: "{}" })));
  assert.equal(theirs.status, 404);
  assert.deepEqual(db.matching(/from purchases where id = \$1 and user_id/)[0].values, ["purchase-9", "actor-1"]);
  assert.equal(stripe.length, 0);
});

test("a pack that already has an invoice is paid from the invoice, not by a second checkout", async () => {
  const stripe = fakeStripe();
  useClient(signedIn({ extra: [[/select \* from purchases where id = \$1 and user_id/, [{ ...PURCHASE, status: "invoiced" }]]] }));
  const response = await quiet(() => handleHearth(hearth("/purchases/purchase-1/checkout", { method: "POST", cookie: "t", body: "{}" })));
  assert.equal(response.status, 400);
  assert.equal(stripe.length, 0);
});

test("when Stripe refuses to start a checkout the member is told plainly and nothing is stored", async () => {
  fakeStripe({ refuse: true });
  const db = signedIn({ extra: [[/select \* from purchases where id = \$1 and user_id/, [PURCHASE]]] });
  useClient(db);
  const response = await quiet(() => handleHearth(hearth("/purchases/purchase-1/checkout", { method: "POST", cookie: "t", body: "{}" })));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /invoice instead/);
  assert.equal(db.count(/update purchases set checkout_session_id/), 0);
});

test("asking for a pack to pay by card reuses a request already waiting for it", async () => {
  const db = signedIn({
    extra: [
      [/select \* from packs where id/, [{ id: "pack-1", name: "Four sessions", sessions: 4, price_cents: 40000, currency: "EUR", active: true }]],
      [/and pack_id = \$2 and status = 'requested'/, [PURCHASE]]
    ]
  });
  useClient(db);
  const response = await quiet(() => handleHearth(hearth("/purchases", { method: "POST", cookie: "t", body: JSON.stringify({ packId: "pack-1", card: true }) })));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).purchase.id, "purchase-1");
  assert.equal(db.count(/insert into purchases/), 0);
});

/* ---------- settling it ---------- */

function webhook(event, secret = "whsec_hearth") {
  const body = JSON.stringify(event);
  const at = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", secret).update(`${at}.${body}`).digest("hex");
  return new Request(`https://${HOST}/api/stripe-webhook`, {
    method: "POST", body, headers: { "stripe-signature": `t=${at},v1=${v1}`, "content-type": "application/json" }
  });
}

function completed(object = session(), type = "checkout.session.completed") {
  return { id: "evt_1", type, data: { object } };
}

function settleDb({ claimed = true, after = { status: "paid", provider_ref: "cs_1" }, invoices = [] } = {}) {
  return fakeDb([
    [/select \* from purchases where id/, [PURCHASE]],
    [/update purchases set status = 'paid'/, claimed ? [{ id: "purchase-1" }] : []],
    [/select status, provider_ref from purchases/, [after]],
    [/from invoices where purchase_id/, invoices],
    [/select \* from users where id/, [MEMBER]],
    [/from referral_events/, []]
  ]);
}

test("a paid checkout adds the pack's credits once and records the card payment", async () => {
  const db = settleDb();
  useClient(db);
  const response = await quiet(() => handleStripeWebhook(webhook(completed())));
  assert.equal(response.status, 200);
  const claim = db.matching(/update purchases set status = 'paid'/)[0];
  assert.ok(claim.values.includes("stripe_checkout"));
  assert.ok(claim.values.includes("cs_1"));
  const credit = db.matching(/insert into credit_ledger/);
  assert.equal(credit.length, 1);
  assert.deepEqual(credit[0].values.slice(0, 3), ["actor-1", 4, "purchase-1"]);

  const replay = settleDb({ claimed: false });
  useClient(replay);
  const again = await quiet(() => handleStripeWebhook(webhook(completed())));
  assert.equal(again.status, 200, "Stripe must see a 2xx or it retries");
  assert.equal(replay.count(/insert into credit_ledger/), 0);
  assert.equal(replay.count(/insert into audit_log/), 0, "a repeat is not a duplicate payment");
});

test("a card payment for a pack already paid another way adds nothing and is flagged", async () => {
  const db = settleDb({ claimed: false, after: { status: "paid", provider_ref: "CHAMA-0001" } });
  useClient(db);
  await quiet(() => handleStripeWebhook(webhook(completed())));
  assert.equal(db.count(/insert into credit_ledger/), 0);
  const flagged = db.matching(/insert into audit_log/);
  assert.equal(flagged.length, 1);
  assert.ok(flagged[0].values.includes("purchase.card_duplicate"));
});

test("an unpaid session, a ShopIntake session or a forged delivery grants nothing", async () => {
  for (const request of [
    webhook(completed(session({ payment_status: "unpaid" }))),
    webhook(completed(session({ metadata: { shop: "intake" } }))),
    webhook(completed(), "whsec_someone_else")
  ]) {
    const db = settleDb();
    useClient(db);
    await quiet(() => handleStripeWebhook(request));
    assert.equal(db.count(/update purchases/), 0);
    assert.equal(db.count(/insert into credit_ledger/), 0);
  }
  const db = settleDb();
  useClient(db);
  await quiet(() => handleStripeWebhook(webhook(completed(session(), "checkout.session.async_payment_succeeded"))));
  assert.equal(db.count(/insert into credit_ledger/), 1, "a bank payment that clears later still settles");
});

test("paying by card voids the open invoice for the same pack", async () => {
  const stripe = fakeStripe();
  const db = settleDb({ invoices: [{ id: "invoice-1", stripe_invoice_id: "in_1", number: "CHAMA-0001" }] });
  useClient(db);
  await quiet(() => handleStripeWebhook(webhook(completed())));
  assert.deepEqual(stripe.map((c) => c.path), ["/v1/invoices/in_1/void"]);
  assert.equal(db.count(/update invoices set status = 'void'/), 1);
});

test("coming back from Stripe asks Stripe, not the address bar, and settles the purchase", async () => {
  const stripe = fakeStripe({ existing: session() });
  const db = signedIn({
    extra: [
      [/select \* from purchases where id = \$1 and user_id/, [{ ...PURCHASE, checkout_session_id: "cs_1" }]],
      [/select \* from purchases where id/, [PURCHASE]],
      [/update purchases set status = 'paid'/, [{ id: "purchase-1" }]],
      [/from invoices where purchase_id/, []],
      [/from referral_events/, []]
    ]
  });
  useClient(db);
  const response = await quiet(() => handleHearth(hearth("/purchases/purchase-1/checkout/confirm", { method: "POST", cookie: "t", body: "{}" })));
  assert.deepEqual(await response.json(), { status: "paid", sessions: 4 });
  assert.deepEqual(stripe.map((c) => c.path), ["GET /v1/checkout/sessions/cs_1"]);
  assert.equal(db.count(/insert into credit_ledger/), 1);
});

test("the hourly sweep settles a paid checkout nobody reported and forgets an expired one", async () => {
  fakeStripe({ existing: session() });
  const db = fakeDb([
    [/where checkout_session_id is not null/, [{ id: "purchase-1", checkout_session_id: "cs_1" }]],
    [/select \* from purchases where id/, [PURCHASE]],
    [/update purchases set status = 'paid'/, [{ id: "purchase-1" }]],
    [/select \* from users where id/, [MEMBER]]
  ]);
  useClient(db);
  assert.deepEqual(await quiet(() => sweepCheckouts()), { checked: 1, paid: 1 });

  fakeStripe({ existing: session({ status: "expired", payment_status: "unpaid" }) });
  const stale = fakeDb([[/where checkout_session_id is not null/, [{ id: "purchase-1", checkout_session_id: "cs_1" }]]]);
  useClient(stale);
  assert.deepEqual(await quiet(() => sweepCheckouts()), { checked: 1, paid: 0 });
  assert.equal(stale.count(/update purchases set checkout_session_id = null/), 1);
  assert.equal(stale.count(/update purchases set status = 'paid'/), 0);
});
