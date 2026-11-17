// The headless check rig: every public page in every theme, motion mode and
// size, screenshotted and held to the invariants in README.md beside this.
//   node test/shots/run.mjs [--base URL] [--pages id ...] [--out DIR] [--jobs N]
// Without --base it serves the repo root itself, with vercel.json's headers
// (so the production CSP applies) and /api/* answered by a stub.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const { PAGES } = await import(pathToFileURL(path.join(ROOT, "site/site.js")).href);

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PHONE = { name: "phone", width: 364, height: 610, font: 17, scale: 2, mobile: true };
const DESK = { name: "desk", width: 1440, height: 900, font: null, scale: 1, mobile: false };
const LAND = { name: "land", width: 610, height: 364, font: 17, scale: 2, mobile: true };
const SETTLE = 900; // after load: the H1 halves end at 1.2s from navigation
const STEP_WAIT = 650; // after a scroll: the engine, the strip and the sky catch up

// ---- arguments ----------------------------------------------------------------
const args = process.argv.slice(2);
function opt(name) {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const vals = [];
  for (let j = i + 1; j < args.length && !args[j].startsWith("--"); j++) vals.push(...args[j].split(","));
  return vals;
}
const wanted = opt("--pages");
const pages = wanted ? PAGES.filter((p) => wanted.includes(p.id) || wanted.includes(p.path)) : PAGES;
if (!pages.length) throw new Error(`no page matches ${wanted}; ids are ${PAGES.map((p) => p.id).join(", ")}`);
const OUT = path.resolve(opt("--out")?.[0] || path.join(HERE, "out"));
const JOBS = +(opt("--jobs")?.[0] || 4);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ---- the server -----------------------------------------------------------------
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm", ".vtt": "text/vtt", ".txt": "text/plain", ".xml": "application/xml", ".webmanifest": "application/manifest+json" };
const VERCEL = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const HEADER_RULES = VERCEL.headers.map((h) => ({ re: new RegExp(`^${h.source}$`), headers: h.headers }));

function resolveFile(p) {
  const page = PAGES.find((x) => x.path === p);
  if (page) return path.join(ROOT, page.file);
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) return null;
  for (const c of [f, f + ".html", path.join(f, "index.html")]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  return null;
}
function serve() {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split("?")[0]);
    const head = {};
    for (const r of HEADER_RULES) if (r.re.test(p)) for (const h of r.headers) head[h.key] = h.value;
    if (p.startsWith("/api/")) {
      res.writeHead(200, { ...head, "content-type": "application/json" });
      return res.end("{}");
    }
    let file = resolveFile(p), status = 200;
    if (!file) { file = path.join(ROOT, "404.html"); status = 404; }
    const size = fs.statSync(file).size;
    head["content-type"] = TYPES[path.extname(file)] || "application/octet-stream";
    head["accept-ranges"] = "bytes";
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    if (range && status === 200) {
      const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : size - 1;
      res.writeHead(206, { ...head, "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(status, { ...head, "content-length": size });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

let server = null, BASE = opt("--base")?.[0]?.replace(/\/$/, "");
if (!BASE) {
  server = await serve();
  BASE = `http://127.0.0.1:${server.address().port}`;
}
const ORIGIN = new URL(BASE).origin;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// ---- results --------------------------------------------------------------------
const failures = [];
const shots = []; // { page, row, label, file, vp, full }
const stats = []; // how many text nodes each contrast pass measured
function fail(page, state, check, detail, shot) {
  failures.push({ page, state, check, detail, shot: shot ? path.relative(process.cwd(), shot) : null });
}

// ---- a page in a state ----------------------------------------------------------
// Runs before any of the page's own scripts: the stored choices, the first
// paint's background and the LCP element.
function initScript({ theme, motion }) {
  try {
    if (theme) localStorage.setItem("chama-theme", theme);
    if (motion) localStorage.setItem("chama-motion", motion);
  } catch (e) {}
  window.__rig = { lcp: null, first: null, marker: 1 };
  requestAnimationFrame(() => {
    const d = document.documentElement, b = document.body;
    const t = (c) => !c || c === "transparent" || c === "rgba(0, 0, 0, 0)";
    let bg = getComputedStyle(d).backgroundColor;
    if (t(bg) && b) bg = getComputedStyle(b).backgroundColor;
    window.__rig.first = { bg, dataTheme: d.dataset.theme || null, body: !!b };
  });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      const el = e.element;
      window.__rig.lcp = el ? { tag: el.tagName, inH1: !!el.closest("h1"), text: (el.textContent || "").trim().slice(0, 60), size: e.size } : { tag: null, size: e.size, url: e.url };
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });
}

async function open(vp, { theme, motion, js = true, system } = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.scale,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    javaScriptEnabled: js,
    // the opposite of the stored theme, so a first paint that ignores the
    // stored choice shows up
    colorScheme: system || (theme === "dark" ? "light" : "dark"),
    reducedMotion: "no-preference",
  });
  await context.addInitScript(initScript, { theme, motion });
  const page = await context.newPage();
  if (vp.font) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Page.setFontSizes", { fontSizes: { standard: vp.font } });
  }
  const log = { errors: [], offOrigin: [], bad: [] };
  page.on("console", (m) => { if (m.type() === "error") log.errors.push(m.text().slice(0, 300)); });
  page.on("pageerror", (e) => log.errors.push(`page error: ${e.message}`.slice(0, 300)));
  page.on("request", (r) => {
    const u = r.url();
    if (/^(data|blob|about|chrome-extension):/.test(u)) return;
    if (new URL(u).origin !== ORIGIN) log.offOrigin.push(u);
  });
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.origin === ORIGIN && r.status() >= 400 && !u.pathname.startsWith("/api/") && u.pathname !== "/404") log.bad.push(`${r.status()} ${u.pathname}`);
  });
  if (!server) await page.route(`${ORIGIN}/api/**`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  return { context, page, log };
}

