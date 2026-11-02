// Is the flame able to answer at all?
//
// The watchdog reads conversations, so it never notices a flame that cannot
// talk: from 2026-09-27 to 2026-11-01 an expired API key turned every chat
// into "Something went wrong on our side" and nothing said so. This check
// rides the watchdog's cron. It asks the API for the flame's model with the
// flame's key, which costs nothing, and emails contact@ when that breaks,
// again once a day while it stays broken, and once when it comes back.
//
// It cannot see the API spend limit: the models endpoint still answers then.
// The chat shows its offline message in that case, by design.

import Anthropic from "@anthropic-ai/sdk";
import { get, put } from "@vercel/blob";
import { Resend } from "resend";

import { MODEL } from "../api/chat-prompt.js";

export const HEALTH_KEY = "ops/flame-health.json";

const REMIND_MS = 24 * 60 * 60 * 1000;

const NOTIFICATION = {
  from: `Chama Inteligente Watchdog <website@${process.env.RESEND_EMAIL_DOMAIN || "chamainteligente.com"}>`,
  to: "contact@chamainteligente.com"
};

function describe(error) {
  if (error instanceof Anthropic.APIError) {
    const type = error.error && error.error.error && error.error.error.type;
    return `${error.constructor.name} status=${error.status || "none"} type=${type || "none"}`;
  }
  return error instanceof Error ? error.constructor.name : "UnknownError";
}

// Broken means it will not fix itself: a dead or revoked key, a key without
// access, a retired model, a request the API now refuses. Overloads, rate
// limits and network blips pass on their own and are not worth an email.
export function classifyProbeError(error) {
  const broken =
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError ||
    error instanceof Anthropic.BadRequestError;
  return { ok: false, broken, detail: describe(error) };
}

// Given the stored state and this run's probe, which email (if any) to send
// and what to store next. A null next means leave the stored state alone.
export function decideHealth(previous, probe, at) {
  const wasDown = previous && previous.status === "down";

  if (probe.ok) {
    if (!wasDown) return { email: null, next: null };
    return { email: "up", next: { status: "ok", since: new Date(at).toISOString(), downSince: previous.since } };
  }

  if (!probe.broken) return { email: null, next: null };

  if (wasDown && at - Date.parse(previous.lastAlertAt) < REMIND_MS) {
    return { email: null, next: null };
  }

  const runAt = new Date(at).toISOString();
  return {
    email: "down",
    next: { status: "down", since: wasDown ? previous.since : runAt, lastAlertAt: runAt, detail: probe.detail }
  };
}

export function buildHealthEmail(kind, state) {
  if (kind === "up") {
    return {
      from: NOTIFICATION.from,
      to: NOTIFICATION.to,
      subject: "The flame is answering again",
      text: [
        "The flame can reach its model again.",
        "",
        `Down since: ${state.downSince || "unknown"}`,
        `Back at: ${state.since}`
      ].join("\n")
    };
  }

  return {
    from: NOTIFICATION.from,
    to: NOTIFICATION.to,
    subject: "The flame is not answering",
    text: [
      "The flame cannot reach its model, so every visitor who writes to it gets \"Something went wrong on our side\".",
      "",
      `Error: ${state.detail}`,
      `Down since: ${state.since}`,
      `Model: ${MODEL}`,
      "",
      "AuthenticationError (401) means the ANTHROPIC_API_KEY is dead, often expired. Make a new key in the Anthropic Console (Chama Inteligente workspace, expiry Never), replace ANTHROPIC_API_KEY in Vercel, and redeploy.",
      "NotFoundError (404) means the model was retired. Update MODEL in api/chat-prompt.js and api/watchdog.js.",
      "",
      "This email repeats once a day until the flame answers again."
    ].join("\n")
  };
}

async function probeModel() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 });
  await client.models.retrieve(MODEL);
}

async function readState(deps) {
  try {
    const result = await deps.get(HEALTH_KEY, { access: "private", useCache: false });
    if (!result) return null;
    const text = typeof result.text === "function" ? await result.text() : await new Response(result.stream).text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Flame health state read failed", error instanceof Error ? error.name : "UnknownError");
    return null;
  }
}

async function sendHealthEmail(email, key) {
  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send(email, { idempotencyKey: key });
  if (error) throw new Error("EmailDeliveryError");
}

export async function runFlameHealth(dependencies = {}) {
  const deps = { get, put, probe: probeModel, sendEmail: sendHealthEmail, now: () => Date.now(), ...dependencies };
  const at = deps.now();

  let probe;
  try {
    await deps.probe();
    probe = { ok: true };
  } catch (error) {
    probe = classifyProbeError(error);
  }

  const previous = await readState(deps);
  const { email, next } = decideHealth(previous, probe, at);

  let emailed = false;
  if (email) {
    try {
      await deps.sendEmail(buildHealthEmail(email, next), `website-flame-health/${next.lastAlertAt || next.since}`);
      emailed = true;
    } catch (error) {
      console.error("Flame health email failed", error instanceof Error ? error.name : "UnknownError");
    }
  }

  // Only store an alert that went out, so a failed email is retried next run.
  if (next && (emailed || !email)) {
    await deps.put(HEALTH_KEY, JSON.stringify(next, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json"
    });
  }

  const status = probe.ok ? "ok" : probe.broken ? "down" : "unsure";
  console.log(JSON.stringify({ flameHealth: status, detail: probe.ok ? undefined : probe.detail, emailed }));
  return { status, emailed };
}
