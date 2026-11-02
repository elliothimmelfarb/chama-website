import assert from "node:assert/strict";
import test from "node:test";
import Anthropic from "@anthropic-ai/sdk";

import { classifyProbeError, decideHealth, runFlameHealth, HEALTH_KEY } from "./flame-health.js";

const NOW = Date.parse("2026-11-02T10:05:00.000Z");
const HOUR = 60 * 60 * 1000;
const iso = (at) => new Date(at).toISOString();

test("a dead key or a retired model is broken; an outage or rate limit is not", () => {
  const apiError = (Kind, status) => new Kind(status, { error: { type: "x" } }, "x", new Headers());
  assert.equal(classifyProbeError(apiError(Anthropic.AuthenticationError, 401)).broken, true);
  assert.equal(classifyProbeError(apiError(Anthropic.PermissionDeniedError, 403)).broken, true);
  assert.equal(classifyProbeError(apiError(Anthropic.NotFoundError, 404)).broken, true);
  assert.equal(classifyProbeError(apiError(Anthropic.InternalServerError, 529)).broken, false);
  assert.equal(classifyProbeError(apiError(Anthropic.RateLimitError, 429)).broken, false);
  assert.equal(classifyProbeError(new TypeError("fetch failed")).broken, false);
});

test("the first broken run alerts, and the next ones stay quiet for a day", () => {
  const broken = { ok: false, broken: true, detail: "AuthenticationError status=401" };
  const first = decideHealth(null, broken, NOW);
  assert.equal(first.email, "down");
  assert.equal(first.next.status, "down");

  const soon = decideHealth(first.next, broken, NOW + HOUR);
  assert.equal(soon.email, null);
  assert.equal(soon.next, null);

  const dayLater = decideHealth(first.next, broken, NOW + 24 * HOUR);
  assert.equal(dayLater.email, "down");
  assert.equal(dayLater.next.since, iso(NOW));
});

test("recovery alerts once; a transient failure changes nothing", () => {
  const down = { status: "down", since: iso(NOW - HOUR), lastAlertAt: iso(NOW - HOUR) };
  const back = decideHealth(down, { ok: true }, NOW);
  assert.equal(back.email, "up");
  assert.equal(back.next.status, "ok");

  assert.deepEqual(decideHealth(null, { ok: true }, NOW), { email: null, next: null });
  assert.deepEqual(decideHealth(null, { ok: false, broken: false, detail: "x" }, NOW), { email: null, next: null });
});

test("a broken probe emails contact@ and records the state", async () => {
  const sent = [];
  const written = [];
  const outcome = await runFlameHealth({
    now: () => NOW,
    probe: async () => {
      throw new Anthropic.AuthenticationError(401, { error: { type: "authentication_error" } }, "x", new Headers());
    },
    get: async () => null,
    put: async (key, body) => written.push([key, JSON.parse(body)]),
    sendEmail: async (email) => sent.push(email)
  });

  assert.equal(outcome.status, "down");
  assert.equal(outcome.emailed, true);
  assert.equal(sent[0].to, "contact@chamainteligente.com");
  assert.match(sent[0].text, /status=401/);
  assert.equal(written[0][0], HEALTH_KEY);
  assert.equal(written[0][1].status, "down");
});
