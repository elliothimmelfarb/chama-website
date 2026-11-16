/* ==========================================================================
   Worlds: the engine under the public pages, and the router that moves
   between them without loading a new page.

   Each <section class="world"> names its ground in data-world: paper,
   grid, tides or ember. One WebGL sky (sky.js) paints the ground of the
   section on screen, in the light or the dark palette, and as the page
   scrolls the next ground burns up through it from below.

   A world is pinned unless it says data-pin="off": its .pin (a direct
   child) sticks to the screen while the section, var(--h) screens tall,
   passes. The engine writes three numbers, each only on the elements whose
   rules read it, never on a container (Chrome restyles everything inside
   an element whose custom property changes, inherited or not):
     --u  on U_READERS: -1 while the world arrives, 0..1 held, 2 once gone
     --e  beside --u: what is left of the world as its pin leaves, 1 to 0
     --p  on [data-p]: the world's progress through its hold, 0 to 1
   An unpinned world scrolls as plain flow under the same sky, and its .r
   and [data-p] elements are shown complete.

   A [data-stage] plays --p from time instead of scroll (see "stages").

   --p is registered with an initial value of 1 (worlds.css), so a figure
   drawn from var(--p) is complete wherever nothing writes it: without
   JavaScript, in one column, in low motion and in an unpinned world.

   The pinned layout is html.pin. Each page's boot snippet (site/parts/
   boot.js) sets it before the first paint, as pinnable() does here: when
   html[data-motion] is not "low" and PIN_QUERY matches. The two must use
   the same query (test/engine.test.js holds them to it). Under html[data-motion="low"]
   the engine paints no sky, runs no frame loop and no router, and stages
   are steppers. Switching motion reloads the page.

   The engine loads no fonts and no libraries, and the only pictures it
   fetches are /build's devices', as their turn comes.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var PIN_QUERY = "(min-height: 501px)";
  var LOW = root.getAttribute("data-motion") === "low";
  var ROOMY = window.matchMedia(PIN_QUERY), printing = false, pinned = false;
  function pinnable() { pinned = !LOW && ROOMY.matches && !printing; root.classList.toggle("pin", pinned); }
  pinnable();
  // the boot snippet takes html.pin back if this never runs (words in a pin
  // are hidden until the engine writes --u)
  root.dataset.engine = "on";

  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GROUND = { paper: 0, grid: 1, tides: 2, ember: 3 };

  function clamp(x, a, b) { if (a === undefined) { a = 0; b = 1; } return x < a ? a : x > b ? b : x; }
  function sm(a, b, x) { var t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function round3(v) { return Math.round(v * 1000) / 1000; }

  // ---- stages: figures that play themselves ---------------------------------------
  // A [data-stage] runs --p from 0 to 1 over data-duration seconds on the
  // [data-p] elements inside it. It starts when 60% of it is in view, but
  // not before data-delay seconds after it was bound (page load, or the
  // router's swap); it pauses when it leaves the view or the tab is hidden,
  // and stops at the end; it never loops. It shows its state as data-state
  // (idle, playing, paused, ended). Buttons inside it:
  //   data-stage-action="play|pause|replay"
  //   data-stage-seek="<0..1>"   jump to a beat; the one in play has
  //                              aria-current="step". data-stage-still on
  //                              the same button is where low motion shows it.
  //   data-stage-step="-1|1"     the previous or next seek point; at an end
  //                              it is aria-disabled="true" (and stays
  //                              focusable). Arrow keys do the same while
  //                              focus is in the stage.
  // and [data-stage-count] reads "N of M" seek points.
  // The handlers are on document, because scripts inside <main> never run
  // after the router swaps it in.
  // In low motion a stage is a stepper: no autoplay, it opens on its first
  // seek point (complete, with no --p written, if it has none), and steps.
  // In the pinned layout the stage's figure starts at 0 from the first
  // paint (worlds.css), so it never flashes complete before it plays.
  var stages = [], stageIO = null, stageRaf = 0;
  function stageOf(el) {
    if (el._stage) return el._stage;
    var seeks = [].map.call(el.querySelectorAll("[data-stage-seek]"), function (b) {
      var at = clamp(parseFloat(b.getAttribute("data-stage-seek")) || 0), still = b.getAttribute("data-stage-still");
      return { b: b, at: at, still: still === null ? at : clamp(parseFloat(still) || 0) };
    });
    seeks.sort(function (x, y) { return x.at - y.at; });
    return (el._stage = {
      el: el, dur: Math.max(0.1, parseFloat(el.getAttribute("data-duration")) || 8) * 1000,
      delay: Math.max(0, parseFloat(el.getAttribute("data-delay")) || 0) * 1000, bound: performance.now(), wait: 0,
      readers: [].slice.call(el.querySelectorAll("[data-p]")), seeks: seeks,
      steps: [].slice.call(el.querySelectorAll("[data-stage-step]")), count: el.querySelector("[data-stage-count]"),
      state: "", p: -1, k: -2, from: 0, start: 0, seen: false, auto: false
    });
  }
  // where a seek point puts the figure: its beat, or in low motion its still
  function pointOf(s) { return LOW ? s.still : s.at; }
  function stageIndex(S, p) {
    var k = -1;
    S.seeks.forEach(function (s, i) { if (pointOf(s) <= p + 0.0005) k = i; });
    return k;
  }
  function stageMark(S) {
    var k = stageIndex(S, Math.max(0, S.p)), n = S.seeks.length;
    if (k === S.k) return;
    S.k = k;
    S.seeks.forEach(function (s, i) { if (i === k) s.b.setAttribute("aria-current", "step"); else s.b.removeAttribute("aria-current"); });
    if (S.count && n) S.count.textContent = (Math.max(k, 0) + 1) + " of " + n;
    S.steps.forEach(function (b) {
      var end = +b.getAttribute("data-stage-step") < 0 ? k <= 0 : k >= n - 1;
      if (end) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
    });
  }
  function stageState(S, state) {
    if (S.state === state) return;
    S.state = state;
    S.el.setAttribute("data-state", state);
  }
  function stageWrite(S, p) {
    p = round3(clamp(p));
    if (p === S.p) return;
    S.p = p;
    S.readers.forEach(function (el) { el.style.setProperty("--p", p); });
    stageMark(S);
  }
  function stageAt(S) { return S.state === "playing" ? clamp(S.from + (performance.now() - S.start) / S.dur) : Math.max(0, S.p); }
  function stagePlay(S, from) {
    S.from = from >= 1 ? 0 : from;
    S.start = performance.now();
    S.auto = false;
    stageState(S, "playing");
    stageWrite(S, S.from);
    tickStages();
  }
  function stagePause(S, auto) {
    if (S.state !== "playing") return;
    stageWrite(S, stageAt(S));
    S.from = S.p;
    S.auto = auto;
    stageState(S, "paused");
  }
  function stageSeek(S, p) {
    if (LOW) { stageWrite(S, p); stageState(S, p >= 1 ? "ended" : "paused"); return; }
    if (S.state === "playing" && p < 1) { stagePlay(S, p); return; }
    stageWrite(S, p);
    S.from = S.p;
    stageState(S, p >= 1 ? "ended" : "paused");
  }
  function stageStep(S, d) {
    var n = S.seeks.length, k = stageIndex(S, Math.max(0, S.p)), to = Math.min(n - 1, Math.max(0, k + d));
    if (!n || to === k) return;
    stageSeek(S, pointOf(S.seeks[to]));
  }
  function tickStages() {
    if (stageRaf) return;
    stageRaf = requestAnimationFrame(function () {
      stageRaf = 0;
      var more = false;
      stages.forEach(function (S) {
        if (S.state !== "playing") return;
        var p = stageAt(S);
        stageWrite(S, p);
        if (p >= 1) stageState(S, "ended"); else more = true;
      });
      if (more) tickStages();
    });
  }
  // plays a stage the reader has not stopped once enough of it is in view,
  // and holds one that has left the view
  function stageSeen(S) {
    if (LOW) return;
    if (S.seen && !document.hidden && (S.state === "idle" || (S.state === "paused" && S.auto))) {
      var early = S.delay - (performance.now() - S.bound);
      if (S.state === "idle" && early > 0) {
        if (!S.wait) S.wait = setTimeout(function () { S.wait = 0; stageSeen(S); }, early);
        return;
      }
      stagePlay(S, S.state === "idle" ? 0 : S.from);
    } else if ((!S.seen || document.hidden) && S.state === "playing") stagePause(S, true);
  }
  function bindStages() {
    if (stageIO) stageIO.disconnect();
    stages = [].map.call(document.querySelectorAll("[data-stage]"), stageOf);
    if (!LOW && !stageIO && window.IntersectionObserver) {
      stageIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var S = en.target._stage, view = en.rootBounds ? en.rootBounds.height : window.innerHeight;
          // a stage taller than the screen counts once it fills 60% of it
          S.seen = en.isIntersecting && (en.intersectionRatio >= 0.6 || en.intersectionRect.height >= 0.6 * view);
          stageSeen(S);
        });
      }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
    }
    stages.forEach(function (S) {
      if (S.state) return;
      if (LOW && S.seeks.length) { stageSeek(S, pointOf(S.seeks[0])); return; }
      if (LOW) { stageState(S, "ended"); S.p = 1; stageMark(S); return; }
      stageState(S, "idle");
      stageWrite(S, 0);
    });
    if (stageIO) stages.forEach(function (S) { stageIO.observe(S.el); });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-stage-action], [data-stage-seek], [data-stage-step]");
    var el = b && b.closest("[data-stage]");
    if (!el || b.getAttribute("aria-disabled") === "true") return;
    var S = stageOf(el), act = b.getAttribute("data-stage-action");
    if (b.hasAttribute("data-stage-step")) stageStep(S, +b.getAttribute("data-stage-step") < 0 ? -1 : 1);
    else if (b.hasAttribute("data-stage-seek")) S.seeks.forEach(function (s) { if (s.b === b) stageSeek(S, pointOf(s)); });
    else if (act === "pause") stagePause(S, false);
    else if (act === "replay") stagePlay(S, 0);
    else if (act === "play" && !LOW) stagePlay(S, S.state === "ended" ? 0 : Math.max(0, S.p));
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || e.altKey || e.ctrlKey || e.metaKey) return;
    var el = e.target.closest && e.target.closest("[data-stage]");
    if (!el || e.target.closest("input, textarea, select, [contenteditable]")) return;
    var S = stageOf(el);
    if (!S.seeks.length) return;
    e.preventDefault();
    stageStep(S, e.key === "ArrowLeft" ? -1 : 1);
  });
  document.addEventListener("visibilitychange", function () { stages.forEach(stageSeen); });
  bindStages();

  // ---- the sky ----------------------------------------------------------------
  // The shader and its WebGL setup live in sky.js, shared with the 404 page.
  // Low motion paints no sky: each section shows var(--ground) (worlds.css).
  var sky = document.getElementById("sky");
  var GL = !LOW && sky && window.ChamaSky ? window.ChamaSky.init(sky) : null;
  if (GL) root.classList.add("gl");
  if (sky) sky.addEventListener("webglcontextlost", function (e) { e.preventDefault(); GL = null; root.classList.remove("gl"); });
  var AW = 0, AH = 0, quality = 1;
  // the sky canvas is a fixed 100lvh; it is display: none without WebGL,
  // and a zero height would make every --u NaN, so the window stands in
  function sizeView() {
    AW = window.innerWidth;
    AH = (sky && sky.clientHeight) || window.innerHeight;
  }
  function sizeSky() {
    if (!GL) return;
    var w = sky.clientWidth, h = sky.clientHeight;
    var s = Math.min(window.devicePixelRatio || 1, 1.5) * quality;
    if (w * h * s * s > 2.1e6) s = Math.sqrt(2.1e6 / (w * h));
    var W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
    if (sky.width !== W || sky.height !== H) { sky.width = W; sky.height = H; GL.gl.viewport(0, 0, W, H); }
  }

  // ---- theme ---------------------------------------------------------------------
  // <html data-theme="light|dark">, or the system's setting when it is
  // absent. Whatever changes it sends chama:theme on document; the sky eases
  // to the new palette (instantly under reduced motion).
  var DARK = window.matchMedia("(prefers-color-scheme: dark)");
  var THEME_MS = 250;
  function themeWanted() {
    var t = root.getAttribute("data-theme");
    return t === "dark" ? 1 : t === "light" ? 0 : DARK.matches ? 1 : 0;
  }
  var themeTo = themeWanted(), themeFrom = themeTo, themeAt = -1e9;
  function themeNow(now) {
    if (RM) return themeTo;
    var k = clamp((now - themeAt) / THEME_MS);
    return themeFrom + (themeTo - themeFrom) * k * k * (3 - 2 * k);
  }
  function retheme() {
    var to = themeWanted(), now = performance.now();
    if (to === themeTo) return;
    themeFrom = themeNow(now);
    themeTo = to;
    themeAt = now;
  }
  document.addEventListener("chama:theme", retheme);
  if (DARK.addEventListener) DARK.addEventListener("change", retheme); else if (DARK.addListener) DARK.addListener(retheme);

  // ---- the sections ------------------------------------------------------------
  // Everything the engine knows about the page in view. bind() reads it
  // again when the router (at the end of this file) brings in another page.
  if (!document.querySelector(".world")) return;
  var sections = [], NW = 0, worldOf = [], pinOf = [], held = [];

  // the same test as the phone block in worlds.css, so the two always agree
  var PQ = window.matchMedia("(max-width: 759px), (max-aspect-ratio: 9/10)");
  function portrait() { return PQ.matches; }

  var head = document.querySelector(".top");
  function headBottom() { return head ? head.getBoundingClientRect().bottom : 0; }
  function isDevices(k) { return k >= 0 && k < NW && sections[k].classList.contains("devices-world"); }

  // a style is written only when its value changes, so a still stage
  // writes nothing and a moving one restyles only what moved
  function put(el, prop, v) {
    var k = el._put || (el._put = {});
    if (k[prop] !== v) { k[prop] = v; el.style[prop] = v; }
  }

  // ---- /build: a laptop and a phone, and what we made on their screens -----
  // One .made for each thing: its words, and a .rig holding its two
  // screens, each a tall picture of the real page. The devices hold still
  // while the page scrolls: within a thing's stretch its pictures scroll
  // inside the screens, and at the end the next thing's rig fades in over it
  // and the words change. The opening words stand beside the first thing's
  // devices. The stretches are the --h on the section: 90
  // for the opening and 135 for each thing, after the 100 of the pin.
  var DEV_OPEN = 90, DEV_EACH = 135;
  function devicesOf(sec) {
    if (sec._dev) return sec._dev;
    var items = [].slice.call(sec.querySelectorAll(".made"));
    var D = (sec._dev = {
      stage: sec.querySelector(".made-stage"), open: sec.querySelector(".made-open"), items: items,
      // the <noscript> copies are real elements after the router parses a page, so only the screen's own picture
      shots: items.map(function (it) { return [].slice.call(it.querySelectorAll(".screen > img")); }),
      ticks: [].slice.call(sec.querySelectorAll(".made-ticks a")), bar: sec.querySelector(".made-ticks"),
      rooms: [], words: -2, rig: -1, was: -1, wasAt: 0, fitted: ""
    });
    D.shots.forEach(function (pair, i) { pair.forEach(function (img) { img.addEventListener("load", function () { D.rooms[i] = null; }); }); });
    return D;
  }
  function devicesIntro(n) { return DEV_OPEN / (DEV_OPEN + DEV_EACH * n); }
  // a picture is fetched when its thing is next, so a long page costs a
  // visitor only what they scroll to. The things either side wait until the
  // one on the screens has arrived, so they never compete with it.
  function devicesLoad(D, i) {
    devicesFetch(D.shots[i]);
    if (!D.shots[i].every(function (img) { return img.complete; })) return;
    if (i > 0) devicesFetch(D.shots[i - 1]);
    if (i < D.items.length - 1) devicesFetch(D.shots[i + 1]);
  }
  // sizes in the markup cannot know the phone's --fit, so each picture is
  // chosen for its screen's measured width, kept as a share of the window so
  // a resize still picks again
  function devicesFetch(pair, lazy) {
    pair.forEach(function (img) {
      var src = img.getAttribute("data-src");
      if (!src) return;
      if (lazy) img.loading = "lazy";
      if (img.offsetWidth) img.sizes = (img.offsetWidth * 101 / innerWidth).toFixed(1) + "vw";
      img.srcset = img.getAttribute("data-srcset");
      img.src = src;
      img.removeAttribute("data-src");
    });
  }
  // where the words sit under the devices (a phone), the devices are one
  // size for every thing: as large as leaves the longest words clear of the
  // progress bar, and the opening words clear of the first thing's devices
  // while the header still has its lockup row. Measured in layout boxes, so
  // the words' own slide does not count.
  function devicesFit(D, P) {
    var key = AW + "x" + AH + P;
    if (D.fitted === key) return;
    D.fitted = key;
    D.rooms = [];
    var rig0 = D.items[0].querySelector(".rig"), lead = D.open && D.open.firstElementChild;
    var words = D.items.map(function (it) { return it.querySelector(".made-words"); });
    // the sizes run from 1 down in steps of 0.04 to 0.52, and each try is a
    // layout, so the largest that fits is found by halving, in four tries
    function fits(n) {
      D.stage.style.setProperty("--fit", (1 - 0.04 * n).toFixed(2));
      if (!P) return true;
      var floor = D.bar.offsetTop - 12;
      for (var i = 0; i < words.length; i++) if (words[i].offsetTop + words[i].offsetHeight > floor) return false;
      return !lead || rig0.offsetTop + rig0.offsetHeight + 12 <= lead.offsetTop;
    }
    if (fits(0) || !fits(12)) return;
    var lo = 0, hi = 12;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (fits(mid)) hi = mid; else lo = mid; }
    D.stage.style.setProperty("--fit", (1 - 0.04 * hi).toFixed(2));
  }
  function drawDevices(sec, l, t, ex) {
    var D = devicesOf(sec), n = D.items.length;
    if (!n || !D.stage) return;
    devicesFit(D, portrait());
    // the stage (devices and words) and the bar dissolve as the world
    // leaves, most of the way in the first half, so the dark devices do not
    // hang over the next world as a grey slab. Written here, only when it
    // changes, rather than from --u in CSS, which would restyle everything
    // inside them every frame.
    var gone = (ex * ex).toFixed(3);
    put(D.stage, "opacity", gone);
    // drifting up a little as it goes, as the words do (.r in worlds.css)
    put(D.stage, "translate", ex < 1 ? "0 " + (-(1 - ex) * 16).toFixed(1) + "px" : "");
    if (D.bar) put(D.bar, "opacity", gone);
    var a = devicesIntro(n), opening = l < a;
    var q = opening ? 0 : clamp((l - a) / (1 - a)) * n, i = Math.min(Math.floor(q), n - 1), f = clamp(q - i);
    devicesLoad(D, i);
    if (i !== D.rig) {
      if (D.was >= 0) D.items[D.was].classList.remove("rig-was");
      if (D.rig >= 0) { D.items[D.rig].classList.remove("rig-on"); D.items[D.rig].classList.add("rig-was"); }
      D.was = D.rig;
      D.wasAt = t;
      D.rig = i;
      D.items[i].classList.remove("rig-was");
      D.items[i].classList.add("rig-on");
    }
    // the one before goes once the new one has faded in over it
    if (D.was >= 0 && (RM || t - D.wasAt > 0.45)) { D.items[D.was].classList.remove("rig-was"); D.was = -1; }
    var words = opening ? -1 : i;
    if (words !== D.words) {
      D.words = words;
      // the things not showing are out of the tab order; the progress bar's
      // links reach each one
      D.items.forEach(function (it, j) { it.classList.toggle("on", j === words); it.inert = j !== words; });
      if (D.open) { D.open.classList.toggle("on", words < 0); D.open.inert = words >= 0; }
      D.ticks.forEach(function (b, j) { if (j === words) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
    }
    // how far each picture can scroll inside its screen, read once per size
    var room = D.rooms[i] || (D.rooms[i] = D.shots[i].map(function (img) { return Math.max(0, img.offsetHeight - img.parentNode.clientHeight); }));
    var k = sections.indexOf(sec), s = RM ? 0 : i < n - 1 ? sm(0.08, 0.9, f) : devicesLast(f, room[0], holdLen(k) * (1 - a) / n);
    D.shots[i].forEach(function (img, j) { img.style.transform = "translate3d(0," + (-room[j] * s).toFixed(1) + "px,0)"; });
    D.ticks.forEach(function (b, j) { b.style.setProperty("--t", opening || j > i ? 0 : j < i ? 1 : f.toFixed(3)); });
  }
  // The last thing's pictures move until the pin lets go, and the laptop's
  // reaches the page's own speed as it does, so its picture runs on up the
  // screen with the devices: one motion, with no stretch of scroll where
  // nothing answers. A Hermite curve from rest whose end slope is the
  // thing's scroll over the picture's room, so at the end a pixel of scroll
  // moves the picture a pixel; capped at 3, past which it would run backwards.
  function devicesLast(f, room, span) {
    var g = clamp((f - 0.08) / 0.92), v = room > 0 ? Math.min(3, 0.92 * span / room) : 3;
    return g * g * (3 - v + (v - 2) * g);
  }
  // the scroll position at which a thing on /build is on the screens
  function devicesY(el) {
    var sec = el.closest(".world"), k = sections.indexOf(sec);
    if (k < 0 || !held[k]) return null;
    var items = devicesOf(sec).items, n = items.length, i = items.indexOf(el), a = devicesIntro(n);
    return i < 0 ? null : tops[k] + (hs[k] - pins[k]) * (a + (1 - a) * (i + 0.25) / n);
  }
  // an anchor inside a pinned world is reached by scrolling to where it is
  // in focus, not to the element, which stays in its sticky pin. In one
  // column there is no such place (null), and the anchor is where it is.
  function pinnedY(el) {
    if (el.classList.contains("made")) return devicesY(el);
    return null;
  }
  // where a link to an anchor lands: below the anchor's scroll-margin, or
  // where it is in focus in its pin
  function anchorY(el) {
    var y = pinnedY(el);
    return y !== null ? y : el.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
  }

  // In one column nothing is pinned: every figure is drawn complete (--p
  // taken back), every thing on /build is on the page at once, none is
  // inert, no picture keeps the scroll it had inside its screen, and every
  // picture loads as it nears the screen (at once, for print). Back in the
  // pinned layout the frame loop applies its state again from scratch.
  function layFlat() {
    sections.forEach(function (sec, k) {
      var lay = pinned ? "pinned" : printing ? "print" : "flat";
      if (sec._lay === lay) return;
      sec._lay = lay;
      lastP[k] = undefined;
      if (!pinned) pReaders[k].forEach(function (el) { el.style.removeProperty("--p"); });
      if (sec.classList.contains("devices-world")) {
        var D = devicesOf(sec);
        D.words = -2; D.rig = -1; D.was = -1; D.fitted = "";
        if (pinned) return;
        D.items.forEach(function (it) { it.inert = false; it.classList.remove("on", "rig-on", "rig-was"); });
        if (D.open) D.open.inert = false;
        D.ticks.forEach(function (b) { b.removeAttribute("aria-current"); });
        if (D.stage) { put(D.stage, "opacity", ""); put(D.stage, "translate", ""); }
        if (D.bar) put(D.bar, "opacity", "");
        D.shots.forEach(function (pair) {
          pair.forEach(function (img) { img.style.transform = ""; if (printing) img.loading = "eager"; });
          devicesFetch(pair, !printing);
        });
      }
    });
  }

  // ---- scroll ------------------------------------------------------------------------
  // Where things are on the page, read once per layout rather than every
  // frame: a read in the loop forces the browser to finish styling first.
  // sy follows the scroll from its event, so a still page reads nothing.
  var tops = [], hs = [], pins = [], sy = window.scrollY, gones = [];
  var docH = 0, vh = 0;
  // ---- leaving: what rides up with a pin is gone before it reaches anything ----
  // A world's --u runs from 1 to 2 while its pin scrolls away. goneOf is how
  // far, in pixels of scroll past the pin's release, the first thing that
  // fades with it (a .r) can go before it would reach the header; on a
  // phone that is often a few pixels. So the fade ends there, but takes at
  // least EXIT_MIN of the screen: where the room is short it begins in the
  // last of the hold, and the words dissolve as they start to move rather
  // than blink out. setU writes what is left (exitOf) on each reader as --e.
  var EXIT_MIN = 0.15;
  // the slide a .r element is given while it is hidden, which is not its place
  function shiftOf(el) { var m = getComputedStyle(el).transform; return m && m !== "none" ? new DOMMatrix(m).m42 : 0; }
  function goneOf(k) {
    var sec = sections[k], pin = pinOf[k];
    var top = headBottom() + 8, pt = pin.getBoundingClientRect().top, room = pins[k] || AH;
    // everything that fades with the world, except what is gone before the
    // pin lets go (its --out is under 1)
    [].forEach.call(pin.querySelectorAll(".r"), function (el) {
      if (!el.offsetHeight || parseFloat(getComputedStyle(el).getPropertyValue("--out")) < 1) return;
      room = Math.min(room, el.getBoundingClientRect().top - shiftOf(el) - pt - top);
    });
    if (sec.classList.contains("devices-world")) {
      var D = devicesOf(sec), it = D.items[D.items.length - 1];
      if (it) [it.querySelector(".rig"), it.querySelector(".made-words")].forEach(function (el) { if (el) room = Math.min(room, it.offsetTop + el.offsetTop - top); });
    }
    return Math.max(room, 10);
  }
  // A unit of --u is a screen of scroll once a pin has let go (the last
  // world counts its tail in AH), and the hold's length before.
  function pinLen(k) { return k === NW - 1 ? AH : pins[k] || AH; }
  function holdLen(k) { return Math.max(1, hs[k] - pins[k]); }
  function exitLen(gone) { return Math.max(Math.min(gone, AH), EXIT_MIN * AH); }
  // Past the last world the page scrolls only as far as the footer. What
  // that tail never carries into the header stays: with the floor, it would
  // otherwise fade in place at the foot of the page.
  function reach(k, gone) { return k === NW - 1 && docH - vh - (tops[k] + holdLen(k)) < gone ? 1e4 : gone; }
  // how much of world k is left at --u = u, 0 to 1, for something gone
  // `gone` pixels past the release
  function exitOf(k, gone, u) {
    if (gone === undefined) return 1;
    return clamp((gone - Math.max(u - 1, 0) * pinLen(k) - Math.min(u - 1, 0) * holdLen(k)) / exitLen(gone));
  }
  // measure() writes a value only when it changes, so a measure that moves
  // nothing leaves the layout it read clean for its second round of reads
  function setVar(el, name, v) {
    var k = el._vars || (el._vars = {});
    if (k[name] === v) return;
    k[name] = v;
    if (v === "") el.style.removeProperty(name); else el.style.setProperty(name, v);
  }
  function measure() {
    // every read, then every write, so the page is laid out once
    sy = window.scrollY;
    held = sections.map(function (s, k) { return pinned && !!pinOf[k]; });
    tops = sections.map(function (s) { return s.getBoundingClientRect().top + sy; });
    hs = sections.map(function (s) { return s.offsetHeight; });
    pins = sections.map(function (s, k) { return held[k] ? pinOf[k].offsetHeight : 0; });
    docH = root.scrollHeight;
    vh = window.innerHeight;
    gones = sections.map(function (s, k) { return held[k] ? reach(k, goneOf(k)) : undefined; });
    if (nav) placeRail();
    // the exits may have moved: the next frame writes every --u, --e and --p again
    lastU = [];
    lastP = [];
  }
  // The world on screen (i), how far through its hold (l), how far the next
  // one has come up the screen (a, 0 to 1), where the fire line between
  // them stands (b), and how far the page has scrolled past the last world.
  function scrollState() {
    var y = sy, i = 0;
    for (var k = 0; k < NW; k++) if (y >= tops[k] - 1) i = k;
    var range = Math.max(1, hs[i] - pins[i]);
    var l = clamp((y - tops[i]) / range), a = 0, b = 0, tail = 0;
    if (i < NW - 1) {
      // a pinned world hands over while its pin leaves; one that scrolls,
      // over the screen in which the next one's top edge comes up
      var P = held[i] ? Math.max(1, pins[i]) : AH;
      a = clamp((y - (tops[i + 1] - P)) / P);
      // the fire line (-0.4 + 1.8 * b of the screen from the bottom,
      // crossing() below) sweeps up as a pin leaves; under a world that
      // scrolls it stands on the next section's top edge instead of sweeping
      // up through this one's words. Two sections in a row on the same
      // ground are one world to the eye, so nothing burns between them.
      if (worldOf[i] !== worldOf[i + 1]) b = held[i] ? a : clamp((1 - (tops[i + 1] - y) / AH + 0.4) / 1.8);
    } else tail = Math.max(0, y - (tops[i] + range));
    return [i, l, a, b, tail];
  }
  // --u is not inherited (worlds.css), so it is written on each element
  // whose rules read it, and a scroll frame restyles those alone. The exit,
  // --e, goes beside it, and is written only when it changes, which is
  // while its world leaves.
  var U_READERS = ".pin-shade, .r, .ticks b, .qs li";
  var P_READERS = "[data-p]";
  var lastU = [], readers = [], lastE = [], pReaders = [], lastP = [];
  function setU(i, l, x) {
    for (var k = 0; k < NW; k++) {
      if (!held[k]) continue;
      var u = round3(k < i ? 2 : k > i + 1 ? -1 : k === i ? l + x : -1 + x);
      if (u === lastU[k]) continue;
      lastU[k] = u;
      var e = round3(exitOf(k, gones[k], u));
      for (var j = 0; j < readers[k].length; j++) {
        var el = readers[k][j];
        el.style.setProperty("--u", u);
        if (e !== lastE[k][j]) { lastE[k][j] = e; el.style.setProperty("--e", e); }
      }
    }
  }
  // --p is the world's hold, 0 to 1: 1 once the world has gone, 0 until it
  // is the world on screen
  function setP(i, l) {
    for (var k = 0; k < NW; k++) {
      if (!held[k] || !pReaders[k].length) continue;
      var p = k < i ? 1 : k > i ? 0 : round3(l);
      if (p === lastP[k]) continue;
      lastP[k] = p;
      for (var j = 0; j < pReaders[k].length; j++) pReaders[k][j].style.setProperty("--p", p);
    }
  }

  // ---- the index of worlds -------------------------------------------------------------
  // A rail down the right edge whose fill follows the scroll, so a hold
  // where nothing on the page moves still visibly does something. Each
  // world's mark sits where it becomes current, halfway through its
  // arrival, so the fill reaches a mark as its world takes over, and every
  // mark behind the fill stays lit: the worlds already finished. On a
  // phone the marks are ticks; elsewhere they are the dots, which take
  // you to their world. Marks keep RAIL_GAP apart (the dots' labels), so
  // the fill runs faster or slower between some of them, never stops.
  var nav = null, fill = null, dots = [], ticks = [];
  var RAIL_BOTTOM = 24, RAIL_BOTTOM_P = 12, RAIL_GAP = 28, RAIL_GAP_P = 8;
  var railY = [], railD = [], railH = 1, maxS = 1, lastFill = -1, lastMark = -1;
  function buildIndex() {
    if (nav) nav.remove();
    nav = document.createElement("div");
    nav.className = "worlds";
    fill = document.createElement("span");
    fill.className = "rail-fill";
    fill.setAttribute("aria-hidden", "true");
    nav.appendChild(fill);
    var ol = document.createElement("ol");
    ol.setAttribute("aria-label", "Sections");
    ticks = sections.map(function () {
      var tick = document.createElement("i");
      tick.className = "rail-mark";
      tick.setAttribute("aria-hidden", "true");
      nav.appendChild(tick);
      return tick;
    });
    dots = sections.map(function (sec, k) {
      var li = document.createElement("li"), btn = document.createElement("button"), span = document.createElement("span"), dot = document.createElement("i");
      btn.type = "button";
      // a section's name: its data-label, or its first heading; one with
      // neither keeps its mark on the rail but has no button
      var name = sec.getAttribute("data-label") || ((sec.querySelector("h1, h2, h3") || {}).textContent || "").replace(/\s+/g, " ").trim();
      if (!name) li.hidden = true;
      span.textContent = name;
      btn.appendChild(span);
      btn.appendChild(dot);
      btn.addEventListener("click", function () {
        var target = sec.getAttribute("data-go") ? document.querySelector(sec.getAttribute("data-go")) : null;
        var y = target ? target.getBoundingClientRect().top + window.scrollY : tops[k] + (k ? 2 : 0);
        window.scrollTo({ top: y, behavior: RM ? "auto" : "smooth" });
      });
      li.appendChild(btn);
      ol.appendChild(li);
      return btn;
    });
    nav.appendChild(ol);
    document.body.appendChild(nav);
    lastFill = -1; lastMark = -1;
  }
  // where on the scroll each world becomes current, and where its mark is
  // drawn on the rail; read with the layout in measure()
  function placeRail() {
    var P = portrait(), gap = P ? RAIL_GAP_P : RAIL_GAP, top = Math.round(headBottom() + (P ? 8 : 16));
    maxS = Math.max(1, docH - vh);
    railH = Math.max(1, vh - top - (P ? RAIL_BOTTOM_P : RAIL_BOTTOM));
    railY = sections.map(function (s, k) { return k ? Math.min(maxS, Math.max(0, tops[k] - (held[k - 1] ? pins[k - 1] : AH) / 2)) : 0; });
    railD = railY.map(function (y) { return y / maxS * railH; });
    for (var k = 1; k < NW; k++) railD[k] = Math.max(railD[k], railD[k - 1] + gap);
    for (k = NW - 1; k > 0; k--) railD[k] = Math.min(railD[k], railH - (NW - 1 - k) * gap);
    setVar(nav, "--rail-top", top + "px");
    for (k = 0; k < NW; k++) {
      var at = Math.round(railD[k]) + "px";
      setVar(ticks[k], "--at", at);
      setVar(dots[k].parentNode, "--at", at);
    }
    lastFill = -1;
  }
  function drawRail() {
    if (railY.length !== NW) return;
    var j = 0;
    while (j < NW - 1 && sy >= railY[j + 1]) j++;
    var y0 = railY[j], y1 = j < NW - 1 ? railY[j + 1] : maxS, d0 = railD[j], d1 = j < NW - 1 ? railD[j + 1] : railH;
    var f = Math.round(Math.min(1, (d0 + (d1 - d0) * clamp((sy - y0) / Math.max(1, y1 - y0))) / railH) * 2000) / 2000;
    if (f !== lastFill) { fill.style.transform = "scaleY(" + f + ")"; lastFill = f; }
    if (j === lastMark) return;
    for (var k = 0; k < NW; k++) {
      ticks[k].classList.toggle("is-passed", k <= j);
      ticks[k].classList.toggle("is-current", k === j);
      dots[k].classList.toggle("is-passed", k <= j);
      dots[k].setAttribute("aria-current", k === j ? "true" : "false");
    }
    lastMark = j;
  }

  // ---- the loop --------------------------------------------------------------------------
  var t0 = performance.now(), last = t0, ema = 16, frames = 0, shown = 0;
  // tBind starts each page's own clock; the sky keeps one clock for the whole visit
  var tBind = t0;

  function bind() {
    sections = [].slice.call(document.querySelectorAll(".world"));
    NW = sections.length;
    worldOf = sections.map(function (s) { return GROUND[s.getAttribute("data-world")] || 0; });
    pinOf = sections.map(function (s) { return s.getAttribute("data-pin") === "off" ? null : s.querySelector(":scope > .pin"); });
    // the shade behind the words: an element, not the pin's ::before, so
    // the pin is not a reader of --u (worlds.css)
    pinOf.forEach(function (pin) {
      if (!pin || pin.querySelector(":scope > .pin-shade")) return;
      var shade = document.createElement("div");
      shade.className = "pin-shade";
      pin.insertBefore(shade, pin.firstChild);
    });
    readers = sections.map(function (s, k) { return pinOf[k] ? [].slice.call(s.querySelectorAll(U_READERS)) : []; });
    // a stage's figure is the stage's, not the world's
    pReaders = sections.map(function (s, k) {
      return pinOf[k] ? [].filter.call(s.querySelectorAll(P_READERS), function (el) { return !el.closest("[data-stage]"); }) : [];
    });
    lastE = readers.map(function () { return []; });
    tops = []; hs = []; pins = []; held = []; gones = []; lastU = []; lastP = [];
    shown = worldOf[0] || 0;
    tBind = performance.now();
    if (!LOW) buildIndex();
  }

  // Ambient motion (the sky, its drift under the pointer) does not need a
  // 120 Hz screen's every frame. Once the page has been still for
  // STILL_MS, frames come at least AMBIENT_MS apart: every other one at
  // 120 Hz, every one at 90 Hz and below. The first scroll, pointer move,
  // page change or theme change brings back every frame.
  var STILL_MS = 300, AMBIENT_MS = 10;
  var stirAt = 0, stirY = -1, stirX = 0, stirP = 0;
  var ptr = { x: -9999, y: -9999, on: false, sx: 0, sy: 0 };
  function stirred(now) {
    var moving = sy !== stirY || ptr.x !== stirX || ptr.y !== stirP || burnIn || leaveAt || now - themeAt < THEME_MS ||
      Math.abs((ptr.on ? ptr.x : AW / 2) - ptr.sx) > 0.5 || Math.abs((ptr.on ? ptr.y : AH / 2) - ptr.sy) > 0.5;
    stirY = sy; stirX = ptr.x; stirP = ptr.y;
    if (moving) stirAt = now;
    return now - stirAt < STILL_MS;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!stirred(now) && now - last < AMBIENT_MS) return;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var t = RM ? 24 : (now - t0) / 1000, ts = RM ? 24 : (now - tBind) / 1000;
    var st = scrollState(), i = st[0], l = st[1], a = st[2], b = st[3];
    // the last world keeps counting on past its end, so what rises with it
    // can leave before it reaches the header
    var x = i < NW - 1 ? a : st[4] / AH, u = l + x;
    // in one column the words stand still (worlds.css), so nothing reads these
    if (pinned) { setU(i, l, x); setP(i, l); }
    var pass = crossing(b);

    // the ground on screen, where the next page's burn starts from
    shown = pass && pass.mix < 0.8 ? pass.from : worldOf[b < 0.8 ? i : i + 1];

    if (pinned) {
      drawRail();
      if (isDevices(i) && held[i]) drawDevices(sections[i], l, ts, exitOf(i, gones[i], u));
      if (a > 0 && isDevices(i + 1) && held[i + 1]) drawDevices(sections[i + 1], 0, ts, 1);
    }

    ptr.sx += ((ptr.on ? ptr.x : AW / 2) - ptr.sx) * (1 - Math.exp(-dt * 4));
    ptr.sy += ((ptr.on ? ptr.y : AH / 2) - ptr.sy) * (1 - Math.exp(-dt * 4));
    if (GL) {
      var gl = GL.gl, U = GL.U;
      gl.uniform2f(U.uRes, sky.width, sky.height);
      gl.uniform1f(U.uTime, t);
      gl.uniform1f(U.uTheme, themeNow(now));
      gl.uniform1f(U.uWorldA, pass ? pass.from : worldOf[i]);
      gl.uniform1f(U.uWorldB, pass ? worldOf[i] : worldOf[Math.min(i + 1, NW - 1)]);
      gl.uniform1f(U.uMix, pass ? pass.mix : b);
      gl.uniform1f(U.uLocal, l);
      gl.uniform2f(U.uMouse, (ptr.sx - AW / 2) / AH, (AH / 2 - ptr.sy) / AH);
      // nothing on the page is the fire's source: the focus stands far off screen
      gl.uniform2f(U.uFocus, 0, 10);
      gl.uniform1f(U.uFocusR, 0.1);
      gl.uniform1f(U.uFlame, 0);
      // the dark ember's glow grows as its world is held
      gl.uniform1f(U.uHeat, worldOf[i] === GROUND.ember ? l : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // a slow machine gets a softer sky rather than a stuttering one
    ema = ema * 0.95 + dt * 1000 * 0.05;
    if (++frames % 90 === 0 && ema > 24 && quality > 0.5) { quality *= 0.8; sizeSky(); }
  }

  function resize() {
    pinnable();
    layFlat();
    sizeView();
    sizeSky();
    measure();
    stirAt = performance.now();
  }
  var queued = false;
  window.addEventListener("resize", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; resize(); });
  });
  window.addEventListener("scroll", function () { sy = window.scrollY; }, { passive: true });
  window.addEventListener("load", measure);
  window.addEventListener("beforeprint", function () { printing = true; pinnable(); layFlat(); });
  window.addEventListener("afterprint", function () { printing = false; resize(); });
  // anything that lengthens the page (a late picture) measures again
  if (window.ResizeObserver) new ResizeObserver(function () {
    if (root.scrollHeight !== docH) measure();
  }).observe(document.body);
  window.addEventListener("pointermove", function (e) { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = e.pointerType === "mouse"; }, { passive: true });
  document.addEventListener("pointerleave", function () { ptr.on = false; });
  window.addEventListener("blur", function () { ptr.on = false; });

  // the header's pages and the menu's mark the page in view
  function setCurrent(path) {
    [].forEach.call(document.querySelectorAll(".top .nav-link, .menu-pages a"), function (a) {
      if (pathOf(new URL(a.href, location.href)) === path) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }


  // ---- the router: the public pages without leaving the page -----------------------
  // The pages in PAGES are one place. A link between them does not load a
  // new document: the words in view lift away, the new page is fetched
  // (usually already, on hover or when the browser is idle) and put in
  // place, and the sky burns from the world that was on screen into the new
  // page's first world while the new words rise behind the fire. Any other
  // link is an ordinary navigation, and so is every link in low motion.
  // PAGES is the inRouter list in site/site.js (test/engine.test.js).
  var PAGES = { "/": 1, "/engineering-department": 1, "/coaching": 1, "/build": 1, "/work": 1, "/about": 1 };
  var cache = {}, navSeq = 0, burnIn = null, leaveAt = 0;
  function pathOf(u) {
    var p = u.pathname.replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "");
    return p.length > 1 ? p.replace(/\/$/, "") : p;
  }
  var here = pathOf(location);

  // a fetch that hangs rather than fails gives up, and the visitor gets an
  // ordinary navigation instead of an empty sky
  var GIVE_UP = 8000;
  function fetchPage(path) {
    if (!cache[path]) {
      var opts = { credentials: "same-origin" };
      if (window.AbortSignal && AbortSignal.timeout) opts.signal = AbortSignal.timeout(GIVE_UP);
      cache[path] = fetch(path, opts).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      });
      cache[path].catch(function () { delete cache[path]; });
    }
    return cache[path];
  }

  // the burn from the old page's world into the new one, read by the loop.
  // The shader's fire line stands at -0.4 + 1.8 * mix of the screen's
  // height from the bottom, and its flames reach about 0.3 above the line,
  // so the burn starts where they first touch the screen, not below it. It
  // answers a tap, so it eases out: fast through the words, slowing as it
  // passes the header.
  var BURN = 850, MIX_FROM = 0.06;
  // The new words show just behind the fire line: --wipe is written on the
  // arriving page's pins, the only thing that reads it, and is registered
  // not to inherit (worlds.css), so each frame restyles those pins alone.
  // On <html> it restyled the whole document, about 10ms a frame on a phone.
  var wiped = [];
  function wipe(m) {
    var v = m === null ? null : ((-0.4 + 1.8 * m) * 100).toFixed(1) + "%";
    wiped.forEach(function (pin) {
      if (v === null) pin.style.removeProperty("--wipe");
      else pin.style.setProperty("--wipe", v);
    });
    if (v === null) wiped = [];
  }
  function endBurn() {
    burnIn = null;
    root.classList.remove("nav-enter");
    wipe(null);
  }
  function crossing(b) {
    if (!burnIn) return null;
    var p = clamp((performance.now() - burnIn.start) / burnIn.dur);
    var m = MIX_FROM + (1 - MIX_FROM) * (1 - Math.pow(1 - p, 3));
    if (p >= 1) { endBurn(); return null; }
    wipe(m);
    return b > 0.001 ? null : { from: burnIn.from, mix: m };
  }

  // Every address is versioned (scripts/stamp.js), so a page whose scripts
  // or stylesheets this one does not already hold comes from another deploy
  // (or another version of this engine) and gets a full load instead.
  function sameDeploy(doc) {
    return [].every.call(doc.head.querySelectorAll("script[src], link[rel=\"stylesheet\"]"), function (n) {
      var u = n.getAttribute("src") || n.getAttribute("href");
      return !!document.querySelector('script[src="' + u + '"], link[rel="stylesheet"][href="' + u + '"]');
    });
  }

  var HEAD = 'meta[name="description"], meta[name="author"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], link[rel="alternate"][hreflang], script[type="application/ld+json"]';
  function swap(doc) {
    document.title = doc.title;
    [].forEach.call(document.head.querySelectorAll(HEAD), function (n) { n.remove(); });
    [].forEach.call(doc.head.querySelectorAll(HEAD), function (n) { document.head.appendChild(document.importNode(n, true)); });
    // a parsed document runs no scripts, so its <noscript> is ordinary markup
    [].forEach.call(doc.querySelectorAll("noscript"), function (n) { n.remove(); });

    // the header stays; only main, the footer and the page's name change
    document.querySelector("main").replaceWith(document.importNode(doc.querySelector("main"), true));
    if (doc.body.hasAttribute("data-page")) document.body.setAttribute("data-page", doc.body.getAttribute("data-page"));
    var foot0 = document.querySelector("body > footer"), foot1 = doc.querySelector("body > footer");
    if (foot0 && foot1) foot0.replaceWith(document.importNode(foot1, true));
  }

  // A second tap never makes the wait longer: the same link again is
  // ignored, another link keeps the lift already under way, and the page
  // in view cancels the change. A fetch still out when the words have gone
  // marks the header as waiting (.nav-wait), so the tap visibly took.
  var LIFT = 200, going = null, waitT = 0;
  function settleNav() {
    going = null;
    leaveAt = 0;
    clearTimeout(waitT);
    root.classList.remove("nav-leave", "nav-wait");
  }
  function stay() {
    navSeq++;
    settleNav();
    setCurrent(here);
  }
  function go(u, push) {
    var path = pathOf(u), seq = ++navSeq;
    var from = shown;
    if (push && !going) { try { history.replaceState({ y: window.scrollY }, ""); } catch (e) {} }
    going = path;
    setCurrent(path);
    endBurn();
    root.classList.add("nav-leave");
    var now = performance.now();
    if (!RM && !leaveAt) leaveAt = now;
    var left = RM ? 0 : Math.max(0, LIFT - (now - leaveAt));
    var lift = new Promise(function (res) { setTimeout(res, left); });
    var page = fetchPage(path), ready = false;
    page.then(function () { ready = true; }, function () {});
    clearTimeout(waitT);
    waitT = setTimeout(function () { if (seq === navSeq && !ready) root.classList.add("nav-wait"); }, left);
    Promise.all([page, lift]).then(function (r) {
      if (seq !== navSeq) return;
      var doc = new DOMParser().parseFromString(r[0], "text/html");
      var main = doc.querySelector("main");
      if (!main || !main.querySelector(".world")) throw new Error("not an animated page");
      if (!sameDeploy(doc)) throw new Error("another deploy");
      if (push) history.pushState({ y: 0 }, "", u.pathname + u.search + u.hash);
      swap(doc);
      root.classList.add("routed");
      here = path;
      // .nav-leave lifts main by 2.5vh, so it goes before anything is measured
      settleNav();
      bind();
      bindStages();
      resize();
      var y = push ? 0 : (history.state && history.state.y) || 0;
      var target = u.hash && document.getElementById(u.hash.slice(1));
      // pushState does not move :target, so mark it by hand
      if (target) {
        y = anchorY(target);
        target.classList.add("is-target");
      }
      window.scrollTo({ top: y, behavior: "instant" });
      // the new <main> is in place and measured: per-page setup elsewhere
      // (chrome.js, talk.js) binds to it now
      document.dispatchEvent(new CustomEvent("chama:swapped"));
      if (!RM) {
        wiped = [].slice.call(document.querySelectorAll("main .world > .pin"));
        wipe(MIX_FROM);
        root.classList.add("nav-enter");
        burnIn = { from: from, start: performance.now(), dur: BURN };
      }
      var h = document.querySelector("main h1");
      if (h) {
        h.setAttribute("tabindex", "-1");
        try { h.focus({ preventScroll: true }); } catch (e) {}
      }
    }).catch(function () {
      // Back and Forward have already moved the history to this entry
      if (seq === navSeq) { if (push) location.assign(u.href); else location.replace(u.href); }
    });
  }

  if (!LOW && window.fetch && window.DOMParser && window.history && history.pushState) {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      if (a.getAttribute("href").charAt(0) === "#") return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin || !PAGES[pathOf(u)]) return;
      e.preventDefault();
      if (going) {
        if (pathOf(u) === here) stay();
        else if (pathOf(u) !== going) go(u, true);
        return;
      }
      if (pathOf(u) === here) {
        var t = u.hash && document.getElementById(u.hash.slice(1));
        window.scrollTo({ top: t ? anchorY(t) : 0, behavior: RM ? "auto" : "smooth" });
        return;
      }
      go(u, true);
    });
    // A page left by a full load (go's fallback) is kept in the
    // back/forward cache as it was: words lifted away, the tapped link
    // marked, the change still under way. Back must find it whole.
    window.addEventListener("pageshow", function (e) {
      if (!e.persisted) return;
      stay();
      endBurn();
    });
    window.addEventListener("popstate", function () {
      var path = pathOf(location);
      if (path === here) { if (going) stay(); }
      else if (PAGES[path]) go(new URL(location.href), false);
    });
    // the next page is usually fetched before it is asked for
    var warm = function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      var u = new URL(a.href, location.href);
      if (u.origin === location.origin && PAGES[pathOf(u)] && pathOf(u) !== here) fetchPage(pathOf(u));
    };
    document.addEventListener("pointerover", warm, { passive: true });
    document.addEventListener("touchstart", warm, { passive: true });
    document.addEventListener("focusin", warm);
    var save = navigator.connection && navigator.connection.saveData;
    // the page in view too, so Back to the page the visit began on is warm
    if (!save) setTimeout(function () { Object.keys(PAGES).forEach(fetchPage); }, 3000);
  }

  bind();
  resize();
  // a link straight to a thing on /build (/build#shopintake) puts it on the
  // screens, rather than the browser's jump to the top of the pin. In one
  // column it lands on the entry, which pictures loading above it or the
  // switch from the pinned layout may have moved since the browser's jump.
  function toHashTurn(smooth) {
    var t = location.hash && document.getElementById(location.hash.slice(1));
    if (!t || !t.classList.contains("made")) return;
    // the browser's own jump to the anchor scrolls the clipped pin itself,
    // which moves everything inside it off its place
    var pin = t.closest(".world > .pin");
    if (pin) pin.scrollTop = 0;
    measure();
    window.scrollTo({ top: anchorY(t), behavior: smooth === true && !RM ? "smooth" : "instant" });
  }
  requestAnimationFrame(toHashTurn);
  window.addEventListener("load", function () { requestAnimationFrame(toHashTurn); });
  // Back and Forward between the things on /build
  window.addEventListener("hashchange", function () { toHashTurn(true); });
  // a bar of /build's progress bar puts its thing on the screens: the
  // browser's own jump would find the anchor already "in view" in its
  // sticky pin and not scroll at all
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    var t = a && document.getElementById(a.getAttribute("href").slice(1));
    var ty = t ? pinnedY(t) : null;
    if (ty === null) return;
    e.preventDefault();
    if (location.hash !== "#" + t.id) { try { history.pushState({ y: ty }, "", "#" + t.id); } catch (err) {} }
    var pin = t.closest(".world > .pin");
    if (pin) pin.scrollTop = 0;
    window.scrollTo({ top: ty, behavior: RM ? "auto" : "smooth" });
  });
  ptr.sx = AW / 2;
  ptr.sy = AH / 2;
  if (!LOW) requestAnimationFrame(frame);
})();