function reportLog(pg, state, log, shot) {
  for (const e of new Set(log.errors)) fail(pg, state, "console", e, shot);
  for (const u of new Set(log.offOrigin)) fail(pg, state, "off-origin request", u, shot);
  for (const u of new Set(log.bad)) fail(pg, state, "failed request", u, shot);
}

// ---- what the page itself measures ----------------------------------------------
// One pass over the document: horizontal overflow, text under the fixed
// header, AA contrast of every visible text node against the ground it sits
// on (or the nearest painted background between it and its world), and text
// left hidden. scope "viewport" looks at what is on screen, "page" at all.
function probe({ scope, contrast, hidden }) {
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const out = { overflow: null, under: [], contrast: [], hidden: [], fading: 0, unknownBg: 0, texts: 0 };

  // colours: any CSS colour string through a 1px canvas, to [r, g, b, a]
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const memo = new Map();
  function rgba(s) {
    if (memo.has(s)) return memo.get(s);
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = s; cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data, v = [d[0], d[1], d[2], d[3] / 255];
    memo.set(s, v); return v;
  }
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1); };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const name = (el) => { const bits = []; for (let e = el, n = 0; e && e !== document.body && n < 3; e = e.parentElement, n++) bits.unshift(e.tagName.toLowerCase() + (e.id ? "#" + e.id : "") + [...e.classList].slice(0, 2).map((c) => "." + c).join("")); return bits.join(" > "); };

  // the ground of a world, resolved through a hidden probe element
  const grounds = new Map();
  function groundOf(world) {
    if (!world) {
      const b = getComputedStyle(document.body).backgroundColor, h = getComputedStyle(document.documentElement).backgroundColor;
      const c = rgba(b); return c[3] > 0 ? c : rgba(h);
    }
    if (grounds.has(world)) return grounds.get(world);
    const p = document.createElement("i");
    p.style.cssText = "display:none;background-color:var(--ground, var(--bg))";
    world.appendChild(p);
    const c = rgba(getComputedStyle(p).backgroundColor); p.remove();
    const g = c[3] > 0 ? over(c, [255, 255, 255, 1]) : groundOf(null);
    grounds.set(world, g); return g;
  }

  // per element: effective opacity, visibility, the clip its scrolling or
  // clipping ancestors put on it, and whether it rides in a fixed layer
  const infos = new Map();
  function info(el) {
    if (infos.has(el)) return infos.get(el);
    const cs = getComputedStyle(el);
    const parent = el.parentElement && el !== document.documentElement ? info(el.parentElement) : { op: 1, clip: null, fixed: false, ariaHidden: false };
    const fixed = cs.position === "fixed";
    let clip = fixed ? null : parent.clip;
    if (el !== document.documentElement && el !== document.body && (cs.overflowX !== "visible" || cs.overflowY !== "visible")) {
      const r = el.getBoundingClientRect();
      clip = clip ? { l: Math.max(clip.l, r.left), t: Math.max(clip.t, r.top), r: Math.min(clip.r, r.right), b: Math.min(clip.b, r.bottom) } : { l: r.left, t: r.top, r: r.right, b: r.bottom };
    }
    const v = { op: parent.op * +cs.opacity, vis: cs.visibility, clip, fixed: fixed || parent.fixed, ariaHidden: parent.ariaHidden || el.getAttribute("aria-hidden") === "true", cs };
    infos.set(el, v); return v;
  }
  const clipRect = (r, c) => c ? { l: Math.max(r.left, c.l), t: Math.max(r.top, c.t), r: Math.min(r.right, c.r), b: Math.min(r.bottom, c.b) } : { l: r.left, t: r.top, r: r.right, b: r.bottom };

  // horizontal overflow, and the elements that cause it
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 1) {
    const wide = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      const clip = info(el).clip;
      if (r.width && r.right > vw + 1 && !(clip && clip.r <= vw + 1) && !(el.parentElement && el.parentElement.getBoundingClientRect().right > vw + 1)) wide.push(`${name(el)} (right edge ${Math.round(r.right)})`);
      if (wide.length >= 4) break;
    }
    out.overflow = `scrollWidth ${sw} > ${vw}: ${wide.join("; ")}`;
  }

  // the header, and whether its strip covers what scrolls under it
  const head = document.querySelector("[data-top]") || document.querySelector("body > header");
  const headCs = head && getComputedStyle(head);
  const headBottom = head && headCs.position === "fixed" ? head.getBoundingClientRect().bottom : 0;
  const strip = head && +getComputedStyle(head, "::before").opacity > 0.9;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest("script, style, noscript, template, title")) continue;
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width * r.height >= 4);
    if (!rects.length) continue;
    const inf = info(el);
    const shown = rects.map((r) => clipRect(r, inf.clip)).filter((r) => r.r - r.l >= 2 && r.b - r.t >= 2);
    const onScreen = shown.filter((r) => r.b > 0 && r.t < vh && r.r > 0 && r.l < vw);
    const inScope = scope === "page" ? shown : onScreen;
    if (!inScope.length || inf.vis !== "visible") continue;
    const snippet = n.data.trim().replace(/\s+/g, " ").slice(0, 50);

    // a stage shows one beat at a time by design, except without JavaScript,
    // where nothing can step it
    if (hidden && inf.op < 0.5 && !inf.ariaHidden && el.closest("main") && (hidden === "all" || !el.closest("[data-stage]"))) {
      out.hidden.push(`"${snippet}" at opacity ${inf.op.toFixed(2)} (${name(el)})`);
      continue;
    }
    if (inf.op < 0.1) continue;
    out.texts++;

    // under the fixed header
    if (head && !strip && !inf.fixed && !head.contains(el)) {
      const hit = onScreen.find((r) => Math.min(r.b, headBottom) - Math.max(r.t, 0) >= 4);
      if (hit) out.under.push(`"${snippet}" (${name(el)}, top ${Math.round(hit.t)} under a ${Math.round(headBottom)}px header)`);
    }

    // contrast
    if (!contrast) continue;
    if (inf.op < 0.9) { out.fading++; continue; }
    const svg = el instanceof SVGElement;
    let fg = rgba(svg ? inf.cs.fill : inf.cs.color);
    if (svg && /url|none/.test(inf.cs.fill)) continue;
    if (fg[3] === 0) continue;
    // the world it sits on: its own, or for a fixed layer the one under it
    let world = el.closest("[data-world]");
    if (inf.fixed) {
      const r = inScope[0], x = (r.l + r.r) / 2, y = (r.t + r.b) / 2;
      world = null;
      for (const e of document.elementsFromPoint(x, y)) { const w = !head?.contains(e) && e.closest("[data-world]"); if (w) { world = w; break; } }
    }
    const layers = [];
    let unknown = false;
    for (let e = el; e && e !== world && e !== document.documentElement && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none" && !/^url\(/.test(cs.backgroundImage)) { unknown = true; break; }
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) layers.push(c);
    }
    if (unknown) { out.unknownBg++; continue; }
    let bg = groundOf(world);
    for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    fg = over(fg, bg);
    const size = parseFloat(inf.cs.fontSize), weight = +inf.cs.fontWeight || 400;
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const got = ratio(fg, bg);
    if (got < need) {
      const key = `${hex(fg)}/${hex(bg)}/${snippet}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.contrast.push(`${got.toFixed(2)}:1 (needs ${need}) ${hex(fg)} on ${hex(bg)}, ${Math.round(size)}px: "${snippet}" (${name(el)})`);
    }
  }
  return out;
}

async function check(pg, state, page, shot, { scope = "viewport", contrast = true, hidden = false } = {}) {
  const r = await page.evaluate(probe, { scope, contrast, hidden });
  stats.push({ page: pg, state, texts: r.texts, fadingSkipped: r.fading, unknownBackground: r.unknownBg });
  if (r.overflow) fail(pg, state, "horizontal overflow", r.overflow, shot);
  for (const u of r.under.slice(0, 6)) fail(pg, state, "text under header", u, shot);
  if (r.under.length > 6) fail(pg, state, "text under header", `and ${r.under.length - 6} more`, shot);
  for (const c of r.contrast) fail(pg, state, "contrast", c, shot);
  for (const h of r.hidden.slice(0, 6)) fail(pg, state, "text hidden", h, shot);
  if (r.hidden.length > 6) fail(pg, state, "text hidden", `and ${r.hidden.length - 6} more`, shot);
  return r;
}

// The sky's colour at the centre of the screen, with everything but the sky
// hidden. Decoded in the page, so the rig needs no image library.
async function skyCentre(page) {
  const has = await page.evaluate(() => { const c = document.querySelector("canvas.layer"); return !!c && getComputedStyle(c).display !== "none"; });
  if (!has) return null;
  await page.addStyleTag({ content: "html *:not(canvas.layer) { visibility: hidden !important; } canvas.layer { visibility: visible !important; }" }).then((h) => h.evaluate((s) => s.setAttribute("data-rig", "")));
  await page.waitForTimeout(120);
  const vp = page.viewportSize();
  const png = await page.screenshot({ clip: { x: vp.width / 2 - 3, y: vp.height / 2 - 3, width: 6, height: 6 } });
  await page.evaluate(() => document.querySelector("style[data-rig]")?.remove());
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const s = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; }
    return s.map((v) => Math.round(v / (d.length / 4)));
  }, png.toString("base64"));
}
const luma = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const cssLuma = (s) => { const m = /rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/.exec(s || ""); return m ? luma([+m[1], +m[2], +m[3]]) : null; };

async function scrollTo(page, y) {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  await page.waitForTimeout(STEP_WAIT);
}
const dirFor = (pg) => { const d = path.join(OUT, pg.id); fs.mkdirSync(d, { recursive: true }); return d; };

// Where to stop in full motion: the top, the middle of each world's hold
// (or, for a world that scrolls, where its middle meets the screen's), and
// the end of the page.
async function holdPoints(page) {
  return page.evaluate(() => {
    const vh = innerHeight, max = document.documentElement.scrollHeight - vh;
    const pinned = document.documentElement.classList.contains("pin");
    const pts = [{ label: "top", y: 0 }];
    document.querySelectorAll(".world").forEach((s, k) => {
      const top = s.getBoundingClientRect().top + scrollY, h = s.offsetHeight;
      const pin = s.querySelector(":scope > .pin");
      const held = pinned && pin && s.dataset.pin !== "off";
      const hold = held ? h - pin.offsetHeight : null;
      const y = held ? top + hold / 2 : top + (h - vh) / 2;
      pts.push({ label: `w${k + 1}-${s.dataset.world}${held ? "" : "-flow"}`, y: Math.round(Math.max(0, Math.min(max, y))), hold });
    });
    pts.push({ label: "end", y: Math.max(0, max) });
    return pts.filter((p, i) => i === 0 || Math.abs(p.y - pts[i - 1].y) > 24);
  });
}

// Viewport positions every half screen between the shots: the
// text-under-header check at each, a shot only where it fails.
async function sweepHeader(pg, state, page, dir, stem) {
  const { max, vh } = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - innerHeight, vh: innerHeight }));
  let failed = 0;
  for (let y = 0; y <= max + 1 && failed < 4; y += Math.round(vh * 0.5)) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
    await page.waitForTimeout(260);
    const r = await page.evaluate(probe, { scope: "viewport", contrast: false, hidden: false });
    if (r.under.length) {
      const shot = path.join(dir, `${stem}-under-${y}.png`);
      await page.screenshot({ path: shot });
      fail(pg, state, "text under header", `at scrollY ${y}: ${r.under.slice(0, 3).join("; ")}`, shot);
      failed++;
    }
  }
}

// Every tenth of a screen, how much of the screen below the header holds
// something to read or look at. A stretch of scroll where almost nothing
// does (under 12% for more than a quarter of a screen) is dead scroll: the
// words of one world gone and the next not yet arrived (2026-11-16 review).
// Anything at 35% opacity or more counts, so a cross-fade is not dead.
// The same sweep fails anything still showing that its own pin's lower
// edge cuts through as the pin leaves (a word that stands still must be
// gone before that edge reaches it).
const DEAD_COVER = 0.12, DEAD_RUN = 0.25;
async function sweepDead(pg, state, page, dir, stem) {
  const { max, vh } = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - innerHeight, vh: innerHeight }));
  const step = Math.round(vh * 0.1), rows = [];
  for (let y = 0; y <= max; y += step) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
    await page.waitForTimeout(160);
    const at = await page.evaluate(() => {
      const vh = innerHeight, vw = innerWidth, head = document.querySelector("[data-top]")?.offsetHeight || 0, bands = new Array(40).fill(0);
      const seen = (el) => { let o = 1; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none") return 0; o *= +cs.opacity; } return o; };
      // a pin clips what it holds, so only the part above its lower edge counts
      const floor = (el) => { const pin = el.closest(".world > .pin"); return pin && getComputedStyle(pin).overflow !== "visible" ? pin.getBoundingClientRect().bottom : Infinity; };
      for (const el of document.querySelectorAll("main :is(h1, h2, h3, p, li, img, svg, video, a, summary, figcaption, input, .logo)")) {
        const r = el.getBoundingClientRect(), bottom = Math.min(r.bottom, floor(el));
        if (r.width < 4 || bottom - r.top < 4 || bottom < head || r.top > vh || r.right < 0 || r.left > vw || seen(el) < 0.35) continue;
        for (let i = Math.max(0, Math.floor(r.top / vh * 40)); i <= Math.min(39, Math.floor((bottom - 1) / vh * 40)); i++) bands[i] = 1;
      }
      // anything still showing that its own pin's lower edge cuts through
      const cut = [];
      for (const el of document.querySelectorAll("main .world > .pin .r")) {
        const r = el.getBoundingClientRect(), f = floor(el);
        if (r.height > 4 && r.top < f - 4 && r.bottom > f + 4 && f < vh - 4 && seen(el) > 0.05) cut.push(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} at ${Math.round(seen(el) * 100)}%`);
      }
      for (const r of document.querySelectorAll("footer")) { const b = r.getBoundingClientRect(); if (b.top < vh) return { cover: 1, cut }; }
      return { cover: bands.reduce((s, v) => s + v, 0) / 40, cut };
    });
    rows.push({ y, cover: at.cover });
    if (at.cut.length && !rows.cutSeen) {
      rows.cutSeen = true;
      const shot = path.join(dir, `${stem}-cut-${y}.png`);
      await page.screenshot({ path: shot });
      fail(pg, state, "cut by its pin", `at scrollY ${y}: ${at.cut.slice(0, 3).join("; ")}`, shot);
    }
  }
  let start = null;
  for (const r of [...rows, { y: max + step, cover: 1 }]) {
    if (r.cover < DEAD_COVER) { if (start === null) start = r.y; continue; }
    if (start !== null && r.y - start > vh * DEAD_RUN) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), start + step);
      await page.waitForTimeout(STEP_WAIT);
      const shot = path.join(dir, `${stem}-dead-${start}.png`);
      await page.screenshot({ path: shot });
      shots.push({ page: pg, row: stem, label: `dead ${start} to ${r.y}`, file: shot, vp: page.__vp });
      fail(pg, state, "dead scroll", `${((r.y - start) / vh).toFixed(2)} screens with under ${DEAD_COVER * 100}% of the screen showing anything, from scrollY ${start}`, shot);
    }
    start = null;
  }
}

