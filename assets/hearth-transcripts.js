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
    wrap.appendChild(H.viewHead("Records", "A record of each session: summary, decisions and follow-ups."));

    var search = el("form", "row");
    var q = H.input("search", "q", "Search records and transcripts");
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
        if (!r.results.length) { results.appendChild(el("p", "small dim", "No results.")); return; }
        var card = el("div", "card pad0");
        var list = el("div", "list");
        r.results.forEach(function (x) {
          var row = el("a");
          row.href = H.BASE + "/transcripts/" + encodeURIComponent(x.id);
          row.addEventListener("click", function (ev) { ev.preventDefault(); H.navigate("/transcripts/" + encodeURIComponent(x.id)); });
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
        wrap.appendChild(H.empty("No records yet. A record appears here after each session's transcript is added."));
        return wrap;
      }
      var grid = el("div", "stack rise");
      data.transcripts.forEach(function (t, i) {
        var c = el("a", "card stack tight");
        c.href = H.BASE + "/transcripts/" + encodeURIComponent(t.id);
        c.style.setProperty("--i", String(Math.min(i, 8)));
        c.style.textDecoration = "none";
        c.addEventListener("click", function (ev) { ev.preventDefault(); H.navigate("/transcripts/" + encodeURIComponent(t.id)); });
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
  }, { perm: "transcripts.own", title: "Records", nav: { group: "Member", label: "Records", order: 2 } });

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

      var sheet = el("article", "sheet stack record");
      var kicker = el("p", "label", fmtHeld(t.heldAt) + (t.member && t.member.id !== H.state.user.id ? " · " + (t.member.name || t.member.email) : ""));
      sheet.appendChild(kicker);
      sheet.appendChild(el("h1", null, t.title || (d && d.title) || "Untitled session"));

      var linked = {};
      if (!d) {
        sheet.appendChild(el("p", "dim", t.status === "deriving" ? "The record is being written. Come back in a minute." : t.status === "failed" ? "The record could not be written this time; Elliot can try again." : "The transcript is here; the record has not been written yet."));
      } else if (d.version === 2) {
        linked = renderCrafted(sheet, t, d, data.followUps);
      } else {
        sheet.appendChild(el("p", null, d.summary));
        section(sheet, "Key points", d.keyPoints);
        section(sheet, "Decisions", d.decisions);
        section(sheet, "Try before next time", d.tryBeforeNext, true);
        section(sheet, "Questions for next time", d.questionsForNext);
        glossary(sheet, d.concepts);
      }
      wrap.appendChild(sheet);
      if (H.can("transcripts.manage")) wrap.appendChild(figureControl(t));
      if (H.state.user.role === "owner" && t.userId !== H.state.user.id) {
        var who = (t.member && (t.member.name || t.member.email)) || "the member";
        back.parentNode.appendChild(button("See this as " + who.split(" ")[0] + " sees it", "btn sm", function () {
          H.viewAs(t.userId, "/transcripts/" + encodeURIComponent(t.id)).catch(function (err) { H.toast(err.message, "bad"); });
        }));
      }

      // Follow-ups from this session that the record does not already show.
      var rest = data.followUps.filter(function (f) { return !linked[f.id] && !(d && d.version === 2 && f.owner === "coach"); });
      var fu = el("div", "card stack tight");
      fu.appendChild(el("p", "label", d && d.version === 2 ? "Anything else from this session" : "Follow-ups from this session"));
      if (!rest.length) fu.appendChild(el("p", "small dim", d && d.version === 2 ? "Add your own here." : "None recorded."));
      var list = el("div", "stack tight");
      rest.forEach(function (f) { list.appendChild(followUpRow(f)); });
      fu.appendChild(list);
      fu.appendChild(addFollowUpForm(t.userId, t.id, function (f) { list.appendChild(followUpRow(f)); }));
      wrap.appendChild(fu);

      // The transcript itself, folded by default.
      var raw = el("div", "card stack tight");
      var rawHead = el("div", "row between");
      var show = button("Show the transcript", "btn sm");
      append(rawHead, [el("p", "label", "The transcript, as recorded"), show]);
      raw.appendChild(rawHead);
      var pre = el("pre", "small transcript-raw");
      pre.textContent = t.raw || "";
      pre.hidden = true;
      raw.appendChild(pre);
      show.addEventListener("click", function () { pre.hidden = !pre.hidden; show.textContent = pre.hidden ? "Show the transcript" : "Hide the transcript"; });
      wrap.appendChild(raw);
      wrap.appendChild(el("p", "small faint", d && d.version === 2 ? "Written by Elliot from the transcript, with help from AI." : "This record was written from the transcript by AI and may contain mistakes."));
      return wrap;
    });
  }, { perm: "transcripts.own", title: "Record" });

  /* ---------- the crafted record (version 2) ---------- */

  // Big picture first: the short version, the picture, the ideas, then
  // what to do, what's next, and what to remember. Returns the ids of the
  // follow-ups the playbook already shows.
  function renderCrafted(sheet, t, d, followUps) {
    var byId = {};
    followUps.forEach(function (f) { byId[f.id] = f; });
    var alts = {};
    (t.figures || []).forEach(function (f) { alts[f.key] = f.alt; });
    var linked = {};

    if (d.short && d.short.length) {
      var short = el("div", "record-short stack tight");
      short.appendChild(el("p", "label", "The short version"));
      var ol = el("ol");
      d.short.forEach(function (line) { ol.appendChild(el("li", null, line)); });
      short.appendChild(ol);
      sheet.appendChild(short);
    }
    if (d.hero && alts[d.hero.figure] !== undefined) sheet.appendChild(figure(t, d.hero.figure, alts, d.hero.caption));
    if (d.summary) sheet.appendChild(el("p", "record-lede", d.summary));

    if (d.chapters && d.chapters.length) {
      sheet.appendChild(el("h2", "record-part", "The ideas"));
      d.chapters.forEach(function (c, i) {
        var ch = el("section", "record-chapter stack tight");
        ch.appendChild(el("p", "record-num", "Idea " + (i + 1) + " of " + d.chapters.length));
        ch.appendChild(el("h3", null, c.heading));
        (c.body || []).forEach(function (para) { ch.appendChild(el("p", null, para)); });
        if (c.figure && alts[c.figure] !== undefined) ch.appendChild(figure(t, c.figure, alts, c.caption));
        if (c.quote) {
          var q = el("blockquote", "record-quote");
          q.appendChild(el("p", null, "“" + c.quote.text + "”"));
          if (c.quote.who) q.appendChild(el("cite", null, c.quote.who));
          ch.appendChild(q);
        }
        sheet.appendChild(ch);
      });
    }

    if (d.actions && d.actions.length) {
      sheet.appendChild(el("h2", "record-part", "Your playbook"));
      d.actions.forEach(function (a) {
        var box = el("section", "record-action stack tight");
        var head = el("div", "record-action-head");
        var f = a.followUpId && byId[a.followUpId];
        if (f) { linked[f.id] = true; head.appendChild(tick(f)); }
        head.appendChild(el("h3", null, a.title));
        box.appendChild(head);
        if (a.why) box.appendChild(el("p", null, a.why));
        if (a.steps && a.steps.length) {
          var steps = el("ol", "record-steps");
          a.steps.forEach(function (s) { steps.appendChild(el("li", null, s)); });
          box.appendChild(steps);
        }
        if (a.prompt) box.appendChild(promptBlock(a.prompt));
        sheet.appendChild(box);
      });
    }

    var mine = followUps.filter(function (f) { return f.owner === "coach"; });
    if (mine.length) {
      sheet.appendChild(el("h2", null, "From Elliot"));
      var ul = el("ul", "record-plain");
      mine.forEach(function (f) {
        var li = el("li", f.doneAt ? "done" : null, f.text);
        if (f.doneAt) li.appendChild(el("span", "record-done", "done"));
        ul.appendChild(li);
      });
      sheet.appendChild(ul);
    }

    section(sheet, "Agreed", d.decisions);

    if (d.next || (d.questionsForNext && d.questionsForNext.length)) {
      sheet.appendChild(el("h2", null, "Next time" + (d.next && d.next.when ? ": " + d.next.when : "")));
      var plan = (d.next && d.next.plan) || [];
      if (plan.length) {
        var pl = el("ul", "record-plain");
        plan.forEach(function (p) { pl.appendChild(el("li", null, p)); });
        sheet.appendChild(pl);
      }
      if (d.questionsForNext && d.questionsForNext.length) {
        sheet.appendChild(el("p", "label", "Questions to bring"));
        var qs = el("ul", "record-plain");
        d.questionsForNext.forEach(function (p) { qs.appendChild(el("li", null, p)); });
        sheet.appendChild(qs);
      }
    }

    if (H.rememberSection) sheet.appendChild(H.rememberSection(t));
    glossary(sheet, d.concepts);
    return linked;
  }

  function figure(t, key, alts, caption) {
    var fig = el("figure", "record-visual");
    var img = el("img");
    img.src = "/api/hearth/transcripts/" + encodeURIComponent(t.id) + "/figures/" + encodeURIComponent(key);
    img.alt = alts[key] || "";
    img.decoding = "async";
    img.loading = "lazy";
    img.title = "Tap to enlarge";
    img.addEventListener("click", function () { zoom(img.src, img.alt); });
    fig.appendChild(img);
    if (caption) fig.appendChild(el("figcaption", null, caption));
    return fig;
  }

  // A picture at reading size, to pan and pinch on a phone.
  function zoom(src, alt) {
    var overlay = el("div", "fig-zoom");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Picture, enlarged");
    var close = button("Close", "btn sm fig-zoom-close");
    var big = el("img");
    big.src = src;
    big.alt = alt || "";
    var scroller = el("div", "fig-zoom-scroll");
    scroller.appendChild(big);
    append(overlay, [close, scroller]);
    function done() { document.removeEventListener("keydown", onKey); overlay.remove(); }
    function onKey(e) { if (e.key === "Escape") done(); }
    close.addEventListener("click", done);
    overlay.addEventListener("click", function (e) { if (e.target === overlay || e.target === scroller) done(); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    close.focus();
  }

  function tick(f) {
    var box = el("input");
    box.type = "checkbox";
    box.checked = Boolean(f.doneAt);
    box.setAttribute("aria-label", "Done");
    box.addEventListener("change", function () {
      box.disabled = true;
      api("/follow-ups/" + f.id, { method: "PATCH", body: { done: box.checked } }).then(function () {
        if (box.checked) H.flare();
        box.disabled = false;
      }).catch(function (err) { H.toast(err.message, "bad"); box.checked = !box.checked; box.disabled = false; });
    });
    return box;
  }

  function promptBlock(text) {
    var wrap = el("div", "record-prompt");
    var head = el("div", "row between");
    var copy = button("Copy", "btn sm");
    var pre = el("pre", null, text);
    copy.addEventListener("click", function () {
      function selectIt() {
        var range = document.createRange();
        range.selectNodeContents(pre);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { copy.textContent = "Copied"; setTimeout(function () { copy.textContent = "Copy"; }, 1600); }, selectIt);
      } else selectIt();
    });
    append(head, [el("p", "label", "Prompt to copy"), copy]);
    append(wrap, [head, pre]);
    return wrap;
  }

  function glossary(sheet, concepts) {
    if (!concepts || !concepts.length) return;
    sheet.appendChild(el("h2", null, "Words that came up"));
    var dl = el("dl", "record-glossary");
    concepts.forEach(function (c) { append(dl, [el("dt", null, c.term), el("dd", null, c.meaning)]); });
    sheet.appendChild(dl);
  }

  // The owner's view of a record's pictures. Claude sets them through MCP;
  // this is for checking and removing by hand.
  function figureControl(t) {
    var card = el("div", "card stack tight");
    card.appendChild(el("p", "label", "Pictures on this record"));
    if (!t.figures || !t.figures.length) card.appendChild(el("p", "small dim", "None yet. Claude adds them with set_record_figure."));
    (t.figures || []).forEach(function (f) {
      var row = el("div", "row between");
      row.appendChild(el("p", "small", f.key + (f.alt ? " · " + f.alt : "")));
      row.appendChild(button("Remove", "btn ghost sm", function () {
        var body = { figures: {} };
        body.figures[f.key] = null;
        api("/admin/transcripts/" + encodeURIComponent(t.id), { method: "PATCH", body: body })
          .then(function () { H.navigate("/transcripts/" + encodeURIComponent(t.id)); })
          .catch(function (err) { H.toast(err.message, "bad"); });
      }));
      card.appendChild(row);
    });
    return card;
  }

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
    wrap.appendChild(H.viewHead("Follow-ups", "Your follow-ups and Elliot's. Tick them off as they are done."));
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
      var m = block("Yours", mine, "No follow-ups.");
      m.card.appendChild(addFollowUpForm(null, null, function (f) { m.list.appendChild(followUpRow(f)); }));
      wrap.appendChild(m.card);
      wrap.appendChild(block("Elliot's", his, "No follow-ups from Elliot.").card);
      return wrap;
    });
  }, { perm: "transcripts.own", title: "Follow-ups", nav: { group: "Member", label: "Follow-ups", order: 3 } });

  /* ---------- notes for next time ---------- */

  H.register("/notes", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead("Notes", "Notes for Elliot to read before your next session."));
    var form = el("form", "card stack tight");
    var ta = el("textarea", "textarea");
    ta.placeholder = "What you want to cover next session";
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
        H.toast("Saved. Elliot will read it before the session.", "good");
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
  }, { perm: "sessions.own", title: "Notes", nav: { group: "Member", label: "Notes", order: 4 } });

  function noteRow(n) {
    var row = el("div");
    var text = el("div", "primary", n.text);
    text.style.whiteSpace = "pre-wrap";
    text.style.overflow = "visible";
    text.style.textOverflow = "clip";
    append(row, [append(el("div"), [text, el("div", "secondary", n.readAt ? "read by Elliot" : "unread")]), el("div", "meta", H.fmtDate(n.createdAt, { dateStyle: "medium" }))]);
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
