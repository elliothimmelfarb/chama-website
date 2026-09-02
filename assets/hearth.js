/* ==========================================================================
   The Hearth: the members' room of Chama Inteligente, at /hearth.

   One vanilla app, no libraries, no build step. This file is the core: the
   API client, the router, the gate, the frame with the fire in it, and the
   views every member has (home, account, security). Other parts of the
   room register their own views through window.Hearth.register from their
   own files (hearth-admin.js, and later sessions, transcripts, agents,
   feed), which keeps each area in one place and this file small.

   The hard rule, same as the flame admin: everything the API returns is
   data. It reaches the page only through textContent or attributes set
   from code. There is no innerHTML in this file and no HTML is ever
   assembled from a value.
   ========================================================================== */

(function () {
  "use strict";

  var API = "/api/hearth";
  var BASE = "/hearth";
  var GIS_SRC = "https://accounts.google.com/gsi/client";
  var MARK_PATHS = [
    "M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z",
    "M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57.0 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z"
  ];

  var state = {
    root: null,
    mast: null,
    nav: null,
    view: null,
    user: null,
    role: null,
    permissions: {},
    config: null,
    settings: null,
    fire: null,
    gisLoaded: false,
    renderId: 0
  };

  /* ---------- DOM helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, String(attrs[k])); });
    return node;
  }

  function mark(className) {
    var node = svg("svg", { viewBox: "0 0 64 64", "aria-hidden": "true" });
    node.setAttribute("class", className || "mark");
    var g = svg("g", { transform: "translate(2.0612 0.0639)", fill: "var(--ember)" });
    MARK_PATHS.forEach(function (d) { g.appendChild(svg("path", { d: d })); });
    node.appendChild(g);
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function append(parent, children) {
    children.forEach(function (c) { if (c) parent.appendChild(c); });
    return parent;
  }

  function button(label, className, onClick) {
    var node = el("button", className || "btn", label);
    node.type = "button";
    if (onClick) node.addEventListener("click", onClick);
    return node;
  }

  function link(label, href, className) {
    var node = el("a", className, label);
    node.href = href;
    return node;
  }

  function field(labelText, input, hint) {
    var wrap = el("label", "field");
    wrap.appendChild(el("span", null, labelText));
    wrap.appendChild(input);
    if (hint) wrap.appendChild(el("span", "hint", hint));
    return wrap;
  }

  function input(type, name, placeholder, value) {
    var node = el("input", "input");
    node.type = type;
    node.name = name;
    if (placeholder) node.placeholder = placeholder;
    if (value !== undefined && value !== null) node.value = value;
    if (type === "email") { node.autocomplete = "email"; node.autocapitalize = "none"; node.spellcheck = false; }
    return node;
  }

  function pill(text, kind) {
    return el("span", "pill" + (kind ? " " + kind : ""), text);
  }

  function avatar(user, size) {
    var node = el("span", "avatar" + (size ? " " + size : ""));
    if (user && user.avatarUrl) {
      var img = el("img");
      img.src = user.avatarUrl;
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      node.appendChild(img);
    } else {
      node.textContent = initials(user);
    }
    return node;
  }

  function initials(user) {
    var source = (user && (user.name || user.email)) || "?";
    var parts = source.trim().split(/[\s@._-]+/).filter(Boolean);
    var out = parts.slice(0, 2).map(function (p) { return p[0]; }).join("");
    return out.toUpperCase() || "?";
  }

  /* ---------- formatting ---------- */

  function fmtDate(iso, opts) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, opts || { dateStyle: "medium", timeStyle: "short" });
  }

  function fmtRelative(iso) {
    if (!iso) return "";
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + " min ago";
    if (diff < 86400) return Math.floor(diff / 3600) + " h ago";
    if (diff < 86400 * 14) return Math.floor(diff / 86400) + " d ago";
    return fmtDate(iso, { dateStyle: "medium" });
  }

  function countUp(node, target, ms) {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(target) || target < 2) { node.textContent = String(target); return; }
    var start = performance.now();
    var dur = ms || 700;
    function tick(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      node.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- API ---------- */

  function api(path, options) {
    var opts = options || {};
    var init = {
      method: opts.method || "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    };
    if (opts.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    return fetch(API + path, init).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (response.status === 401 && state.user && !opts.quiet) {
          state.user = null;
          render();
        }
        if (!response.ok) {
          var error = new Error(body && body.error ? body.error : "Something went wrong.");
          error.status = response.status;
          error.body = body;
          throw error;
        }
        return body;
      });
    });
  }

  /* ---------- toasts ---------- */

  var toastHost = null;

  function toast(message, kind) {
    if (!toastHost) {
      toastHost = el("div", "toasts");
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    var node = el("div", "toast" + (kind ? " " + kind : ""), message);
    toastHost.appendChild(node);
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 4200);
  }

  /* ---------- permissions ---------- */

  function can(key) { return Boolean(state.permissions[key]); }

  /* ---------- the fire ---------- */

  // The homepage's particle engine, burning low behind the masthead. It is
  // only decoration here, so any failure leaves a plain dark bar.
  function mountFire(container) {
    if (!window.ChamaFlame || state.fire) return;
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    var canvas = el("canvas");
    container.appendChild(canvas);
    var engine;
    try {
      engine = window.ChamaFlame.create({
        canvas: canvas,
        touchDevice: "ontouchstart" in window,
        reduceMotion: false,
        settings: { brightness: 0.55, motion: 0.8, hue: 20, size: 0.55, speed: 0.9, turbulence: 0.45, density: 0.7, angle: 0, sparkle: 0.35, position: { x: 0.12, y: 1.0 } },
        emit: function () {}
      });
    } catch (e) {
      return;
    }
    function size() {
      var r = container.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      engine.resize(Math.max(1, r.width), Math.max(1, r.height), dpr);
    }
    size();
    engine.start();
    window.addEventListener("resize", size);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) engine.stop(); else engine.start();
    });
    state.fire = engine;
  }

  // Something good happened: the fire notices.
  function flare() {
    if (state.fire && state.fire.flicker) {
      try { state.fire.flicker(); } catch (e) { /* decoration only */ }
    }
  }

  /* ---------- router ---------- */

  var routes = [];
  var navGroups = [];

  function matchPath(pattern, path) {
    var p = pattern.split("/").filter(Boolean);
    var s = path.split("/").filter(Boolean);
    if (p.length !== s.length) return null;
    var params = {};
    for (var i = 0; i < p.length; i += 1) {
      if (p[i][0] === ":") params[p[i].slice(1)] = decodeURIComponent(s[i]);
      else if (p[i] !== s[i]) return null;
    }
    return params;
  }

  // register(pattern, view, options): pattern is relative to /hearth, view is
  // a function (ctx) returning a node or a promise of one. options.perm gates
  // it; options.nav = { group, label, order } adds it to the navigation.
  function register(pattern, view, options) {
    var opts = options || {};
    routes.push({ pattern: pattern, view: view, perm: opts.perm || null, title: opts.title || "" });
    if (opts.nav) {
      var group = navGroups.filter(function (g) { return g.name === opts.nav.group; })[0];
      if (!group) { group = { name: opts.nav.group, items: [] }; navGroups.push(group); }
      group.items.push({ href: BASE + (pattern === "/" ? "" : pattern), label: opts.nav.label, perm: opts.perm || null, order: opts.nav.order || 0 });
    }
  }

  function currentPath() {
    var path = location.pathname;
    if (path.indexOf(BASE) === 0) path = path.slice(BASE.length);
    return path || "/";
  }

  function navigate(to, replace) {
    var href = to.indexOf("/") === 0 ? to : BASE + "/" + to;
    if (href.indexOf(BASE) !== 0) href = BASE + href;
    if (replace) history.replaceState(null, "", href); else history.pushState(null, "", href);
    render();
  }

  function query() {
    var out = {};
    new URLSearchParams(location.search).forEach(function (v, k) { out[k] = v; });
    return out;
  }

  /* ---------- the frame ---------- */

  function renderFrame() {
    var root = state.root;
    clear(root);

    var mast = el("header", "hh-mast");
    var inner = el("div", "frame hh-mast-inner");
    var fire = el("div", "hh-fire");
    fire.setAttribute("aria-hidden", "true");
    inner.appendChild(fire);

    var brand = link("", BASE, "hh-brand");
    brand.setAttribute("aria-label", "Hearth home");
    append(brand, [mark("mark"), el("span", "word", "Hearth"), el("span", "sub", "Chama Inteligente")]);
    brand.addEventListener("click", function (e) { e.preventDefault(); navigate("/"); });
    inner.appendChild(brand);

    var title = el("div", "hh-mast-title", "");
    inner.appendChild(title);

    var who = el("button", "hh-who");
    who.type = "button";
    who.setAttribute("aria-label", "Your account");
    append(who, [el("span", "name", state.user.name || state.user.email), avatar(state.user)]);
    who.addEventListener("click", function () { navigate("/account"); });
    inner.appendChild(who);

    mast.appendChild(inner);
    root.appendChild(mast);
    state.mast = title;
    mountFire(fire);

    var body = el("div", "frame hh-body");
    var nav = el("nav", "hh-nav");
    nav.setAttribute("aria-label", "Rooms");
    body.appendChild(nav);
    var view = el("main", "hh-view");
    view.id = "hearth-view";
    body.appendChild(view);
    root.appendChild(body);
    state.nav = nav;
    state.view = view;
    renderNav();
  }

  function renderNav() {
    var nav = state.nav;
    if (!nav) return;
    clear(nav);
    var path = currentPath();
    navGroups.forEach(function (group) {
      var items = group.items.filter(function (i) { return !i.perm || can(i.perm); });
      if (!items.length) return;
      items.sort(function (a, b) { return a.order - b.order; });
      var wrap = el("div", "hh-nav-group");
      wrap.appendChild(el("p", "label", group.name));
      items.forEach(function (item) {
        var a = link(item.label, item.href);
        var rel = item.href.slice(BASE.length) || "/";
        var active = rel === "/" ? path === "/" : path.indexOf(rel) === 0;
        if (active) a.setAttribute("aria-current", "page");
        a.addEventListener("click", function (e) { e.preventDefault(); navigate(rel); });
        wrap.appendChild(a);
      });
      nav.appendChild(wrap);
    });
  }

  /* ---------- rendering a view ---------- */

  function render() {
    if (!state.user) { renderGate(); return; }
    if (!state.view) renderFrame();
    renderNav();
    var path = currentPath();
    var id = ++state.renderId;
    var found = null;
    var params = null;
    for (var i = 0; i < routes.length; i += 1) {
      params = matchPath(routes[i].pattern, path);
      if (params) { found = routes[i]; break; }
    }
    var host = state.view;
    clear(host);
    if (!found) { host.appendChild(notFound()); return; }
    if (found.perm && !can(found.perm)) { host.appendChild(forbidden()); return; }
    state.mast.textContent = found.title || "";
    document.title = (found.title ? found.title + " | " : "") + "Hearth | Chama Inteligente";
    var ctx = { params: params, query: query(), user: state.user };
    var result;
    try { result = found.view(ctx); } catch (e) { host.appendChild(errorView(e)); return; }
    Promise.resolve(result).then(function (node) {
      if (id !== state.renderId) return;
      clear(host);
      if (node) { node.classList.add("view"); host.appendChild(node); }
      window.scrollTo(0, 0);
    }).catch(function (e) {
      if (id !== state.renderId) return;
      clear(host);
      host.appendChild(errorView(e));
    });
  }

  function notFound() {
    var wrap = el("div", "view empty");
    wrap.appendChild(mark("mark"));
    wrap.appendChild(el("p", null, "There is no room here."));
    var back = button("Back to the Hearth", "btn mt", function () { navigate("/"); });
    wrap.appendChild(back);
    return wrap;
  }

  function forbidden() {
    var wrap = el("div", "view empty");
    wrap.appendChild(mark("mark"));
    wrap.appendChild(el("p", null, "That room is not open to you."));
    return wrap;
  }

  function errorView(e) {
    var wrap = el("div", "view empty");
    wrap.appendChild(el("p", null, e && e.message ? e.message : "Something went wrong."));
    return wrap;
  }

  function viewHead(title, lede, actions) {
    var head = el("div", "view-head");
    var left = el("div");
    left.appendChild(el("h1", null, title));
    if (lede) left.appendChild(el("p", "lede", lede));
    head.appendChild(left);
    if (actions) head.appendChild(append(el("div", "row"), actions));
    return head;
  }

  function empty(text, action) {
    var wrap = el("div", "empty");
    wrap.appendChild(mark("mark"));
    wrap.appendChild(el("p", null, text));
    if (action) wrap.appendChild(action);
    return wrap;
  }

  /* ---------- the gate ---------- */

  function renderGate() {
    var root = state.root;
    clear(root);
    state.view = null;
    state.nav = null;

    var mast = el("header", "hh-mast");
    var inner = el("div", "frame hh-mast-inner");
    var fire = el("div", "hh-fire");
    fire.setAttribute("aria-hidden", "true");
    inner.appendChild(fire);
    var brand = link("", "/", "hh-brand");
    append(brand, [mark("mark"), el("span", "word", "Chama Inteligente")]);
    inner.appendChild(brand);
    inner.appendChild(el("div"));
    inner.appendChild(el("div"));
    mast.appendChild(inner);
    root.appendChild(mast);
    mountFire(fire);

    var gate = el("div", "gate");
    var card = el("div", "gate-card rise");
    var i = 0;
    function add(node) { node.style.setProperty("--i", String(i++)); card.appendChild(node); }

    var q = query();
    var path = currentPath();

    if (path === "/reset" && q.token) { resetGate(card, add, q.token); gate.appendChild(card); root.appendChild(gate); return; }

    add(mark("mark"));
    var h = el("h1", null, "The Hearth");
    add(h);
    add(el("p", "dim", "The members' room of Chama Inteligente. Your sessions, your transcripts, your agents, and what Elliot is looking at."));

    if (q.error) {
      var reasons = {
        signin: "That sign-in did not go through. Try again, or another way in.",
        link: "That link has already been used or has expired. Ask for a new one.",
        suspended: "This account is not active. Write to contact@chamainteligente.com."
      };
      add(el("p", "form-error", reasons[q.error] || "Something went wrong signing in."));
    }

    var ways = el("div", "gate-ways");
    var providers = (state.config && state.config.providers) || {};
    var ref = q.ref || readRef();
    if (q.ref) rememberRef(q.ref);
    var next = q.next || "";

    if (providers.google) {
      var slot = el("div", "gsi-slot");
      ways.appendChild(slot);
      mountGoogle(slot, providers.google, ref, next);
    }
    if (providers.github) ways.appendChild(providerButton("Continue with GitHub", "github", ref, next));
    if (providers.discord) ways.appendChild(providerButton("Continue with Discord", "discord", ref, next));
    add(ways);

    if (providers.google || providers.github || providers.discord) add(el("div", "or", "or with email"));

    var form = el("form", "stack tight");
    var email = input("email", "email", "you@example.com");
    email.required = true;
    var password = input("password", "password", "Password");
    password.autocomplete = "current-password";
    var usePassword = false;
    var pwField = field("Password", password);
    pwField.hidden = true;
    var submit = button("Email me a sign-in link", "btn primary wide");
    submit.type = "submit";
    var status = el("p", "small dim");
    var toggle = button("I have a password", "btn ghost sm", function () {
      usePassword = !usePassword;
      pwField.hidden = !usePassword;
      submit.textContent = usePassword ? "Sign in" : "Email me a sign-in link";
      toggle.textContent = usePassword ? "Email me a link instead" : "I have a password";
      if (usePassword) password.focus();
    });
    var forgot = button("Forgot it?", "btn ghost sm", function () {
      if (!email.value) { email.focus(); return; }
      api("/auth/password/forgot", { method: "POST", body: { email: email.value } }).then(function () {
        status.textContent = "If that address has a password, a reset link is on its way.";
      }).catch(function (e) { status.textContent = e.message; });
    });
    append(form, [field("Email", email), pwField, submit, append(el("div", "row"), [toggle, forgot]), status]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit.disabled = true;
      status.textContent = "";
      status.className = "small dim";
      var req = usePassword
        ? api("/auth/password", { method: "POST", body: { email: email.value, password: password.value, next: next } })
        : api("/auth/email/start", { method: "POST", body: { email: email.value, ref: ref, next: next } });
      req.then(function (result) {
        if (usePassword) { afterSignIn(result); return; }
        clear(card);
        var sent = el("div", "gate-sent");
        append(sent, [mark("mark"), el("h2", null, "Check your email"), el("p", "dim", "A sign-in link is on its way to " + email.value + ". It works once and expires in 15 minutes."), button("Use another way", "btn ghost", function () { renderGate(); })]);
        card.appendChild(sent);
      }).catch(function (err) {
        status.textContent = err.message;
        status.className = "small form-error";
        submit.disabled = false;
      });
    });
    add(form);

    var fine = el("p", "fineprint");
    fine.appendChild(document.createTextNode("Signing in creates a place for you if you do not have one yet. Sessions, transcripts and sign-ins are recorded so you can see them; nothing here is sold or shared. "));
    fine.appendChild(link("Privacy", "/privacy"));
    fine.appendChild(document.createTextNode(" · "));
    fine.appendChild(link("Back to the site", "/"));
    add(fine);

    gate.appendChild(card);
    root.appendChild(gate);
  }

  function providerButton(label, provider, ref, next) {
    var url = API + "/auth/" + provider + "?ref=" + encodeURIComponent(ref || "") + "&next=" + encodeURIComponent(next || "");
    var a = link(label, url, "btn wide");
    return a;
  }

  function afterSignIn(result) {
    var to = result && result.to ? result.to : BASE;
    location.assign(to);
  }

  // Google Identity Services: the one external script on the domain, and
  // only here. The library renders its own button into the slot.
  function mountGoogle(slot, clientId, ref, next) {
    function renderButton() {
      if (!window.google || !window.google.accounts) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: function (response) {
          api("/auth/google", { method: "POST", body: { credential: response.credential, ref: ref, next: next } })
            .then(afterSignIn)
            .catch(function (e) { toast(e.message, "bad"); });
        },
        ux_mode: "popup",
        auto_select: false
      });
      window.google.accounts.id.renderButton(slot, {
        theme: "filled_black", size: "large", shape: "rectangular", text: "continue_with", width: slot.clientWidth || 360
      });
    }
    if (state.gisLoaded) { renderButton(); return; }
    var script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = function () { state.gisLoaded = true; renderButton(); };
    script.onerror = function () { slot.appendChild(el("p", "small dim", "Google sign-in could not load. Use another way in.")); };
    document.head.appendChild(script);
  }

  function resetGate(card, add, token) {
    add(mark("mark"));
    add(el("h1", null, "New password"));
    var form = el("form", "stack tight");
    var pw = input("password", "password", "At least 12 characters");
    pw.autocomplete = "new-password";
    var submit = button("Set password and sign in", "btn primary wide");
    submit.type = "submit";
    var status = el("p", "small form-error");
    append(form, [field("Password", pw), submit, status]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      submit.disabled = true;
      api("/auth/password/reset", { method: "POST", body: { token: token, password: pw.value } }).then(function () {
        toast("Password set. Sign in with it now.", "good");
        history.replaceState(null, "", BASE);
        renderGate();
      }).catch(function (err) { status.textContent = err.message; submit.disabled = false; });
    });
    add(form);
  }

  function rememberRef(code) {
    try { localStorage.setItem("hearth.ref", String(code).slice(0, 16)); } catch (e) { /* private mode */ }
  }

  function readRef() {
    try { return localStorage.getItem("hearth.ref") || ""; } catch (e) { return ""; }
  }

  /* ---------- views every member has ---------- */

  register("/", function () {
    var wrap = el("div", "stack");
    var user = state.user;
    var hour = new Date().getHours();
    var greeting = hour < 5 ? "Still up" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    var first = (user.name || "").split(" ")[0] || "";
    wrap.appendChild(viewHead(greeting + (first ? ", " + first : "") + ".", roleLede()));

    var tiles = el("div", "grid3 rise");
    var i = 0;
    function tile(num, what, emberish) {
      var card = el("div", "card stat");
      card.style.setProperty("--i", String(i++));
      var n = el("div", "num" + (emberish ? " ember" : ""), "0");
      card.appendChild(n);
      card.appendChild(el("div", "what", what));
      tiles.appendChild(card);
      return n;
    }
    wrap.appendChild(tiles);

    var hooks = homeHooks.slice();
    return Promise.all(hooks.map(function (h) { return Promise.resolve(h(tile, wrap)).catch(function () {}); })).then(function () {
      if (!tiles.childNodes.length) tiles.remove();
      var quick = el("div", "grid2 rise mt");
      var j = 0;
      function q(title, text, to) {
        var c = link("", BASE + to, "card");
        c.style.setProperty("--i", String(j++));
        c.addEventListener("click", function (e) { e.preventDefault(); navigate(to); });
        append(c, [el("p", "label", title), el("p", "dim small", text)]);
        quick.appendChild(c);
      }
      q("Account", "Your name, timezone and referral link.", "/account");
      q("Security", "Where you are signed in, your password, your ways in.", "/security");
      if (can("members.read")) q("Members", "Who is here, their roles, and who is online.", "/admin/members");
      if (can("audit.read")) q("Log", "Every sign-in, change and agent call.", "/admin/log");
      wrap.appendChild(quick);
      return wrap;
    });
  }, { title: "", nav: { group: "Room", label: "Home", order: 0 } });

  // Other files can add tiles and sections to the home view.
  var homeHooks = [];
  function onHome(fn) { homeHooks.push(fn); }

  function roleLede() {
    switch (state.user.role) {
      case "owner": return "This is your company's room. Everything that happens in it is in the log.";
      case "staff": return "You are part of the business here. Members, sessions and the feed are yours to see.";
      case "client": return "Your sessions, your transcripts and your follow-ups live here, and your agents can read them.";
      default: return "You have a place here. The feed is open to you, and a first conversation is one message away.";
    }
  }

  register("/account", function () {
    var user = state.user;
    var wrap = el("div", "stack");
    wrap.appendChild(viewHead("Account", "Who you are here."));

    var card = el("div", "card stack");
    var top = el("div", "row");
    append(top, [avatar(user, "lg"), append(el("div", "grow"), [el("p", null, user.name || "No name yet"), el("p", "small dim", user.email)]), pill(state.role ? state.role.label : user.role, user.role)]);
    card.appendChild(top);

    var form = el("form", "stack tight");
    var name = input("text", "name", "Your name", user.name);
    name.autocomplete = "name";
    var tz = el("select", "select");
    var zones = timezones();
    if (zones.indexOf(user.timezone) === -1) zones.unshift(user.timezone);
    zones.forEach(function (z) { var o = el("option", null, z); o.value = z; if (z === user.timezone) o.selected = true; tz.appendChild(o); });
    var save = button("Save", "btn primary");
    save.type = "submit";
    append(form, [field("Name", name), field("Timezone", tz, "Session times are shown in this zone."), append(el("div", "row"), [save])]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      save.disabled = true;
      api("/profile", { method: "PATCH", body: { name: name.value, timezone: tz.value } }).then(function () {
        state.user.name = name.value.trim();
        state.user.timezone = tz.value;
        toast("Saved.", "good");
        flare();
        render();
      }).catch(function (err) { toast(err.message, "bad"); save.disabled = false; });
    });
    card.appendChild(form);
    wrap.appendChild(card);

    var refCard = el("div", "card stack tight");
    refCard.appendChild(el("p", "label", "Your referral link"));
    refCard.appendChild(el("p", "small dim", "When someone you send here becomes a client, you get the reward Elliot has set. It is theirs to use as a way in, not a marketing list."));
    var url = location.origin + BASE + "?ref=" + user.referralCode;
    var code = el("div", "code", url);
    refCard.appendChild(code);
    var copy = button("Copy link", "btn sm", function () {
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("Copied.", "good"); });
    });
    refCard.appendChild(append(el("div", "row"), [copy]));
    wrap.appendChild(refCard);

    var out = el("div", "row");
    out.appendChild(button("Sign out", "btn", function () {
      api("/auth/signout", { method: "POST" }).then(function () { location.assign("/"); });
    }));
    wrap.appendChild(out);
    return wrap;
  }, { title: "Account" });

  register("/security", function () {
    var wrap = el("div", "stack");
    wrap.appendChild(viewHead("Security", "Where you are signed in, and your ways in."));
    return Promise.all([api("/sessions"), api("/security")]).then(function (results) {
      var sessions = results[0];
      var sec = results[1];

      var ways = el("div", "card stack tight");
      ways.appendChild(el("p", "label", "Ways in"));
      var list = el("div", "list");
      sec.identities.forEach(function (id) {
        var row = el("div");
        append(row, [append(el("div"), [el("div", "primary", providerLabel(id.provider)), el("div", "secondary", id.email || "")]), el("div", "meta", "linked " + fmtRelative(id.createdAt))]);
        list.appendChild(row);
      });
      var emailRow = el("div");
      append(emailRow, [append(el("div"), [el("div", "primary", "Email link"), el("div", "secondary", state.user.email)]), el("div", "meta", "always")]);
      list.appendChild(emailRow);
      ways.appendChild(list);
      wrap.appendChild(ways);

      var pw = el("div", "card stack tight");
      pw.appendChild(el("p", "label", sec.hasPassword ? "Password" : "Add a password"));
      pw.appendChild(el("p", "small dim", sec.hasPassword ? "You can sign in with your email and password. Setting a new one replaces it." : "Optional. A sign-in link by email always works; a password is for when you would rather not wait for one."));
      var form = el("form", "row");
      var pwInput = input("password", "password", "At least 12 characters");
      pwInput.autocomplete = "new-password";
      pwInput.classList.add("grow");
      var set = button(sec.hasPassword ? "Change" : "Set password", "btn");
      set.type = "submit";
      append(form, [pwInput, set]);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        set.disabled = true;
        api("/auth/password/set", { method: "POST", body: { password: pwInput.value } }).then(function () {
          toast("Password set.", "good");
          flare();
          render();
        }).catch(function (err) { toast(err.message, "bad"); set.disabled = false; });
      });
      pw.appendChild(form);
      if (sec.hasPassword) {
        pw.appendChild(append(el("div", "row"), [button("Remove password", "btn ghost sm", function () {
          api("/auth/password", { method: "DELETE" }).then(function () { toast("Password removed.", "good"); render(); }).catch(function (err) { toast(err.message, "bad"); });
        })]));
      }
      wrap.appendChild(pw);

      var sess = el("div", "card pad0");
      var head = el("div", "row between");
      head.style.padding = "0.9rem 1.1rem";
      append(head, [el("p", "label", "Signed-in devices"), button("Sign out everywhere", "btn danger sm", function () {
        api("/auth/signout-all", { method: "POST" }).then(function () { location.assign(BASE); });
      })]);
      sess.appendChild(head);
      var slist = el("div", "list");
      sessions.sessions.forEach(function (s) {
        var row = el("div");
        var isThis = s.id === sessions.current;
        var left = append(el("div"), [el("div", "primary", (s.device || "unknown device") + (s.country ? " · " + s.country : "")), el("div", "secondary", "since " + fmtDate(s.createdAt) + " · last seen " + fmtRelative(s.lastSeenAt))]);
        var right = isThis ? pill("this one", "live") : button("Sign out", "btn ghost sm", function () {
          api("/sessions/" + encodeURIComponent(s.id), { method: "DELETE" }).then(function () { toast("Signed out there.", "good"); render(); });
        });
        append(row, [left, right]);
        slist.appendChild(row);
      });
      sess.appendChild(slist);
      wrap.appendChild(sess);
      return wrap;
    });
  }, { title: "Security" });

  function providerLabel(p) {
    return { google: "Google", github: "GitHub", discord: "Discord", email: "Email" }[p] || p;
  }

  function timezones() {
    var list = [];
    try { if (Intl.supportedValuesOf) list = Intl.supportedValuesOf("timeZone"); } catch (e) { /* older browser */ }
    if (!list.length) list = ["Europe/Lisbon", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Seoul", "Asia/Tokyo", "Australia/Sydney", "UTC"];
    return list.slice();
  }

  /* ---------- figures shared with other files ---------- */

  // A tiny bar chart: rows of { day, n } over a window of days.
  function barChart(rows, days, key) {
    var W = 560, H = 120, pad = 14;
    var node = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img" });
    node.setAttribute("class", "chart");
    var byDay = {};
    rows.forEach(function (r) { if (!key || r.event === key) byDay[String(r.day).slice(0, 10)] = (byDay[String(r.day).slice(0, 10)] || 0) + Number(r.n || 0); });
    var maxN = 1;
    var series = [];
    for (var i = days - 1; i >= 0; i -= 1) {
      var d = new Date(Date.now() - i * 86400000);
      var k = d.toISOString().slice(0, 10);
      var n = byDay[k] || 0;
      if (n > maxN) maxN = n;
      series.push({ k: k, n: n, d: d });
    }
    var bw = (W - pad * 2) / days;
    node.appendChild(svg("line", { x1: pad, x2: W - pad, y1: H - 16, y2: H - 16, class: "axis" }));
    series.forEach(function (s, idx) {
      var h = Math.max(s.n ? 2 : 0, (s.n / maxN) * (H - 40));
      var rect = svg("rect", { x: pad + idx * bw + 1, y: H - 16 - h, width: Math.max(1, bw - 2), height: h, rx: 1, class: "bar" + (s.n ? "" : " dim") });
      var t = svg("title");
      t.textContent = s.k + ": " + s.n;
      rect.appendChild(t);
      node.appendChild(rect);
      if (idx === 0 || idx === days - 1 || s.d.getDate() === 1) {
        var label = svg("text", { x: pad + idx * bw + bw / 2, y: H - 4, "text-anchor": "middle" });
        label.textContent = s.d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        node.appendChild(label);
      }
    });
    return node;
  }

  /* ---------- boot ---------- */

  window.Hearth = {
    register: register, onHome: onHome, api: api, el: el, svg: svg, mark: mark, clear: clear, append: append,
    button: button, link: link, field: field, input: input, pill: pill, avatar: avatar, toast: toast, flare: flare,
    navigate: navigate, render: render, viewHead: viewHead, empty: empty, fmtDate: fmtDate, fmtRelative: fmtRelative,
    countUp: countUp, barChart: barChart, can: can, state: state, BASE: BASE
  };

  function boot() {
    state.root = document.querySelector("[data-mount]");
    if (!state.root) return;
    window.addEventListener("popstate", render);
    api("/config", { quiet: true }).then(function (config) {
      state.config = config;
      return api("/me", { quiet: true }).then(function (me) {
        state.user = me.user;
        state.role = me.role;
        state.settings = me.settings;
        state.permissions = {};
        (me.user.permissions || []).forEach(function (p) { state.permissions[p] = true; });
        if (query().welcome) { toast("Welcome to the Hearth.", "good"); history.replaceState(null, "", location.pathname); }
        render();
      }, function () {
        state.user = null;
        render();
      });
    }).catch(function (e) {
      clear(state.root);
      var wrap = el("div", "gate");
      wrap.appendChild(append(el("div", "gate-card"), [mark("mark"), el("h1", null, "The Hearth"), el("p", "dim", e.status === 503 ? "The room is not open yet. Come back soon." : "The room could not be reached. Try again in a minute.")]));
      state.root.appendChild(wrap);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