// ---- frame fill ------------------------------------------------------------------
// Every scroll position is a frame people see, and none should feel empty
// (Elliot, 2026-11-16: "make every frame feel cozy"). Two measures, in
// light full motion at 1440x900, 1280x720 and 364x610 (17px):
// - the floor, every eighth of a screen: the visible words and figures
//   together span under FILL_FLOOR of the screen's height for more than a
//   quarter screen. A world that opts in with data-fill fails the run on
//   it; every other world is reported, until the page builders bring each
//   page up to it and opt it in.
// - the targets (docs/DESIGN.md, the frame), at 60% of each pinned world's
//   hold: the group, the figure, how far apart their centres are, and the
//   largest empty band. Always reported, never failed.
// A world that cannot meet the floor is listed in FILL_EXEMPT by its
// selector, with the reason. Its misses stay in report.json as "floor
// (exempt: reason)", so they are seen, not hidden.
const FILL_SIZES = [DESK, { name: "laptop", width: 1280, height: 720, font: null, scale: 1, mobile: false }, PHONE];
const FILL_FLOOR = { desk: 0.4, laptop: 0.4, phone: 0.5 };
const FILL_RUN = 0.25;
const FILL_TARGET = {
  desk: { group: 0.55, fig: 0.45, centre: 0.08, band: 0.35 },
  laptop: { group: 0.55, fig: 0.45, centre: 0.08, band: 0.35 },
  phone: { group: 0.65, fig: 0.3, figWidth: 0.9, band: 0.3 },
};
const FILL_EXEMPT = {
  ".home-belief": "its pentagon fades as the next world's identical one arrives in its place; the heading holds the frame (29% desk, 47% phone at worst, 2026-11-17)",
  ".home-approach": "on a phone its figure sits under the words and must leave before the pin's edge cuts it; the heading and line hold the frame (20% at worst, 2026-11-17)",
};
const fillReport = [];

