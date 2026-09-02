/* ==========================================================================
   The Hearth, the owner's side of transcripts: attaching the raw record of a
   session, watching the model write it up, and reading what clients leave
   between sessions.

   Loaded after hearth.js, and speaking to the room the same way: window.Hearth
   for the routes, the wire and the DOM helpers, and only classes that already
   exist in hearth.css. The client's own view of a transcript lives in
   hearth-transcripts.js; this file only registers the owner's two rooms.

   The same hard rule holds here as everywhere on this domain: everything the
   API returns is data. It reaches the page through textContent or through
   attributes set from code. There is no innerHTML in this file, which matters
   most in the notes list, where a member's note is their text and nothing
   else, and in the transcript list, where a title came out of a model reading
   a stranger's words.
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

  var DAY = 86400000;

  // What the file input will take, and what the server calls a transcript
  // file rather than a paste.
  var FILE_TYPES = ".txt,.vtt,.srt,.md";

  /* ---------- small shared pieces ---------- */

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

  function check(labelText, checked) {
    var wrap = el("label", "check");
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

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function chars(n) {
    var value = Number(n);
    if (!isFinite(value) || value < 0) return "";
    try {
      return new Intl.NumberFormat().format(value) + " characters";
    } catch (e) {
      return value + " characters";
    }
  }

  // A datetime-local value is a wall clock with no zone, so the browser's
  // zone is what it means. One place converts each way.
  function localToInstant(value) {
    if (!value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function instantToLocal(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function statusPill(status) {
    var kinds = { ready: "client", deriving: "live", failed: "bad" };
    var labels = { ready: "ready", deriving: "writing", failed: "failed", new: "new" };
    return pill(labels[status] || status || "new", kinds[status] || "");
  }

  /* ---------- the member picker ---------- */

  // An email search that waits a quarter of a second after the last
  // keystroke and offers what it found as buttons. It needs members.read;
  // where that is missing the picker falls back to a plain id field rather
  // than pretending the search is empty. onPick hears every change, with the
  // member or with null when the choice is cleared.
  function memberPicker(labelText, placeholder, onPick) {
    var wrap = el("div", "stack tight");
    var search = input("search", "member", placeholder || "Search name or email");
    var results = el("div", "row");
    var chosen = el("div", "row");
    var picked = null;
    var timer = null;
    var searchable = can("members.read");

    var idInput = input("text", "userId", "Member id");
    idInput.hidden = true;

    // The id field is a fallback, so it speaks up when it is finished rather
    // than on every keystroke: a pasted id should not fire a search of its own.
    function tell() { if (onPick) onPick(picked); }

    function tellTyped() {
      if (!onPick || picked) return;
      var typed = idInput.value.trim();
      onPick(typed ? { id: typed } : null);
    }

    function drawChosen() {
      clear(chosen);
      if (!picked) return;
      chosen.appendChild(el("p", "small dim", memberName(picked) + (picked.email ? " (" + picked.email + ")" : "")));
      chosen.appendChild(button("Clear", "btn ghost sm", function () {
        picked = null;
        drawChosen();
        tell();
      }));
    }

    function choose(member) {
      picked = member;
      clear(results);
      search.value = "";
      drawChosen();
      tell();
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
      append(wrap, [field(labelText || "Member", search), results, chosen, idInput]);
      idInput.addEventListener("change", tellTyped);
    } else {
      idInput.hidden = false;
      wrap.appendChild(field((labelText || "Member") + " id", idInput, "Searching members needs the members permission; paste their id from their member page."));
      idInput.addEventListener("change", tellTyped);
    }

    return {
      node: wrap,
      userId: function () {
        if (picked) return picked.id;
        return idInput.value.trim();
      },
      member: function () { return picked; },
      reset: function () {
        picked = null;
        idInput.value = "";
        search.value = "";
        clear(results);
        drawChosen();
      }
    };
  }

  /* ---------- the owner's transcripts ---------- */

  H.register("/admin/transcripts", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead("Transcripts", "The raw record of a session goes in here; the model writes it up and both sides read it."));

    /* ---------- adding one ---------- */

    var addCard = el("div", "card stack tight");
    addCard.appendChild(el("p", "label", "Add a transcript"));
    addCard.appendChild(el("p", "small dim", "Paste the transcript or pick the file the call left behind. Writing the record takes a minute and the member is told when it is ready."));

    var sessionSelect = el("select", "select");
    var sessionField = field("Session", sessionSelect, "Only sessions in the last 90 days that have no transcript yet.");
    sessionField.hidden = true;
    var bookingsById = {};

    var heldAt = input("datetime-local", "heldAt", "");
    var titleInput = input("text", "title", "What the session was about, if you want to name it yourself");
    var text = textarea("", 10);
    text.placeholder = "Paste the transcript here.";
    var file = el("input", "input");
    file.type = "file";
    file.accept = FILE_TYPES;
    var filename = "";
    var fileLine = el("p", "small dim");
    var derive = toggle("Derive the record now", true);
    var line = el("p", "form-error");
    var working = el("p", "small dim");
    working.hidden = true;

    text.addEventListener("input", function () {
      // Typed over: it is a paste again, whatever the file was called.
      if (filename) { filename = ""; fileLine.textContent = ""; file.value = ""; }
    });

    file.addEventListener("change", function () {
      var chosen = file.files && file.files[0];
      if (!chosen) { filename = ""; fileLine.textContent = ""; return; }
      var reader = new FileReader();
      reader.onload = function () {
        filename = chosen.name;
        text.value = String(reader.result || "");
        fileLine.textContent = "Read " + chosen.name + " · " + chars(text.value.length) + ".";
      };
      reader.onerror = function () {
        filename = "";
        fileLine.textContent = "";
        toast("That file could not be read. Paste the text instead.", "bad");
      };
      reader.readAsText(chosen);
    });

    var picker = memberPicker("Member", "Search name or email", function (member) {
      clear(sessionSelect);
      bookingsById = {};
      sessionField.hidden = true;
      if (!member || !member.id) return;
      loadSessions(member.id);
    });

    function loadSessions(userId) {
      if (!can("sessions.manage")) return;
      var now = Date.now();
      var path = "/admin/bookings?member=" + encodeURIComponent(userId) +
        "&from=" + encodeURIComponent(new Date(now - 90 * DAY).toISOString()) +
        "&to=" + encodeURIComponent(new Date(now + DAY).toISOString());
      api(path).then(function (data) {
        var free = (data.bookings || []).filter(function (b) { return !b.transcriptId; });
        clear(sessionSelect);
        bookingsById = {};
        var none = el("option", null, "(no session)");
        none.value = "";
        sessionSelect.appendChild(none);
        free.forEach(function (booking) {
          bookingsById[booking.id] = booking;
          var label = fmtDate(booking.startsAt, { dateStyle: "medium", timeStyle: "short" });
          if (booking.title) label += " · " + booking.title;
          var option = el("option", null, label);
          option.value = booking.id;
          sessionSelect.appendChild(option);
        });
        sessionField.hidden = false;
      }, function () {
        // No calendar to offer: the held-at field alone is enough.
        sessionField.hidden = true;
      });
    }

    sessionSelect.addEventListener("change", function () {
      var booking = bookingsById[sessionSelect.value];
      if (booking) {
        heldAt.value = instantToLocal(booking.startsAt);
        if (!titleInput.value && booking.title) titleInput.value = booking.title;
      }
    });

    var send = button("Add the transcript", "btn primary", function () {
      line.textContent = "";
      var userId = picker.userId();
      var body = text.value;
      if (!userId) { line.textContent = "Pick a member first."; return; }
      if (!body.trim()) { line.textContent = "Paste the transcript, or pick the file."; return; }
      var payload = {
        userId: userId,
        bookingId: sessionSelect.value || null,
        heldAt: localToInstant(heldAt.value),
        title: titleInput.value,
        text: body,
        filename: filename,
        derive: derive.input.checked
      };
      working.hidden = !derive.input.checked;
      working.textContent = "Writing the record, this takes a minute";
      busy(send, api("/admin/transcripts", { method: "POST", body: payload }))
        .then(function (data) {
          working.hidden = true;
          toast("The transcript is in.", "good");
          flare();
          var id = data && data.transcript && data.transcript.id;
          picker.reset();
          text.value = "";
          titleInput.value = "";
          heldAt.value = "";
          file.value = "";
          filename = "";
          fileLine.textContent = "";
          if (id) H.navigate("/transcripts/" + encodeURIComponent(id));
          else load();
        })
        .catch(function (error) {
          working.hidden = true;
          line.textContent = error.message;
          toast(error.message, "bad");
        });
    });

    append(addCard, [
      picker.node,
      sessionField,
      field("Held at", heldAt, "Your own clock, converted on the way out."),
      field("Title", titleInput),
      field("Transcript", text),
      field("Or a file", file, "A .txt, .vtt, .srt or .md file, read here in your browser."),
      fileLine,
      derive.node,
      append(el("div", "row"), [send]),
      working,
      line
    ]);
    wrap.appendChild(addCard);

    /* ---------- the list ---------- */

    var filterCard = el("div", "card stack tight");
    filterCard.appendChild(el("p", "label", "Filter"));
    var memberId = "";
    var filter = memberPicker("Member", "Anyone", function (member) {
      memberId = member && member.id ? member.id : "";
      load();
    });
    filterCard.appendChild(filter.node);
    wrap.appendChild(filterCard);

    var listCard = el("div", "card pad0");
    wrap.appendChild(listCard);

    function row(transcript) {
      var node = el("div");
      node.style.cursor = "pointer";
      var left = el("div", "grow");
      append(left, [
        el("div", "primary", transcript.title || "Untitled session"),
        el("div", "secondary", memberName(transcript.member) + " · " + fmtDate(transcript.heldAt, { dateStyle: "medium" })),
        el("div", "secondary faint", chars(transcript.chars))
      ]);

      var right = el("div", "row");
      right.appendChild(statusPill(transcript.status));

      var again = button("Derive again", "btn sm ghost", function (event) {
        stop(event);
        if (!window.confirm("Write the record again? What the model said last time is replaced.")) return;
        busy(again, api("/admin/transcripts/" + encodeURIComponent(transcript.id) + "/derive", { method: "POST" }))
          .then(function () { toast("The record is rewritten.", "good"); flare(); load(); })
          .catch(function (error) { toast(error.message, "bad"); });
      });
      var remove = button("Delete", "btn sm danger", function (event) {
        stop(event);
        if (!window.confirm("Delete this transcript? The raw text and its record go with it.")) return;
        busy(remove, api("/admin/transcripts/" + encodeURIComponent(transcript.id), { method: "DELETE" }))
          .then(function () { toast("Gone.", "good"); load(); })
          .catch(function (error) { toast(error.message, "bad"); });
      });
      append(right, [again, remove]);

      append(node, [left, right]);
      node.addEventListener("click", function () { H.navigate("/transcripts/" + encodeURIComponent(transcript.id)); });
      return node;
    }

    function draw(transcripts) {
      clear(listCard);
      if (!transcripts.length) {
        listCard.appendChild(H.empty("No transcripts yet. Add the first one above."));
        return;
      }
      var list = el("div", "list");
      transcripts.forEach(function (transcript) { list.appendChild(row(transcript)); });
      listCard.appendChild(list);
    }

    function load() {
      var path = "/transcripts" + (memberId ? "?member=" + encodeURIComponent(memberId) : "");
      return api(path).then(function (data) {
        draw(data.transcripts || []);
      }, function (error) {
        clear(listCard);
        listCard.appendChild(H.empty(error.message));
      });
    }

    return load().then(function () { return wrap; });
  }, { perm: "transcripts.manage", title: "Transcripts", nav: { group: "Business", label: "Transcripts", order: 14 } });

  /* ---------- notes and what Elliot owes ---------- */

  H.register("/admin/notes", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead("Notes", "What clients leave for the next session, and the follow-ups that are yours."));

    /* ---------- follow-ups the coach owes ---------- */

    var owedCard = el("div", "card stack tight");
    owedCard.appendChild(el("p", "label", "Follow-ups you owe"));
    var owedList = el("div", "list");
    owedCard.appendChild(owedList);
    wrap.appendChild(owedCard);

    function drawOwed(followUps) {
      clear(owedList);
      var mine = followUps.filter(function (f) { return f.owner === "coach" && !f.doneAt; });
      if (!mine.length) {
        owedList.appendChild(el("div", "small dim", "Nothing owed. Every follow-up of yours is done."));
        return;
      }
      mine.forEach(function (followUp) {
        var node = el("div");
        var left = el("div", "grow");
        append(left, [
          el("div", "secondary", memberName(followUp.member)),
          el("p", "small", followUp.text || ""),
          el("div", "secondary faint", followUp.dueAt ? "due " + fmtDate(followUp.dueAt, { dateStyle: "medium" }) : "no date")
        ]);
        var done = check("Done", false);
        done.input.addEventListener("change", function () {
          if (!done.input.checked) { done.input.checked = false; return; }
          done.input.disabled = true;
          api("/follow-ups/" + encodeURIComponent(followUp.id), { method: "PATCH", body: { done: true } })
            .then(function () {
              toast("Done.", "good");
              flare();
              loadOwed();
            })
            .catch(function (error) {
              done.input.disabled = false;
              done.input.checked = false;
              toast(error.message, "bad");
            });
        });
        append(node, [left, done.node]);
        owedList.appendChild(node);
      });
    }

    function loadOwed() {
      return api("/follow-ups").then(function (data) {
        drawOwed(data.followUps || []);
      }, function (error) {
        clear(owedList);
        owedList.appendChild(el("div", "small dim", error.message));
      });
    }

    /* ---------- the notes themselves ---------- */

    var filterCard = el("div", "card stack tight");
    filterCard.appendChild(el("p", "label", "Filter"));
    var memberId = "";
    var filter = memberPicker("Member", "Anyone", function (member) {
      memberId = member && member.id ? member.id : "";
      loadNotes();
    });
    filterCard.appendChild(filter.node);
    wrap.appendChild(filterCard);

    var listCard = el("div", "card pad0");
    wrap.appendChild(listCard);

    function noteRow(note, index) {
      var node = rise(el("div"), index);
      var left = el("div", "grow");
      append(left, [
        el("div", "secondary", memberName(note.member) + " · " + fmtDate(note.createdAt, { dateStyle: "medium", timeStyle: "short" })),
        el("p", "small", note.text || "")
      ]);
      var right = el("div", "row");
      if (note.readAt) {
        right.appendChild(pill("read", "client"));
      } else {
        var mark = button("Mark read", "btn sm", function () {
          busy(mark, api("/admin/notes/" + encodeURIComponent(note.id) + "/read", { method: "POST" }))
            .then(function () { toast("Marked read.", "good"); loadNotes(); })
            .catch(function (error) { toast(error.message, "bad"); });
        });
        right.appendChild(mark);
      }
      append(node, [left, right]);
      return node;
    }

    function drawNotes(notes) {
      clear(listCard);
      if (!notes.length) {
        listCard.appendChild(H.empty("No notes yet. Clients leave them before a session."));
        return;
      }
      var list = el("div", "list");
      notes.forEach(function (note, index) { list.appendChild(noteRow(note, index)); });
      listCard.appendChild(list);
    }

    function loadNotes() {
      var path = "/notes" + (memberId ? "?member=" + encodeURIComponent(memberId) : "");
      return api(path).then(function (data) {
        drawNotes(data.notes || []);
      }, function (error) {
        clear(listCard);
        listCard.appendChild(H.empty(error.message));
      });
    }

    return Promise.all([loadNotes(), loadOwed()]).then(function () { return wrap; });
  }, { perm: "transcripts.manage", title: "Notes", nav: { group: "Business", label: "Notes", order: 15 } });

  /* ---------- one tile on the home view ---------- */

  // Whoever reads the notes sees the unread ones without leaving home. A
  // failure here adds nothing and says nothing.
  H.onHome(function (tile) {
    if (!can("transcripts.manage")) return null;
    return api("/notes").then(function (data) {
      var n = (data.notes || []).filter(function (note) { return !note.readAt; }).length;
      H.countUp(tile(0, "unread notes", true), n);
    }).catch(function () { /* the home view is fine without it */ });
  });
})();
