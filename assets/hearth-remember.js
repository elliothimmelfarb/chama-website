/* ==========================================================================
   The Hearth: Remember, spaced repetition for what came up in a session.

   Each record can carry a few cards. A card comes back after 1, 3, 7, 16
   and 35 days; "Got it" climbs a step, "Fuzzy" holds, "Missed it" starts
   over. The cards show on their record, on the Remember page, and as a
   count on Home.

   Same rules as the core: no innerHTML, every value through textContent.
   ========================================================================== */

(function () {
  "use strict";

  var H = window.Hearth;
  if (!H) return;
  var el = H.el, append = H.append, button = H.button, api = H.api;

  var KIND = { recall: "Recall", apply: "Apply", words: "In your words" };

  function when(card) {
    if (card.retired) return "learned";
    var ms = new Date(card.dueAt).getTime() - Date.now();
    if (ms <= 0) return "due now";
    var days = Math.ceil(ms / 86400000);
    return days === 1 ? "back tomorrow" : "back in " + days + " days";
  }

  // One card at a time: the question, then the answer, then how it went.
  function reviewer(cards, onDone) {
    var box = el("div", "flash stack");
    var i = 0;
    function show() {
      H.clear(box);
      var c = cards[i];
      if (!c) {
        append(box, [el("p", "flash-tag", "Done"), el("p", "flash-q", "That's everything due."), el("p", "small flash-from", "Each card comes back when it is closest to being forgotten.")]);
        if (onDone) onDone();
        return;
      }
      var tag = el("p", "flash-tag");
      append(tag, [el("span", null, KIND[c.kind] || "Recall"), el("span", null, (i + 1) + " of " + cards.length)]);
      var q = el("p", "flash-q", c.front);
      var a = el("p", "flash-a", c.back);
      a.hidden = true;
      var from = el("p", "small flash-from", c.recordTitle ? "From " + c.recordTitle : "");
      var reveal = el("div", "row");
      reveal.appendChild(button("Show the answer", "btn primary sm", function () { a.hidden = false; reveal.hidden = true; rate.hidden = false; }));
      var rate = el("div", "row");
      rate.hidden = true;
      [["again", "Missed it", "btn sm"], ["hard", "Fuzzy", "btn sm"], ["good", "Got it", "btn primary sm"]].forEach(function (r) {
        rate.appendChild(button(r[1], r[2], function () {
          Array.prototype.forEach.call(rate.querySelectorAll("button"), function (b) { b.disabled = true; });
          api("/cards/" + encodeURIComponent(c.id) + "/review", { method: "POST", body: { result: r[0] } }).then(function (res) {
            if (res.card && res.card.retired) H.flare();
            i += 1;
            show();
          }).catch(function (err) {
            H.toast(err.message, "bad");
            Array.prototype.forEach.call(rate.querySelectorAll("button"), function (b) { b.disabled = false; });
          });
        }));
      });
      append(box, [tag, q, a, from, reveal, rate]);
    }
    show();
    return box;
  }

  // The Remember block on a record. The member reviews; the owner reads.
  H.rememberSection = function (t) {
    var block = el("section", "record-remember stack tight");
    block.appendChild(el("p", "label", "Remember"));
    var body = el("div", "stack tight");
    body.appendChild(el("p", "small", "Loading the cards..."));
    block.appendChild(body);
    var isMine = t.userId === H.state.user.id;
    api("/cards?record=" + encodeURIComponent(t.id)).then(function (data) {
      H.clear(body);
      if (!data.cards.length) { block.hidden = true; return; }
      var due = data.cards.filter(function (c) { return !c.retired && new Date(c.dueAt).getTime() <= Date.now(); });
      body.appendChild(el("p", "small", data.cards.length + " cards from this session. Each comes back after 1, 3, 7, 16 and 35 days, so it sticks."));
      var list = el("ul", "remember-list");
      data.cards.forEach(function (c) {
        var li = el("li");
        append(li, [el("span", null, c.front), el("span", "remember-when", isMine ? when(c) : (KIND[c.kind] || "Recall"))]);
        if (!isMine) li.appendChild(el("span", "remember-back", c.back));
        list.appendChild(li);
      });
      body.appendChild(list);
      if (isMine && due.length) {
        body.appendChild(button("Review the " + due.length + " due now", "btn primary sm", function () {
          H.clear(body);
          body.appendChild(reviewer(due.map(function (c) { return Object.assign({}, c, { recordTitle: "" }); })));
        }));
      } else if (isMine) {
        var next = data.cards.filter(function (c) { return !c.retired; }).sort(function (a, b) { return new Date(a.dueAt) - new Date(b.dueAt); })[0];
        if (next) body.appendChild(el("p", "small", "The first ones come back " + when(next).replace("back ", "") + "."));
      }
    }).catch(function () { block.hidden = true; });
    return block;
  };

  /* ---------- the Remember page ---------- */

  H.register("/remember", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(H.viewHead("Remember", "Cards from your sessions, each back just before you would forget it."));
    return api("/cards/due").then(function (data) {
      if (!data.cards.length) {
        wrap.appendChild(H.empty("Nothing due right now. Cards from your sessions come back after 1, 3, 7, 16 and 35 days."));
        return wrap;
      }
      var sheet = el("div", "sheet");
      sheet.appendChild(reviewer(data.cards));
      wrap.appendChild(sheet);
      return wrap;
    });
  }, { perm: "transcripts.own", title: "Remember", nav: { group: "Member", label: "Remember", order: 2.5 } });

  /* ---------- home ---------- */

  H.onHome(function (tile, wrap) {
    if (!H.can("transcripts.own")) return;
    return api("/cards/due").then(function (data) {
      var n = data.cards.length;
      H.countUp(tile(n, n === 1 ? "card to review" : "cards to review", n > 0), n);
      if (n) {
        var c = H.link("", H.BASE + "/remember", "card stack tight mt");
        c.addEventListener("click", function (e) { e.preventDefault(); H.navigate("/remember"); });
        append(c, [el("p", "label", "Remember"), el("p", "small dim", n + (n === 1 ? " card is" : " cards are") + " due from your sessions. About a minute.")]);
        wrap.appendChild(c);
      }
    });
  });

})();