// What one frame holds: the boxes of the visible words and of the visible
// figures inside the safe area (under the header), as fractions of the
// screen's height, and the world under the middle of the screen.
function fillProbe(exempt) {
  const vh = innerHeight, vw = innerWidth, head = document.querySelector("[data-top]")?.offsetHeight || 0;
  for (const f of document.querySelectorAll("footer")) if (f.getBoundingClientRect().top < vh) return { footer: true };
  const seen = (el) => { let o = 1; for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden") return 0; o *= +cs.opacity; } return o; };
  const floor = (el) => { const pin = el.closest(".world > .pin"); return pin && getComputedStyle(pin).overflow !== "visible" ? pin.getBoundingClientRect().bottom : vh; };
  const boxes = (els) => els.map((el) => {
    const r = el.getBoundingClientRect(), t = Math.max(r.top, head), b = Math.min(r.bottom, vh, floor(el));
    return b - t >= 2 && r.width >= 2 && r.right > 0 && r.left < vw && seen(el) >= 0.35 ? { l: r.left, r: r.right, t, b } : null;
  }).filter(Boolean);
  const union = (bs) => bs.length ? { l: Math.min(...bs.map((b) => b.l)), r: Math.max(...bs.map((b) => b.r)), t: Math.min(...bs.map((b) => b.t)), b: Math.max(...bs.map((b) => b.b)) } : null;
  const words = boxes([...document.querySelectorAll("main :is(h1, h2, h3, p, li, a.more, .talk-field, summary)")].filter((e) => !e.closest("svg, .fx, figure .bars-list, .figure-box figcaption")));
  const figs = boxes([...document.querySelectorAll("main :is(svg, img, video, .bars, .rig)")].filter((e) => {
    if (e.closest(".talk-field, .door, .more, summary, button") || (e.tagName === "svg" && e.parentElement.closest("svg"))) return false;
    const r = e.getBoundingClientRect(); return r.width > 60 || r.height > 60;
  }));
  const W = union(words), F = union(figs), G = union([W, F].filter(Boolean));
  // the largest run of the safe area that nothing covers
  const N = 40, band = new Array(N).fill(0), safe = vh - head;
  for (const b of [...words, ...figs]) for (let i = Math.max(0, Math.floor((b.t - head) / safe * N)); i <= Math.min(N - 1, Math.floor((b.b - 1 - head) / safe * N)); i++) band[i] = 1;
  let empty = 0, run = 0;
  for (const v of band) { run = v ? 0 : run + 1; empty = Math.max(empty, run); }
  const mid = vh / 2, worlds = [...document.querySelectorAll("main .world")];
  const k = worlds.findIndex((s) => { const r = s.getBoundingClientRect(); return r.top <= mid && r.bottom > mid; });
  const world = worlds[k];
  const h = (b) => (b ? (b.b - b.t) / vh : 0);
  return {
    k, label: world ? `w${k + 1}-${world.dataset.world}${world.dataset.label ? ` "${world.dataset.label}"` : ""}` : "none",
    opted: !!world?.hasAttribute("data-fill"),
    exempt: world ? Object.keys(exempt).find((s) => world.matches(s)) || null : null,
    group: h(G), fig: h(F), figWidth: F ? (F.r - F.l) / Math.max(1, vw - 32) : 0,
    centre: W && F ? Math.abs((W.t + W.b) / 2 - (F.t + F.b) / 2) / vh : 0,
    band: (empty / N) * safe / vh,
  };
}

async function fillCheck(pg, vp) {
  const state = `fill, light full ${vp.name} ${vp.width}x${vp.height}`;
  const dir = dirFor(pg), stem = `fill-${vp.name}`;
  const { context, page } = await open(vp, { theme: "light", motion: "full" });
  const pct = (v) => `${Math.round(v * 100)}%`;
  try {
    await page.goto(BASE + pg.path, { waitUntil: "load" });
    await page.waitForTimeout(SETTLE);
    const { max, vh } = await page.evaluate(() => ({ max: document.documentElement.scrollHeight - innerHeight, vh: innerHeight }));
    const step = Math.round(vh / 8), floorAt = FILL_FLOOR[vp.name];
    let run = null, shots = 0;
    const close = async (endY) => {
      if (!run || endY - run.y <= vh * FILL_RUN) return (run = null);
      const detail = `${run.label}: words and figures span under ${pct(floorAt)} of the screen (lowest ${pct(run.low)}) for ${((endY - run.y) / vh).toFixed(2)} screens from scrollY ${run.y}`;
      let shot = null;
      if (shots < 3) {
        shots++;
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), run.lowY);
        await page.waitForTimeout(STEP_WAIT);
        shot = path.join(dir, `${stem}-floor-${run.lowY}.png`);
        await page.screenshot({ path: shot });
      }
      if (run.opted && !run.exempt) fail(pg.id, state, "fill floor", detail, shot);
      else fillReport.push({ page: pg.id, state, kind: run.exempt ? `floor (exempt: ${FILL_EXEMPT[run.exempt]})` : "floor", detail, shot: shot && path.relative(process.cwd(), shot) });
      run = null;
    };
    for (let y = 0; y <= max; y += step) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
      await page.waitForTimeout(160);
      const m = await page.evaluate(fillProbe, FILL_EXEMPT);
      const low = !m.footer && m.k >= 0 && m.group < floorAt;
      if (run && (!low || m.k !== run.k)) await close(y);
      if (low && !run) run = { y, k: m.k, label: m.label, opted: m.opted, exempt: m.exempt, low: m.group, lowY: y };
      if (low && m.group < run.low) Object.assign(run, { low: m.group, lowY: y });
    }
    await close(max + step);

    // the targets, at 60% of each pinned world's hold
    const target = FILL_TARGET[vp.name];
    const holds = await page.evaluate(() => [...document.querySelectorAll("main .world")].map((s) => {
      const pin = s.querySelector(":scope > .pin");
      if (!document.documentElement.classList.contains("pin") || !pin || s.dataset.pin === "off") return null;
      return Math.round(s.getBoundingClientRect().top + scrollY + (s.offsetHeight - pin.offsetHeight) * 0.6);
    }));
    for (const y of holds.filter((y) => y !== null)) {
      await scrollTo(page, y);
      const m = await page.evaluate(fillProbe, FILL_EXEMPT);
      if (m.footer || m.k < 0) continue;
      const misses = [];
      if (m.group < target.group) misses.push(`group ${pct(m.group)} (target ${pct(target.group)})`);
      if (m.fig && m.fig < target.fig) misses.push(`figure ${pct(m.fig)} tall (target ${pct(target.fig)})`);
      if (m.fig && target.figWidth && m.figWidth < target.figWidth) misses.push(`figure ${pct(m.figWidth)} of the column wide (target ${pct(target.figWidth)})`);
      if (target.centre && m.fig && m.centre > target.centre) misses.push(`centres ${pct(m.centre)} apart (target ${pct(target.centre)})`);
      if (m.band > target.band) misses.push(`empty band ${pct(m.band)} (target ${pct(target.band)})`);
      if (misses.length) fillReport.push({ page: pg.id, state, kind: "target", detail: `${m.label} at 60% of its hold: ${misses.join(", ")}`, shot: null });
    }
  } catch (e) {
    fail(pg.id, state, "rig error", e.message.split("\n")[0]);
  } finally {
    await context.close();
  }
}

