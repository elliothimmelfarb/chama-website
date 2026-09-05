/* ==========================================================================
   The Hearth: ask the flame about your own sessions.

   The same flame that burns on the homepage, here in a member's own room,
   with only that member's records and transcripts as context. The answer is
   streamed back over server-sent events from POST /ask; the records it reads
   are data to it, never instructions, and nothing asked here leaves the room.

   Same rules as the core: no innerHTML, every value through textContent.
   ========================================================================== */

(function () {
  "use strict";

  var H = window.Hearth;
  if (!H) return;
  var el = H.el, append = H.append, button = H.button, api = H.api;

  var API = "/api/hearth";
  var GENERIC = "The flame could not answer just now. Try again in a minute.";
  var SUGGESTIONS = [
    "What did we decide last time?",
    "What was I going to try before next time?",
    "What has come up about my team?"
  ];

  H.register("/ask", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead(
      "Ask the flame about your sessions",
      "Ask questions about your sessions. Answers come from your own records and transcripts."
    ));

    return api("/ask/status").then(function (status) {
      if (!status || !status.records) {
        wrap.appendChild(H.empty("No records yet. You can ask questions here after your first session."));
        return wrap;
      }
      if (!status.ready) {
        wrap.appendChild(H.empty("The flame is resting. Try again later."));
        return wrap;
      }
      wrap.appendChild(chat());
      return wrap;
    });
  }, { perm: "transcripts.own", title: "Ask", nav: { group: "Member", label: "Ask the flame", order: 2 } });

  /* ---------- the conversation ---------- */

  function chat() {
    var box = el("div", "stack");

    // What has been said, kept here and sent back with each question.
    var history = [];
    var streaming = false;

    var card = el("div", "card stack");
    card.style.minHeight = "14rem";
    card.style.maxHeight = "62vh";
    card.style.overflowY = "auto";
    card.style.scrollBehavior = "smooth";
    var turns = el("div", "stack");
    card.appendChild(turns);

    var opening = el("p", "small dim", "Ask about anything you and Elliot have discussed.");
    turns.appendChild(opening);

    // The three ways in, shown only while nothing has been said.
    var hints = el("div", "row");
    hints.style.gap = "0.4rem";
    SUGGESTIONS.forEach(function (text) {
      hints.appendChild(button(text, "btn ghost sm", function () {
        if (streaming) return;
        ta.value = text;
        send();
      }));
    });

    var form = el("form", "stack tight");
    var ta = el("textarea", "textarea");
    ta.placeholder = "Ask about your sessions";
    ta.rows = 2;
    ta.maxLength = 4000;
    ta.style.minHeight = "3.6rem";
    var go = button("Send", "btn primary");
    go.type = "submit";
    var actions = el("div", "row between");
    append(actions, [el("p", "small faint", "Enter sends. Shift and Enter for a new line."), go]);
    append(form, [ta, actions]);

    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      send();
    });

    append(box, [card, hints, form, el("p", "small faint", "Answers come only from your own records and transcripts. Your questions are not shared.")]);

    /* ---------- turns ---------- */

    function scroll() { card.scrollTop = card.scrollHeight; }

    function userTurn(text) {
      var row = el("div");
      row.style.display = "flex";
      row.style.justifyContent = "flex-end";
      var bubble = el("p", "small", text);
      bubble.style.whiteSpace = "pre-wrap";
      bubble.style.background = "var(--surface-2)";
      bubble.style.border = "1px solid var(--line)";
      bubble.style.borderRadius = "0.9rem 0.9rem 0.2rem 0.9rem";
      bubble.style.padding = "0.55rem 0.8rem";
      bubble.style.maxWidth = "min(38rem, 82%)";
      row.appendChild(bubble);
      turns.appendChild(row);
      return row;
    }

    function flameTurn() {
      var row = el("div");
      row.style.display = "flex";
      row.style.gap = "0.55rem";
      row.style.alignItems = "flex-start";
      var m = H.mark("mark");
      m.style.width = "1rem";
      m.style.height = "1rem";
      m.style.flex = "0 0 auto";
      m.style.marginTop = "0.2rem";
      m.style.opacity = "0.85";
      var body = el("div", "grow");
      var p = el("p", null, "");
      p.style.whiteSpace = "pre-wrap";
      p.style.maxWidth = "62ch";
      body.appendChild(p);
      append(row, [m, body]);
      turns.appendChild(row);
      return { row: row, body: body, text: p };
    }

    function waiting(turn) {
      var p = el("p", "small faint", "Reading your records...");
      turn.body.appendChild(p);
      return p;
    }

    /* ---------- asking ---------- */

    function setBusy(on) {
      streaming = on;
      go.disabled = on;
      ta.disabled = on;
      hints.hidden = on || history.length > 0;
    }

    function send() {
      if (streaming) return;
      var question = ta.value.trim();
      if (!question) return;
      ta.value = "";
      if (opening.parentNode) opening.parentNode.removeChild(opening);
      userTurn(question);
      var sent = history.slice(-8);
      history.push({ role: "user", content: question });
      setBusy(true);
      scroll();

      var turn = flameTurn();
      var note = waiting(turn);
      var answer = "";
      var flared = false;
      var failed = false;
      scroll();

      function first() {
        if (note && note.parentNode) { note.parentNode.removeChild(note); note = null; }
        if (!flared) { flared = true; H.flare(); }
      }

      function fail(message) {
        failed = true;
        if (note && note.parentNode) { note.parentNode.removeChild(note); note = null; }
        turn.body.appendChild(el("p", "form-error", message || GENERIC));
        if (!answer) turn.text.remove();
        scroll();
      }

      function handle(event) {
        if (!event || typeof event !== "object") return;
        if (event.type === "delta" && typeof event.text === "string") {
          first();
          answer += event.text;
          turn.text.textContent = answer;
          scroll();
        } else if (event.type === "error") {
          fail(event.message);
        }
      }

      fetch(API + "/ask", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ question: question, history: sent })
      }).then(function (response) {
        if (!response.ok) {
          return response.json().then(function (data) {
            throw new Error((data && data.error) || GENERIC);
          }, function () {
            throw new Error(GENERIC);
          });
        }
        if (!response.body) throw new Error(GENERIC);

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";

        function drain(final) {
          var parts = buffer.split(/\r?\n\r?\n/);
          buffer = final ? "" : parts.pop();
          for (var i = 0; i < parts.length; i += 1) {
            var lines = parts[i].split(/\r?\n/);
            for (var j = 0; j < lines.length; j += 1) {
              var line = lines[j];
              if (line.indexOf("data:") !== 0) continue;
              var raw = line.slice(5).trim();
              if (!raw) continue;
              try { handle(JSON.parse(raw)); } catch (e) { /* a partial frame, wait for the rest */ }
            }
          }
        }

        function pump() {
          return reader.read().then(function (chunk) {
            if (chunk.done) {
              buffer += decoder.decode();
              drain(true);
              return;
            }
            buffer += decoder.decode(chunk.value, { stream: true });
            drain(false);
            return pump();
          });
        }

        return pump();
      }).then(function () {
        if (answer) history.push({ role: "assistant", content: answer });
        else if (!failed) fail(GENERIC);
        setBusy(false);
        ta.focus();
        scroll();
      }).catch(function (err) {
        H.toast(err && err.message ? err.message : GENERIC, "bad");
        if (!failed) fail(err && err.message ? err.message : GENERIC);
        setBusy(false);
      });
    }

    setBusy(false);
    return box;
  }
})();
