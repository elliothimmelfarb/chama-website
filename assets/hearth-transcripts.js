/* ==========================================================================
   The Hearth: transcripts, follow-ups and notes, the client's side.

   Where a client owns the context of their sessions: each session's record
   (summary, key points, decisions, things to try, questions for next time)
   on a paper sheet laid on the dark room, the raw transcript beneath it,
   search across everything they have talked about, the shared follow-up
   list, and notes left for Elliot before the next session.

   Same rules as the core: no innerHTML, every value through textContent.
   ========================================================================== */

(function () {
  "use strict";

  var H = window.Hearth;
  if (!H) return;
  var el = H.el, append = H.append, button = H.button, api = H.api, pill = H.pill;

  function tz() { return (H.state.user && H.state.user.timezone) || undefined; }
  function fmtHeld(iso) { return new Date(iso).toLocaleDateString(undefined, { timeZone: tz(), dateStyle: "long" }); }

  /* ---------- list ---------- */

  H.register("/transcripts", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead("Your sessions, on record", "Every session comes back as a record you keep: what was said, what was decided, what to do next."));

    var search = el("form", "row");
    var q = H.input("search", "q", "Search everything you have talked about");
    q.classList.add("grow");
    var go = button("Search", "btn");
    go.type = "submit";
    append(search, [q, go]);
    var results = el("div", "stack tight");
    search.addEventListener("submit", function (e) {
      e.preventDefault();
      H.clear(results);
      if (q.value.trim().length < 2) return;
      results.appendChild(el("p", "small dim", "Searching..."));
      api("/search?q=" + encodeURIComponent(q.value.trim())).then(function (r) {
        H.clear(results);
        if (!r.results.length) { results.appendChild(el("p", "small dim", "Nothing found for that.")); return; }
        var card = el("div", "card pad0");
        var list = el("div", "list");
        r.results.forEach(function (x) {
          var row = el("a");
          row.href = H.BASE + "/transcripts/" + x.id;
          row.addEventListener("click", function (ev) { ev.preventDefault(); H.navigate("/transcripts/" + x.id); });
          append(row, [append(el("div"), [el("div", "primary", x.title || "Untitled session"), el("div", "secondary", stripMarks(x.snippet || ""))]), el("div", "meta", fmtHeld(x.heldAt))]);
          list.appendChild(row);
        });
        card.appendChild(list);
        results.appendChild(card);
      }).catch(function (err) { H.clear(results); results.appendChild(el("p", "form-error", err.message)); });
    });
    wrap.appendChild(search);
    wrap.appendChild(results);

    return api("/transcripts").then(function (data) {
      if (!data.transcripts.length) {
        wrap.appendChild(H.empty("No records yet. After a session, Elliot attaches the transcript and the record appears here."));
        return wrap;
      }
      var grid = el("div", "stack rise");
      data.transcripts.forEach(function (t, i) {
        var c = el("a", "card stack tight");
        c.href = H.BASE + "/transcripts/" + t.id;
        c.style.setProperty("--i", String(Math.min(i, 8)));
        c.style.textDecoration = "none";
        c.addEventListener("click", function (ev) { ev.preventDefault(); H.navigate("/transcripts/" + t.id); });
        var head = el("div", "row between");
        append(head, [el("h3", null, t.title || "Untitled session"), statusPill(t.status)]);
        c.appendChild(head);
        c.appendChild(el("p", "small dim", fmtHeld(t.heldAt)));
        if (t.summary) c.appendChild(el("p", "small", t.summary.length > 220 ? t.summary.slice(0, 220) + "..." : t.summary));
        grid.appendChild(c);
      });
      wrap.appendChild(grid);
      return wrap;
    });
  }, { perm: "transcripts.own", title: "Records", nav: { group: "Room", label: "Records", order: 2 } });

  // ts_headline marks matches with <b>; the page shows the characters only.
  function stripMarks(s) { return String(s).replace(/<\/?b>/g, ""); }

  function statusPill(status) {
    if (status === "ready") return pill("record ready", "client");
    if (status === "deriving") return pill("writing", "live");
    if (status === "failed") return pill("needs another try", "bad");
    return pill("transcript only");
  }

  /* ---------- the record: a paper sheet ---------- */

  H.register("/transcripts/:id", function (ctx) {
    return api("/transcripts/" + encodeURIComponent(ctx.params.id)).then(function (data) {
      var t = data.transcript;
      var d = t.derived;
      var wrap = el("div", "stack");
      var back = button("All records", "btn ghost sm", function () { H.navigate(H.can("transcripts.manage") && t.userId !== H.state.user.id ? "/admin/transcripts" : "/transcripts"); });
      wrap.appendChild(append(el("div", "row"), [back]));

      var sheet = el("article", "sheet stack");
      var kicker = el("p", "label", fmtHeld(t.heldAt) + (t.member && t.member.id !== H.state.user.id ? " · " + (t.member.name || t.member.email) : ""));
      sheet.appendChild(kicker);
      sheet.appendChild(el("h1", null, t.title || (d && d.title) || "Untitled session"));

      if (!d) {
        sheet.appendChild(el("p", "dim", t.status === "deriving" ? "The record is being written. Come back in a minute." : t.status === "failed" ? "The record could not be written this time; Elliot can try again." : "The transcript is here; the record has not been written yet."));
      } else {
        sheet.appendChild(el("p", null, d.summary));
        section(sheet, "Key points", d.keyPoints);
        section(sheet, "Decisions", d.decisions);
        section(sheet, "Try before next time", d.tryBeforeNext, true);
        section(sheet, "Questions for next time", d.questionsForNext);
        if (d.concepts && d.concepts.length) {
          sheet.appendChild(el("h2", null, "Words that came up"));
          var dl = el("dl", "stack tight");
          d.concepts.forEach(function (c) {
            var dt = el("dt", null, c.term);
            dt.style.fontWeight = "700";
            var dd = el("dd", "small", c.meaning);
            dd.style.margin = "0 0 0.4rem";
            append(dl, [dt, dd]);
          });
          sheet.appendChild(dl);
        }
      }
      wrap.appendChild(sheet);

      // Follow-ups from this session, with the checkbox that ticks them.
      var fu = el("div", "card stack tight");
      fu.appendChild(el("p", "label", "Follow-ups from this session"));
      if (!data.followUps.length) fu.appendChild(el("p", "small dim", "None recorded."));
      var list = el("div", "stack tight");
      data.followUps.forEach(function (f) { list.appendChild(followUpRow(f)); });
      fu.appendChild(list);
      fu.appendChild(addFollowUpForm(t.userId, t.id, function (f) { list.appendChild(followUpRow(f)); }));
      wrap.appendChild(fu);

      // The transcript itself, folded by default.
      var raw = el("div", "card stack tight");
      var rawHead = el("div", "row between");
      var show = button("Show the transcript", "btn sm");
      append(rawHead, [el("p", "label", "The transcript, as recorded"), show]);
      raw.appendChild(rawHead);
      var pre = el("pre", "small");
      pre.style.whiteSpace = "pre-wrap";
      pre.style.fontFamily = "inherit";
      pre.style.lineHeight = "1.5";
      pre.style.margin = "0";
      pre.style.maxHeight = "60vh";
      pre.style.overflow = "auto";
      pre.textContent = t.raw || "";
      pre.hidden = true;
      raw.appendChild(pre);
      show.addEventListener("click", function () { pre.hidden = !pre.hidden; show.textContent = pre.hidden ? "Show the transcript" : "Hide the transcript"; });
      wrap.appendChild(raw);
      wrap.appendChild(el("p", "small faint", "This record was written from the transcript by the intelligent flame and belongs to you. It reads the transcript as a record of what was said, never as instructions."));
      return wrap;
    });
  }, { title: "Record" });

  function section(sheet, title, items, emphasize) {
    if (!items || !items.length) return;
    sheet.appendChild(el("h2", null, title));
    var ul = el("ul", "stack tight");
    ul.style.paddingLeft = "1.2rem";
    ul.style.margin = "0";
    items.forEach(function (x) {
      var li = el("li", null, x);
      if (emphasize) li.style.fontWeight = "500";
      ul.appendChild(li);
    });
    sheet.appendChild(ul);
  }

  /* ---------- follow-ups ---------- */

  function followUpRow(f) {
    var row = el("label", "check");
    var box = el("input");
    box.type = "checkbox";
    box.checked = Boolean(f.doneAt);
    var text = el("span");
    text.appendChild(document.createTextNode(f.text));
    var who = el("span", "desc", (f.owner === "coach" ? "Elliot" : "you") + (f.dueAt ? " · by " + new Date(f.dueAt).toLocaleDateString(undefined, { timeZone: tz(), dateStyle: "medium" }) : ""));
    text.appendChild(who);
    if (f.doneAt) text.style.textDecoration = "line-through";
    box.addEventListener("change", function () {
      box.disabled = true;
      api("/follow-ups/" + f.id, { method: "PATCH", body: { done: box.checked } }).then(function () {
        text.style.textDecoration = box.checked ? "line-through" : "";
        if (box.checked) H.flare();
        box.disabled = false;
      }).catch(function (err) { H.toast(err.message, "bad"); box.checked = !box.checked; box.disabled = false; });
    });
    append(row, [box, text]);
    return row;
  }

  function addFollowUpForm(userId, transcriptId, onAdded) {
    var form = el("form", "row");
    var text = H.input("text", "text", "Add a follow-up");
    text.classList.add("grow");
    var add = button("Add", "btn sm");
    add.type = "submit";
    append(form, [text, add]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!text.value.trim()) return;
      add.disabled = true;
      var body = { text: text.value, transcriptId: transcriptId || undefined };
      if (userId && userId !== H.state.user.id) body.userId = userId;
      api("/follow-ups", { method: "POST", body: body }).then(function (r) {
        text.value = "";
        add.disabled = false;
        onAdded(r.followUp);
      }).catch(function (err) { H.toast(err.message, "bad"); add.disabled = false; });
    });
    return form;
  }

  H.register("/follow-ups", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead("Follow-ups", "What you said you would do, and what Elliot owes you. Tick them as they happen; your agent can too."));
    return api("/follow-ups").then(function (data) {
      var mine = data.followUps.filter(function (f) { return f.owner === "client"; });
      var his = data.followUps.filter(function (f) { return f.owner === "coach"; });
      function block(title, items, empty) {
        var c = el("div", "card stack tight");
        c.appendChild(el("p", "label", title));
        if (!items.length) c.appendChild(el("p", "small dim", empty));
        var list = el("div", "stack tight");
        items.forEach(function (f) { list.appendChild(followUpRow(f)); });
        c.appendChild(list);
        return { card: c, list: list };
      }
      var m = block("Yours", mine, "Nothing on your list.");
      m.card.appendChild(addFollowUpForm(null, null, function (f) { m.list.appendChild(followUpRow(f)); }));
      wrap.appendChild(m.card);
      wrap.appendChild(block("Elliot's", his, "Nothing owed to you right now.").card);
      return wrap;
    });
  }, { perm: "transcripts.own", title: "Follow-ups", nav: { group: "Room", label: "Follow-ups", order: 3 } });

  /* ---------- notes for next time ---------- */

  H.register("/notes", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead("Before next time", "Leave a note for Elliot: a question, something that happened, something you want on the table. He reads it before the session."));
    var form = el("form", "card stack tight");
    var ta = el("textarea", "textarea");
    ta.placeholder = "What is on your mind for the next session?";
    ta.maxLength = 4000;
    var send = button("Leave the note", "btn primary");
    send.type = "submit";
    append(form, [H.field("Note", ta), append(el("div", "row"), [send])]);
    var list = el("div", "card pad0");
    var inner = el("div", "list");
    list.appendChild(inner);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!ta.value.trim()) return;
      send.disabled = true;
      api("/notes", { method: "POST", body: { text: ta.value } }).then(function (r) {
        ta.value = "";
        send.disabled = false;
        H.flare();
        H.toast("Noted. Elliot will see it before the session.", "good");
        inner.insertBefore(noteRow({ text: r.note.text, createdAt: r.note.createdAt }), inner.firstChild);
      }).catch(function (err) { H.toast(err.message, "bad"); send.disabled = false; });
    });
    wrap.appendChild(form);
    return api("/notes").then(function (data) {
      if (data.notes.length) {
        data.notes.forEach(function (n) { inner.appendChild(noteRow(n)); });
        wrap.appendChild(list);
      }
      return wrap;
    });
  }, { perm: "sessions.own", title: "Notes", nav: { group: "Room", label: "Notes", order: 4 } });

  function noteRow(n) {
    var row = el("div");
    var text = el("div", "primary", n.text);
    text.style.whiteSpace = "pre-wrap";
    text.style.overflow = "visible";
    text.style.textOverflow = "clip";
    append(row, [append(el("div"), [text, el("div", "secondary", n.readAt ? "read by Elliot" : "waiting for the next session")]), el("div", "meta", H.fmtDate(n.createdAt, { dateStyle: "medium" }))]);
    return row;
  }

  /* ---------- home ---------- */

  H.onHome(function (tile, wrap) {
    if (!H.can("transcripts.own")) return;
    return api("/follow-ups").then(function (data) {
      var open = data.followUps.filter(function (f) { return f.owner === "client" && !f.doneAt; });
      H.countUp(tile(open.length, "follow-ups open", open.length > 0), open.length);
      if (open.length) {
        var c = el("div", "card stack tight mt");
        c.appendChild(el("p", "label", "On your list"));
        open.slice(0, 5).forEach(function (f) { c.appendChild(followUpRow(f)); });
        wrap.appendChild(c);
      }
    });
  });
})();