// ---- the matrix ---------------------------------------------------------------
async function runState(pg, theme, motion, vp) {
  const state = `${theme} ${motion} ${vp.name} ${vp.width}x${vp.height}`;
  const stem = `${theme}-${motion}-${vp.name}`;
  const dir = dirFor(pg);
  const { context, page, log } = await open(vp, { theme, motion });
  try {
    await page.goto(BASE + pg.path, { waitUntil: "load" });
    await page.waitForTimeout(SETTLE);
    const top = path.join(dir, `${stem}-top.png`);
    const rig = await page.evaluate(() => window.__rig);

    // the first paint is in the stored theme
    const fl = cssLuma(rig.first?.bg);
    if (fl === null || (theme === "dark" ? fl > 0.25 : fl < 0.6)) fail(pg.id, state, "first paint", `background at the first frame was ${rig.first?.bg} (data-theme ${rig.first?.dataTheme}) for stored ${theme}`, top);

    // the H1 is the LCP element where it must be
    if (["/", "/engineering-department"].includes(pg.path) && !rig.lcp?.inH1) fail(pg.id, state, "LCP not the H1", `LCP was ${JSON.stringify(rig.lcp)}`, top);

    // the three doors after one screen of scroll, on the phone
    if (pg.path === "/" && vp === PHONE) {
      await scrollTo(page, PHONE.height);
      const doors = await page.evaluate(() => [...document.querySelectorAll(".doors .door")].map((d) => { const r = d.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), text: d.textContent.trim().replace(/\s+/g, " ").slice(0, 40) }; }));
      const shot = path.join(dir, `${stem}-doors.png`);
      await page.screenshot({ path: shot });
      shots.push({ page: pg.id, row: stem, label: "doors check", file: shot, vp });
      if (doors.length !== 3) fail(pg.id, state, "doors", `found ${doors.length} doors`, shot);
      for (const d of doors) if (d.t < 0 || d.b > PHONE.height) fail(pg.id, state, "doors", `"${d.text}" spans ${d.t} to ${d.b}, outside the ${PHONE.height}px screen after one screen of scroll`, shot);
      await scrollTo(page, 0);
    }

    if (motion === "full") {
      for (const pt of await holdPoints(page)) {
        await scrollTo(page, pt.y);
        const shot = path.join(dir, `${stem}-${pt.label}.png`);
        await page.screenshot({ path: shot });
        shots.push({ page: pg.id, row: stem, label: `${pt.label} @${pt.y}`, file: shot, vp });
        await check(pg.id, `${state} @${pt.label}`, page, shot);
        if (pt.hold !== null && pt.hold < 1) fail(pg.id, `${state} @${pt.label}`, "pinned world without a hold", "the section is no taller than its pin (no --h), so its words leave as soon as they arrive", shot);
        const sky = await skyCentre(page);
        if (sky) {
          if (theme === "light" && Math.max(...sky) < 24) fail(pg.id, `${state} @${pt.label}`, "sky black", `sky centre is rgb(${sky}) in light theme`, shot);
          else if (theme === "light" ? luma(sky) < 0.45 : luma(sky) > 0.4) fail(pg.id, `${state} @${pt.label}`, "sky theme", `sky centre is rgb(${sky}), which does not read as ${theme}`, shot);
        }
      }
      await sweepHeader(pg.id, state, page, dir, stem);
      if (theme === "light") { page.__vp = vp; await sweepDead(pg.id, state, page, dir, stem); }
    } else {
      const shot = path.join(dir, `${stem}-full.png`);
      await page.screenshot({ path: shot, fullPage: true });
      shots.push({ page: pg.id, row: stem, label: "full page", file: shot, vp, full: true });
      await check(pg.id, state, page, shot, { scope: "page", hidden: "outside-stage" });
      await sweepHeader(pg.id, state, page, dir, stem);
    }
    reportLog(pg.id, state, log, top);
  } catch (e) {
    fail(pg.id, state, "rig error", e.message.split("\n")[0]);
  } finally {
    await context.close();
  }
}

