import assert from "node:assert/strict";
import test from "node:test";

import { buildRecord, validate } from "./intake.js";

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

  assert.match(result.error, /understand, decide, or make/);
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
