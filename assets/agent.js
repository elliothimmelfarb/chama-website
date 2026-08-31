/* ==========================================================================
   The agent app.

   window.ChamaAgent.mount(root, { mode: "page" | "embed" })

   The whole app lives inside the element it is handed. Nothing measures the
   viewport, nothing listens on window for pointers, and nothing writes CSS
   custom properties above the root, so the same code runs full screen at
   /agent and embedded in a section of the homepage.

   The markup below is a static author-written template, which is why it is
   allowed through innerHTML. Everything dynamic (model output above all)
   keeps the safe path: textContent, createElement, and the linkifier.
   ========================================================================== */
(function () {
  "use strict";

  var MARK_SVG = '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><g transform="translate(2.0612 0.0639)" fill="#f4581f"><path d="M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z"/><path d="M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57.0 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z"/></g></svg>';

  var CHIPS = [
    "What is this?",
    "Why is spending time with Elliot valuable?",
    "How was this built?",
    "Ask Elliot to get in touch with me.",
    "Make the flame dimmer.",
    "Make the flame green."
  ];

  function chipMarkup() {
    var out = "";
    for (var i = 0; i < CHIPS.length; i++) {
      out += '<button type="button" class="chip">' + CHIPS[i] + "</button>";
    }
    return out;
  }

  function template(mode) {
    var page = mode === "page";
    var brand = page
      ? '<a class="brand" href="/">' + MARK_SVG + '<span class="brand-name">Chama Inteligente</span></a>'
      : "";
    var fullscreen = page
      ? ""
      : '<button type="button" class="leave-link" id="leave-room">Back to page</button>' +
        '<a class="fullscreen-link" href="/agent">Full screen</a>';
    var siteLink = page ? ' &middot; <a href="/">chamainteligente.com</a>' : ".";

    return '' +
      '<a class="skip-link" href="#composer-input">Skip to the message box</a>' +

      '<canvas class="flame-canvas" id="flame" aria-hidden="true"></canvas>' +
      '<div class="vignette" aria-hidden="true"></div>' +
      '<div class="scrim" id="scrim" aria-hidden="true"></div>' +

      '<div class="tune-pop" id="tune-pop" role="dialog" aria-label="Tune the flame" aria-modal="false" hidden>' +
        '<div class="tune-head">' +
          '<span class="tune-title">Tune the flame</span>' +
          '<button type="button" class="tune-reset" id="tune-reset">Reset</button>' +
        '</div>' +
        '<div class="tune-row">' +
          '<label for="set-brightness">Brightness <span id="val-brightness">85</span></label>' +
          '<input type="range" id="set-brightness" min="20" max="100" step="1" value="85">' +
        '</div>' +
        '<div class="tune-row">' +
          '<label for="set-motion">Motion <span id="val-motion">100</span></label>' +
          '<input type="range" id="set-motion" min="20" max="100" step="1" value="100">' +
        '</div>' +
        '<div class="tune-row">' +
          '<label for="set-hue">Colour <span id="val-hue">20</span></label>' +
          '<div class="hue-row">' +
            '<input type="range" id="set-hue" class="hue-slider" min="0" max="360" step="1" value="20">' +
            '<span class="swatch" id="hue-swatch" aria-hidden="true"></span>' +
          '</div>' +
        '</div>' +
        '<div class="tune-row">' +
          '<p class="tune-legend" id="seg-label">Text <span></span></p>' +
          '<div class="seg" role="radiogroup" aria-labelledby="seg-label" id="seg-text">' +
            '<button type="button" role="radio" data-value="off" aria-checked="false" tabindex="-1">Off</button>' +
            '<button type="button" role="radio" data-value="subtle" aria-checked="true" tabindex="0">Subtle</button>' +
            '<button type="button" role="radio" data-value="full" aria-checked="false" tabindex="-1">Full</button>' +
          '</div>' +
        '</div>' +
        '<p class="tune-note" id="tune-note">Yours for this visit. The agent can adjust these for you if you ask.</p>' +
      '</div>' +

      '<div class="shell">' +
        '<header class="topbar">' +
          brand +
          '<div class="topbar-right">' +
            '<p class="hud" id="hud">' +
              '<span class="visually-hidden">Session readout.</span>' +
              '<span class="hud-model">Model <b id="hud-model">claude-sonnet-5</b></span>' +
              '<span class="sep hud-model" aria-hidden="true">&middot;</span>' +
              '<span class="hud-model">Effort <b id="hud-effort">&middot;&middot;&middot;</b></span>' +
              '<span class="sep" aria-hidden="true">&middot;</span>' +
              '<span>Turns <b id="hud-turns">0</b></span>' +
              '<span class="sep opt" aria-hidden="true">&middot;</span>' +
              '<span class="opt">Tokens <b id="hud-tokens">&middot;&middot;&middot;</b></span>' +
              '<span class="sep opt" aria-hidden="true">&middot;</span>' +
              '<span class="opt">Cache <b id="hud-cache">&middot;&middot;&middot;</b></span>' +
              '<span class="sep hud-latency" aria-hidden="true">&middot;</span>' +
              '<span class="hud-latency">Latency <b id="hud-latency">&middot;&middot;&middot;</b></span>' +
            '</p>' +
            fullscreen +
            '<div class="tune-wrap">' +
              '<button type="button" class="tune-btn" id="tune-btn" aria-expanded="false" aria-controls="tune-pop" aria-haspopup="dialog">Tune</button>' +
            '</div>' +
          '</div>' +
        '</header>' +

        '<main class="stage" id="stage">' +
          '<div class="column">' +
            '<section class="opening" id="opening">' +
              '<h1>You are talking to the <em>intelligent flame</em>.</h1>' +
              '<p>Start your conversation with Chama Inteligente here. Ask questions, ask to be contacted, or reshape the flame with your words.</p>' +
              '<div class="chips" id="chips">' + chipMarkup() + '</div>' +
            '</section>' +
            '<div id="transcript" role="log" aria-live="polite" aria-label="Conversation with the agent"></div>' +
          '</div>' +
        '</main>' +

        '<div class="composer">' +
          '<div class="composer-inner">' +
            '<div class="suggest" id="suggest" hidden>' +
              '<div class="suggest-track" id="suggest-track" role="list" aria-label="Suggested prompts"></div>' +
            '</div>' +
            '<form class="bar" id="bar" autocomplete="off">' +
              '<label class="visually-hidden" for="composer-input">Your message to the agent</label>' +
              '<textarea id="composer-input" rows="1" maxlength="4000" placeholder="Say something." enterkeyhint="send"></textarea>' +
              '<button type="submit" class="send" id="send" aria-label="Send message">' +
                '<svg class="send-arrow" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>' +
                '<span class="send-orb" aria-hidden="true"></span>' +
              '</button>' +
            '</form>' +
            '<p class="fineprint">Conversations are saved to improve the agent. A note reaches Elliot only when you confirm it. The agent can make mistakes. <a href="/privacy">Privacy</a>' + siteLink + '</p>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* One id per app instance, generated on mount and sent with every request
     so the server can keep the whole conversation in a single record. It is
     not persisted: a reload starts a new conversation. */
  function newConversationId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
    } catch (e) { /* fall through to the random hex below */ }

    var hex = "";
    try {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      for (var i = 0; i < bytes.length; i++) {
        hex += (bytes[i] + 0x100).toString(16).slice(1);
      }
      return hex;
    } catch (e2) { /* fall through to Math.random below */ }

    for (var j = 0; j < 32; j++) {
      hex += Math.floor(Math.random() * 16).toString(16);
    }
    return hex;
  }

  function mount(rootEl, options) {
    if (!rootEl) return null;
    var mode = (options && options.mode) === "page" ? "page" : "embed";

    var conversationId = newConversationId();

    rootEl.className = "chama-agent chama-agent-mode-" + mode;
    if (mode === "page") {
      document.documentElement.classList.add("chama-agent-page");
      document.body.classList.add("chama-agent-page");
    }
    rootEl.innerHTML = template(mode);

    function pick(id) { return rootEl.querySelector("#" + id); }

    var reduceMotion = false;
    try {
      reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { reduceMotion = false; }

    // A phone is not a small desktop: it has a soft keyboard that moves the
    // viewport out from under the page, and a fill rate a fraction of the one
    // the fire was written against. Both answers below hang off this.
    var touchDevice = false;
    try {
      touchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    } catch (e3) { touchDevice = false; }

    /* ==================================================================
       SETTINGS
       One source of truth for brightness, motion and text animation.
       Nothing is persisted: settings live for the lifetime of the page, and
       every load starts the flame from its defaults.
       ================================================================== */

    var STALE_KEYS = ["chama.agent.tune.v1", "chama.agent.tune.v2"];
    var TEXT_MODES = { off: 1, subtle: 1, full: 1 };

    // position is null until someone chooses one: null means the flame's home,
    // which differs between wide screens and mobile.
    var DEFAULTS = {
      brightness: 0.85, motion: 1, textAnimation: "subtle", hue: 20,
      size: 1, speed: 1, turbulence: 0.5, density: 1, angle: 0,
      position: null, sparkle: 0.5
    };

    var settings = {};
    function toDefaults() {
      for (var k in DEFAULTS) settings[k] = DEFAULTS[k];
    }
    toDefaults();

    function clampNum(v, lo, hi) {
      if (typeof v !== "number" || !isFinite(v)) return null;
      if (v < lo) return lo;
      if (v > hi) return hi;
      return v;
    }
    function clampHue(v) {
      if (typeof v !== "number" || !isFinite(v)) return null;
      return ((v % 360) + 360) % 360;
    }

    // every numeric field and its range, in one place: load, config events and
    // the panel all read the ranges from here
    var RANGES = {
      brightness: [0.2, 1], motion: [0.2, 1], size: [0.3, 1.6], speed: [0.2, 2],
      turbulence: [0, 1], density: [0.2, 1.5], sparkle: [0, 1], position: [0, 1]
    };

    function clampField(name, v) {
      if (name === "hue") return clampHue(v);
      if (name === "angle") return clampHue(v);           // degrees, wraps
      var r = RANGES[name];
      return r ? clampNum(v, r[0], r[1]) : null;
    }

    // earlier versions kept the tune in localStorage; sweep those keys away so
    // no visitor is left carrying a setting the page no longer reads
    function forgetStoredSettings() {
      try {
        for (var k = 0; k < STALE_KEYS.length; k++) window.localStorage.removeItem(STALE_KEYS[k]);
      } catch (e) { /* private mode, blocked storage: nothing to forget */ }
    }

    forgetStoredSettings();

    /* ==================================================================
       THE FLAME, AT ARM'S LENGTH

       The fire itself lives in flame.js. This half owns the element, the box
       it is measured against, the listeners and the CSS custom properties;
       the engine owns the pixels. They meet at one handle with one method
       surface, and the handle is built one of two ways.

       On a desktop the engine runs inline on this thread, exactly the code
       path the fire has always had, with emit applied synchronously.

       On a touch device that can do it, the canvas is handed to a worker and
       the fire burns on a thread of its own, which is the whole difference
       between a phone that scrolls and one that stutters. The feature tests
       all run before the handover, because a canvas can only be given away
       once and a fallback needs one that still draws.
       ================================================================== */

    var canvas = rootEl.querySelector(".flame-canvas");

    // what the engine emits, applied to the room. Two properties and two
    // numbers the wisp reads; nothing else crosses back.
    var flameHue = settings.hue;
    var flameCool = 0;
    var flameFrames = 0;

    function onEmit(type, payload) {
      if (type === "hue") {
        rootEl.style.setProperty("--flamecolor", payload.flamecolor);
        flameHue = payload.hue;
      } else if (type === "light") {
        rootEl.style.setProperty("--flamelight", payload);
      } else if (type === "cool") {
        flameCool = payload;
      } else if (type === "frames") {
        flameFrames = payload;
      }
    }

    // a worker is worth it only when every piece is there: the constructor,
    // the handover, OffscreenCanvas, and a 2d context out of one, which
    // Safari shipped a good while after the constructor itself
    function workerEligible() {
      if (!touchDevice) return false;
      if (!window.Worker || !canvas.transferControlToOffscreen) return false;
      if (typeof OffscreenCanvas === "undefined") return false;
      try {
        return !!(new OffscreenCanvas(1, 1)).getContext("2d");
      } catch (e) { return false; }
    }

    var flameWorker = null;

    function makeFlame() {
      if (workerEligible()) {
        try {
          var w = new Worker("/assets/flame-worker.js");
          w.onmessage = function (ev) {
            var m = ev.data;
            if (m && m.type) onEmit(m.type, m.payload);
          };
          var off = canvas.transferControlToOffscreen();
          w.postMessage({
            type: "init", canvas: off, touchDevice: touchDevice,
            reduceMotion: reduceMotion, settings: settings
          }, [off]);
          flameWorker = w;
          function post(type) {
            return function () {
              w.postMessage({ type: type, args: Array.prototype.slice.call(arguments) });
            };
          }
          return {
            resize: post("resize"), start: post("start"), stop: post("stop"),
            pointer: post("pointer"), pointerSeed: post("pointerSeed"),
            pointerEnd: post("pointerEnd"), tap: post("tap"),
            press: post("press"), pressEnd: post("pressEnd"),
            setState: post("state"), flicker: post("flicker"),
            launchSpark: post("spark"), set: post("set"), setTau: post("tau"),
            setDim: post("dim"), wake: post("wake"),
            drawStatic: post("drawStatic"), setReduceMotion: post("reduceMotion"),
            // the scroll hack buys a phone back half its frames when the fire
            // and the finger share a thread. Here they do not, so it is not
            // wanted and the host never calls it.
            noteScroll: function () {}
          };
        } catch (e) { /* no worker: the canvas is untouched, fall through */ }
      }
      return window.ChamaFlame.create({
        canvas: canvas, touchDevice: touchDevice,
        reduceMotion: reduceMotion, settings: settings, emit: onEmit
      });
    }

    var flame = makeFlame();
    var flameRunning = false;

    // the engine trusts what it is given; the clamping all happened above
    function pushSettings() {
      flame.set({
        brightness: settings.brightness, motion: settings.motion, hue: settings.hue,
        size: settings.size, speed: settings.speed, turbulence: settings.turbulence,
        density: settings.density, angle: settings.angle,
        position: settings.position, sparkle: settings.sparkle
      });
    }
    pushSettings();

    // reduced motion: the still frame is repainted from the settings as they
    // stand, which is the only way the flame moves at all in that mode
    function staticRepaint() {
      pushSettings();
      flame.drawStatic();
    }

    function startLoop() {
      if (reduceMotion) return;
      flameRunning = true;
      flame.start();
    }

    function stopLoop() {
      flameRunning = false;
      flame.stop();
    }

    function setState(next) { flame.setState(next); }
    function flicker(n) { flame.flicker(n); }
    function launchSpark() { flame.launchSpark(); }

    /* ---- the pointer, strictly local ------------------------------------
       There is no page wide breeze. Every listener is bound to the root, so
       the rest of the page is silent, and client coordinates are turned into
       the room's own coordinates here, because the box is this half's.     */
    function toLocal(clientX, clientY) {
      var r = rootEl.getBoundingClientRect();
      return [clientX - r.left, clientY - r.top];
    }

    rootEl.addEventListener("pointermove", function (ev) {
      if (ev.pointerType === "touch") return;   // touch is handled below
      var p = toLocal(ev.clientX, ev.clientY);
      flame.pointer(p[0], p[1], performance.now());
    }, { passive: true });

    // the pointer leaving the box is the pointer ceasing to exist for the fire
    rootEl.addEventListener("pointerleave", function () {
      flame.pointerEnd();
    }, { passive: true });

    /* Touch. Every listener is passive and nothing is ever prevented, so
       scrolling the transcript, scrolling the page around the embed, and
       typing all stay completely unaffected.

       A touch is one of three things, and the difference is only ever time
       and distance: a quick release throws sparks, a travelling finger is a
       pointer moving through the fire, and a finger that lands and stays put
       is a press, which the flame leans toward. */
    var touchStart = null;
    var pressTimer = 0;
    var pressing = false;
    var PRESS_HOLD = 180;      // ms of stillness before a touch is a press
    var PRESS_SLOP = 14;       // px of drift a press is allowed to keep

    function onUi(node) {
      if (!node || !node.closest) return true;
      return !!node.closest(".topbar, .composer, .tune-pop, a, button, input, textarea, label");
    }

    function endPress() {
      if (pressTimer) { window.clearTimeout(pressTimer); pressTimer = 0; }
      if (pressing) { pressing = false; flame.pressEnd(); }
    }

    rootEl.addEventListener("touchstart", function (ev) {
      var t = ev.touches[0];
      if (!t) return;
      endPress();
      var p = toLocal(t.clientX, t.clientY);
      var at = performance.now();
      flame.pointerSeed(p[0], p[1], at);
      touchStart = { x: p[0], y: p[1], cx: p[0], cy: p[1], at: at, ui: onUi(ev.target), far: false };
      if (touchStart.ui) return;
      pressTimer = window.setTimeout(function () {
        pressTimer = 0;
        var st = touchStart;
        if (!st || st.far) return;
        pressing = true;
        flame.press(st.cx, st.cy);
      }, PRESS_HOLD);
    }, { passive: true });

    rootEl.addEventListener("touchmove", function (ev) {
      var t = ev.touches[0];
      if (!t) return;
      var p = toLocal(t.clientX, t.clientY);
      if (touchStart) {
        touchStart.cx = p[0];
        touchStart.cy = p[1];
        var drift = Math.abs(p[0] - touchStart.x) + Math.abs(p[1] - touchStart.y);
        if (drift > PRESS_SLOP) {
          touchStart.far = true;
          endPress();
        } else if (pressing) {
          flame.press(p[0], p[1]);      // a press is allowed to breathe
        }
      }
      flame.pointer(p[0], p[1], performance.now());
    }, { passive: true });

    rootEl.addEventListener("touchend", function (ev) {
      var st = touchStart;
      touchStart = null;
      var wasPressing = pressing;
      endPress();
      if (!st || st.ui) return;
      var t = ev.changedTouches && ev.changedTouches[0];
      if (!t) return;
      var p = toLocal(t.clientX, t.clientY);
      var moved = Math.abs(p[0] - st.x) + Math.abs(p[1] - st.y);
      if (wasPressing || moved > PRESS_SLOP || performance.now() - st.at > 520) return;
      // a tap in empty space, over the conversation, or over UI does nothing
      flame.tap(p[0], p[1]);
    }, { passive: true });

    rootEl.addEventListener("touchcancel", function () {
      touchStart = null;
      endPress();
    }, { passive: true });

    // ---- sizing ---------------------------------------------------------
    // the engine keeps its own pixel budget; what it needs from here is the
    // size of the box and the density of the screen
    function layout() {
      var rect = rootEl.getBoundingClientRect();
      flame.resize(rect.width, rect.height, window.devicePixelRatio || 1);
    }

    var resizeTimer = null;
    function scheduleLayout() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        layout();
        placeScrim();
        updateFades();
        // a narrower box rewraps what is already typed
        if (input) autoGrow();
      }, 140);
    }

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(scheduleLayout);
      ro.observe(rootEl);
    }
    // the fallback, and the case a resize moves the box without resizing it
    window.addEventListener("resize", scheduleLayout, { passive: true });

    /* A phone cannot paint the fire and move a scroll in the same frame, and
       when it has to choose it drops the scroll, which is the one thing the
       hand is holding. So while anything is scrolling the fire paints every
       other frame: dt still measures the real interval, so it burns at its
       own speed, on half the frames, and the finger gets the rest. In worker
       mode there is no such competition and the engine ignores this.       */
    function noteScroll() { flame.noteScroll(); }

    if (touchDevice) {
      window.addEventListener("scroll", noteScroll, { passive: true });
      window.addEventListener("touchmove", noteScroll, { passive: true });
    }

    layout();

    /* ==================================================================
       THE CONVERSATION
       ================================================================== */

    var stage = pick("stage");
    var transcript = pick("transcript");
    var opening = pick("opening");
    var chips = pick("chips");
    var form = pick("bar");
    var input = pick("composer-input");
    var sendBtn = pick("send");

    var hud = {
      turns: pick("hud-turns"),
      tokens: pick("hud-tokens"),
      cache: pick("hud-cache"),
      latency: pick("hud-latency"),
      model: pick("hud-model"),
      effort: pick("hud-effort")
    };

    var suggest = pick("suggest");
    var suggestTrack = pick("suggest-track");
    var scrim = pick("scrim");
    var tuneBtn = pick("tune-btn");
    var tunePop = pick("tune-pop");
    var setBright = pick("set-brightness");
    var setMotion = pick("set-motion");
    var valBright = pick("val-brightness");
    var valMotion = pick("val-motion");
    var setHue = pick("set-hue");
    var valHue = pick("val-hue");
    var segText = pick("seg-text");
    var segButtons = segText.querySelectorAll("button");

    var history = [];
    var busy = false;
    var turns = 0;
    var totalTokens = 0;
    var openingGone = false;

    var GENERIC = "Something went wrong. Please try again.";

    /* ---- the suggestion row -------------------------------------------- */
    // The opening chips are the single source of truth for the prompts. Once
    // the conversation starts they continue as a slim row above the composer,
    // minus whatever the visitor has already used.
    var PROMPTS = (function () {
      var out = [];
      var nodes = chips.querySelectorAll(".chip");
      for (var i = 0; i < nodes.length; i++) out.push(nodes[i].textContent);
      return out;
    })();
    var usedPrompts = {};

    function updateFades() {
      var over = suggestTrack.scrollWidth - suggestTrack.clientWidth;
      var left = suggestTrack.scrollLeft;
      suggest.style.setProperty("--fade-l", (over > 2 && left > 2) ? "18px" : "0px");
      suggest.style.setProperty("--fade-r", (over > 2 && left < over - 2) ? "22px" : "0px");
    }

    function renderSuggestions() {
      var talking = transcript.childNodes.length > 0;
      var left = [];
      for (var i = 0; i < PROMPTS.length; i++) {
        if (!usedPrompts[PROMPTS[i]]) left.push(PROMPTS[i]);
      }

      if (!talking || busy || !left.length) {
        if (!suggest.hasAttribute("hidden")) {
          suggest.setAttribute("hidden", "");
          suggest.classList.remove("in");
        }
        return;
      }

      var same = suggestTrack.children.length === left.length;
      if (same) {
        for (var j = 0; j < left.length; j++) {
          if (suggestTrack.children[j].textContent !== left[j]) { same = false; break; }
        }
      }
      if (!same) {
        suggestTrack.textContent = "";
        for (var k = 0; k < left.length; k++) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "pill";
          b.setAttribute("role", "listitem");
          b.textContent = left[k];
          suggestTrack.appendChild(b);
        }
      }

      if (suggest.hasAttribute("hidden")) {
        suggest.removeAttribute("hidden");
        if (!reduceMotion) {
          suggest.classList.remove("in");
          void suggest.offsetWidth;
          suggest.classList.add("in");
        }
      }
      updateFades();
    }

    suggestTrack.addEventListener("scroll", updateFades, { passive: true });

    suggestTrack.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest(".pill") : null;
      if (b) send(b.textContent);
    });

    suggestTrack.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        input.focus();
      }
    });

    /* ---- legibility: auto dim plus the readability scrim ---------------- */

    function placeScrim() {
      var col = rootEl.querySelector(".column");
      if (!col) return;
      var box = rootEl.getBoundingClientRect();
      var left = col.getBoundingClientRect().left - box.left;
      var pct = box.width ? (left / box.width) * 100 : 45;
      if (pct < 0) pct = 0;
      rootEl.style.setProperty("--scrim-left", pct.toFixed(1) + "%");
    }

    function refreshLegibility() {
      var busyTalking = transcript.childNodes.length > 0;
      flame.setDim(busyTalking ? 0.62 : 1);
      scrim.classList.toggle("on", busyTalking);
      placeScrim();
      renderSuggestions();
      if (reduceMotion) staticRepaint();
    }

    /* ---- the tune panel ------------------------------------------------- */

    function syncControls() {
      var b = Math.round(settings.brightness * 100);
      var m = Math.round(settings.motion * 100);
      setBright.value = String(b);
      setMotion.value = String(m);
      valBright.textContent = String(b);
      valMotion.textContent = String(m);
      setBright.style.setProperty("--fill", ((b - 20) / 80 * 100).toFixed(1) + "%");
      setMotion.style.setProperty("--fill", ((m - 20) / 80 * 100).toFixed(1) + "%");
      var h = Math.round(settings.hue);
      setHue.value = String(h);
      valHue.textContent = String(h);
      for (var i = 0; i < segButtons.length; i++) {
        var on = segButtons[i].getAttribute("data-value") === settings.textAnimation;
        segButtons[i].setAttribute("aria-checked", on ? "true" : "false");
        segButtons[i].tabIndex = on ? 0 : -1;
      }
    }

    function popOpen() { return !tunePop.hasAttribute("hidden"); }

    function openTune() {
      tunePop.removeAttribute("hidden");
      tuneBtn.setAttribute("aria-expanded", "true");
      tuneBtn.classList.remove("touched");
      syncControls();
      setBright.focus();
    }

    function closeTune(refocus) {
      if (!popOpen()) return;
      tunePop.setAttribute("hidden", "");
      tuneBtn.setAttribute("aria-expanded", "false");
      if (refocus) tuneBtn.focus();
    }

    tuneBtn.addEventListener("click", function () {
      if (popOpen()) closeTune(true); else openTune();
    });

    // app-wide, but deaf to keys pressed outside the app when it is embedded
    document.addEventListener("keydown", function (ev) {
      if (mode !== "page" && !rootEl.contains(ev.target)) return;
      if (ev.key === "Escape" && popOpen()) {
        ev.stopPropagation();
        closeTune(true);
      }
    });

    // a press anywhere outside the popover dismisses it, including elsewhere
    // on the host page: leaving it stranded open would be worse than global
    document.addEventListener("pointerdown", function (ev) {
      if (!popOpen()) return;
      if (tunePop.contains(ev.target) || tuneBtn.contains(ev.target)) return;
      closeTune(false);
    });

    function onSlider(ev) {
      flame.setTau(0.08);                      // live under the hand
      if (ev.target === setHue) {
        settings.hue = clampHue(Number(ev.target.value)) || 0;
      } else {
        var v = Number(ev.target.value) / 100;
        if (ev.target === setBright) settings.brightness = v; else settings.motion = v;
      }
      syncControls();
      pushSettings();
      if (reduceMotion) staticRepaint();
    }
    setBright.addEventListener("input", onSlider);
    setMotion.addEventListener("input", onSlider);
    setHue.addEventListener("input", onSlider);

    function chooseText(m) {
      if (!TEXT_MODES[m]) return;
      settings.textAnimation = m;
      syncControls();
    }

    segText.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("button") : null;
      if (b) chooseText(b.getAttribute("data-value"));
    });

    segText.addEventListener("keydown", function (ev) {
      var order = ["off", "subtle", "full"];
      var at = order.indexOf(settings.textAnimation);
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
        ev.preventDefault();
        chooseText(order[(at + 1) % order.length]);
        segText.querySelector('[aria-checked="true"]').focus();
      } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
        ev.preventDefault();
        chooseText(order[(at + order.length - 1) % order.length]);
        segText.querySelector('[aria-checked="true"]').focus();
      }
    });

    pick("tune-reset").addEventListener("click", function () {
      flame.setTau(0.3);
      resetAll();                 // the seven the panel does not show go too
      syncControls();
      pushSettings();
      if (reduceMotion) staticRepaint();
    });

    // the agent's hand: a config event from the model moves the same dials,
    // eased over about 1.2 seconds so the room visibly changes
    // what the visitor is told when the agent reaches for a dial. The order
    // here is the order the words come out in.
    var FIELD_WORDS = [
      ["brightness", "brightness"],
      ["motion", "motion"],
      ["hue", "color"],
      ["size", "size"],
      ["speed", "speed"],
      ["turbulence", "turbulence"],
      ["density", "density"],
      ["angle", "direction"],
      ["position", "position"],
      ["sparkle", "sparkle"],
      ["textAnimation", "text animation"]
    ];

    function joinWords(list) {
      if (list.length === 1) return list[0];
      if (list.length === 2) return list[0] + " and " + list[1];
      return list.slice(0, -1).join(", ") + " and " + list[list.length - 1];
    }

    function configSentence(changed) {
      if (!changed.length) return "";
      if (changed.length === 1 && changed[0] === "text animation") {
        return "The agent changed the text animation.";
      }
      var flame = [], other = [];
      for (var i = 0; i < changed.length; i++) {
        if (changed[i] === "text animation") other.push(changed[i]); else flame.push(changed[i]);
      }
      if (!flame.length) return "The agent changed the " + joinWords(other) + ".";
      var line = "The agent changed the flame's " + joinWords(flame);
      if (other.length) line += ", and the " + joinWords(other);
      return line + ".";
    }

    // the eased mirrors are left where they are on purpose: the frame loop
    // walks them home, so a reset glides rather than snapping
    function resetAll() {
      toDefaults();
    }

    function applyAgentConfig(payload) {
      if (!payload || typeof payload !== "object") return null;

      // reset wins outright and ignores the rest of the call
      if (payload.reset === true) {
        flame.setTau(0.42);
        resetAll();
        afterConfig();
        return "The agent restored the flame's defaults.";
      }

      var changed = [];
      for (var f = 0; f < FIELD_WORDS.length; f++) {
        var name = FIELD_WORDS[f][0], word = FIELD_WORDS[f][1];
        var raw = payload[name];
        if (raw === null || raw === undefined) continue;

        if (name === "textAnimation") {
          if (typeof raw === "string" && TEXT_MODES[raw] && raw !== settings.textAnimation) {
            settings.textAnimation = raw;
            changed.push(word);
          }
          continue;
        }
        var v = clampField(name, raw);
        if (v === null || v === settings[name]) continue;
        settings[name] = v;
        changed.push(word);
      }

      if (!changed.length) return null;
      flame.setTau(0.42);                       // roughly 1.2s to settle
      afterConfig();
      return configSentence(changed);
    }

    // everything a settings change has to do once the values are in place
    function afterConfig() {
      pushSettings();
      if (reduceMotion) staticRepaint();
      if (popOpen()) {
        syncControls();
      } else {
        tuneBtn.classList.remove("touched");
        void tuneBtn.offsetWidth;               // restart the one shot
        tuneBtn.classList.add("touched");
      }
    }

    syncControls();
    placeScrim();

    function nearBottom() {
      return stage.scrollHeight - stage.scrollTop - stage.clientHeight < 140;
    }
    function stick(wasNear) {
      if (wasNear) stage.scrollTop = stage.scrollHeight;
    }

    function dissolveOpening() {
      if (openingGone || !opening) return;
      openingGone = true;
      if (reduceMotion) {
        opening.remove();
        return;
      }
      opening.classList.add("dissolving");
      setTimeout(function () { if (opening.parentNode) opening.remove(); }, 480);
    }

    function addTurn(who, text) {
      var wasNear = nearBottom();
      var el = document.createElement("article");
      el.className = "turn " + (who === "you" ? "turn-you" : "turn-flame");
      var label = document.createElement("span");
      label.className = "turn-label";
      label.textContent = who === "you" ? "You" : "The flame";
      var body = document.createElement("p");
      body.className = "turn-body";
      if (text) body.textContent = text;
      el.appendChild(label);
      el.appendChild(body);
      transcript.appendChild(el);
      trailThinking();
      refreshLegibility();
      stick(wasNear);
      return body;
    }

    function addSystem(text, ok) {
      var wasNear = nearBottom();
      var el = document.createElement("p");
      el.className = "turn-system" + (ok ? " ok" : "");
      el.textContent = text;
      transcript.appendChild(el);
      trailThinking();
      refreshLegibility();
      stick(wasNear);
    }

    /* ---- the wisp ---------------------------------------------------------
       The waiting mark is not an icon of a flame, it is a piece of the flame:
       a canvas a couple of dozen pixels across in which a handful of real
       particles are born at the bottom, rise a few pixels, cool and die. It
       takes its colour from the same hue the fire is burning right now, and
       from the same cool blue grey when the fire is in its error state, so
       recolouring the flame recolours the waiting with it.

       Exactly one wisp is alive at a time: the indicator that holds the place
       of a reply, or the cursor at the end of the text while it streams. A new
       one puts out the one before it, and a wisp whose node has left the page
       stops its loop on its next frame, so nothing animates off screen.      */

    var WISP_W = 26, WISP_H = 30, WISP_N = 20;
    var activeWisp = null;
    var stageLive = true;   // the stage is on screen and the tab is in front

    function makeWisp() {
      if (activeWisp) activeWisp.destroy();

      var cv = document.createElement("canvas");
      cv.className = "wisp";
      cv.setAttribute("aria-hidden", "true");
      cv.width = Math.round(WISP_W * wispDpr());
      cv.height = Math.round(WISP_H * wispDpr());
      var c = cv.getContext("2d");
      c.setTransform(wispDpr(), 0, 0, wispDpr(), 0, 0);

      var px = new Float32Array(WISP_N), py = new Float32Array(WISP_N);
      var pvx = new Float32Array(WISP_N), pvy = new Float32Array(WISP_N);
      var pa = new Float32Array(WISP_N), pl = new Float32Array(WISP_N);
      var pr = new Float32Array(WISP_N);
      var raf = 0, last = 0, dead = false, seeded = false;

      function birth(i, stagger) {
        px[i] = WISP_W * 0.5 + (Math.random() - 0.5) * 4.6;
        py[i] = WISP_H - 4.5 + Math.random() * 1.6;
        pvx[i] = (Math.random() - 0.5) * 5.2;
        pvy[i] = -(8 + Math.random() * 12);
        pl[i] = 0.78 + Math.random() * 0.66;
        pr[i] = 1 + Math.random() * 1.5;
        pa[i] = stagger ? Math.random() * pl[i] : 0;
      }

      /* The box is a window on the fire, not a frame around it: every edge is
         ramped to nothing, so a particle drifting out cannot leave a straight
         line behind and the glow never shows the canvas it is drawn on. */
      var mask = document.createElement("canvas");
      (function () {
        mask.width = cv.width;
        mask.height = cv.height;
        var mc = mask.getContext("2d");
        mc.setTransform(wispDpr(), 0, 0, wispDpr(), 0, 0);
        mc.fillStyle = "#fff";
        mc.fillRect(0, 0, WISP_W, WISP_H);
        mc.globalCompositeOperation = "destination-out";
        function ramp(x0, y0, x1, y1, rx, ry, rw, rh) {
          var g = mc.createLinearGradient(x0, y0, x1, y1);
          g.addColorStop(0, "rgba(0,0,0,1)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          mc.fillStyle = g;
          mc.fillRect(rx, ry, rw, rh);
        }
        ramp(0, WISP_H, 0, WISP_H - 5, 0, WISP_H - 5, WISP_W, 5);
        ramp(0, 0, 0, 4, 0, 0, WISP_W, 4);
        ramp(0, 0, 4.5, 0, 0, 0, 4.5, WISP_H);
        ramp(WISP_W, 0, WISP_W - 4.5, 0, WISP_W - 4.5, 0, 4.5, WISP_H);
      })();

      function feather() {
        c.globalCompositeOperation = "destination-in";
        c.drawImage(mask, 0, 0, WISP_W, WISP_H);
        c.globalCompositeOperation = "source-over";
      }

      // the colour of a particle at age t, from the fire's own ramp, with the
      // error state's cool blue grey blended in exactly as the big field does
      function tint(t) {
        var rgb = window.ChamaFlame.rampColor(t, flameHue);
        var r = rgb[0], g = rgb[1], b = rgb[2];
        if (flameCool) {
          r = window.ChamaFlame.mix(r * 0.55, 168, 0.45);
          g = window.ChamaFlame.mix(g * 0.72, 186, 0.45);
          b = window.ChamaFlame.mix(b * 1.6 + 60, 210, 0.45);
        }
        return Math.round(r) + "," + Math.round(g) + "," + Math.round(b);
      }

      function dot(x, y, radius, rgb, alpha) {
        var grad = c.createRadialGradient(x, y, 0, x, y, radius);
        grad.addColorStop(0, "rgba(" + rgb + "," + alpha.toFixed(3) + ")");
        grad.addColorStop(0.45, "rgba(" + rgb + "," + (alpha * 0.42).toFixed(3) + ")");
        grad.addColorStop(1, "rgba(" + rgb + ",0)");
        c.fillStyle = grad;
        c.beginPath();
        c.arc(x, y, radius, 0, Math.PI * 2);
        c.fill();
      }

      function paint() {
        c.clearRect(0, 0, WISP_W, WISP_H);
        c.globalCompositeOperation = "lighter";
        for (var i = 0; i < WISP_N; i++) {
          if (pa[i] < 0) continue;
          var t = pa[i] / pl[i];
          if (t > 1) t = 1;
          var fade = t < 0.22 ? t / 0.22 : (1 - t) / 0.78;
          dot(px[i], py[i], pr[i] * (1.9 + t * 1.5), tint(t), 0.34 * fade + 0.03);
        }
        feather();
      }

      // reduced motion: a few dim points, drawn once, never touched again
      function still() {
        c.clearRect(0, 0, WISP_W, WISP_H);
        c.globalCompositeOperation = "lighter";
        var at = [[0.5, 0.80, 0.10], [0.36, 0.64, 0.42], [0.62, 0.55, 0.55], [0.46, 0.38, 0.74], [0.54, 0.22, 0.92]];
        for (var i = 0; i < at.length; i++) {
          dot(WISP_W * at[i][0], WISP_H * at[i][1], 3.1, tint(at[i][2]), 0.34);
        }
        feather();
      }

      function step(now) {
        raf = 0;
        if (dead || !cv.isConnected) { stop(); return; }
        var dt = last ? Math.min(now - last, 60) / 1000 : 0.016;
        last = now;
        for (var i = 0; i < WISP_N; i++) {
          pa[i] += dt;
          if (pa[i] >= pl[i]) { birth(i, false); continue; }
          var t = pa[i] / pl[i];
          pvy[i] += (-16 - 26 * (1 - t)) * dt;      // buoyant while hot
          pvx[i] += (Math.sin((now * 0.004) + i * 1.7) * 11 - pvx[i] * 1.6) * dt;
          px[i] += pvx[i] * dt;
          py[i] += pvy[i] * dt;
          if (py[i] < -3) pa[i] = pl[i];
        }
        paint();
        raf = requestAnimationFrame(step);
      }

      function start() {
        if (dead || raf || reduceMotion) return;
        if (!seeded) {
          for (var i = 0; i < WISP_N; i++) birth(i, true);
          seeded = true;
        }
        last = 0;
        raf = requestAnimationFrame(step);
      }

      function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }

      var api = {
        el: cv,
        start: start,
        stop: stop,
        destroy: function () {
          dead = true;
          stop();
          if (cv.parentNode) cv.parentNode.removeChild(cv);
          if (activeWisp === api) activeWisp = null;
        }
      };

      activeWisp = api;
      if (reduceMotion) still(); else syncWisp();
      return api;
    }

    function wispDpr() { return Math.min(window.devicePixelRatio || 1, 2); }

    function syncWisp() {
      if (!activeWisp) return;
      if (stageLive && !document.hidden) activeWisp.start(); else activeWisp.stop();
    }

    /* ---- the mark that holds the place of a reply -------------------------
       From the moment a message is sent until the first streamed character
       lands, the transcript ends with a wisp where the answer will be. It is
       shaped like the reply it stands in for, so when the real turn arrives
       nothing jumps. It is aria-hidden: the live region should announce the
       words, not the waiting. Anything appended while it waits (a settings
       change, a note confirmation) pushes it back to the end, so it always
       trails the conversation and never splits it.                         */

    var thinkingEl = null;

    function trailThinking() {
      if (thinkingEl && thinkingEl.parentNode === transcript) {
        transcript.appendChild(thinkingEl);   // appendChild moves it to the end
      }
    }

    function showThinking() {
      if (thinkingEl) return;
      var wasNear = nearBottom();
      var el = document.createElement("article");
      el.className = "turn turn-flame turn-thinking";
      el.setAttribute("aria-hidden", "true");
      var label = document.createElement("span");
      label.className = "turn-label";
      label.textContent = "The flame";
      var body = document.createElement("p");
      body.className = "turn-body";
      var wrap = document.createElement("span");
      wrap.className = "wisp-wrap";
      wrap.appendChild(makeWisp().el);
      body.appendChild(wrap);
      el.appendChild(label);
      el.appendChild(body);
      transcript.appendChild(el);
      thinkingEl = el;
      refreshLegibility();
      stick(wasNear);
    }

    function hideThinking() {
      if (!thinkingEl) return;
      if (activeWisp && thinkingEl.contains(activeWisp.el)) activeWisp.destroy();
      if (thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
      thinkingEl = null;
    }

    function setHudNumber(node, value) { node.textContent = value; }

    function updateHud(usage, latency) {
      setHudNumber(hud.turns, String(turns));
      if (typeof latency === "number") {
        setHudNumber(hud.latency, Math.round(latency) + " ms");
      }
      if (usage) {
        if (usage.model) hud.model.textContent = usage.model;
        if (typeof usage.effort === "string" && usage.effort) {
          hud.effort.textContent = usage.effort.toUpperCase();
        }
        var inTok = usage.inputTokens || 0;
        var outTok = usage.outputTokens || 0;
        var cacheTok = usage.cacheReadTokens || 0;
        totalTokens += inTok + outTok + cacheTok;
        setHudNumber(hud.tokens, totalTokens.toLocaleString("en-US"));
        var denom = inTok + cacheTok;
        setHudNumber(hud.cache, denom > 0 ? Math.round((cacheTok / denom) * 100) + "%" : "0%");
      }
    }

    // history is capped to the last 40 entries and must open and close on a
    // user turn, so trim any assistant entry that ends up leading.
    function payloadMessages() {
      var slice = history.slice(-40);
      while (slice.length && slice[0].role !== "user") slice.shift();
      while (slice.length && slice[slice.length - 1].role !== "user") slice.pop();
      return slice;
    }

    function setBusy(on) {
      busy = on;
      sendBtn.classList.toggle("busy", on);
      sendBtn.disabled = on;
      sendBtn.setAttribute("aria-label", on ? "The agent is replying" : "Send message");
      renderSuggestions();
    }

    /* ---- links in agent replies ------------------------------------------
       Model output is never passed through innerHTML. The settled plain text
       is scanned token by token and the turn is rebuilt from text nodes and
       anchors created with createElement.                                   */

    var TRAILING = /[.,;:!?)\]]+$/;
    var ABS_URL = /^https?:\/\/\S+$/i;
    var BARE_HOST = /^(?:[a-z0-9][-a-z0-9]*\.)+[a-z]{2,6}(?:\/\S*)?$/i;
    var SITE_PATH = /^\/(?:privacy|agent)?\/?$/i;

    function linkFor(token) {
      var text = token.replace(TRAILING, "");
      if (!text || text.length > 400) return null;
      var href = null, external = true;

      if (ABS_URL.test(text)) {
        href = text;
      } else if (SITE_PATH.test(text)) {
        return { text: text, href: text, external: false };
      } else if (BARE_HOST.test(text)) {
        href = "https://" + text;
      } else {
        return null;
      }

      try {
        var u = new URL(href);
        if (u.protocol !== "http:" && u.protocol !== "https:") return null;
        if (u.origin === window.location.origin) external = false;
        return { text: text, href: u.href, external: external };
      } catch (e) {
        return null;   // anything the parser dislikes stays plain text
      }
    }

    function linkify(container, text) {
      container.textContent = "";
      var parts = text.split(/(\s+)/);
      var buffer = "";

      function flushBuffer() {
        if (!buffer) return;
        container.appendChild(document.createTextNode(buffer));
        buffer = "";
      }

      for (var i = 0; i < parts.length; i++) {
        var token = parts[i];
        if (!token) continue;
        var hit = /\S/.test(token) ? linkFor(token) : null;
        if (!hit) { buffer += token; continue; }
        flushBuffer();
        var a = document.createElement("a");
        a.href = hit.href;
        a.textContent = hit.text;
        if (hit.external) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
        container.appendChild(a);
        buffer = token.slice(hit.text.length);   // the trailing punctuation
      }
      flushBuffer();
      if (!container.firstChild) container.appendChild(document.createTextNode(text));
    }

    // ---- streamed text painting -------------------------------------------
    // Three modes. Whatever the mode, animated fragments are folded back into
    // one settled text node as they age, and the turn is rebuilt as plain text
    // plus anchors when it ends, so selection and copy behave normally.
    function makePainter(body) {
      var pmode = reduceMotion ? "off" : settings.textAnimation;
      var pending = "";     // revealed, waiting to be painted on this frame
      var queue = "";       // arrived from the stream, not revealed yet
      var carry = 0;        // the fraction of a character left over last frame
      var last = 0;
      var raf = 0;
      var live = [];
      var settled = document.createTextNode("");
      body.appendChild(settled);

      var caret = document.createElement("span");
      caret.className = "caret";
      caret.setAttribute("aria-hidden", "true");
      caret.appendChild(makeWisp().el);     // the same wisp, now the cursor
      body.appendChild(caret);

      function settleOld(now) {
        while (live.length && now >= live[0].at + 620) {
          var it = live.shift();
          settled.data += it.text;
          if (it.node.parentNode) it.node.remove();
        }
      }

      function add(text, cls, delayMs, now) {
        var span = document.createElement("span");
        span.className = cls;
        if (delayMs) span.style.animationDelay = delayMs + "ms";
        span.textContent = text;
        body.insertBefore(span, caret);
        live.push({ node: span, text: text, at: now + (delayMs || 0) });
      }

      /* ---- the reveal rate ------------------------------------------------
         The model does not send one character at a time, it sends lumps, and
         painting a lump the moment it lands is what makes the text jump. So
         arriving text goes into a queue and is let out at a steady rate.

         The rate is not fixed: every frame the queue is drained towards empty
         on a fixed time constant, so the reveal takes about WINDOW_MS to catch
         up no matter how far behind it is. A trickle comes out gently, a burst
         comes out fast, and the paint can never fall a long way behind the
         stream. MIN_CPS keeps the last few characters of a reply from crawling
         out one frame at a time. Nothing is ever lost: end() rebuilds the turn
         from the full text, so whatever is still queued lands at once.        */
      var WINDOW_MS = 220;
      var MIN_CPS = 28;

      function schedule() {
        if (!raf) raf = requestAnimationFrame(tick);
      }

      function tick(now) {
        raf = 0;
        var dt = last ? Math.min(now - last, 100) : 16;
        last = now;
        if (queue) {
          carry += Math.max(MIN_CPS, queue.length * (1000 / WINDOW_MS)) * (dt / 1000);
          var n = Math.floor(carry);
          if (n > 0) {
            carry -= n;
            if (n > queue.length) n = queue.length;
            pending += queue.slice(0, n);
            queue = queue.slice(n);
          }
        } else {
          carry = 0;
        }
        flush();
        // a partial word held back in "full" mode waits for the next arrival,
        // exactly as it did before, so an empty queue ends the loop
        if (queue) schedule();
      }

      function flush() {
        var now = performance.now();
        settleOld(now);
        if (!pending) return;
        var wasNear = nearBottom();

        if (pmode === "off") {
          settled.data += pending;
          pending = "";
        } else if (pmode === "subtle") {
          add(pending, "frag", 0, now);
          pending = "";
        } else {
          // full: reveal whole words only, so nothing already on screen reflows
          var upto = pending.lastIndexOf(" ");
          var nl = pending.lastIndexOf("\n");
          if (nl > upto) upto = nl;
          if (upto < 0) { return; }           // hold until a word boundary lands
          var chunk = pending.slice(0, upto + 1);
          pending = pending.slice(upto + 1);
          var words = chunk.match(/\S+\s*|\s+/g) || [];
          for (var i = 0; i < words.length; i++) add(words[i], "word", i * 26, now);
        }
        stick(wasNear);
      }

      return {
        push: function (text) {
          queue += text;
          schedule();
        },
        end: function (finalText) {
          pending = "";
          queue = "";
          carry = 0;
          if (raf) { cancelAnimationFrame(raf); raf = 0; }
          if (activeWisp && caret.contains(activeWisp.el)) activeWisp.destroy();
          if (caret.parentNode) caret.remove();
          var wasNear = nearBottom();
          var text = typeof finalText === "string" ? finalText : body.textContent;
          var settle = function () {
            live.length = 0;
            linkify(body, text);
            stick(wasNear);
          };
          // in full mode the last words are still arriving on screen, so the
          // rebuild waits for them rather than snapping them into place
          if (pmode === "full" && live.length) {
            var wait = Math.max(0, live[live.length - 1].at + 560 - performance.now());
            setTimeout(settle, wait);
          } else {
            settle();
          }
        }
      };
    }

    // ---- the request -------------------------------------------------------
    function send(text) {
      var message = (text || "").replace(/\s+$/, "");
      if (!message || busy) return;

      usedPrompts[message] = true;
      dissolveOpening();
      addTurn("you", message);
      history.push({ role: "user", content: message });
      turns += 1;
      setHudNumber(hud.turns, String(turns));

      input.value = "";
      autoGrow();
      setBusy(true);
      setState("thinking");
      showThinking();

      var body = null;
      var painter = null;
      var reply = "";
      var startedAt = performance.now();
      var firstDelta = null;
      var finished = false;

      function ensureBody() {
        if (!body) {
          hideThinking();
          body = addTurn("flame", "");
          painter = makePainter(body);
        }
      }

      function fail(msg) {
        if (finished) return;
        finished = true;
        hideThinking();
        if (painter) painter.end(reply);
        addSystem(msg || GENERIC);
        setState("error");
        setTimeout(function () { setState(input === document.activeElement ? "listening" : "idle"); }, 1400);
        done();
      }

      function done() {
        setBusy(false);
        if (reply) history.push({ role: "assistant", content: reply });
      }

      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId, messages: payloadMessages() })
      }).then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error((data && data.error) || GENERIC);
          }, function () {
            throw new Error(GENERIC);
          });
        }
        if (!res.body) throw new Error(GENERIC);

        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";

        function handle(event) {
          if (!event || typeof event !== "object") return;
          if (event.type === "text" && typeof event.text === "string") {
            if (firstDelta === null) {
              firstDelta = performance.now() - startedAt;
              updateHud(null, firstDelta);
              setState("streaming");
            }
            ensureBody();
            reply += event.text;
            painter.push(event.text);
            flicker(1);
          } else if (event.type === "tool" && event.name === "send_note_to_elliot") {
            if (event.ok) {
              if (painter) painter.end(reply);
              body = null;
              if (reply) { history.push({ role: "assistant", content: reply }); reply = ""; }
              launchSpark();
              addSystem("A note was sent to Elliot.", true);
              showThinking();   // whatever it says next is still on its way
            } else {
              addSystem("The note could not be sent.");
            }
          } else if (event.type === "config") {
            var said = applyAgentConfig(event.settings);
            if (said) addSystem(said, true);
          } else if (event.type === "error") {
            addSystem(event.error || GENERIC);
            setState("error");
          } else if (event.type === "done") {
            if (event.usage) updateHud(event.usage, undefined);
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

        function drain(final) {
          var parts = buffer.split(/\r?\n\r?\n/);
          buffer = final ? "" : parts.pop();
          for (var i = 0; i < parts.length; i++) {
            var lines = parts[i].split(/\r?\n/);
            for (var j = 0; j < lines.length; j++) {
              var line = lines[j];
              if (line.indexOf("data:") !== 0) continue;
              var raw = line.slice(5).trim();
              if (!raw) continue;
              try { handle(JSON.parse(raw)); } catch (e) { /* ignore a partial frame */ }
            }
          }
        }

        return pump().then(function () {
          if (finished) return;
          finished = true;
          hideThinking();
          if (painter) painter.end(reply);
          done();
          setState(input === document.activeElement ? "listening" : "idle");
        });
      }).catch(function (err) {
        fail(err && err.message ? err.message : GENERIC);
      });
    }

    // ---- composer behaviour --------------------------------------------------
    /* The box is measured from zero, not from auto: with `auto` the reading
       is the box's own current height whenever the browser has not laid the
       subtree out yet, and one bad reading at mount used to leave an empty
       composer standing at its 8.4rem ceiling, taking a third of a phone
       screen and never shrinking back. From zero the only answer the engine
       can give is the height of the text. */
    var GROW_MAX = 8.4 * 16;

    function autoGrow() {
      input.style.height = "0px";
      var h = input.scrollHeight;
      input.style.height = Math.min(h, GROW_MAX) + "px";
    }

    input.addEventListener("input", function () {
      autoGrow();
      // a growing composer takes its height from the transcript, so the last
      // line of the conversation has to give way rather than slide under it
      if (stageNear) toBottom();
      if (!busy) setState("listening");
    });

    input.addEventListener("focus", function () {
      form.classList.add("focused");
      if (!busy) setState("listening");
    });

    input.addEventListener("blur", function () {
      form.classList.remove("focused");
      if (!busy) setState("idle");
    });

    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        send(input.value);
      }
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      send(input.value);
    });

    chips.addEventListener("click", function (ev) {
      var target = ev.target;
      if (!target || !target.classList || !target.classList.contains("chip")) return;
      send(target.textContent);
      input.focus();
    });

    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) flame.wake();
      syncWisp();
    });

    autoGrow();
    // the first measurement can land before the room has a width; take
    // another once the browser has laid the composer out for real
    window.requestAnimationFrame(autoGrow);
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(autoGrow).catch(function () {});
    }

    /* ---- when the loop runs ------------------------------------------------
       Full screen, it always runs. Embedded, an IntersectionObserver stops it
       the moment the section leaves the screen and starts it again, from a
       fresh clock, when it comes back.                                       */

    if (reduceMotion) {
      staticRepaint();
    } else if (mode === "embed" && window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        if (e && e.isIntersecting) startLoop(); else stopLoop();
        stageLive = !!(e && e.isIntersecting);
        syncWisp();
      }, { threshold: 0 });
      io.observe(rootEl);
    } else {
      startLoop();
    }

    /* ---- the room and the soft keyboard ------------------------------------
       A phone keyboard does not take space from the page, it takes space from
       the screen. On iOS the layout viewport keeps its full height and the
       browser scrolls the document until the focused field is visible, which
       walks the top bar and most of the transcript off the top; embedded, the
       seat magnet then re-seated the room against the shrunken visual
       viewport and yanked the page a second time.

       So the moment the composer takes focus on a touch device the room stops
       being a piece of the page: it is pinned to the visual viewport, exactly
       the visible rectangle, and every band of chrome tightens so what the
       keyboard left goes to the conversation. Nothing scrolls it, so nothing
       can move it, and the transcript keeps its place at the bottom across
       the keyboard opening, the keyboard closing and the rotation between.

       On blur the page is handed back exactly where the visitor left it.   */

    var vv = window.visualViewport || null;
    var kbPinned = false;
    var kbSavedY = 0;
    var kbRelease = 0;
    var kbBaseH = 0;
    var kbLastH = 0;
    var kbLastTop = 0;
    var stageNear = true;

    stage.addEventListener("scroll", function () {
      stageNear = nearBottom();
      if (touchDevice) noteScroll();
    }, { passive: true });

    function toBottom() { stage.scrollTop = stage.scrollHeight; }

    function visibleH() {
      if (vv && vv.height) return vv.height;
      return document.documentElement.clientHeight || window.innerHeight || 0;
    }

    // written straight from the event rather than deferred to a frame: the
    // work is two custom properties, and a keyboard sliding in should carry
    // the room with it rather than trail a frame behind
    function writeViewport() {
      var h = Math.round(visibleH());
      var top = Math.round(vv ? vv.offsetTop : 0);
      if (!h || (h === kbLastH && top === kbLastTop)) return;
      kbLastH = h;
      kbLastTop = top;
      rootEl.style.setProperty("--vv-height", h + "px");
      rootEl.style.setProperty("--vv-top", top + "px");
    }

    // the pin is harmless without a keyboard: an iPad with a hardware one
    // focuses the composer and the room keeps exactly the size it had. The
    // chrome only tightens once the screen has actually lost height, which on
    // iOS is a couple of hundred milliseconds after the tap, as the keyboard
    // slides in, and the tightening rides in with it.
    function markKeyboard() {
      rootEl.classList.toggle("kb-open", kbBaseH - Math.round(visibleH()) > 100);
    }

    function pinToViewport() {
      window.clearTimeout(kbRelease);
      if (kbPinned) return;
      kbPinned = true;
      kbBaseH = Math.round(visibleH());
      kbSavedY = window.pageYOffset || document.documentElement.scrollTop || 0;
      kbLastH = kbLastTop = 0;
      writeViewport();
      rootEl.classList.add("kb-pin");
      window.requestAnimationFrame(function () {
        writeViewport();
        markKeyboard();
        if (stageNear) toBottom();
      });
    }

    function unpin() {
      if (!kbPinned) return;
      kbPinned = false;
      rootEl.classList.remove("kb-pin");
      rootEl.classList.remove("kb-open");
      rootEl.style.removeProperty("--vv-height");
      rootEl.style.removeProperty("--vv-top");
      window.scrollTo(0, mode === "page" ? 0 : kbSavedY);
      window.requestAnimationFrame(function () {
        if (stageNear) toBottom();
      });
    }

    // a tap on send or on a pill blurs the field a moment before its own
    // click lands: releasing the pin on that blur would move the button out
    // from under the finger, so the release waits to see whether focus is
    // coming straight back
    function releaseViewport() {
      window.clearTimeout(kbRelease);
      kbRelease = window.setTimeout(unpin, 220);
    }

    function syncViewport() {
      if (!kbPinned) return;
      writeViewport();
      markKeyboard();
      if (mode === "page") window.scrollTo(0, 0);
      if (stageNear) toBottom();
    }

    if (touchDevice) {
      input.addEventListener("focus", pinToViewport);
      input.addEventListener("blur", releaseViewport);
      if (vv) {
        vv.addEventListener("resize", syncViewport, { passive: true });
        vv.addEventListener("scroll", syncViewport, { passive: true });
      }
      // the document has no business scrolling while the room owns the screen
      window.addEventListener("scroll", function () {
        if (kbPinned && mode === "page") window.scrollTo(0, 0);
      }, { passive: true });
      window.addEventListener("orientationchange", function () {
        if (kbPinned) window.setTimeout(syncViewport, 320);
      });
    }

    /* ---- seating the room (embedded only) ----------------------------------
       Embedded, the room is one screenful at the end of a long page, and the
       transcript inside it is a scroller of its own. Two scrollers stacked
       like that fight each other: a wheel over a half-visible room moves the
       conversation when the visitor is still trying to reach the room.

       So the transcript only accepts a gesture once the room is seated: its
       bottom edge resting on the bottom of the viewport. Until then the stage
       is not a scroll target at all (overflow hidden), which is what makes
       touch and the keyboard behave without a single prevented event. The
       wheel is routed by hand so one gesture can seat the room, or fill the
       transcript and hand the remainder back to the page, without the pause
       the browser's own scroll latching would put in the middle.        */

    if (mode !== "page") {
      // a finger cannot stop on a pixel, and the room being one thumb's width
      // off its seat is no reason to hold the transcript shut
      var SEAT_EPS = touchDevice ? 14 : 2;
      var seatPending = null;
      var touchLately = 0;
      var settleTimer = 0;
      var seatTicking = false;
      var chainingOut = false;
      var lastY = window.pageYOffset || 0;
      var lastDir = 0;

      function viewportH() {
        var vv = window.visualViewport;
        if (vv && vv.height) return vv.height;
        return document.documentElement.clientHeight || window.innerHeight;
      }

      // how far the page still has to move to seat the room, clamped to the
      // scroll the document actually has left: if the seat is unreachable the
      // answer is 0, and the transcript is never locked out of a gesture.
      function seatDelta() {
        var vh = viewportH();
        var want = rootEl.getBoundingClientRect().bottom - vh;
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;
        var maxY = Math.max(0, (document.documentElement.scrollHeight || 0) - vh);
        var target = Math.min(Math.max(y + want, 0), maxY);
        return target - y;
      }

      function pageBy(px) {
        if (!px) return;
        window.scrollTo({ top: (window.pageYOffset || 0) + px, behavior: "auto" });
      }

      /* ---- the seat, on a phone ------------------------------------------
         Touch gets its seat stop from the document's own scroll snapping
         (index.html, touch pointers only): a proximity snap point at the
         room's bottom edge, which brings a flick to rest on the seat the
         way the wheel handler brings a wheel to rest on it, with the
         browser's physics rather than a fight over touchmove.

         The snap has to know how to stand aside. Every deliberate move away
         from the seat turns it off, and it is armed again only from a place
         where arming it cannot move anything under the reader: seated
         already, or far enough out that the snap has no claim on the page.
         A phone's URL bar collapsing counts as a scroll, so the arming can
         never be a pull of its own.                                      */
      function snapOff() {
        if (touchDevice) document.documentElement.classList.add("room-unsnapped");
      }

      function snapArm() {
        // never mid gesture: a finger is still carrying the page out of the
        // room, and re-arming under it is exactly the yank this avoids
        if (!touchDevice || kbPinned || chainingOut) return;
        var cl = document.documentElement.classList;
        if (!cl.contains("room-unsnapped")) return;
        var d = Math.abs(seatDelta());
        if (d <= SEAT_EPS || d > viewportH() * 0.5) cl.remove("room-unsnapped");
      }

      function markSeat() {
        if (kbPinned) snapOff(); else snapArm();
        // pinned to the viewport, the room is the screen: it is seated by
        // definition and the transcript is the only thing there is to scroll
        if (kbPinned) {
          if (seatPending !== false) {
            seatPending = false;
            rootEl.classList.remove("seat-pending");
          }
          return;
        }
        var pending = Math.abs(seatDelta()) > SEAT_EPS;
        if (pending === seatPending) return;
        seatPending = pending;
        rootEl.classList.toggle("seat-pending", pending);
      }

      // touch cannot be clamped mid-flick without prevented events, so a
      // finger that comes to rest near the seat is pulled the last few pixels
      // in. Armed by touch only: a wheel clamps itself, and the keyboard must
      // never be pulled back to a place it just left.
      function magnet() {
        // On a phone the pull is the jump: a keyboard opening, a URL bar
        // collapsing or a thumb resting anywhere near the seat would drag the
        // page under the reader. Touch gets the forgiving epsilon above
        // instead, and the magnet stays for pointer devices, where a trackpad
        // flick really does need the last few pixels closed for it.
        if (touchDevice || kbPinned) return;
        var d = seatDelta();
        if (Math.abs(d) <= SEAT_EPS) return;
        if (Math.abs(d) > viewportH() * 0.22) return;
        // never pull the visitor back the way they came: a finger travelling
        // past the room toward the footer is going where it meant to go
        if (lastDir > 0 && d < 0) return;
        if (lastDir < 0 && d > 0) return;
        pageBy(d);
        markSeat();
      }

      function onPageScroll() {
        var y = window.pageYOffset || 0;
        if (y !== lastY) { lastDir = y > lastY ? 1 : -1; lastY = y; }
        if (!seatTicking) {
          seatTicking = true;
          window.requestAnimationFrame(function () { seatTicking = false; markSeat(); });
        }
        if (touchLately && Date.now() - touchLately < 2600) {
          touchLately = Date.now();            // ride the momentum out
          window.clearTimeout(settleTimer);
          settleTimer = window.setTimeout(magnet, 120);
        }
      }

      /* ---- the way out, on a phone -------------------------------------
         Seated, the room is the whole screen and the transcript owns every
         touch; iOS never hands a gesture from an inner scroller back to the
         page, it rubber-bands, so a visitor who scrolled into the room had
         no way to scroll back out of it. Two answers, both explicit:

         a pull past the transcript's edge is routed to the page by hand,
         which is the chaining the browser refused to do; and the top bar
         carries a "Back to page" button (touch only, in CSS) that unpins,
         closes the keyboard and carries the page back above the room.    */

      var leaveBtn = rootEl.querySelector("#leave-room");
      if (leaveBtn) {
        leaveBtn.addEventListener("click", function () {
          window.clearTimeout(kbRelease);
          if (input) input.blur();
          unpin();
          // this one carries the page a whole screen above the room, and the
          // seat has no business catching it on the way out
          snapOff();
          var top = (window.pageYOffset || 0) + rootEl.getBoundingClientRect().top;
          window.scrollTo({ top: Math.max(0, top - viewportH()), behavior: "smooth" });
        });
      }

      if (touchDevice) {
        var chainY = null;
        var chainStartY = 0;
        var chaining = false;
        stage.addEventListener("touchstart", function (ev) {
          var t0 = ev.touches && ev.touches[0];
          if (!t0) return;
          chainY = chainStartY = t0.clientY;
          chaining = chainingOut = false;
        }, { passive: true });
        stage.addEventListener("touchmove", function (ev) {
          var t1 = ev.touches && ev.touches[0];
          if (chainY === null || !t1) return;
          var y = t1.clientY;
          var dy = y - chainY;
          if (kbPinned) {
            // a decisive pull down at the top of the transcript is the
            // universal "put the keyboard away" gesture
            if (y - chainStartY > 48 && stage.scrollTop <= 0 && input) input.blur();
            chainY = y;
            return;
          }
          if (!chaining) {
            var atTop = stage.scrollTop <= 0;
            var atEnd = stage.scrollTop >= stage.scrollHeight - stage.clientHeight - 1;
            if ((atTop && dy > 0) || (atEnd && dy < 0)) { chaining = chainingOut = true; snapOff(); }
            else { chainY = y; return; }
          }
          // like native chaining, the gesture belongs to the page from here on
          if (ev.cancelable) ev.preventDefault();
          window.scrollBy(0, -dy);
          chainY = y;
        }, { passive: false });
        stage.addEventListener("touchend", function () {
          chainY = null;
          chaining = chainingOut = false;
        }, { passive: true });
      }

      function touched() { touchLately = Date.now(); }
      rootEl.addEventListener("touchstart", touched, { passive: true });
      rootEl.addEventListener("touchend", touched, { passive: true });

      window.addEventListener("scroll", onPageScroll, { passive: true });
      window.addEventListener("resize", markSeat, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", markSeat, { passive: true });
      }
      markSeat();

      function wheelPixels(ev) {
        if (ev.deltaMode === 1) return ev.deltaY * 16;        // lines
        if (ev.deltaMode === 2) return ev.deltaY * viewportH();
        return ev.deltaY;
      }

      rootEl.addEventListener("wheel", function (ev) {
        if (ev.ctrlKey || ev.defaultPrevented) return;        // pinch zoom
        var dy = wheelPixels(ev);
        if (!dy) return;
        if (ev.target && ev.target.closest && ev.target.closest(".tune-pop, textarea")) return;

        var need = seatDelta();
        if (Math.abs(need) > SEAT_EPS) {
          // the room is not seated. A gesture toward it seats it and stops
          // there; a gesture away from it belongs to the page, untouched.
          if ((need > 0) !== (dy > 0)) return;
          ev.preventDefault();
          pageBy(dy > 0 ? Math.min(dy, need) : Math.max(dy, need));
          var rest = seatDelta();               // absorb sub-pixel rounding
          if (rest && Math.abs(rest) <= 8) pageBy(rest);
          markSeat();
          return;
        }

        // seated: the transcript takes what it can hold, the page takes the rest
        var max = stage.scrollHeight - stage.clientHeight;
        var room = dy > 0 ? max - stage.scrollTop : stage.scrollTop;
        var take = Math.max(0, Math.min(Math.abs(dy), room));
        ev.preventDefault();
        if (take) stage.scrollTop += dy > 0 ? take : -take;
        var left = Math.abs(dy) - take;
        if (left > 0.5) {
          pageBy(dy > 0 ? left : -left);
          markSeat();
        }
      }, { passive: false });
    }

    var api = {
      mode: mode,
      root: rootEl,
      frames: function () { return flameFrames; },
      running: function () { return flameRunning; },
      start: startLoop,
      stop: stopLoop
    };
    window.ChamaAgent.instance = api;
    return api;
  }

  window.ChamaAgent = { mount: mount };
})();
