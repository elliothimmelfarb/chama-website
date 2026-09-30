// Stripe's side of the Hearth: the webhook that turns a paid Checkout
// Session into credits.
//
// Stripe calls this from its own servers, so there is no session and no
// Origin; the signature over the raw body is the only thing trusted, and the
// purchase is found by the id this server put in the session's metadata.
// Deliveries repeat (Stripe retries until it sees a 2xx), so everything here
// leans on claimPaid's compare-and-set: the second delivery finds the
// purchase already paid and grants nothing.

import { HttpError, json } from "../http.js";
import { configured, verifySignature } from "../stripe.js";
import { claimPaid, settlePurchase } from "./sessions.js";

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
const MAX_BODY = 512 * 1024;

export function registerStripeRoutes({ route }) {
  route("POST", "/stripe/webhook", async (context) => {
    if (!configured()) throw new HttpError(404, "Not found.");
    const raw = await context.request.text();
    if (raw.length > MAX_BODY || !verifySignature(raw, context.request.headers.get("stripe-signature"))) {
      throw new HttpError(400, "This request could not be accepted.");
    }
    const event = JSON.parse(raw);
    const session = event?.data?.object;
    if (!PAID_EVENTS.has(event.type) || session?.payment_status !== "paid") return json({ received: true });
    const purchaseId = session.metadata?.purchase_id || session.client_reference_id;
    if (!purchaseId) return json({ received: true });
    const purchase = await claimPaid(String(purchaseId), { provider: "stripe", providerRef: String(session.id || "") });
    if (purchase) await settlePurchase(purchase, context, null);
    return json({ received: true });
  });
}
