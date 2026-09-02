/* ==========================================================================
   The Hearth: the feed, what Elliot is looking at.

   Notes, links and briefs, written here and read here. A post carries a
   visibility (members, clients, public); the public ones get a dated
   address of their own once the public feed is switched on in Settings.

   Bodies are plain text: a blank line starts a new paragraph, and each
   paragraph reaches the page as its own <p> through textContent. Same
   rules as the core: no innerHTML, every value through textContent.
   ========================================================================== */

(function () {
  "use strict";

  var H = window.Hearth;
  if (!H) return;
  var el = H.el, append = H.append, button = H.button, api = H.api, pill = H.pill;

  var KINDS = [
    { value: "note", label: "Note" },
    { value: "link", label: "Link" },
    { value: "brief", label: "Brief" }
  ];

  var VISIBILITIES = [
    { value: "members", label: "Members" },
    { value: "clients", label: "Clients" },
    { value: "public", label: "Public" }
  ];

  var PUBLIC_HINT = "Public posts get a dated address at /feed/<slug> and appear in RSS and to agents, once the public feed is on in Settings";

  /* ---------- small shared pieces ---------- */

  function select(options, value) {
    var node = el("select", "select");
    options.forEach(function (opt) {
      var o = el("option", null, opt.label);
      o.value = opt.value;
      if (opt.value === value) o.selected = true;
      node.appendChild(o);
    });
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

  function postedAt(p) { return p.publishedAt || p.createdAt; }

  function fmtDay(iso) { return H.fmtDate(iso, { dateStyle: "medium" }); }

  // Plain text in, paragraphs out. Never markup.
  function paragraphs(parent, body) {
    String(body || "").split(/\n\s*\n/).forEach(function (chunk) {
      var text = chunk.trim();
      if (text) parent.appendChild(el("p", null, text));
    });
  }

  function visibilityPill(visibility) {
    if (visibility === "public") return pill("public", "owner");
    if (visibility === "clients") return pill("clients", "client");
    return pill("members");
  }

  function linkTo(url) {
    var a = el("a", "small", url);
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  }

  function publicAddress(slug) { return "https://chamainteligente.com/feed/" + slug; }

  /* ---------- the compose card, for a new post and for an edit ---------- */

  // post: null for a new post, the post itself for an edit.
  // opts: { feedPublic, onSaved, onCancel }
  function composeCard(post, opts) {
    var form = el("form", "card stack");
    var editing = Boolean(post);

    var title = H.input("text", "title", "A title", post ? post.title : "");
    var body = el("textarea", "textarea");
    body.name = "body";
    body.rows = 8;
    body.placeholder = "What is worth writing down?";
    body.value = post ? post.body || "" : "";
    var url = H.input("url", "url", "https://", post && post.url ? post.url : "");
    var kind = select(KINDS, post ? post.kind : "note");
    var visibility = select(VISIBILITIES, post ? post.visibility : "members");
    var pinned = toggle("Pinned", post ? post.pinned : false);

    var visField = H.field("Visibility", visibility, PUBLIC_HINT);
    if (opts.feedPublic === false) visField.appendChild(el("span", "hint", "The public feed is currently off."));

    append(form, [
      H.field("Title", title),
      H.field("Body", body, "Plain text. A blank line starts a new paragraph."),
      H.field("Link", url, "Optional."),
      H.field("Kind", kind),
      visField,
      pinned.node
    ]);

    var buttons = [];
    var row = el("div", "row");

    function send(publish, pressed) {
      var payload = {
        title: title.value,
        body: body.value,
        url: url.value.trim() || null,
        kind: kind.value,
        visibility: visibility.value,
        pinned: pinned.input.checked
      };
      if (publish !== null) payload.publish = publish;
      buttons.forEach(function (b) { b.disabled = true; });
      var request = editing
        ? api("/feed/" + encodeURIComponent(post.id), { method: "PATCH", body: payload })
        : api("/feed", { method: "POST", body: payload });
      request.then(function () {
        H.flare();
        opts.onSaved();
      }).catch(function (err) {
        H.toast(err.message, "bad");
        buttons.forEach(function (b) { b.disabled = false; });
        if (pressed) pressed.focus();
      });
    }

    if (editing) {
      var save = button("Save", "btn primary");
      save.type = "submit";
      var flip = button(post.publishedAt ? "Unpublish" : "Publish", "btn", function () { send(!post.publishedAt, flip); });
      var cancel = button("Cancel", "btn ghost", function () { opts.onCancel(); });
      buttons = [save, flip, cancel];
      append(row, buttons);
      form.addEventListener("submit", function (e) { e.preventDefault(); send(null, save); });
    } else {
      var postIt = button("Post", "btn primary");
      postIt.type = "submit";
      var draft = button("Save draft", "btn", function () { send(false, draft); });
      var close = opts.onCancel ? button("Cancel", "btn ghost", function () { opts.onCancel(); }) : null;
      buttons = close ? [postIt, draft, close] : [postIt, draft];
      append(row, buttons);
      form.addEventListener("submit", function (e) { e.preventDefault(); send(true, postIt); });
    }

    form.appendChild(row);
    return form;
  }

  /* ---------- the feed ---------- */

  H.register("/feed", function () {
    var wrap = el("div", "stack");
    var canWrite = false;
    var feedPublic = null;
    var nextBefore = null;
    var composeHost = el("div");
    var list = el("div", "stack rise");
    var moreRow = el("div", "row");
    var emptyHost = el("div");

    function load(before) {
      var path = "/feed?limit=20" + (before ? "&before=" + encodeURIComponent(before) : "");
      return api(path);
    }

    function refresh() {
      return load(null).then(function (data) {
        canWrite = data.canWrite;
        feedPublic = data.feedPublic;
        nextBefore = data.nextBefore;
        H.clear(list);
        H.clear(emptyHost);
        data.posts.forEach(function (p, i) { list.appendChild(postCard(p, i)); });
        if (!data.posts.length) emptyHost.appendChild(H.empty("Nothing here yet."));
        drawMore();
      });
    }

    function drawMore() {
      H.clear(moreRow);
      if (!nextBefore) return;
      var more = button("Load more", "btn", function () {
        more.disabled = true;
        load(nextBefore).then(function (data) {
          nextBefore = data.nextBefore;
          var from = list.childNodes.length;
          data.posts.forEach(function (p, i) { list.appendChild(postCard(p, from + i)); });
          drawMore();
        }).catch(function (err) { H.toast(err.message, "bad"); more.disabled = false; });
      });
      moreRow.appendChild(more);
    }

    function postCard(p, i) {
      var card = el("article", "card stack tight");
      card.style.setProperty("--i", String(Math.min(i, 8)));
      draw();

      function draw() {
        H.clear(card);
        var kicker = el("div", "row");
        kicker.appendChild(el("p", "label", fmtDay(postedAt(p))));
        kicker.appendChild(visibilityPill(p.visibility));
        if (p.pinned) kicker.appendChild(pill("pinned"));
        if (!p.publishedAt) kicker.appendChild(pill("draft", "bad"));
        card.appendChild(kicker);
        card.appendChild(el("h2", null, p.title));
        paragraphs(card, p.body);
        if (p.url) card.appendChild(append(el("div"), [linkTo(p.url)]));
        if (!canWrite) return;
        var actions = el("div", "row");
        append(actions, [
          button("Edit", "btn ghost sm", edit),
          button("Delete", "btn ghost sm", remove)
        ]);
        card.appendChild(actions);
      }

      function edit() {
        H.clear(card);
        card.appendChild(composeCard(p, {
          feedPublic: feedPublic,
          onSaved: function () { refresh().catch(function (err) { H.toast(err.message, "bad"); }); },
          onCancel: draw
        }));
      }

      function remove() {
        if (!window.confirm("Delete this post? It goes for good.")) return;
        var buttons = card.querySelectorAll("button");
        for (var b = 0; b < buttons.length; b += 1) buttons[b].disabled = true;
        api("/feed/" + encodeURIComponent(p.id), { method: "DELETE" }).then(function () {
          refresh().catch(function (err) { H.toast(err.message, "bad"); });
        }).catch(function (err) {
          H.toast(err.message, "bad");
          for (var c = 0; c < buttons.length; c += 1) buttons[c].disabled = false;
        });
      }

      return card;
    }

    return refresh().then(function () {
      var actions = null;
      if (canWrite) {
        var write = button("Write", "btn primary", function () {
          if (composeHost.firstChild) { H.clear(composeHost); write.textContent = "Write"; return; }
          write.textContent = "Close";
          composeHost.appendChild(composeCard(null, {
            feedPublic: feedPublic,
            onSaved: function () {
              H.clear(composeHost);
              write.textContent = "Write";
              refresh().catch(function (err) { H.toast(err.message, "bad"); });
            },
            onCancel: function () { H.clear(composeHost); write.textContent = "Write"; }
          }));
        });
        actions = [write];
      }
      wrap.appendChild(H.viewHead("What Elliot is looking at", "Notes, links and briefs as they happen. Your agent can read this too.", actions));
      wrap.appendChild(composeHost);
      wrap.appendChild(emptyHost);
      wrap.appendChild(list);
      wrap.appendChild(moreRow);
      return wrap;
    });
  }, { perm: "feed.read", title: "Feed", nav: { group: "Room", label: "Feed", order: 6 } });

  /* ---------- one post, on paper ---------- */

  H.register("/feed/:id", function (ctx) {
    return api("/feed/" + encodeURIComponent(ctx.params.id)).then(function (data) {
      var p = data.post;
      var wrap = el("div", "stack");
      wrap.appendChild(append(el("div", "row"), [
        button("Back to the feed", "btn ghost sm", function () { H.navigate("/feed"); })
      ]));

      var sheet = el("article", "sheet stack");
      var kicker = el("div", "row");
      kicker.appendChild(el("p", "label", fmtDay(postedAt(p))));
      kicker.appendChild(visibilityPill(p.visibility));
      if (p.pinned) kicker.appendChild(pill("pinned"));
      if (!p.publishedAt) kicker.appendChild(pill("draft", "bad"));
      sheet.appendChild(kicker);
      sheet.appendChild(el("h1", null, p.title));
      paragraphs(sheet, p.body);
      if (p.url) sheet.appendChild(append(el("div"), [linkTo(p.url)]));

      if (p.visibility === "public") {
        var address = publicAddress(p.slug);
        var row = el("div", "row");
        var copy = button("Copy", "btn sm", function () {
          if (navigator.clipboard) navigator.clipboard.writeText(address).then(function () { H.toast("Copied.", "good"); });
        });
        append(row, [el("p", "small faint", address), copy]);
        sheet.appendChild(row);
      }

      wrap.appendChild(sheet);
      return wrap;
    });
  }, { perm: "feed.read", title: "Post" });

  /* ---------- home ---------- */

  H.onHome(function (tile, wrap) {
    if (!H.can("feed.read")) return;
    return api("/feed?limit=3").then(function (data) {
      if (!data.posts.length) return;
      var card = el("div", "card stack tight mt");
      card.appendChild(el("p", "label", "Latest from Elliot"));
      data.posts.slice(0, 3).forEach(function (p) {
        var row = el("a", "row between");
        row.href = H.BASE + "/feed/" + p.id;
        row.style.textDecoration = "none";
        row.addEventListener("click", function (e) { e.preventDefault(); H.navigate("/feed/" + p.id); });
        append(row, [el("span", "small", p.title), el("span", "small faint", fmtDay(postedAt(p)))]);
        card.appendChild(row);
      });
      wrap.appendChild(card);
    }).catch(function () {});
  });
})();
