/* ==========================================================================
   The Hearth: agents, the member's side.

   Where a member connects Claude, or any MCP client, to their own corner
   of the room: the OAuth consent page apps are sent to, the list of apps
   holding a live connection, the API keys for scripts that cannot do
   OAuth, and what their agents have actually been doing.

   Same rules as the core: no innerHTML, every value through textContent.
   ========================================================================== */

(function () {
  "use strict";

  var H = window.Hearth;
  if (!H) return;
  var el = H.el, append = H.append, button = H.button, api = H.api, pill = H.pill;

  /* ---------- the consent page arrives before sign-in ----------

     hearth.js sends a signed-out visitor to the gate, and the gate only
     brings them back where they were if the URL carries `next`. An MCP
     client sends people to /hearth/authorize?req=... with nothing else,
     so add the return address ourselves before the core boots. */

  (function keepTheReturnAddress() {
    if (location.pathname !== H.BASE + "/authorize") return;
    var params = new URLSearchParams(location.search);
    if (!params.get("req") || params.get("next")) return;
    var here = location.pathname + location.search;
    params.set("next", here);
    try {
      history.replaceState(null, "", location.pathname + "?" + params.toString());
    } catch (e) { /* the gate will simply land on the room's home */ }
  })();

  /* ---------- small pieces ---------- */

  function codeBlock(text) {
    return el("div", "code", text);
  }

  function copyButton(label, text) {
    return button(label, "btn sm", function () {
      if (!navigator.clipboard) { H.toast("Select the text and copy it.", "bad"); return; }
      navigator.clipboard.writeText(text).then(function () {
        H.toast("Copied.", "good");
      }, function () {
        H.toast("Could not copy. Select the text instead.", "bad");
      });
    });
  }

  function scopeLabel(all, key) {
    var found = all.filter(function (s) { return s.key === key; })[0];
    return found ? found.label : key;
  }

  function scopePills(all, keys) {
    var row = el("div", "row");
    row.style.gap = "0.35rem";
    row.style.marginTop = "0.3rem";
    (keys || []).forEach(function (k) { row.appendChild(pill(scopeLabel(all, k))); });
    return row;
  }

  function hostOf(uri) {
    if (!uri) return "";
    try { return new URL(uri).host; } catch (e) { return ""; }
  }

  function cardHead(label) {
    var head = el("div", "row between");
    head.style.padding = "0.9rem 1.1rem";
    head.appendChild(el("p", "label", label));
    return head;
  }

  /* ---------- what an agent can do, in plain words ---------- */

  // Hardcoded from lib/hearth/mcp.js: the member's tools only, in the
  // order they are defined there.
  var TOOLS = [
    ["whoami", "The member the connection belongs to, and its permissions."],
    ["credits", "The session credit balance and recent credit history."],
    ["list_sessions", "Sessions with Elliot, upcoming and past."],
    ["list_records", "Every session record: title, date and summary."],
    ["get_record", "One record in full, with the transcript if asked for."],
    ["search_records", "Full-text search across records and transcripts."],
    ["list_follow_ups", "Your follow-ups and Elliot's."],
    ["add_follow_up", "Add a follow-up, stored as your words."],
    ["complete_follow_up", "Mark a follow-up done, or reopen it."],
    ["available_slots", "Free times for a session, in your timezone."],
    ["book_session", "Book one of those times. Spends a credit."],
    ["cancel_session", "Cancel a scheduled session."],
    ["note_for_next_session", "Leave a note for Elliot to read before next time."],
    ["get_feed", "Recent feed posts."]
  ];

  function toolsCard() {
    var card = el("div", "card stack tight");
    card.appendChild(el("p", "label", "What your agent can do"));
    var list = el("div", "stack tight");
    TOOLS.forEach(function (t) {
      var line = el("p", "small");
      var name = el("span", "mono", t[0]);
      line.appendChild(name);
      line.appendChild(document.createTextNode(" "));
      var what = el("span", "dim", t[1]);
      line.appendChild(what);
      list.appendChild(line);
    });
    card.appendChild(list);
    card.appendChild(el("p", "small faint", "Anything an agent adds here is stored as a note from you, for a person to read."));
    return card;
  }

  /* ---------- the agents view ---------- */

  H.register("/agents", function () {
    return api("/agents").then(function (data) {
      var wrap = el("div", "stack");
      wrap.appendChild(H.viewHead("Agents", "Connect Claude or any MCP client to your sessions, records and follow-ups."));
      wrap.appendChild(connectCard(data));
      wrap.appendChild(appsCard(data));
      wrap.appendChild(keysCard(data));
      wrap.appendChild(activityCard(data));
      wrap.appendChild(toolsCard());
      return wrap;
    });
  }, { perm: "keys.own", title: "Agents", nav: { group: "Member", label: "Agents", order: 5 } });

  /* ---------- connect ---------- */

  function connectCard(data) {
    var card = el("div", "card glow stack tight");
    card.appendChild(el("p", "label", "Connect Claude"));
    card.appendChild(el("p", "small dim", "MCP server address"));
    var url = data.mcpUrl || "";
    card.appendChild(codeBlock(url));
    card.appendChild(append(el("div", "row"), [copyButton("Copy address", url)]));

    var steps = el("ol", "stack tight");
    steps.style.margin = "0.4rem 0 0";
    steps.style.paddingLeft = "1.2rem";
    [
      "In Claude, on the web or on the desktop, open Settings, then Connectors.",
      "Choose Add custom connector and paste the address above.",
      "Approve the connection on the consent page that opens here."
    ].forEach(function (text) {
      var li = el("li", "small");
      li.textContent = text;
      steps.appendChild(li);
    });
    card.appendChild(steps);

    card.appendChild(el("p", "small dim", "For Claude Code, one command:"));
    var cmd = "claude mcp add --transport http hearth " + (url || "https://chamainteligente.com/mcp");
    card.appendChild(codeBlock(cmd));
    card.appendChild(append(el("div", "row"), [copyButton("Copy command", cmd)]));

    card.appendChild(el("p", "small faint", "Connecting uses OAuth: you will see exactly what the app may do and can disconnect it any time below."));
    return card;
  }

  /* ---------- connected apps ---------- */

  function appsCard(data) {
    var card = el("div", "card pad0");
    card.appendChild(cardHead("Connected apps"));
    var apps = data.apps || [];
    if (!apps.length) {
      var e = H.empty("Nothing connected yet.");
      e.style.border = "0";
      card.appendChild(e);
      return card;
    }
    var list = el("div", "list");
    apps.forEach(function (app) {
      var row = el("div");
      var left = el("div");
      var host = hostOf(app.uri);
      left.appendChild(el("div", "primary", app.name + (host ? " · " + host : "")));
      left.appendChild(el("div", "secondary", "connected " + H.fmtDate(app.connectedAt, { dateStyle: "medium" }) + (app.lastUsedAt ? " · last used " + H.fmtRelative(app.lastUsedAt) : " · not used yet")));
      left.appendChild(scopePills(data.scopes || [], app.scopes));
      var drop = button("Disconnect", "btn ghost sm", function () {
        if (!window.confirm("Disconnect " + app.name + "? Its access is revoked immediately.")) return;
        drop.disabled = true;
        api("/agents/apps/" + encodeURIComponent(app.id), { method: "DELETE" }).then(function () {
          H.toast("Disconnected.", "good");
          H.flare();
          H.render();
        }).catch(function (err) { H.toast(err.message, "bad"); drop.disabled = false; });
      });
      append(row, [left, drop]);
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  /* ---------- api keys ---------- */

  function keysCard(data) {
    var card = el("div", "card pad0");
    card.appendChild(cardHead("API keys"));
    var intro = el("p", "small dim", "For scripts and agents that cannot use OAuth. Each key is shown once, when created.");
    intro.style.padding = "0 1.1rem 0.6rem";
    card.appendChild(intro);

    var keys = data.keys || [];
    if (!keys.length) {
      var e = H.empty("No keys yet.");
      e.style.border = "0";
      card.appendChild(e);
    } else {
      var list = el("div", "list");
      keys.forEach(function (k) { list.appendChild(keyRow(data, k)); });
      card.appendChild(list);
    }

    var formHost = el("div");
    formHost.style.padding = "0.9rem 1.1rem";
    formHost.appendChild(newKeyForm(data));
    card.appendChild(formHost);
    return card;
  }

  function keyRow(data, k) {
    var row = el("div");
    var left = el("div");
    var top = el("div", "primary");
    top.appendChild(document.createTextNode(k.name + " · "));
    top.appendChild(el("span", "mono", k.prefix + "..."));
    left.appendChild(top);
    var bits = "made " + H.fmtDate(k.createdAt, { dateStyle: "medium" });
    bits += k.lastUsedAt ? " · last used " + H.fmtRelative(k.lastUsedAt) : " · never used";
    bits += k.expiresAt ? " · expires " + H.fmtDate(k.expiresAt, { dateStyle: "medium" }) : " · no expiry";
    left.appendChild(el("div", "secondary", bits));
    left.appendChild(scopePills(data.scopes || [], k.scopes));
    var revoke = button("Revoke", "btn ghost sm", function () {
      if (!window.confirm("Revoke " + k.name + "? Anything using it loses access immediately.")) return;
      revoke.disabled = true;
      api("/agents/keys/" + encodeURIComponent(k.id), { method: "DELETE" }).then(function () {
        H.toast("Revoked.", "good");
        H.render();
      }).catch(function (err) { H.toast(err.message, "bad"); revoke.disabled = false; });
    });
    append(row, [left, revoke]);
    return row;
  }

  function newKeyForm(data) {
    var wrap = el("div", "stack tight");
    wrap.appendChild(el("p", "label", "New key"));

    var form = el("form", "stack tight");
    var name = H.input("text", "name", "What is it for?");
    form.appendChild(H.field("Name", name));

    var checks = el("div", "checks");
    var boxes = [];
    var defaults = data.defaultScopes || [];
    (data.scopes || []).forEach(function (scope) {
      if (scope.key === "business" && !H.can("members.read")) return;
      var label = el("label", "check");
      var box = el("input");
      box.type = "checkbox";
      box.value = scope.key;
      box.checked = defaults.indexOf(scope.key) !== -1;
      var text = el("span");
      text.appendChild(el("span", null, scope.label));
      text.appendChild(el("span", "desc", scope.detail));
      append(label, [box, text]);
      checks.appendChild(label);
      boxes.push(box);
    });
    form.appendChild(H.field("What it may do", checks));

    var expiry = el("select", "select");
    [["Never", ""], ["30 days", "30"], ["90 days", "90"], ["1 year", "365"]].forEach(function (o) {
      var option = el("option", null, o[0]);
      option.value = o[1];
      expiry.appendChild(option);
    });
    form.appendChild(H.field("Expires", expiry));

    var make = button("Make the key", "btn primary");
    make.type = "submit";
    form.appendChild(append(el("div", "row"), [make]));

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var scopes = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      if (!scopes.length) { H.toast("Select at least one permission for the key.", "bad"); return; }
      make.disabled = true;
      var days = expiry.value ? Number(expiry.value) : null;
      api("/agents/keys", { method: "POST", body: { name: name.value, scopes: scopes, expiresInDays: days } }).then(function (result) {
        H.flare();
        H.clear(wrap);
        wrap.appendChild(secretPanel(result.secret));
      }).catch(function (err) { H.toast(err.message, "bad"); make.disabled = false; });
    });

    wrap.appendChild(form);
    return wrap;
  }

  function secretPanel(secret) {
    var panel = el("div", "stack tight");
    panel.appendChild(el("p", "label", "Your new key"));
    panel.appendChild(codeBlock(secret));
    panel.appendChild(el("p", "small form-error", "This is the only time the key is shown. Store it now."));
    var row = el("div", "row");
    append(row, [copyButton("Copy key", secret), button("Done", "btn", function () { H.render(); })]);
    panel.appendChild(row);
    return panel;
  }

  /* ---------- activity ---------- */

  function activityCard(data) {
    var card = el("div", "card stack tight");
    card.appendChild(el("p", "label", "Agent activity"));
    var calls = data.calls || [];
    var any = calls.some(function (c) { return Number(c.n || 0) > 0; });
    if (!any) {
      var e = H.empty("No agent calls yet.");
      e.style.border = "0";
      card.appendChild(e);
      return card;
    }
    card.appendChild(H.barChart(calls, 30, "mcp.call"));
    card.appendChild(el("p", "small faint", "Tool calls by your agents, last 30 days"));
    return card;
  }

  /* ---------- the consent page ---------- */

  H.register("/authorize", function (ctx) {
    var req = ctx.query.req;
    if (!req) return H.empty("Nothing to approve.");
    return api("/agents/consent?req=" + encodeURIComponent(req)).then(function (data) {
      return consentCard(req, data);
    }, function (err) {
      return H.empty(err.message);
    });
  }, { perm: "mcp.connect", title: "Connect an app" });

  function consentCard(req, data) {
    var wrap = el("div", "gate");
    var card = el("div", "gate-card");
    card.appendChild(H.mark("mark"));
    var name = (data.client && data.client.name) || "this app";
    var title = el("h1");
    title.textContent = "Connect " + name + "?";
    card.appendChild(title);
    card.appendChild(el("p", "dim", "It will be able to:"));

    var checks = el("div", "checks");
    var boxes = [];
    (data.scopes || []).forEach(function (scope) {
      var label = el("label", "check");
      var box = el("input");
      box.type = "checkbox";
      box.value = scope.key;
      box.checked = true;
      var text = el("span");
      var strong = el("strong");
      strong.textContent = scope.label;
      text.appendChild(strong);
      text.appendChild(el("span", "desc", scope.detail));
      append(label, [box, text]);
      box.addEventListener("change", refresh);
      checks.appendChild(label);
      boxes.push(box);
    });
    card.appendChild(checks);

    card.appendChild(el("p", "small dim", "You can disconnect it any time from Agents."));
    if (data.redirectHost) card.appendChild(el("p", "small faint", "It will be sent back to " + data.redirectHost));

    var allow = button("Allow", "btn primary wide", function () { decide("approve"); });
    var deny = button("Deny", "btn ghost wide", function () { decide("deny"); });
    card.appendChild(append(el("div", "gate-ways"), [allow, deny]));

    function refresh() {
      allow.disabled = !boxes.some(function (b) { return b.checked; });
    }
    refresh();

    function decide(decision) {
      allow.disabled = true;
      deny.disabled = true;
      var body = { req: req, decision: decision };
      if (decision === "approve") body.scopes = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      api("/agents/consent", { method: "POST", body: body }).then(function (result) {
        H.flare();
        location.assign(result.to);
      }).catch(function (err) {
        H.toast(err.message, "bad");
        deny.disabled = false;
        refresh();
      });
    }

    wrap.appendChild(card);
    return wrap;
  }

  /* ---------- home tile ---------- */

  H.onHome(function (tile) {
    if (!H.can("keys.own")) return;
    return api("/agents").then(function (data) {
      var n = (data.apps || []).length;
      H.countUp(tile(n, "connected apps", n > 0), n);
    }).catch(function () { /* the home view carries on without it */ });
  });
})();
