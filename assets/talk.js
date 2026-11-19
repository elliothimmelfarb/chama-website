/* The Talk to us chat.

   window.ChamaTalk.open({ say })            the sheet (phone) or panel (desktop)
   window.ChamaTalk.mount(el, { mode: "page" })  the same chat inside el, for /agent

   One conversation per page load, kept by createChat() below, which knows
   nothing about the DOM (test/talk.test.js drives it with a scripted fetch).
   The sheet is appended to <body>, outside the <main> the router swaps, so
   the conversation survives page changes. Every [data-talk] click and
   [data-talk-form] submit on any page is delegated from document; without
   JavaScript they are a link and a GET form to /agent.

   The API contract is the README's "Chat event contract". Model output is
   never parsed as HTML: replies are built from text nodes and anchors. */
(function (root) {
  "use strict";

  // The site's words: common.js (talk, close, footer.email) and talk.js in
  // site/content/en. test/talk.test.js fails while these differ from them.
  var STRINGS = {
    button: "Talk to us",
    phrases: ["Talk to us", "Ask a question", "Get in touch"],
    srLabel: "Talk to us, ask a question, or get in touch",
    intro: "A person reads every conversation. Leave your details and we'll reach out.",
    privacy: "Conversations are saved to improve the agent. Your details are sent only when you confirm them.",
    privacyLink: "Privacy",
    close: "Close",
    email: "info@chamainteligente.com",

    composePlaceholder: "Write a message",
    composeLabel: "Message",
    composing: "Writing a reply",
    chips: ["Leave my details", "How does pricing work?"],
    confirmChips: ["Yes, send it", "Change something"],
    confirmMessage: "Yes, send it.",

    detailsName: "Your name",
    detailsContact: "Email or phone number",
    detailsHint: "Next you'll see exactly what we'll pass on. Nothing is sent until you say yes.",
    detailsSubmit: "Continue",
    detailsCancel: "Not now",
    detailsIntro: "Please get in touch.",
    detailsNameLine: "Name",
    detailsEmailLine: "Email",
    detailsPhoneLine: "Phone",
    needName: "Add your name, so we know who to ask for.",
    needContact: "Add an email address or a phone number.",
    badEmail: "That email address looks incomplete. Check the part after the @.",
    badPhone: "That number looks too short. Include the country code.",
    sent: "Your details were passed on.",

    generic: "Something went wrong on our side. Please try again.",
    busy: "The agent is busy right now. Please try again in a minute.",
    timedOut: "The reply took too long. Please try again.",
    tryAgain: "Try again",

    fallbackOffline: "Leave a message here instead and we'll reach out.",
    fallbackUnreachable: "We can't reach the chat right now. Leave a message here instead and we'll reach out.",
    fallbackName: "Your name",
    fallbackContact: "Email or phone number",
    fallbackRequest: "What you need",
    fallbackSubmit: "Send",
    fallbackSending: "Sending",
    fallbackBack: "Back to the conversation",
    thanks: "Thank you. We have your message and will reach out.",
    lastResortBefore: "That didn't go through either. Write to us at ",
    lastResortAfter: " and we'll reach out."
  };

  // ==== pure helpers ======================================================

  function newConversationId() {
    try { if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID(); } catch (e) {}
    var hex = "";
    for (var i = 0; i < 32; i++) hex += Math.floor(Math.random() * 16).toString(16);
    return hex;
  }

  // The server keeps what the model read for five minutes.
  var WARM_WINDOW_MS = 4.5 * 60 * 1000;

  // Server-Sent Events as the contract sends them: one `data: <json>` line
  // per event, a blank line between events, cut anywhere by the network.
  var BUFFER_MAX = 256 * 1024;
  function frameReader() {
    var buffer = "";
    function take(final) {
      var parts = buffer.split(/\r?\n\r?\n/);
      buffer = final ? "" : parts.pop();
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var lines = parts[i].split(/\r?\n/);
        for (var j = 0; j < lines.length; j++) {
          if (lines[j].indexOf("data:") !== 0) continue;
          var raw = lines[j].slice(5).trim();
          if (!raw) continue;
          try { var ev = JSON.parse(raw); if (ev && typeof ev === "object") out.push(ev); } catch (e) {}
        }
      }
      return out;
    }
    return {
      push: function (text) {
        buffer += text;
        if (buffer.length > BUFFER_MAX) throw new Error("unframed stream");
        return take(false);
      },
      end: function () { return take(true); }
    };
  }

  // A refusal before streaming: the server's own words and kind, or for a
  // bare answer (Vercel's firewall sends a 429 with no JSON) what to say.
  function refusal(status, data) {
    if (data && typeof data.error === "string" && data.error) {
      var kind = data.kind === "offline" || data.kind === "retry" || data.kind === "final" ? data.kind : status >= 500 ? "retry" : "final";
      return { error: data.error, kind: kind };
    }
    if (status === 429) return { error: STRINGS.busy, kind: "retry" };
    return { error: STRINGS.generic, kind: !status || status >= 500 ? "retry" : "final" };
  }

  // The last 40 entries, opening and closing on the visitor's turn.
  function payloadMessages(history) {
    var slice = history.slice(-40);
    while (slice.length && slice[0].role !== "user") slice.shift();
    while (slice.length && slice[slice.length - 1].role !== "user") slice.pop();
    return slice;
  }

  // ---- links in replies ----
  var TRAILING = /[.,;:!?)\]]+$/;
  var ABS_URL = /^https?:\/\/\S+$/i;
  var BARE_HOST = /^(?:[a-z0-9][-a-z0-9]*\.)+[a-z]{2,6}(?:\/\S*)?$/i;
  var SITE_PATH = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*\/?)?(?:#[a-z0-9-]+)?$/i;
  var OWN_HOST = /^(?:www\.)?chamainteligente\.com$/i;

  function linkFor(token) {
    var text = token.replace(TRAILING, "");
    if (!text || text.length > 400) return null;
    if (SITE_PATH.test(text)) return { text: text, href: text, external: false };
    var href;
    if (ABS_URL.test(text)) href = text;
    else if (BARE_HOST.test(text) && text.indexOf("@") < 0) href = "https://" + text;
    else return null;
    try {
      var u = new URL(href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      // Our own pages open here, on whatever host serves this page.
      if (OWN_HOST.test(u.hostname)) return { text: text, href: u.pathname + u.search + u.hash, external: false };
      return { text: text, href: u.href, external: true };
    } catch (e) { return null; }
  }

  // Text as parts: { text } or { text, href, external }.
  function linkParts(text) {
    var tokens = String(text).split(/(\s+)/), parts = [], buf = "";
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (!t) continue;
      var hit = /\S/.test(t) ? linkFor(t) : null;
      if (!hit) { buf += t; continue; }
      if (buf) parts.push({ text: buf });
      parts.push(hit);
      buf = t.slice(hit.text.length);
    }
    if (buf || !parts.length) parts.push({ text: buf });
    return parts;
  }

  // ---- contact details ----
  var EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function words(s) { return String(s || "").toLowerCase().split(/[^\p{L}\p{N}'-]+/u).filter(Boolean); }

  // { email } or { phone }, from the one "email or phone" field.
  function splitContact(contact) {
    var c = String(contact || "").trim();
    return c.indexOf("@") >= 0 ? { email: c, phone: "" } : { email: "", phone: c };
  }

  // Errors keyed by field, or null.
  function checkDetails(d) {
    var errors = {}, name = String(d.name || "").trim(), c = splitContact(d.contact);
    if (!name) errors.name = STRINGS.needName;
    if (!c.email && !c.phone) errors.contact = STRINGS.needContact;
    else if (c.email && !EMAIL_SHAPE.test(c.email)) errors.contact = STRINGS.badEmail;
    else if (c.phone && digits(c.phone).length < 6) errors.contact = STRINGS.badPhone;
    return errors.name || errors.contact ? errors : null;
  }

  // The visitor's own message carrying their details. The agent shows them
  // back and asks; the tool refuses anything the visitor did not type.
  function detailsMessage(d) {
    var c = splitContact(d.contact);
    return STRINGS.detailsIntro + "\n" +
      STRINGS.detailsNameLine + ": " + String(d.name).trim() + "\n" +
      (c.email ? STRINGS.detailsEmailLine + ": " + c.email : STRINGS.detailsPhoneLine + ": " + c.phone);
  }

  // Did this reply show every detail back? Only then is it the question the
  // visitor answers with yes.
  function showsDetails(reply, d) {
    var text = String(reply || "").toLowerCase(), have = {};
    words(reply).forEach(function (w) { have[w] = true; });
    if (!words(d.name).every(function (w) { return have[w]; })) return false;
    var c = splitContact(d.contact);
    if (c.email) return text.indexOf(c.email.toLowerCase()) >= 0;
    return digits(reply).indexOf(digits(c.phone)) >= 0;
  }

  // What an answer from /api/intake means for the fallback form.
  function intakeOutcome(status, data) {
    // 502: saved, so Elliot will see it; only the email to him failed.
    if ((status >= 200 && status < 300) || status === 502) return { state: "thanks" };
    if (status === 400) return { state: "form", error: data && typeof data.error === "string" ? data.error : STRINGS.generic };
    return { state: "lastResort" };
  }

  // The only place the widget shows an email address.
  function lastResortParts() {
    return [{ text: STRINGS.lastResortBefore }, { email: STRINGS.email, text: STRINGS.email }, { text: STRINGS.lastResortAfter }];
  }

  // ==== the conversation ===================================================
  /* State, for any number of views to draw:
       items       [{ id, kind: "me" | "us" | "note", text, unsent, retry, done, tone }]
       composing   waiting for the first word of a reply
       busy        a reply is under way
       confirming  the agent showed the details back; the page offers yes
       details     { open, name, contact } the inline details form
       sent        the note tool ran and stored the request
       fallback    null, or { reason, message, request, state, error, startedAt } */
  function createChat(opts) {
    var doFetch = opts.fetch, now = opts.now || Date.now;
    var conversationId = newConversationId();
    var history = [];
    var listeners = [];
    var seq = 0;
    var lastWarm = null;
    var lastFailure = null;      // { text, item } a message that got no answer
    var awaiting = null;         // details given, waiting for the agent's preview
    var pending = Promise.resolve();
    var FIRST_BYTE_MS = 30000, IDLE_MS = 60000;

    var state = {
      items: [], composing: false, busy: false, confirming: false, sent: false,
      details: { open: false, name: "", contact: "" }, fallback: null
    };

    function emit() { for (var i = 0; i < listeners.length; i++) listeners[i](state); }
    function add(item) { item.id = ++seq; state.items.push(item); return item; }
    function drop(item) { var i = state.items.indexOf(item); if (i >= 0) state.items.splice(i, 1); }

    function warm() {
      var t = now();
      if (state.fallback || (lastWarm !== null && t - lastWarm < WARM_WINDOW_MS)) return;
      lastWarm = t;
      try {
        Promise.resolve(doFetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warm: true }), keepalive: true
        })).catch(function () {});
      } catch (e) {}
    }

    function toFallback(reason, message) {
      var request = history.filter(function (m) { return m.role === "user"; }).map(function (m) { return m.content; }).join("\n\n");
      state.fallback = { reason: reason, message: message || "", request: request, state: "form", error: "", startedAt: now() };
      state.confirming = false;
    }

    function send(text) {
      var message = String(text == null ? "" : text).replace(/\s+$/, "").slice(0, 4000);
      if (!message || state.busy || state.fallback) return Promise.resolve();
      var run = exchange(message);
      pending = run;
      return run;
    }

    function exchange(message) {
      // Sending the failed message again replaces it, it does not add a copy.
      if (lastFailure) {
        var f = lastFailure; lastFailure = null;
        if (f.note) drop(f.note);
        if (f.text === message) drop(f.item);
      }
      state.confirming = false;
      var mine = add({ kind: "me", text: message });
      history.push({ role: "user", content: message });
      state.busy = true; state.composing = true;
      lastWarm = now();
      emit();

      var ours = null, reply = "", toolRan = false, streamError = null, timedOut = false, finished = false;
      var controller = null, timer = 0;
      try { controller = new AbortController(); } catch (e) {}
      function arm(ms) {
        if (!controller) return;
        clearTimeout(timer);
        timer = setTimeout(function () { timedOut = true; try { controller.abort(); } catch (e) {} }, ms);
      }
      function append(t) {
        if (!ours) { ours = add({ kind: "us", text: "", done: false }); state.composing = false; }
        reply += t; ours.text = reply;
      }
      function handle(ev) {
        if (ev.type === "text" && typeof ev.text === "string") {
          append(ev.text);
        } else if (ev.type === "tool" && ev.name === "send_note_to_elliot") {
          toolRan = true;
          if (ev.ok) { state.sent = true; awaiting = null; }
          // what it says next is another stretch of the same reply
          if (reply && !/\n$/.test(reply)) append("\n\n");
        } else if (ev.type === "error") {
          streamError = { error: typeof ev.error === "string" && ev.error ? ev.error : STRINGS.generic, kind: ev.kind === "offline" ? "offline" : "retry" };
        }
        emit();
      }
      function finish() {
        clearTimeout(timer);
        if (finished) return;
        finished = true;
        state.busy = false; state.composing = false;
        if (ours) { ours.done = true; ours.text = reply = reply.replace(/\s+$/, ""); }
        if (reply) history.push({ role: "assistant", content: reply });
        if (awaiting && reply && showsDetails(reply, awaiting)) state.confirming = true;
      }
      function fail(err) {
        var answered = !!reply || toolRan;
        finish();
        if (err.kind === "offline") { toFallback("offline", err.error); emit(); return; }
        if (err.kind === "unreachable" && !answered) {
          toFallback("unreachable", "");
          history.pop();
          mine.unsent = true;
          lastFailure = { text: message, item: mine, note: null };
          emit();
          return;
        }
        if (answered) {
          // what arrived stays, and the next message carries on from it
          add({ kind: "note", text: err.error, tone: "error" });
        } else {
          history.pop();
          mine.unsent = true;
          var note = add({ kind: "note", text: err.error, tone: "error", retry: err.kind === "retry" });
          lastFailure = { text: message, item: mine, note: note };
        }
        emit();
      }

      arm(FIRST_BYTE_MS);
      return Promise.resolve().then(function () {
        return doFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: conversationId, messages: payloadMessages(history) }),
          signal: controller ? controller.signal : undefined
        });
      }).then(function (res) {
        arm(IDLE_MS);
        if (!res.ok) {
          return Promise.resolve().then(function () { return res.json(); }).then(
            function (data) { return refusal(res.status, data); },
            function () { return refusal(res.status, null); }
          ).then(function (r) { fail(r); });
        }
        if (!res.body || !res.body.getReader) { fail({ error: STRINGS.generic, kind: "retry" }); return; }
        var reader = res.body.getReader(), decoder = new TextDecoder(), frames = frameReader();
        function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) { frames.end().forEach(handle); return; }
            arm(IDLE_MS);
            frames.push(decoder.decode(chunk.value, { stream: true })).forEach(handle);
            return pump();
          });
        }
        return pump().then(function () {
          if (streamError) fail(streamError);
          else { finish(); emit(); }
        });
      }).catch(function (err) {
        if (finished) return;
        if (streamError) { fail(streamError); return; }
        if (timedOut) { fail({ error: STRINGS.timedOut, kind: "retry" }); return; }
        // fetch rejects with a TypeError when the network or the server
        // cannot be reached at all
        if (err && err.name === "TypeError") { fail({ error: STRINGS.generic, kind: "unreachable" }); return; }
        fail({ error: STRINGS.generic, kind: "retry" });
      });
    }

    var chat = {
      conversationId: conversationId,
      get state() { return state; },
      subscribe: function (fn) {
        listeners.push(fn);
        return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
      },
      idle: function () { return pending; },
      warm: warm,
      send: send,
      retry: function () {
        if (!lastFailure || !lastFailure.note || !lastFailure.note.retry || state.busy) return Promise.resolve();
        return send(lastFailure.text);
      },
      openDetails: function () { state.details.open = true; emit(); },
      closeDetails: function () { state.details.open = false; emit(); },
      // The visitor pressed Continue. Their details go to the agent as their
      // own message, which is what lets the agent show them back.
      submitDetails: function (d) {
        var errors = checkDetails(d);
        state.details = { open: !!errors, name: String(d.name || ""), contact: String(d.contact || "") };
        if (errors) { emit(); return errors; }
        awaiting = { name: state.details.name, contact: state.details.contact };
        send(detailsMessage(awaiting));
        return null;
      },
      // The only way the page says yes, and only to a preview it was shown.
      confirm: function () {
        if (!state.confirming || state.busy || state.sent) return Promise.resolve();
        state.confirming = false;
        return send(STRINGS.confirmMessage);
      },
      change: function () {
        state.confirming = false;
        state.details.open = true;
        emit();
      },
      submitFallback: function (fields) {
        var fb = state.fallback;
        if (!fb || fb.state === "sending") return Promise.resolve();
        var c = splitContact(fields.contact);
        var body = new URLSearchParams();
        body.set("name", String(fields.name || "").trim());
        body.set("email", c.email);
        body.set("whatsappNumber", c.phone);
        body.set("request", String(fields.request || "").trim());
        body.set("company", String(fields.company || ""));
        body.set("startedAt", String(fb.startedAt));
        fb.state = "sending"; fb.error = "";
        emit();
        return Promise.resolve().then(function () {
          return doFetch("/api/intake", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
            body: body.toString()
          });
        }).then(function (res) {
          return Promise.resolve().then(function () { return res.json(); }).catch(function () { return null; })
            .then(function (data) { return intakeOutcome(res.status, data); });
        }, function () { return intakeOutcome(0, null); }).then(function (out) {
          fb.state = out.state; fb.error = out.error || "";
          emit();
        });
      },
      backToChat: function () {
        if (!state.fallback || state.fallback.reason !== "unreachable") return;
        state.fallback = null;
        emit();
      }
    };
    return chat;
  }

  var api = {
    STRINGS: STRINGS,
    frameReader: frameReader,
    refusal: refusal,
    linkParts: linkParts,
    checkDetails: checkDetails,
    detailsMessage: detailsMessage,
    showsDetails: showsDetails,
    intakeOutcome: intakeOutcome,
    lastResortParts: lastResortParts,
    createChat: createChat
  };
  root.ChamaTalk = api;

  if (typeof document === "undefined") return;

  // ==== the view ============================================================

  var doc = document, html = doc.documentElement;
  // The sheet's styles load with the script, after the first paint.
  if (!doc.querySelector('link[href="/assets/talk.css?v=b376c3bce2"]')) {
    var css = doc.createElement("link");
    css.rel = "stylesheet";
    css.href = "/assets/talk.css?v=b376c3bce2";
    doc.head.appendChild(css);
  }
  var DESK = matchMedia("(min-width: 1100px)");
  var CLOSE_SVG = '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M4 4l10 10M14 4 4 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  var shared = null;
  function theChat() {
    if (!shared) shared = createChat({ fetch: function (u, i) { return fetch(u, i); } });
    return shared;
  }

  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fillParts(node, text) {
    node.textContent = "";
    linkParts(text).forEach(function (p) {
      if (!p.href) { node.appendChild(doc.createTextNode(p.text)); return; }
      var a = el("a", null, p.text);
      a.href = p.href;
      if (p.external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      node.appendChild(a);
    });
  }

  var uid = 0;
  function field(label, name, opts) {
    var id = "talk-f" + (++uid);
    var wrap = el("div", "talk-in");
    var l = el("label", null, label); l.htmlFor = id;
    var input = el(opts && opts.area ? "textarea" : "input");
    input.id = id; input.name = name;
    if (!opts || !opts.area) input.type = (opts && opts.type) || "text";
    if (opts && opts.autocomplete) input.autocomplete = opts.autocomplete;
    if (opts && opts.area) input.rows = 4;
    var err = el("p", "talk-err"); err.id = id + "-err"; err.hidden = true;
    input.setAttribute("aria-describedby", err.id);
    wrap.append(l, input, err);
    return { wrap: wrap, input: input, err: err };
  }
  function showError(f, msg) {
    f.err.textContent = msg || "";
    f.err.hidden = !msg;
    if (msg) f.input.setAttribute("aria-invalid", "true"); else f.input.removeAttribute("aria-invalid");
  }

  /* Draws one chat into root. mode "sheet" adds the grab handle and the
     close button; "page" is the same contents in the page's flow. */
  function render(rootEl, mode, chat) {
    rootEl.classList.add("talk", "talk--" + mode);
    rootEl.setAttribute("data-talk-sheet", "");
    var titleId = "talk-title-" + (++uid);

    var grab = mode === "sheet" ? el("div", "talk-grab") : null;
    if (grab) grab.setAttribute("aria-hidden", "true");

    var head = el("div", "talk-head");
    var title = el(mode === "page" ? "h1" : "h2", "talk-title");
    title.id = titleId;
    var sr = el("span", "sr-only", STRINGS.srLabel);
    var cycle = el("span", "cycle-words talk-cycle");
    cycle.setAttribute("aria-hidden", "true");
    cycle.setAttribute("data-cycle", "");
    STRINGS.phrases.forEach(function (p, i) { var s = el("span", i === 0 ? "on" : null, p); cycle.appendChild(s); });
    // On desktop the panel's phrase holds on "Talk to us".
    var still = el("span", "talk-still", STRINGS.button);
    still.setAttribute("aria-hidden", "true");
    title.append(sr, cycle, still);
    head.appendChild(title);
    var closeBtn = null;
    if (mode === "sheet") {
      closeBtn = el("button", "btn btn-quiet icon-btn talk-x");
      closeBtn.type = "button";
      closeBtn.setAttribute("aria-label", STRINGS.close);
      closeBtn.innerHTML = CLOSE_SVG; // a fixed string written above
      head.appendChild(closeBtn);
    }
    var intro = el("p", "talk-intro", STRINGS.intro);

    var body = el("div", "talk-body");
    var thread = el("ol", "talk-thread");
    thread.setAttribute("role", "log");
    thread.setAttribute("aria-live", "polite");
    thread.setAttribute("aria-label", STRINGS.button);
    var dots = el("li", "talk-dots");
    dots.innerHTML = "<span></span><span></span><span></span>";
    dots.appendChild(el("span", "sr-only", STRINGS.composing));

    // the inline details form
    var details = el("form", "talk-details");
    details.noValidate = true;
    var fName = field(STRINGS.detailsName, "name", { autocomplete: "name" });
    var fContact = field(STRINGS.detailsContact, "contact", { autocomplete: "email", type: "text" });
    fContact.input.setAttribute("inputmode", "email");
    var hint = el("p", "talk-hint", STRINGS.detailsHint);
    var dRow = el("div", "talk-row");
    var dGo = el("button", "btn btn-accent", STRINGS.detailsSubmit); dGo.type = "submit";
    var dNo = el("button", "btn btn-quiet", STRINGS.detailsCancel); dNo.type = "button";
    dRow.append(dGo, dNo);
    details.append(fName.wrap, fContact.wrap, hint, dRow);

    // the fallback form, which replaces the thread
    var fallback = el("div", "talk-fallback");
    var fbLead = el("p", "talk-fb-lead");
    var fbForm = el("form", "talk-fb-form");
    fbForm.noValidate = true;
    fbForm.action = "/api/intake"; fbForm.method = "post";
    var gName = field(STRINGS.fallbackName, "name", { autocomplete: "name" });
    var gContact = field(STRINGS.fallbackContact, "contact", { autocomplete: "email" });
    var gReq = field(STRINGS.fallbackRequest, "request", { area: true });
    var trap = el("input", "talk-hp"); trap.name = "company"; trap.tabIndex = -1; trap.autocomplete = "off";
    trap.setAttribute("aria-hidden", "true");
    var gErr = el("p", "talk-err"); gErr.hidden = true;
    var gRow = el("div", "talk-row");
    var gGo = el("button", "btn btn-accent", STRINGS.fallbackSubmit); gGo.type = "submit";
    var gBack = el("button", "btn btn-quiet", STRINGS.fallbackBack); gBack.type = "button";
    gRow.append(gGo, gBack);
    fbForm.append(gName.wrap, gContact.wrap, gReq.wrap, trap, gErr, gRow);
    var fbDone = el("p", "talk-fb-done");
    fbDone.setAttribute("role", "status");
    fallback.append(fbLead, fbForm, fbDone);

    body.append(thread, details, fallback);

    var chips = el("div", "talk-chips");
    var compose = el("form", "field talk-compose");
    var input = el("input");
    input.name = "message"; input.autocomplete = "off"; input.placeholder = STRINGS.composePlaceholder;
    input.setAttribute("aria-label", STRINGS.composeLabel);
    input.setAttribute("enterkeyhint", "send");
    var sendBtn = el("button", "btn btn-accent", STRINGS.button); sendBtn.type = "submit";
    compose.append(input, sendBtn);
    var fine = el("p", "talk-fine", STRINGS.privacy + " ");
    var pl = el("a", null, STRINGS.privacyLink); pl.href = "/privacy";
    fine.appendChild(pl);

    rootEl.textContent = "";
    if (grab) rootEl.appendChild(grab);
    rootEl.append(head, intro, body, chips, compose, fine);
    if (mode === "sheet") { rootEl.setAttribute("role", "dialog"); rootEl.setAttribute("aria-labelledby", titleId); }

    // ---- drawing state ----
    var nodes = {};
    var wasDetailsOpen = false, wasFallback = null, wasConfirming = false;
    function near() { return body.scrollHeight - body.scrollTop - body.clientHeight < 80; }
    function draw(s) {
      var stick = near();
      var keep = {};
      s.items.forEach(function (it) {
        keep[it.id] = true;
        var n = nodes[it.id];
        if (!n) {
          n = nodes[it.id] = el("li", "talk-msg talk-" + it.kind);
          n._text = null;
          if (it.kind === "note" && it.tone === "error") n.classList.add("talk-error");
          thread.insertBefore(n, dots.parentNode === thread ? dots : null);
        }
        n.classList.toggle("talk-unsent", !!it.unsent);
        if (n._text !== it.text || n._retry !== !!it.retry) {
          n._text = it.text; n._retry = !!it.retry;
          if (it.kind === "us") fillParts(n, it.text);
          else n.textContent = it.text;
          if (it.retry) {
            var again = el("button", "talk-retry", STRINGS.tryAgain);
            again.type = "button";
            again.addEventListener("click", function () { chat.retry(); });
            n.append(" ", again);
          }
        }
      });
      Object.keys(nodes).forEach(function (id) { if (!keep[id]) { nodes[id].remove(); delete nodes[id]; } });
      if (s.sent && !thread.querySelector(".talk-sentmark")) {
        var mark = el("li", "talk-msg talk-note talk-sentmark", STRINGS.sent);
        thread.insertBefore(mark, dots.parentNode === thread ? dots : null);
      }
      if (s.composing) thread.appendChild(dots); else if (dots.parentNode) dots.remove();
      thread.setAttribute("aria-busy", s.busy ? "true" : "false");

      // details form
      var showDetails = s.details.open && !s.sent && !s.fallback;
      details.hidden = !showDetails;
      if (showDetails && !wasDetailsOpen) {
        fName.input.value = s.details.name; fContact.input.value = s.details.contact;
        showError(fName, ""); showError(fContact, "");
        setTimeout(function () { fName.input.focus({ preventScroll: true }); details.scrollIntoView({ block: "nearest" }); }, 0);
      }
      wasDetailsOpen = showDetails;

      // chips: yes or change while a preview waits; otherwise an offer to leave details
      chips.textContent = "";
      var list = [];
      if (s.confirming) list = [[STRINGS.confirmChips[0], chat.confirm, true], [STRINGS.confirmChips[1], chat.change]];
      else if (!s.sent && !showDetails && !s.busy) {
        list.push([STRINGS.chips[0], chat.openDetails]);
        if (!s.items.length) list.push([STRINGS.chips[1], function () { chat.send(STRINGS.chips[1]); }]);
      }
      list.forEach(function (c) {
        var b = el("button", "talk-chip" + (c[2] ? " talk-chip-yes" : ""), c[0]);
        b.type = "button";
        b.addEventListener("click", function () { c[1](); });
        chips.appendChild(b);
      });
      chips.hidden = !list.length || !!s.fallback;
      if (s.confirming && !wasConfirming) setTimeout(function () { var y = chips.querySelector("button"); if (y && rootEl.contains(doc.activeElement)) y.focus({ preventScroll: true }); }, 0);
      wasConfirming = s.confirming;

      // fallback
      var fb = s.fallback;
      rootEl.classList.toggle("talk-is-fallback", !!fb);
      thread.hidden = !!fb;
      fallback.hidden = !fb;
      compose.hidden = !!fb;
      if (fb) {
        if (!wasFallback) {
          gReq.input.value = fb.request;
          setTimeout(function () { if (rootEl.contains(doc.activeElement) || doc.activeElement === doc.body) gName.input.focus({ preventScroll: true }); }, 0);
        }
        fbLead.textContent = (fb.message ? fb.message + " " : "") + (fb.reason === "offline" ? STRINGS.fallbackOffline : STRINGS.fallbackUnreachable);
        fbForm.hidden = fb.state === "thanks" || fb.state === "lastResort";
        fbLead.hidden = fbForm.hidden;
        gBack.hidden = fb.reason !== "unreachable";
        gGo.disabled = fb.state === "sending";
        gGo.textContent = fb.state === "sending" ? STRINGS.fallbackSending : STRINGS.fallbackSubmit;
        gErr.textContent = fb.error; gErr.hidden = !fb.error;
        fbDone.textContent = "";
        if (fb.state === "thanks") fbDone.textContent = STRINGS.thanks;
        if (fb.state === "lastResort") {
          lastResortParts().forEach(function (p) {
            if (!p.email) { fbDone.appendChild(doc.createTextNode(p.text)); return; }
            var a = el("a", null, p.text); a.href = "mailto:" + p.email; fbDone.appendChild(a);
          });
        }
        fbDone.hidden = !fbDone.textContent;
      }
      // the form replaces the thread, so it opens at its own top
      if (fb && !wasFallback) { stick = false; body.scrollTop = 0; }
      wasFallback = fb;

      sendBtn.disabled = s.busy;
      rootEl.classList.toggle("talk-has-thread", s.items.length > 0);
      rootEl.classList.toggle("talk-empty", !s.items.length && !s.composing && !showDetails && !fb);
      if (stick) body.scrollTop = body.scrollHeight;
    }

    // ---- input ----
    compose.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v || chat.state.busy) return;
      input.value = "";
      chat.send(v);
    });
    input.addEventListener("focus", function () { chat.warm(); });
    details.addEventListener("submit", function (e) {
      e.preventDefault();
      var errors = chat.submitDetails({ name: fName.input.value, contact: fContact.input.value });
      showError(fName, errors && errors.name); showError(fContact, errors && errors.contact);
      if (errors) (errors.name ? fName : fContact).input.focus();
      else input.focus({ preventScroll: true });
    });
    dNo.addEventListener("click", function () { chat.closeDetails(); input.focus({ preventScroll: true }); });
    fbForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = gName.input.value.trim(), contact = gContact.input.value.trim(), request = gReq.input.value.trim();
      var errors = checkDetails({ name: name, contact: contact });
      showError(gName, errors && errors.name); showError(gContact, errors && errors.contact);
      if (errors) { (errors.name ? gName : gContact).input.focus(); return; }
      if (!request) { gReq.input.focus(); return; }
      chat.submitFallback({ name: name, contact: contact, request: request, company: trap.value });
    });
    gBack.addEventListener("click", function () { chat.backToChat(); input.focus({ preventScroll: true }); });

    var off = chat.subscribe(draw);
    draw(chat.state);
    return { root: rootEl, input: input, closeBtn: closeBtn, grab: grab, head: head, title: title, body: body, unsubscribe: off };
  }

  // ==== the sheet ===========================================================

  var sheet = null;     // { el, scrim, view, open, opener }
  var page = null;      // a view mounted with mode "page"

  function focusables(node) {
    return [].filter.call(node.querySelectorAll("a[href], button:not([disabled]), input:not([tabindex='-1']), textarea, [tabindex]:not([tabindex='-1'])"), function (n) {
      return n.offsetParent !== null || n === doc.activeElement;
    });
  }

  function ensureSheet() {
    if (sheet) return sheet;
    var scrim = el("div", "talk-scrim");
    scrim.hidden = true;
    var box = el("section");
    box.hidden = true;
    doc.body.append(scrim, box);
    var view = render(box, "sheet", theChat());
    sheet = { el: box, scrim: scrim, view: view, open: false, opener: null };

    view.closeBtn.addEventListener("click", function () { close(); });
    scrim.addEventListener("click", function () { close(); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !sheet.open || DESK.matches) return;
      // the phone sheet is modal: Tab goes round the header and the sheet
      var top = doc.querySelector(".top");
      var f = (top ? focusables(top) : []).concat(focusables(box));
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    // A link in a reply to one of our pages: on a phone, the sheet steps
    // aside so the page can be read; the conversation is kept.
    box.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest(".talk-us a[href]");
      if (a && !a.target && !DESK.matches) close({ quiet: true });
    });
    DESK.addEventListener("change", function () { if (sheet.open) modal(); });
    dragToClose(view, box);
    keyboardFit(box);
    return sheet;
  }

  // Phone: modal, with the rest of the page inert. Desktop: a panel beside
  // the page, which stays usable.
  // The header stays above the scrim and usable, so it is
  // part of the phone sheet's focus loop and is never made inert.
  function modal() {
    var phone = !DESK.matches && sheet.open;
    sheet.el.setAttribute("aria-modal", phone ? "true" : "false");
    sheet.scrim.hidden = !phone;
    html.classList.toggle("talk-locked", phone);
    [].forEach.call(doc.body.children, function (n) {
      if (n === sheet.el || n === sheet.scrim || n.tagName === "SCRIPT" || n.matches(".top")) return;
      if (phone) n.setAttribute("inert", ""); else n.removeAttribute("inert");
    });
  }

  function open(opts) {
    opts = opts || {};
    if (page && page.root.isConnected) {
      if (opts.say) theChat().send(opts.say);
      page.input.focus();
      return;
    }
    var s = ensureSheet();
    if (!s.open) {
      s.opener = opts.opener || doc.activeElement;
      s.open = true;
      s.el.hidden = false;
      s.scrim.hidden = DESK.matches;
      s.el.style.translate = "";
      void s.el.offsetWidth;
      s.el.classList.add("is-open");
      s.scrim.classList.add("is-open");
      html.classList.add("talk-open");
      modal();
    }
    theChat().warm();
    if (opts.say) theChat().send(opts.say);
    // A message already on its way: on a phone the keyboard would cover
    // the reply, so focus goes to the heading; otherwise to the composer.
    var target = opts.say && !DESK.matches ? s.view.title : s.view.input;
    if (target === s.view.title) target.tabIndex = -1;
    setTimeout(function () { try { target.focus({ preventScroll: true }); } catch (e) {} }, 0);
  }

  function close(opts) {
    if (!sheet || !sheet.open) return;
    var s = sheet;
    s.open = false;
    s.el.classList.remove("is-open");
    s.scrim.classList.remove("is-open");
    html.classList.remove("talk-open");
    modal();
    s.scrim.hidden = false;
    var done = function () {
      if (s.open) return;
      s.el.hidden = true; s.scrim.hidden = true; s.el.style.translate = "";
    };
    var ms = parseFloat(getComputedStyle(s.el).transitionDuration) * 1000 || 0;
    setTimeout(done, ms + 40);
    if (opts && opts.quiet) return;
    var back = s.opener && s.opener.isConnected && s.opener !== doc.body ? s.opener : doc.querySelector("[data-talk]");
    if (back) try { back.focus({ preventScroll: true }); } catch (e) {}
  }

  // Drag the handle or the head down to close (phone only): past 30% of
  // the sheet's height, or a fast flick.
  function dragToClose(view, box) {
    var y0 = 0, t0 = 0, dy = 0, h = 1, id = null;
    function down(e) {
      if (DESK.matches || e.button > 0 || (e.target.closest && e.target.closest("button, a"))) return;
      id = e.pointerId; y0 = e.clientY; t0 = performance.now(); dy = 0; h = box.offsetHeight || 1;
      box.classList.add("is-dragging");
      try { e.currentTarget.setPointerCapture(id); } catch (err) {}
    }
    function move(e) {
      if (e.pointerId !== id) return;
      dy = Math.max(0, e.clientY - y0);
      box.style.translate = "0 " + dy + "px";
    }
    function up(e) {
      if (e.pointerId !== id) return;
      id = null;
      box.classList.remove("is-dragging");
      var v = dy / Math.max(1, performance.now() - t0);
      if (dy > h * 0.3 || (v > 0.5 && dy > 24)) close();
      else box.style.translate = "";
    }
    [view.grab, view.head].forEach(function (n) {
      n.addEventListener("pointerdown", down);
      n.addEventListener("pointermove", move);
      n.addEventListener("pointerup", up);
      n.addEventListener("pointercancel", up);
    });
  }

  // On a phone the on-screen keyboard shrinks the visual viewport; the
  // sheet sits on top of the keyboard instead of under it.
  function keyboardFit(box) {
    var vv = root.visualViewport;
    if (!vv) return;
    function fit() {
      var kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
      box.style.setProperty("--talk-kb", kb + "px");
      box.style.setProperty("--talk-vh", vv.height + "px");
    }
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    fit();
  }

  // ---- the page mode, for /agent ----
  function mount(target, opts) {
    var mode = opts && opts.mode === "page" ? "page" : "sheet";
    if (mode !== "page") { open(opts); return sheet && sheet.view; }
    if (sheet && sheet.open) close({ quiet: true });
    page = render(target, "page", theChat());
    var say = (opts && opts.say) || "";
    // A visitor without JavaScript posted the field to /agent?q=...
    try {
      var params = new URLSearchParams(location.search);
      if (!say) say = params.get("q") || params.get("say") || "";
      if (params.has("q") || params.has("say")) {
        params.delete("q"); params.delete("say");
        var q = params.toString();
        history.replaceState(history.state, "", location.pathname + (q ? "?" + q : "") + location.hash);
      }
    } catch (e) {}
    theChat().warm();
    if (say) theChat().send(say);
    else page.input.focus({ preventScroll: true });
    return page;
  }

  // ---- delegation: capture, so this runs before the router sees the click
  doc.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest("[data-talk]");
    // On a phone, anything else in the header (the menu, the lockup) steps
    // the sheet aside first; the conversation is kept.
    if (!a && sheet && sheet.open && !DESK.matches && e.target.closest && e.target.closest(".top")) close({ quiet: true });
    if (!a) return;
    e.preventDefault();
    if (sheet && sheet.open && a.closest(".top")) { close(); return; }
    open({ opener: a });
  }, true);
  doc.addEventListener("submit", function (e) {
    var form = e.target.closest && e.target.closest("[data-talk-form]");
    if (!form) return;
    e.preventDefault();
    var q = form.elements.q, text = q ? q.value.trim() : "";
    if (q) q.value = "";
    open({ opener: q || form, say: text });
  }, true);
  doc.addEventListener("focusin", function (e) {
    if (e.target.closest && e.target.closest("[data-talk-form]")) theChat().warm();
  });

  api.open = open;
  api.close = close;
  api.mount = mount;
  api.chat = theChat;
})(typeof window !== "undefined" ? window : globalThis);
