/* ==========================================================================
   Worlds: the engine behind /worlds, /worlds/coaching and /worlds/about.

   Each <section class="world"> names two things in its markup:
     data-world  the ground it stands on: paper, grid, forge, night, tides
                 or flame. One WebGL sky paints whichever world is on screen,
                 and as the page scrolls from one section to the next the
                 next world burns up through the last one from below.
     data-scene  the figure drawn over that ground, on a 2D canvas: the
                 business's shape (fit, shelf, offer, questions, change,
                 build, mark) or one of the coaching and about figures
                 (coil, curve, session, releases, keepers, family, timeline).
   Shape scenes hand one shape from world to world and morph it; any other
   pair of scenes cross-fades while the fire passes.

   The engine writes --u on each section (see worlds.css) and never touches
   the words themselves. It paints nothing from the network: no images, no
   fonts, no libraries. Under reduced motion the clock stops, the particles
   go, and every figure is drawn complete.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TAU = Math.PI * 2;
  var EMBER = "#f4581f";
  var FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  var WORLD = { paper: 0, grid: 1, forge: 2, night: 3, tides: 4, flame: 5 };
  var BG = ["#f3f0e8", "#e3e8ec", "#0e0c0a", "#070a1f", "#06343a", "#0a0705"];
  var THEME = ["paper", "grid", "forge", "night", "tides", "flame"];

  function clamp(x, a, b) { if (a === undefined) { a = 0; b = 1; } return x < a ? a : x > b ? b : x; }
  function sm(a, b, x) { var t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function outBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function rgba(c, a) { return "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a + ")"; }

  // ---- geometry: the business's shape, its changes, and the mark --------
  var NP = 180;
  function seg(a, b) { return { len: Math.hypot(b[0] - a[0], b[1] - a[1]), at: function (t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; } }; }
  function arc(r, a0, a1) { a0 *= Math.PI / 180; a1 *= Math.PI / 180; return { len: Math.abs(a1 - a0) * r, at: function (t) { var a = a0 + (a1 - a0) * t; return [r * Math.cos(a), r * Math.sin(a)]; } }; }
  function polyPieces(v) { return v.map(function (a, i) { return seg(a, v[(i + 1) % v.length]); }); }
  function build(pieces) {
    var total = pieces.reduce(function (s, p) { return s + p.len; }, 0);
    var counts = pieces.map(function (p) { return Math.max(1, Math.round(NP * p.len / total)); });
    counts[counts.indexOf(Math.max.apply(null, counts))] += NP - counts.reduce(function (a, b) { return a + b; }, 0);
    var out = new Float32Array(NP * 2), k = 0;
    pieces.forEach(function (p, i) {
      for (var j = 0; j < counts[i]; j++) { var q = p.at(j / counts[i]); out[2 * k] = q[0]; out[2 * k + 1] = q[1]; k++; }
    });
    return out;
  }
  function norm(raw, cx, cy, s) { return raw.map(function (v) { return [(v[0] - cx) / s, (v[1] - cy) / s]; }); }
  function polar(r, deg) { return [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)]; }

  // The hero figure's shape on the Words page, and the two changes it goes
  // through in the "Over time" figure.
  var PENT_V = norm([[160, 66], [240, 138], [209, 249], [118, 264], [69, 169]], 159.2, 177.2, 105);
  var RI = 13.2 / 21;
  var G = {
    pent: build(polyPieces(PENT_V)),
    tA: build(polyPieces(norm([[0, -52], [42, -14], [52, 36], [-22, 52], [-36, -4]], 7, 4, 52))),
    tB: build(polyPieces(norm([[8, -56], [54, -22], [40, 50], [-30, 44], [-52, 4]], 4, 4, 52))),
    // The mark's ring, traced from the top clockwise so the shape curls into it.
    ring: build([arc(1, 270, 322), seg(polar(1, 322), polar(RI, 312)), arc(RI, 312, 48), seg(polar(RI, 48), polar(1, 38)), arc(1, 38, 270)])
  };
  function lerpG(a, b, t) {
    if (t <= 0) return a;
    if (t >= 1) return b;
    var o = new Float32Array(a.length);
    for (var i = 0; i < a.length; i++) o[i] = a[i] + (b[i] - a[i]) * t;
    return o;
  }
  var RING = new Path2D("M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z");
  var SPARK = new Path2D("M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57.0 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z");

  // ---- the sky --------------------------------------------------------------
  var FRAG = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH",
    "precision highp float;",
    "#else",
    "precision mediump float;",
    "#endif",
    "uniform vec2 uRes; uniform float uTime; uniform float uWorldA; uniform float uWorldB; uniform float uMix;",
    "uniform float uLocal; uniform vec2 uMouse; uniform vec2 uFocus; uniform float uFocusR; uniform float uFlame; uniform float uHeat;",
    "const vec3 EMBER = vec3(0.957, 0.345, 0.122);",
    "const mat2 M2 = mat2(1.6, 1.2, -1.2, 1.6);",
    "#ifdef HAS_DERIV",
    "float fw(float x) { return fwidth(x); } vec2 fw2(vec2 x) { return fwidth(x); }",
    "#else",
    "float fw(float x) { return 0.03; } vec2 fw2(vec2 x) { return vec2(0.03); }",
    "#endif",
    "float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
    "float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }",
    "float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = M2 * p; a *= 0.5; } return v; }",
    "float fbm3(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 3; i++) { v += a * noise(p); p = M2 * p; a *= 0.5; } return v; }",

    // paper: the page as it is, with a slow topography under it
    "vec3 wPaper(vec2 uv, vec2 p) {",
    "  vec3 base = vec3(0.953, 0.941, 0.910);",
    "  vec3 col = mix(base * vec3(0.925, 0.915, 0.9), base, smoothstep(1.15, 0.2, length(p * vec2(0.78, 1.0))));",
    "  vec2 md = p - uMouse; vec2 q = p + md * exp(-dot(md, md) * 26.0) * 0.12;",
    "  float k = fbm(q * 1.7 + vec2(uTime * 0.011, -uTime * 0.008) + 3.0) * 17.0;",
    "  float line = 1.0 - smoothstep(0.0, fw(k) * 1.25, 0.5 - abs(fract(k) - 0.5));",
    "  col = mix(col, vec3(0.08, 0.08, 0.07), line * 0.085);",
    "  col = mix(col, vec3(1.0, 0.95, 0.89), exp(-dot(md, md) * 7.0) * 0.4);",
    "  vec2 fd = p - uFocus; col = mix(col, vec3(0.99, 0.87, 0.8), exp(-dot(fd, fd) / (uFocusR * uFocusR * 2.6)) * 0.16);",
    "  return col + (hash(gl_FragCoord.xy) - 0.5) * 0.028; }",

    // the grid: off the shelf, identical squares to the horizon
    "vec3 wGrid(vec2 uv, vec2 p) {",
    "  float hz = -0.1; vec3 skyLow = vec3(0.945, 0.955, 0.965); vec3 skyTop = vec3(0.835, 0.865, 0.895);",
    "  vec3 col = mix(skyLow, skyTop, smoothstep(hz, 0.55, p.y));",
    "  vec2 wg = p * 7.0; vec2 wf = abs(fract(wg - 0.5) - 0.5) / fw2(wg);",
    "  col = mix(col, vec3(0.28, 0.36, 0.44), (1.0 - min(min(wf.x, wf.y), 1.0)) * 0.075 * step(hz, p.y));",
    "  if (p.y < hz) {",
    "    float z = 0.2 / (hz - p.y); vec2 g = vec2(p.x * z * 2.4, z + uTime * 0.3);",
    "    vec2 gf = abs(fract(g - 0.5) - 0.5) / fw2(g); float gl = 1.0 - min(min(gf.x, gf.y), 1.0);",
    "    float near = smoothstep(10.0, 1.0, z); vec3 fl = mix(skyLow, vec3(0.86, 0.89, 0.915), near);",
    "    float h = hash(floor(g)); fl = mix(fl, vec3(0.6, 0.79, 0.93), step(0.93, h) * (0.5 + 0.5 * sin(uTime * 2.2 + h * 40.0)) * 0.6 * near);",
    "    col = mix(fl, vec3(0.1, 0.18, 0.26), gl * 0.6 * near); }",
    "  col += vec3(0.45, 0.66, 0.85) * exp(-abs(p.y - hz) * 70.0) * 0.14;",
    "  return mix(col, vec3(0.72, 0.86, 0.96), exp(-abs(uv.y - (1.0 - fract(uTime * 0.065))) * 110.0) * 0.16); }",

    // the forge: heat rising, a glow that grows with what is made
    "vec3 wForge(vec2 uv, vec2 p) {",
    "  vec3 col = vec3(0.055, 0.045, 0.036); vec2 q = p * vec2(2.2, 1.6) + vec2(0.0, -uTime * 0.22);",
    "  float n = fbm(q + fbm3(q * 1.3 + vec2(uTime * 0.05, 0.0)) * 0.9); float low = smoothstep(0.45, -0.55, p.y);",
    "  col += EMBER * pow(n, 3.2) * (0.25 + 1.35 * low) + vec3(1.0, 0.72, 0.35) * pow(n, 7.0) * low * 1.5;",
    "  vec2 fd = p - uFocus; col += EMBER * exp(-dot(fd, fd) / (uFocusR * uFocusR * 3.2)) * (0.08 + 0.42 * uHeat);",
    "  vec2 md = p - uMouse; col += EMBER * exp(-dot(md, md) * 16.0) * 0.1;",
    "  return col * (0.45 + 0.55 * smoothstep(1.35, 0.25, length(p * vec2(0.7, 1.0)))); }",

    "vec3 starLayer(vec2 q, float seed, float size) {",
    "  vec2 id = floor(q); vec2 f = fract(q) - 0.5; float h = hash(id + seed);",
    "  if (h < 0.7) return vec3(0.0);",
    "  vec2 d = f - (vec2(hash(id + seed + 13.1), hash(id + seed + 71.7)) - 0.5) * 0.7;",
    "  float r = size * (0.4 + 1.3 * fract(h * 17.0)); float tw = 0.55 + 0.45 * sin(uTime * (0.7 + 2.6 * fract(h * 31.0)) + h * 60.0);",
    "  float halo = exp(-length(d) / (r * 2.4)) * 0.14 * (1.0 - smoothstep(0.3, 0.5, max(abs(f.x), abs(f.y))));",
    "  return mix(vec3(0.78, 0.84, 1.0), vec3(1.0, 0.86, 0.72), step(0.72, fract(h * 7.0))) * (exp(-dot(d, d) / (r * r)) + halo) * tw; }",

    // the night: conversations, one star at a time
    "vec3 wNight(vec2 uv, vec2 p) {",
    "  vec3 col = mix(vec3(0.065, 0.045, 0.15), vec3(0.012, 0.018, 0.06), smoothstep(-0.5, 0.5, p.y));",
    "  vec2 r = vec2(cos(0.45) * p.x - sin(0.45) * p.y, sin(0.45) * p.x + cos(0.45) * p.y);",
    "  float band = exp(-pow((r.y + 0.04) * 3.3, 2.0)); float n = fbm(r * 3.2 + vec2(uTime * 0.008, 0.0));",
    "  col += vec3(0.22, 0.2, 0.44) * band * n * 0.6 + vec3(0.48, 0.25, 0.42) * band * pow(n, 3.0) * 0.7;",
    "  vec2 drift = vec2(0.0, uLocal * 0.22);",
    "  col += starLayer((p + drift * 0.45) * 22.0, 1.0, 0.034) + starLayer((p + drift) * 48.0, 7.0, 0.044) * 0.7;",
    "  float T = mod(uTime, 8.0); float K = floor(uTime / 8.0);",
    "  if (T < 0.85) {",
    "    vec2 st = vec2(hash(vec2(K, 1.0)) * 1.1 - 0.2, 0.12 + hash(vec2(K, 2.0)) * 0.3); vec2 dir = normalize(vec2(-1.0, -0.42));",
    "    float pr = T / 0.85; vec2 rel = p - (st + dir * pr * 0.55); float along = dot(rel, -dir); float perp = dot(rel, vec2(-dir.y, dir.x));",
    "    col += vec3(0.9, 0.93, 1.0) * step(0.0, along) * exp(-along * 8.0) * exp(-perp * perp * 60000.0) * (1.0 - pr) * 1.3; }",
    "  return col + EMBER * 0.1 * smoothstep(-0.15, -0.62, p.y) * (0.4 + 0.6 * uLocal); }",

    // the tides: the Atlantic off Lisbon, never the same shape twice
    "vec3 wTides(vec2 uv, vec2 p) {",
    "  vec2 md = p - uMouse; vec2 q = p * 1.8 + md * exp(-dot(md, md) * 30.0) * 0.18; float t = uTime * 0.085;",
    "  vec2 a = vec2(fbm3(q + vec2(0.0, t)), fbm3(q + vec2(5.2, 1.3) - t));",
    "  vec2 b = vec2(fbm3(q + 3.0 * a + vec2(1.7, 9.2) + t * 0.7), fbm3(q + 3.0 * a + vec2(8.3, 2.8) - t * 0.5));",
    "  float n = fbm(q + 2.5 * b);",
    "  vec3 col = mix(vec3(0.01, 0.1, 0.12), vec3(0.03, 0.31, 0.33), smoothstep(0.25, 0.75, n));",
    "  col = mix(col, vec3(0.56, 0.86, 0.79), smoothstep(0.55, 0.9, n) * smoothstep(0.3, 1.1, length(b)) * 0.5);",
    "  col += vec3(0.5, 0.9, 0.8) * pow(1.0 - abs(sin((n + b.x) * 22.0 + uTime * 0.6)), 10.0) * 0.09 * smoothstep(-0.6, 0.5, p.y);",
    "  col += vec3(0.04, 0.11, 0.11) * smoothstep(-0.1, 0.6, p.y);",
    "  vec2 fd = p - uFocus; return col + EMBER * exp(-dot(fd, fd) / (uFocusR * uFocusR * 2.2)) * 0.07; }",

    // the flame: dark, embers, and a fire that rises out of the mark
    "vec3 wFlame(vec2 uv, vec2 p) {",
    "  vec3 col = vec3(0.035, 0.022, 0.016);",
    "  col += EMBER * pow(fbm(p * vec2(3.0, 2.0) + vec2(0.0, -uTime * 0.35)), 3.0) * smoothstep(0.3, -0.6, p.y) * 0.85;",
    "  vec2 fp = p - uFocus; col += EMBER * exp(-dot(fp, fp) / (uFocusR * uFocusR * 6.0)) * (0.08 + 0.26 * uFlame);",
    "  vec2 q = (fp + vec2(0.0, uFocusR * 0.42)) / (uFocusR * 3.0);",
    "  float n = fbm(vec2(q.x * 3.2, q.y * 2.2 - uTime * 1.7)); float n2 = noise(vec2(q.x * 7.0, q.y * 5.0 - uTime * 3.0)); float y = q.y;",
    "  float sway = (n - 0.5) * 0.55 * clamp(y, 0.0, 1.0) + sin(uTime * 1.3 + y * 3.0) * 0.03 * y;",
    "  float w = 0.2 * (1.0 - smoothstep(0.0, 1.0, y)) * smoothstep(-0.14, 0.12, y) + 0.001;",
    "  float body = (1.0 - smoothstep(0.5, 1.0, abs(q.x - sway) / w)) * smoothstep(-0.1, 0.04, y);",
    "  float heat = body * (1.0 - smoothstep(0.1, 1.05, y + (n2 - 0.5) * 0.3)) * uFlame * 0.84;",
    "  vec3 fc = mix(vec3(0.5, 0.05, 0.01), EMBER, smoothstep(0.05, 0.35, heat));",
    "  fc = mix(fc, vec3(1.0, 0.78, 0.4), smoothstep(0.35, 0.7, heat)); fc = mix(fc, vec3(1.0, 0.96, 0.86), smoothstep(0.72, 0.96, heat));",
    "  return mix(col, fc, smoothstep(0.0, 0.22, heat)) + EMBER * heat * 0.2; }",

    "vec3 world(float id, vec2 uv, vec2 p) {",
    "  if (id < 0.5) return wPaper(uv, p); if (id < 1.5) return wGrid(uv, p); if (id < 2.5) return wForge(uv, p);",
    "  if (id < 3.5) return wNight(uv, p); if (id < 4.5) return wTides(uv, p); return wFlame(uv, p); }",

    "void main() {",
    "  vec2 uv = gl_FragCoord.xy / uRes; vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;",
    "  vec3 col = world(uWorldA, uv, p);",
    "  if (uMix > 0.0005) {",
    // the handoff: the next world burns up through this one from below
    "    vec3 nxt = world(uWorldB, uv, p);",
    "    float h = uv.y + (fbm(p * 2.6 + vec2(0.0, -uTime * 0.5)) - 0.5) * 0.55 + (noise(p * 14.0 + vec2(0.0, -uTime * 1.5)) - 0.5) * 0.06;",
    "    float d = mix(-0.4, 1.4, uMix) - h; float burned = smoothstep(-0.004, 0.004, d);",
    "    col = mix(col, col * vec3(0.34, 0.2, 0.12), smoothstep(-0.15, 0.0, d) * (1.0 - burned) * 0.92);",
    "    col = mix(col, nxt, burned);",
    "    float rim = exp(-abs(d) * 70.0) * (0.6 + 0.8 * noise(p * 30.0 - vec2(0.0, uTime * 4.0)));",
    "    float lum = dot(col, vec3(0.299, 0.587, 0.114));",
    "    col *= mix(vec3(1.0), vec3(1.0, 0.72, 0.5), smoothstep(0.1, 0.0, d) * burned * 0.7);",
    "    col = mix(col, vec3(1.0, 0.42, 0.1), clamp(rim * 0.8, 0.0, 1.0));",
    "    col += vec3(1.0, 0.42, 0.1) * rim * 0.5 * (1.0 - lum);",
    "    col = mix(col, vec3(1.0, 0.88, 0.6), clamp(exp(-abs(d) * 230.0) * 1.1, 0.0, 1.0)); }",
    "  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0); }"
  ].join("\n");

  var sky = document.getElementById("sky");
  var act = document.getElementById("actors");
  if (!sky || !act) return;
  var ctx = act.getContext("2d");
  var AW = 0, AH = 0, ADPR = 1, quality = 1;

  function initGL() {
    var gl;
    try { gl = sky.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "high-performance" }); } catch (e) { gl = null; }
    if (!gl) return null;
    var prefix = gl.getExtension("OES_standard_derivatives") ? "#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIV 1\n" : "";
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = sh(gl.VERTEX_SHADER, "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }");
    var fs = sh(gl.FRAGMENT_SHADER, prefix + FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ["uRes", "uTime", "uWorldA", "uWorldB", "uMix", "uLocal", "uMouse", "uFocus", "uFocusR", "uFlame", "uHeat"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    return { gl: gl, U: U };
  }
  var GL = initGL();
  if (GL) root.classList.add("gl");
  sky.addEventListener("webglcontextlost", function (e) { e.preventDefault(); GL = null; root.classList.remove("gl"); });

  function sizeSky() {
    if (!GL) return;
    var w = sky.clientWidth, h = sky.clientHeight;
    var s = Math.min(window.devicePixelRatio || 1, 1.5) * quality;
    if (w * h * s * s > 2.1e6) s = Math.sqrt(2.1e6 / (w * h));
    var W = Math.max(1, Math.round(w * s)), H = Math.max(1, Math.round(h * s));
    if (sky.width !== W || sky.height !== H) { sky.width = W; sky.height = H; GL.gl.viewport(0, 0, W, H); }
  }
  function sizeActors() {
    ADPR = Math.min(window.devicePixelRatio || 1, 2);
    AW = act.clientWidth;
    AH = act.clientHeight;
    act.width = Math.round(AW * ADPR);
    act.height = Math.round(AH * ADPR);
  }

  // ---- the sections ------------------------------------------------------------
  var sections = [].slice.call(document.querySelectorAll(".world"));
  var NW = sections.length;
  if (!NW) return;
  var worldOf = sections.map(function (s) { return WORLD[s.getAttribute("data-world")] || 0; });
  var room = document.querySelector(".flame-room");

  function portrait() { return AW < 760 || AW / AH < 0.9; }

  // ---- stacking: the figure above the words, as one group ----------------------
  // On a phone every world stacks its figure over its words, and the last
  // world of a page does the same at any width. The figure and the words
  // share the band between the masthead and the bottom of the screen (less
  // the footer, under the last world); measure() sizes the figure to the
  // band and centres the pair in it, so a short text does not leave a hole
  // between the two. It writes the words' place back as --copy-b (from the
  // bottom of the screen) and --copy-t (from the top), and a photograph's as
  // --fig-top.
  var stacks = [];
  var footer = document.querySelector("body > footer");
  var head = [document.querySelector(".top")];
  function stacked(k) { return portrait() || sections[k].classList.contains("flame"); }
  function headBottom() {
    var b = 0;
    head.forEach(function (el) { if (el) b = Math.max(b, el.getBoundingClientRect().bottom); });
    return b;
  }
  function stackOf(k) {
    var P = portrait(), sec = sections[k], scene = scenes[k];
    var copy = sec.querySelector(".copy"), card = sec.querySelector(".card");
    var H = pins[k] || AH, ch = copy ? copy.offsetHeight : 0;
    var foot = k === NW - 1 && !room && footer ? footer.offsetHeight : 0;
    var base = P ? 22 : 30, gap = P ? 26 : 22;
    var top = headBottom() + (P ? 12 : 20), avail = H - base - foot - gap - ch - top;
    var tl = (P ? scene.tall : scene.at) || (P ? [0.5, 0.26, 1] : [0.5, 0.4, 1]);
    var R0 = (P ? Math.min(AW * 0.27, AH * 0.16) : Math.min(AW * 0.16, AH * 0.27)) * tl[2];
    var up, down, fixed = false;
    if (scene.box) { up = 0; down = AH * (P ? 0.34 : 0.62); }
    else if (card) { up = 0; down = Math.max(card.offsetHeight, 120); fixed = true; }
    else {
      var e = scene.ext || [1.3, 1.3];
      up = e[0] * R0;
      down = scene.cap ? (scene.cap * R0 + 38) : e[1] * R0;
    }
    var need = up + down, g = fixed ? 1 : clamp(avail / need, 0.7, 1.15);
    var extra = Math.max(0, avail - need * g), figTop = top + extra * 0.45;
    return {
      cx: AW * tl[0], cy: figTop + up * g, R: R0 * g, top: figTop, h: need * g,
      copyB: base + foot + extra * 0.55, copyT: H - base - foot - extra * 0.55 - ch
    };
  }

  function layoutOf(scene, k) {
    var P = portrait(), L, S = stacked(k) ? stacks[k] : null;
    if (S) {
      L = { cx: S.cx, cy: S.cy, R: S.R };
    } else if (P) {
      var tl = scene.tall || [0.5, 0.26, 1], r = Math.min(AW * 0.27, AH * 0.16);
      L = { cx: AW * tl[0], cy: AH * tl[1], R: r * tl[2] };
    } else {
      var at = scene.at || [0.7, 0.5, 1], R0 = Math.min(AW * 0.16, AH * 0.27);
      L = { cx: AW * at[0], cy: AH * at[1], R: R0 * at[2] };
    }
    if (P) L.box = S ? { x: 16, y: S.top, w: AW - 32, h: S.h } : { x: 16, y: AH * 0.1 + 10, w: AW - 32, h: AH * 0.34 };
    else L.box = { x: AW * 0.47, y: AH * 0.17, w: AW * 0.44, h: AH * 0.62 };
    if (scene.box) { L.cx = L.box.x + L.box.w / 2; L.cy = L.box.y + L.box.h / 2; L.R = Math.min(L.box.w, L.box.h) / 2; }
    L.top = S ? S.top : AH * 0.31 - 60;
    L.h = S ? S.h : 120;
    L.portrait = P;
    L.sec = sections[k];
    return L;
  }

  // ---- shape scenes: one shape, handed from world to world ---------------------
  var INK = [20, 20, 18], EMB = [244, 88, 31], CREAM = [246, 240, 230], FOAM = [226, 245, 240], STAR = [214, 222, 255], COLD = [16, 28, 40];
  var STAR_AT = [0.05, 0.19, 0.33, 0.47, 0.64];

  function shapeBase(L) {
    return {
      geom: G.pent, cx: L.cx, cy: L.cy, R: L.R,
      ink: INK, inkA: 1, lw: 1.8, draw: 1,
      fill: INK, fillA: 0.05,
      hug: EMB, hugA: 0, hugDraw: 1, hugScale: 1.12, follow: 10,
      glow: 0, wob: 0,
      sq: 1.45, sqA: 0, ghost: 0,
      stars: [0, 0, 0, 0, 0], edges: 0, constA: 0,
      mark: 0, spark: 0,
      attract: 0, heat: 0, flame: 0
    };
  }

  function markState(s, l) {
    var k = sm(0.02, 0.3, l);
    s.geom = lerpG(G.pent, G.ring, k);
    s.cx -= 1.94 * s.R / 21;
    s.ink = [255, 236, 220]; s.inkA = 1 - k;
    s.fill = EMB; s.fillA = 0.9 + 0.1 * k;
    s.hugA = 1 - k; s.hugScale = lerp(1.12, 1.0, k);
    s.mark = sm(0.3, 0.38, l); s.fillA *= 1 - s.mark;
    s.spark = sm(0.32, 0.44, l);
    s.glow = 16 + 22 * s.spark; s.flame = sm(0.3, 0.62, l); s.heat = 1;
  }

  var SCENES = {
    // the business, as it is: drawn, then fitted
    fit: { kind: "shape", at: [0.71, 0.52, 1.1], cap: 1.45, state: function (s, l, t) {
      s.draw = RM ? 1 : sm(0.2, 1.7, t); s.fillA = 0.05 * s.draw;
      s.hugA = 1; s.hugDraw = RM ? 1 : sm(1.6, 2.7, t); s.wob = 0.016; s.follow = 4;
    } },
    // off the shelf: a square closes on it and cuts what does not fit
    shelf: { kind: "shape", at: [0.7, 0.45, 0.95], cap: 1.2, state: function (s, l) {
      s.ink = COLD; s.fill = COLD; s.fillA = 0.06; s.lw = 1.7;
      s.sqA = sm(0, 0.14, l); s.sq = lerp(1.45, 0.6, sm(0.06, 0.4, l)); s.ghost = sm(0.28, 0.5, l); s.follow = 12;
    } },
    // the offer: built, then supported, then owned
    offer: { kind: "shape", at: [0.7, 0.5, 1.05], state: function (s, l) {
      var bld = sm(0.03, 0.26, l), sup = sm(0.3, 0.5, l), own = sm(0.58, 0.76, l);
      s.ink = CREAM; s.inkA = 0.3 + 0.7 * bld; s.fill = EMB; s.fillA = 0.04 + 0.88 * own;
      s.hugA = Math.min(1, sup * 4); s.hugDraw = sup;
      s.glow = 4 + 16 * sup + 22 * own; s.wob = 0.01; s.follow = 8;
      s.attract = sm(0, 0.06, l) * (1 - sm(0.2, 0.34, l)); s.heat = 0.25 * sup + 0.75 * own;
    } },
    // four questions, four stars, then the first version closes the shape
    questions: { kind: "shape", at: [0.69, 0.5, 1.28], tall: [0.5, 0.27, 1.12], state: function (s, l) {
      s.inkA = 0; s.fill = STAR; s.fillA = 0.07 * sm(0.8, 0.92, l); s.constA = 1;
      s.stars = STAR_AT.map(function (a) { return sm(a, a + 0.07, l); });
      s.edges = sm(0.19, 0.26, l) + sm(0.33, 0.4, l) + sm(0.47, 0.54, l) + sm(0.64, 0.71, l) + sm(0.72, 0.8, l);
      s.hugA = sm(0.8, 0.84, l); s.hugDraw = sm(0.81, 0.96, l); s.glow = 12 * s.hugDraw;
    } },
    // over time: the shape changes and the fit follows a beat behind
    change: { kind: "shape", at: [0.7, 0.5, 1.02], cap: 1.45, state: function (s, l) {
      s.geom = lerpG(lerpG(G.pent, G.tA, sm(0.14, 0.38, l)), G.tB, sm(0.46, 0.7, l));
      s.ink = FOAM; s.fill = FOAM; s.fillA = 0.07;
      s.hugA = 1; s.hugScale = 1.14; s.follow = 2.2; s.wob = 0.045; s.glow = 10;
    } },
    // coaching: software you build yourselves, drawn and fitted in the forge
    build: { kind: "shape", at: [0.7, 0.5, 1.0], state: function (s, l) {
      s.ink = CREAM; s.draw = sm(0.0, 0.3, l); s.fill = EMB; s.fillA = 0.04 + 0.86 * sm(0.55, 0.8, l);
      s.hugA = 1; s.hugDraw = sm(0.25, 0.55, l); s.glow = 4 + 26 * sm(0.4, 0.8, l); s.wob = 0.01; s.follow = 8;
      s.heat = sm(0.3, 0.8, l);
    } },
    // the shape curls into the mark, and the mark lights
    mark: { kind: "shape", at: [0.5, 0.39, 0.46], tall: [0.5, 0.31, 0.58], ext: [2.4, 1.2], state: markState },
    markhigh: { kind: "shape", at: [0.5, 0.25, 0.36], tall: [0.5, 0.24, 0.5], ext: [2.4, 1.2], state: markState },
    // about: the mark was never a shape here, so it draws itself and lights
    markring: { kind: "shape", at: [0.5, 0.33, 0.42], tall: [0.5, 0.3, 0.58], ext: [2.4, 1.2], state: function (s, l) {
      s.geom = G.ring; s.cx -= 1.94 * s.R / 21;
      s.ink = [255, 236, 220]; s.draw = sm(0, 0.16, l); s.fill = EMB; s.fillA = sm(0.12, 0.22, l);
      s.mark = sm(0.2, 0.28, l); s.inkA = 1 - s.mark; s.fillA *= 1 - s.mark;
      s.spark = sm(0.24, 0.36, l); s.glow = 16 + 22 * s.spark; s.flame = sm(0.26, 0.56, l); s.heat = 1;
    } },

    coil: { kind: "draw", at: [0.71, 0.5, 1.1], tall: [0.5, 0.27, 1.05], ext: [1.9, 1.3], parallax: true, draw: drawCoil },
    curve: { kind: "draw", box: true, draw: drawCurve },
    session: { kind: "draw", box: true, draw: drawSession },
    releases: { kind: "draw", box: true, draw: drawReleases },
    keepers: { kind: "draw", at: [0.71, 0.5, 0.78], tall: [0.5, 0.26, 0.78], ext: [1.25, 1.25], parallax: true, draw: drawKeepers },
    family: { kind: "draw", draw: drawFamily },
    timeline: { kind: "draw", draw: drawTimeline }
  };
  var scenes = sections.map(function (s) { return SCENES[s.getAttribute("data-scene")] || SCENES.fit; });

  function shapeState(scene, k, l, t) {
    var s = shapeBase(layoutOf(scene, k));
    scene.state(s, l, t);
    return s;
  }

  function blend(a, b, t) {
    var o = {};
    for (var key in a) {
      var va = a[key], vb = b[key];
      if (key === "geom") continue;
      if (typeof va === "number") o[key] = va + (vb - va) * t;
      else o[key] = va.map(function (x, i) { return x + (vb[i] - x) * t; });
    }
    o.geom = lerpG(a.geom, b.geom, t);
    // a colour fading out never tints the one fading in
    [["fill", "fillA"], ["ink", "inkA"], ["hug", "hugA"]].forEach(function (k) {
      var wa = a[k[1]] * (1 - t), wb = b[k[1]] * t, sum = wa + wb;
      if (sum > 1e-4) o[k[0]] = a[k[0]].map(function (x, i) { return (x * wa + b[k[0]][i] * wb) / sum; });
    });
    return o;
  }

  // ---- drawing the shape -----------------------------------------------------------
  var sp = new Float32Array(NP * 2), hugT = new Float32Array(NP * 2), hug = new Float32Array(NP * 2), hugReady = false;
  var SA = 1;   // the whole shape's opacity, below 1 while it cross-fades with a figure

  function points(s, t, dt) {
    var g = s.geom, mx = 0, my = 0, i;
    for (i = 0; i < NP; i++) { mx += g[2 * i]; my += g[2 * i + 1]; }
    mx /= NP; my /= NP;
    for (i = 0; i < NP; i++) {
      var a = i / NP;
      var wob = s.wob * (Math.sin(TAU * 2 * a + t * 0.9) * 0.6 + Math.sin(TAU * 3 * a - t * 0.7 + 1.3) * 0.4);
      var dx = (g[2 * i] - mx) * (1 + wob), dy = (g[2 * i + 1] - my) * (1 + wob);
      sp[2 * i] = s.cx + (mx + dx) * s.R;
      sp[2 * i + 1] = s.cy + (my + dy) * s.R;
      hugT[2 * i] = s.cx + (mx + dx * s.hugScale) * s.R;
      hugT[2 * i + 1] = s.cy + (my + dy * s.hugScale) * s.R;
    }
    var k = hugReady ? 1 - Math.exp(-dt * s.follow) : 1;
    for (i = 0; i < NP * 2; i++) hug[i] += (hugT[i] - hug[i]) * k;
    hugReady = true;
  }
  function trace(p) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (var i = 1; i < NP; i++) ctx.lineTo(p[2 * i], p[2 * i + 1]);
    ctx.closePath();
  }
  function perim(p) {
    var L = 0;
    for (var i = 0; i < NP; i++) { var j = (i + 1) % NP; L += Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]); }
    return L;
  }
  function drawShape(s, m) {
    trace(sp);
    if (s.fillA * m * SA > 0.002) {
      ctx.globalAlpha = s.fillA * m * SA;
      ctx.fillStyle = rgba(s.fill, 1);
      if (s.glow > 0.5 && s.fillA > 0.3) { ctx.shadowColor = EMBER; ctx.shadowBlur = s.glow; }
      ctx.fill("evenodd");
      ctx.shadowBlur = 0;
    }
    if (s.inkA * m * SA > 0.002 && s.draw > 0.002) {
      ctx.globalAlpha = s.inkA * m * SA;
      ctx.strokeStyle = rgba(s.ink, 1);
      ctx.lineWidth = s.lw;
      if (s.draw < 0.999) { var L = perim(sp); ctx.setLineDash([L * s.draw, L + 10]); }
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }
  function drawCropped(s) {
    var h = s.sq * s.R, x0 = s.cx - h, y0 = s.cy - h;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, 2 * h, 2 * h); ctx.clip();
    ctx.globalAlpha = 0.05 * s.sqA * SA; ctx.fillStyle = "#2b6c9b"; ctx.fillRect(x0, y0, 2 * h, 2 * h);
    drawShape(s, 1);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(-20, -20, AW + 40, AH + 40); ctx.rect(x0, y0, 2 * h, 2 * h); ctx.clip("evenodd");
    ctx.translate(0, s.ghost * s.R * 0.09);
    if (s.ghost < 0.999) drawShape(s, 1 - s.ghost);
    if (s.ghost > 0.001) {
      trace(sp);
      ctx.globalAlpha = s.ghost * 0.5 * s.inkA * SA;
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = rgba(s.ink, 1);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (s.sqA > 0.002) {
      ctx.globalAlpha = s.sqA * SA;
      ctx.strokeStyle = rgba(s.ink, 1);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x0, y0, 2 * h, 2 * h);
    }
    ctx.globalAlpha = 1;
  }
  function drawHug(s) {
    if (s.hugA * SA < 0.002 || s.hugDraw < 0.002) return;
    trace(hug);
    ctx.globalAlpha = s.hugA * SA;
    ctx.strokeStyle = rgba(s.hug, 1);
    ctx.lineWidth = s.lw + 0.3;
    if (s.glow > 0.5) { ctx.shadowColor = EMBER; ctx.shadowBlur = s.glow; }
    if (s.hugDraw < 0.999) { var L = perim(hug); ctx.setLineDash([L * s.hugDraw, L + 10]); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  function drawStar(c, x, y, p, ember, alpha, t, k) {
    var sc = outBack(clamp(p)), tw = 0.8 + 0.2 * Math.sin(t * 2.3 + k * 1.7);
    var r = (ember ? 5.5 : 4) * sc;
    if (r <= 0.05 || alpha <= 0.002) return;
    var col = ember ? "255,122,61" : "226,233,255";
    var g = c.createRadialGradient(x, y, 0, x, y, r * 7);
    g.addColorStop(0, "rgba(" + col + "," + (0.55 * alpha * p) + ")");
    g.addColorStop(1, "rgba(" + col + ",0)");
    c.globalAlpha = 1;
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r * 7, 0, TAU); c.fill();
    c.strokeStyle = "rgba(" + col + "," + (0.75 * alpha * p * tw) + ")";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x - r * 4.2, y); c.lineTo(x + r * 4.2, y);
    c.moveTo(x, y - r * 4.2); c.lineTo(x, y + r * 4.2);
    c.stroke();
    c.fillStyle = "rgba(255,255,255," + (alpha * p) + ")";
    c.beginPath(); c.arc(x, y, r * 0.55, 0, TAU); c.fill();
  }
  function drawConstellation(s, t) {
    var A = s.constA * SA;
    var V = PENT_V.map(function (v) { return [s.cx + v[0] * s.R, s.cy + v[1] * s.R]; });
    var mx = 0, my = 0, k;
    V.forEach(function (v) { mx += v[0] / 5; my += v[1] / 5; });
    ctx.lineWidth = 1.2;
    for (k = 0; k < 5; k++) {
      var e = clamp(s.edges - k);
      if (e <= 0) continue;
      var a = V[k], b = V[(k + 1) % 5], x = a[0] + (b[0] - a[0]) * e, y = a[1] + (b[1] - a[1]) * e;
      ctx.globalAlpha = A;
      ctx.strokeStyle = k >= 3 ? "rgba(255,160,110,0.7)" : "rgba(214,222,255,0.6)";
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(x, y); ctx.stroke();
      if (e < 1) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (k = 0; k < 5; k++) if (s.stars[k] > 0.001) drawStar(ctx, V[k][0], V[k][1], s.stars[k], k === 4, A, t, k);
    for (k = 0; k < 4; k++) {
      var p = s.stars[k];
      if (p < 0.01) continue;
      var dx = V[k][0] - mx, dy = V[k][1] - my, d = Math.hypot(dx, dy) || 1;
      label(ctx, String(k + 1), V[k][0] + dx / d * 24, V[k][1] + dy / d * 24 + 4, 11, 700, "rgba(255,176,122," + (0.9 * p * A) + ")", "center", 0);
    }
  }
  function drawMark(s) {
    var k = s.R / 21;
    ctx.save();
    ctx.translate(s.cx, s.cy);
    ctx.scale(k, k);
    ctx.translate(-28, -32);
    ctx.shadowColor = EMBER;
    ctx.shadowBlur = s.glow;
    ctx.fillStyle = EMBER;
    if (s.mark > 0.002) { ctx.globalAlpha = s.mark * SA; ctx.fill(RING); }
    if (s.spark > 0.002) {
      var e = outBack(s.spark);
      ctx.globalAlpha = clamp(s.spark * 2) * SA;
      ctx.translate(50, 31); ctx.scale(e, e); ctx.translate(-50, -31);
      ctx.fill(SPARK);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---- drawing the coaching and about figures ---------------------------------------
  function label(c, str, x, y, size, weight, color, align, spacing) {
    c.font = weight + " " + size + "px " + FONT;
    c.fillStyle = color;
    c.textAlign = align || "center";
    c.textBaseline = "alphabetic";
    if ("letterSpacing" in c) c.letterSpacing = (spacing || 0) + "px";
    c.fillText(str, x, y);
    if ("letterSpacing" in c) c.letterSpacing = "0px";
  }
  function strokePart(c, pts, f) {
    var n = pts.length / 2, total = 0, i;
    for (i = 1; i < n; i++) total += Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1]);
    var want = total * clamp(f), acc = 0, hx = pts[0], hy = pts[1];
    c.beginPath();
    c.moveTo(hx, hy);
    for (i = 1; i < n; i++) {
      var dx = pts[2 * i] - pts[2 * i - 2], dy = pts[2 * i + 1] - pts[2 * i - 1], d = Math.hypot(dx, dy);
      if (acc + d >= want) { var k = d ? (want - acc) / d : 0; hx = pts[2 * i - 2] + dx * k; hy = pts[2 * i - 1] + dy * k; c.lineTo(hx, hy); break; }
      acc += d; hx = pts[2 * i]; hy = pts[2 * i + 1]; c.lineTo(hx, hy);
    }
    c.stroke();
    return [hx, hy];
  }
  function strokeToX(c, pts, xm) {
    var n = pts.length / 2, hx = pts[0], hy = pts[1];
    c.beginPath();
    c.moveTo(hx, hy);
    for (var i = 1; i < n; i++) {
      var x0 = pts[2 * i - 2], y0 = pts[2 * i - 1], x1 = pts[2 * i], y1 = pts[2 * i + 1];
      if (x1 <= xm) { c.lineTo(x1, y1); hx = x1; hy = y1; continue; }
      if (x0 < xm) { var k = (xm - x0) / (x1 - x0); hx = x0 + (x1 - x0) * k; hy = y0 + (y1 - y0) * k; c.lineTo(hx, hy); }
      break;
    }
    c.stroke();
    return [hx, hy];
  }
  function glowDot(c, x, y, r, col, a) {
    var g = c.createRadialGradient(x, y, 0, x, y, r * 5);
    g.addColorStop(0, rgba(col, 0.6 * a));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r * 5, 0, TAU); c.fill();
    c.fillStyle = rgba([255, 244, 230], a);
    c.beginPath(); c.arc(x, y, r * 0.6, 0, TAU); c.fill();
  }
  function arrow(c, x, y, dx, dy, size) {
    var a = Math.atan2(dy, dx);
    c.beginPath();
    c.moveTo(x - size * Math.cos(a - 0.5), y - size * Math.sin(a - 0.5));
    c.lineTo(x, y);
    c.lineTo(x - size * Math.cos(a + 0.5), y - size * Math.sin(a + 0.5));
    c.stroke();
  }

  // Coaching, the hero: a line loops upward in a widening coil, one loop a
  // session, each wider and higher than the last; the top loop is ember and
  // a faint line leaves it, heading up and out.
  function drawCoil(c, l, t, L, a) {
    var intro = RM ? 1 : sm(0.25, 3.2, t), turns = 5, steps = 320;
    var n = Math.max(2, Math.round(steps * intro));
    var rot = (RM ? 0.7 : t * 0.32) + l * 2.4;
    var r0 = L.R * 0.26, r1 = L.R * 1.0, yb = L.cy + L.R * 0.95, yt = L.cy - L.R * 0.8, tilt = 0.3;
    c.lineCap = "round";
    c.lineJoin = "round";
    var front = null, ember = null, x = 0, y = 0;
    function run() {
      c.globalAlpha = (front ? 1 : 0.26) * a;
      c.strokeStyle = ember ? EMBER : rgba(INK, 1);
      c.lineWidth = ember ? 2.2 : 1.6;
      if (ember && front) { c.shadowColor = EMBER; c.shadowBlur = 10; }
      c.stroke();
      c.shadowBlur = 0;
    }
    for (var k = 0; k <= n; k++) {
      var f = k / steps, th = f * turns * TAU + rot, r = r0 + (r1 - r0) * f;
      x = L.cx + r * Math.cos(th);
      y = yb + (yt - yb) * f + r * Math.sin(th) * tilt;
      var fr = Math.sin(th) > 0, em = f > (turns - 1) / turns;
      if (k === 0) { front = fr; ember = em; c.beginPath(); c.moveTo(x, y); continue; }
      c.lineTo(x, y);
      if (fr !== front || em !== ember) { run(); c.beginPath(); c.moveTo(x, y); front = fr; ember = em; }
    }
    run();
    var out = RM ? 1 : sm(3.1, 4.4, t);
    if (out > 0) {
      c.globalAlpha = 0.55 * a * out;
      c.strokeStyle = EMBER;
      c.lineWidth = 1.4;
      c.setLineDash([3, 6]);
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + L.R * 0.5, y - L.R * 0.15, x + L.R * 0.75 * out, y - L.R * 0.8 * out);
      c.stroke();
      c.setLineDash([]);
    }
    c.globalAlpha = a;
    glowDot(c, x, y, 4, EMB, a * (0.7 + 0.3 * Math.sin(t * 3)));
    c.globalAlpha = 1;
  }

  // Coaching, the learning curve: chasing the tools gives the same short
  // burst with every new capability, then drops back; growing with AI
  // compounds past it and keeps climbing.
  function drawCurve(c, l, t, L, a) {
    var B = L.box, p = sm(0.06, 0.78, l);
    var x0 = B.x + 46, x1 = B.x + B.w - 26, yA = B.y + B.h - 56, yT = B.y + 34;
    c.globalAlpha = 0.62 * a;
    c.fillStyle = "#f8fafc";
    c.beginPath();
    if (c.roundRect) c.roundRect(B.x, B.y, B.w, B.h, 14); else c.rect(B.x, B.y, B.w, B.h);
    c.fill();
    c.globalAlpha = 0.14 * a;
    c.strokeStyle = rgba(COLD, 1);
    c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = a * sm(0, 0.1, l);
    c.strokeStyle = rgba(COLD, 0.55);
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(x0, yT - 8); c.lineTo(x0, yA); c.lineTo(x1 + 8, yA); c.stroke();
    label(c, "WHAT YOU CAN DO", x0 - 6, yT - 16, 10, 700, rgba(COLD, 0.75), "left", 1.3);
    label(c, "TIME", x1 + 8, yA + 18, 10, 700, rgba(COLD, 0.75), "right", 1.3);
    var ticks = [0.12, 0.31, 0.5, 0.69, 0.88].map(function (f) { return x0 + (x1 - x0) * f; });
    var base = yA - (yA - yT) * 0.1, burst = (yA - yT) * 0.3, W = x1 - x0;
    var chase = [], grow = [];
    for (var i = 0; i <= 160; i++) {
      var x = x0 + W * i / 160, b = 0;
      ticks.forEach(function (tx) { if (x >= tx) { var d = (x - tx) / W; b = Math.max(b, (1 - Math.exp(-d * 90)) * Math.exp(-d * 9)); } });
      chase.push(x, base - burst * b);
      var f = (x - x0) / W;
      grow.push(x, base - (yA - yT) * 0.86 * Math.pow(f, 1.75));
    }
    c.globalAlpha = a;
    ticks.forEach(function (tx, k) {
      var on = sm(0, 0.02, p - (tx - x0) / W);
      c.globalAlpha = a * (0.25 + 0.6 * on);
      c.strokeStyle = rgba(COLD, 1);
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(tx, yA); c.lineTo(tx, yA + 6); c.stroke();
    });
    var xm = x0 + W * p;
    c.globalAlpha = a;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = rgba(COLD, 0.8);
    c.lineWidth = 1.8;
    var hc = strokeToX(c, chase, xm);
    c.strokeStyle = EMBER;
    c.lineWidth = 2.6;
    c.shadowColor = EMBER;
    c.shadowBlur = 10;
    var hg = strokeToX(c, grow, xm);
    c.shadowBlur = 0;
    if (p > 0.001 && p < 0.999) { glowDot(c, hg[0], hg[1], 3.5, EMB, a); c.fillStyle = rgba(COLD, a); c.beginPath(); c.arc(hc[0], hc[1], 2.6, 0, TAU); c.fill(); }
    var lab = sm(0.85, 1, p) * a;
    label(c, "CHASING", x1, chase[chase.length - 1] + 22, 11, 700, rgba(COLD, 0.85 * lab), "right", 1.4);
    label(c, "GROWING", x1 - 4, grow[grow.length - 1] - 12, 11, 700, "rgba(244,88,31," + lab + ")", "right", 1.4);
    var cap = sm(0.2, 0.5, p) * a, small = B.w < 440;
    var q = "rgba(63,78,91," + cap + ")";
    if (small) {
      label(c, "each tick: a new capability arrives,", x0, yA + 36, 11, 400, q, "left", 0);
      label(c, "the burst is the same", x0, yA + 50, 11, 400, q, "left", 0);
    } else label(c, "each tick: a new capability arrives, the burst is the same", x0, yA + 38, 12, 400, q, "left", 0);
    c.globalAlpha = 1;
  }

  // Coaching, a session: the line arrives tangled in loops, turns ember
  // and circles the flame once, and leaves straight, with a direction.
  function drawSession(c, l, t, L, a) {
    var B = L.box, p = sm(0.03, 0.9, l);
    var yc = B.y + B.h * 0.52, xs = B.x + B.w * 0.03, xe = B.x + B.w * 0.97, xc = B.x + B.w * 0.56;
    var rho = Math.min(B.h * 0.2, B.w * 0.11);
    var tangle = [], i;
    for (i = 0; i <= 260; i++) {
      var u = i / 260, th = u * TAU * 4.5 + Math.PI, fade = 1 - u;
      var lr = B.h * 0.13 * Math.pow(fade, 0.55) * (0.75 + 0.25 * Math.sin(u * 13));
      tangle.push(xs + (xc - rho - xs) * u + lr * Math.cos(th) - lr * Math.cos(Math.PI) * fade, yc + lr * Math.sin(th) * 1.15 + B.h * 0.07 * Math.sin(u * 7) * fade);
    }
    var circle = [];
    for (i = 0; i <= 120; i++) { var an = Math.PI + (2.5 * Math.PI) * i / 120; circle.push(xc + rho * Math.cos(an), yc + rho * Math.sin(an)); }
    var straight = [xc, yc - rho, xe, yc - rho];
    var night = rgba(STAR, 0.78), pt = sm(0, 0.5, p), pc = sm(0.5, 0.74, p), ps = sm(0.74, 1, p);
    c.globalAlpha = a;
    c.lineCap = "round";
    c.lineJoin = "round";
    // the flame it circles
    var k = rho * 0.95 / 14, fl = 1 + (RM ? 0 : 0.05 * Math.sin(t * 7));
    c.save();
    c.translate(xc, yc);
    c.scale(k * fl, k * fl);
    c.translate(-49.6, -31.6);
    c.shadowColor = EMBER;
    c.shadowBlur = 18;
    c.fillStyle = EMBER;
    c.globalAlpha = a * (0.5 + 0.5 * sm(0, 0.15, l));
    c.fill(SPARK);
    c.restore();
    c.globalAlpha = a;
    c.strokeStyle = night;
    c.lineWidth = 1.5;
    var h = strokePart(c, tangle, pt);
    if (pc > 0) {
      c.strokeStyle = EMBER;
      c.lineWidth = 2.2;
      c.shadowColor = EMBER;
      c.shadowBlur = 12;
      h = strokePart(c, circle, pc);
      if (ps > 0) { h = strokePart(c, straight, ps); if (ps > 0.98) arrow(c, xe, yc - rho, 1, 0, 11); }
      c.shadowBlur = 0;
    }
    if (p > 0.001 && p < 0.999) glowDot(c, h[0], h[1], 3.4, pc > 0 ? EMB : STAR, a);
    var la = sm(0.02, 0.12, p) * a, lb = sm(0.55, 0.7, p) * a, lc = sm(0.9, 1, p) * a;
    var small = B.w < 440, fs = small ? 10 : 11;
    label(c, "YOU ARRIVE", xs + (small ? 0 : 10), yc + B.h * 0.36, fs, 700, rgba([238, 240, 255], la), "left", 1.4);
    label(c, "unsure what is possible", xs + (small ? 0 : 10), yc + B.h * 0.36 + 16, fs + 1, 400, rgba([170, 176, 214], la), "left", 0);
    label(c, "A SESSION", xc, yc - rho - 18, fs, 700, "rgba(255,176,122," + lb + ")", "center", 1.4);
    label(c, "YOU LEAVE", xe, yc - rho + 26, fs, 700, rgba([238, 240, 255], lc), "right", 1.4);
    label(c, "with a direction", xe, yc - rho + 42, fs + 1, 400, rgba([170, 176, 214], lc), "right", 0);
    c.globalAlpha = 1;
  }

  // Coaching, the model releases: after each new model a trained team
  // climbs a step; a team with the same habits falls into a pit at each
  // one and climbs out a little lower. The gap grows with every model.
  function drawReleases(c, l, t, L, a) {
    var B = L.box, p = sm(0.04, 0.88, l);
    var small = B.w < 520, x0 = B.x + B.w * 0.02, x1 = B.x + B.w * (small ? 0.8 : 0.88), yb = B.y + B.h * 0.6, step = B.h * 0.1, pit = B.h * 0.2, drop = B.h * 0.035;
    var W = x1 - x0, models = [0.14, 0.36, 0.58, 0.8].map(function (f) { return x0 + W * f; });
    var team = [x0, yb], same = [x0, yb], lt = yb, ls = yb;
    models.forEach(function (mx) {
      team.push(mx, lt); lt -= step; team.push(mx + W * 0.045, lt);
      same.push(mx, ls, mx + W * 0.035, ls + pit); ls += drop; same.push(mx + W * 0.085, ls);
    });
    team.push(x1, lt);
    same.push(x1, ls);
    var xm = x0 + W * p, foam = [226, 245, 240];
    c.lineCap = "round";
    c.lineJoin = "round";
    // time, and a mark for each new model
    c.globalAlpha = a * sm(0, 0.1, l);
    c.strokeStyle = rgba(foam, 0.4);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0, B.y + B.h * 0.95); c.lineTo(B.x + B.w, B.y + B.h * 0.95); c.stroke();
    label(c, "TIME", B.x + B.w, B.y + B.h * 0.95 + 16, 10, 700, rgba(foam, 0.7), "right", 1.3);
    models.forEach(function (mx, k) {
      var on = sm(mx - 2, mx + 2, xm);
      c.globalAlpha = a * (0.18 + 0.5 * on);
      c.setLineDash([2, 5]);
      c.strokeStyle = rgba(foam, 1);
      c.beginPath(); c.moveTo(mx, B.y + B.h * 0.08); c.lineTo(mx, B.y + B.h * 0.95); c.stroke();
      c.setLineDash([]);
      if (on > 0) {
        var age = clamp((xm - mx) / (W * 0.12));
        c.globalAlpha = a * (1 - age) * 0.8;
        c.beginPath(); c.arc(mx, B.y + B.h * 0.08, 4 + age * 26, 0, TAU); c.stroke();
        c.globalAlpha = a;
        c.fillStyle = rgba(foam, 0.9);
        c.beginPath(); c.arc(mx, B.y + B.h * 0.08, 3, 0, TAU); c.fill();
      }
      if (k === 0) label(c, "a new model arrives", mx - 4, B.y + B.h * 0.08 - 12, 11, 400, rgba(foam, 0.75 * a * on), "left", 0);
    });
    c.globalAlpha = a;
    c.strokeStyle = rgba(foam, 0.75);
    c.lineWidth = 1.8;
    var hs = strokeToX(c, same, xm);
    // a cross at the bottom of every pit it has reached
    models.forEach(function (mx, k) {
      var px = mx + W * 0.035, py = same[5 + k * 6];
      if (xm < px) return;
      c.strokeStyle = rgba(foam, 0.85);
      c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(px - 4, py + 4); c.lineTo(px + 4, py + 12); c.moveTo(px + 4, py + 4); c.lineTo(px - 4, py + 12); c.stroke();
    });
    c.strokeStyle = EMBER;
    c.lineWidth = 2.6;
    c.shadowColor = EMBER;
    c.shadowBlur = 10;
    var ht = strokeToX(c, team, xm);
    c.shadowBlur = 0;
    if (p > 0.001 && p < 0.999) { glowDot(c, ht[0], ht[1], 3.4, EMB, a); c.fillStyle = rgba(foam, a); c.beginPath(); c.arc(hs[0], hs[1], 2.6, 0, TAU); c.fill(); }
    var end = sm(0.9, 1, p) * a, gx = x1 + Math.min(18, B.w * 0.04);
    label(c, "A TRAINED TEAM", x1, lt - 12, 11, 700, "rgba(255,148,102," + end + ")", "right", 1.4);
    label(c, "SAME HABITS", x1, ls + 22, 11, 700, rgba(foam, 0.85 * end), "right", 1.4);
    if (end > 0) {
      c.globalAlpha = end;
      c.strokeStyle = "rgba(255,148,102,0.9)";
      c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(gx - 4, lt + 3); c.lineTo(gx, lt + 3); c.lineTo(gx, ls - 3); c.lineTo(gx - 4, ls - 3); c.stroke();
      label(c, "THE GAP", gx + 6, (lt + ls) / 2 + 4, 10, 700, "rgba(255,148,102," + end + ")", "left", 1.2);
    }
    c.globalAlpha = 1;
  }

  // About, the hero: the mark draws itself in ink, the spark is lit, and
  // two lights circle it, the two of us who keep it lit.
  function orbitLights(c, cx, cy, rx, ry, tilt, t, a, count, sizes) {
    for (var i = 0; i < count; i++) {
      var ph = t * 0.55 + (i === 2 ? Math.PI * 0.5 : i * Math.PI);
      for (var j = 16; j >= 0; j--) {
        var f = ph - j * 0.045, ex = rx * Math.cos(f), ey = ry * Math.sin(f);
        var x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        if (j === 0) glowDot(c, x, y, sizes[i], EMB, a);
        else { c.globalAlpha = a * (1 - j / 17) * 0.35; c.fillStyle = EMBER; c.beginPath(); c.arc(x, y, sizes[i] * 0.35, 0, TAU); c.fill(); }
      }
    }
    c.globalAlpha = 1;
  }
  function drawKeepers(c, l, t, L, a) {
    var k = L.R / 21, intro = RM ? 1 : sm(0.2, 2.2, t), lit = RM ? 1 : sm(2.0, 2.8, t);
    c.save();
    c.translate(L.cx - 1.94 * k, L.cy);
    c.scale(k, k);
    c.translate(-28, -32);
    c.globalAlpha = a;
    c.lineJoin = "round";
    c.strokeStyle = rgba(INK, 1);
    c.lineWidth = 1.6 / k;
    c.setLineDash([intro * 200, 400]);
    c.stroke(RING);
    c.setLineDash([sm(0.7, 1, intro) * 60, 120]);
    c.stroke(SPARK);
    c.setLineDash([]);
    if (lit > 0) { c.globalAlpha = a * lit; c.fillStyle = EMBER; c.shadowColor = EMBER; c.shadowBlur = 14; c.fill(SPARK); }
    c.restore();
    var la = a * (RM ? 1 : sm(1.4, 2.6, t));
    if (la > 0.01) orbitLights(c, L.cx, L.cy, L.R * 1.65, L.R * 0.55, -0.28, RM ? 1 : t, la, 2, [4.2, 4.2]);
  }

  // About us: the two lights circle the family's photograph, and a third,
  // smaller one joins them.
  function drawFamily(c, l, t, L, a) {
    var card = L.sec.querySelector(".card");
    if (!card) return;
    var r = card.getBoundingClientRect();
    if (r.width < 2) return;
    var third = sm(0.12, 0.3, l), n = third > 0.01 ? 3 : 2;
    var la = a * sm(-0.2, 0.1, l + (RM ? 1 : 0));
    orbitLights(c, r.left + r.width / 2, r.top + r.height / 2, r.width * 0.78, r.height * 0.64, -0.12, RM ? 1 : t * 0.9, la, n, [4.2, 4.2, 2.8 * third]);
  }

  // About, the founder: a timeline from 2016 to now. Software engineer
  // until 2023; from 2023 the line turns ember and glows, nearly all of
  // his work; past now, a dashed ember line keeps going.
  function drawTimeline(c, l, t, L, a) {
    var P = L.portrait, p = P ? sm(0.42, 0.92, l) : sm(0.1, 0.72, l);
    var x0, x1, y;
    if (P) { x0 = 34; x1 = AW - 30; y = L.top + Math.max(L.h * 0.6, 84); }
    else { x0 = AW * 0.5; x1 = AW * 0.9; y = AH * 0.8; }
    var xNow = x0 + (x1 - x0) * 0.86, step = (xNow - x0) / 10, x23 = x0 + step * 7;
    var silver = [214, 222, 255], show = a * (P ? sm(0.36, 0.44, l) : 1);
    if (show < 0.01) return;
    c.lineCap = "round";
    c.globalAlpha = show * 0.3;
    c.strokeStyle = rgba(silver, 1);
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x0 - 10, y); c.lineTo(x1, y); c.stroke();
    for (var yr = 0; yr <= 10; yr++) { c.beginPath(); c.moveTo(x0 + step * yr, y); c.lineTo(x0 + step * yr, y + 5); c.stroke(); }
    var ps = sm(0, 0.55, p), pe = sm(0.55, 0.9, p), pd = sm(0.9, 1, p);
    c.globalAlpha = show;
    c.strokeStyle = rgba(silver, 0.95);
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + (x23 - x0) * ps, y); c.stroke();
    if (pe > 0) {
      c.strokeStyle = EMBER;
      c.lineWidth = 3;
      c.shadowColor = EMBER;
      c.shadowBlur = 14;
      c.beginPath(); c.moveTo(x23, y); c.lineTo(x23 + (xNow - x23) * pe, y); c.stroke();
      c.shadowBlur = 0;
    }
    if (pd > 0) {
      c.globalAlpha = show * 0.55 * pd;
      c.strokeStyle = EMBER;
      c.lineWidth = 1.4;
      c.setLineDash([2, 4]);
      c.beginPath(); c.moveTo(xNow, y); c.lineTo(xNow + (x1 - xNow) * pd, y); c.stroke();
      c.setLineDash([]);
      if (pd > 0.98) arrow(c, x1, y, 1, 0, 6);
    }
    c.globalAlpha = show;
    c.fillStyle = rgba(silver, 1);
    c.beginPath(); c.arc(x0, y, 3.5 * sm(0, 0.05, p), 0, TAU); c.fill();
    if (pe > 0) glowDot(c, x23 + (xNow - x23) * pe, y, pe < 1 ? 4.5 : 5.5, EMB, show);
    var fs = P ? 10 : 11;
    label(c, "SOFTWARE ENGINEER", P ? x0 : (x0 + x23) / 2, y - 16, fs, 700, rgba(silver, 0.9 * show * sm(0.3, 0.55, p)), P ? "left" : "center", 1.4);
    var la = show * sm(0.75, 0.95, p), right = Math.min((x23 + xNow) / 2 + 120, x1 + 20), cx = P ? x1 : right - 120, al = P ? "right" : "center", up = P ? 18 : 0;
    label(c, "NEARLY ALL OF HIS WORK", cx, y - 54 - up, fs, 700, "rgba(255,148,102," + la + ")", al, 1.4);
    label(c, "learning what the most capable AI can do,", cx, y - 38 - up, fs, 400, rgba([170, 176, 214], la), al, 0);
    label(c, "applying it, teaching it, keeping pace", cx, y - 24 - up, fs, 400, rgba([170, 176, 214], la), al, 0);
    label(c, "2016", x0, y + 22, 11, 400, rgba(silver, 0.6 * show), "center", 0);
    label(c, "2023", x23, y + 22, 11, 400, "rgba(255,148,102," + show * sm(0.5, 0.6, p) + ")", "center", 0);
    label(c, "NOW", xNow, y + 22, 11, 700, "rgba(255,148,102," + show * sm(0.88, 0.95, p) + ")", "center", 1.2);
    c.globalAlpha = 1;
  }

  // ---- particles: one population, six temperaments ---------------------------------
  var parts = [], DV = [0, 0];
  var PAL = [
    { op: "source-over", c: ["rgb(20,20,18)"] },
    { op: "source-over", c: ["rgb(18,32,46)", "rgb(43,108,155)"] },
    { op: "lighter", c: ["rgb(244,88,31)", "rgb(255,138,61)", "rgb(255,190,110)", "rgb(255,226,172)"] },
    { op: "lighter", c: ["rgb(190,205,255)", "rgb(236,240,255)", "rgb(255,214,180)"] },
    { op: "source-over", c: ["rgb(214,246,238)", "rgb(160,226,214)"] },
    { op: "lighter", c: ["rgb(244,88,31)", "rgb(255,138,61)", "rgb(255,190,110)", "rgb(255,226,172)"] }
  ];
  function seedParticles() {
    var n = RM ? 0 : (AW < 760 ? 80 : 170);
    parts = [];
    for (var i = 0; i < n; i++) parts.push({ x: Math.random() * AW, y: Math.random() * AH, vx: 0, vy: 0, s: Math.random(), s2: Math.random(), idx: (Math.random() * NP) | 0 });
  }
  function desired(w, p, t) {
    if (w === 0) { DV[0] = Math.sin(p.y * 0.006 + t * 0.25 + p.s * 6) * 9; DV[1] = -5 + Math.cos(p.x * 0.005 + t * 0.2 + p.s * 5) * 7; }
    else if (w === 1) {
      var v = 26 + p.s * 44, dir = p.s < 0.5 ? -1 : 1;
      if (p.s2 < 0.5) { DV[0] = dir * v; DV[1] = (Math.round(p.y / 48) * 48 - p.y) * 4; }
      else { DV[0] = (Math.round(p.x / 48) * 48 - p.x) * 4; DV[1] = dir * v * 0.6; }
    }
    else if (w === 2) { DV[0] = Math.sin(t * 1.3 + p.s * 20) * 14; DV[1] = -(30 + p.s * 70); }
    else if (w === 3) { DV[0] = 5 + p.s * 5; DV[1] = -1.5 - p.s2; }
    else if (w === 4) { DV[0] = 16 + Math.sin(p.y * 0.008 + t * 0.35 + p.s * 3) * 24; DV[1] = Math.cos(p.x * 0.006 - t * 0.3 + p.s2 * 3) * 16; }
    else { DV[0] = Math.sin(t * 2 + p.s * 30) * 16; DV[1] = -(70 + p.s * 120); }
  }
  var ptr = { x: -9999, y: -9999, on: false, sx: 0, sy: 0 };
  function updateParticles(dt, t, wA, wB, b, attract, focus) {
    var wd = b < 0.5 ? wA : wB, kv = 1 - Math.exp(-dt * 2.5), M = 16;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      desired(wA, p, t);
      var dx = DV[0], dy = DV[1];
      if (b > 0) { desired(wB, p, t); dx += (DV[0] - dx) * b; dy += (DV[1] - dy) * b; }
      if (attract > 0.001) {
        var tx = sp[2 * p.idx] + Math.sin(t * 3 + p.s * 40) * 3, ty = sp[2 * p.idx + 1] + Math.cos(t * 2.6 + p.s2 * 40) * 3;
        dx += ((tx - p.x) * 3.2 - dx) * attract;
        dy += ((ty - p.y) * 3.2 - dy) * attract;
      }
      if (ptr.on) {
        var mx = p.x - ptr.x, my = p.y - ptr.y, d2 = mx * mx + my * my;
        if (d2 < 14400) { var d = Math.sqrt(d2) + 1, f = (120 - d) / 120 * 170; dx += mx / d * f; dy += my / d * f; }
      }
      p.vx += (dx - p.vx) * kv;
      p.vy += (dy - p.vy) * kv;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (wd === 2) {
        if (p.y < -M) { p.y = AH + M; p.x = Math.random() * AW; p.vy = -40; }
        if (p.x < -M) p.x = AW + M; else if (p.x > AW + M) p.x = -M;
      } else if (wd === 5) {
        if (p.y < -M || p.x < -M || p.x > AW + M || p.y > AH + M) {
          if (p.s2 < 0.45) {
            p.x = focus.cx + (Math.random() - 0.35) * focus.R * 1.7;
            p.y = focus.cy - focus.R * 0.2 + (Math.random() - 0.5) * focus.R * 0.8;
            p.vx = (Math.random() - 0.5) * 40; p.vy = -60 - Math.random() * 80;
          } else { p.x = Math.random() * AW; p.y = AH + 12; p.vy = -60; }
        }
      } else {
        if (p.x < -M) p.x += AW + 2 * M; else if (p.x > AW + M) p.x -= AW + 2 * M;
        if (p.y < -M) p.y += AH + 2 * M; else if (p.y > AH + M) p.y -= AH + 2 * M;
      }
    }
  }
  function drawParticles(w, alpha, t) {
    if (alpha < 0.01 || !parts.length) return;
    var pal = PAL[w];
    ctx.globalCompositeOperation = pal.op;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], a, r;
      if (w === 0) {
        ctx.globalAlpha = (0.1 + p.s2 * 0.16) * alpha;
        ctx.fillStyle = pal.c[0];
        ctx.beginPath(); ctx.arc(p.x, p.y, 0.6 + p.s * 1.3, 0, TAU); ctx.fill();
      } else if (w === 1) {
        var hi = p.s2 > 0.86, z = 2 + p.s * 2.4;
        ctx.globalAlpha = (hi ? 0.75 : 0.3) * alpha;
        ctx.fillStyle = pal.c[hi ? 1 : 0];
        ctx.fillRect(p.x - z / 2, p.y - z / 2, z, z);
      } else if (w === 2 || w === 5) {
        a = alpha * (0.55 + 0.45 * Math.sin(t * 9 + p.s * 60)) * (0.45 + 0.55 * p.s2) * clamp((p.y + 40) / (AH * 0.85));
        r = 0.7 + p.s * 1.9;
        ctx.fillStyle = pal.c[(p.s2 * 4) | 0];
        ctx.globalAlpha = a * 0.16;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.4, 0, TAU); ctx.fill();
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      } else if (w === 3) {
        ctx.globalAlpha = alpha * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * (1.5 + p.s * 3) + p.s2 * 40)));
        ctx.fillStyle = pal.c[(p.s2 * 3) | 0];
        ctx.beginPath(); ctx.arc(p.x, p.y, 0.5 + p.s * 0.9, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = alpha * 0.35;
        ctx.strokeStyle = pal.c[p.s2 < 0.5 ? 0 : 1];
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1 + p.s * 2.6, 0, TAU); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
  function burst(s) {
    var k = s.R / 21, x = s.cx + 22 * k, y = s.cy - k;
    for (var i = 0; i < Math.min(46, parts.length); i++) {
      var p = parts[(Math.random() * parts.length) | 0], an = Math.random() * TAU, v = 60 + Math.random() * 220;
      p.x = x; p.y = y; p.vx = Math.cos(an) * v; p.vy = Math.sin(an) * v - 60;
    }
  }

  // ---- scroll ------------------------------------------------------------------------
  var tops = [], hs = [], pins = [];
  function measure() {
    var y = window.scrollY;
    tops = sections.map(function (s) { return s.getBoundingClientRect().top + y; });
    hs = sections.map(function (s) { return s.offsetHeight; });
    pins = sections.map(function (s) { return s.firstElementChild.offsetHeight; });
    stacks = sections.map(function (s, k) { return stacked(k) ? stackOf(k) : null; });
    sections.forEach(function (s, k) {
      var S = stacks[k];
      s.style.setProperty("--copy-b", S ? Math.round(S.copyB) + "px" : "");
      s.style.setProperty("--copy-t", S ? Math.round(S.copyT) + "px" : "");
      s.style.setProperty("--fig-top", S ? Math.round(S.top) + "px" : "");
    });
    if (footer) root.style.setProperty("--foot", footer.offsetHeight + "px");
    root.classList.toggle("foot-over", !room && !!footer);
  }
  function scrollState() {
    var y = window.scrollY, i = 0;
    for (var k = 0; k < NW; k++) if (y >= tops[k] - 1) i = k;
    var range = Math.max(1, hs[i] - pins[i]);
    var l = clamp((y - tops[i]) / range), b = 0, tail = 0;
    if (i < NW - 1) b = clamp((y - (tops[i] + range)) / Math.max(1, pins[i]));
    // past the last world the page scrolls on, and the figure rises with the words
    else tail = Math.max(0, y - (tops[i] + range));
    return [i, l, b, tail];
  }
  var lastU = [];
  function setU(i, l, b) {
    for (var k = 0; k < NW; k++) {
      var u = k < i ? 2 : k > i + 1 ? -1 : k === i ? l + b : -1 + b;
      u = Math.round(u * 1000) / 1000;
      if (u !== lastU[k]) { sections[k].style.setProperty("--u", u); lastU[k] = u; }
    }
  }
  function placeCaps() {
    sections.forEach(function (sec, k) {
      var cap = sec.querySelector(".cap");
      if (!cap) return;
      var L = layoutOf(scenes[k], k);
      cap.style.left = L.cx + "px";
      cap.style.top = (L.cy + L.R * (scenes[k].cap || 1.45)) + "px";
    });
  }

  // ---- the index of worlds -------------------------------------------------------------
  var nav = document.createElement("ol");
  nav.className = "worlds";
  nav.setAttribute("aria-label", "Sections");
  var dots = sections.map(function (sec, k) {
    var li = document.createElement("li"), btn = document.createElement("button"), span = document.createElement("span"), dot = document.createElement("i");
    btn.type = "button";
    span.textContent = sec.getAttribute("data-label") || "";
    btn.appendChild(span);
    btn.appendChild(dot);
    btn.addEventListener("click", function () {
      var target = sec.getAttribute("data-go") ? document.querySelector(sec.getAttribute("data-go")) : null;
      var y = target ? target.getBoundingClientRect().top + window.scrollY : tops[k] + (k ? 2 : 0);
      window.scrollTo({ top: y, behavior: RM ? "auto" : "smooth" });
    });
    li.appendChild(btn);
    nav.appendChild(li);
    return btn;
  });
  document.body.appendChild(nav);
  var top = document.querySelector(".top");
  var themeMeta = document.querySelector('meta[name="theme-color"]');

  // ---- the loop --------------------------------------------------------------------------
  var t0 = performance.now(), last = t0, ema = 16, frames = 0, lastSpark = 0, lastTheme = -1, lastDot = -1, lastRoom = false;

  function focusOf(scene, s, L) {
    if (s) return { cx: s.cx, cy: s.cy, R: s.R, heat: s.heat, flame: s.flame };
    return { cx: L.cx, cy: L.cy, R: L.R, heat: 0, flame: 0 };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var t = RM ? 24 : (now - t0) / 1000;
    var st = scrollState(), i = st[0], l = st[1], b = st[2];
    setU(i, l, b);

    var inRoom = false, hidden = false;
    if (room) {
      var rr = room.getBoundingClientRect();
      inRoom = rr.top < 80 && rr.bottom > 80;
      hidden = rr.top <= 0;
      if (inRoom !== lastRoom) { root.classList.toggle("in-room", inRoom); lastRoom = inRoom; }
    }

    var wt = b < 0.8 ? i : i + 1, wd = inRoom ? NW - 1 : b < 0.5 ? i : i + 1;
    if (wt !== lastTheme) {
      var th = THEME[worldOf[wt]];
      if (top) top.setAttribute("data-theme", th);
      if (themeMeta) themeMeta.setAttribute("content", BG[worldOf[wt]]);
      if (!GL) document.body.style.background = BG[worldOf[wt]];
      lastTheme = wt;
    }
    if (wd !== lastDot) {
      nav.setAttribute("data-theme", THEME[worldOf[wd]]);
      dots.forEach(function (d, k) { d.setAttribute("aria-current", k === wd ? "true" : "false"); });
      lastDot = wd;
    }
    if (hidden) return;

    var eb = b * b * (3 - 2 * b);
    var A = scenes[i], B = b > 0 ? scenes[i + 1] : null;
    var LA = layoutOf(A, i), LB = B ? layoutOf(B, i + 1) : null;
    ptr.sx += ((ptr.on ? ptr.x : AW / 2) - ptr.sx) * (1 - Math.exp(-dt * 4));
    ptr.sy += ((ptr.on ? ptr.y : AH / 2) - ptr.sy) * (1 - Math.exp(-dt * 4));
    var px = (ptr.sx - AW / 2) * 0.012, py = (ptr.sy - AH / 2) * 0.012 - st[3];
    [[A, LA], [B, LB]].forEach(function (pair) {
      if (pair[0] && (pair[0].kind === "shape" || pair[0].parallax)) { pair[1].cx += px; pair[1].cy += py; }
    });

    var sA = A.kind === "shape" ? shapeState(A, i, l, t) : null;
    var sB = B && B.kind === "shape" ? shapeState(B, i + 1, 0, t) : null;
    if (sA) { sA.cx += px; sA.cy += py; }
    if (sB) { sB.cx += px; sB.cy += py; }
    var shape = null;
    SA = 1;
    if (sA && sB) shape = blend(sA, sB, eb);
    else if (sA) { shape = sA; SA = B ? 1 - eb : 1; }
    else if (sB) { shape = sB; SA = eb; }

    var fA = focusOf(A, sA, LA), fB = B ? focusOf(B, sB, LB) : fA;
    if (sA && sB) fA = fB = focusOf(A, shape, LA);
    var focus = { cx: lerp(fA.cx, fB.cx, eb), cy: lerp(fA.cy, fB.cy, eb), R: lerp(fA.R, fB.R, eb), heat: lerp(fA.heat, fB.heat, eb), flame: lerp(fA.flame, fB.flame, eb) };

    if (GL) {
      var gl = GL.gl, U = GL.U;
      gl.uniform2f(U.uRes, sky.width, sky.height);
      gl.uniform1f(U.uTime, t);
      gl.uniform1f(U.uWorldA, worldOf[i]);
      gl.uniform1f(U.uWorldB, worldOf[Math.min(i + 1, NW - 1)]);
      gl.uniform1f(U.uMix, b);
      gl.uniform1f(U.uLocal, l);
      gl.uniform2f(U.uMouse, (ptr.sx - AW / 2) / AH, (AH / 2 - ptr.sy) / AH);
      gl.uniform2f(U.uFocus, (focus.cx - AW / 2) / AH, (AH / 2 - focus.cy) / AH);
      gl.uniform1f(U.uFocusR, focus.R / AH);
      gl.uniform1f(U.uFlame, focus.flame);
      gl.uniform1f(U.uHeat, focus.heat);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    ctx.setTransform(ADPR, 0, 0, ADPR, 0, 0);
    ctx.clearRect(0, 0, AW, AH);
    if (shape) points(shape, t, dt);
    if (shape && shape.spark > 0.12 && lastSpark <= 0.12) burst(shape);
    lastSpark = shape ? shape.spark : 0;
    updateParticles(dt, t, worldOf[i], worldOf[Math.min(i + 1, NW - 1)], b, shape ? shape.attract * SA : 0, focus);
    drawParticles(worldOf[i], 1 - b, t);
    if (b > 0) drawParticles(worldOf[i + 1], b, t);

    if (A.kind === "draw") A.draw(ctx, l, t, LA, B ? 1 - eb : 1);
    if (B && B.kind === "draw") B.draw(ctx, 0, t, LB, eb);
    if (shape) {
      if (shape.sqA > 0.002 || shape.ghost > 0.002) drawCropped(shape); else drawShape(shape, 1);
      drawHug(shape);
      if (shape.constA > 0.002) drawConstellation(shape, t);
      if (shape.mark > 0.002 || shape.spark > 0.002) drawMark(shape);
    }
    ctx.globalAlpha = 1;

    // a slow machine gets a softer sky rather than a stuttering one
    ema = ema * 0.95 + dt * 1000 * 0.05;
    if (++frames % 90 === 0 && ema > 24 && quality > 0.5) { quality *= 0.8; sizeSky(); }
  }

  function resize() {
    sizeActors();
    sizeSky();
    measure();
    placeCaps();
  }
  var queued = false;
  window.addEventListener("resize", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; resize(); });
  });
  window.addEventListener("load", function () { measure(); placeCaps(); });
  window.addEventListener("pointermove", function (e) { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = e.pointerType === "mouse"; }, { passive: true });
  document.addEventListener("pointerleave", function () { ptr.on = false; });
  window.addEventListener("blur", function () { ptr.on = false; });

  resize();
  seedParticles();
  ptr.sx = AW / 2;
  ptr.sy = AH / 2;
  requestAnimationFrame(frame);
})();
