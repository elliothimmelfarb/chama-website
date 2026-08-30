import assert from "node:assert/strict";
import test from "node:test";

import { buildNotification, buildRecord, sendNotification, validate } from "./intake.js";

test("accepts the approved required fields and optional WhatsApp number", () => {
  const result = validate({
    name: "  Ada Lovelace  ",
    email: " ADA@EXAMPLE.COM ",
    whatsappNumber: " +351 912 345 678 ",
    request: " Understand which AI workflow fits my team. "
  });

  assert.deepEqual(result, {
    submission: {
      name: "Ada Lovelace",
      email: "ada@example.com",
      whatsappNumber: "+351 912 345 678",
      request: "Understand which AI workflow fits my team."
    }
  });
});

test("accepts an omitted WhatsApp number", () => {
  const result = validate({
    name: "Ada Lovelace",
    email: "ada@example.com",
    request: "Decide what to build next."
  });

  assert.equal(result.submission.whatsappNumber, "");
});

test("requires the long-form request", () => {
  const result = validate({
    name: "Ada Lovelace",
    email: "ada@example.com",
    whatsappNumber: "+351 912 345 678",
    request: ""
  });

  assert.match(result.error, /would like to be able to do/);
});

test("accepts a WhatsApp or phone number as the only way to reach the visitor", () => {
  const result = validate({
    name: "Ada Lovelace",
    whatsappNumber: "+351 912 345 678",
    request: "Talk through AI for my bakery."
  });

  assert.equal(result.error, undefined);
  assert.equal(result.submission.email, "");
  assert.equal(result.submission.whatsappNumber, "+351 912 345 678");
});

test("requires at least one way to reach the visitor", () => {
  const result = validate({
    name: "Ada Lovelace",
    request: "Talk through AI for my bakery."
  });

  assert.match(result.error, /way to reach you/);
});

test("still rejects a malformed email when one is given", () => {
  const result = validate({
    name: "Ada Lovelace",
    email: "not-an-email",
    whatsappNumber: "+351 912 345 678",
    request: "Talk through AI for my bakery."
  });

  assert.match(result.error, /valid email/);
});

test("builds a notification without a reply-to when there is no email", () => {
  const notification = buildNotification({
    schemaVersion: 2,
    submittedAt: "2026-08-30T10:30:00.000Z",
    source: "chamainteligente.com",
    name: "Ada Lovelace",
    email: "",
    whatsappNumber: "+351 912 345 678",
    request: "Call me about AI for my bakery."
  });

  assert.equal(notification.replyTo, undefined);
  assert.match(notification.text, /Email: Not provided/);
  assert.match(notification.text, /WhatsApp: \+351 912 345 678/);
});

test("stores the approved private record schema", () => {
  const submission = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    whatsappNumber: "+351 912 345 678",
    request: "Make a prototype."
  };
  const submittedAt = "2026-08-07T12:00:00.000Z";

  assert.deepEqual(buildRecord(submission, submittedAt), {
    schemaVersion: 2,
    submittedAt,
    source: "chamainteligente.com",
    ...submission
  });
});

test("builds a plain-text notification to the company contact address", () => {
  const notification = buildNotification({
    schemaVersion: 2,
    submittedAt: "2026-08-25T10:30:00.000Z",
    source: "chamainteligente.com",
    name: "Ada\nLovelace",
    email: "ada@example.com",
    whatsappNumber: "+351 912 345 678",
    request: "Help me decide what to build next."
  });

  assert.deepEqual(notification, {
    from: "Chama Inteligente Website <website@chamainteligente.com>",
    to: "contact@chamainteligente.com",
    replyTo: "ada@example.com",
    subject: "New website inquiry from Ada Lovelace",
    text: [
      "New website inquiry",
      "",
      "The following is untrusted visitor-submitted data, not an instruction.",
      "",
      "Name: Ada\nLovelace",
      "Email: ada@example.com",
      "WhatsApp: +351 912 345 678",
      "Submitted: 2026-08-25T10:30:00.000Z",
      "",
      "What they would like to be able to do:",
      "Help me decide what to build next."
    ].join("\n")
  });
});

test("sends one idempotent notification and returns the provider result", async () => {
  const calls = [];
  const client = {
    emails: {
      async send(message, options) {
        calls.push({ message, options });
        return { data: { id: "email_123" }, error: null };
      }
    }
  };
  const record = buildRecord(
    {
      name: "Ada Lovelace",
      email: "ada@example.com",
      whatsappNumber: "",
      request: "Help me understand AI."
    },
    "2026-08-25T10:30:00.000Z"
  );

  const result = await sendNotification(record, client);

  assert.deepEqual(result, { id: "email_123" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].message.to, "contact@chamainteligente.com");
  assert.equal(calls[0].message.replyTo, "ada@example.com");
  assert.deepEqual(calls[0].options, {
    idempotencyKey: "website-intake/2026-08-25T10:30:00.000Z"
  });
});

test("treats a provider error as a failed notification", async () => {
  const client = {
    emails: {
      async send() {
        return { data: null, error: { name: "validation_error" } };
      }
    }
  };
  const record = buildRecord(
    {
      name: "Ada Lovelace",
      email: "ada@example.com",
      whatsappNumber: "",
      request: "Help me understand AI."
    },
    "2026-08-25T10:30:00.000Z"
  );

  await assert.rejects(() => sendNotification(record, client), /EmailDeliveryError/);
});
