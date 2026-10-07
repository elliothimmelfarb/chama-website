// Keep the flame lit: the 404 page's game. The brand mark, turned so its
// open side faces up, is a cup that catches falling sparks. Each spark feeds
// the flame; a missed spark or a caught drop of water shrinks it; at zero the
// flame is out. Vanilla canvas, no libraries, nothing leaves the page. The
// best score is a per-device convenience in localStorage.
(function () {
  "use strict";

  const root = document.querySelector("[data-sparks]");
  if (!root) return;

  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = root.querySelector("[data-score]");
  const bestEl = root.querySelector("[data-best]");
  const overlay = root.querySelector("[data-overlay]");
  const titleEl = root.querySelector("[data-title]");
  const lineEl = root.querySelector("[data-line]");
  const startBtn = root.querySelector("[data-start]");

  const EMBER = "#f4581f";
  const INK = "#141412";
  const WATER = "#3f7fbf";

  // The mark's two paths, in its 64-unit box, with the optical centring the
  // brand README asks for.
  const CUP = new Path2D("M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z");
  const FLAME = new Path2D("M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57.0 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z");

  const BEST_KEY = "chama-sparks-best";
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { /* storage blocked */ }
  bestEl.textContent = best;

  let W = 0, H = 0, dpr = 1;
  let state = "idle"; // idle | play | over
  let score = 0, flame = 0.6, t = 0, spawnIn = 0, last = 0, raf = 0;
  let cupX = 0, targetX = 0, keyDir = 0;
  let items = [], bits = [];

  function size() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!cupX) cupX = targetX = W / 2;
    cupX = targetX = Math.min(Math.max(cupX, 40), W - 40);
    if (state !== "play") draw();
  }

  const S = () => Math.max(1.3, Math.min(2, W / 380)); // mark scale
  const cupY = () => H - 22 * S() - 12;
  // The cup's mouth, turned to face up, sits 12.5 units above its centre.
  const mouth = () => cupY() - 12.5 * S();

  function reset() {
    score = 0; flame = 0.6; t = 0; spawnIn = 0.4;
    items = []; bits = [];
    scoreEl.textContent = 0;
  }

  function start() {
    reset();
    state = "play";
    root.classList.add("playing");
    overlay.hidden = true;
    canvas.focus({ preventScroll: true });
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function end() {
    state = "over";
    root.classList.remove("playing");
    const isBest = score > best;
    if (isBest) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* storage blocked */ }
    }
    titleEl.textContent = "The flame went out.";
    lineEl.textContent = (score === 1 ? "You caught 1 spark." : "You caught " + score + " sparks.") + (isBest && score > 0 ? " That is your best yet." : "");
    startBtn.textContent = "Light it again";
    overlay.hidden = false;
    startBtn.focus({ preventScroll: true });
  }

  function spawn() {
    // Speed and the share of water rise with time played.
    const level = Math.min(t / 60, 1);
    const water = Math.random() < 0.12 + 0.2 * level;
    items.push({
      water,
      x: 20 + Math.random() * (W - 40),
      y: -12,
      vy: (90 + 150 * level + Math.random() * 50) * (H / 380),
      sway: Math.random() * Math.PI * 2,
    });
    spawnIn = Math.max(0.28, 0.85 - 0.5 * level) * (0.7 + Math.random() * 0.6);
  }

  function burst(x, y, color, n, up) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 120;
      bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (up ? 80 : 0), life: 0.5 + Math.random() * 0.4, color });
    }
  }

  function step(dt) {
    t += dt;
    if (keyDir) targetX += keyDir * 520 * dt;
    targetX = Math.min(Math.max(targetX, 30), W - 30);
    cupX += (targetX - cupX) * Math.min(1, dt * 18);

    spawnIn -= dt;
    if (spawnIn <= 0) spawn();

    const s = S(), top = mouth(), half = 17 * s;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const prevY = it.y;
      it.y += it.vy * dt;
      it.sway += dt * 3;
      if (prevY < top && it.y >= top && Math.abs(it.x + Math.sin(it.sway) * 3 - cupX) < half) {
        items.splice(i, 1);
        if (it.water) {
          flame -= 0.25;
          burst(cupX, top, WATER, 14, true);
        } else {
          score++;
          scoreEl.textContent = score;
          flame = Math.min(1, flame + 0.07);
          burst(cupX, top, EMBER, 8, true);
        }
      } else if (it.y > H + 12) {
        items.splice(i, 1);
        if (!it.water) flame -= 0.08;
      }
    }

    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt;
      if (b.life <= 0) { bits.splice(i, 1); continue; }
      b.vy += 260 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    if (flame <= 0) { flame = 0; burst(cupX, top, INK, 16, true); end(); }
  }

  function drawMark(x, y, s, f, now) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-32, -32);
    ctx.fillStyle = f > 0 ? EMBER : INK;
    ctx.fill(CUP);
    if (f > 0) {
      // The flame grows from its base with the meter and flickers a little.
      const k = 0.8 + f * 1.6 + Math.sin(now / 90) * 0.04 + Math.sin(now / 37) * 0.03;
      ctx.translate(44, 32);
      ctx.scale(k, k);
      ctx.translate(-44, -32);
      ctx.shadowColor = EMBER;
      ctx.shadowBlur = 6 + f * 18;
      ctx.fill(FLAME);
    }
    ctx.restore();
  }

  function draw(now) {
    now = now || performance.now();
    ctx.clearRect(0, 0, W, H);

    // Ground line.
    ctx.strokeStyle = "rgba(20, 20, 18, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, H - 0.5);
    ctx.lineTo(W, H - 0.5);
    ctx.stroke();

    for (const it of items) {
      const x = it.x + Math.sin(it.sway) * 3;
      if (it.water) {
        ctx.fillStyle = WATER;
        ctx.beginPath();
        ctx.moveTo(x, it.y - 12);
        ctx.quadraticCurveTo(x + 8, it.y, x, it.y + 7);
        ctx.quadraticCurveTo(x - 8, it.y, x, it.y - 12);
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(x, it.y, 0, x, it.y, 13);
        g.addColorStop(0, "rgba(255, 214, 140, 1)");
        g.addColorStop(0.35, "rgba(244, 88, 31, 0.95)");
        g.addColorStop(1, "rgba(244, 88, 31, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, it.y, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(244, 88, 31, 0.25)";
        ctx.beginPath();
        ctx.arc(x, it.y - 8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const b of bits) {
      ctx.globalAlpha = Math.max(0, Math.min(1, b.life * 2));
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    drawMark(cupX, cupY(), S(), state === "over" ? 0 : flame, now);

    // The flame meter, a thin bar along the top.
    ctx.fillStyle = "rgba(20, 20, 18, 0.12)";
    ctx.fillRect(0, 0, W, 4);
    ctx.fillStyle = EMBER;
    ctx.fillRect(0, 0, W * Math.max(0, flame), 4);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === "play") step(dt);
    draw(now);
    if (state === "play" || bits.length) raf = requestAnimationFrame(loop);
  }

  // Input: pointer anywhere over the canvas, or the arrow keys and A / D.
  function aim(e) {
    const r = canvas.getBoundingClientRect();
    targetX = e.clientX - r.left;
  }
  canvas.addEventListener("pointermove", aim);
  canvas.addEventListener("pointerdown", (e) => {
    aim(e);
    if (state !== "play") start();
  });

  const KEYS = { ArrowLeft: -1, a: -1, A: -1, ArrowRight: 1, d: 1, D: 1 };
  canvas.addEventListener("keydown", (e) => {
    if (e.key in KEYS) { keyDir = KEYS[e.key]; e.preventDefault(); }
    else if ((e.key === " " || e.key === "Enter") && state !== "play") { start(); e.preventDefault(); }
  });
  canvas.addEventListener("keyup", (e) => {
    if (KEYS[e.key] === keyDir) keyDir = 0;
  });
  startBtn.addEventListener("click", start);

  // Pause when the tab is hidden; a game left running in the background is a
  // game lost.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (state === "play") { last = performance.now(); raf = requestAnimationFrame(loop); }
  });

  new ResizeObserver(size).observe(canvas);
  size();
})();
