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
  function applyTheme(choice) {
    if (choice === "system") delete root.dataset.theme; else root.dataset.theme = choice;
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
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".menu a");
    if (a) { var m = document.getElementById("menu"); if (m && m.hidePopover) try { m.hidePopover(); } catch (err) {} }
  });

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
  // A section marked data-strip (not a pinned world) gives the header a
  // background while it is under the header.
  var top = null;
  function strip() {
    top = top || document.querySelector("[data-top]");
    if (!top) return;
    var h = top.offsetHeight, on = false, ground = "";
    document.querySelectorAll("[data-strip]").forEach(function (s) {
      var r = s.getBoundingClientRect();
      if (r.top < h && r.bottom > 0) { on = true; ground = getComputedStyle(s).getPropertyValue("--ground"); }
    });
    top.classList.toggle("top-strip", on || scrollY > 8 && !document.querySelector(".world"));
    if (ground) top.style.setProperty("--strip", ground.trim()); else top.style.removeProperty("--strip");
  }
  addEventListener("scroll", strip, { passive: true });
  addEventListener("resize", strip);

  function ready() { sync(); watch(); strip(); }
  document.addEventListener("chama:swapped", ready);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready); else ready();
})();
