/* The shared page controls: Theme and Motion, and the cycling Talk to us
   phrases. Everything is delegated from document, because the router swaps
   <main> and scripts inside it never run again. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)");

  function get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function put(key, value) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) {} }

  // ---- theme -----------------------------------------------------------
  function themeChoice() { var t = get("chama-theme"); return t === "light" || t === "dark" ? t : "system"; }
  // The browser bar's colour: both metas follow a forced choice, and go back
  // to their own media queries when the visitor follows the system again.
  var BAR = { light: "#f3f0e8", dark: "#161513" };
  function themeBar(choice) {
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      var own = /dark/.test(m.media) ? BAR.dark : BAR.light;
      m.content = choice === "system" ? own : BAR[choice];
    });
  }
  function applyTheme(choice) {
    if (choice === "system") delete root.dataset.theme; else root.dataset.theme = choice;
    themeBar(choice);
    document.dispatchEvent(new CustomEvent("chama:theme", { detail: { choice: choice } }));
    sync();
  }
  function setTheme(choice) {
    put("chama-theme", choice === "system" ? null : choice);
    if (document.startViewTransition && !reduce.matches && root.dataset.motion !== "low") document.startViewTransition(function () { applyTheme(choice); });
    else applyTheme(choice);
  }
  // Another tab changed it, or the system did while following it.
  addEventListener("storage", function (e) { if (e.key === "chama-theme") applyTheme(themeChoice()); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () { if (themeChoice() === "system") applyTheme("system"); });

  // ---- motion ----------------------------------------------------------
  function motionChoice() { return root.dataset.motion === "low" ? "low" : "full"; }
  function setMotion(choice) {
    if (choice === motionChoice()) return;
    put("chama-motion", choice);
    // The engine reads the mode once at load, so a switch reloads.
    location.reload();
  }

  function sync() {
    var t = themeChoice(), m = motionChoice();
    document.querySelectorAll("[data-set-theme]").forEach(function (i) { i.checked = i.value === t; });
    document.querySelectorAll("[data-set-motion]").forEach(function (i) { i.checked = i.value === m; });
  }

  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.matches && t.matches("[data-set-theme]")) setTheme(t.value);
    else if (t.matches && t.matches("[data-set-motion]")) setMotion(t.value);
  });

  // ---- the menu closes on any navigation --------------------------------
  // At once and in the capture phase, before the router starts lifting the
  // page: a menu fading out over the lift muddies the first frames.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".menu a");
    var m = a && document.getElementById("menu");
    if (!m || !m.hidePopover) return;
    m.classList.add("is-leaving");
    try { m.hidePopover(); } catch (err) {}
    setTimeout(function () { m.classList.remove("is-leaving"); }, 50);
  }, true);

  // ---- the cycling phrases ---------------------------------------------
  // Each holds 2.8s and swaps over 0.56s (base.css has the swap). Paused
  // while its field has focus or the pointer is over it, and out of view.
  var HOLD = 2800;
  var visible = new Set();
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
  }) : null;
  var watched = new WeakSet();
  function watch() {
    document.querySelectorAll("[data-cycle]").forEach(function (el) {
      if (watched.has(el)) return;
      watched.add(el);
      if (io) io.observe(el); else visible.add(el);
    });
  }
  function held(el) {
    var form = el.closest("form, [data-talk-sheet]");
    return form && (form.matches(":hover") || form.contains(document.activeElement));
  }
  setInterval(function () {
    if (document.hidden || reduce.matches) return;
    watch();
    visible.forEach(function (el) {
      if (!el.isConnected) { visible.delete(el); return; }
      if (held(el)) return;
      var words = el.children, n = words.length, at = 0;
      for (var i = 0; i < n; i++) if (words[i].classList.contains("on")) at = i;
      words[at].classList.remove("on");
      words[at].classList.add("off");
      var next = words[(at + 1) % n];
      next.classList.remove("off");
      next.classList.add("on");
      setTimeout(function (w) { w.classList.remove("off"); }, 600, words[at]);
    });
  }, HOLD);

  // ---- the header strip over scrolling content --------------------------
  // Words in a pinned world never reach the header. Anything else does: an
  // unpinned world, every world in one column or low motion, the footer.
  // While such content is under the header, the header gets a strip in that
  // section's ground. Read in the scroll event, never in a frame.
  var top = null;
  function strip() {
    top = top || document.querySelector("[data-top]");
    if (!top) return;
    var h = top.offsetHeight, on = false, ground = "";
    if (scrollY > 4) {
      var pinned = root.classList.contains("pin");
      // Any flowing content that overlaps the header's band turns it on,
      // even a sliver at the end of a section whose pinned neighbour has
      // already reached the header.
      var any = false;
      document.querySelectorAll("main > section, main > .world, footer").forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.top >= h || r.bottom <= 0) return;
        any = true;
        var flows = !pinned || s.tagName === "FOOTER" || !s.classList.contains("world") || s.dataset.pin === "off";
        if (flows && !on) { on = true; ground = getComputedStyle(s).getPropertyValue("--ground"); }
      });
      if (!any) on = true;
    }
    top.classList.toggle("top-strip", on);
    if (ground && ground.trim()) top.style.setProperty("--strip", ground.trim()); else top.style.removeProperty("--strip");
  }
  addEventListener("scroll", strip, { passive: true });
  addEventListener("resize", strip);

  // ---- one Talk to us button per screen ----------------------------------
  // A field counts only when the whole of it can be pressed: one cut by the
  // fold leaves no Talk to us on screen if the header's pill steps aside.
  // Read in the scroll event (and when a field crosses the screen's edge).
  function fieldsInView() {
    var any = false, top = document.querySelector("[data-top]"), h = top ? top.offsetHeight : 0;
    document.querySelectorAll("main [data-talk-form] .field").forEach(function (f) {
      var r = f.getBoundingClientRect();
      if (r.height && r.top >= h && r.bottom <= innerHeight) any = true;
    });
    if (root.classList.contains("field-in-view") !== any) root.classList.toggle("field-in-view", any);
  }
  addEventListener("scroll", fieldsInView, { passive: true });
  addEventListener("resize", fieldsInView);
  var fieldIo = "IntersectionObserver" in window ? new IntersectionObserver(fieldsInView, { threshold: [0, 1] }) : null;
  var fieldsSeen = new WeakSet();
  function watchFields() {
    if (!fieldIo) return;
    document.querySelectorAll("main [data-talk-form] .field").forEach(function (f) {
      if (fieldsSeen.has(f)) return;
      fieldsSeen.add(f);
      fieldIo.observe(f);
    });
  }

  function ready() { sync(); watch(); strip(); watchFields(); themeBar(themeChoice()); }
  document.addEventListener("chama:swapped", ready);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();

/* ---- the recording on /engineering-department -------------------------
   A [data-rec] figure holds a muted <video> with data-tall and data-wide
   sources, a [data-rec-toggle] button and caption lines carrying
   data-wide/data-tall start times. In full motion the video plays when 60%
   of it is in view and pauses out of view; once the visitor pauses it, it
   waits for the button. The figure shows data-state (idle, playing,
   paused, ended), and the caption being said gets data-now. The cut is
   chosen here before the first play, because <source media> is not
   honoured everywhere. The router swaps <main> without running its
   scripts, so the button is delegated from document and new videos are
   bound when <main> changes. */
