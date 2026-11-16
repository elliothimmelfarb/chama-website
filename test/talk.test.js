// The Talk to us chat's decisions that need no browser: reading the event
// stream, the consent gate in front of contact details, what happens when
// the chat cannot be reached, and which email address the widget may show.
// The DOM half is proved headlessly; this file pins the behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

import { MESSAGES } from "../api/chat.js";
import { common } from "../site/content/en/common.js";
import { talk } from "../site/content/en/talk.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = readFileSync(path.join(ROOT, "assets/talk.js"), "utf8");
const CSS = readFileSync(path.join(ROOT, "assets/talk.css"), "utf8");

function load() {
  const sandbox = { window: {}, setTimeout, clearTimeout, TextDecoder, AbortController, URL, URLSearchParams };
  vm.runInNewContext(SOURCE, sandbox);
  return sandbox.window.ChamaTalk;
}
const T = load();
const plain = (v) => JSON.parse(JSON.stringify(v));

// ---- a scripted /api/chat and /api/intake ------------------------------

const enc = new TextEncoder();
function sse(events, { split = 7 } = {}) {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  // cut the stream at arbitrary points, as a network does
  const chunks = [];
  for (let i = 0; i < text.length; i += split) chunks.push(enc.encode(text.slice(i, i + split)));
  let at = 0;
  return {
    ok: true,
    status: 200,
    body: { getReader: () => ({ read: async () => (at < chunks.length ? { done: false, value: chunks[at++] } : { done: true }), cancel() {} }) },
  };
}
function refusal(status, body) {
  return { ok: false, status, body: null, json: async () => { if (body === undefined) throw new Error("not json"); return body; } };
}
function reply(text, extra = []) {
  return sse([{ type: "text", text: text.slice(0, 5) }, { type: "text", text: text.slice(5) }, ...extra, { type: "done", usage: {} }]);
}

function harness(answers) {
  const calls = [];
  const queue = [...answers];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: init && typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : init && init.body });
    const next = queue.shift();
    if (typeof next === "function") return next(url, init);
    if (next instanceof Error) throw next;
    return next;
  };
  const chat = T.createChat({ fetch, now: () => 1e12 });
  const chatCalls = () => calls.filter((c) => c.url === "/api/chat" && !(c.body && c.body.warm));
  return { chat, calls, chatCalls };
}

// ---- the event contract ---------------------------------------------------

test("frames are read whole however the network cuts them, and junk lines are skipped", () => {
  const r = T.frameReader();
  const out = [
    ...r.push('data: {"type":"text","te'),
    ...r.push('xt":"Hel"}\n'),
    ...r.push('\ndata: {"type":"text","text":"lo"}\r\n\r\n: a comment\n\ndata: not json\n\n'),
    ...r.push('data: {"type":"done"}'),
    ...r.end(),
  ];
  assert.deepEqual(plain(out), [{ type: "text", text: "Hel" }, { type: "text", text: "lo" }, { type: "done" }]);
});

test("a refusal says what the server said, and its kind decides what comes next", () => {
  assert.deepEqual(plain(T.refusal(503, { error: MESSAGES.offline, kind: "offline" })), { error: MESSAGES.offline, kind: "offline" });
  assert.deepEqual(plain(T.refusal(400, { error: MESSAGES.unreadable, kind: "final" })), { error: MESSAGES.unreadable, kind: "final" });
  // Vercel's firewall: a 429 with no JSON is the busy line, and worth a retry
  assert.deepEqual(plain(T.refusal(429, null)), { error: MESSAGES.overwhelmed, kind: "retry" });
  assert.equal(T.refusal(502, null).kind, "retry");
  assert.equal(T.refusal(405, null).kind, "final");
});