// ---- the extra cases ------------------------------------------------------------
const EXTRA = { id: "extras" };
async function noJs(pg, vp, system) {
  const state = `no JavaScript, system ${system}, ${vp.name} ${vp.width}x${vp.height}`;
  const dir = dirFor(EXTRA), stem = `nojs-${pg.id}-${system}-${vp.name}`;
  const { context, page, log } = await open(vp, { js: false, system });
  try {
    await page.goto(BASE + pg.path, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const shot = path.join(dir, `${stem}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    shots.push({ page: "extras", row: "no JavaScript", label: `${pg.id} ${system} ${vp.name}`, file: shot, vp, full: true });
    await check(pg.id, state, page, shot, { scope: "page", hidden: "all" });
    await sweepHeader(pg.id, state, page, dir, stem);
    reportLog(pg.id, state, log, shot);
  } catch (e) { fail(pg.id, state, "rig error", e.message.split("\n")[0]); } finally { await context.close(); }
}

async function oneColumn(pg) {
  const state = `one column, light full, ${LAND.width}x${LAND.height}`;
  const dir = dirFor(EXTRA), stem = `land-${pg.id}`;
  const { context, page, log } = await open(LAND, { theme: "light", motion: "full" });
  try {
    await page.goto(BASE + pg.path, { waitUntil: "load" });
    await page.waitForTimeout(SETTLE);
    const shot = path.join(dir, `${stem}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    shots.push({ page: "extras", row: "610x364 one column", label: pg.id, file: shot, vp: LAND, full: true });
    if (await page.evaluate(() => document.documentElement.classList.contains("pin"))) fail(pg.id, state, "one column", "html.pin is set at 364px of height", shot);
    await check(pg.id, state, page, shot, { scope: "page", hidden: "outside-stage" });
    await sweepHeader(pg.id, state, page, dir, stem);
    reportLog(pg.id, state, log, shot);
  } catch (e) { fail(pg.id, state, "rig error", e.message.split("\n")[0]); } finally { await context.close(); }
}

async function routerTrip(vp) {
  const state = `router trip / to /engineering-department and Back, dark full ${vp.name}`;
  const dir = dirFor(EXTRA), stem = `router-${vp.name}`;
  const { context, page, log } = await open(vp, { theme: "dark", motion: "full" });
  const titleOf = async (p) => (/<title>([^<]*)<\/title>/.exec(await (await fetch(BASE + p)).text()) || [])[1]?.replace(/&amp;/g, "&");
  try {
    await page.goto(BASE + "/", { waitUntil: "load" });
    await page.waitForTimeout(SETTLE);
    await page.evaluate(() => { window.__rig.marker = "kept"; });
    const legs = [
      ["/engineering-department", () => page.evaluate(() => document.querySelector('header a[href="/engineering-department"], a[href="/engineering-department"]').click())],
      ["/", () => page.goBack({ waitUntil: "commit" }).catch(() => {})],
    ];
    for (const [to, go] of legs) {
      await go();
      await page.waitForFunction((to) => location.pathname === to, to, { timeout: 8000 });
      await page.waitForTimeout(2200);
      const shot = path.join(dir, `${stem}-${to === "/" ? "back-home" : "ed"}.png`);
      await page.screenshot({ path: shot });
      shots.push({ page: "extras", row: `router trip (dark) ${vp.name}`, label: to === "/" ? "Back to /" : "to /engineering-department", file: shot, vp });
      const s = await page.evaluate(() => ({ marker: window.__rig?.marker, title: document.title, h1: document.querySelector("h1")?.textContent.trim(), theme: document.documentElement.dataset.theme }));
      const leg = `${state}, at ${to}`;
      if (s.marker !== "kept") fail("router", leg, "router", "the move was a full page load, not a swap", shot);
      const want = await titleOf(to);
      if (s.title !== want) fail("router", leg, "router", `title is "${s.title}", the page's own is "${want}"`, shot);
      if (s.theme !== "dark") fail("router", leg, "router", `data-theme is ${s.theme} after the move`, shot);
      const sky = await skyCentre(page);
      if (sky && luma(sky) > 0.4) fail("router", leg, "sky theme", `sky centre rgb(${sky}) is not dark`, shot);
      await check("router", leg, page, shot);
    }
    reportLog("router", state, log, null);
  } catch (e) { fail("router", state, "rig error", e.message.split("\n")[0]); } finally { await context.close(); }
}

async function thanks(motion) {
  const state = `/#thanks, light ${motion}, phone`;
  const dir = dirFor(EXTRA);
  const { context, page, log } = await open(PHONE, { theme: "light", motion });
  try {
    await page.goto(BASE + "/#thanks", { waitUntil: "load" });
    await page.waitForTimeout(SETTLE + 400);
    const shot = path.join(dir, `thanks-${motion}.png`);
    await page.screenshot({ path: shot });
    shots.push({ page: "extras", row: "/#thanks", label: motion, file: shot, vp: PHONE });
    const t = await page.evaluate(() => {
      const el = document.getElementById("thanks"), h = document.querySelector("[data-top]");
      if (!el) return { missing: true };
      const r = el.getBoundingClientRect();
      return { display: getComputedStyle(el).display, top: Math.round(r.top), bottom: Math.round(r.bottom), head: h ? Math.round(h.getBoundingClientRect().bottom) : 0, vh: innerHeight };
    });
    if (t.missing) fail("home", state, "thanks", "no #thanks element", shot);
    else if (t.display === "none") fail("home", state, "thanks", "the thanks line is not displayed", shot);
    else if (t.top < t.head || t.bottom > t.vh) fail("home", state, "thanks", `the thanks line spans ${t.top} to ${t.bottom}, not fully between the header (${t.head}) and the bottom (${t.vh})`, shot);
    await check("home", state, page, shot);
    reportLog("home", state, log, shot);
  } catch (e) { fail("home", state, "rig error", e.message.split("\n")[0]); } finally { await context.close(); }
}

// ---- run ------------------------------------------------------------------------
const jobs = [];
for (const pg of pages) for (const theme of ["light", "dark"]) for (const motion of ["full", "low"]) for (const vp of [PHONE, DESK]) jobs.push(() => runState(pg, theme, motion, vp));
for (const pg of pages) jobs.push(() => oneColumn(pg));
for (const pg of pages) for (const vp of FILL_SIZES) jobs.push(() => fillCheck(pg, vp));
for (const pg of pages.filter((p) => ["/", "/engineering-department"].includes(p.path))) for (const vp of [PHONE, DESK]) for (const sys of ["light", "dark"]) jobs.push(() => noJs(pg, vp, sys));
if (pages.some((p) => p.path === "/")) {
  jobs.push(() => routerTrip(DESK), () => routerTrip(PHONE), () => thanks("full"), () => thanks("low"));
}

const started = Date.now();
let done = 0;
await Promise.all(Array.from({ length: JOBS }, async () => {
  while (jobs.length) {
    await jobs.shift()();
    done++;
    if (done % 10 === 0) process.stdout.write(`  ${done} states done, ${jobs.length} queued\n`);
  }
}));

// ---- contact sheets ----------------------------------------------------------
// One per page (and one for the extras), built as HTML next to the shots and
// photographed by the same browser.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const sheets = [];
const failedShots = new Set(failures.map((f) => f.shot && path.resolve(f.shot)));
const groups = [...new Set(shots.map((s) => s.page))];
const sheetCtx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
for (const g of groups) {
  const mine = shots.filter((s) => s.page === g);
  const rows = [...new Set(mine.map((s) => s.row))].sort();
  const nFail = failures.filter((f) => f.page === g || (g === "extras" && ["router"].includes(f.page))).length;
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(g)}</title><style>
  body { margin: 0; padding: 24px; font: 13px/1.4 -apple-system, system-ui, sans-serif; background: #e9e7e1; color: #141412; }
  h1 { font-size: 20px; margin: 0 0 16px; } h2 { font-size: 14px; margin: 24px 0 8px; }
  .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
  figure { margin: 0; } figcaption { font-size: 11px; color: #57544d; margin-top: 4px; max-width: 360px; }
  img { display: block; border: 1px solid #c9c5bb; background: #fff; }
  .bad img { outline: 3px solid #d0021b; outline-offset: 1px; } .bad figcaption { color: #d0021b; font-weight: 600; }
  img.phone { width: 182px; } img.desk { width: 360px; } img.land { width: 305px; }
  img.full.phone { width: 182px; } img.full.desk { width: 300px; } img.full.land { width: 240px; }
  </style><h1>${esc(g)}: ${mine.length} shots, ${nFail} failures</h1>` +
    rows.map((r) => `<h2>${esc(r)}</h2><div class="row">` + mine.filter((s) => s.row === r).map((s) => `<figure class="${failedShots.has(path.resolve(s.file)) ? "bad" : ""}"><img class="${s.vp.name}${s.full ? " full" : ""}" src="${esc(path.relative(OUT, s.file))}"><figcaption>${esc(s.label)}</figcaption></figure>`).join("") + `</div>`).join("");
  const file = path.join(OUT, `sheet-${g}.html`);
  fs.writeFileSync(file, html);
  const p = await sheetCtx.newPage();
  await p.goto(pathToFileURL(file).href, { waitUntil: "load" });
  const png = path.join(OUT, `sheet-${g}.png`);
  await p.screenshot({ path: png, fullPage: true });
  await p.close();
  sheets.push(png);
}
await sheetCtx.close();
await browser.close();
server?.close();

fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, pages: pages.map((p) => p.id), seconds: Math.round((Date.now() - started) / 1000), failures, fill: fillReport, sheets, stats }, null, 2));
const byCheck = {};
for (const f of failures) byCheck[f.check] = (byCheck[f.check] || 0) + 1;
console.log(`\n${done} states in ${Math.round((Date.now() - started) / 1000)}s, ${failures.length} failures`);
for (const [c, n] of Object.entries(byCheck)) console.log(`  ${c}: ${n}`);
const floors = fillReport.filter((r) => r.kind.startsWith("floor")).length;
console.log(`fill (reported, not failed; worlds opt in with data-fill): ${floors} runs under the floor, ${fillReport.length - floors} worlds short of a target`);
console.log(`report: ${path.join(OUT, "report.json")}`);
for (const s of sheets) console.log(`sheet:  ${s}`);
process.exit(failures.length ? 1 : 0);
