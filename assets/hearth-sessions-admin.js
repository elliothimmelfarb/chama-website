/* ==========================================================================
   The Hearth, the owner's side of sessions: the calendar, the packs, the
   purchases and the week's availability.

   Loaded after hearth.js and hearth-admin.js, and speaking to the room the
   same way: window.Hearth for the routes, the wire and the DOM helpers, and
   only classes that already exist in hearth.css.

   The same hard rule holds here as everywhere on this domain: everything the
   API returns is data. It reaches the page through textContent or through
   attributes set from code. There is no innerHTML in this file, which
   matters most in the purchases list, where a member's note is their text
   and nothing else.
   ========================================================================== */

(function () {
  "use strict";

  var H = window.Hearth;
  if (!H) return;

  var el = H.el;
  var append = H.append;
  var clear = H.clear;
  var button = H.button;
  var link = H.link;
  var field = H.field;
  var input = H.input;
  var pill = H.pill;
  var api = H.api;
  var toast = H.toast;
  var flare = H.flare;
  var can = H.can;
  var fmtDate = H.fmtDate;
  var BASE = H.BASE;

  var DAY = 86400000;

  // Monday first, because a working week reads that way, but the numbers are
  // the ones the server stores (Sunday is 0).
  var WEEK = [
    { weekday: 1, label: "Monday" },
    { weekday: 2, label: "Tuesday" },
    { weekday: 3, label: "Wednesday" },
    { weekday: 4, label: "Thursday" },
    { weekday: 5, label: "Friday" },
    { weekday: 6, label: "Saturday" },
    { weekday: 0, label: "Sunday" }
  ];

  var BOOKING_STATUSES = [
    { value: "scheduled", label: "Scheduled" },
    { value: "completed", label: "Completed" },
    { value: "no_show", label: "No show" },
    { value: "cancelled", label: "Cancelled" }
  ];

  var PURCHASE_FILTERS = [
    { value: "requested", label: "Requested" },
    { value: "invoiced", label: "Invoiced" },
    { value: "paid", label: "Paid" },
    { value: "void", label: "Void" },
    { value: "", label: "All" }
  ];

  /* ---------- small shared pieces ---------- */

  function select(options, value, onChange) {
    var node = el("select", "select");
    options.forEach(function (opt) {
      var o = el("option", null, opt.label);
      o.value = opt.value;
      if (opt.value === value) o.selected = true;
      node.appendChild(o);
    });
    if (onChange) node.addEventListener("change", function () { onChange(node.value); });
    return node;
  }

  function textarea(value, rows) {
    var node = el("textarea", "textarea");
    if (rows) node.rows = rows;
    if (value) node.value = value;
    return node;
  }

  function toggle(labelText, checked) {
    var wrap = el("label", "switch");
    var box = el("input");
    box.type = "checkbox";
    box.checked = Boolean(checked);
    wrap.appendChild(box);
    wrap.appendChild(el("span", null, labelText));
    return { node: wrap, input: box };
  }

  // Every write disables its own button until the server has answered, so a
  // second click cannot send the change twice.
  function busy(node, promise) {
    node.disabled = true;
    return promise.then(function (result) {
      node.disabled = false;
      return result;
    }, function (error) {
      node.disabled = false;
      throw error;
    });
  }

  function rise(node, index) {
    node.style.setProperty("--i", String(index));
    return node;
  }

  function memberName(member) {
    return (member && (member.name || member.email)) || "Someone";
  }

  // The owner's zone is only told to the page by /admin/availability. Until
  // that answers, the viewer's own zone is the honest fallback.
  // A shared calendar's event keeps the colour it was given there.
  function tint(node, color) {
    if (typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) node.style.setProperty("--ev", color);
    return node;
  }

  function ownerZone() {
    return (H.state.user && H.state.user.timezone) || "UTC";
  }

  function defaultMinutes() {
    return (H.state.settings && H.state.settings.sessionMinutes) || 60;
  }

  /* ---------- money and time ---------- */

  function money(cents, currency) {
    if (cents === null || cents === undefined || cents === "") return "price on request";
    var value = Number(cents) / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "EUR" }).format(value);
    } catch (e) {
      return value.toFixed(2) + " " + (currency || "EUR");
    }
  }

  // A day key in a given zone, so bookings group by the owner's day and not
  // by the browser's.
  function dayKey(iso, zone) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
    } catch (e) {
      return d.toISOString().slice(0, 10);
    }
  }

  function dayLabel(iso, zone) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleDateString(undefined, { timeZone: zone, weekday: "long", day: "numeric", month: "long" });
    } catch (e) {
      return fmtDate(iso, { dateStyle: "full" });
    }
  }

  function clockTime(iso, zone) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleString(undefined, { timeZone: zone, hour: "numeric", minute: "2-digit" });
    } catch (e) {
      return fmtDate(iso, { timeStyle: "short" });
    }
  }

  function timeRange(booking, zone) {
    var start = clockTime(booking.startsAt, zone);
    var end = clockTime(booking.endsAt, zone);
    return end ? start + " to " + end : start;
  }

  function minutesToClock(minutes) {
    var m = Math.max(0, Math.min(1440, Number(minutes) || 0));
    var h = Math.floor(m / 60);
    var rest = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (rest < 10 ? "0" : "") + rest;
  }

  function clockToMinutes(text) {
    var parts = String(text || "").split(":");
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  // A datetime-local value is a wall clock with no zone, so the browser's
  // zone is what it means. One place converts it to an instant.
  // The zone the browser is in, which is what a datetime-local field means.
  function browserZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
  }

  function localToInstant(value) {
    if (!value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function statusPill(status) {
    var kinds = { scheduled: "live", completed: "client", cancelled: "bad" };
    var labels = { scheduled: "scheduled", completed: "completed", cancelled: "cancelled", no_show: "no show" };
    return pill(labels[status] || status || "", kinds[status] || "");
  }

  /* ---------- the member picker ---------- */

  // An email search that waits a quarter of a second after the last
  // keystroke and offers what it found as buttons. It needs members.read;
  // where that is missing the picker falls back to a plain id field rather
  // than pretending the search is empty.
  function memberPicker(placeholder, options) {
    var opts = options || {};
    var wrap = el("div", "stack tight");
    var search = input("search", "member", placeholder || "Search name or email");
    var results = el("div", "row");
    var chosen = el("p", "small dim");
    var picked = null;
    var timer = null;
    var stopped = false;
    var searchable = can("members.read");

    var idInput = input("text", "userId", "Member id");
    idInput.hidden = true;

    function choose(member) {
      picked = member;
      chosen.textContent = (opts.verb || "Booking for") + " " + memberName(member) + " (" + member.email + ")";
      clear(results);
      search.value = "";
      if (opts.onChoose) opts.onChoose(member);
    }

    function draw(members) {
      clear(results);
      if (!members.length) {
        results.appendChild(el("p", "small dim", "Nobody matches that."));
        return;
      }
      members.slice(0, 8).forEach(function (member) {
        results.appendChild(button(memberName(member), "btn sm ghost", function () { choose(member); }));
      });
    }

    if (searchable) {
      search.addEventListener("input", function () {
        if (timer) clearTimeout(timer);
        var q = search.value.trim();
        if (!q) { clear(results); return; }
        timer = setTimeout(function () {
          api("/admin/members?q=" + encodeURIComponent(q) + "&role=").then(function (data) {
            if (stopped) return;
            draw(data.members || []);
          }, function () {
            if (stopped) return;
            clear(results);
            results.appendChild(el("p", "small dim", "The member search did not answer. Paste an id instead."));
            idInput.hidden = false;
          });
        }, 250);
      });
      append(wrap, [field("Member", search), results, chosen, idInput]);
    } else {
      idInput.hidden = false;
      wrap.appendChild(field("Member id", idInput, "Searching members needs the members permission; paste their id from their member page."));
    }

    return {
      node: wrap,
      // The view calls this on its way out: the pending keystroke never
      // fires and a search already in flight is dropped.
      stop: function () {
        stopped = true;
        if (timer) clearTimeout(timer);
        timer = null;
      },
      userId: function () {
        if (picked) return picked.id;
        var typed = idInput.value.trim();
        return typed || "";
      },
      reset: function () {
        picked = null;
        chosen.textContent = "";
        idInput.value = "";
        clear(results);
      }
    };
  }

  /* ---------- the owner's calendar ---------- */

  H.register("/admin/sessions", function (ctx) {
    var wrap = el("div", "stack");
    var zone = ownerZone();
    var sessionMinutes = defaultMinutes();
    var range = "next";

    var bookForm = el("div");
    bookForm.hidden = true;
    var bookBuilt = false;
    var picker = null;

    var newButton = button("Book for a member", "btn primary", function () {
      if (!bookBuilt) { bookForm.appendChild(bookCard()); bookBuilt = true; }
      bookForm.hidden = !bookForm.hidden;
    });
    var head = H.viewHead("Sessions", "Every booking.", [newButton]);
    var ledeNode = head.querySelector(".lede");

    // The rows are drawn in the owner's zone, so the lede names that zone,
    // and it is written again once /admin/availability has answered with it.
    function paintLede() {
      if (ledeNode) ledeNode.textContent = "Every booking, in " + zone + ".";
    }
    paintLede();
    wrap.appendChild(head);

    if (ctx && ctx.onCleanup) ctx.onCleanup(function () { if (picker) picker.stop(); });
    wrap.appendChild(bookForm);

    var stats = el("div", "grid3 rise");
    wrap.appendChild(stats);

    var controls = el("div", "row");
    var rangeButtons = [];
    [
      { key: "next", label: "Next 30 days" },
      { key: "past", label: "Past 30 days" },
      { key: "all", label: "All" }
    ].forEach(function (option) {
      var node = button(option.label, "btn sm ghost", function () {
        if (range === option.key) return;
        range = option.key;
        paintRange();
        load();
      });
      rangeButtons.push({ node: node, key: option.key });
      controls.appendChild(node);
    });
    function paintRange() {
      rangeButtons.forEach(function (b) { b.node.className = "btn sm" + (b.key === range ? " primary" : " ghost"); });
    }
    paintRange();
    wrap.appendChild(controls);

    var listCard = el("div", "card pad0");
    wrap.appendChild(listCard);

    function rangeQuery() {
      var now = Date.now();
      if (range === "next") return "?from=" + new Date(now).toISOString() + "&to=" + new Date(now + 30 * DAY).toISOString();
      if (range === "past") return "?from=" + new Date(now - 30 * DAY).toISOString() + "&to=" + new Date(now).toISOString();
      return "?from=" + new Date(now - 730 * DAY).toISOString() + "&to=" + new Date(now + 730 * DAY).toISOString();
    }

    function tile(value, what, emberish, index) {
      var card = rise(el("div", "card stat"), index);
      var num = el("div", "num" + (emberish ? " ember" : ""), "0");
      card.appendChild(num);
      card.appendChild(el("div", "what", what));
      stats.appendChild(card);
      H.countUp(num, value);
    }

    function drawStats(bookings) {
      clear(stats);
      var now = Date.now();
      var week = now + 7 * DAY;
      var monthAgo = now - 30 * DAY;
      var upcomingWeek = 0;
      var upcoming = 0;
      var completed = 0;
      bookings.forEach(function (b) {
        var at = new Date(b.startsAt).getTime();
        if (b.status === "scheduled" && at >= now) {
          upcoming += 1;
          if (at < week) upcomingWeek += 1;
        }
        if (b.status === "completed" && at >= monthAgo && at <= now) completed += 1;
      });
      tile(upcomingWeek, "this week", true, 0);
      tile(upcoming, "upcoming", false, 1);
      tile(completed, "done in 30 days", false, 2);
    }

    function editor(booking, row) {
      var card = el("div", "card stack tight");
      var title = input("text", "title", "What this session is about", booking.title || "");
      var note = textarea(booking.ownerNote || "", 4);
      var meeting = input("url", "meetingUrl", "https://meet.google.com/...", booking.meetingUrl || "");
      var refund = toggle("Refund the credit", true);
      refund.node.hidden = booking.status !== "cancelled";
      var status = select(BOOKING_STATUSES, booking.status, function (value) {
        refund.node.hidden = value !== "cancelled";
      });

      var save = button("Save", "btn primary", function () {
        var body = {
          title: title.value,
          ownerNote: note.value,
          meetingUrl: meeting.value.trim(),
          status: status.value
        };
        if (status.value === "cancelled") body.refund = refund.input.checked;
        busy(save, api("/admin/bookings/" + encodeURIComponent(booking.id), { method: "PATCH", body: body }))
          .then(function () {
            toast("Saved.", "good");
            flare();
            load();
          })
          .catch(function (error) { toast(error.message, "bad"); });
      });

      append(card, [
        field("Title", title),
        field("Your note", note, "Visible to staff only."),
        field("Meeting link", meeting),
        field("Status", status),
        refund.node,
        append(el("div", "row"), [save, button("Close", "btn ghost", function () { row.hidden = true; })])
      ]);
      if (booking.clientNote) {
        card.appendChild(el("p", "small faint", "Their note"));
        card.appendChild(el("p", "small dim", booking.clientNote));
      }
      return card;
    }

    function draw(bookings) {
      clear(listCard);
      if (!bookings.length) {
        listCard.appendChild(H.empty("No sessions in this range."));
        return;
      }
      var list = el("div", "list");
      var lastDay = "";
      bookings.forEach(function (booking) {
        var key = dayKey(booking.startsAt, zone);
        if (key !== lastDay) {
          lastDay = key;
          var heading = el("div");
          heading.appendChild(el("p", "label", dayLabel(booking.startsAt, zone)));
          list.appendChild(heading);
        }

        var row = el("div");
        row.style.cursor = "pointer";
        var left = el("div", "grow");
        var who = el("div", "primary");
        if (booking.member && booking.member.id) {
          var a = H.link(memberName(booking.member), BASE + "/admin/members/" + encodeURIComponent(booking.member.id));
          a.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            H.navigate("/admin/members/" + encodeURIComponent(booking.member.id));
          });
          who.appendChild(a);
        } else {
          who.textContent = "Someone";
        }
        append(left, [
          el("div", "secondary", timeRange(booking, zone) + (booking.title ? " · " + booking.title : "")),
          who
        ]);
        if (booking.member && booking.member.email) left.appendChild(el("div", "secondary", booking.member.email));

        var right = el("div", "row");
        right.appendChild(statusPill(booking.status));
        if (booking.billing === "after") right.appendChild(pill(booking.invoicedAt ? "invoiced" : "bill after", booking.invoicedAt ? "" : "staff"));
        if (booking.billing === "free") right.appendChild(pill("free"));
        if (booking.transcriptId) right.appendChild(pill("transcript"));
        append(row, [left, right]);

        var editRow = el("div");
        editRow.hidden = true;
        var built = false;
        row.addEventListener("click", function () {
          if (!built) { editRow.appendChild(editor(booking, editRow)); built = true; }
          editRow.hidden = !editRow.hidden;
        });

        list.appendChild(row);
        list.appendChild(editRow);
      });
      listCard.appendChild(list);
    }

    function bookCard() {
      var card = el("div", "card stack tight");
      card.appendChild(el("p", "label", "Book for a member"));
      card.appendChild(el("p", "small dim", "Books the time regardless of availability and emails the invitation to both of you."));
      picker = memberPicker("Search name or email");
      var when = input("datetime-local", "startsAt", "");
      var minutes = input("number", "minutes", String(sessionMinutes), sessionMinutes);
      minutes.min = "15";
      minutes.max = "480";
      minutes.step = "5";
      var free = toggle("Free, no credit spent", false);
      var note = textarea("", 3);
      var title = input("text", "title", "What this session is about");
      var status = el("p", "form-error");
      var send = button("Book it", "btn primary", function () {
        status.textContent = "";
        var userId = picker.userId();
        var startsAt = localToInstant(when.value);
        if (!userId) { status.textContent = "Pick a member first."; return; }
        if (!startsAt) { status.textContent = "Pick a time."; return; }
        var body = {
          userId: userId,
          startsAt: startsAt,
          minutes: parseInt(minutes.value, 10) || sessionMinutes,
          free: free.input.checked,
          note: note.value,
          title: title.value
        };
        busy(send, api("/admin/bookings", { method: "POST", body: body }))
          .then(function () {
            toast("Booked.", "good");
            flare();
            picker.reset();
            when.value = "";
            note.value = "";
            title.value = "";
            bookForm.hidden = true;
            load();
          })
          .catch(function (error) {
            status.textContent = error.message;
            toast(error.message, "bad");
          });
      });
      append(card, [
        picker.node,
        field("Starts", when, "In your timezone."),
        field("Minutes", minutes),
        field("Title", title),
        free.node,
        field("Your note", note),
        append(el("div", "row"), [send]),
        status
      ]);
      return card;
    }

    function load() {
      return api("/admin/bookings" + rangeQuery()).then(function (data) {
        draw(data.bookings || []);
      }, function (error) {
        clear(listCard);
        listCard.appendChild(H.empty(error.message));
      });
    }

    var first = Promise.all([
      api("/admin/bookings").then(function (data) { drawStats(data.bookings || []); }, function () { clear(stats); }),
      can("availability.manage")
        ? api("/admin/availability").then(function (data) {
          if (data.timezone) zone = data.timezone;
          if (data.sessionMinutes) sessionMinutes = data.sessionMinutes;
          paintLede();
        }, function () { /* the owner's own zone will do */ })
        : Promise.resolve(null)
    ]);

    return first.then(load).then(function () { return wrap; });
  }, { perm: "sessions.manage", title: "Sessions", nav: { group: "Business", label: "All sessions", order: 10 } });

  /* ---------- packs ---------- */

  H.register("/admin/packs", function () {
    var wrap = el("div", "stack");

    var newForm = el("div");
    newForm.hidden = true;
    var newBuilt = false;
    var newButton = button("New pack", "btn primary", function () {
      if (!newBuilt) { newForm.appendChild(packForm(null)); newBuilt = true; }
      newForm.hidden = !newForm.hidden;
    });

    wrap.appendChild(H.viewHead("Packs", "Session packs and prices.", [newButton]));
    wrap.appendChild(el("p", "small dim", "Packs are visible only to signed-in members."));
    wrap.appendChild(newForm);

    var listWrap = el("div", "stack rise");
    wrap.appendChild(listWrap);

    // The one form both the new pack and every edit use, so the fields and
    // the conversion to cents exist once.
    function packForm(pack) {
      var existing = pack || {};
      var card = el("div", "card stack tight");
      card.appendChild(el("p", "label", pack ? "Edit" : "New pack"));
      var name = input("text", "name", "Four sessions", existing.name || "");
      var description = textarea(existing.description || "", 3);
      var sessions = input("number", "sessions", "4", existing.sessions === undefined ? "" : existing.sessions);
      sessions.min = "1";
      sessions.max = "100";
      var minutes = input("number", "minutes", "60", existing.minutes === undefined ? 60 : existing.minutes);
      minutes.min = "15";
      minutes.max = "480";
      var price = input("number", "price", "Leave empty for price on request",
        existing.priceCents === null || existing.priceCents === undefined ? "" : Number(existing.priceCents) / 100);
      price.min = "0";
      price.step = "0.01";
      var currency = input("text", "currency", "EUR", existing.currency || "EUR");
      currency.maxLength = 3;
      var position = input("number", "position", "0", existing.position === undefined ? 0 : existing.position);
      position.step = "1";
      var status = el("p", "form-error");

      var save = button(pack ? "Save pack" : "Create pack", "btn primary", function () {
        status.textContent = "";
        var priceText = price.value.trim();
        var body = {
          name: name.value,
          description: description.value,
          sessions: parseInt(sessions.value, 10),
          minutes: parseInt(minutes.value, 10),
          priceCents: priceText === "" ? null : Math.round(parseFloat(priceText) * 100),
          currency: currency.value.trim().toUpperCase(),
          position: parseInt(position.value, 10) || 0
        };
        if (pack) body.active = pack.active !== false;
        var request = pack
          ? api("/admin/packs/" + encodeURIComponent(pack.id), { method: "PATCH", body: body })
          : api("/admin/packs", { method: "POST", body: body });
        busy(save, request)
          .then(function () {
            toast(pack ? "Pack saved." : "Pack created.", "good");
            flare();
            newForm.hidden = true;
            load();
          })
          .catch(function (error) {
            status.textContent = error.message;
            toast(error.message, "bad");
          });
      });

      append(card, [
        field("Name", name),
        field("Description", description),
        field("Sessions", sessions),
        field("Minutes each", minutes),
        field("Price", price, "In whole currency units. Empty means price on request."),
        field("Currency", currency, "Three letters, for example EUR."),
        field("Position", position, "Lower comes first."),
        append(el("div", "row"), [save]),
        status
      ]);
      return card;
    }

    function packCard(pack, index) {
      var card = rise(el("div", "card stack tight"), index);
      var head = el("div", "row between");
      var left = el("div", "grow");
      append(left, [
        el("p", null, pack.name || "Unnamed pack"),
        el("p", "small dim", pack.sessions + " sessions · " + pack.minutes + " minutes each · " + money(pack.priceCents, pack.currency))
      ]);
      var active = toggle("Active", pack.active !== false);
      active.input.addEventListener("change", function () {
        active.input.disabled = true;
        api("/admin/packs/" + encodeURIComponent(pack.id), { method: "PATCH", body: { active: active.input.checked } })
          .then(function () {
            active.input.disabled = false;
            pack.active = active.input.checked;
            toast(active.input.checked ? "Shown to members." : "Hidden from members.", "good");
          })
          .catch(function (error) {
            active.input.disabled = false;
            active.input.checked = pack.active !== false;
            toast(error.message, "bad");
          });
      });
      append(head, [left, active.node]);
      card.appendChild(head);
      if (pack.description) card.appendChild(el("p", "small dim", pack.description));

      var editRow = el("div");
      editRow.hidden = true;
      var built = false;
      var edit = button("Edit", "btn sm", function () {
        if (!built) { editRow.appendChild(packForm(pack)); built = true; }
        editRow.hidden = !editRow.hidden;
      });
      var remove = button("Delete", "btn sm danger", function () {
        if (!window.confirm("Delete " + (pack.name || "this pack") + "? Packs that have been purchased are hidden instead of deleted.")) return;
        busy(remove, api("/admin/packs/" + encodeURIComponent(pack.id), { method: "DELETE" }))
          .then(function () { toast("Gone.", "good"); load(); })
          .catch(function (error) { toast(error.message, "bad"); });
      });
      card.appendChild(append(el("div", "row"), [edit, remove]));
      card.appendChild(editRow);
      return card;
    }

    function load() {
      return api("/admin/packs").then(function (data) {
        clear(listWrap);
        var packs = data.packs || [];
        if (!packs.length) {
          listWrap.appendChild(H.empty("No packs yet."));
          return;
        }
        packs.forEach(function (pack, index) { listWrap.appendChild(packCard(pack, index)); });
      }, function (error) {
        clear(listWrap);
        listWrap.appendChild(H.empty(error.message));
      });
    }

    return load().then(function () { return wrap; });
  }, { perm: "packs.manage", title: "Packs", nav: { group: "Business", label: "Packs", order: 11 } });

  /* ---------- purchases ---------- */

  H.register("/admin/purchases", function (ctx) {
    var wrap = el("div", "stack");
    var status = "requested";
    var grantPicker = null;
    if (ctx && ctx.onCleanup) ctx.onCleanup(function () { if (grantPicker) grantPicker.stop(); });

    wrap.appendChild(H.viewHead("Purchases", "Pack requests. Invoice them with Stripe and the credits arrive when it is paid, or invoice by hand and mark paid here."));

    // Whether members can pay for a pack by card through Stripe Checkout.
    var cardStrip = el("div", "card row between");
    cardStrip.hidden = true;
    wrap.appendChild(cardStrip);
    function drawCard(card) {
      clear(cardStrip);
      if (!card) return;
      cardStrip.hidden = false;
      var text = el("div", "grow");
      if (!card.connected) {
        append(text, [el("p", "label", "Card payment"), el("p", "small dim", "Stripe is not connected, so members cannot pay by card. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel, then redeploy.")]);
        cardStrip.appendChild(text);
        return;
      }
      append(text, [
        el("p", "label", "Card payment"),
        el("p", "small dim", card.on
          ? "Members see Pay by card on each priced pack. They pay on Stripe's page, the credits arrive on their own, and you get an email with what the fatura needs."
          : "Off. Members can only ask for a pack and wait for your invoice.")
      ]);
      cardStrip.appendChild(text);
      if (can("settings.manage")) {
        var sw = toggle("Members can pay by card", card.on);
        sw.input.addEventListener("change", function () {
          sw.input.disabled = true;
          api("/admin/settings", { method: "PUT", body: { card_checkout: sw.input.checked } })
            .then(function () { toast(sw.input.checked ? "Members can now pay for packs by card." : "Card payment is off.", "good"); return load(); })
            .catch(function (error) { toast(error.message, "bad"); sw.input.checked = !sw.input.checked; })
            .then(function () { sw.input.disabled = false; });
        });
        cardStrip.appendChild(sw.node);
      }
    }

    var controls = el("div", "row");
    controls.appendChild(select(PURCHASE_FILTERS, status, function (value) { status = value; load(); }));
    wrap.appendChild(controls);

    var listCard = el("div", "card pad0");
    wrap.appendChild(listCard);

    function editor(purchase) {
      var card = el("div", "card stack tight");
      var ref = input("text", "providerRef", "Invoice reference", purchase.providerRef || "");
      var amount = input("number", "amountCents", "Amount in cents",
        purchase.amountCents === null || purchase.amountCents === undefined ? "" : purchase.amountCents);
      amount.min = "0";
      amount.step = "1";
      var discount = input("number", "discountCents", "Discount in cents", purchase.discountCents || 0);
      discount.min = "0";
      discount.step = "1";
      var line = el("p", "form-error");

      function patch(node, body, done) {
        line.textContent = "";
        busy(node, api("/admin/purchases/" + encodeURIComponent(purchase.id), { method: "PATCH", body: body }))
          .then(function () {
            toast("Saved.", "good");
            if (done) done();
            load();
          })
          .catch(function (error) {
            line.textContent = error.message;
            toast(error.message, "bad");
          });
      }

      function numbers() {
        var body = { providerRef: ref.value.trim() };
        var a = parseInt(amount.value, 10);
        if (!isNaN(a)) body.amountCents = a;
        var d = parseInt(discount.value, 10);
        if (!isNaN(d)) body.discountCents = d;
        return body;
      }

      var invoiced = button("Mark invoiced", "btn", function () {
        var body = numbers();
        body.status = "invoiced";
        patch(invoiced, body);
      });
      var paid = button("Mark paid", "btn primary", function () {
        if (!window.confirm("This adds " + purchase.sessions + " session credits.")) return;
        var body = numbers();
        body.status = "paid";
        patch(paid, body, function () { flare(); });
      });
      var voided = button("Void", "btn danger", function () {
        if (!window.confirm("Void this request? Nothing is charged and no credits are added.")) return;
        patch(voided, { status: "void" });
      });
      var saveOnly = button("Save details", "btn ghost", function () { patch(saveOnly, numbers()); });
      var stripeIt = button("Invoice with Stripe", "btn primary", function () {
        H.navigate("/admin/invoices?member=" + encodeURIComponent(purchase.member.id) + "&purchase=" + encodeURIComponent(purchase.id));
      });
      var stripeRow = purchase.status === "requested" && purchase.member && purchase.member.id ? [stripeIt] : [];

      append(card, [
        field("Invoice reference", ref, "Invoice number"),
        field("Amount in cents", amount),
        field("Discount in cents", discount),
        append(el("div", "row"), stripeRow.concat([saveOnly, invoiced, paid, voided])),
        line
      ]);
      return card;
    }

    function draw(purchases) {
      clear(listCard);
      if (!purchases.length) {
        listCard.appendChild(H.empty("Nothing with that status."));
        return;
      }
      var list = el("div", "list");
      purchases.forEach(function (purchase) {
        var row = el("div");
        row.style.cursor = "pointer";
        var left = el("div", "grow");
        var who = el("div", "primary");
        if (purchase.member && purchase.member.id) {
          var a = H.link(memberName(purchase.member), BASE + "/admin/members/" + encodeURIComponent(purchase.member.id));
          a.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            H.navigate("/admin/members/" + encodeURIComponent(purchase.member.id));
          });
          who.appendChild(a);
        } else {
          who.textContent = "Someone";
        }
        var amountText = money(purchase.amountCents, purchase.currency);
        if (purchase.discountCents > 0) amountText += " less " + money(purchase.discountCents, purchase.currency);
        var how = purchase.status === "paid" && purchase.provider === "stripe_checkout" ? " · paid by card"
          : purchase.status === "requested" && purchase.cardStarted ? " · card checkout started" : "";
        append(left, [
          who,
          el("div", "secondary", (purchase.packName || "A pack") + " · " + purchase.sessions + " sessions · " + amountText),
          el("div", "secondary", fmtDate(purchase.createdAt, { dateStyle: "medium" }) + how)
        ]);
        if (purchase.note) {
          left.appendChild(el("div", "secondary faint", "their note"));
          left.appendChild(el("div", "secondary", purchase.note));
        }
        var right = el("div", "row");
        right.appendChild(pill(purchase.status, purchase.status === "paid" ? "client" : purchase.status === "void" ? "bad" : "live"));
        append(row, [left, right]);

        var editRow = el("div");
        editRow.hidden = true;
        var built = false;
        row.addEventListener("click", function () {
          if (!built) { editRow.appendChild(editor(purchase)); built = true; }
          editRow.hidden = !editRow.hidden;
        });

        list.appendChild(row);
        list.appendChild(editRow);
      });
      listCard.appendChild(list);
    }

    function grantCard() {
      var card = el("div", "card stack tight");
      card.appendChild(el("p", "label", "Grant credits"));
      card.appendChild(el("p", "small dim", "Add or remove credits. Every adjustment is recorded in the log."));
      var picker = memberPicker("Search name or email");
      grantPicker = picker;
      var delta = input("number", "delta", "1");
      delta.step = "1";
      delta.min = "-100";
      delta.max = "100";
      var note = input("text", "note", "Why");
      var line = el("p", "form-error");
      var grant = button("Grant", "btn primary", function () {
        line.textContent = "";
        var userId = picker.userId();
        var amount = parseInt(delta.value, 10);
        if (!userId) { line.textContent = "Pick a member first."; return; }
        if (!amount) { line.textContent = "A whole number of credits, and not zero."; return; }
        busy(grant, api("/admin/credits", { method: "POST", body: { userId: userId, delta: amount, note: note.value } }))
          .then(function () {
            toast("Credits granted.", "good");
            flare();
            picker.reset();
            delta.value = "";
            note.value = "";
          })
          .catch(function (error) {
            line.textContent = error.message;
            toast(error.message, "bad");
          });
      });
      append(card, [picker.node, field("Credits", delta, "Use a negative number to remove credits."), field("Note", note), append(el("div", "row"), [grant]), line]);
      return card;
    }

    function load() {
      return api("/admin/purchases?status=" + encodeURIComponent(status)).then(function (data) {
        drawCard(data.card);
        draw(data.purchases || []);
      }, function (error) {
        clear(listCard);
        listCard.appendChild(H.empty(error.message));
      });
    }

    // Sessions held by members billed after that have not been invoiced yet.
    function toInvoiceCard() {
      var card = el("div", "card pad0");
      var head = el("div", "row between");
      head.style.padding = "0.9rem 1.1rem";
      head.appendChild(el("p", "label", "To invoice"));
      card.appendChild(head);
      var list = el("div", "list");
      card.appendChild(list);
      function draw() {
        return api("/admin/to-invoice").then(function (data) {
          clear(list);
          var rows = data.bookings || [];
          if (!rows.length) {
            var none = el("div", "small dim", "Nothing waiting. Sessions held by members billed after show up here.");
            list.appendChild(none);
            return;
          }
          rows.forEach(function (b) {
            var row = el("div");
            var left = el("div", "grow");
            append(left, [el("div", "primary", memberName(b.member)), el("div", "secondary", dayLabel(b.startsAt, ownerZone()) + " · " + timeRange(b, ownerZone()) + (b.status === "no_show" ? " · no show" : ""))]);
            var done = button("Mark invoiced", "btn sm", function () {
              busy(done, api("/admin/bookings/" + encodeURIComponent(b.id), { method: "PATCH", body: { invoiced: true } }))
                .then(function () { toast("Marked invoiced.", "good"); return draw(); })
                .catch(function (error) { toast(error.message, "bad"); });
            });
            var bill = button("Invoice with Stripe", "btn sm primary", function () {
              H.navigate("/admin/invoices?member=" + encodeURIComponent(b.userId));
            });
            append(row, [left, append(el("div", "row"), [bill, done])]);
            list.appendChild(row);
          });
        }, function (error) { clear(list); list.appendChild(H.empty(error.message)); });
      }
      draw();
      return card;
    }

    return load().then(function () {
      wrap.appendChild(toInvoiceCard());
      wrap.appendChild(grantCard());
      return wrap;
    });
  }, { perm: "purchases.manage", title: "Purchases", nav: { group: "Business", label: "Purchases", order: 12 } });

  /* ---------- invoices, through Stripe ---------- */

  // Bill one member after the fact: the sessions they held while billed
  // after, a pack they asked for, or lines typed by hand. Stripe hosts the
  // page they pay on; the webhook marks it paid here on its own.
  var INVOICE_FILTERS = [
    { value: "", label: "All" },
    { value: "open", label: "To pay" },
    { value: "paid", label: "Paid" },
    { value: "void", label: "Void" }
  ];

  function euros(text) {
    var n = parseFloat(String(text).replace(",", "."));
    return isNaN(n) ? NaN : Math.round(n * 100);
  }

  // "Coaching session, 24 Sep 2026 and 2 more", so a long invoice stays one line.
  function linesSummary(inv) {
    var lines = inv.lines || [];
    if (!lines.length) return inv.description || "";
    if (lines.length <= 2) return lines.map(function (l) { return l.description; }).join(", ");
    return lines[0].description + " and " + (lines.length - 1) + " more";
  }

  function sectionLabel(text) {
    var node = el("p", "label", text);
    node.style.marginTop = "0.9rem";
    return node;
  }

  function moneyInput(name, cents) {
    var node = input("number", name, "0.00", cents === null || cents === undefined ? "" : (cents / 100).toFixed(2));
    node.min = "0";
    node.step = "0.01";
    node.inputMode = "decimal";
    return node;
  }

  H.register("/admin/invoices", function (ctx) {
    var wrap = el("div", "stack");
    var picker = null;
    var filter = "";
    if (ctx && ctx.onCleanup) ctx.onCleanup(function () { if (picker) picker.stop(); });
    var startMember = ctx && ctx.query && ctx.query.member;
    var startPurchase = ctx && ctx.query && ctx.query.purchase;

    var formCard = el("div", "card stack tight");
    formCard.hidden = !startMember;
    var newButton = button("New invoice", "btn primary", function () {
      formCard.hidden = !formCard.hidden;
      if (!formCard.hidden) formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    wrap.appendChild(H.viewHead("Invoices", "Bill a member through Stripe. They pay on Stripe's page, and paid invoices update here on their own.", [newButton]));
    var notice = el("div");
    wrap.appendChild(notice);
    wrap.appendChild(formCard);

    var controls = el("div", "row");
    controls.appendChild(select(INVOICE_FILTERS, filter, function (value) { filter = value; load(); }));
    wrap.appendChild(controls);
    var listCard = el("div", "card pad0");
    wrap.appendChild(listCard);

    /* the form */

    var body = el("div", "stack tight");
    function buildForm() {
      clear(formCard);
      formCard.appendChild(el("p", "label", "New invoice"));
      picker = memberPicker("Search name or email", { verb: "Invoicing", onChoose: function (member) { loadSources(member.id); } });
      formCard.appendChild(picker.node);
      formCard.appendChild(body);
    }

    function loadSources(userId, purchaseId) {
      clear(body);
      body.appendChild(el("p", "small dim", "Looking for what they have to pay…"));
      return api("/admin/invoice-sources/" + encodeURIComponent(userId)).then(function (data) {
        drawSources(data, purchaseId);
      }, function (error) {
        clear(body);
        body.appendChild(el("p", "form-error", error.message));
      });
    }

    function drawSources(data, purchaseId) {
      clear(body);
      var member = data.member;
      body.appendChild(el("p", "small", "Invoicing " + memberName(member) + " (" + member.email + ")" + (member.billing === "after" ? ", billed after." : ".")));
      var lines = [];
      var total = el("p", "primary");

      function recount() {
        var sum = 0;
        var bad = false;
        lines.forEach(function (line) {
          var on = line.include ? line.include.checked : true;
          if (!on) return;
          var cents = line.cents();
          if (isNaN(cents) || cents <= 0) bad = true; else sum += cents;
        });
        total.textContent = bad ? "Every line needs an amount." : "Total " + money(sum, "EUR");
      }

      // Held sessions, each its own line at the per-session price.
      if (data.bookings.length) {
        body.appendChild(sectionLabel("Sessions held, not invoiced"));
        var price = moneyInput("sessionPrice", data.sessionPriceCents);
        price.addEventListener("input", recount);
        body.appendChild(field("Price per session (EUR)", price, data.sessionPriceCents ? "From your packs. Change it for this invoice if you need to." : "Set a price for one session."));
        data.bookings.forEach(function (b) {
          var t = toggle(dayLabel(b.startsAt, ownerZone()) + " · " + timeRange(b, ownerZone()) + (b.status === "no_show" ? " · no show" : ""), true);
          t.input.addEventListener("change", recount);
          body.appendChild(t.node);
          lines.push({
            include: t.input,
            bookingId: b.id,
            description: function () {
              return "Coaching session, " + new Date(b.startsAt).toLocaleDateString("en-GB", { timeZone: ownerZone(), day: "numeric", month: "short", year: "numeric" });
            },
            cents: function () { return euros(price.value); }
          });
        });
      }

      // An open pack request, at the price it was asked at.
      if (data.purchases.length) {
        body.appendChild(sectionLabel("Pack requests"));
        data.purchases.forEach(function (p) {
          var net = p.amountCents === null ? null : p.amountCents - (p.discountCents || 0);
          var t = toggle(p.packName + " · " + p.sessions + " sessions · " + money(net, p.currency), p.id === purchaseId);
          var amount = moneyInput("pack", net);
          amount.addEventListener("input", recount);
          t.input.addEventListener("change", function () {
            // One pack per invoice, so its credits land when this one is paid.
            if (t.input.checked) lines.forEach(function (other) { if (other.purchaseId && other !== line) other.include.checked = false; });
            recount();
          });
          body.appendChild(t.node);
          body.appendChild(field("Amount (EUR)", amount));
          var line = {
            include: t.input,
            purchaseId: p.id,
            description: function () { return p.packName + " (" + p.sessions + " sessions)"; },
            cents: function () { return euros(amount.value); }
          };
          lines.push(line);
        });
      }

      // Anything else, by hand.
      var extraWrap = el("div", "stack tight");
      body.appendChild(sectionLabel("Other lines"));
      body.appendChild(extraWrap);
      function addLine() {
        var row = el("div", "row");
        var what = input("text", "lineDescription", "What it is for");
        what.maxLength = 200;
        what.className += " grow";
        var amount = moneyInput("lineAmount", null);
        amount.style.maxWidth = "9rem";
        var line = {
          description: function () { return what.value.trim(); },
          cents: function () { return euros(amount.value); },
          blank: function () { return !what.value.trim() && !amount.value; }
        };
        var remove = button("Remove", "btn sm ghost", function () {
          lines.splice(lines.indexOf(line), 1);
          extraWrap.removeChild(row);
          recount();
        });
        amount.addEventListener("input", recount);
        what.addEventListener("input", recount);
        append(row, [what, amount, remove]);
        extraWrap.appendChild(row);
        lines.push(line);
        recount();
      }
      body.appendChild(append(el("div", "row"), [button("Add a line", "btn sm", addLine)]));
      if (!data.bookings.length && !data.purchases.length) addLine();

      var due = input("number", "daysUntilDue", "14", "14");
      due.min = "0";
      due.max = "365";
      due.step = "1";
      var memo = textarea("", 2);
      memo.maxLength = 500;
      var mailIt = toggle("Email them the link to pay", true);
      var line = el("p", "form-error");
      var create = button("Create invoice", "btn primary", function () {
        line.textContent = "";
        var chosen = lines.filter(function (l) {
          if (l.include) return l.include.checked;
          return !l.blank();
        });
        if (!chosen.length) { line.textContent = "Pick something to invoice."; return; }
        var payload = {
          userId: member.id,
          lines: [],
          bookingIds: [],
          purchaseId: null,
          daysUntilDue: parseInt(due.value, 10),
          description: memo.value.trim(),
          email: mailIt.input.checked
        };
        for (var i = 0; i < chosen.length; i += 1) {
          var c = chosen[i];
          var cents = c.cents();
          var text = c.description();
          if (!text) { line.textContent = "Every line needs a description."; return; }
          if (isNaN(cents) || cents <= 0) { line.textContent = "Every line needs an amount above zero."; return; }
          payload.lines.push({ description: text, amountCents: cents });
          if (c.bookingId) payload.bookingIds.push(c.bookingId);
          if (c.purchaseId) payload.purchaseId = c.purchaseId;
        }
        if (isNaN(payload.daysUntilDue)) payload.daysUntilDue = 14;
        var sum = payload.lines.reduce(function (a, l) { return a + l.amountCents; }, 0);
        if (!window.confirm("Create a Stripe invoice for " + money(sum, "EUR") + " to " + memberName(member) + (payload.email ? " and email it to them?" : "?"))) return;
        busy(create, api("/admin/invoices", { method: "POST", body: payload }))
          .then(function (result) {
            toast(result.emailed ? "Invoice " + (result.invoice.number || "") + " sent." : "Invoice " + (result.invoice.number || "") + " created.", "good");
            flare();
            if (picker) picker.reset();
            clear(body);
            formCard.hidden = true;
            if (startMember) history.replaceState(null, "", BASE + "/admin/invoices");
            load();
          })
          .catch(function (error) {
            line.textContent = error.message;
            toast(error.message, "bad");
          });
      });
      append(body, [
        field("Due in days", due),
        field("Note on the invoice", memo, "Optional. The member sees it on Stripe's page."),
        mailIt.node,
        total,
        append(el("div", "row"), [create]),
        line
      ]);
      recount();
    }

    /* the list */

    function invoiceRow(inv) {
      var row = el("div");
      var left = el("div", "grow");
      var who = el("div", "primary");
      var a = H.link(memberName(inv.member), BASE + "/admin/members/" + encodeURIComponent(inv.userId));
      a.addEventListener("click", function (e) { e.preventDefault(); H.navigate("/admin/members/" + encodeURIComponent(inv.userId)); });
      who.appendChild(a);
      who.appendChild(document.createTextNode(" · " + money(inv.amountCents, inv.currency)));
      var what = linesSummary(inv);
      var when = inv.status === "paid" && inv.paidAt ? "paid " + fmtDate(inv.paidAt, { dateStyle: "medium" })
        : inv.status === "open" && inv.dueAt ? "due " + fmtDate(inv.dueAt, { dateStyle: "medium" })
        : fmtDate(inv.createdAt, { dateStyle: "medium" });
      append(left, [who, el("div", "secondary", (inv.number ? inv.number + " · " : "") + when), what ? el("div", "secondary faint", what) : el("span")]);
      var right = el("div", "row");
      var labels = { open: "to pay", paid: "paid", void: "void", uncollectible: "uncollectible", draft: "draft" };
      right.appendChild(pill(labels[inv.status] || inv.status, inv.status === "paid" ? "client" : inv.status === "open" ? "live" : inv.status === "void" ? "bad" : ""));
      if (inv.hostedUrl) {
        var page = link("Stripe page", inv.hostedUrl, "btn sm ghost");
        page.target = "_blank";
        page.rel = "noopener";
        right.appendChild(page);
      }
      if (inv.status === "open") {
        var remind = button("Send again", "btn sm", function () {
          busy(remind, api("/admin/invoices/" + encodeURIComponent(inv.id) + "/remind", { method: "POST", body: {} }))
            .then(function () { toast("Sent again.", "good"); })
            .catch(function (error) { toast(error.message, "bad"); });
        });
        var voidIt = button("Void", "btn sm danger", function () {
          if (!window.confirm("Void this invoice? Stripe stops accepting payment and its sessions can be invoiced again.")) return;
          busy(voidIt, api("/admin/invoices/" + encodeURIComponent(inv.id) + "/void", { method: "POST", body: {} }))
            .then(function () { toast("Voided.", "good"); load(); })
            .catch(function (error) { toast(error.message, "bad"); });
        });
        append(right, [remind, voidIt]);
      }
      append(row, [left, right]);
      return row;
    }

    function load() {
      return api("/admin/invoices").then(function (data) {
        clear(notice);
        if (!data.configured) {
          var n = el("div", "card stack tight");
          append(n, [el("p", "label", "Stripe is not connected"), el("p", "small dim", "Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel, then redeploy. Until then invoices cannot be created.")]);
          notice.appendChild(n);
          newButton.disabled = true;
        }
        clear(listCard);
        var rows = (data.invoices || []).filter(function (i) { return !filter || i.status === filter; });
        if (!rows.length) {
          listCard.appendChild(H.empty(filter ? "Nothing with that status." : "No invoices yet."));
          return;
        }
        var list = el("div", "list");
        rows.forEach(function (inv) { list.appendChild(invoiceRow(inv)); });
        listCard.appendChild(list);
      }, function (error) {
        clear(listCard);
        listCard.appendChild(H.empty(error.message));
      });
    }

    buildForm();
    if (startMember) loadSources(startMember, startPurchase);
    return load().then(function () { return wrap; });
  }, { perm: "purchases.manage", title: "Invoices", nav: { group: "Business", label: "Invoices", order: 12.5 } });

  /* ---------- availability ---------- */

  // A real week of dates is painted on a grid of half hours. Each run of
  // painted cells is saved as a window on that date alone, in the owner's
  // zone; next week starts empty unless it is painted or copied. Below it,
  // the coming weeks as dates, each with exactly what members are offered.

  var CELL = 30;
  var SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Wall clock arithmetic in a named zone, the same method as
  // lib/hearth/time.js: guess in UTC, correct by the zone's offset, and
  // correct once more across a clock change.
  var zoneFormatters = {};
  function zoneParts(date, zone) {
    var f = zoneFormatters[zone];
    if (!f) {
      f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });
      zoneFormatters[zone] = f;
    }
    var p = {};
    f.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    return { year: +p.year, month: +p.month, day: +p.day, hour: (+p.hour) % 24, minute: +p.minute, second: +p.second, weekday: SHORT_DAYS.indexOf(p.weekday) };
  }

  function zoneOffset(date, zone) {
    var p = zoneParts(date, zone);
    return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60000);
  }

  function zonedInstant(ymd, minute, zone) {
    var guess = Date.UTC(ymd.year, ymd.month - 1, ymd.day) + minute * 60000;
    var offset = zoneOffset(new Date(guess), zone);
    var instant = guess - offset * 60000;
    var second = zoneOffset(new Date(instant), zone);
    if (second !== offset) instant = guess - second * 60000;
    return new Date(instant);
  }

  function addDays(ymd, n) {
    var d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + n));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), weekday: d.getUTCDay() };
  }

  function ymdKey(ymd) {
    return ymd.year + "-" + (ymd.month < 10 ? "0" : "") + ymd.month + "-" + (ymd.day < 10 ? "0" : "") + ymd.day;
  }

  function hoursText(minutes) {
    var h = minutes / 60;
    if (!minutes) return "closed";
    return (h % 1 === 0 ? String(h) : h.toFixed(1)) + (h === 1 ? " hour" : " hours");
  }

  // Runs of true cells as [startMinute, endMinute] pairs.
  function runsOf(cells) {
    var out = [];
    var start = -1;
    for (var i = 0; i <= cells.length; i += 1) {
      if (cells[i] && start < 0) start = i;
      if (!cells[i] && start >= 0) { out.push([start * CELL, i * CELL]); start = -1; }
    }
    return out;
  }

  H.register("/admin/availability", function (ctx) {
    var state = { data: null, zone: ownerZone(), selected: null, slots: [], bookings: [] };

    return api("/admin/availability").then(function (data) {
      state.data = data;
      state.zone = data.timezone || ownerZone();
      var wrap = el("div", "stack");
      wrap.appendChild(H.viewHead("Availability", "Paint the hours you take sessions, date by date. Members see these times, less anything already booked, in their own timezone."));

      var week = weekPainter();
      var dates = datesCard();
      wrap.appendChild(week.node);
      wrap.appendChild(dates.node);
      wrap.appendChild(longOffCard());

      ctx.onCleanup(function () { week.flush(); });

      /* ---------- the painted week ---------- */

      function weekPainter() {
        var sessionMinutes = data.sessionMinutes || defaultMinutes();
        // Painted half hours by date ("YYYY-MM-DD"). A date nobody painted
        // is closed; nothing carries from one week to the next.
        var cells = {};
        function cellsOf(key) {
          if (!cells[key]) { cells[key] = []; for (var i = 0; i < 48; i += 1) cells[key].push(false); }
          return cells[key];
        }
        var lo = 7 * 60, hi = 21 * 60;
        (data.days || []).forEach(function (r) {
          var c = cellsOf(r.day);
          for (var i = Math.floor(r.start_minute / CELL); i < Math.ceil(r.end_minute / CELL) && i < 48; i += 1) c[i] = true;
          lo = Math.min(lo, Math.floor(r.start_minute / 60) * 60);
          hi = Math.max(hi, Math.ceil(r.end_minute / 60) * 60);
        });
        var first = lo / CELL, last = hi / CELL;

        var card = el("section", "card stack paint-card");
        var head = el("div", "row between");
        var titleBox = el("div");
        var total = el("p", "small dim");
        append(titleBox, [el("h2", null, "Your week"), total]);
        var status = el("p", "save-state small faint", "Saves as you paint");
        status.setAttribute("aria-live", "polite");
        append(head, [titleBox, status]);
        card.appendChild(head);

        // The grid is always a real week: paint a date and only that date
        // opens. Your Google calendars and booked sessions for those dates
        // are drawn over it, so the hours are painted around them.
        var today = zoneParts(new Date(), state.zone);
        var todayKey = ymdKey(today);
        var thisMonday = addDays(today, -((today.weekday + 6) % 7));
        var weekOffset = 0;
        var colKey = {};
        var weekBar = el("div", "row week-bar");
        var prevWeek = button("Previous week", "btn sm icon-btn", function () { weekOffset -= 1; loadWeek(); });
        var nextWeek = button("Next week", "btn sm icon-btn", function () { weekOffset += 1; loadWeek(); });
        prevWeek.textContent = "‹";
        nextWeek.textContent = "›";
        prevWeek.setAttribute("aria-label", "Previous week");
        nextWeek.setAttribute("aria-label", "Next week");
        var weekLabel = el("p", "small week-label");
        var backToday = button("This week", "btn sm ghost", function () { weekOffset = 0; loadWeek(); });
        var weekNote = el("p", "small faint grow week-note");
        append(weekBar, [prevWeek, weekLabel, nextWeek, backToday, weekNote]);
        card.appendChild(weekBar);

        var grid = el("div", "paint");
        grid.setAttribute("role", "grid");
        grid.setAttribute("aria-label", "Availability by date in " + state.zone + ", half hour cells");
        var buttons = {};
        var dayTotals = {};
        var dayDates = {};
        grid.appendChild(el("div", "paint-corner"));
        WEEK.forEach(function (d) {
          var h = el("div", "paint-day");
          var total = el("span", "paint-day-total");
          dayTotals[d.weekday] = total;
          var date = el("span", "paint-day-date");
          dayDates[d.weekday] = date;
          append(h, [el("span", "paint-day-name", d.label.slice(0, 3)), date, total]);
          grid.appendChild(h);
        });
        for (var i = first; i < last; i += 1) {
          var minute = i * CELL;
          var t = el("div", "paint-time" + (minute % 60 === 0 ? "" : " half"), minute % 60 === 0 ? minutesToClock(minute) : "");
          grid.appendChild(t);
          WEEK.forEach(function (d) {
            var b = el("button", "paint-cell" + (minute % 60 === 0 ? " hour" : ""));
            b.type = "button";
            b.dataset.wd = String(d.weekday);
            b.dataset.i = String(i);
            buttons[d.weekday + ":" + i] = b;
            grid.appendChild(b);
          });
        }
        var overlay = el("div", "paint-overlay");
        overlay.setAttribute("aria-hidden", "true");
        grid.appendChild(overlay);
        var scroller = el("div", "paint-scroll");
        scroller.appendChild(grid);
        card.appendChild(scroller);
        var legend = el("div", "dl-legend");
        [["dl-open", "open for booking"], ["dl-google", "Chama"], ["dl-google", "family, with you", "#33b679"], ["dl-google fyi", "family, does not block"], ["dl-booked", "booked"]].forEach(function (x) {
          append(legend, [append(el("span", "dl-key"), [tint(el("span", x[0]), x[2]), document.createTextNode(x[1])])]);
        });
        card.appendChild(legend);

        var weekItems = [];
        var weekSeq = 0;

        function weekStart(offset) { return addDays(thisMonday, (offset === undefined ? weekOffset : offset) * 7); }
        function keysOf(offset) {
          var monday = weekStart(offset), out = {};
          WEEK.forEach(function (d) { out[d.weekday] = ymdKey(addDays(monday, (d.weekday + 6) % 7)); });
          return out;
        }
        function isPast(wd) { return colKey[wd] < todayKey; }

        function loadWeek() {
          var monday = weekStart();
          var from = zonedInstant(monday, 0, state.zone);
          var to = zonedInstant(addDays(monday, 7), 0, state.zone);
          var sunday = addDays(monday, 6);
          var fmt = function (ymd, withMonth) { return new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).toLocaleDateString(undefined, { timeZone: "UTC", day: "numeric", month: withMonth ? "short" : undefined }); };
          weekLabel.textContent = fmt(monday, monday.month !== sunday.month) + " to " + fmt(sunday, true);
          backToday.hidden = weekOffset === 0;
          prevWeek.disabled = weekOffset <= -1;
          colKey = keysOf();
          WEEK.forEach(function (d) {
            var ymd = addDays(monday, (d.weekday + 6) % 7);
            dayDates[d.weekday].textContent = String(ymd.day);
            dayDates[d.weekday].classList.toggle("today", colKey[d.weekday] === todayKey);
            var label = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).toLocaleDateString(undefined, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
            for (var i = first; i < last; i += 1) {
              var b = buttons[d.weekday + ":" + i];
              b.disabled = isPast(d.weekday);
              b.setAttribute("aria-label", label + " " + minutesToClock(i * CELL) + " to " + minutesToClock(i * CELL + CELL));
            }
          });
          drawAll();
          var seq = ++weekSeq;
          weekItems = [];
          clear(overlay);
          weekNote.textContent = "Reading your calendar...";
          var q = "?from=" + encodeURIComponent(from.toISOString()) + "&to=" + encodeURIComponent(to.toISOString());
          Promise.all([
            api("/admin/calendar-events" + q).catch(function () { return { connected: false, failed: true, events: [] }; }),
            can("sessions.manage") ? api("/admin/bookings" + q).catch(function () { return { bookings: [] }; }) : Promise.resolve({ bookings: [] })
          ]).then(function (r) {
            if (seq !== weekSeq) return;
            var g = r[0];
            weekItems = [];
            (g.events || []).forEach(function (e) { weekItems.push({ kind: "google", starts: e.startsAt, ends: e.endsAt, title: e.title, allDay: e.allDay, blocks: e.blocks !== false, color: e.color }); });
            (r[1].bookings || []).filter(function (b) { return b.status === "scheduled"; }).forEach(function (b) {
              weekItems.push({ kind: "booked", starts: b.startsAt, ends: b.endsAt, title: memberName(b.member) });
            });
            var n = (g.events || []).length;
            weekNote.textContent = !g.connected
              ? (g.failed ? "Your Google Calendar could not be read just now." : "Connect Google in Settings to see your calendar here.")
              : n ? n + (n === 1 ? " event" : " events") + " from your calendar this week." : "Nothing on your calendar this week.";
            drawOverlay();
          });
        }

        // Each item is cut at midnight in your zone and drawn in its day's
        // column, over the half hours it covers.
        function drawOverlay() {
          clear(overlay);
          var monday = weekStart();
          var firstCell = buttons["1:" + first];
          if (!firstCell) return;
          var cellH = firstCell.offsetHeight;
          var top0 = firstCell.offsetTop;
          var lo = first * CELL, hi = last * CELL;
          WEEK.forEach(function (d) {
            var ymd = addDays(monday, (d.weekday + 6) % 7);
            var dayStart = zonedInstant(ymd, 0, state.zone).getTime();
            var dayEnd = zonedInstant(addDays(ymd, 1), 0, state.zone).getTime();
            var col = buttons[d.weekday + ":" + first];
            weekItems.forEach(function (item) {
              var s = new Date(item.starts).getTime(), e = new Date(item.ends).getTime();
              if (e <= dayStart || s >= dayEnd) return;
              var a = item.allDay ? lo : Math.max(lo, (Math.max(s, dayStart) - dayStart) / 60000);
              var b = item.allDay ? hi : Math.min(hi, (Math.min(e, dayEnd) - dayStart) / 60000);
              var clipped = !item.allDay && ((Math.max(s, dayStart) - dayStart) / 60000 < lo || (Math.min(e, dayEnd) - dayStart) / 60000 > hi);
              if (b <= a) {
                // Entirely outside the hours shown: a small mark at the edge.
                var early = (Math.min(e, dayEnd) - dayStart) / 60000 <= lo;
                a = early ? lo : hi - 8; b = a + 8;
              }
              var node = el("span", "ov ov-" + item.kind + (item.allDay ? " all-day" : "") + (clipped ? " clipped" : "") + (item.blocks === false ? " fyi" : ""));
              tint(node, item.color);
              node.style.top = (top0 + ((a - lo) / CELL) * cellH) + "px";
              node.style.height = Math.max(6, ((b - a) / CELL) * cellH - 2) + "px";
              // A shared all-day reminder takes no time: a band at the top.
              if (item.allDay && item.blocks === false) node.style.height = Math.min(cellH * 2, 34) - 2 + "px";
              node.style.left = col.offsetLeft + "px";
              node.style.width = col.offsetWidth + "px";
              if (((b - a) / CELL) * cellH >= 22 || (item.allDay && item.blocks === false)) node.appendChild(el("span", "ov-text", item.title));
              overlay.appendChild(node);
            });
          });
        }
        var onResize = function () { drawOverlay(); };
        window.addEventListener("resize", onResize);

        function paintCell(wd, i, on) {
          if (isPast(wd)) return false;
          var c = cellsOf(colKey[wd]);
          if (c[i] === on) return false;
          c[i] = on;
          dirtyDays[colKey[wd]] = true;
          draw(wd, i);
          return true;
        }

        function draw(wd, i) {
          var b = buttons[wd + ":" + i];
          if (!b) return;
          var c = cellsOf(colKey[wd]);
          var on = c[i];
          b.classList.toggle("on", on);
          b.classList.toggle("top", on && !c[i - 1]);
          b.classList.toggle("bottom", on && !c[i + 1]);
          b.setAttribute("aria-pressed", String(on));
        }

        function drawAll() {
          WEEK.forEach(function (d) { for (var i = first; i < last; i += 1) draw(d.weekday, i); });
          totals();
        }

        function totals() {
          var weekMinutes = 0, sessions = 0;
          WEEK.forEach(function (d) {
            var m = 0;
            runsOf(cellsOf(colKey[d.weekday])).forEach(function (r) { m += r[1] - r[0]; sessions += Math.floor((r[1] - r[0]) / sessionMinutes); });
            weekMinutes += m;
            dayTotals[d.weekday].textContent = m ? (m / 60 % 1 === 0 ? m / 60 : (m / 60).toFixed(1)) + "h" : "";
          });
          total.textContent = weekMinutes
            ? hoursText(weekMinutes) + " open this week, room for up to " + sessions + " session" + (sessions === 1 ? "" : "s") + ". In " + state.zone + "."
            : "Nothing open this week. Drag across a day to open hours on that date only.";
        }

        // Mouse and pen paint by dragging; the first cell decides whether the
        // stroke opens or closes. A tap or a key toggles one cell, which is
        // how a phone works, so the page still scrolls under a finger.
        var stroke = null;
        var swallowClick = false;
        grid.addEventListener("pointerdown", function (e) {
          if (e.pointerType === "touch" || e.button !== 0) return;
          var b = e.target.closest && e.target.closest(".paint-cell");
          if (!b || b.disabled) return;
          e.preventDefault();
          var wd = +b.dataset.wd, i = +b.dataset.i;
          stroke = { on: !cellsOf(colKey[wd])[i], changed: false };
          if (paintCell(wd, i, stroke.on)) stroke.changed = true;
          grid.classList.add("painting");
          swallowClick = true;
        });
        grid.addEventListener("pointermove", function (e) {
          if (!stroke) return;
          var target = document.elementFromPoint(e.clientX, e.clientY);
          var b = target && target.closest && target.closest(".paint-cell");
          if (!b || !grid.contains(b)) return;
          if (paintCell(+b.dataset.wd, +b.dataset.i, stroke.on)) { stroke.changed = true; drawNeighbours(+b.dataset.wd, +b.dataset.i); }
        });
        function endStroke() {
          if (!stroke) return;
          var changed = stroke.changed;
          stroke = null;
          grid.classList.remove("painting");
          if (changed) { drawAll(); changedWeek(); }
        }
        window.addEventListener("pointerup", endStroke);
        window.addEventListener("pointercancel", endStroke);
        grid.addEventListener("click", function (e) {
          if (swallowClick) { swallowClick = false; return; }
          var b = e.target.closest && e.target.closest(".paint-cell");
          if (!b) return;
          var wd = +b.dataset.wd, i = +b.dataset.i;
          if (!paintCell(wd, i, !cellsOf(colKey[wd])[i])) return;
          drawNeighbours(wd, i);
          totals();
          changedWeek();
        });
        function drawNeighbours(wd, i) { draw(wd, i - 1); draw(wd, i + 1); }

        /* ---------- quick fills, on the dates shown ---------- */

        function setDay(key, from, to) {
          if (key < todayKey) return;
          var c = cellsOf(key);
          for (var i = 0; i < 48; i += 1) c[i] = i >= from / CELL && i < to / CELL;
          dirtyDays[key] = true;
        }
        function copyDay(fromKey, toKey) {
          if (toKey < todayKey) return;
          cells[toKey] = cellsOf(fromKey).slice();
          dirtyDays[toKey] = true;
        }
        function fill(days, from, to) {
          days.forEach(function (wd) { setDay(colKey[wd], from, to); });
          drawAll();
          changedWeek();
        }
        var weekdays = [1, 2, 3, 4, 5];
        var quick = el("div", "row paint-quick");
        append(quick, [
          button("Weekdays 9 to 5", "btn sm", function () { fill(weekdays, 9 * 60, 17 * 60); }),
          button("Weekday mornings", "btn sm", function () { fill(weekdays, 9 * 60, 12 * 60); }),
          button("Copy Monday to the weekdays", "btn sm", function () {
            [2, 3, 4, 5].forEach(function (wd) { copyDay(colKey[1], colKey[wd]); });
            drawAll();
            changedWeek();
          }),
          button("Same as last week", "btn sm", function () {
            var before = keysOf(weekOffset - 1);
            WEEK.forEach(function (d) { copyDay(before[d.weekday], colKey[d.weekday]); });
            drawAll();
            changedWeek();
          }),
          button("Copy to next week", "btn sm", function () {
            var after = keysOf(weekOffset + 1);
            WEEK.forEach(function (d) { copyDay(colKey[d.weekday], after[d.weekday]); });
            changedWeek();
            weekOffset += 1;
            loadWeek();
          }),
          button("Clear this week", "btn sm ghost", function () {
            if (!window.confirm("Close every hour of this week? Booked sessions stay booked.")) return;
            fill([0, 1, 2, 3, 4, 5, 6], 0, 0);
          })
        ]);
        card.appendChild(quick);

        /* ---------- saving ---------- */

        var timer = null, saving = null, dirty = false;
        var dirtyDays = {};
        function changedWeek() {
          dirty = true;
          status.textContent = "Unsaved";
          status.className = "save-state small faint";
          clearTimeout(timer);
          timer = setTimeout(save, 700);
        }
        function save() {
          clearTimeout(timer);
          if (!dirty) return saving || Promise.resolve();
          if (saving) { timer = setTimeout(save, 300); return saving; }
          dirty = false;
          var sent = dirtyDays;
          dirtyDays = {};
          var days = {};
          Object.keys(sent).forEach(function (key) { days[key] = runsOf(cellsOf(key)); });
          status.textContent = "Saving";
          saving = api("/admin/availability", { method: "PUT", body: { timezone: state.zone, days: days } }).then(function () {
            saving = null;
            status.textContent = "Saved";
            status.className = "save-state small good";
            dates.reload();
          }, function (error) {
            saving = null;
            dirty = true;
            Object.keys(sent).forEach(function (key) { dirtyDays[key] = true; });
            status.textContent = "Not saved: " + error.message;
            status.className = "save-state small bad";
            toast(error.message, "bad");
          });
          return saving;
        }

        // Shows the week holding a date, so a date picked below can be painted.
        function showDate(key) {
          var p = key.split("-");
          var ymd = { year: +p[0], month: +p[1], day: +p[2] };
          var days = Math.round((Date.UTC(ymd.year, ymd.month - 1, ymd.day) - Date.UTC(thisMonday.year, thisMonday.month - 1, thisMonday.day)) / DAY);
          var offset = Math.floor(days / 7);
          if (offset === weekOffset) return;
          weekOffset = offset;
          loadWeek();
        }

        // Adds a window to one date, from the date panel below.
        function open(key, from, to) {
          var c = cellsOf(key);
          for (var i = Math.floor(from / CELL); i < Math.ceil(to / CELL) && i < 48; i += 1) c[i] = true;
          dirtyDays[key] = true;
          changedWeek();
          drawAll();
          return save();
        }

        colKey = keysOf();
        drawAll();
        requestAnimationFrame(loadWeek);
        return {
          node: card,
          flush: function () { if (dirty) save(); window.removeEventListener("pointerup", endStroke); window.removeEventListener("pointercancel", endStroke); window.removeEventListener("resize", onResize); },
          runsFor: function (key) { return runsOf(cellsOf(key)); },
          showDate: showDate,
          open: open
        };
      }

      /* ---------- the coming weeks, date by date ---------- */

      function datesCard() {
        var card = el("section", "card stack");
        var head = el("div");
        append(head, [
          el("h2", null, "The coming weeks"),
          el("p", "small dim", "Pick a date to paint it above, take it off, or see the exact times members are offered. Members book from " + (data.noticeHours || 0) + " hours ahead, up to " + (data.horizonDays || 60) + " days out; change that in Settings.")
        ]);
        card.appendChild(head);
        var gStrip = el("div", "gcal-strip");
        var cal = el("div", "dates");
        var panel = el("div", "day-panel");
        append(card, [gStrip, cal, panel]);
        state.gcal = { connected: false, events: [] };

        var today = zoneParts(new Date(), state.zone);
        var mondayOffset = (today.weekday + 6) % 7;
        var start = addDays(today, -mondayOffset);
        var DAYS = 35;

        function load(fresh) {
          var from = zonedInstant(today, 0, state.zone);
          var to = zonedInstant(addDays(start, DAYS), 0, state.zone);
          return Promise.all([
            api("/admin/slots?from=" + encodeURIComponent(from.toISOString()) + "&to=" + encodeURIComponent(to.toISOString())),
            can("sessions.manage")
              ? api("/admin/bookings?from=" + encodeURIComponent(from.toISOString()) + "&to=" + encodeURIComponent(to.toISOString())).catch(function () { return { bookings: [] }; })
              : Promise.resolve({ bookings: [] }),
            api("/admin/availability"),
            api("/admin/calendar-events?from=" + encodeURIComponent(from.toISOString()) + "&to=" + encodeURIComponent(to.toISOString()) + (fresh === true ? "&fresh=1" : ""))
              .catch(function () { return { connected: false, failed: true, events: [] }; })
          ]).then(function (r) {
            state.slots = r[0].slots || [];
            state.bookings = (r[1].bookings || []).filter(function (b) { return b.status === "scheduled"; });
            state.data = r[2];
            state.gcal = r[3];
            state.gcal.ranges = (r[3].events || []).map(function (e) { return { starts_at: e.startsAt, ends_at: e.endsAt, title: e.title, allDay: e.allDay, blocks: e.blocks !== false, color: e.color, shared: (r[3].shared || []).indexOf(e.calendarId) >= 0 }; });
            drawStrip();
            draw();
          }, function (error) {
            clear(cal);
            cal.appendChild(H.empty(error.message));
          });
        }

        // Where the Google calendar stands, and the two choices about it.
        function drawStrip() {
          clear(gStrip);
          var g = state.gcal;
          var dot = el("span", "gcal-dot" + (g.connected && !(g.unread || []).length ? " on" : ""));
          var text = el("div", "grow");
          if (!g.connected) {
            text.appendChild(el("p", "small", g.failed ? "Your Google Calendar could not be read just now." : "Google Calendar is not connected, so your events are not shown here."));
            if (can("settings.manage")) {
              var go = link("Connect it in Settings", BASE + "/admin/settings", "small");
              go.addEventListener("click", function (e) { e.preventDefault(); H.navigate("/admin/settings"); });
              text.appendChild(go);
            }
            append(gStrip, [dot, text]);
            return;
          }
          var n = (g.events || []).length;
          text.appendChild(el("p", "small", "Google Calendar (" + (g.email || "connected") + "): " + n + (n === 1 ? " event" : " events") + " in these weeks, drawn on each date." + (g.blocks ? " Members cannot book over them." : " They do not block booking.")));
          var cals = (g.calendars || ["primary"]).map(function (c) { return c === "primary" ? (g.email || "your calendar") : c; });
          var shared = g.shared || [];
          text.appendChild(el("p", "small faint", "Reading " + cals.join(", ") + "." + (shared.length ? " Also showing the family calendar (" + shared.join(", ") + ") in its own colours; only its events with you, or coloured green, block booking." : "")));
          (g.unread || []).forEach(function (id) {
            text.appendChild(el("p", "small bad-text", "Could not read " + (id === "primary" ? "your main calendar" : id) + ". If it is another account's calendar, share it with " + (g.email || "the connected account") + " first."));
          });
          var actions = el("div", "row gcal-actions");
          if (can("settings.manage")) {
            var sw = toggle("Block booking", g.blocks);
            sw.input.addEventListener("change", function () {
              sw.input.disabled = true;
              api("/admin/settings", { method: "PUT", body: { google_busy: sw.input.checked } })
                .then(function () { toast(sw.input.checked ? "Your Google events now block booking." : "Your Google events no longer block booking.", "good"); return load(); })
                .catch(function (error) { toast(error.message, "bad"); sw.input.checked = !sw.input.checked; })
                .then(function () { sw.input.disabled = false; });
            });
            actions.appendChild(sw.node);
            var editCals = button("Calendars", "btn sm ghost", function () { drawCalendarsForm(); });
            actions.appendChild(editCals);
          }
          var refresh = button("Refresh", "btn sm ghost", function () { busy(refresh, load(true)); });
          actions.appendChild(refresh);
          append(gStrip, [dot, text, actions]);
        }

        function drawCalendarsForm() {
          var g = state.gcal;
          var box = el("div", "stack tight gcal-form");
          var field1 = input("text", "calendars", "primary, someone@example.com", (g.calendars || ["primary"]).join(", "));
          var field2 = input("text", "shared-calendars", "partner@example.com", (g.shared || []).join(", "));
          var line = el("p", "form-error");
          var list = function (f) { return f.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean); };
          var save = button("Save calendars", "btn sm primary", function () {
            var ids = list(field1);
            if (!ids.length) ids = ["primary"];
            busy(save, api("/admin/settings", { method: "PUT", body: { google_calendars: ids, google_shared_calendars: list(field2) } }))
              .then(function () { toast("Calendars saved.", "good"); return load(true); })
              .catch(function (error) { line.textContent = error.message; });
          });
          append(box, [
            field("Calendars to read", field1, "Comma separated. \"primary\" is " + (g.email || "the connected account") + ". To add another account's calendar, share it with " + (g.email || "that account") + " (See all event details) in Google Calendar, then add its address here."),
            field("Shared calendars", field2, "Someone else's calendar shared with " + (g.email || "the connected account") + ". All its events are shown in their colours. Only the ones with you block booking: you are invited, your first name is in the title, or it is coloured green."),
            append(el("div", "row"), [save, button("Cancel", "btn sm ghost", drawStrip)]),
            line
          ]);
          gStrip.appendChild(box);
        }

        function byDay(list, keyOf) {
          var out = {};
          list.forEach(function (item) { var k = keyOf(item); (out[k] = out[k] || []).push(item); });
          return out;
        }

        function touching(ranges, ymd) {
          var s = zonedInstant(ymd, 0, state.zone).getTime(), e = zonedInstant(addDays(ymd, 1), 0, state.zone).getTime();
          return ranges.filter(function (r) { return new Date(r.starts_at).getTime() < e && new Date(r.ends_at).getTime() > s; });
        }

        function wholeDayOff(ymd) {
          var s = zonedInstant(ymd, 0, state.zone).getTime(), e = zonedInstant(addDays(ymd, 1), 0, state.zone).getTime();
          return (state.data.blocks || []).some(function (b) { return new Date(b.starts_at).getTime() <= s && new Date(b.ends_at).getTime() >= e; });
        }

        function draw() {
          clear(cal);
          WEEK.forEach(function (d) { cal.appendChild(el("div", "dates-head", d.label.slice(0, 3))); });
          var slotsByDay = byDay(state.slots, function (s) { return dayKey(s.startsAt, state.zone); });
          var booksByDay = byDay(state.bookings, function (b) { return dayKey(b.startsAt, state.zone); });
          var max = 1;
          Object.keys(slotsByDay).forEach(function (k) { max = Math.max(max, slotsByDay[k].length); });
          var todayKey = ymdKey(today);
          for (var n = 0; n < DAYS; n += 1) {
            var ymd = addDays(start, n);
            var key = ymdKey(ymd);
            var past = key < todayKey;
            var free = (slotsByDay[key] || []).length;
            var booked = (booksByDay[key] || []).length;
            var off = !past && wholeDayOff(ymd);
            var extra = !past && touching(state.data.openings || [], ymd).length > 0;
            var tile = el("button", "date-tile" + (past ? " past" : "") + (off ? " off" : "") + (key === state.selected ? " selected" : "") + (key === todayKey ? " today" : ""));
            tile.type = "button";
            tile.disabled = past;
            var num = el("span", "date-num", String(ymd.day));
            var bar = el("span", "date-bar");
            var fillBar = el("span");
            fillBar.style.setProperty("--w", String(free / max));
            bar.appendChild(fillBar);
            var meta = el("span", "date-meta", off ? "off" : free ? String(free) : past ? "" : "none");
            if (free && !off) meta.appendChild(el("span", "w", free === 1 ? " time" : " times"));
            append(tile, [num, bar, meta]);
            if (booked) tile.appendChild(el("span", "date-booked", booked + " booked"));
            if (extra) tile.appendChild(el("span", "date-extra", "extra"));
            var gEvents = past ? [] : touching(state.gcal.ranges || [], ymd);
            if (gEvents.length) tile.appendChild(el("span", "date-gcal", gEvents.some(function (e) { return e.allDay && e.blocks; }) ? "busy all day" : gEvents.length + (gEvents.length === 1 ? " event" : " events")));
            if (ymd.day === 1 || n === 0) num.textContent = ymd.day + " " + new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day)).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
            tile.setAttribute("aria-label", dayLabel(zonedInstant(ymd, 12 * 60, state.zone).toISOString(), state.zone) + ": " + (off ? "day off" : free + " open times") + (booked ? ", " + booked + " booked" : ""));
            (function (ymd, key) {
              tile.addEventListener("click", function () { state.selected = key; week.showDate(key); draw(); });
            })(ymd, key);
            cal.appendChild(tile);
          }
          drawPanel();
        }

        function drawPanel() {
          clear(panel);
          if (!state.selected) {
            panel.appendChild(el("p", "small faint", "Pick a date above."));
            return;
          }
          var parts = state.selected.split("-");
          var ymd = { year: +parts[0], month: +parts[1], day: +parts[2] };
          var noon = zonedInstant(ymd, 12 * 60, state.zone);
          var wd = zoneParts(noon, state.zone).weekday;
          var dayStart = zonedInstant(ymd, 0, state.zone), dayEnd = zonedInstant(addDays(ymd, 1), 0, state.zone);
          var off = wholeDayOff(ymd);

          var top = el("div", "row between");
          top.appendChild(el("h3", null, dayLabel(noon.toISOString(), state.zone)));
          var toggleOff = button(off ? "Open this day again" : "Take this day off", off ? "btn sm primary" : "btn sm", function () {
            var job = off
              ? Promise.all(touching(state.data.blocks || [], ymd).map(function (b) { return api("/admin/blocks/" + encodeURIComponent(b.id), { method: "DELETE" }); }))
              : api("/admin/blocks", { method: "POST", body: { startsAt: dayStart.toISOString(), endsAt: dayEnd.toISOString(), reason: "Day off" } });
            busy(toggleOff, job).then(function () { toast(off ? "The day is open again." : "Day off. Nobody can book it.", "good"); return load(); })
              .catch(function (error) { toast(error.message, "bad"); });
          });
          top.appendChild(toggleOff);
          panel.appendChild(top);

          var usual = week.runsFor(state.selected).map(function (r) { return minutesToClock(r[0]) + " to " + minutesToClock(r[1]); });
          panel.appendChild(el("p", "small dim", usual.length ? "Open on this date: " + usual.join(", ") + "." : "No hours painted on this date."));

          var list = el("div", "list day-changes");
          touching(state.data.openings || [], ymd).forEach(function (o) {
            list.appendChild(changeRow("Extra time", clockTime(o.starts_at, state.zone) + " to " + clockTime(o.ends_at, state.zone), "/admin/openings/" + encodeURIComponent(o.id)));
          });
          touching(state.data.blocks || [], ymd).forEach(function (b) {
            var whole = new Date(b.starts_at) <= dayStart && new Date(b.ends_at) >= dayEnd;
            list.appendChild(changeRow(whole ? "Day off" : "Blocked", whole ? (b.reason || "all day") : clockTime(b.starts_at, state.zone) + " to " + clockTime(b.ends_at, state.zone) + (b.reason ? " · " + b.reason : ""), "/admin/blocks/" + encodeURIComponent(b.id)));
          });
          if (list.childNodes.length) panel.appendChild(list);

          var free = state.slots.filter(function (s) { return dayKey(s.startsAt, state.zone) === state.selected; });
          var booked = state.bookings.filter(function (b) { return dayKey(b.startsAt, state.zone) === state.selected; });
          var gDay = touching(state.gcal.ranges || [], ymd);
          panel.appendChild(dayLine(state.selected, free, booked, gDay, dayStart, dayEnd));
          if (gDay.length) {
            var gl = el("div", "list gcal-list");
            gDay.forEach(function (e) {
              var row = el("div");
              var whenText = e.allDay ? "all day" : clockTime(e.starts_at, state.zone) + " to " + clockTime(e.ends_at, state.zone);
              var name = append(el("div", "primary"), [tint(el("span", "gcal-swatch" + (e.blocks ? "" : " fyi")), e.color), document.createTextNode(e.title)]);
              append(row, [append(el("div", "grow"), [name, el("div", "secondary", whenText)]), el("span", "meta", !e.shared ? "Chama" : e.blocks ? "Family" : "Family, does not block")]);
              gl.appendChild(row);
            });
            panel.appendChild(el("p", "label", "On your calendar"));
            panel.appendChild(gl);
          }
          if (booked.length) {
            var bl = el("p", "small");
            bl.textContent = "Booked: " + booked.map(function (b) { return clockTime(b.startsAt, state.zone) + " " + memberName(b.member); }).join(", ");
            panel.appendChild(bl);
          }
          var offered = el("div", "offered");
          if (free.length) {
            offered.appendChild(el("span", "label", "Members are offered"));
            var chips = el("div", "row tight-row");
            free.forEach(function (s) { chips.appendChild(el("span", "time-chip", clockTime(s.startsAt, state.zone))); });
            offered.appendChild(chips);
          } else {
            offered.appendChild(el("p", "small faint", off ? "Nothing is offered on a day off." : "Nothing is offered on this day."));
          }
          panel.appendChild(offered);

          var from = input("time", "from", "", "18:00");
          var to = input("time", "to", "", "20:00");
          var line = el("p", "form-error");
          function range() {
            var a = clockToMinutes(from.value), b = clockToMinutes(to.value);
            if (a === null || b === null || b <= a) { line.textContent = "Pick a start before the end."; return null; }
            line.textContent = "";
            return { startsAt: zonedInstant(ymd, a, state.zone).toISOString(), endsAt: zonedInstant(ymd, b, state.zone).toISOString() };
          }
          var addExtra = button("Open this time", "btn sm primary", function () {
            var r = range(); if (!r) return;
            busy(addExtra, week.open(state.selected, clockToMinutes(from.value), clockToMinutes(to.value))).then(function () { toast("Opened.", "good"); flare(); });
          });
          var blockIt = button("Block this time", "btn sm", function () {
            var r = range(); if (!r) return;
            busy(blockIt, api("/admin/blocks", { method: "POST", body: r })).then(function () { toast("Blocked.", "good"); return load(); })
              .catch(function (error) { line.textContent = error.message; });
          });
          var editRow = el("div", "row");
          append(editRow, [from, el("span", "small dim", "to"), to, addExtra, blockIt]);
          panel.appendChild(el("p", "label", "Just this day, in " + state.zone));
          panel.appendChild(editRow);
          panel.appendChild(line);
        }

        // The selected day as one line: your usual hours, what members can
        // book, your Google events and booked sessions, on the same clock.
        function dayLine(key, free, booked, gDay, dayStart, dayEnd) {
          var minutes = state.data.sessionMinutes || defaultMinutes();
          var startMs = dayStart.getTime();
          function m(iso) { return Math.max(0, Math.min(1440, (new Date(iso).getTime() - startMs) / 60000)); }
          var lo = 7 * 60, hi = 21 * 60;
          var usual = week.runsFor(key);
          usual.forEach(function (r) { lo = Math.min(lo, r[0]); hi = Math.max(hi, r[1]); });
          free.forEach(function (s) { lo = Math.min(lo, m(s.startsAt)); hi = Math.max(hi, m(s.startsAt) + minutes); });
          gDay.forEach(function (e) { if (!e.allDay) { lo = Math.min(lo, m(e.starts_at)); hi = Math.max(hi, m(e.ends_at)); } });
          lo = Math.floor(lo / 60) * 60; hi = Math.min(1440, Math.ceil(hi / 60) * 60);
          var span = hi - lo;
          var wrapLine = el("div", "dayline-wrap");
          var line = el("div", "dayline");
          line.setAttribute("role", "img");
          line.setAttribute("aria-label", "This day from " + minutesToClock(lo) + " to " + minutesToClock(hi));
          function bar(cls, a, b, label, color) {
            a = Math.max(lo, a); b = Math.min(hi, b);
            if (b <= a) return;
            var node = tint(el("span", cls), color);
            node.style.left = ((a - lo) / span * 100) + "%";
            node.style.width = ((b - a) / span * 100) + "%";
            if (label) { node.title = label; if ((b - a) / span > 0.12) node.appendChild(el("span", "dayline-text", label)); }
            line.appendChild(node);
          }
          usual.forEach(function (r) { bar("dl-usual", r[0], r[1]); });
          var runs = [];
          free.forEach(function (s) { var a = m(s.startsAt); var last = runs[runs.length - 1]; if (last && a <= last[1]) last[1] = Math.max(last[1], a + minutes); else runs.push([a, a + minutes]); });
          runs.forEach(function (r) { bar("dl-open", r[0], r[1]); });
          gDay.forEach(function (e) { bar("dl-google" + (e.blocks ? "" : " fyi"), e.allDay ? lo : m(e.starts_at), e.allDay ? hi : m(e.ends_at), e.title, e.color); });
          booked.forEach(function (b) { bar("dl-booked", m(b.startsAt), m(b.endsAt), memberName(b.member)); });
          for (var h = lo; h <= hi; h += 60) {
            if ((h - lo) % (span > 720 ? 180 : 120) !== 0) continue;
            var t = el("span", "dl-tick" + (h === lo ? " first" : ""), minutesToClock(h));
            t.style.left = ((h - lo) / span * 100) + "%";
            line.appendChild(t);
          }
          var legend = el("div", "dl-legend");
          var keys = [["dl-usual", "painted"], ["dl-open", "members can book"]];
          if (gDay.some(function (e) { return !e.shared; })) keys.push(["dl-google", "Chama"]);
          if (gDay.some(function (e) { return e.shared && e.blocks; })) keys.push(["dl-google", "family, with you", "#33b679"]);
          if (gDay.some(function (e) { return !e.blocks; })) keys.push(["dl-google fyi", "family, does not block"]);
          keys.concat([["dl-booked", "booked"]]).forEach(function (x) {
            append(legend, [append(el("span", "dl-key"), [tint(el("span", x[0]), x[2]), document.createTextNode(x[1])])]);
          });
          append(wrapLine, [line, legend]);
          return wrapLine;
        }

        function changeRow(what, detail, path) {
          var row = el("div");
          var left = el("div", "grow");
          append(left, [el("div", "primary", what), el("div", "secondary", detail)]);
          var remove = button("Remove", "btn sm ghost", function () {
            busy(remove, api(path, { method: "DELETE" })).then(function () { toast("Removed.", "good"); return load(); })
              .catch(function (error) { toast(error.message, "bad"); });
          });
          append(row, [left, remove]);
          return row;
        }

        state.selected = ymdKey(today);
        cal.appendChild(el("p", "dim", "Reading the calendar..."));
        load();
        return { node: card, reload: load };
      }

      /* ---------- longer time off ---------- */

      function longOffCard() {
        var blocksCard = el("section", "card stack tight");
        blocksCard.appendChild(el("h2", null, "Longer time off"));
        blocksCard.appendChild(el("p", "small dim", "A holiday or a trip, across several days. It closes those dates even where hours are painted."));
        var fromField = input("datetime-local", "startsAt", "");
        var toField = input("datetime-local", "endsAt", "");
        var reason = input("text", "reason", "Reason (optional)");
        var blockLine = el("p", "form-error");
        var addBlock = button("Book the time out", "btn", function () {
          blockLine.textContent = "";
          var startsAt = localToInstant(fromField.value);
          var endsAt = localToInstant(toField.value);
          if (!startsAt || !endsAt) { blockLine.textContent = "Time off needs a start and an end."; return; }
          busy(addBlock, api("/admin/blocks", { method: "POST", body: { startsAt: startsAt, endsAt: endsAt, reason: reason.value } }))
            .then(function () {
              toast("Booked out.", "good");
              flare();
              fromField.value = "";
              toField.value = "";
              reason.value = "";
              return dates.reload();
            })
            .catch(function (error) { blockLine.textContent = error.message; });
        });
        var localZone = browserZone();
        var hint = localZone && localZone !== state.zone ? "In your timezone (" + localZone + "), not " + state.zone + "." : "In your timezone.";
        var pair = el("div", "grid2");
        append(pair, [field("From", fromField), field("To", toField)]);
        append(blocksCard, [pair, el("p", "small faint", hint), field("Reason", reason), append(el("div", "row"), [addBlock]), blockLine]);
        return blocksCard;
      }

      return wrap;
    });
  }, { perm: "availability.manage", title: "Availability", nav: { group: "Business", label: "Availability", order: 13 } });

  /* ---------- one tile on the home view ---------- */

  // Whoever runs the sessions sees the week ahead without leaving home. A
  // failure here adds nothing and says nothing.
  H.onHome(function (tile) {
    if (!can("sessions.manage")) return null;
    var now = Date.now();
    var path = "/admin/bookings?from=" + new Date(now).toISOString() + "&to=" + new Date(now + 7 * DAY).toISOString();
    return api(path).then(function (data) {
      var n = (data.bookings || []).filter(function (b) { return b.status === "scheduled"; }).length;
      H.countUp(tile(0, "sessions this week", true), n);
    }).catch(function () { /* the home view is fine without it */ });
  });
})();
