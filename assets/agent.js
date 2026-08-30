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
      : '<a class="fullscreen-link" href="/agent">Full screen</a>';
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

    // eased mirrors of the continuous settings, so a change moves the flame
    // rather than snapping it. tau is short while a slider is dragged and long
    // when the agent changes the room for you.
    var S = {
      brightness: settings.brightness, motion: settings.motion, size: settings.size,
      speed: settings.speed, turbulence: settings.turbulence, density: settings.density,
      sparkle: settings.sparkle
    };
    var EASED = ["brightness", "motion", "size", "speed", "turbulence", "density", "sparkle"];
    var settingsTau = 0.08;

    // auto dim: once there is a conversation, the flame steps back so the
    // text reads
    var dim = 1, dimTarget = 1;

    /* ==================================================================
       THE FLAME
       A particle field with an eased state machine driving its shape.
       ================================================================== */

    var canvas = rootEl.querySelector(".flame-canvas");
    var ctx = canvas.getContext("2d", { alpha: false });

    /* ---- the obsidian floor ------------------------------------------------
       The fire is born on a plane, and a plane you cannot see reads as an
       accident. So the ground is stated by light alone: the fire is painted
       once into its own buffer, then composited twice, once as itself and once
       mirrored about the birth plane, dim and fading to nothing. Polished dark
       stone, no rule, no horizon line.

       Both passes come from the same buffer, so the reflection inherits the
       hue, the brightness, the size, the density, the sparks and the position
       for free, with no second walk over the particles. The mirror is about
       the horizontal plane through the origin whatever direction the fire
       burns, so an inverted or sideways flame is reflected correctly without
       a special case. The mirror buffer is half resolution: a reflection in
       stone is soft, and the softness is the point.                          */
    var fireBuf = document.createElement("canvas");
    var fx = fireBuf.getContext("2d");
    var mirrorBuf = document.createElement("canvas");
    var mx = mirrorBuf.getContext("2d");
    var MIRROR_SCALE = 0.5;

    var W = 0, H = 0, DPR = 1;
    var emitX = -1, emitY = 0;
    // the flame's own frame: up is the burn direction, lat is across it
    var upX = 0, upY = -1, latX = 1, latY = 0;
    var angleShown = settings.angle;

    // ---- target parameter sets per state -----------------------------
    // rate: particles per second. spread: birth jitter in px.
    // rise: upward speed px/s. swirl: turbulence gain. heat: colour bias
    // and brightness. lean: horizontal pull toward the composer. life: seconds.
    //   band:  half width of the elliptical emission band, css px
    //   rise:  buoyancy scale. swirl: curl gain. heat: colour bias, core and light
    //   pinch: how hard the body converges inward with age (the teardrop taper)
    //   lean:  horizontal pull toward the conversation column
    //   core:  scale of the persistent bright inner body
    var STATES = {
      idle:      { rate: 560, band: 96, rise: 200, swirl: 26, heat: 0.52, lean: 0.00, life: 2.45, size: 1.00, cool: 0, pinch: 3.4, core: 1.00 },
      listening: { rate: 680, band: 84, rise: 218, swirl: 24, heat: 0.66, lean: 0.34, life: 2.30, size: 0.96, cool: 0, pinch: 3.9, core: 1.08 },
      thinking:  { rate: 860, band: 46, rise: 104, swirl: 92, heat: 0.94, lean: 0.08, life: 1.25, size: 0.78, cool: 0, pinch: 6.2, core: 1.30 },
      streaming: { rate: 1150, band: 110, rise: 272, swirl: 44, heat: 1.00, lean: 0.20, life: 2.65, size: 1.06, cool: 0, pinch: 2.6, core: 1.62 },
      error:     { rate: 360, band: 112, rise: 152, swirl: 58, heat: 0.30, lean: 0.00, life: 1.80, size: 1.02, cool: 1, pinch: 2.2, core: 0.55 }
    };

    var P = {};   // current, eased
    var T = {};   // target
    var keys = ["rate", "band", "rise", "swirl", "heat", "lean", "life", "size", "cool", "pinch", "core"];
    (function () {
      for (var i = 0; i < keys.length; i++) {
        P[keys[i]] = STATES.idle[keys[i]];
        T[keys[i]] = STATES.idle[keys[i]];
      }
    })();

    var state = "idle";
    var stateSince = 0;

    function setState(next) {
      if (state === next) return;
      state = next;
      var s = STATES[next] || STATES.idle;
      for (var i = 0; i < keys.length; i++) T[keys[i]] = s[keys[i]];
      stateSince = performance.now();
    }

    // ---- sprite ramps -------------------------------------------------
    // Pre-rendered radial dots across the cooling curve, so per-particle
    // drawing is a single drawImage. Two ramps: the ember one, and a cool
    // blue-grey one used for the error flicker.
    var RAMP = 22;
    var SPRITE = 34;
    var warmRamp = [], coolRamp = [], bodyRamp = [];
    var BODY_SPRITE = 96;

    function mix(a, b, t) { return a + (b - a) * t; }

    // the body blobs need a much gentler falloff, so many of them overlap into
    // one continuous mass instead of reading as a heap of discs
    function makeBodySprite(r, g, b, reuse) {
      var c = reuse || document.createElement("canvas");
      c.width = c.height = BODY_SPRITE;
      var cc = c.getContext("2d");
      var half = BODY_SPRITE / 2;
      var grad = cc.createRadialGradient(half, half, 0, half, half, half);
      var rgb = Math.round(r) + "," + Math.round(g) + "," + Math.round(b);
      grad.addColorStop(0, "rgba(" + rgb + ",1)");
      grad.addColorStop(0.34, "rgba(" + rgb + ",0.72)");
      grad.addColorStop(0.62, "rgba(" + rgb + ",0.30)");
      grad.addColorStop(0.84, "rgba(" + rgb + ",0.07)");
      grad.addColorStop(1, "rgba(" + rgb + ",0)");
      cc.fillStyle = grad;
      cc.fillRect(0, 0, BODY_SPRITE, BODY_SPRITE);
      return c;
    }

    function makeSprite(r, g, b, reuse) {
      var c = reuse || document.createElement("canvas");
      c.width = c.height = SPRITE;
      var cc = c.getContext("2d");
      var half = SPRITE / 2;
      var grad = cc.createRadialGradient(half, half, 0, half, half, half);
      var rgb = Math.round(r) + "," + Math.round(g) + "," + Math.round(b);
      grad.addColorStop(0, "rgba(" + rgb + ",1)");
      grad.addColorStop(0.28, "rgba(" + rgb + ",0.55)");
      grad.addColorStop(0.62, "rgba(" + rgb + ",0.14)");
      grad.addColorStop(1, "rgba(" + rgb + ",0)");
      cc.fillStyle = grad;
      cc.fillRect(0, 0, SPRITE, SPRITE);
      return c;
    }

    // ---- the hue: every colour in the fire comes from one number ---------
    // Near white at the core with a slight tint of the hue, saturated through
    // the middle, darker and less saturated in the tail. The ramps are small
    // offscreen canvases, so a hue change is a cheap synchronous rebuild.
    function hsl(h, sat, light) {
      var ss = sat / 100, ll = light / 100;
      var cc = (1 - Math.abs(2 * ll - 1)) * ss;
      var hh = ((h % 360) + 360) % 360 / 60;
      var xx = cc * (1 - Math.abs(hh % 2 - 1));
      var r = 0, g = 0, b = 0;
      if (hh < 1) { r = cc; g = xx; }
      else if (hh < 2) { r = xx; g = cc; }
      else if (hh < 3) { g = cc; b = xx; }
      else if (hh < 4) { g = xx; b = cc; }
      else if (hh < 5) { r = xx; b = cc; }
      else { r = cc; b = xx; }
      var m = ll - cc / 2;
      return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
    }

    function hsla(h, sat, light, a) {
      return "hsla(" + (((h % 360) + 360) % 360).toFixed(1) + "," + sat + "%," + light + "%," + a + ")";
    }

    function rampColor(t, hue) {
      if (t < 0.07) {                       // the hot core, barely tinted
        var k = t / 0.07;
        return hsl(hue, mix(14, 58, k), mix(97, 87, k));
      }
      if (t < 0.38) {                       // into the hue at full saturation
        var k2 = (t - 0.07) / 0.31;
        return hsl(hue, mix(58, 96, k2), mix(87, 58, k2));
      }
      var k3 = (t - 0.38) / 0.62;           // tail: darker and calmer
      return hsl(hue, mix(96, 70, k3), mix(58, 26, k3));
    }

    var coreSprite = null;

    function makeCoreSprite(hue, reuse) {
      var size = 256, half = size / 2;
      var c = reuse || document.createElement("canvas");
      c.width = c.height = size;
      var cc = c.getContext("2d");
      var grad = cc.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0, hsla(hue, 60, 94, 0.95));
      grad.addColorStop(0.16, hsla(hue, 90, 79, 0.55));
      grad.addColorStop(0.40, hsla(hue, 94, 60, 0.22));
      grad.addColorStop(0.70, hsla(hue, 86, 46, 0.07));
      grad.addColorStop(1, hsla(hue, 80, 38, 0));
      cc.fillStyle = grad;
      cc.fillRect(0, 0, size, size);
      return c;
    }

    // the canvases are allocated once and repainted in place, so travelling
    // through the colour wheel never churns the heap
    function buildRamps(hue) {
      var fresh = warmRamp.length !== RAMP;
      for (var i = 0; i < RAMP; i++) {
        var t = i / (RAMP - 1);
        var rgb = rampColor(t, hue);
        var r = rgb[0], g = rgb[1], b = rgb[2];
        // the cool ramp keeps its own blue grey identity: it is the error
        // flicker, and should read as heat leaving whatever colour the fire is
        var cr = mix(r * 0.55, 168, 0.45);
        var cg = mix(g * 0.72, 186, 0.45);
        var cb = mix(b * 1.6 + 60, 210, 0.45);
        if (fresh) {
          warmRamp.push(makeSprite(r, g, b));
          bodyRamp.push(makeBodySprite(r, g, b));
          coolRamp.push(makeSprite(cr, cg, cb));
        } else {
          makeSprite(r, g, b, warmRamp[i]);
          makeBodySprite(r, g, b, bodyRamp[i]);
          makeSprite(cr, cg, cb, coolRamp[i]);
        }
      }
      coreSprite = makeCoreSprite(hue, coreSprite);
    }

    // the hue shown right now, eased toward the setting the short way round
    var hueShown = settings.hue;
    var hueBuilt = -999;
    var hueTick = 0;

    function shortestHue(from, to) {
      var d = ((to - from + 540) % 360) - 180;
      return d;
    }

    function paintHueTokens(hue) {
      var mid = hsl(hue, 92, 55);
      var css = "rgb(" + Math.round(mid[0]) + "," + Math.round(mid[1]) + "," + Math.round(mid[2]) + ")";
      rootEl.style.setProperty("--flamecolor", css);
    }

    buildRamps(hueShown);
    hueBuilt = hueShown;
    paintHueTokens(hueShown);

    // ---- gradient noise (own implementation) --------------------------
    // Value noise on a hashed lattice, sampled twice to build a curl of a
    // scalar potential, which gives a divergence free, licking flow.
    var PERM = new Uint8Array(512);
    (function () {
      var seedState = 1337;
      function rnd() {
        seedState = (seedState * 1664525 + 1013904223) >>> 0;
        return seedState / 4294967296;
      }
      var p = new Uint8Array(256);
      var i;
      for (i = 0; i < 256; i++) p[i] = i;
      for (i = 255; i > 0; i--) {
        var j = (rnd() * (i + 1)) | 0;
        var tmp = p[i]; p[i] = p[j]; p[j] = tmp;
      }
      for (i = 0; i < 512; i++) PERM[i] = p[i & 255];
    })();

    function hash3(xi, yi, zi) {
      return PERM[(PERM[(PERM[xi & 255] + (yi & 255)) & 255] + (zi & 255)) & 255] / 255;
    }
    function fade(t) { return t * t * (3 - 2 * t); }

    function noise3(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      var xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
      var n000 = hash3(xi, yi, zi),         n100 = hash3(xi + 1, yi, zi);
      var n010 = hash3(xi, yi + 1, zi),     n110 = hash3(xi + 1, yi + 1, zi);
      var n001 = hash3(xi, yi, zi + 1),     n101 = hash3(xi + 1, yi, zi + 1);
      var n011 = hash3(xi, yi + 1, zi + 1), n111 = hash3(xi + 1, yi + 1, zi + 1);
      var x00 = n000 + (n100 - n000) * xf, x10 = n010 + (n110 - n010) * xf;
      var x01 = n001 + (n101 - n001) * xf, x11 = n011 + (n111 - n011) * xf;
      var y0 = x00 + (x10 - x00) * yf, y1 = x01 + (x11 - x01) * yf;
      return y0 + (y1 - y0) * zf;
    }

    // potential field, two octaves plus a rolling sine so the flame never
    // settles into a loop
    function potential(x, y, t) {
      return noise3(x, y, t) * 1.0
        + noise3(x * 2.07, y * 2.07, t * 1.6) * 0.45
        + Math.sin(x * 1.7 + t * 2.3) * 0.09
        + Math.sin(y * 1.3 - t * 1.7) * 0.07;
    }

    var EPS = 0.09;
    function curl(x, y, t, out) {
      var pdy = (potential(x, y + EPS, t) - potential(x, y - EPS, t)) / (2 * EPS);
      var pdx = (potential(x + EPS, y, t) - potential(x - EPS, y, t)) / (2 * EPS);
      out[0] = pdy;
      out[1] = -pdx;
    }
    var curlOut = [0, 0];

    // ---- particle storage ---------------------------------------------
    var CAP = 2600;
    var px = new Float32Array(CAP), py = new Float32Array(CAP);
    var vx = new Float32Array(CAP), vy = new Float32Array(CAP);
    var pa = new Float32Array(CAP), pl = new Float32Array(CAP);
    var ps = new Float32Array(CAP), pj = new Float32Array(CAP);
    var pc = new Uint8Array(CAP);
    var count = 0;
    var budget = 1500;               // adaptive live cap
    var carry = 0;                   // fractional emission carry

    // roughly normal in [-1, 1], so the band is dense at the middle and thin
    // at its edges instead of a flat disc
    function bell() {
      return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    }

    // the band and the launch direction are laid out in the flame's own frame,
    // so the whole emitter rotates with the angle setting
    function spawn(x, y, band, upBias, cool, sizeMul, life) {
      if (count >= budget || count >= CAP) return;
      var i = count++;
      var off = bell();
      var along = bell() * band * 0.11;
      px[i] = x + off * band * latX + along * upX;
      py[i] = y + off * band * latY + along * upY;
      var jitter = (Math.random() - 0.5) * 18 - off * 16;
      var launch = upBias * 0.32 * (0.6 + Math.random() * 0.85);
      vx[i] = jitter * latX + launch * upX;
      vy[i] = jitter * latY + launch * upY;
      pa[i] = 0;
      pl[i] = life * (0.5 + Math.random() * 0.95);
      ps[i] = (1.5 + Math.random() * 5.2) * sizeMul;
      pj[i] = Math.random() * 6.28;
      pc[i] = cool;
    }

    // ---- the body: few, large, faint blobs that overlap into one mass -----
    var BCAP = 260;
    var BODY_MAX = 170, BODY_FLOOR = 72;
    var bx = new Float32Array(BCAP), by = new Float32Array(BCAP);
    var bvx = new Float32Array(BCAP), bvy = new Float32Array(BCAP);
    var ba = new Float32Array(BCAP), blf = new Float32Array(BCAP);
    var bs = new Float32Array(BCAP), bo = new Float32Array(BCAP);
    var bc = new Uint8Array(BCAP);
    var bcount = 0;
    var bodyBudget = 130;
    var bcarry = 0;

    function spawnBody(x, y, band, upBias, cool, sizeMul, life) {
      if (bcount >= bodyBudget || bcount >= BCAP) return;
      var i = bcount++;
      var off = bell() * 0.82;
      var along = bell() * band * 0.09;
      bx[i] = x + off * band * latX + along * upX;
      by[i] = y + off * band * latY + along * upY;
      var bjit = (Math.random() - 0.5) * 10 - off * 12;
      var blaunch = upBias * 0.72 * 0.30 * (0.7 + Math.random() * 0.7);
      bvx[i] = bjit * latX + blaunch * upX;
      bvy[i] = bjit * latY + blaunch * upY;
      ba[i] = 0;
      blf[i] = life * 0.87 * (0.6 + Math.random() * 0.8);
      bs[i] = (26 + Math.random() * 44) * sizeMul;
      bo[i] = off;
      bc[i] = cool;
    }

    function killBody(i) {
      var last = --bcount;
      if (i !== last) {
        bx[i] = bx[last]; by[i] = by[last];
        bvx[i] = bvx[last]; bvy[i] = bvy[last];
        ba[i] = ba[last]; blf[i] = blf[last];
        bs[i] = bs[last]; bo[i] = bo[last];
        bc[i] = bc[last];
      }
    }

    /* ---- the glitter: the crackle on top of the volume -------------------
       The body and the soft particles make a continuous mass; a real fire
       also throws hard bright points that live for a moment and go out. This
       is that third population: tiny, drawn from the hottest end of the same
       ramp (so a hue change or the error state's cool ramp carries it with no
       new colour system), short lived, fading as remaining life squared so
       the field is dominated by bright young points, and each one twinkling
       on a sine of its own phase. It shares the emitter band, the flame's
       frame, the curl and the state machine, so thinking, streaming and error
       shape it without a single special case, and because it is painted into
       the same fire buffer the obsidian floor reflects it for free.        */
    var GCAP = 420;
    // the floor is not zero: the glitter sheds first and hardest, but a
    // machine that simply runs at 30 Hz is not in trouble, and it should not
    // lose the crackle altogether for the rest of the visit
    var GLIT_MAX = 300, GLIT_FLOOR = 60;
    var gx = new Float32Array(GCAP), gy = new Float32Array(GCAP);
    var gvx = new Float32Array(GCAP), gvy = new Float32Array(GCAP);
    var ga = new Float32Array(GCAP), glf = new Float32Array(GCAP);
    var gs = new Float32Array(GCAP), gph = new Float32Array(GCAP);
    var gc = new Uint8Array(GCAP);
    var gcount = 0;
    var glitBudget = GLIT_MAX;
    var gcarry = 0;

    function spawnGlitter(x, y, band, upBias, cool, sizeMul, life) {
      if (gcount >= glitBudget || gcount >= GCAP) return;
      var i = gcount++;
      var off = bell();
      var along = bell() * band * 0.10;
      gx[i] = x + off * band * latX + along * upX;
      gy[i] = y + off * band * latY + along * upY;
      var jitter = (Math.random() - 0.5) * 34 - off * 20;
      var launch = upBias * 0.38 * (0.6 + Math.random() * 1.05);
      gvx[i] = jitter * latX + launch * upX;
      gvy[i] = jitter * latY + launch * upY;
      ga[i] = 0;
      glf[i] = life * 0.30 * (0.55 + Math.random() * 0.9);
      gs[i] = (1.0 + Math.random() * 2.0) * sizeMul;
      gph[i] = Math.random() * 6.28;
      gc[i] = cool;
    }

    function killGlitter(i) {
      var last = --gcount;
      if (i !== last) {
        gx[i] = gx[last]; gy[i] = gy[last];
        gvx[i] = gvx[last]; gvy[i] = gvy[last];
        ga[i] = ga[last]; glf[i] = glf[last];
        gs[i] = gs[last]; gph[i] = gph[last];
        gc[i] = gc[last];
      }
    }

    // a rotated flame can leave by any edge, so the cull is all four
    function offCanvas(x, y) {
      return x < -140 || x > W + 140 || y < -140 || y > H + 140;
    }

    function kill(i) {
      var last = --count;
      if (i !== last) {
        px[i] = px[last]; py[i] = py[last];
        vx[i] = vx[last]; vy[i] = vy[last];
        pa[i] = pa[last]; pl[i] = pl[last];
        ps[i] = ps[last]; pj[i] = pj[last];
        pc[i] = pc[last];
      }
    }

    // a tap on the flame area throws a handful of sparks from that point
    function burstAt(x, y, n) {
      for (var k = 0; k < n; k++) {
        var before = count;
        spawn(x, y, 12, curRise, P.cool > 0.5 ? 1 : 0, P.size * curSize * 1.5, curLife);
        if (count === before) return;
        var i = count - 1;
        var ang = Math.random() * Math.PI * 2;
        var sp = 80 + Math.random() * 240;
        vx[i] = Math.cos(ang) * sp;
        vy[i] = Math.sin(ang) * sp * 0.7 - 55;
        pl[i] *= 0.85;
      }
    }

    // ---- the travelling spark (note sent) ------------------------------
    var sparks = [];
    function launchSpark() {
      var toRight = emitX < W * 0.55;
      sparks.push({
        x: emitX, y: emitY - 40,
        vx: (toRight ? 1 : -1) * (W * (0.42 + Math.random() * 0.2)),
        vy: -H * (0.52 + Math.random() * 0.2),
        life: 0, max: 2.4,
        trail: []
      });
    }

    // ---- grain ---------------------------------------------------------
    var grainTile = (function () {
      var g = document.createElement("canvas");
      g.width = g.height = 128;
      var gc = g.getContext("2d");
      var img = gc.createImageData(128, 128);
      for (var i = 0; i < img.data.length; i += 4) {
        var v = (Math.random() * 26) | 0;
        img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      gc.putImageData(img, 0, 0);
      return g;
    })();
    var grainPattern = null;

    // ---- the pointer, strictly local ------------------------------------
    // There is no page wide breeze. The pointer only exists for particles
    // within POINT_R of it, and only while it is actually inside or beside the
    // flame's silhouette, so moving the cursor anywhere else does nothing.
    // Every listener is bound to the root, so the rest of the page is silent.
    var pointerX = -99999, pointerYp = -99999;
    var pointerVX = 0, pointerVY = 0;
    var pointerLife = 99;             // seconds since the pointer last moved
    var lastPX = 0, lastPY = 0, lastPT = 0;
    var POINT_R = 80;                 // the whole reach of a pointer, in css px
    var VEL_CAP = 2600;

    // the silhouette gate, refreshed every frame from the live flame shape.
    // Pointer terms and taps both ask this before they do anything at all.
    var gateHalfWide = 0, gateReach = 0;
    var curRise = 200, curLife = 2.45, curSize = 1;

    // the silhouette test in the flame's own frame: lateral offset across the
    // band, and height measured along whatever direction the fire burns
    function nearFlame(x, y) {
      var dx = x - emitX, dy = y - emitY;
      var lat = dx * latX + dy * latY;
      var up = dx * upX + dy * upY;
      return Math.abs(lat) < gateHalfWide &&
             up > -POINT_R &&
             up < gateReach + POINT_R;
    }

    function clampAbs(v, cap) {
      if (v > cap) return cap;
      if (v < -cap) return -cap;
      return v;
    }

    // client coordinates arrive in page space; the flame only ever thinks in
    // coordinates local to its own box
    function toLocal(clientX, clientY) {
      var r = rootEl.getBoundingClientRect();
      return [clientX - r.left, clientY - r.top];
    }

    function pointerAt(x, y, now) {
      if (!W) return;
      var span = now - lastPT;
      if (span > 4) {
        var ivx = (x - lastPX) / span * 1000;   // css px per second
        var ivy = (y - lastPY) / span * 1000;
        pointerVX = clampAbs(pointerVX * 0.45 + ivx * 0.55, VEL_CAP);
        pointerVY = clampAbs(pointerVY * 0.45 + ivy * 0.55, VEL_CAP);
        lastPX = x; lastPY = y; lastPT = now;
      }
      pointerX = x;
      pointerYp = y;
      pointerLife = 0;
    }

    rootEl.addEventListener("pointermove", function (ev) {
      if (ev.pointerType === "touch") return;   // touch is handled below
      var p = toLocal(ev.clientX, ev.clientY);
      pointerAt(p[0], p[1], performance.now());
    }, { passive: true });

    // the pointer leaving the box is the pointer ceasing to exist for the fire
    rootEl.addEventListener("pointerleave", function () {
      pointerX = -99999;
      pointerYp = -99999;
      pointerVX = 0;
      pointerVY = 0;
      pointerLife = 99;
    }, { passive: true });

    // Touch. Every listener is passive and nothing is ever prevented, so
    // scrolling the transcript, scrolling the page around the embed, and
    // typing all stay completely unaffected.
    var touchStart = null;

    function onUi(node) {
      if (!node || !node.closest) return true;
      return !!node.closest(".topbar, .composer, .tune-pop, a, button, input, textarea, label");
    }

    rootEl.addEventListener("touchstart", function (ev) {
      var t = ev.touches[0];
      if (!t) return;
      var p = toLocal(t.clientX, t.clientY);
      lastPX = p[0]; lastPY = p[1]; lastPT = performance.now();
      touchStart = { x: p[0], y: p[1], at: lastPT, ui: onUi(ev.target) };
    }, { passive: true });

    rootEl.addEventListener("touchmove", function (ev) {
      var t = ev.touches[0];
      if (!t) return;
      if (touchStart) touchStart.moved = true;
      var p = toLocal(t.clientX, t.clientY);
      pointerAt(p[0], p[1], performance.now());
    }, { passive: true });

    rootEl.addEventListener("touchend", function (ev) {
      var st = touchStart;
      touchStart = null;
      if (!st || st.ui) return;
      var t = ev.changedTouches && ev.changedTouches[0];
      if (!t) return;
      var p = toLocal(t.clientX, t.clientY);
      var moved = Math.abs(p[0] - st.x) + Math.abs(p[1] - st.y);
      if (moved > 14 || performance.now() - st.at > 520) return;
      // a tap in empty space, over the conversation, or over UI does nothing
      if (!nearFlame(p[0], p[1])) return;
      burstAt(p[0], p[1], 42);
    }, { passive: true });

    // ---- sizing ---------------------------------------------------------
    // the flame's home: left of the conversation on wide boxes, behind it
    // on narrow ones. A chosen position overrides it as a fraction of the width.
    function homeX() {
      return (W >= 1024 ? 0.29 : 0.5) * W;
    }

    function wantedX() {
      return settings.position === null ? homeX() : settings.position * W;
    }

    // the anchor rides the burn direction, so an inverted flame is rooted at
    // the ceiling and a sideways jet starts at mid height. 0.41 keeps the
    // upright base 9% of the box above the bottom edge, as before.
    function wantedY(uy) {
      return H * 0.5 - H * 0.41 * uy;
    }

    /* ---- how many pixels the fire is worth ------------------------------
       Every frame the fire is painted once into its own buffer, mirrored into
       a second, and composited into the canvas: three full screen passes, so
       cost is pure fill rate and pixel count is the only knob that moves it.
       A phone starts at 1.5x rather than 2x, which is invisible on a field
       with no hard edges, and the governor can drop it to 1x once it has shed
       every particle it is allowed to shed and is still late. It never climbs
       back: a screen that could not hold 1.5x will not hold it a second time,
       and rebuilding the buffers on a hunch is its own stall. */
    var dprCap = touchDevice ? 1.5 : 2;

    function layout() {
      DPR = Math.min(window.devicePixelRatio || 1, dprCap);
      var rect = rootEl.getBoundingClientRect();
      var nw = rect.width;
      var nh = rect.height;
      if (!nw || !nh) return;   // a hidden or collapsed box must not zero the field
      W = nw;
      H = nh;
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      fireBuf.width = canvas.width;
      fireBuf.height = canvas.height;
      fx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var ms = DPR * MIRROR_SCALE;
      mirrorBuf.width = Math.max(1, Math.round(W * ms));
      mirrorBuf.height = Math.max(1, Math.round(H * ms));
      mx.setTransform(ms, 0, 0, ms, 0, 0);
      if (emitY <= 0) emitY = wantedY(upY);
      if (emitX < 0) emitX = homeX();   // first layout: start where we belong
      grainPattern = ctx.createPattern(grainTile, "repeat");
      if (reduceMotion) drawStatic();
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

    // ---- static fallback -------------------------------------------------
    function drawStatic() {
      emitX = wantedX();
      emitY = wantedY(-Math.cos(settings.angle * Math.PI / 180));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#0e0c0a";
      ctx.fillRect(0, 0, W, H);
      var r = Math.max(W, H) * 0.62 * (0.55 + settings.size * 0.45);
      var reach = H * 0.20 * settings.size;
      var a = settings.angle * Math.PI / 180;
      var sgx = emitX + reach * Math.sin(a);
      var sgy = emitY - reach * Math.cos(a);
      var lvl = settings.brightness * dimTarget;
      var g = ctx.createRadialGradient(sgx, sgy, 0, sgx, sgy, r);
      g.addColorStop(0, hsla(settings.hue, 70, 90, (0.34 * lvl).toFixed(3)));
      g.addColorStop(0.08, hsla(settings.hue, 100, 69, (0.30 * lvl).toFixed(3)));
      g.addColorStop(0.26, hsla(settings.hue, 92, 54, (0.17 * lvl).toFixed(3)));
      g.addColorStop(0.58, hsla(settings.hue, 82, 35, (0.07 * lvl).toFixed(3)));
      g.addColorStop(1, "rgba(14, 12, 10, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // the same floor, stated the same way: a darker ground and one dim
      // mirrored wash, so the still flame stands on something too
      var sDir = Math.cos(a) >= 0 ? 1 : -1;
      var sRoom = sDir > 0 ? (H - emitY) : emitY;
      var sReach = Math.max(48, Math.min(sRoom * 0.90, H * 0.22, 260));
      var sStone = ctx.createLinearGradient(0, emitY, 0, emitY + sDir * Math.min(sRoom * 0.98, H * 0.32, 320));
      sStone.addColorStop(0, "rgba(6, 5, 4, 0)");
      sStone.addColorStop(0.45, "rgba(6, 5, 4, 0.045)");
      sStone.addColorStop(1, "rgba(6, 5, 4, 0.20)");
      ctx.fillStyle = sStone;
      if (sDir > 0) ctx.fillRect(0, emitY, W, H - emitY);
      else ctx.fillRect(0, 0, W, emitY);

      ctx.save();
      ctx.beginPath();
      if (sDir > 0) ctx.rect(0, emitY, W, sReach);
      else ctx.rect(0, emitY - sReach, W, sReach);
      ctx.clip();
      var mr = ctx.createRadialGradient(sgx, emitY + (emitY - sgy), 0, sgx, emitY + (emitY - sgy), r * 0.7);
      mr.addColorStop(0, hsla(settings.hue, 100, 69, (0.11 * lvl).toFixed(3)));
      mr.addColorStop(0.4, hsla(settings.hue, 92, 54, (0.05 * lvl).toFixed(3)));
      mr.addColorStop(1, "rgba(14, 12, 10, 0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = mr;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();

      // a modest sprinkling of the glitter, held still. The still frame is a
      // photograph of the fire, and a photograph of a fire has hard bright
      // points in it. Deterministic, so a repaint never reshuffles them, and
      // mirrored into the stone like everything else.
      var glitN = Math.round(34 * settings.sparkle / 0.5 * settings.size);
      if (glitN > 0 && warmRamp.length) {
        var sUpX = Math.sin(a), sUpY = -Math.cos(a);
        var sLatX = Math.cos(a), sLatY = Math.sin(a);
        var seed = 20260829;
        var srnd = function () {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        ctx.globalCompositeOperation = "lighter";
        for (var gi = 0; gi < glitN; gi++) {
          var up01 = srnd();
          var gUp = up01 * reach * 2.6;
          var gLat = (srnd() + srnd() - 1) * 62 * settings.size * (1 - up01 * 0.55);
          var gpx = emitX + gLat * sLatX + gUp * sUpX;
          var gpy = emitY + gLat * sLatY + gUp * sUpY;
          var gr = (1.1 + srnd() * 2.0) * settings.size;
          var galph = (0.30 + srnd() * 0.55) * (1 - up01 * 0.7) * lvl;
          ctx.globalAlpha = galph;
          ctx.drawImage(warmRamp[0], gpx - gr, gpy - gr, gr * 2, gr * 2);
          // its reflection, dim and only where there is ground for it
          var mpy = emitY + (emitY - gpy) * 0.965;
          var mdist = (mpy - emitY) * sDir;
          if (mdist > 0 && mdist < sReach) {
            ctx.globalAlpha = galph * 0.20 * (1 - mdist / sReach);
            ctx.drawImage(warmRamp[0], gpx - gr, mpy - gr, gr * 2, gr * 2);
          }
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      rootEl.style.setProperty("--flamelight", "0.45");
      if (grainPattern) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }

    // ---- burst hook (a text delta arrives) --------------------------------
    var burstQueue = 0;
    function flicker(n) { burstQueue += n; }

    // ---- the loop ----------------------------------------------------------
    var last = 0;
    var frameEMA = 16;
    var breath = 0;
    var lightTick = 0;
    var lastLight = -1;
    var frames = 0;
    var running = false;
    var rafId = 0;

    function ease(cur, target, dt, tau) {
      var k = 1 - Math.exp(-dt / tau);
      return cur + (target - cur) * k;
    }

    function startLoop() {
      if (running || reduceMotion) return;
      running = true;
      last = 0;
      rafId = requestAnimationFrame(frame);
    }

    function stopLoop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function frame(now) {
      frames++;
      if (!last) last = now;
      var raw = now - last;
      last = now;
      var dt = Math.min(raw, 50) / 1000;
      if (!W || !H) layout();   // the box can report zero while hidden
      frameEMA += (raw - frameEMA) * 0.06;

      // frame time governor: shed particles, never frames
      if (frameEMA > 21) {
        // the glitter is decoration and sheds first; then the fine sparks,
        // which are cheap to lose; the body is what makes it fire, so it only
        // shrinks once everything above it has bottomed out
        if (glitBudget > GLIT_FLOOR) glitBudget = Math.max(GLIT_FLOOR, glitBudget - 8);
        else if (budget > 260) budget -= 14;
        else if (bodyBudget > BODY_FLOOR) bodyBudget -= 2;
        else if (dprCap > 1 && frameEMA > 26) { dprCap = 1; layout(); }
      } else if (frameEMA < 13.2) {
        if (bodyBudget < BODY_MAX) bodyBudget += 1;
        else if (budget < CAP) budget += 6;
        else if (glitBudget < GLIT_MAX) glitBudget = Math.min(GLIT_MAX, glitBudget + 4);
      }

      // ease every parameter toward the state target
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        P[key] = ease(P[key], T[key], dt, key === "cool" ? 0.22 : 0.34);
      }
      // settings and auto dim ease rather than snap
      for (var si = 0; si < EASED.length; si++) {
        var sk = EASED[si];
        S[sk] = ease(S[sk], settings[sk], dt, settingsTau);
      }
      dim = ease(dim, dimTarget, dt, 0.55);

      // the angle takes the short way round, like the hue
      var angGap = shortestHue(angleShown, settings.angle);
      if (Math.abs(angGap) > 0.02) {
        angleShown += angGap * (1 - Math.exp(-dt / settingsTau));
        angleShown = ((angleShown % 360) + 360) % 360;
      } else {
        angleShown = settings.angle;
      }
      // the up axis of the whole system, and the lateral axis across it
      var rad = angleShown * Math.PI / 180;
      var sinA = Math.sin(rad), cosA = Math.cos(rad);
      upX = sinA; upY = -cosA;          // 0 up, 90 right, 180 down, 270 left
      latX = cosA; latY = sinA;

      // a stately glide when the emitter is asked to move, and the anchor
      // follows the burn direction at the same pace
      emitX = ease(emitX, wantedX(), dt, 0.62);
      emitY = ease(emitY, wantedY(upY), dt, 0.62);

      // the hue eases the short way round the circle, and the ramps are
      // rebuilt at most every sixth frame while it travels
      var hueGap = shortestHue(hueShown, settings.hue);
      if (Math.abs(hueGap) > 0.05) {
        hueShown += hueGap * (1 - Math.exp(-dt / settingsTau));
        hueShown = ((hueShown % 360) + 360) % 360;
      } else if (hueShown !== settings.hue) {
        hueShown = settings.hue;
      }
      hueTick++;
      if (Math.abs(shortestHue(hueBuilt, hueShown)) > 1.5 && (hueTick % 5) === 0) {
        buildRamps(hueShown);
        hueBuilt = hueShown;
        paintHueTokens(hueShown);
      }

      var moti = S.motion;
      var bright = S.brightness * dim;
      var sizeS = S.size, speedS = S.speed;
      var heatEff = P.heat * bright;

      // size sets how far the fire reaches, speed how fast it gets there.
      // Acceleration carries speed squared and life carries its inverse, so a
      // fast flame rushes through the same silhouette instead of growing.
      // speed is a clean time scaling of the flame's own clock: every one of
      // its accelerations carries speed squared, damping carries speed, and
      // life carries its inverse, so the silhouette is size's business alone
      var sp2 = speedS * speedS;
      var riseEff = P.rise * (0.40 + 0.60 * moti) * sizeS * sp2;
      var lifeEff = P.life / speedS;
      var bandEff = P.band * sizeS;
      // turbulence: 0 an almost laminar candle, 0.5 the house behaviour, 1 wild
      var turbEff = 0.12 + S.turbulence * 1.76;
      var swirlEff = P.swirl * (0.35 + 0.65 * moti) * turbEff;

      // the pointer decays to nothing when it stops moving, so a parked
      // cursor cannot keep dragging the fire along
      pointerLife += dt;
      pointerVX *= Math.exp(-5.5 * dt);
      pointerVY *= Math.exp(-5.5 * dt);

      // the root stays planted: every sideways influence is zero at the band
      // and only reaches full strength a third of the way up the column
      var rootSpan = Math.max(90, riseEff * 1.05);

      // Gate: the pointer only exists for the flame when it is inside or just
      // beside the silhouette. Anywhere else in the box, including the whole
      // conversation column, it is not consulted at all.
      gateHalfWide = bandEff * 1.9 + POINT_R;
      gateReach = riseEff * 2.7 / (speedS * speedS);
      curRise = riseEff; curLife = lifeEff; curSize = sizeS;
      var repel = pointerLife < 1.2 && pointerX > -9000 && nearFlame(pointerX, pointerYp);

      breath += dt;
      var breathe = 1 + Math.sin(breath * 0.85) * 0.16 + Math.sin(breath * 0.37) * 0.09;

      // spill the firelight onto the interface, a few frames apart so the
      // style recalc never lands on every frame
      lightTick++;
      if ((lightTick & 3) === 0) {
        var lit = (0.20 + heatEff * 0.80) * (0.92 + (breathe - 1) * 0.5) * (1 - P.cool * 0.7);
        if (lit < 0) lit = 0;
        if (lit > 1) lit = 1;
        if (Math.abs(lit - lastLight) > 0.012) {
          lastLight = lit;
          rootEl.style.setProperty("--flamelight", lit.toFixed(3));
        }
      }

      // emission. density scales both populations; the governor still has the
      // last word when the frame time says so.
      var rate = P.rate * moti * S.density * (state === "idle" ? breathe : 1);
      carry += rate * dt;
      var toSpawn = carry | 0;
      carry -= toSpawn;
      var coolFlag = P.cool > 0.5 ? 1 : 0;
      var sizeMul = P.size * sizeS;
      var i;
      for (i = 0; i < toSpawn; i++) {
        spawn(emitX, emitY, bandEff, riseEff, coolFlag, sizeMul, lifeEff);
      }
      // the body population, emitted from the same band at about a tenth
      // of the fine-spark rate
      bcarry += rate * 0.105 * dt;
      var bSpawn = bcarry | 0;
      bcarry -= bSpawn;
      for (i = 0; i < bSpawn; i++) {
        spawnBody(emitX, emitY, bandEff, riseEff, coolFlag, sizeMul, lifeEff);
      }

      // sparkle: the glitter pass, the stray spark, and the shower each text
      // delta throws. Sparkle 0 puts the glitter out entirely; the default
      // 0.5 emits a tenth of the main rate; 1 doubles that.
      var sparkleS = S.sparkle / 0.5;
      gcarry += rate * 0.10 * sparkleS * dt;
      var gSpawn = gcarry | 0;
      gcarry -= gSpawn;
      if (sparkleS <= 0.001) gcarry = 0;
      for (i = 0; i < gSpawn; i++) {
        spawnGlitter(emitX, emitY, bandEff, riseEff, coolFlag, sizeMul, lifeEff);
      }
      if (state === "idle" && Math.random() < dt * 1.5 * sparkleS) {
        var strayLat = (Math.random() - 0.5) * 180 * sizeS;
        var strayUp = Math.random() * 60 * sizeS;
        spawn(emitX + strayLat * latX + strayUp * upX,
              emitY + strayLat * latY + strayUp * upY,
              10, riseEff * 2.1, coolFlag, 0.7 * sizeS, lifeEff);
      }
      // per-delta flicker bursts
      if (burstQueue > 0) {
        var b = Math.min(burstQueue, 3);
        burstQueue -= b;
        var shower = Math.round(b * 22 * sparkleS);
        for (i = 0; i < shower; i++) {
          var bu = Math.random() * 90 * sizeS;
          spawn(emitX + bu * upX, emitY + bu * upY,
                bandEff * 0.62, riseEff * 1.5, coolFlag, sizeMul * 1.15, lifeEff);
        }
      }

      // simulate
      var t = now * 0.00016;
      var leanX = (W >= 1024 ? W * 0.62 : W * 0.5) - emitX;
      for (i = 0; i < count; i++) {
        pa[i] += dt;
        if (pa[i] >= pl[i] || offCanvas(px[i], py[i])) { kill(i); i--; continue; }

        var age = pa[i] / pl[i];
        curl(px[i] * 0.0036, py[i] * 0.0036, t, curlOut);

        // lateral energy fades with age while the inward pull grows: the body
        // widens a little off the band, then converges to a tapering tip
        var lick = 1 - age * 0.72;
        // everything below is expressed in the flame's own frame, so the whole
        // fire rotates with the angle setting
        var ox = px[i] - emitX, oy = py[i] - emitY;
        var lat = ox * latX + oy * latY;
        var up = ox * upX + oy * upY;
        var converge = -lat * (0.5 + P.pinch * age * age) * sp2;
        var rise01 = up / rootSpan;
        var rootFree = rise01 <= 0 ? 0 : (rise01 >= 1 ? 1 : rise01 * rise01 * (3 - 2 * rise01));
        var buoy = riseEff * 1.9 * (1 - age * 0.65);
        var side = converge + (leanX * P.lean) * 0.5 * rootFree * sp2;
        vx[i] += (curlOut[0] * swirlEff * 3.2 * lick * sp2 + side * latX + buoy * upX) * dt;
        vy[i] += (curlOut[1] * swirlEff * 2.0 * lick * sp2 + side * latY + buoy * upY) * dt;

        // thinking state pulls particles back toward the core
        if (P.swirl > 60) {
          var coreX = emitX + 90 * upX * sizeS, coreY = emitY + 90 * upY * sizeS;
          var dx = coreX - px[i], dy = coreY - py[i];
          var d = Math.sqrt(dx * dx + dy * dy) + 1;
          var pull = ((P.swirl - 60) / 32) * 130 * moti * sp2;
          vx[i] += (dx / d) * pull * dt;
          vy[i] += (dy / d) * pull * dt;
        }

        // the flame sways away from a pointer passing through it, and a fast
        // flick drags only the fire it actually crosses
        if (repel) {
          var rx = px[i] - pointerX, ry = py[i] - pointerYp;
          var r2 = rx * rx + ry * ry;
          if (r2 < POINT_R * POINT_R) {
            var rd = Math.sqrt(r2) + 1;
            var fall = (1 - rd / POINT_R) * rootFree;
            var push = fall * 3200;          // radial: the fire parts
            var tang = push * 0.42;          // tangential: and swirls around it
            vx[i] += ((rx * push - ry * tang) / rd + pointerVX * fall * 0.55) * dt;
            vy[i] += ((ry * push + rx * tang) / rd + pointerVY * fall * 0.30) * dt;
          }
        }

        // damping is strong across the flame and weak along it, so it has to
        // rotate as well: split the velocity, damp each part, put it back
        var vLat = vx[i] * latX + vy[i] * latY;
        var vUp = vx[i] * upX + vy[i] * upY;
        // the damping rate rides speed, so a shorter life sheds the same
        // fraction of velocity and the silhouette stays size-determined
        vLat *= Math.exp(-2.4 * speedS * dt);
        vUp *= Math.exp(-0.42 * speedS * dt);
        vx[i] = vLat * latX + vUp * upX;
        vy[i] = vLat * latY + vUp * upY;
        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
      }

      // the body: same field at lower gain, so it billows instead of darting
      for (i = 0; i < bcount; i++) {
        ba[i] += dt;
        if (ba[i] >= blf[i] || offCanvas(bx[i], by[i])) { killBody(i); i--; continue; }
        var bage = ba[i] / blf[i];
        curl(bx[i] * 0.0026, by[i] * 0.0026, t * 0.7, curlOut);
        var blick = 1 - bage * 0.6;
        var box = bx[i] - emitX, boy = by[i] - emitY;
        var blat = box * latX + boy * latY;
        var bup = box * upX + boy * upY;
        var bconv = -blat * (0.5 + P.pinch * bage * bage) * sp2;
        var brise01 = bup / rootSpan;
        var brootFree = brise01 <= 0 ? 0 : (brise01 >= 1 ? 1 : brise01 * brise01 * (3 - 2 * brise01));
        var bbuoy = riseEff * 1.38 * (1 - bage * 0.7);
        var bside = bconv + (leanX * P.lean) * 0.4 * brootFree * sp2;
        bvx[i] += (curlOut[0] * swirlEff * 1.35 * blick * sp2 + bside * latX + bbuoy * upX) * dt;
        bvy[i] += (curlOut[1] * swirlEff * 0.8 * blick * sp2 + bside * latY + bbuoy * upY) * dt;
        if (repel) {
          var brx = bx[i] - pointerX, bry = by[i] - pointerYp;
          var br2 = brx * brx + bry * bry;
          var BODY_R = POINT_R * 1.35;
          if (br2 < BODY_R * BODY_R) {
            var brd = Math.sqrt(br2) + 1;
            var bfall = (1 - brd / BODY_R) * brootFree;
            var bpush = bfall * 1250, btang = bpush * 0.34;
            bvx[i] += ((brx * bpush - bry * btang) / brd + pointerVX * bfall * 0.22) * dt;
            bvy[i] += ((bry * bpush + brx * btang) / brd + pointerVY * bfall * 0.13) * dt;
          }
        }
        var bvLat = bvx[i] * latX + bvy[i] * latY;
        var bvUp = bvx[i] * upX + bvy[i] * upY;
        bvLat *= Math.exp(-2.8 * speedS * dt);
        bvUp *= Math.exp(-0.62 * speedS * dt);
        bvx[i] = bvLat * latX + bvUp * upX;
        bvy[i] = bvLat * latY + bvUp * upY;
        bx[i] += bvx[i] * dt;
        by[i] += bvy[i] * dt;
      }

      // the glitter rides the same field as the fine particles, a little
      // livelier and with no pointer term: it lives too briefly to be pushed
      for (i = 0; i < gcount; i++) {
        ga[i] += dt;
        if (ga[i] >= glf[i] || offCanvas(gx[i], gy[i])) { killGlitter(i); i--; continue; }
        var gage = ga[i] / glf[i];
        curl(gx[i] * 0.0036, gy[i] * 0.0036, t, curlOut);
        var gox = gx[i] - emitX, goy = gy[i] - emitY;
        var glat = gox * latX + goy * latY;
        var gup = gox * upX + goy * upY;
        var gconv = -glat * (0.5 + P.pinch * gage * gage) * sp2;
        var grise01 = gup / rootSpan;
        var grootFree = grise01 <= 0 ? 0 : (grise01 >= 1 ? 1 : grise01 * grise01 * (3 - 2 * grise01));
        var gbuoy = riseEff * 2.1 * (1 - gage * 0.5);
        var gside = gconv + (leanX * P.lean) * 0.5 * grootFree * sp2;
        gvx[i] += (curlOut[0] * swirlEff * 3.6 * sp2 + gside * latX + gbuoy * upX) * dt;
        gvy[i] += (curlOut[1] * swirlEff * 2.2 * sp2 + gside * latY + gbuoy * upY) * dt;
        var gvLat = gvx[i] * latX + gvy[i] * latY;
        var gvUp = gvx[i] * upX + gvy[i] * upY;
        gvLat *= Math.exp(-2.2 * speedS * dt);
        gvUp *= Math.exp(-0.40 * speedS * dt);
        gvx[i] = gvLat * latX + gvUp * upX;
        gvy[i] = gvLat * latY + gvUp * upY;
        gx[i] += gvx[i] * dt;
        gy[i] += gvy[i] * dt;
      }

      // sparks
      for (i = sparks.length - 1; i >= 0; i--) {
        var s = sparks[i];
        s.life += dt;
        s.vy += 420 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.trail.push(s.x, s.y);
        if (s.trail.length > 44) s.trail.splice(0, 2);
        if (s.life > s.max || s.x < -120 || s.x > W + 120 || s.y > H + 160) sparks.splice(i, 1);
      }

      // ---- draw ----
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#0e0c0a";
      ctx.fillRect(0, 0, W, H);

      // the fire lights the room: one broad radial wash whose reach and
      // strength ride the state machine
      var warmth = (1 - P.cool);
      var roomR = (Math.max(W, H) * (0.42 + heatEff * 0.26)) * (0.94 + breathe * 0.06) * (0.55 + sizeS * 0.45);
      var roomOff = H * 0.20 * sizeS;
      var roomCX = emitX + roomOff * upX, roomCY = emitY + roomOff * upY;
      var gg = ctx.createRadialGradient(roomCX, roomCY, 0, roomCX, roomCY, roomR);
      var warmA = (0.16 + heatEff * 0.30) * warmth * (0.35 + bright * 0.65);
      gg.addColorStop(0, hsla(hueShown, 100, 73, (warmA * 0.92).toFixed(3)));
      gg.addColorStop(0.22, hsla(hueShown, 92, 59, (warmA * 0.46).toFixed(3)));
      gg.addColorStop(0.55, hsla(hueShown, 82, 39, (warmA * 0.15).toFixed(3)));
      gg.addColorStop(1, "rgba(14, 12, 10, 0)");
      ctx.fillStyle = gg;
      ctx.fillRect(0, 0, W, H);

      // the stone drinks a little of the room's light, so the ground reads a
      // shade deeper than the air above it without ever drawing an edge
      var floorY = emitY;
      var floorDir = upY <= 0 ? 1 : -1;      // the reflection lies opposite the fire
      // how much ground there is on that side. The origin sits close to one
      // edge when the fire is upright, so everything below is measured against
      // what is actually there and dies inside it: nothing is ever cut off by
      // the edge of the room, at any height, in either mode.
      var floorRoom = floorDir > 0 ? (H - floorY) : floorY;
      var floorReach = Math.min(floorRoom * 0.98, H * 0.32, 320);
      var stone = ctx.createLinearGradient(0, floorY, 0, floorY + floorDir * floorReach);
      stone.addColorStop(0, "rgba(6, 5, 4, 0)");
      stone.addColorStop(0.45, "rgba(6, 5, 4, 0.045)");
      stone.addColorStop(1, "rgba(6, 5, 4, 0.20)");
      ctx.fillStyle = stone;
      if (floorDir > 0) ctx.fillRect(0, floorY, W, H - floorY);
      else ctx.fillRect(0, 0, W, floorY);

      // the fire itself is painted into its own buffer, never straight onto
      // the room, because the room needs it twice
      fx.setTransform(DPR, 0, 0, DPR, 0, 0);
      fx.globalCompositeOperation = "source-over";
      fx.clearRect(0, 0, W, H);
      fx.globalCompositeOperation = "lighter";

      // the persistent bright core, hugging the lower third, drawn under the
      // particles. Flicker is a composite of a 2.2 Hz and a 3.7 Hz sine.
      var fl = 1
        + Math.sin(breath * 13.8) * 0.085
        + Math.sin(breath * 23.2 + 1.7) * 0.055
        + Math.sin(breath * 6.1 + 0.4) * 0.05;
      var coreW = bandEff * (1.28 + P.core * 0.30);
      var coreReach = riseEff * 1.55 / (speedS * speedS);
      var lobes = [
        [0.00, 0.10, 1.00],
        [-0.34, 0.30, 0.62],
        [0.34, 0.26, 0.58],
        [0.05, 0.58, 0.44]
      ];
      // one transform for the whole group, so the core rotates with the fire
      fx.save();
      fx.translate(emitX, emitY);
      fx.rotate(rad);
      for (var ci = 0; ci < lobes.length; ci++) {
        var lo = lobes[ci];
        var wob = Math.sin(breath * (9 + ci * 3.1) + ci) * 0.14;
        var cw = coreW * lo[2] * (fl + wob) * P.core;
        var ch = cw * (2.05 - lo[1] * 0.9);
        var cx = lo[0] * bandEff * (0.9 + wob);
        var cy = -lo[1] * coreReach;
        fx.globalAlpha = Math.min(0.92, (0.16 + heatEff * 0.34) * lo[2] * (fl - 0.1) * warmth * (0.30 + bright * 0.70));
        // anchored so a lobe reaches only a little past the band: the core is
        // never cut by the edge it sits against
        fx.drawImage(coreSprite, cx - cw, cy - ch * 1.62, cw * 2, ch * 2);
      }
      fx.restore();
      fx.globalAlpha = 1;

      // the continuous body. Each blob is huge and nearly transparent; the
      // ramp index comes from age AND lateral distance from the axis, so the
      // mass is white gold along the centreline and deep translucent red at
      // its silhouette, which is what reads as volume.
      var axisBand = Math.max(20, bandEff);
      for (i = 0; i < bcount; i++) {
        var b2 = ba[i] / blf[i];
        var blat2 = Math.abs((bx[i] - emitX) * latX + (by[i] - emitY) * latY) / axisBand;
        if (blat2 > 1.6) blat2 = 1.6;
        var shade = 0.10 + b2 * 0.55 + blat2 * 0.42;
        if (shade > 1) shade = 1;
        var bidx = (shade * (RAMP - 1)) | 0;
        var bimg = (bc[i] ? coolRamp : bodyRamp)[bidx];
        var balpha = Math.pow(1 - b2, 0.9) * (0.055 + heatEff * 0.075) * (1 - blat2 * 0.28) * bright;
        if (balpha <= 0.003) continue;
        var bsz = bs[i] * (0.78 + b2 * 0.85) * (0.75 + P.size * 0.35);
        fx.globalAlpha = balpha;
        fx.drawImage(bimg, bx[i] - bsz, by[i] - bsz, bsz * 2, bsz * 2);
      }
      fx.globalAlpha = 1;

      for (i = 0; i < count; i++) {
        var a2 = pa[i] / pl[i];
        var idx = (a2 * (RAMP - 1)) | 0;
        if (idx > RAMP - 1) idx = RAMP - 1;
        var img = (pc[i] ? coolRamp : warmRamp)[idx];
        // 0.8 rather than the old 0.62: the old particles carried a haze that
        // muddied the top of the column, and a slightly steeper fade trims it
        // without the body losing its continuity, which the body blobs and
        // the core lobes carry anyway
        var alpha = Math.pow(1 - a2, 0.8) * (0.34 + heatEff * 0.42) * bright;
        if (alpha <= 0.004) continue;
        var sz = ps[i] * (0.95 + a2 * 1.05) * (0.7 + P.size * 0.4);
        fx.globalAlpha = alpha > 1 ? 1 : alpha;
        fx.drawImage(img, px[i] - sz, py[i] - sz, sz * 2, sz * 2);
      }

      // the glitter, on top of everything the body and the soft pass laid
      // down: hot pinpoints from the top of the ramp, each on its own twinkle
      for (i = 0; i < gcount; i++) {
        var g2 = ga[i] / glf[i];
        var rem = 1 - g2;
        var twink = 0.62 + 0.38 * Math.sin(breath * 21 + gph[i] * 5.3);
        var galpha = rem * rem * twink * (0.55 + heatEff * 0.55) * bright;
        if (galpha <= 0.006) continue;
        var gimg = (gc[i] ? coolRamp : warmRamp)[g2 < 0.55 ? 0 : 1];
        var gsz = gs[i] * (1 + g2 * 0.5) * (0.7 + P.size * 0.4);
        fx.globalAlpha = galpha > 1 ? 1 : galpha;
        fx.drawImage(gimg, gx[i] - gsz, gy[i] - gsz, gsz * 2, gsz * 2);
      }
      fx.globalAlpha = 1;

      // spark trails
      for (i = 0; i < sparks.length; i++) {
        var sp = sparks[i];
        var pts = sp.trail;
        for (var j = 0; j < pts.length; j += 2) {
          var f = j / Math.max(2, pts.length);
          fx.globalAlpha = f * f * 0.75;
          var tsz = 2 + f * 6;
          fx.drawImage(warmRamp[Math.max(0, ((1 - f) * 8) | 0)], pts[j] - tsz, pts[j + 1] - tsz, tsz * 2, tsz * 2);
        }
        fx.globalAlpha = 0.95;
        fx.drawImage(warmRamp[0], sp.x - 11, sp.y - 11, 22, 22);
      }
      fx.globalAlpha = 1;

      // ---- the two passes ----
      // the reflection first, so the fire is always the brighter thing.
      // Polished stone is never perfectly still: the mirrored copy drifts a
      // couple of pixels sideways and squashes a hair toward the plane, on a
      // slow beat of its own, which is what reads as a shimmer.
      var refWob = Math.sin(breath * 1.9) * 2.2 + Math.sin(breath * 3.3 + 1.1) * 1.1;
      var refSquash = 0.965 + Math.sin(breath * 2.4 + 0.6) * 0.022;
      var refReach = Math.max(48, Math.min(floorRoom * 0.90, H * 0.22, 260));

      mx.setTransform(DPR * MIRROR_SCALE, 0, 0, DPR * MIRROR_SCALE, 0, 0);
      mx.globalCompositeOperation = "source-over";
      mx.clearRect(0, 0, W, H);
      mx.save();
      mx.translate(refWob, floorY);
      mx.scale(1, -refSquash);              // the mirror about the floor plane
      mx.translate(0, -floorY);
      mx.drawImage(fireBuf, 0, 0, W, H);
      mx.restore();
      // whatever landed on the fire's own side of the plane is not a reflection
      if (floorDir > 0) mx.clearRect(0, 0, W, floorY);
      else mx.clearRect(0, floorY, W, H - floorY);
      // and it fades to nothing long before the ground runs out
      mx.globalCompositeOperation = "destination-in";
      var fade = mx.createLinearGradient(0, floorY, 0, floorY + floorDir * refReach);
      fade.addColorStop(0, "rgba(0, 0, 0, 1)");
      fade.addColorStop(0.34, "rgba(0, 0, 0, 0.46)");
      fade.addColorStop(0.68, "rgba(0, 0, 0, 0.13)");
      fade.addColorStop(1, "rgba(0, 0, 0, 0)");
      mx.fillStyle = fade;
      mx.fillRect(0, 0, W, H);
      mx.globalCompositeOperation = "source-over";

      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.175 + Math.sin(breath * 2.7) * 0.018;
      ctx.drawImage(mirrorBuf, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.drawImage(fireBuf, 0, 0, W, H);

      // grain: a full screen pattern fill, and the only pass that buys
      // nothing but texture. On a phone it runs on alternate frames, which
      // reads as grain moving at half speed and costs half as much.
      if (grainPattern && !(touchDevice && (frames & 1))) {
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = grainPattern;
        ctx.save();
        ctx.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
        ctx.fillRect(-128, -128, W + 256, H + 256);
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = "source-over";

      if (running) rafId = requestAnimationFrame(frame);
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
      dimTarget = busyTalking ? 0.62 : 1;
      scrim.classList.toggle("on", busyTalking);
      placeScrim();
      renderSuggestions();
      if (reduceMotion) drawStatic();
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
      settingsTau = 0.08;                      // live under the hand
      if (ev.target === setHue) {
        settings.hue = clampHue(Number(ev.target.value)) || 0;
      } else {
        var v = Number(ev.target.value) / 100;
        if (ev.target === setBright) settings.brightness = v; else settings.motion = v;
      }
      syncControls();
      if (reduceMotion) {
        buildRamps(settings.hue);
        hueShown = hueBuilt = settings.hue;
        paintHueTokens(settings.hue);
        drawStatic();
      }
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
      settingsTau = 0.3;
      resetAll();                 // the seven the panel does not show go too
      syncControls();
      if (reduceMotion) {
        buildRamps(settings.hue);
        hueShown = hueBuilt = settings.hue;
        paintHueTokens(settings.hue);
        drawStatic();
      }
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
        settingsTau = 0.42;
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
      settingsTau = 0.42;                       // roughly 1.2s to settle
      afterConfig();
      return configSentence(changed);
    }

    // everything a settings change has to do once the values are in place
    function afterConfig() {
      if (reduceMotion) {
        buildRamps(settings.hue);
        hueShown = hueBuilt = settings.hue;
        paintHueTokens(settings.hue);
        drawStatic();
      }
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
        var rgb = rampColor(t, hueShown);
        var r = rgb[0], g = rgb[1], b = rgb[2];
        if (P.cool > 0.5) {
          r = mix(r * 0.55, 168, 0.45);
          g = mix(g * 0.72, 186, 0.45);
          b = mix(b * 1.6 + 60, 210, 0.45);
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
      if (!document.hidden) last = 0;
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
      drawStatic();
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
    var kbTicking = false;
    var kbRelease = 0;
    var stageNear = true;

    stage.addEventListener("scroll", function () {
      stageNear = nearBottom();
    }, { passive: true });

    function toBottom() { stage.scrollTop = stage.scrollHeight; }

    function visibleH() {
      if (vv && vv.height) return vv.height;
      return document.documentElement.clientHeight || window.innerHeight || 0;
    }

    function writeViewport() {
      var h = Math.round(visibleH());
      if (!h) return;
      rootEl.style.setProperty("--vv-height", h + "px");
      rootEl.style.setProperty("--vv-top", Math.round(vv ? vv.offsetTop : 0) + "px");
    }

    function pinToViewport() {
      window.clearTimeout(kbRelease);
      if (kbPinned) return;
      kbPinned = true;
      kbSavedY = window.pageYOffset || document.documentElement.scrollTop || 0;
      writeViewport();
      rootEl.classList.add("kb-pin");
      rootEl.classList.add("kb-open");
      rootEl.classList.remove("seat-pending");
      window.requestAnimationFrame(function () {
        writeViewport();
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
      if (mode === "page") window.scrollTo(0, 0);
      if (stageNear) toBottom();
    }

    function scheduleViewportSync() {
      if (kbTicking) return;
      kbTicking = true;
      window.requestAnimationFrame(function () {
        kbTicking = false;
        syncViewport();
      });
    }

    if (touchDevice) {
      input.addEventListener("focus", pinToViewport);
      input.addEventListener("blur", releaseViewport);
      if (vv) {
        vv.addEventListener("resize", scheduleViewportSync, { passive: true });
        vv.addEventListener("scroll", scheduleViewportSync, { passive: true });
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

      function markSeat() {
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
      frames: function () { return frames; },
      running: function () { return running; },
      start: startLoop,
      stop: stopLoop
    };
    window.ChamaAgent.instance = api;
    return api;
  }

  window.ChamaAgent = { mount: mount };
})();
