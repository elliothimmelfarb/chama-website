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
      return d.toLocaleString(undefined, { timeZone: zone, hour: "2-digit", minute: "2-digit" });
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
  function memberPicker(placeholder) {
    var wrap = el("div", "stack tight");
    var search = input("search", "member", placeholder || "Search name or email");
    var results = el("div", "row");
    var chosen = el("p", "small dim");
    var picked = null;
    var timer = null;
    var searchable = can("members.read");

    var idInput = input("text", "userId", "Member id");
    idInput.hidden = true;

    function choose(member) {
      picked = member;
      chosen.textContent = "Booking for " + memberName(member) + " (" + member.email + ")";
      clear(results);
      search.value = "";
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
            draw(data.members || []);
          }, function () {
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

  H.register("/admin/sessions", function () {
    var wrap = el("div", "stack");
    var zone = ownerZone();
    var sessionMinutes = defaultMinutes();
    var range = "next";

    var bookForm = el("div");
    bookForm.hidden = true;
    var bookBuilt = false;

    var newButton = button("Book for a member", "btn primary", function () {
      if (!bookBuilt) { bookForm.appendChild(bookCard()); bookBuilt = true; }
      bookForm.hidden = !bookForm.hidden;
    });
    wrap.appendChild(H.viewHead("Sessions", "Every booking, in " + zone + ".", [newButton]));
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
        field("Your note", note, "Only the business sees this."),
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
        listCard.appendChild(H.empty("No sessions in that stretch of time."));
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
      card.appendChild(el("p", "small dim", "This books the time whatever the calendar offers, and sends both of you the invitation."));
      var picker = memberPicker("Search name or email");
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
        field("Starts", when, "Your own clock, converted on the way out."),
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

    wrap.appendChild(H.viewHead("Packs", "What someone can buy, and what it costs.", [newButton]));
    wrap.appendChild(el("p", "small dim", "Prices live here, never in code or on the public page. Packs are visible only to signed-in members."));
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
        if (!window.confirm("Delete " + (pack.name || "this pack") + "? A pack somebody has bought is switched off instead.")) return;
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

  H.register("/admin/purchases", function () {
    var wrap = el("div", "stack");
    var status = "requested";

    wrap.appendChild(H.viewHead("Purchases", "A pack asked for, invoiced by hand, then marked paid here. Marking it paid is what adds the credits."));

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

      append(card, [
        field("Invoice reference", ref, "Whatever your certified invoicing software calls it."),
        field("Amount in cents", amount),
        field("Discount in cents", discount),
        append(el("div", "row"), [saveOnly, invoiced, paid, voided]),
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
        append(left, [
          who,
          el("div", "secondary", (purchase.packName || "A pack") + " · " + purchase.sessions + " sessions · " + amountText),
          el("div", "secondary", fmtDate(purchase.createdAt, { dateStyle: "medium" }))
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
      card.appendChild(el("p", "small dim", "By hand, in either direction. Every grant is in the log with your name on it."));
      var picker = memberPicker("Search name or email");
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
      append(card, [picker.node, field("Credits", delta, "Negative takes them away."), field("Note", note), append(el("div", "row"), [grant]), line]);
      return card;
    }

    function load() {
      return api("/admin/purchases?status=" + encodeURIComponent(status)).then(function (data) {
        draw(data.purchases || []);
      }, function (error) {
        clear(listCard);
        listCard.appendChild(H.empty(error.message));
      });
    }

    return load().then(function () {
      wrap.appendChild(grantCard());
      return wrap;
    });
  }, { perm: "purchases.manage", title: "Purchases", nav: { group: "Business", label: "Purchases", order: 12 } });

  /* ---------- availability ---------- */

  H.register("/admin/availability", function () {
    return api("/admin/availability").then(function (data) {
      var zone = data.timezone || ownerZone();
      var wrap = el("div", "stack");
      wrap.appendChild(H.viewHead("Availability", "The week the calendar offers, and the days it does not."));
      wrap.appendChild(el("p", "small dim", "Windows are in " + zone + "; change it in Settings."));

      var rules = data.rules || [];
      var rows = {};
      WEEK.forEach(function (day) { rows[day.weekday] = []; });

      var grid = el("div", "grid2 rise");
      var dayLists = {};

      WEEK.forEach(function (day, index) {
        var card = rise(el("div", "card stack tight"), index);
        card.appendChild(el("p", "label", day.label));
        var list = el("div", "stack tight");
        card.appendChild(list);
        dayLists[day.weekday] = list;
        card.appendChild(append(el("div", "row"), [
          button("Add window", "btn sm ghost", function () { addWindow(day.weekday, 9 * 60, 17 * 60); })
        ]));
        grid.appendChild(card);
      });

      function addWindow(weekday, startMinute, endMinute) {
        var row = el("div", "row");
        var start = input("time", "start", "", minutesToClock(startMinute));
        var end = input("time", "end", "", minutesToClock(endMinute));
        var entry = { weekday: weekday, start: start, end: end, node: row };
        var remove = button("Remove", "btn sm ghost", function () {
          rows[weekday] = rows[weekday].filter(function (r) { return r !== entry; });
          if (row.parentNode) row.parentNode.removeChild(row);
        });
        append(row, [start, el("span", "small dim", "to"), end, remove]);
        rows[weekday].push(entry);
        dayLists[weekday].appendChild(row);
      }

      rules.forEach(function (rule) {
        var weekday = Number(rule.weekday);
        if (!(weekday in rows)) return;
        addWindow(weekday, Number(rule.start_minute), Number(rule.end_minute));
      });

      wrap.appendChild(grid);

      var line = el("p", "form-error");
      var save = button("Save the week", "btn primary", function () {
        line.textContent = "";
        var body = { rules: [] };
        var bad = false;
        WEEK.forEach(function (day) {
          rows[day.weekday].forEach(function (entry) {
            var startMinute = clockToMinutes(entry.start.value);
            var endMinute = clockToMinutes(entry.end.value);
            if (startMinute === null || endMinute === null || endMinute <= startMinute) { bad = true; return; }
            body.rules.push({ weekday: day.weekday, startMinute: startMinute, endMinute: endMinute, timezone: zone, active: true });
          });
        });
        if (bad) {
          line.textContent = "Every window needs a start before its end.";
          return;
        }
        busy(save, api("/admin/availability", { method: "PUT", body: body }))
          .then(function () { toast("The week is saved.", "good"); flare(); })
          .catch(function (error) {
            line.textContent = error.message;
            toast(error.message, "bad");
          });
      });
      wrap.appendChild(append(el("div", "row"), [save]));
      wrap.appendChild(line);

      /* ---------- time off ---------- */

      var blocksCard = el("div", "card stack tight");
      blocksCard.appendChild(el("p", "label", "Time off"));
      blocksCard.appendChild(el("p", "small dim", "Nothing can be booked inside these, whatever the week says."));
      var blockList = el("div", "list");
      blocksCard.appendChild(blockList);

      function drawBlocks(blocks) {
        clear(blockList);
        if (!blocks.length) {
          blockList.appendChild(el("div", "small dim", "Nothing booked out."));
          return;
        }
        blocks.forEach(function (block) {
          var row = el("div");
          var left = el("div", "grow");
          append(left, [
            el("div", "primary", fmtDate(block.starts_at) + " to " + fmtDate(block.ends_at)),
            el("div", "secondary", block.reason || "")
          ]);
          var remove = button("Remove", "btn sm ghost", function () {
            busy(remove, api("/admin/blocks/" + encodeURIComponent(block.id), { method: "DELETE" }))
              .then(function () { toast("Removed.", "good"); reloadBlocks(); })
              .catch(function (error) { toast(error.message, "bad"); });
          });
          append(row, [left, remove]);
          blockList.appendChild(row);
        });
      }

      function reloadBlocks() {
        return api("/admin/availability").then(function (fresh) {
          drawBlocks(fresh.blocks || []);
        }, function (error) { toast(error.message, "bad"); });
      }

      drawBlocks(data.blocks || []);

      var from = input("datetime-local", "startsAt", "");
      var to = input("datetime-local", "endsAt", "");
      var reason = input("text", "reason", "Why, for your own memory");
      var blockLine = el("p", "form-error");
      var addBlock = button("Book the time out", "btn", function () {
        blockLine.textContent = "";
        var startsAt = localToInstant(from.value);
        var endsAt = localToInstant(to.value);
        if (!startsAt || !endsAt) { blockLine.textContent = "A block needs a start and an end."; return; }
        busy(addBlock, api("/admin/blocks", { method: "POST", body: { startsAt: startsAt, endsAt: endsAt, reason: reason.value } }))
          .then(function () {
            toast("Booked out.", "good");
            flare();
            from.value = "";
            to.value = "";
            reason.value = "";
            return reloadBlocks();
          })
          .catch(function (error) {
            blockLine.textContent = error.message;
            toast(error.message, "bad");
          });
      });
      append(blocksCard, [
        field("From", from),
        field("To", to),
        field("Reason", reason),
        append(el("div", "row"), [addBlock]),
        blockLine
      ]);
      wrap.appendChild(blocksCard);

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