(function () {
  "use strict";
  var LOW = document.documentElement.getAttribute("data-motion") === "low";
  var NARROW = matchMedia("(max-width: 759px)");
  var io = !LOW && "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target;
      if (e.intersectionRatio >= 0.6) { if (!v._held && !v.ended && v.paused) play(v); }
      else if (!e.isIntersecting && !v.paused) v.pause();
    });
  }, { threshold: [0, 0.6] }) : null;

  function play(v) {
    var want = v.getAttribute(NARROW.matches ? "data-tall" : "data-wide");
    if (!v._started && want && v.getAttribute("src") !== want) v.setAttribute("src", want);
    v.play().catch(function () {});
  }
  function show(v) {
    var fig = v.closest("[data-rec]");
    if (!fig) return;
    fig.setAttribute("data-state", v.ended ? "ended" : v.paused ? (v._started ? "paused" : "idle") : "playing");
    var cut = /tall/.test(v.currentSrc) ? "tall" : "wide", items = fig.querySelectorAll("[data-wide]"), now = 0, i;
    for (i = 0; i < items.length; i++) if (v.currentTime >= +items[i].getAttribute("data-" + cut)) now = i;
    for (i = 0; i < items.length; i++) items[i].toggleAttribute("data-now", i === now);
  }
  function bind() {
    document.querySelectorAll("[data-rec] video").forEach(function (v) {
      if (v._bound) return;
      v._bound = true;
      v.addEventListener("play", function () { v._started = true; });
      ["play", "pause", "ended", "timeupdate", "seeked"].forEach(function (ev) { v.addEventListener(ev, function () { show(v); }); });
      v.closest("[data-rec]").setAttribute("data-state", "idle");
      if (io) io.observe(v);
    });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-rec-toggle]");
    if (!b) return;
    var v = b.closest("[data-rec]").querySelector("video");
    if (v.paused) { v._held = false; play(v); } else { v._held = true; v.pause(); }
  });
  document.addEventListener("chama:swapped", bind);
  function start() {
    bind();
    new MutationObserver(bind).observe(document.body, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
