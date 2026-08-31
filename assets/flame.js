/* ==========================================================================
   The fire engine.

   self.ChamaFlame.create({ canvas, touchDevice, reduceMotion, settings, emit })

   Everything that paints the flame lives here, and nothing in here knows what
   a document is. It is handed a drawing surface, told how big that surface is
   and what the settings are, and it answers with pixels and with a small
   stream of emit() calls for the two things it cannot paint itself: the hue
   token and the firelight level, which belong to the page's root element.

   That one restriction is the whole point of the file. A canvas with no DOM
   around it is an OffscreenCanvas, and an OffscreenCanvas can be handed to a
   Web Worker, which is where a phone runs this: the fire burns on its own
   thread and the finger keeps the main one. On a desktop the same code runs
   inline on the page, unchanged, which is why the engine and its host talk
   through a method surface that is identical either way.
   ========================================================================== */
(function () {
  "use strict";

  // The one place the engine reaches for a drawing surface. In a worker there
  // is no document to make one with, and OffscreenCanvas is the only kind
  // there is; on the page the DOM canvas is what we have always used and what
  // every browser draws fastest into, so it stays.
  function makeCanvas(w, h) {
    var c;
    if (typeof OffscreenCanvas !== "undefined" && typeof document === "undefined") {
      c = new OffscreenCanvas(w || 1, h || 1);
    } else {
      c = document.createElement("canvas");
      if (w) c.width = w;
      if (h) c.height = h;
    }
    return c;
  }

  // rAF exists in a worker wherever an OffscreenCanvas 2d context does. The
  // timeout is the floor under an engine running somewhere neither is true.
  function raf(fn) {
    if (typeof self.requestAnimationFrame === "function") return self.requestAnimationFrame(fn);
    return setTimeout(function () { fn(now()); }, 16);
  }

  function caf(id) {
    if (typeof self.cancelAnimationFrame === "function") self.cancelAnimationFrame(id);
    else clearTimeout(id);
  }

  function now() { return performance.now(); }

  function mix(a, b, t) { return a + (b - a) * t; }

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

  function create(opts) {
    var emit = (opts && opts.emit) || function () {};
    var touchDevice = !!(opts && opts.touchDevice);
    var reduceMotion = !!(opts && opts.reduceMotion);

    // the engine's own copy of the settings. The host keeps the authoritative
    // one and does every piece of clamping; what arrives here is trusted.
    var settings = {
      brightness: 0.85, motion: 1, hue: 20,
      size: 1, speed: 1, turbulence: 0.5, density: 1, angle: 0,
      position: null, sparkle: 0.5
    };
    (function () {
      var given = (opts && opts.settings) || null;
      if (!given) return;
      for (var k in given) settings[k] = given[k];
    })();

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

    var canvas = opts.canvas;
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
    var fireBuf = makeCanvas(1, 1);
    var fx = fireBuf.getContext("2d");
    var mirrorBuf = makeCanvas(1, 1);
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

    // the body blobs need a much gentler falloff, so many of them overlap into
    // one continuous mass instead of reading as a heap of discs
    function makeBodySprite(r, g, b, reuse) {
      var c = reuse || makeCanvas(1, 1);
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
      var c = reuse || makeCanvas(1, 1);
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

    /* hsl, hsla, rampColor and mix are module level, above: they are pure
       colour arithmetic with no engine state in them, and the page borrows
       rampColor for the wisp so the waiting mark burns the fire's own hue. */

    var coreSprite = null;

    function makeCoreSprite(hue, reuse) {
      var size = 256, half = size / 2;
      var c = reuse || makeCanvas(1, 1);
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
    // the page borrows both of these for the wisp, which burns the fire's own
    // colour, and its cool blue grey when the fire is in its error state
    var coolShown = -1;

    function shortestHue(from, to) {
      var d = ((to - from + 540) % 360) - 180;
      return d;
    }

    // the hue token is a property on the page's root element, which is the
    // one thing here that is not pixels; the host writes it for us
    function paintHueTokens(hue) {
      var mid = hsl(hue, 92, 55);
      var css = "rgb(" + Math.round(mid[0]) + "," + Math.round(mid[1]) + "," + Math.round(mid[2]) + ")";
      emit("hue", { flamecolor: css, hue: hue });
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

    /* a phone opens with the populations already trimmed rather than making
       the governor spend its first choppy seconds shedding them: the fire is
       indistinguishable at these numbers on a small screen, and a fast
       display (frameEMA under 13.2ms) still earns them back on its own */
    if (touchDevice) {
      budget = 1000;
      bodyBudget = 104;
      glitBudget = 180;
    }

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
      var g = makeCanvas(128, 128);
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

    /* Coordinates arrive already local to the room's own box: turning a page
       coordinate into a local one needs the box, and the box is the host's.
       Timestamps arrive on the host's clock too, and are only ever subtracted
       from each other, so a worker clock offset never enters the arithmetic. */
    function pointerAt(x, y, at) {
      if (!W) return;
      var span = at - lastPT;
      if (span > 4) {
        var ivx = (x - lastPX) / span * 1000;   // css px per second
        var ivy = (y - lastPY) / span * 1000;
        pointerVX = clampAbs(pointerVX * 0.45 + ivx * 0.55, VEL_CAP);
        pointerVY = clampAbs(pointerVY * 0.45 + ivy * 0.55, VEL_CAP);
        lastPX = x; lastPY = y; lastPT = at;
      }
      pointerX = x;
      pointerYp = y;
      pointerLife = 0;
    }

    // a touch beginning: the first move measures its speed against this, not
    // against wherever the last pointer happened to be
    function pointerSeed(x, y, at) {
      lastPX = x; lastPY = y; lastPT = at;
    }

    // the pointer leaving the box is the pointer ceasing to exist for the fire
    function pointerEnd() {
      pointerX = -99999;
      pointerYp = -99999;
      pointerVX = 0;
      pointerVY = 0;
      pointerLife = 99;
    }

    // a tap over the flame throws sparks from where it landed; anywhere else
    // in the box, including the whole conversation column, it does nothing
    function tap(x, y) {
      if (!nearFlame(x, y)) return;
      burstAt(x, y, 42);
    }

    /* ---- the resting finger ---------------------------------------------
       A finger moving through the fire parts it. A finger that stops in it
       does the opposite: the flame notices and leans in, the way a candle
       leans toward a hand held beside it. It is the same family of terms as
       the pointer repel, a quarter of the strength and the other way round,
       zero at the band root like every other sideways influence, plus a thin
       trickle of glitter at the fingertip so the contact has a sound as well
       as a shape. Touch only: the host decides when a touch is resting.    */
    var pressActive = false;
    var pressX = 0, pressY = 0;

    function press(x, y) {
      pressActive = true;
      pressX = x;
      pressY = y;
    }

    function pressEnd() { pressActive = false; }

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
       A phone starts at 1.25x rather than 2x, which is invisible on a field
       with no hard edges, and the governor can drop it to 1x once it has shed
       every particle it is allowed to shed and is still late. It never climbs
       back: a screen that could not hold 1.5x will not hold it a second time,
       and rebuilding the buffers on a hunch is its own stall.

       On touch the fire buffer itself is rendered under CSS resolution and
       upscaled when it is composited: every particle, lobe and blob is a
       drawImage into that buffer, so its pixel count is where the frame is
       actually spent, and a soft additive field survives a 0.7 upscale
       without an edge to give it away. The buffer is addressed through its
       transform, so nothing in the draw path knows the difference. */
    var dprCap = touchDevice ? 1.25 : 2;
    var FIRE_SCALE = touchDevice ? 0.7 : 1;

    /* The box is measured by the host, which owns the element and the
       observer watching it; the engine is told the numbers and keeps them, so
       it can re-run the layout on its own when the governor lowers the cap. */
    var wantW = 0, wantH = 0, wantDPR = 1;

    function resize(w, h, dpr) {
      wantW = w || 0;
      wantH = h || 0;
      wantDPR = dpr || 1;
      layout();
    }

    function layout() {
      DPR = Math.min(wantDPR, dprCap);
      var nw = wantW;
      var nh = wantH;
      if (!nw || !nh) return;   // a hidden or collapsed box must not zero the field
      W = nw;
      H = nh;
      canvas.width = Math.max(1, Math.round(W * DPR));
      canvas.height = Math.max(1, Math.round(H * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var fs = DPR * FIRE_SCALE;
      fireBuf.width = Math.max(1, Math.round(W * fs));
      fireBuf.height = Math.max(1, Math.round(H * fs));
      fx.setTransform(fs, 0, 0, fs, 0, 0);
      var ms = DPR * MIRROR_SCALE;
      mirrorBuf.width = Math.max(1, Math.round(W * ms));
      mirrorBuf.height = Math.max(1, Math.round(H * ms));
      mx.setTransform(ms, 0, 0, ms, 0, 0);
      if (emitY <= 0) emitY = wantedY(upY);
      if (emitX < 0) emitX = homeX();   // first layout: start where we belong
      grainPattern = ctx.createPattern(grainTile, "repeat");
      // a resize can move the floor without moving the keys; drop the caches
      roomGlowG = null;
      stoneG_key = -1;
      fadeG_key = -1;
      if (reduceMotion) drawStatic();
    }

    // ---- static fallback -------------------------------------------------
    // Reduced motion: there is no loop to walk the hue home, so the still
    // frame carries the whole settling itself, rebuilds the ramps when the
    // colour has actually moved, and repaints.
    function drawStatic() {
      if (hueShown !== settings.hue) {
        buildRamps(settings.hue);
        hueShown = hueBuilt = settings.hue;
        paintHueTokens(settings.hue);
      }
      if (!W || !H) return;
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

      emit("light", "0.45");
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

    // gradient caches: the stone and the reflection fade change only when
    // the floor line moves, and on touch the room wash lives two frames
    var roomGlowG = null;
    var stoneG = null, stoneG_key = -1;
    var fadeG = null, fadeG_key = -1;

    /* A phone cannot paint the fire and move a scroll in the same frame, and
       when it has to choose it drops the scroll, which is the one thing the
       hand is holding. So while anything is scrolling the fire paints every
       other frame: dt still measures the real interval, so it burns at its
       own speed, on half the frames, and the finger gets the rest. */
    var lastScrollAt = -1e9;
    var skipFrame = false;

    // the host tells the engine a scroll is under way. In worker mode there
    // is nothing to give the frame back to, so the host never calls it.
    function noteScroll() { lastScrollAt = now(); }

    function ease(cur, target, dt, tau) {
      var k = 1 - Math.exp(-dt / tau);
      return cur + (target - cur) * k;
    }

    function startLoop() {
      if (running || reduceMotion) return;
      running = true;
      last = 0;
      rafId = raf(frame);
    }

    function stopLoop() {
      running = false;
      if (rafId) caf(rafId);
      rafId = 0;
    }

    function frame(now) {
      if (touchDevice && now - lastScrollAt < 260) {
        skipFrame = !skipFrame;
        if (skipFrame) { rafId = raf(frame); return; }
      }
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

      var coolNow = P.cool > 0.5 ? 1 : 0;
      if (coolNow !== coolShown) {
        coolShown = coolNow;
        emit("cool", coolNow);
      }
      // a heartbeat for anything watching from the page, about once a second
      if ((frames % 30) === 0) emit("frames", frames);

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
      // a finger resting in the silhouette, asked the same question
      var lean = pressActive && nearFlame(pressX, pressY);

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
          emit("light", lit.toFixed(3));
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
      // and the fingertip's own trickle: two or three points a frame, out of
      // the same budget as the rest of the glitter, so a resting finger never
      // costs the fire anything it was not already spending
      if (lean) {
        var trickle = 2 + ((Math.random() * 2) | 0);
        for (i = 0; i < trickle; i++) {
          spawnGlitter(pressX, pressY, 7, riseEff * 0.5, coolFlag, sizeMul * 0.9, lifeEff);
        }
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

        // and it leans the other way toward one that has come to rest: the
        // same falloff and the same root gate, a quarter of the strength, and
        // no tangential term at all, so the fire tilts instead of spinning
        if (lean) {
          var lx = pressX - px[i], ly = pressY - py[i];
          var l2 = lx * lx + ly * ly;
          if (l2 < POINT_R * POINT_R) {
            var ld = Math.sqrt(l2) + 1;
            var lpull = (1 - ld / POINT_R) * rootFree * 800;
            vx[i] += (lx / ld) * lpull * dt;
            vy[i] += (ly / ld) * lpull * dt;
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
        if (lean) {
          var blx = pressX - bx[i], bly = pressY - by[i];
          var bl2 = blx * blx + bly * bly;
          var LEAN_BR = POINT_R * 1.35;
          if (bl2 < LEAN_BR * LEAN_BR) {
            var bld = Math.sqrt(bl2) + 1;
            var blpull = (1 - bld / LEAN_BR) * brootFree * 312;
            bvx[i] += (blx / bld) * blpull * dt;
            bvy[i] += (bly / bld) * blpull * dt;
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
      // on a phone the wash gradient is rebuilt every other frame: its drift
      // (breathe, the emitter's glide) is far slower than a frame, and the
      // stale copy is pixel-identical to the eye for half the allocations
      if (!touchDevice || (frames & 1) || !roomGlowG) {
        var gg = ctx.createRadialGradient(roomCX, roomCY, 0, roomCX, roomCY, roomR);
        var warmA = (0.16 + heatEff * 0.30) * warmth * (0.35 + bright * 0.65);
        gg.addColorStop(0, hsla(hueShown, 100, 73, (warmA * 0.92).toFixed(3)));
        gg.addColorStop(0.22, hsla(hueShown, 92, 59, (warmA * 0.46).toFixed(3)));
        gg.addColorStop(0.55, hsla(hueShown, 82, 39, (warmA * 0.15).toFixed(3)));
        gg.addColorStop(1, "rgba(14, 12, 10, 0)");
        roomGlowG = gg;
      }
      ctx.fillStyle = roomGlowG;
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
      // the stone only moves when the emitter glides or the box resizes, so
      // its gradient is cached against the floor line instead of remade
      var stoneEnd = Math.round(floorY + floorDir * floorReach);
      var stoneKey = Math.round(floorY) * 100000 + stoneEnd;
      if (stoneKey !== stoneG_key) {
        stoneG = ctx.createLinearGradient(0, Math.round(floorY), 0, stoneEnd);
        stoneG.addColorStop(0, "rgba(6, 5, 4, 0)");
        stoneG.addColorStop(0.45, "rgba(6, 5, 4, 0.045)");
        stoneG.addColorStop(1, "rgba(6, 5, 4, 0.20)");
        stoneG_key = stoneKey;
      }
      ctx.fillStyle = stoneG;
      if (floorDir > 0) ctx.fillRect(0, floorY, W, H - floorY);
      else ctx.fillRect(0, 0, W, floorY);

      // the fire itself is painted into its own buffer, never straight onto
      // the room, because the room needs it twice
      fx.setTransform(DPR * FIRE_SCALE, 0, 0, DPR * FIRE_SCALE, 0, 0);
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

      // on a phone the reflection is re-rendered on the frames the grain
      // sits out, so each frame carries one of the two extras and never
      // both. A reflection one frame behind a shimmering fire is invisible.
      if (!touchDevice || !(frames & 1)) {
        mx.setTransform(DPR * MIRROR_SCALE, 0, 0, DPR * MIRROR_SCALE, 0, 0);
        mx.globalCompositeOperation = "source-over";
        mx.clearRect(0, 0, W, H);
        mx.save();
        mx.translate(refWob, floorY);
        mx.scale(1, -refSquash);            // the mirror about the floor plane
        mx.translate(0, -floorY);
        mx.drawImage(fireBuf, 0, 0, W, H);
        mx.restore();
        // whatever landed on the fire's own side of the plane is not a reflection
        if (floorDir > 0) mx.clearRect(0, 0, W, floorY);
        else mx.clearRect(0, floorY, W, H - floorY);
        // and it fades to nothing long before the ground runs out
        mx.globalCompositeOperation = "destination-in";
        var fadeEnd = Math.round(floorY + floorDir * refReach);
        var fadeKey = Math.round(floorY) * 100000 + fadeEnd;
        if (fadeKey !== fadeG_key) {
          fadeG = mx.createLinearGradient(0, Math.round(floorY), 0, fadeEnd);
          fadeG.addColorStop(0, "rgba(0, 0, 0, 1)");
          fadeG.addColorStop(0.34, "rgba(0, 0, 0, 0.46)");
          fadeG.addColorStop(0.68, "rgba(0, 0, 0, 0.13)");
          fadeG.addColorStop(1, "rgba(0, 0, 0, 0)");
          fadeG_key = fadeKey;
        }
        mx.fillStyle = fadeG;
        mx.fillRect(0, 0, W, H);
        mx.globalCompositeOperation = "source-over";
      }

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

      if (running) rafId = raf(frame);
    }

    /* ---- what the host can reach ------------------------------------------
       One surface, the same in both modes: inline it is called directly, and
       in a worker every one of these is a message with the same name.      */
    return {
      resize: resize,
      start: startLoop,
      stop: stopLoop,
      pointer: pointerAt,
      pointerSeed: pointerSeed,
      pointerEnd: pointerEnd,
      tap: tap,
      press: press,
      pressEnd: pressEnd,
      setState: setState,
      flicker: flicker,
      launchSpark: launchSpark,
      noteScroll: noteScroll,
      drawStatic: drawStatic,
      // the clock is restarted rather than allowed to charge a hidden tab's
      // whole absence to one frame
      wake: function () { last = 0; },
      set: function (next) {
        if (!next) return;
        for (var k in next) settings[k] = next[k];
      },
      setTau: function (v) { settingsTau = v; },
      setDim: function (v) { dimTarget = v; },
      setReduceMotion: function (v) {
        reduceMotion = !!v;
        if (reduceMotion) { stopLoop(); drawStatic(); }
      }
    };
  }

  self.ChamaFlame = {
    create: create,
    // the pure colour arithmetic, lent to the page: the wisp paints a handful
    // of particles in the fire's own ramp, and there is only one ramp
    rampColor: rampColor,
    hsl: hsl,
    hsla: hsla,
    mix: mix
  };
})();