test("a streamed reply is shown as it arrives and sent back exactly as streamed", async () => {
  const { chat, chatCalls } = harness([reply("Yes, we can. See https://chamainteligente.com/work"), reply("Sure.")]);
  await chat.send("Can you build an app?");
  assert.equal(chat.state.items.at(-1).text, "Yes, we can. See https://chamainteligente.com/work");
  await chat.send("Thanks");
  const body = chatCalls()[1].body;
  assert.match(body.conversationId, /^[A-Za-z0-9-]{8,64}$/);
  assert.equal(body.conversationId, chatCalls()[0].body.conversationId);
  assert.deepEqual(plain(body.messages), [
    { role: "user", content: "Can you build an app?" },
    { role: "assistant", content: "Yes, we can. See https://chamainteligente.com/work" },
    { role: "user", content: "Thanks" },
  ]);
});

test("a link to the site stays on the site; other addresses open in a new tab; nothing else is a link", () => {
  const parts = plain(T.linkParts("See https://chamainteligente.com/coaching. Or shop-intake.com, or javascript:alert(1)."));
  assert.deepEqual(parts.filter((p) => p.href), [
    { text: "https://chamainteligente.com/coaching", href: "/coaching", external: false },
    { text: "shop-intake.com", href: "https://shop-intake.com/", external: true },
  ]);
  assert.equal(parts.map((p) => p.text).join(""), "See https://chamainteligente.com/coaching. Or shop-intake.com, or javascript:alert(1).");
});

test("a failure the visitor can fix by sending again offers a retry, and takes the message out of the history", async () => {
  const { chat, chatCalls } = harness([refusal(503, { error: MESSAGES.overwhelmed, kind: "retry" }), reply("Hello.")]);
  await chat.send("Hi");
  const note = chat.state.items.at(-1);
  assert.equal(note.kind, "note");
  assert.equal(note.text, MESSAGES.overwhelmed);
  assert.equal(note.retry, true);
  assert.equal(chat.state.items.find((i) => i.kind === "me").unsent, true);
  await chat.retry();
  assert.deepEqual(plain(chatCalls()[1].body.messages), [{ role: "user", content: "Hi" }]);
  assert.equal(chat.state.items.filter((i) => i.kind === "me").length, 1, "a retry replaces the unsent message rather than adding one");
});

test("a request the server refused for what it carried is not offered again", async () => {
  const { chat, chatCalls } = harness([refusal(429, { error: MESSAGES.tooLong, kind: "final" })]);
  await chat.send("One more");
  assert.equal(chat.state.items.at(-1).text, MESSAGES.tooLong);
  assert.equal(chat.state.items.at(-1).retry, false);
  await chat.retry();
  assert.equal(chatCalls().length, 1);
});

test("the warm-up goes at most once per 4.5 minutes, and a real message counts as one", async () => {
  let now = 0;
  const calls = [];
  const chat = T.createChat({ fetch: async (url, init) => { calls.push(JSON.parse(init.body)); return calls.at(-1).warm ? { ok: true, status: 204 } : reply("Hi."); }, now: () => now });
  chat.warm(); chat.warm();
  now = 4 * 60 * 1000; chat.warm();
  assert.equal(calls.filter((b) => b.warm).length, 1);
  now = 5 * 60 * 1000; await chat.send("Hello");
  now = 9 * 60 * 1000; chat.warm();
  assert.equal(calls.filter((b) => b.warm).length, 1, "the message warmed the cache, so no warm-up within the window after it");
  now = 10 * 60 * 1000; chat.warm();
  assert.equal(calls.filter((b) => b.warm).length, 2);
});

// ---- the consent gate --------------------------------------------------

const ANA = { name: "Ana Silva", contact: "ana@example.com" };
const PREVIEW = "Here is what I will send:\nAna Silva\nana@example.com\nWants an app for her bakery.\nSend it?";

test("contact details that do not check out go nowhere", async () => {
  const { chat, calls } = harness([]);
  assert.ok(chat.submitDetails({ name: "", contact: "ana@example.com" }).name);
  assert.ok(chat.submitDetails({ name: "Ana", contact: "" }).contact);
  assert.ok(chat.submitDetails({ name: "Ana", contact: "ana@" }).contact);
  assert.ok(chat.submitDetails({ name: "Ana", contact: "12 34" }).contact);
  assert.equal(calls.length, 0);
});

