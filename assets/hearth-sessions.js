/* ==========================================================================
   The Hearth: sessions, the client's side.

   Where a client sees their sessions drawn as the homepage's hop figure,
   books the next one against Elliot's real availability in their own
   timezone, moves or cancels it, and asks for a pack of credits. The owner's
   side of the same tables lives in hearth-sessions-admin.js.

   Same rules as the core: no innerHTML, every value through textContent.
   ========================================================================== */

(function () {
  "use strict";

  var H = window.Hearth;
  if (!H) return;
  var el = H.el, svg = H.svg, append = H.append, button = H.button, link = H.link, api = H.api, pill = H.pill;

  var DAY = 86400000;

  /* ---------- helpers ---------- */

  function tz() { return (H.state.user && H.state.user.timezone) || undefined; }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { timeZone: tz(), hour: "2-digit", minute: "2-digit" });
  }

  function fmtDay(iso, long) {
    return new Date(iso).toLocaleDateString(undefined, { timeZone: tz(), weekday: long ? "long" : "short", month: long ? "long" : "short", day: "numeric" });
  }

  function dayKey(iso) {
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz() });
  }

  function hoursAway(iso) { return (new Date(iso).getTime() - Date.now()) / 3600000; }

  function money(cents, currency) {
    if (cents === null || cents === undefined) return "price on request";
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "EUR" }).format(cents / 100); } catch (e) { return (cents / 100).toFixed(2) + " " + currency; }
  }

  // Arms the figure system for a node that was just inserted: the homepage
  // does this once for the whole page; here figures arrive with each view.
  function armFigure(node) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("figs-armed");
    requestAnimationFrame(function () { requestAnimationFrame(function () { node.classList.add("in"); }); });
    node.addEventListener("click", function () {
      node.classList.remove("in");
      void node.getBoundingClientRect();
      node.classList.add("in");
    });
  }

  /* ---------- the figure: sessions as hops ---------- */

  // Completed sessions are ink dots joined by arcs that rise a little more
  // each time; the next scheduled one is ember; a faint arc continues past.
  function hopsFigure(completed, hasNext) {
    var W = 560, Hh = 200, base = 156;
    var shown = Math.min(completed, 7);
    var slots = shown + (hasNext ? 1 : 0) + 1;
    var gap = (W - 80) / Math.max(slots, 2);
    var node = svg("svg", { viewBox: "0 0 " + W + " " + Hh, role: "img", "aria-label": completed + " sessions so far" + (hasNext ? ", the next one booked" : "") });
    node.setAttribute("class", "figure hops");
    var defs = svg("defs");
    var filter = svg("filter", { id: "hops-glow", x: "-20%", y: "-20%", width: "140%", height: "140%" });
    filter.appendChild(svg("feGaussianBlur", { stdDeviation: 3 }));
    defs.appendChild(filter);
    node.appendChild(defs);
    var line = svg("path", { d: "M40 " + base + "H" + (W - 12), fill: "none", stroke: "currentColor", "stroke-opacity": ".26", class: "draw", pathLength: 1 });
    line.style.setProperty("--dur", "500ms");
    node.appendChild(line);
    var xs = [];
    for (var i = 0; i < shown + (hasNext ? 1 : 0); i += 1) xs.push(70 + i * gap);
    var d = "";
    for (var j = 0; j < shown - 1; j += 1) {
      var peak = base - 48 - j * 16;
      d += (j === 0 ? "M" + xs[j] + " " + base : "") + "Q" + ((xs[j] + xs[j + 1]) / 2) + " " + peak + " " + xs[j + 1] + " " + base;
    }
    if (d) {
      var arcs = svg("path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": 1.2, class: "draw", pathLength: 1 });
      arcs.style.setProperty("--d", "500ms"); arcs.style.setProperty("--dur", (400 * shown) + "ms"); arcs.style.setProperty("--ease", "linear");
      node.appendChild(arcs);
      var head = svg("path", { d: d, stroke: "currentColor", "stroke-width": 7, class: "head", pathLength: 1 });
      head.style.setProperty("--d", "500ms"); head.style.setProperty("--dur", (400 * shown) + "ms"); head.style.setProperty("--ease", "linear");
      node.appendChild(head);
    }
    var t0 = 500 + 400 * Math.max(0, shown - 1);
    if (hasNext && shown > 0) {
      var nx = xs[shown - 1], ex = xs[shown];
      var ed = "M" + nx + " " + base + "Q" + ((nx + ex) / 2) + " " + (base - 48 - (shown - 1) * 16 - 20) + " " + ex + " " + base;
      var e1 = svg("path", { d: ed, fill: "none", stroke: "#f4581f", "stroke-width": 1.6, class: "draw", pathLength: 1 });
      e1.style.setProperty("--d", t0 + "ms"); e1.style.setProperty("--dur", "600ms"); e1.style.setProperty("--ease", "linear");
      var e2 = svg("path", { d: ed, stroke: "#f4581f", "stroke-width": 12, "stroke-opacity": ".6", filter: "url(#hops-glow)", class: "head", pathLength: 1 });
      e2.style.setProperty("--d", t0 + "ms"); e2.style.setProperty("--dur", "600ms"); e2.style.setProperty("--ease", "linear");
      var e3 = svg("path", { d: ed, stroke: "#f4581f", "stroke-width": 8, class: "head", pathLength: 1 });
      e3.style.setProperty("--d", t0 + "ms"); e3.style.setProperty("--dur", "600ms"); e3.style.setProperty("--ease", "linear");
      append(node, [e1, e2, e3]);
    }
    var lastX = xs.length ? xs[xs.length - 1] : 70;
    var beyond = svg("path", { d: "M" + lastX + " " + base + "Q" + (lastX + gap / 2) + " " + (base - 60 - shown * 16) + " " + (lastX + gap) + " " + base, fill: "none", stroke: "#f4581f", "stroke-opacity": ".4", "stroke-width": 1.2, "stroke-dasharray": "2 4", class: "fade" });
    beyond.style.setProperty("--d", (t0 + 900) + "ms");
    node.appendChild(beyond);
    xs.forEach(function (x, k) {
      var isNext = hasNext && k === shown;
      var dot = svg("circle", { cx: x, cy: base, r: isNext ? 4.5 : 3.5, fill: isNext ? "#f4581f" : "currentColor", class: "pop" });
      dot.style.setProperty("--d", (isNext ? t0 + 600 : 400 + k * 400) + "ms");
      node.appendChild(dot);
      if (isNext) {
        var ring = svg("circle", { cx: x, cy: base, r: 14, fill: "none", stroke: "#f4581f", "stroke-width": 1.4, class: "ring" });
        ring.style.setProperty("--d", (t0 + 600) + "ms");
        node.appendChild(ring);
      }
      var label = svg("text", { x: x, y: 180, "font-size": 10, "text-anchor": "middle", fill: isNext ? "#f4581f" : "currentColor", "fill-opacity": isNext ? 1 : ".55", class: "fade" });
      label.textContent = isNext ? "next" : String(completed - shown + k + 1);
      label.style.setProperty("--d", (isNext ? t0 + 700 : 500 + k * 400) + "ms");
      node.appendChild(label);
    });
    var caption = svg("text", { x: W - 12, y: 40, "font-size": 10, "letter-spacing": 1, "text-anchor": "end", fill: "currentColor", "fill-opacity": ".55", class: "fade" });
    caption.textContent = completed === 0 ? "the first conversation is the first point" : "each conversation reaches further";
    caption.style.setProperty("--d", (t0 + 1000) + "ms");
    node.appendChild(caption);
    return node;
  }

  /* ---------- the sessions view ---------- */

  H.register("/sessions", function () {
    var wrap = el("div", "stack");
    return api("/bookings").then(function (data) {
      var bookings = data.bookings;
      var upcoming = bookings.filter(function (b) { return b.status === "scheduled" && new Date(b.endsAt) > new Date(); }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); });
      var past = bookings.filter(function (b) { return b.status !== "scheduled" || new Date(b.endsAt) <= new Date(); }).sort(function (a, b) { return new Date(b.startsAt) - new Date(a.startsAt); });
      var completed = bookings.filter(function (b) { return b.status === "completed" || (b.status === "scheduled" && new Date(b.endsAt) <= new Date()); }).length;

      var actions = [];
      if (data.balance > 0) actions.push(button("Book a session", "btn primary", function () { H.navigate("/sessions/book"); }));
      actions.push(button(data.balance > 0 ? "Packs and credits" : "Get sessions", data.balance > 0 ? "btn" : "btn primary", function () { H.navigate("/sessions/packs"); }));
      wrap.appendChild(H.viewHead("Sessions", completed ? "Every conversation builds on the last." : "Your first conversation is the first point on the line.", actions));

      var figCard = el("div", "card");
      var fig = hopsFigure(completed, upcoming.length > 0);
      figCard.appendChild(fig);
      wrap.appendChild(figCard);
      armFigure(fig);

      var tiles = el("div", "grid3 rise");
      function tile(value, what, emberish, i) {
        var c = el("div", "card stat");
        c.style.setProperty("--i", String(i));
        var n = el("div", "num" + (emberish ? " ember" : ""), typeof value === "number" ? "0" : value);
        if (typeof value === "number") H.countUp(n, value);
        append(c, [n, el("div", "what", what)]);
        tiles.appendChild(c);
      }
      tile(data.balance, "credits left", data.balance > 0, 0);
      tile(completed, "sessions so far", false, 1);
      tile(upcoming.length ? fmtDay(upcoming[0].startsAt) : "none yet", "next session", upcoming.length > 0, 2);
      wrap.appendChild(tiles);

      var up = el("div", "card pad0");
      var upHead = el("div", "row between");
      upHead.style.padding = "0.9rem 1.1rem";
      upHead.appendChild(el("p", "label", "Upcoming"));
      up.appendChild(upHead);
      if (!upcoming.length) {
        var e = el("div", "empty");
        e.style.border = "0";
        e.appendChild(el("p", null, data.balance > 0 ? "Nothing booked. Pick a time." : "Nothing booked yet."));
        up.appendChild(e);
      } else {
        var list = el("div", "list");
        upcoming.forEach(function (b) { list.appendChild(upcomingRow(b, data)); });
        up.appendChild(list);
      }
      wrap.appendChild(up);

      if (past.length) {
        var pastCard = el("div", "card pad0");
        var ph = el("div", "row between");
        ph.style.padding = "0.9rem 1.1rem";
        ph.appendChild(el("p", "label", "Past"));
        pastCard.appendChild(ph);
        var plist = el("div", "list");
        past.forEach(function (b) { plist.appendChild(pastRow(b)); });
        pastCard.appendChild(plist);
        wrap.appendChild(pastCard);
      }

      var tzNote = el("p", "small faint");
      tzNote.appendChild(document.createTextNode("Times are in " + (tz() || "your local time") + ". "));
      var change = link("Change", H.BASE + "/account");
      change.addEventListener("click", function (ev) { ev.preventDefault(); H.navigate("/account"); });
      tzNote.appendChild(change);
      wrap.appendChild(tzNote);
      return wrap;
    });
  }, { perm: "sessions.own", title: "Sessions", nav: { group: "Room", label: "Sessions", order: 1 } });

  function upcomingRow(b, data) {
    var row = el("div");
    var left = el("div");
    left.appendChild(el("div", "primary", fmtDay(b.startsAt, true) + ", " + fmtTime(b.startsAt) + " to " + fmtTime(b.endsAt)));
    var sec = el("div", "secondary");
    var away = hoursAway(b.startsAt);
    sec.textContent = away < 1 ? "starting now" : away < 48 ? "in " + Math.round(away) + " hours" : "in " + Math.round(away / 24) + " days";
    if (b.clientNote) sec.textContent += " · you noted: " + b.clientNote.slice(0, 80);
    left.appendChild(sec);
    var right = el("div", "row");
    var url = b.meetingUrl || data.meetingUrl;
    if (url) {
      var join = link("Join", url, "btn sm" + (away < 1 ? " primary" : ""));
      join.target = "_blank";
      join.rel = "noopener";
      right.appendChild(join);
    }
    var canMove = away >= data.cancelNoticeHours;
    right.appendChild(button("Move", "btn ghost sm", function () { H.navigate("/sessions/move/" + b.id); }));
    right.appendChild(button("Cancel", "btn ghost sm", function () {
      var msg = canMove ? "Cancel this session? The credit comes back to you." : "Cancel this session? It is inside the " + data.cancelNoticeHours + "-hour notice, so the credit is not returned.";
      if (!window.confirm(msg)) return;
      api("/bookings/" + b.id + "/cancel", { method: "POST", body: {} }).then(function (r) {
        H.toast(r.refund ? "Cancelled. Your credit is back." : "Cancelled.", "good");
        H.render();
      }).catch(function (err) { H.toast(err.message, "bad"); });
    }));
    append(row, [left, right]);
    return row;
  }

  function pastRow(b) {
    var row = el("div");
    var left = el("div");
    left.appendChild(el("div", "primary", fmtDay(b.startsAt, true) + ", " + fmtTime(b.startsAt)));
    var status = b.status === "cancelled" ? "cancelled" : b.status === "no_show" ? "missed" : "held";
    left.appendChild(el("div", "secondary", status + (b.title ? " · " + b.title : "")));
    var right = el("div", "row");
    if (b.transcriptId) {
      var t = button("Summary and transcript", "btn sm", function () { H.navigate("/transcripts/" + b.transcriptId); });
      right.appendChild(t);
    } else if (status === "held") {
      right.appendChild(el("span", "meta", "no transcript yet"));
    }
    append(row, [left, right]);
    return row;
  }

  /* ---------- booking and moving ---------- */

  function picker(opts) {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead(opts.title, opts.lede));
    var note = el("p", "small faint", "Times are in " + (tz() || "your local time") + ". Sessions are " + ((H.state.settings && H.state.settings.sessionMinutes) || 60) + " minutes.");
    wrap.appendChild(note);
    var card = el("div", "card stack");
    var loading = el("p", "dim", "Finding free times...");
    card.appendChild(loading);
    wrap.appendChild(card);

    var from = new Date();
    var span = 14;

    function load() {
      var to = new Date(from.getTime() + span * DAY);
      var q = "?from=" + encodeURIComponent(from.toISOString()) + "&to=" + encodeURIComponent(to.toISOString()) + (opts.except ? "&except=" + encodeURIComponent(opts.except) : "");
      api("/slots" + q).then(function (data) {
        H.clear(card);
        var byDay = {};
        var days = [];
        data.slots.forEach(function (s) {
          var k = dayKey(s.startsAt);
          if (!byDay[k]) { byDay[k] = []; days.push(k); }
          byDay[k].push(s);
        });
        var nav = el("div", "row between");
        var prev = button("Earlier", "btn ghost sm", function () { from = new Date(Math.max(Date.now(), from.getTime() - span * DAY)); load(); });
        prev.disabled = from.getTime() <= Date.now() + 60000;
        var range = el("p", "small dim", fmtDay(from.toISOString()) + " to " + fmtDay(to.toISOString()));
        var next = button("Later", "btn ghost sm", function () { from = new Date(from.getTime() + span * DAY); load(); });
        next.disabled = to >= new Date(data.horizon);
        append(nav, [prev, range, next]);
        card.appendChild(nav);
        if (!days.length) {
          card.appendChild(H.empty("No free times in these two weeks. Try later, or write to Elliot."));
          return;
        }
        var chips = el("div", "row");
        chips.style.overflowX = "auto";
        chips.style.flexWrap = "nowrap";
        chips.style.paddingBottom = "0.3rem";
        var times = el("div", "grid3");
        var selectedDay = days[0];
        function showDay(k) {
          selectedDay = k;
          Array.prototype.forEach.call(chips.childNodes, function (c) { c.classList.toggle("primary", c.dataset.day === k); });
          H.clear(times);
          byDay[k].forEach(function (s) {
            var t = button(fmtTime(s.startsAt), "btn", function () { confirm(s); });
            times.appendChild(t);
          });
        }
        days.forEach(function (k) {
          var c = button(fmtDay(byDay[k][0].startsAt), "btn sm", function () { showDay(k); });
          c.dataset.day = k;
          chips.appendChild(c);
        });
        append(card, [el("p", "label", "Day"), chips, el("p", "label", "Time"), times]);
        showDay(selectedDay);
      }).catch(function (err) { H.clear(card); card.appendChild(el("p", "form-error", err.message)); });
    }

    function confirm(slot) {
      H.clear(card);
      card.appendChild(el("p", "label", "Confirm"));
      card.appendChild(el("h2", null, fmtDay(slot.startsAt, true) + ", " + fmtTime(slot.startsAt) + " to " + fmtTime(slot.endsAt)));
      var noteInput = null;
      if (!opts.except) {
        noteInput = el("textarea", "textarea");
        noteInput.placeholder = "Anything you want on the table when we start? Optional.";
        noteInput.maxLength = 2000;
        card.appendChild(H.field("Note for Elliot", noteInput));
      }
      var row = el("div", "row");
      var ok = button(opts.except ? "Move it here" : "Book it", "btn primary", function () {
        ok.disabled = true;
        var body = { startsAt: slot.startsAt };
        if (noteInput) body.note = noteInput.value;
        var req = opts.except ? api("/bookings/" + opts.except + "/move", { method: "POST", body: body }) : api("/bookings", { method: "POST", body: body });
        req.then(function () {
          H.toast(opts.except ? "Moved. A new calendar file is on its way." : "Booked. A calendar file is on its way to your email.", "good");
          H.flare();
          H.navigate("/sessions");
        }).catch(function (err) { H.toast(err.message, "bad"); ok.disabled = false; if (err.status === 409) load(); });
      });
      append(row, [ok, button("Pick another time", "btn ghost", load)]);
      card.appendChild(row);
    }

    load();
    return wrap;
  }

  H.register("/sessions/book", function () {
    return api("/credits").then(function (c) {
      if (c.balance < 1) {
        var w = el("div", "stack");
        w.appendChild(H.viewHead("Book a session", "You need a credit first."));
        w.appendChild(H.empty("No credits left.", button("See packs", "btn primary mt", function () { H.navigate("/sessions/packs"); })));
        return w;
      }
      return picker({ title: "Book a session", lede: "Pick a day, then a time. One credit per session." });
    });
  }, { perm: "sessions.own", title: "Book" });

  H.register("/sessions/move/:id", function (ctx) {
    return picker({ title: "Move a session", lede: "Pick the new time. Your credit stays with it.", except: ctx.params.id });
  }, { perm: "sessions.own", title: "Move" });

  /* ---------- packs and credits ---------- */

  H.register("/sessions/packs", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead("Packs and credits", "A pack is a number of sessions. Ask for one, Elliot sends the invoice, and the credits appear here when it is paid."));
    return Promise.all([api("/packs").catch(function () { return { packs: [] }; }), api("/credits")]).then(function (r) {
      var packs = r[0].packs, credits = r[1];
      var bal = el("div", "card row between");
      append(bal, [append(el("div", "stat"), [el("div", "num" + (credits.balance > 0 ? " ember" : ""), String(credits.balance)), el("div", "what", "credits left")]),
        credits.balance > 0 ? button("Book a session", "btn primary", function () { H.navigate("/sessions/book"); }) : null]);
      wrap.appendChild(bal);
      if (credits.pendingDiscount) {
        wrap.appendChild(append(el("div", "card glow"), [el("p", "label", "Referral reward"), el("p", "small", credits.pendingDiscount.percent + "% off your next pack, from someone you sent here. It applies itself when you ask for one.")]));
      }
      var open = credits.purchases.filter(function (p) { return p.status === "requested" || p.status === "invoiced"; });
      if (open.length) {
        var oc = el("div", "card stack tight");
        oc.appendChild(el("p", "label", "In progress"));
        open.forEach(function (p) {
          oc.appendChild(el("p", "small", p.packName + ", " + p.sessions + " sessions: " + (p.status === "requested" ? "requested, invoice on its way" : "invoiced, credits land when it is paid")));
        });
        wrap.appendChild(oc);
      }
      if (packs.length) {
        var grid = el("div", "grid2 rise");
        packs.forEach(function (p, i) {
          var c = el("div", "card stack tight");
          c.style.setProperty("--i", String(i));
          append(c, [el("h3", null, p.name), el("p", "small dim", p.description || ""), el("p", null, p.sessions + " sessions of " + p.minutes + " minutes"), el("p", "ember", money(p.priceCents, p.currency))]);
          var ask = button("Ask for this pack", "btn", function () {
            ask.disabled = true;
            api("/purchases", { method: "POST", body: { packId: p.id } }).then(function () {
              H.toast("Asked. Elliot will send the invoice.", "good");
              H.flare();
              H.render();
            }).catch(function (err) { H.toast(err.message, "bad"); ask.disabled = false; });
          });
          c.appendChild(append(el("div", "row"), [ask]));
          grid.appendChild(c);
        });
        wrap.appendChild(grid);
      } else {
        wrap.appendChild(H.empty("No packs are on offer right now. Ask Elliot directly."));
      }
      if (credits.ledger.length) {
        var lc = el("div", "card pad0");
        var lh = el("div", "row between");
        lh.style.padding = "0.9rem 1.1rem";
        lh.appendChild(el("p", "label", "Credit history"));
        lc.appendChild(lh);
        var list = el("div", "list");
        credits.ledger.forEach(function (e) {
          var row = el("div");
          var reasons = { purchase: "pack paid", booking: "session booked", cancel: "session cancelled", referral: "referral reward", grant: "from Elliot" };
          append(row, [append(el("div"), [el("div", "primary", (e.delta > 0 ? "+" : "") + e.delta + " · " + (reasons[e.reason] || e.reason)), el("div", "secondary", e.note || "")]), el("div", "meta", H.fmtDate(e.created_at, { dateStyle: "medium" }))]);
          list.appendChild(row);
        });
        lc.appendChild(list);
        wrap.appendChild(lc);
      }
      return wrap;
    });
  }, { perm: "sessions.own", title: "Packs" });

  /* ---------- home tiles ---------- */

  H.onHome(function (tile) {
    if (!H.can("sessions.own")) return;
    return api("/bookings").then(function (data) {
      var next = data.bookings.filter(function (b) { return b.status === "scheduled" && new Date(b.endsAt) > new Date(); }).sort(function (a, b) { return new Date(a.startsAt) - new Date(b.startsAt); })[0];
      H.countUp(tile(data.balance, "credits left", data.balance > 0), data.balance);
      var n = tile(next ? fmtDay(next.startsAt) + " " + fmtTime(next.startsAt) : "none", "next session", Boolean(next));
      n.style.fontSize = "1.4rem";
    });
  });
})();
