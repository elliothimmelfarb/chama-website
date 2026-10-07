/* ==========================================================================
   Keep the flame lit: the 404 page's game, played across the whole screen.

   The brand mark, turned so its open side faces up, is a cup. Sparks fall;
   each one caught feeds the flame in the cup, and a missed spark or a caught
   drop of water shrinks it. When the flame is out, the game is over.

   The ground is the site's own sky (sky.js): the game starts on paper, and
   every ten sparks the next world burns up from below, as it does when the
   home page scrolls: paper, the grid, the forge, the night, the tides, and
   the flame, where the sky's fire rises out of the cup. Before a game the
   cup rests where the main pages draw their figure.

   No libraries, nothing from the network. The best score is a per-device
   convenience in localStorage. Under reduced motion the sky holds still and
   the cup does not bob; a game, being asked for, still moves.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PQ = window.matchMedia && matchMedia("(max-width: 759px), (max-aspect-ratio: 9/10)");
  var EMBER = "#f4581f";
  var THEME = ["paper", "grid", "forge", "night", "tides", "flame"];
  var BG = ["#f3f0e8", "#e3e8ec", "#0e0c0a", "#070a1f", "#06343a", "#0a0705"];
  var NAMES = ["Paper", "The grid", "The forge", "The night", "The tides", "The flame"];
  var PER_WORLD = 10;

  var sky = document.getElementById("sky");
  var play = document.getElementById("play");
  if (!sky || !play) return;
  var ctx = play.getContext("2d");

  var $ = function (s) { return document.querySelector(s); };
  var themed = document.querySelectorAll("[data-theme]:not(footer)");
  var trail = document.querySelectorAll("[data-trail] li");
  var scoreEl = $("[data-score]"), bestEls = document.querySelectorAll("[data-best]");
  var worldEl = $("[data-world-name]"), finalEl = $("[data-final]"), reachedEl = $("[data-reached]");
  var live = $("[data-live]");

  // The mark's two paths, in its 64-unit box, with the brand's optical centring.
  var CUP = new Path2D("M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z");
  var FLAME = new Path2D("M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57.0 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z");

  var BEST_KEY = "chama-sparks-best";
  var best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { /* storage blocked */ }
  bestEls.forEach(function (el) { el.textContent = best; });

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  // ---- the sky ---------------------------------------------------------------
  var GL = window.ChamaSky ? window.ChamaSky.init(sky) : null;
  if (GL) root.classList.add("gl");
  sky.addEventListener("webglcontextlost", function (e) { e.preventDefault(); GL = null; root.classList.remove("gl"); });

  // The world on screen, and the one burning up through it.
  var world = { a: 0, b: 0, mix: 0, burning: false };
  function burnTo(k) {
    if (k === world.b && !world.burning) return;
    world.a = world.burning ? world.b : world.a;
    world.b = k;
    world.mix = 0;
    world.burning = true;
  }
  function setTheme(k) {
    themed.forEach(function (el) { el.setAttribute("data-theme", THEME[k]); });
    trail.forEach(function (li, i) { li.toggleAttribute("data-on", i <= k); li.toggleAttribute("data-here", i === k); });
    if (worldEl) worldEl.textContent = NAMES[k];
  }

  // ---- sizing ----------------------------------------------------------------
  var W = 0, H = 0, dpr = 1;
  function size() {
    W = window.innerWidth;
    H = play.clientHeight || window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    play.width = Math.round(W * dpr);
    play.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (GL) {
      var s = Math.min(window.devicePixelRatio || 1, 1.5);
      if (W * H * s * s > 2.1e6) s = Math.sqrt(2.1e6 / (W * H));
      sky.width = Math.max(1, Math.round(sky.clientWidth * s));
      sky.height = Math.max(1, Math.round(sky.clientHeight * s));
      GL.gl.viewport(0, 0, sky.width, sky.height);
    }
    if (state !== "play") cup.x = cup.tx = pose().x;
  }

  // Where the cup rests: in the figure's place on the main pages between
  // games, and along the bottom of the screen during one.
  function pose() {
    var portrait = PQ && PQ.matches;
    if (state !== "play") {
      return portrait
        ? { x: W * 0.5, y: H * 0.33, s: Math.min(W, H * 0.6) / 190 }
        : { x: W * 0.71, y: H * 0.56, s: Math.min(W * 0.24, H * 0.36) / 64 };
    }
    var s = clamp(Math.min(W, H) / 330, 1.25, 2);
    return { x: cup.tx, y: H - 24 * s - 18, s: s };
  }

  // ---- the game --------------------------------------------------------------
  var state = "idle"; // idle | play | over
  var score = 0, flame = 0.6, t = 0, spawnIn = 0, reached = 0;
  var items = [], bits = [];
  // solid: 0 draws the cup as the main pages draw their figures (an ink
  // outline over a faint fill, with an ember line beside it), 1 as the mark.
  var cup = { x: 0, y: 0, s: 1, tx: 0, from: null, at: 1, solid: 0 };
  var ptr = { x: 0, y: 0, seen: false };
  var keyDir = 0;

  function moveCup(dur) {
    cup.from = { x: cup.x, y: cup.y, s: cup.s };
    cup.at = dur ? 0 : 1;
    cup.dur = dur || 1;
  }

  function start() {
    state = "play";
    score = 0; flame = 0.6; t = 0; spawnIn = 0.6; reached = 0;
    items = []; bits = [];
    scoreEl.textContent = "0";
    cup.tx = cup.x;
    moveCup(0.7);
    burnTo(0);
    setTheme(0);
    root.classList.add("playing");
    root.classList.remove("over", "scored");
    window.scrollTo(0, 0);
    say("Game started. The world is paper.");
    wake();
  }

  function end() {
    state = "over";
    // What was still falling goes up in smoke with the flame.
    items.forEach(function (it) { burst(it.x, it.y, it.water ? "rgba(159, 208, 255, 0.8)" : EMBER, 3, false); });
    items = [];
    moveCup(0.9);
    root.classList.remove("playing");
    root.classList.add("over");
    var isBest = score > best;
    if (isBest) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* storage blocked */ }
    }
    bestEls.forEach(function (el) { el.textContent = best; });
    finalEl.textContent = score === 1 ? "1 spark" : score + " sparks";
    var line = reached > 0 ? "You reached " + NAMES[reached].toLowerCase() + "." : "Every ten sparks takes you to the next world.";
    if (isBest && score > 0) line += " That is your best yet.";
    else if (best > 0) line += " Your best is " + best + ".";
    reachedEl.textContent = line;
    say("The flame went out. You caught " + finalEl.textContent + ". " + line);
    var again = $("[data-again]");
    if (again) again.focus({ preventScroll: true });
  }

  function say(text) { if (live) live.textContent = text; }

  function spawn() {
    // Speed and the share of water rise with time played.
    var level = Math.min(t / 75, 1);
    items.push({
      water: Math.random() < 0.12 + 0.2 * level,
      x: 24 + Math.random() * (W - 48),
      y: -16,
      vy: (0.24 + 0.36 * level + Math.random() * 0.12) * H,
      sway: Math.random() * Math.PI * 2
    });
    // A wide screen spreads the sparks further apart, so it gets more of them.
    var wide = clamp(W / 900, 0.8, 1.6);
    spawnIn = Math.max(0.24, 0.85 - 0.5 * level) * (0.7 + Math.random() * 0.6) / wide;
  }

  function burst(x, y, color, n, up) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 150;
      bits.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up ? 110 : 0), life: 0.5 + Math.random() * 0.45, color: color });
    }
  }

  function dark() { return world.mix > 0.5 ? world.b >= 2 : world.a >= 2; }

  function step(dt) {
    t += dt;
    if (keyDir) cup.tx += keyDir * W * 0.9 * dt;
    cup.tx = clamp(cup.tx, 32, W - 32);

    spawnIn -= dt;
    if (spawnIn <= 0) spawn();

    var mouth = cup.y - 12.5 * cup.s, half = 17 * cup.s;
    for (var i = items.length - 1; i >= 0; i--) {
      var it = items[i], prev = it.y;
      it.y += it.vy * dt;
      it.sway += dt * 3;
      if (prev < mouth && it.y >= mouth && Math.abs(it.x + Math.sin(it.sway) * 3 - cup.x) < half) {
        items.splice(i, 1);
        if (it.water) {
          flame -= 0.25;
          burst(cup.x, mouth, dark() ? "#9fd0ff" : "#3f7fbf", 16, true);
        } else {
          score++;
          scoreEl.textContent = score;
          root.classList.add("scored");
          flame = Math.min(1, flame + 0.07);
          burst(cup.x, mouth, EMBER, 9, true);
          var k = Math.min(THEME.length - 1, Math.floor(score / PER_WORLD));
          if (k > reached) { reached = k; burnTo(k); say(NAMES[k] + "."); }
        }
      } else if (it.y > H + 16) {
        items.splice(i, 1);
        if (!it.water) flame -= 0.08;
      }
    }
    if (flame <= 0) { flame = 0; burst(cup.x, mouth, dark() ? "#fff5ea" : "#141412", 18, true); end(); }
  }

  // ---- drawing ---------------------------------------------------------------
  function drawCup(now) {
    var lit = state !== "over", isDark = dark(), sol = cup.solid;
    var ink = isDark ? "255, 245, 234" : "20, 20, 18";
    var bob = state !== "play" && !RM ? Math.sin(now / 900) * 5 : 0;
    ctx.save();
    ctx.translate(cup.x, cup.y + bob);
    ctx.scale(cup.s, cup.s);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-32, -32);
    if (sol < 1) {
      // The figure: an ember line set off the cup, then the cup in ink.
      ctx.save();
      ctx.translate(30.5, 32);
      ctx.scale(1.16, 1.16);
      ctx.translate(-30.5, -32);
      ctx.lineWidth = 1.5 / cup.s / 1.16;
      ctx.strokeStyle = "rgba(244, 88, 31, " + (1 - sol) * (lit ? 1 : 0.4) + ")";
      ctx.stroke(CUP);
      ctx.restore();
      ctx.fillStyle = "rgba(" + ink + ", " + (1 - sol) * 0.05 + ")";
      ctx.fill(CUP);
      ctx.lineWidth = 1.5 / cup.s;
      ctx.strokeStyle = "rgba(" + ink + ", " + (1 - sol) * 0.9 + ")";
      ctx.stroke(CUP);
    }
    if (sol > 0) {
      ctx.fillStyle = lit ? "rgba(244, 88, 31, " + sol + ")" : "rgba(" + ink + ", " + 0.3 * sol + ")";
      ctx.fill(CUP);
    }
    if (lit) {
      var f = state === "idle" ? 0.3 : flame;
      var flick = RM && state === "idle" ? 0 : Math.sin(now / 90) * 0.04 + Math.sin(now / 37) * 0.03;
      var k = 0.8 + f * 1.6 + flick;
      ctx.translate(44, 32);
      ctx.scale(k, k);
      ctx.translate(-44, -32);
      ctx.fillStyle = EMBER;
      ctx.shadowColor = EMBER;
      ctx.shadowBlur = (6 + f * 18) * cup.s;
      ctx.fill(FLAME);
    }
    ctx.restore();
  }

  function draw(now) {
    var isDark = dark();
    if (GL) ctx.clearRect(0, 0, W, H);
    else {
      // Without WebGL each world is its plain colour, and the next one still
      // rises from below.
      ctx.fillStyle = BG[world.burning ? world.a : world.b];
      ctx.fillRect(0, 0, W, H);
      if (world.burning) {
        ctx.fillStyle = BG[world.b];
        ctx.fillRect(0, H * (1 - ease(world.mix)), W, H);
      }
    }

    for (var i = 0; i < items.length; i++) {
      var it = items[i], x = it.x + Math.sin(it.sway) * 3, y = it.y;
      if (it.water) {
        ctx.fillStyle = isDark ? "#9fd0ff" : "#3f7fbf";
        ctx.beginPath();
        ctx.moveTo(x, y - 13);
        ctx.quadraticCurveTo(x + 8.5, y, x, y + 7);
        ctx.quadraticCurveTo(x - 8.5, y, x, y - 13);
        ctx.fill();
      } else {
        var g = ctx.createRadialGradient(x, y, 0, x, y, 15);
        g.addColorStop(0, "rgba(255, 226, 160, 1)");
        g.addColorStop(0.3, "rgba(244, 88, 31, 0.95)");
        g.addColorStop(1, "rgba(244, 88, 31, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(244, 88, 31, 0.28)";
        ctx.beginPath();
        ctx.arc(x - Math.cos(it.sway) * 2, y - 11, 2.6, 0, Math.PI * 2);
        ctx.arc(x + Math.cos(it.sway) * 2, y - 19, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (var j = 0; j < bits.length; j++) {
      var b = bits[j];
      ctx.globalAlpha = clamp(b.life * 2, 0, 1);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - 1.6, b.y - 1.6, 3.2, 3.2);
    }
    ctx.globalAlpha = 1;

    drawCup(now);

    // During a game, the flame's strength as a thin line across the top.
    if (state === "play") {
      ctx.fillStyle = isDark ? "rgba(255, 245, 234, 0.14)" : "rgba(20, 20, 18, 0.1)";
      ctx.fillRect(0, 0, W, 3);
      ctx.fillStyle = EMBER;
      ctx.fillRect(0, 0, W * clamp(flame, 0, 1), 3);
    }
  }

  function paintSky(now) {
    if (!GL) return;
    var gl = GL.gl, U = GL.U, h = sky.clientHeight || H, w = sky.clientWidth || W;
    var px = ptr.seen ? ptr.x : cup.x, py = ptr.seen ? ptr.y : cup.y;
    gl.uniform2f(U.uRes, sky.width, sky.height);
    gl.uniform1f(U.uTime, RM && state !== "play" ? 40 : now / 1000);
    gl.uniform1f(U.uWorldA, world.burning ? world.a : world.b);
    gl.uniform1f(U.uWorldB, world.b);
    gl.uniform1f(U.uMix, world.burning ? world.mix : 0);
    gl.uniform1f(U.uLocal, 0.5);
    gl.uniform2f(U.uMouse, (px - w / 2) / h, (h / 2 - py) / h);
    gl.uniform2f(U.uFocus, (cup.x - w / 2) / h, (h / 2 - cup.y) / h);
    gl.uniform1f(U.uFocusR, 21 * cup.s / h);
    gl.uniform1f(U.uFlame, state === "over" ? 0 : state === "idle" ? 0.5 : flame);
    gl.uniform1f(U.uHeat, state === "over" ? 0 : flame);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---- the loop --------------------------------------------------------------
  var raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;

    if (state === "play") step(dt);
    for (var i = bits.length - 1; i >= 0; i--) {
      var b = bits[i];
      b.life -= dt;
      if (b.life <= 0) { bits.splice(i, 1); continue; }
      b.vy += 300 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    }

    // The cup glides between its resting places, then follows the player.
    var p = pose();
    if (cup.at < 1) {
      cup.at = Math.min(1, cup.at + dt / cup.dur);
      var e = ease(cup.at);
      cup.x = cup.from.x + (p.x - cup.from.x) * e;
      cup.y = cup.from.y + (p.y - cup.from.y) * e;
      cup.s = cup.from.s + (p.s - cup.from.s) * e;
      cup.solid = state === "play" ? e : 1 - e;
    } else {
      cup.solid = state === "play" ? 1 : 0;
      cup.x += (p.x - cup.x) * Math.min(1, dt * 18);
      cup.y = p.y;
      cup.s = p.s;
    }

    if (world.burning) {
      world.mix = Math.min(1, world.mix + dt / 1.8);
      if (world.mix > 0.5) setTheme(world.b);
      if (world.mix >= 1) { world.a = world.b; world.burning = false; }
    }

    paintSky(now);
    draw(now);

    var moving = state === "play" || bits.length || world.burning || cup.at < 1 || !RM;
    if (moving && !document.hidden) wake();
  }
  function wake() { if (!raf) { if (!last) last = performance.now(); raf = requestAnimationFrame(frame); } }

  // ---- input -----------------------------------------------------------------
  window.addEventListener("pointermove", function (e) {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.seen = true;
    if (state === "play") cup.tx = e.clientX;
    if (RM && state !== "play") wake();
  }, { passive: true });
  window.addEventListener("pointerdown", function (e) {
    if (state === "play") { cup.tx = e.clientX; e.preventDefault(); }
  });

  var KEYS = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
  window.addEventListener("keydown", function (e) {
    if (state !== "play") return;
    if (e.key in KEYS) { keyDir = KEYS[e.key]; e.preventDefault(); }
  });
  window.addEventListener("keyup", function (e) { if (KEYS[e.key] === keyDir) keyDir = 0; });

  document.querySelectorAll("[data-start], [data-again]").forEach(function (b) {
    b.addEventListener("click", function () { b.blur(); start(); });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; keyDir = 0; }
    else { last = performance.now(); wake(); }
  });
  window.addEventListener("resize", function () { size(); wake(); });

  setTheme(0);
  size();
  var p0 = pose();
  cup.x = cup.tx = p0.x; cup.y = p0.y; cup.s = p0.s;
  wake();
})();
