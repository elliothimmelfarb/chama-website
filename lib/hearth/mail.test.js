import assert from "node:assert/strict";
import test from "node:test";
import { send, toOwner, OWNER_INBOX } from "./mail.js";

function fakeResend() {
  const sent = [];
  return { sent, resend: { emails: { send: async (message) => (sent.push(message), { error: null }) } } };
}
const config = { apiKey: "k", domain: "chamainteligente.com", configured: true };

test("mail comes from the Hearth", async () => {
  const { sent, resend } = fakeResend();
  await send({ to: "member@example.com", subject: "s", text: "t" }, { config, resend });
  assert.equal(sent[0].from, "Hearth · Chama Inteligente <hearth@chamainteligente.com>");
});

test("notices for the owner go to the Chama inbox, not the owner's sign-in address", async () => {
  const { sent, resend } = fakeResend();
  await toOwner({ subject: "s", text: "t" }, { config, resend });
  assert.equal(OWNER_INBOX, "elliot@chamainteligente.com");
  assert.deepEqual(sent[0].to, ["elliot@chamainteligente.com"]);
});
