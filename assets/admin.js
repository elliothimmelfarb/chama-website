/* ==========================================================================
   The admin area at /admin.

   One vanilla app, no libraries, no build step. It reads two endpoints:
   /api/admin-auth (the Google sign-in exchange and the session cookie) and
   /api/admin-data (everything it shows). A 401 from either one, at any
   moment, drops straight back to the sign-in gate.

   The hard rule in here: everything the API returns is visitor text, and
   visitor text is data. It reaches the page only through textContent or
   createTextNode. There is no innerHTML in this file and no HTML is ever
   assembled from a value. A transcript that contains markup is shown as the
   characters a visitor typed, which is the only honest way to read it.
   ========================================================================== */

(function () {
  "use strict";

  var GIS_SRC = "https://accounts.google.com/gsi/client";
  var MARK_PATHS = [
    "M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z",
    "M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57.0 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z"
  ];

  var state = {
    root: null,
    main: null,
    masthead: null,
    signedIn: false,
    summary: null,
    tab: "conversations",
    lists: { conversations: null, intakes: null },
    gisLoaded: false
  };

  /* ---------- tiny DOM helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined && text !== null) { node.textContent = String(text); }
    return node;
  }

  function svgNode(tag, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        node.setAttribute(key, String(attrs[key]));
      });
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  function button(label, className, onClick) {
    var node = el("button", className || "btn", label);
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function mark() {
    var svg = svgNode("svg", { class: "mark", viewBox: "0 0 64 64", "aria-hidden": "true" });
    var group = svgNode("g", { transform: "translate(2.0612 0.0639)", fill: "#f4581f" });
    MARK_PATHS.forEach(function (d) { group.appendChild(svgNode("path", { d: d })); });
    svg.appendChild(group);
    return svg;
  }

  /* ---------- formatting ---------- */

  function toDate(value) {
    if (!value) { return null; }
    var date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  function stamp(value) {
    var date = toDate(value);
    if (!date) { return "date unknown"; }
    return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }

  function day(value) {
    var date = toDate(value);
    return date ? date.toISOString().slice(0, 10) : "";
  }

  function count(value) {
    return typeof value === "number" && isFinite(value) ? String(value) : "0";
  }

  function plural(n, one, many) {
    return String(n) + " " + (n === 1 ? one : many);
  }

  function text(value) {
    return typeof value === "string" ? value : "";
  }

  /* ---------- the network edge ---------- */

  function Unauthorized() { this.unauthorized = true; }

  function readJson(response) {
    return response.json().catch(function () { return {}; });
  }

  function apiGet(query) {
    return fetch("/api/admin-data?" + query, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    }).then(function (response) {
      if (response.status === 401) { throw new Unauthorized(); }
      if (!response.ok) { throw new Error("request failed"); }
      return response.json();
    });
  }

  /* ---------- shell ---------- */

  function buildShell() {
    var root = state.root;
    clear(root);

    var masthead = el("header", "masthead");
    var name = el("p", "masthead-name");
    name.appendChild(mark());
    name.appendChild(document.createTextNode("Chama Inteligente"));
    masthead.appendChild(name);
    masthead.appendChild(el("div", "masthead-right"));

    var main = el("main");
    main.id = "admin-main";

    root.appendChild(masthead);
    root.appendChild(main);

    state.masthead = masthead;
    state.main = main;
  }

  function setMastheadSignedOut() {
    var right = state.masthead.querySelector(".masthead-right");
    clear(right);
    right.appendChild(el("span", "label", "Private"));
  }

  function setMastheadSignedIn(email) {
    var right = state.masthead.querySelector(".masthead-right");
    clear(right);
    if (email) { right.appendChild(el("span", "who", email)); }
    right.appendChild(button("Sign out", "btn", signOut));
  }

  function show(node) {
    clear(state.main);
    state.main.appendChild(node);
  }

  /* ---------- states ---------- */

  function loadingState(what) {
    var wrap = el("div", "state");
    wrap.setAttribute("role", "status");
    var line = el("p");
    line.appendChild(el("span", "pulse"));
    line.appendChild(document.createTextNode(what));
    wrap.appendChild(line);
    return wrap;
  }

  function errorState(message, retry) {
    var wrap = el("div", "state error");
    wrap.appendChild(el("span", "label", "Something did not load"));
    wrap.appendChild(el("p", null, message));
    if (retry) { wrap.appendChild(button("Try again", "btn", retry)); }
    return wrap;
  }

  function emptyState(title, line) {
    var wrap = el("div", "state");
    wrap.appendChild(el("span", "label", title));
    wrap.appendChild(el("p", null, line));
    return wrap;
  }

  /* ---------- the gate ---------- */

  function goToGate() {
    state.signedIn = false;
    state.summary = null;
    state.lists = { conversations: null, intakes: null };
    setMastheadSignedOut();

    var gate = el("section", "gate");
    var heading = el("h1");
    heading.appendChild(document.createTextNode("The "));
    heading.appendChild(el("em", null, "admin"));
    heading.appendChild(document.createTextNode(" door."));
    gate.appendChild(heading);
    gate.appendChild(el("p", null, "Conversations, contact requests and the state of the flame. One account opens this, and it is not yours unless it is on the list."));

    var slot = el("div", "gate-button");
    gate.appendChild(slot);

    var note = el("p", "gate-note", "Signing in sends a Google identity token to this site's own endpoint. No password is handled here and this site holds no Google secret.");
    gate.appendChild(note);

    show(gate);

    fetch("/api/admin-auth", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (response) {
        if (response.status === 503) {
          return readJson(response).then(function () {
            clear(slot);
            slot.appendChild(el("p", null, "Sign-in is not configured on this deployment yet. The three admin environment variables are missing in Vercel."));
            throw new Error("not configured");
          });
        }
        if (!response.ok) { throw new Error("auth config failed"); }
        return response.json();
      })
      .then(function (config) {
        var clientId = text(config && config.clientId);
        if (!clientId) { throw new Error("no client id"); }
        return loadGis().then(function () { renderGoogleButton(slot, clientId); });
      })
      .catch(function (error) {
        if (error && error.message === "not configured") { return; }
        clear(slot);
        slot.appendChild(el("p", null, "The sign-in button could not be loaded. Check the connection and reload the page."));
      });
  }

  function loadGis() {
    if (state.gisLoaded && window.google && window.google.accounts) { return Promise.resolve(); }
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-gis="1"]');
      if (existing) {
        existing.addEventListener("load", function () { resolve(); });
        existing.addEventListener("error", function () { reject(new Error("gis load failed")); });
        return;
      }
      var script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.setAttribute("data-gis", "1");
      script.addEventListener("load", function () { state.gisLoaded = true; resolve(); });
      script.addEventListener("error", function () { reject(new Error("gis load failed")); });
      document.head.appendChild(script);
    });
  }

  function renderGoogleButton(slot, clientId) {
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      throw new Error("gis missing");
    }
    clear(slot);
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: onCredential,
      cancel_on_tap_outside: true,
      auto_select: false
    });
    var host = el("div");
    slot.appendChild(host);
    window.google.accounts.id.renderButton(host, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "signin_with",
      shape: "pill",
      logo_alignment: "left"
    });
  }

  function onCredential(response) {
    var credential = response && response.credential;
    if (!credential) { return; }
    show(loadingState("Checking the sign-in."));
    fetch("/api/admin-auth", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ credential: credential })
    }).then(function (res) {
      if (res.ok) { return openDashboard(); }
      return readJson(res).then(function (body) {
        goToGate();
        var slot = state.main.querySelector(".gate-button");
        var message = text(body && body.error) || "Sign-in was not accepted.";
        if (slot) { slot.parentNode.insertBefore(el("p", null, message), slot.nextSibling); }
      });
    }).catch(function () {
      goToGate();
    });
  }

  function signOut() {
    fetch("/api/admin-auth", { method: "DELETE", credentials: "same-origin" })
      .catch(function () { /* the gate is the destination either way */ })
      .then(function () {
        if (window.google && window.google.accounts && window.google.accounts.id) {
          try { window.google.accounts.id.disableAutoSelect(); } catch (error) { /* nothing to disable */ }
        }
        goToGate();
      });
  }

  /* ---------- the dashboard ---------- */

  function openDashboard() {
    state.signedIn = true;
    show(loadingState("Reading the room."));
    return apiGet("view=summary")
      .then(function (data) {
        state.summary = data;
        setMastheadSignedIn(text(data && data.email));
        renderDashboard();
      })
      .catch(function (error) {
        if (error instanceof Unauthorized) { goToGate(); return; }
        show(errorState("The summary did not come back. This is usually the blob store or a cold function.", openDashboard));
      });
  }

  function renderDashboard() {
    var summary = state.summary || {};
    var wrap = el("section");

    wrap.appendChild(overviewBlock(summary));
    wrap.appendChild(switchBlock());

    var body = el("div");
    body.id = "admin-section";
    wrap.appendChild(body);

    show(wrap);
    renderSection();
  }

  function overviewBlock(summary) {
    var block = el("section", "overview");
    var flame = summary.flame || {};

    var pill = el("div", "flame-pill");
    pill.appendChild(el("span", "flame-dot"));
    var label;
    if (flame.chatDisabledEnv) {
      pill.classList.add("out");
      label = "Offline by environment";
    } else if (flame.killed) {
      pill.classList.add("out");
      label = "The flame is out";
    } else {
      pill.classList.add("burning");
      label = "The flame is burning";
    }
    pill.appendChild(el("span", null, label));
    block.appendChild(pill);

    if (flame.killed && flame.at) {
      block.appendChild(el("p", "flame-reason", "Put out " + stamp(flame.at) + ". " + (text(flame.reason) || "No reason recorded.")));
    } else if (flame.killed) {
      block.appendChild(el("p", "flame-reason", text(flame.reason) || "No reason recorded."));
    } else if (flame.chatDisabledEnv) {
      block.appendChild(el("p", "flame-reason", "CHAT_DISABLED is set in the Vercel environment. Clearing it and redeploying brings the flame back."));
    }

    var totals = summary.totals || {};
    var days = Array.isArray(summary.days) ? summary.days : [];

    var tiles = el("div", "tiles");
    tiles.appendChild(tile("Conversations", count(totals.conversations)));
    tiles.appendChild(tile("Contact requests", count(totals.intakes)));
    tiles.appendChild(tile("Notes sent", count(totals.notesSent)));
    tiles.appendChild(tile("Last activity", lastActivity(days), true));
    block.appendChild(tiles);

    block.appendChild(chartBlock(days));
    return block;
  }

  function tile(name, value, small) {
    var node = el("div", "tile");
    node.appendChild(el("span", "label", name));
    node.appendChild(el("span", "tile-value" + (small ? " small" : ""), value));
    return node;
  }

  function lastActivity(days) {
    for (var i = days.length - 1; i >= 0; i -= 1) {
      var entry = days[i] || {};
      if ((entry.conversations || 0) + (entry.intakes || 0) > 0) { return text(entry.day) || "unknown"; }
    }
    return "nothing yet";
  }

  function chartBlock(days) {
    var block = el("section", "chart");
    var head = el("div", "chart-head");
    head.appendChild(el("h2", null, "Last 30 days"));

    var legend = el("div", "legend");
    var one = el("span");
    one.appendChild(el("i", "swatch conversations"));
    one.appendChild(document.createTextNode("Conversations"));
    var two = el("span");
    two.appendChild(el("i", "swatch intakes"));
    two.appendChild(document.createTextNode("Contact requests"));
    legend.appendChild(one);
    legend.appendChild(two);
    head.appendChild(legend);
    block.appendChild(head);

    if (!days.length) {
      block.appendChild(el("p", null, "No days to draw yet."));
      return block;
    }

    var width = 640;
    var plot = 130;
    var baseline = plot;
    var slot = width / days.length;
    var barWidth = Math.max(2, slot - 3);

    var peak = 1;
    days.forEach(function (entry) {
      var total = (entry.conversations || 0) + (entry.intakes || 0);
      if (total > peak) { peak = total; }
    });

    var svg = svgNode("svg", {
      viewBox: "0 0 " + width + " 152",
      role: "img",
      "aria-label": "Conversations and contact requests per day over the last 30 days"
    });
    svg.appendChild(svgNode("line", { class: "grid", x1: 0, y1: baseline + 0.5, x2: width, y2: baseline + 0.5 }));

    days.forEach(function (entry, index) {
      var conversations = entry.conversations || 0;
      var intakes = entry.intakes || 0;
      var total = conversations + intakes;
      var x = index * slot + (slot - barWidth) / 2;

      var group = svgNode("g", {});
      var title = svgNode("title", {});
      title.textContent = text(entry.day) + ": " + plural(conversations, "conversation", "conversations") + ", " + plural(intakes, "contact request", "contact requests");
      group.appendChild(title);

      if (total === 0) {
        group.appendChild(svgNode("rect", { class: "bar-empty", x: x, y: baseline - 2, width: barWidth, height: 2 }));
      } else {
        var scale = (plot - 6) / peak;
        var conversationsHeight = conversations * scale;
        var intakesHeight = intakes * scale;
        if (conversationsHeight > 0) {
          group.appendChild(svgNode("rect", {
            class: "bar-conversations",
            x: x,
            y: baseline - conversationsHeight,
            width: barWidth,
            height: conversationsHeight
          }));
        }
        if (intakesHeight > 0) {
          group.appendChild(svgNode("rect", {
            class: "bar-intakes",
            x: x,
            y: baseline - conversationsHeight - intakesHeight,
            width: barWidth,
            height: intakesHeight
          }));
        }
      }
      svg.appendChild(group);
    });

    var first = svgNode("text", { class: "axis", x: 0, y: 148 });
    first.textContent = text(days[0] && days[0].day);
    var last = svgNode("text", { class: "axis", x: width, y: 148, "text-anchor": "end" });
    last.textContent = text(days[days.length - 1] && days[days.length - 1].day);
    svg.appendChild(first);
    svg.appendChild(last);

    block.appendChild(svg);
    return block;
  }

  function switchBlock() {
    var bar = el("div", "switch");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "What to read");

    var conversations = button("Conversations", "btn", function () { selectTab("conversations"); });
    var intakes = button("Contact requests", "btn", function () { selectTab("intakes"); });
    conversations.setAttribute("aria-pressed", state.tab === "conversations" ? "true" : "false");
    intakes.setAttribute("aria-pressed", state.tab === "intakes" ? "true" : "false");

    bar.appendChild(conversations);
    bar.appendChild(intakes);
    bar.appendChild(el("span", "spacer"));
    bar.appendChild(button("Refresh", "btn", function () {
      state.lists = { conversations: null, intakes: null };
      openDashboard();
    }));
    return bar;
  }

  function selectTab(tab) {
    state.tab = tab;
    var buttons = state.main.querySelectorAll(".switch .btn");
    if (buttons.length >= 2) {
      buttons[0].setAttribute("aria-pressed", tab === "conversations" ? "true" : "false");
      buttons[1].setAttribute("aria-pressed", tab === "intakes" ? "true" : "false");
    }
    renderSection();
  }

  function sectionSlot() {
    return document.getElementById("admin-section");
  }

  function renderSection() {
    var slot = sectionSlot();
    if (!slot) { return; }
    var tab = state.tab;
    var cached = state.lists[tab];

    if (cached) {
      clear(slot);
      slot.appendChild(tab === "conversations" ? conversationList(cached) : intakeList(cached));
      return;
    }

    clear(slot);
    slot.appendChild(loadingState(tab === "conversations" ? "Reading the conversations." : "Reading the contact requests."));

    var query = tab === "conversations" ? "view=conversations&days=30" : "view=intakes&days=30";
    apiGet(query)
      .then(function (data) {
        var rows = tab === "conversations" ? data.conversations : data.intakes;
        state.lists[tab] = Array.isArray(rows) ? rows : [];
        if (state.tab !== tab) { return; }
        renderSection();
      })
      .catch(function (error) {
        if (error instanceof Unauthorized) { goToGate(); return; }
        if (state.tab !== tab) { return; }
        var current = sectionSlot();
        if (!current) { return; }
        clear(current);
        current.appendChild(errorState("That list did not come back.", function () {
          state.lists[tab] = null;
          renderSection();
        }));
      });
  }

  function conversationList(rows) {
    if (!rows.length) {
      return emptyState("No conversations", "Nothing has been said to the flame in this window. The list fills itself as visitors talk.");
    }

    var list = el("ul", "rows");
    rows.forEach(function (row) {
      var item = el("li");
      var openIt = button(null, "row", function () { openTranscript(row); });

      var meta = el("div", "row-meta");
      meta.appendChild(el("span", "strong", text(row.day) || day(row.updatedAt) || "day unknown"));
      meta.appendChild(el("span", null, stamp(row.updatedAt)));
      meta.appendChild(el("span", null, plural(row.turnCount || 0, "turn", "turns")));
      meta.appendChild(el("span", null, plural(row.userTurns || 0, "from the visitor", "from the visitor")));
      if (row.noteSent) { meta.appendChild(el("span", "badge", "Note sent")); }
      openIt.appendChild(meta);

      var preview = text(row.preview);
      openIt.appendChild(el("p", preview ? "row-text" : "row-text quiet", preview || "No visitor text in this one."));

      item.appendChild(openIt);
      list.appendChild(item);
    });
    return list;
  }

  function intakeList(rows) {
    if (!rows.length) {
      return emptyState("No contact requests", "Nobody has asked to be put in touch in this window.");
    }

    var list = el("ul", "rows");
    rows.forEach(function (row) {
      var item = el("li", "row");

      var meta = el("div", "row-meta");
      meta.appendChild(el("span", "strong", text(row.name) || "No name given"));
      meta.appendChild(el("span", null, stamp(row.submittedAt || row.uploadedAt)));
      if (row.source) { meta.appendChild(el("span", null, text(row.source))); }
      item.appendChild(meta);

      var ways = [];
      if (text(row.email)) { ways.push(text(row.email)); }
      if (text(row.whatsappNumber)) { ways.push(text(row.whatsappNumber)); }
      item.appendChild(el("p", "contact-line", ways.length ? ways.join(", ") : "No contact way recorded."));

      var request = text(row.request);
      item.appendChild(el("p", request ? "row-text" : "row-text quiet", request || "No request text."));

      list.appendChild(item);
    });
    return list;
  }

  /* ---------- one transcript ---------- */

  function openTranscript(row) {
    var pathname = text(row && row.pathname);
    if (!pathname) { return; }

    show(loadingState("Opening the transcript."));
    window.scrollTo(0, 0);

    apiGet("view=conversation&path=" + encodeURIComponent(pathname))
      .then(function (data) {
        renderTranscript(data && data.conversation ? data.conversation : {}, row);
      })
      .catch(function (error) {
        if (error instanceof Unauthorized) { goToGate(); return; }
        var wrap = el("section");
        wrap.appendChild(button("Back to the list", "btn back", renderDashboard));
        wrap.appendChild(errorState("That transcript did not come back.", function () { openTranscript(row); }));
        show(wrap);
      });
  }

  function renderTranscript(record, row) {
    var wrap = el("section", "transcript");

    var head = el("div", "transcript-head");
    head.appendChild(button("Back to the list", "btn back", renderDashboard));

    var meta = el("div", "row-meta");
    meta.appendChild(el("span", "strong", text(record.conversationId) || text(row && row.conversationId) || "conversation"));
    meta.appendChild(el("span", null, stamp(record.updatedAt || (row && row.updatedAt))));
    if (record.source) { meta.appendChild(el("span", null, text(record.source))); }
    var turns = Array.isArray(record.turns) ? record.turns : [];
    meta.appendChild(el("span", null, plural(turns.length, "turn", "turns")));
    var toolEvents = Array.isArray(record.toolEvents) ? record.toolEvents : [];
    var noteSent = toolEvents.some(function (event) { return text(event && event.name) === "send_note_to_elliot"; });
    if (noteSent) { meta.appendChild(el("span", "badge", "Note sent")); }
    head.appendChild(meta);
    wrap.appendChild(head);

    if (!turns.length) {
      wrap.appendChild(emptyState("Empty transcript", "The record holds no turns."));
    }

    turns.forEach(function (turn) {
      var role = text(turn && turn.role);
      var visitor = role === "user";
      var node = el("div", "turn " + (visitor ? "turn-visitor" : "turn-flame"));
      node.appendChild(el("span", "turn-label", visitor ? "Visitor" : "The flame"));
      node.appendChild(el("p", "turn-body", text(turn && turn.content)));
      wrap.appendChild(node);
    });

    if (toolEvents.length) {
      var block = el("section", "tool-events");
      block.appendChild(el("h2", null, plural(toolEvents.length, "tool event", "tool events")));
      toolEvents.forEach(function (event) {
        var node = el("div", "tool-event");
        node.appendChild(el("span", "tool-name", text(event && event.name) || "unnamed tool"));
        var input = event && event.input;
        var rendered;
        try {
          rendered = input === undefined ? "" : JSON.stringify(input, null, 2);
        } catch (error) {
          rendered = "";
        }
        node.appendChild(el("pre", "tool-input", rendered || "No input recorded."));
        block.appendChild(node);
      });
      wrap.appendChild(block);
    }

    show(wrap);
  }

  /* ---------- boot ---------- */

  function boot() {
    state.root = document.getElementById("admin-root");
    if (!state.root) { return; }
    buildShell();
    setMastheadSignedOut();
    show(loadingState("Checking the session."));

    apiGet("view=summary")
      .then(function (data) {
        state.signedIn = true;
        state.summary = data;
        setMastheadSignedIn(text(data && data.email));
        renderDashboard();
      })
      .catch(function (error) {
        if (error instanceof Unauthorized) { goToGate(); return; }
        show(errorState("The admin endpoint did not answer. Reload, or try again in a moment.", boot));
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}());