test("details reach the agent only as the visitor's own message, and are passed on only after they press yes", async () => {
  const { chat, chatCalls } = harness([
    reply("We can help with that."),
    reply(PREVIEW),
    reply("Sent. Elliot will be in touch.", [{ type: "tool", name: "send_note_to_elliot", ok: true }]),
  ]);
  await chat.send("I need an app for my bakery");
  assert.equal(chat.state.confirming, false);
  // nothing is offered for confirmation, and nothing confirms, before the details are given
  await chat.confirm();
  assert.equal(chatCalls().length, 1);

  const errors = chat.submitDetails(ANA);
  assert.equal(errors, null);
  await chat.idle();
  const given = chatCalls()[1].body.messages.at(-1);
  assert.equal(given.role, "user");
  assert.match(given.content, /Ana Silva/);
  assert.match(given.content, /ana@example\.com/);

  // the agent showed them back: the page asks, and does not answer for the visitor
  assert.equal(chat.state.confirming, true);
  assert.equal(chatCalls().length, 2, "no confirmation was sent without the visitor");
  assert.equal(chat.state.sent, false);

  await chat.confirm();
  const yes = chatCalls()[2].body.messages;
  assert.equal(yes.at(-1).role, "user");
  assert.equal(yes.at(-1).content, T.STRINGS.confirmMessage);
  assert.equal(yes.at(-2).content, PREVIEW, "the preview goes back exactly as streamed, as the tool checks it");
  assert.equal(chat.state.sent, true);
  assert.equal(chat.state.confirming, false);
  await chat.confirm();
  assert.equal(chatCalls().length, 3, "a second yes sends nothing");
});

test("a reply that does not show every detail back is not treated as the question to confirm", async () => {
  const { chat, chatCalls } = harness([reply("Thanks Ana. Is that a WhatsApp number?")]);
  chat.submitDetails({ name: "Ana Silva", contact: "+351 912 345 678" });
  await chat.idle();
  assert.equal(chat.state.confirming, false);
  await chat.confirm();
  assert.equal(chatCalls().length, 1);
});

test("changing something withdraws the question, and the details form opens again with what was typed", async () => {
  const { chat, chatCalls } = harness([reply(PREVIEW)]);
  chat.submitDetails(ANA);
  await chat.idle();
  chat.change();
  assert.equal(chat.state.confirming, false);
  assert.deepEqual(plain(chat.state.details), { open: true, name: "Ana Silva", contact: "ana@example.com" });
  await chat.confirm();
  assert.equal(chatCalls().length, 1);
});

test("once the note tool has run, a failure never sends the same message again", async () => {
  const { chat, chatCalls } = harness([reply(PREVIEW), sse([{ type: "tool", name: "send_note_to_elliot", ok: true }, { type: "error", error: MESSAGES.failed, kind: "retry" }, { type: "done" }])]);
  chat.submitDetails(ANA);
  await chat.idle();
  await chat.confirm();
  assert.equal(chat.state.sent, true);
  assert.ok(!chat.state.items.some((i) => i.retry), "no retry is offered after the note went");
  await chat.retry();
  assert.equal(chatCalls().length, 2);
});

// ---- offline and unreachable ---------------------------------------------

test("an offline refusal swaps the thread for the plain form, with what the visitor wrote kept", async () => {
  const { chat } = harness([refusal(503, { error: MESSAGES.offline, kind: "offline" })]);
  await chat.send("We need a new website");
  assert.equal(chat.state.fallback.reason, "offline");
  assert.equal(chat.state.fallback.message, MESSAGES.offline);
  assert.equal(chat.state.fallback.request, "We need a new website");
});

test("an offline error inside the stream does too, decided by kind and never by the words", async () => {
  const { chat } = harness([sse([{ type: "error", error: "Anything at all", kind: "offline" }, { type: "done" }])]);
  await chat.send("Hello");
  assert.equal(chat.state.fallback.reason, "offline");
  const other = harness([sse([{ type: "error", error: MESSAGES.offline, kind: "retry" }, { type: "done" }])]);
  await other.chat.send("Hello");
  assert.equal(other.chat.state.fallback, null);
});

