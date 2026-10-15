import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { afterEach } from "node:test";

import { useClient } from "../db.js";
import { fakeDb, makeRequest } from "../test-helpers.js";
import { SESSION_COOKIE } from "../auth.js";
import { ROLE_DEFAULTS } from "../permissions.js";
import { handleHearth } from "../../../api/hearth.js";
import { handleStripeWebhook } from "../../../api/stripe-webhook.js";

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
  process.env.STRIPE_SECRET_KEY = "sk_test_hearth";
});

function hearth(path, { cookie, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = `${SESSION_COOKIE}=${cookie}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  return makeRequest(`https://${HOST}/api/hearth${path}`, { ...options, headers });
}

function userRow(overrides = {}) {
  return {
    id: "actor-1", email: "owner@example.com", name: "Owner", role: "owner", status: "active",
    timezone: "Europe/Lisbon", referral_code: "abcd2345", created_at: "2026-09-01T10:00:00.000Z",
    email_verified_at: "2026-09-01T10:00:00.000Z", notes: "", referred_by: null, billing: "prebuy",
    stripe_customer_id: null, ...overrides
  };
}

const MEMBER = userRow({ id: "member-1", email: "member@example.com", name: "Member", role: "client", billing: "after" });

function signedIn({ role = "owner", extra = [] } = {}) {
  const rows = { "actor-1": userRow({ role }), "member-1": MEMBER };
  return fakeDb([
    ...extra,
    [/select id, user_id, expires_at, last_seen_at, revoked_at/, [{
      id: "session-1", user_id: "actor-1", expires_at: new Date(Date.now() + 3600000).toISOString(),
      last_seen_at: new Date().toISOString(), revoked_at: null
    }]],
    [/count\(\*\)::int as n from users/, [{ n: 1 }]],
    [/select \* from users where id/, (call) => (rows[call.values[0]] ? [rows[call.values[0]]] : [])],
    [/select \* from roles where name/, [{ name: role, label: role, permissions: ROLE_DEFAULTS.find((r) => r.name === role).permissions }]],
    [/from user_permissions/, []],
    [/select key, value from settings/, []]
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

// A Stripe that answers every call the Hearth makes and remembers them.
function fakeStripe() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({ path: (init.method === "GET" ? "GET " : "") + path, body: String(init.body || "") });
    if (path === "/v1/customers" && init.method === "GET") return Response.json({ data: [] });
    if (path === "/v1/customers") return Response.json({ id: "cus_new" });
    if (path === "/v1/invoices") return Response.json({ id: "in_1", status: "draft" });
    if (path === "/v1/invoiceitems") return Response.json({ id: "ii_" + calls.length });
    if (path === "/v1/invoices/in_1/finalize") {
      return Response.json({
        id: "in_1", status: "open", number: "CHAMA-0001", amount_due: 24000, currency: "eur",
        hosted_invoice_url: "https://invoice.stripe.com/i/abc", invoice_pdf: "https://pay.stripe.com/pdf", due_date: 1790000000
      });
    }
    if (path === "/v1/invoices/in_1/void") return Response.json({ id: "in_1", status: "void" });
    return Response.json({ error: { message: "unexpected" } }, { status: 404 });
  };
  return calls;
}

const HELD = [
  { id: "booking-1", user_id: "member-1", billing: "after", invoiced_at: null, starts_at: "2026-10-01T09:00:00.000Z", status: "completed" },
  { id: "booking-2", user_id: "member-1", billing: "after", invoiced_at: null, starts_at: "2026-10-08T09:00:00.000Z", status: "completed" }
];

const NEW_INVOICE = {
  userId: "member-1",
  bookingIds: ["booking-1", "booking-2"],
  lines: [{ description: "Coaching, 2 sessions", amountCents: 24000 }],
  daysUntilDue: 14
};

test("an invoice for held sessions goes to Stripe and marks those sessions invoiced", async () => {
  const stripe = fakeStripe();
  const db = signedIn({
    extra: [
      [/from bookings where id = any/, HELD],
      [/insert into invoices/, [{ id: "invoice-1", user_id: "member-1", status: "draft" }]],
      [/update invoices set stripe_invoice_id/, (call) => [{ id: "invoice-1", user_id: "member-1", status: "open", number: "CHAMA-0001", amount_cents: 24000, currency: "EUR" }]]
    ]
  });
  useClient(db);
  const response = await quiet(() => handleHearth(hearth("/admin/invoices", { method: "POST", cookie: "t", body: JSON.stringify(NEW_INVOICE) })));
  assert.equal(response.status, 200);
  assert.deepEqual(stripe.map((c) => c.path), ["GET /v1/customers", "/v1/customers", "/v1/invoices", "/v1/invoiceitems", "/v1/invoices/in_1/finalize"]);
  assert.match(stripe[3].body, /amount=24000/);
  assert.equal(db.count(/update users set stripe_customer_id/), 1);
  const marked = db.matching(/update bookings set invoiced_at = now\(\), invoice_id/)[0];
  assert.ok(marked, "the held sessions are marked invoiced");
  assert.deepEqual(marked.values.slice(0, 2), ["invoice-1", ["booking-1", "booking-2"]]);
});

test("sessions that are not this member's held, uninvoiced sessions are refused before Stripe is called", async () => {
  const stripe = fakeStripe();
  useClient(signedIn({ extra: [[/from bookings where id = any/, [HELD[0]]]] }));
  const response = await handleHearth(hearth("/admin/invoices", { method: "POST", cookie: "t", body: JSON.stringify(NEW_INVOICE) }));
  assert.equal(response.status, 400);
  assert.equal(stripe.length, 0);
});

test("without a Stripe key the room says so and a member cannot create invoices", async () => {
  delete process.env.STRIPE_SECRET_KEY;
  useClient(signedIn());
  const off = await handleHearth(hearth("/admin/invoices", { method: "POST", cookie: "t", body: JSON.stringify(NEW_INVOICE) }));
  assert.equal(off.status, 503);
  process.env.STRIPE_SECRET_KEY = "sk_test_hearth";
  useClient(signedIn({ role: "client" }));
  const member = await handleHearth(hearth("/admin/invoices", { method: "POST", cookie: "t", body: JSON.stringify(NEW_INVOICE) }));
  assert.equal(member.status, 403);
});

test("a member, even a guest, sees only their own invoices", async () => {
  const db = signedIn({ role: "guest", extra: [[/from invoices where user_id/, []]] });
  useClient(db);
  const response = await handleHearth(hearth("/invoices", { cookie: "t" }));
  assert.equal(response.status, 200);
  assert.equal(db.matching(/from invoices where user_id/)[0].values[0], "actor-1");
});

test("voiding an invoice frees its sessions to be invoiced again", async () => {
  const stripe = fakeStripe();
  const db = signedIn({
    extra: [
      [/select \* from invoices where id/, [{ id: "invoice-1", user_id: "member-1", status: "open", stripe_invoice_id: "in_1", purchase_id: null }]],
      [/update invoices set status = 'void'/, [{ id: "invoice-1", purchase_id: null }]]
    ]
  });
  useClient(db);
  const response = await quiet(() => handleHearth(hearth("/admin/invoices/invoice-1/void", { method: "POST", cookie: "t", body: "{}" })));
  assert.equal(response.status, 200);
  assert.deepEqual(stripe.map((c) => c.path), ["/v1/invoices/in_1/void"]);
  assert.equal(db.count(/update bookings set invoiced_at = null, invoice_id = null/), 1);
});

/* ---------- the webhook ---------- */

function webhook(event, secret = "whsec_hearth") {
  const body = JSON.stringify(event);
  const at = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", secret).update(`${at}.${body}`).digest("hex");
  return new Request(`https://${HOST}/api/stripe-webhook`, {
    method: "POST", body, headers: { "stripe-signature": `t=${at},v1=${v1}`, "content-type": "application/json" }
  });
}

const PAID = {
  id: "evt_1", type: "invoice.paid",
  data: { object: { id: "in_1", status: "paid", customer: "cus_new", amount_due: 40000, amount_paid: 40000, currency: "eur", metadata: { hearth_invoice_id: "invoice-1" } } }
};

const PACK_PURCHASE = { id: "purchase-1", user_id: "member-1", pack_name: "Four sessions", sessions: 4, status: "invoiced" };

function webhookDb({ claimed }) {
  return fakeDb([
    [/from invoices where stripe_invoice_id/, [{ id: "invoice-1", user_id: "member-1", status: claimed ? "open" : "paid", purchase_id: "purchase-1" }]],
    [/update invoices set status = 'paid'/, claimed ? [{ id: "invoice-1", purchase_id: "purchase-1" }] : []],
    [/select \* from purchases where id/, [PACK_PURCHASE]],
    [/update purchases set status = 'paid'/, [{ id: "purchase-1" }]],
    [/select \* from users where id/, [MEMBER]]
  ]);
}

test("a paid pack invoice adds the credits, and Stripe sending the same event again adds none", async () => {
  const first = webhookDb({ claimed: true });
  useClient(first);
  const response = await quiet(() => handleStripeWebhook(webhook(PAID)));
  assert.equal(response.status, 200);
  const credit = first.matching(/insert into credit_ledger/)[0];
  assert.deepEqual(credit.values.slice(0, 2), ["member-1", 4]);

  const replay = webhookDb({ claimed: false });
  useClient(replay);
  const again = await quiet(() => handleStripeWebhook(webhook(PAID)));
  assert.equal(again.status, 200);
  assert.equal(replay.count(/insert into credit_ledger/), 0);
});

test("a webhook with a bad signature changes nothing", async () => {
  const db = webhookDb({ claimed: true });
  useClient(db);
  const response = await handleStripeWebhook(webhook(PAID, "whsec_wrong"));
  assert.equal(response.status, 400);
  assert.equal(db.calls.filter((c) => /update|insert/.test(c.text)).length, 0);
});

test("an invoice made in the Stripe dashboard attaches to the member with that email", async () => {
  const db = fakeDb([
    [/from invoices where stripe_invoice_id/, []],
    [/from users where stripe_customer_id/, []],
    [/select \* from users where email/, [MEMBER]],
    [/insert into invoices/, [{ id: "invoice-9", user_id: "member-1", status: "open", purchase_id: null }]]
  ]);
  useClient(db);
  const event = {
    id: "evt_2", type: "invoice.finalized",
    data: { object: { id: "in_9", status: "open", collection_method: "send_invoice", billing_reason: "manual", customer: "cus_dash", customer_email: "Member@Example.com", amount_due: 5000, currency: "eur", metadata: {}, lines: { data: [{ description: "Workshop", amount: 5000 }] } } }
  };
  const response = await quiet(() => handleStripeWebhook(webhook(event)));
  assert.equal(response.status, 200);
  const inserted = db.matching(/insert into invoices/)[0];
  assert.ok(inserted.values.includes("member-1"));
  assert.ok(inserted.values.includes("in_9"));
});

test("a ShopIntake subscription invoice on the same Stripe account is left alone", async () => {
  const db = fakeDb([
    [/from invoices where stripe_invoice_id/, []],
    [/select \* from users where email/, [MEMBER]]
  ]);
  useClient(db);
  const event = {
    id: "evt_3", type: "invoice.paid",
    data: { object: { id: "in_shop", status: "paid", collection_method: "charge_automatically", billing_reason: "subscription_cycle", customer: "cus_shop", customer_email: "member@example.com", amount_paid: 4900, currency: "eur", metadata: {} } }
  };
  const response = await quiet(() => handleStripeWebhook(webhook(event)));
  assert.equal(response.status, 200);
  assert.equal(db.count(/insert into invoices/), 0);
});