test("a chat that cannot be reached at all also offers the form", async () => {
  const { chat } = harness([new TypeError("Failed to fetch")]);
  await chat.send("Hello");
  assert.equal(chat.state.fallback.reason, "unreachable");
});

test("the fallback form posts the intake fields, and a saved request is a thank you", async () => {
  const { chat, calls } = harness([refusal(503, { error: MESSAGES.offline, kind: "offline" }), { ok: true, status: 200, json: async () => ({ ok: true }) }]);
  await chat.send("A website, please");
  await chat.submitFallback({ name: "Ana Silva", contact: "+351 912 345 678", request: "A website, please", company: "" });
  const post = calls[1];
  assert.equal(post.url, "/api/intake");
  assert.equal(post.init.headers.Accept, "application/json");
  const f = new URLSearchParams(post.init.body);
  assert.equal(f.get("name"), "Ana Silva");
  assert.equal(f.get("whatsappNumber"), "+351 912 345 678");
  assert.equal(f.get("email"), "");
  assert.equal(f.get("request"), "A website, please");
  assert.equal(f.get("company"), "");
  assert.ok(Number(f.get("startedAt")) > 0);
  assert.equal(chat.state.fallback.state, "thanks");
});

test("the intake's answers: saved but not emailed is still a thank you, a field to fix says so, and only a real failure falls back to email", async () => {
  const outcome = (status, body) => plain(T.intakeOutcome(status, body));
  assert.equal(outcome(200, { ok: true }).state, "thanks");
  assert.equal(outcome(502, { error: "saved" }).state, "thanks");
  assert.deepEqual(outcome(400, { error: "Please enter a valid email address." }), { state: "form", error: "Please enter a valid email address." });
  assert.equal(outcome(500, { error: "x" }).state, "lastResort");
  assert.equal(outcome(403, null).state, "lastResort");
  assert.equal(outcome(0, null).state, "lastResort");

  const { chat } = harness([refusal(503, { error: MESSAGES.offline, kind: "offline" }), new TypeError("offline")]);
  return chat.send("Hi").then(() => chat.submitFallback({ name: "Ana", contact: "ana@example.com", request: "Hi" })).then(() => {
    assert.equal(chat.state.fallback.state, "lastResort");
  });
});

// ---- addresses ------------------------------------------------------------

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PHONE = /\+\d[\d\s().-]{6,}\d/;

test("the widget names one email address, info@, and only in the last resort", () => {
  const found = [SOURCE, CSS, JSON.stringify(talk)].flatMap((s) => s.match(EMAIL) || []);
  assert.deepEqual([...new Set(found)], ["info@chamainteligente.com"]);
  assert.equal(SOURCE.match(EMAIL).length, 1, "the address is written once, in STRINGS");
  for (const [key, value] of Object.entries(T.STRINGS)) {
    if (key === "email") continue;
    assert.doesNotMatch(String(value), EMAIL, key);
  }
  const parts = plain(T.lastResortParts());
  assert.deepEqual(parts.filter((p) => p.email), [{ email: "info@chamainteligente.com", text: "info@chamainteligente.com" }]);
  // and nothing in the widget looks like a phone number
  assert.doesNotMatch(SOURCE + JSON.stringify(talk), PHONE);
});

test("the widget's words are the site's words", () => {
  const S = T.STRINGS;
  for (const k of ["button", "phrases", "srLabel", "intro", "privacy", "privacyLink"]) assert.deepEqual(plain(S[k]), common.talk[k], k);
  assert.equal(S.close, common.close);
  for (const [k, v] of Object.entries(talk)) assert.deepEqual(plain(S[k]), v, k);
  assert.equal(S.email, common.footer.email);
  for (const v of Object.values(S).flat()) assert.doesNotMatch(String(v), /\u2014/, "no em dashes");
});

test("talk.css uses only tokens", () => {
  assert.doesNotMatch(CSS, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(CSS, /\b(rgb|hsl|oklch)a?\(/i);
});
