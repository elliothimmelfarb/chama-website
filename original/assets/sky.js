/* ==========================================================================
   The sky: one WebGL fragment shader that paints the six worlds (paper, the
   grid, the forge, the night, the tides, the flame) and the fire that burns
   one into the next. Shared by worlds.js (/, /coaching, /about) and
   sparks.js (the 404 page's game). It paints nothing from the network.

   ChamaSky.init(canvas) returns { gl, U } with the program bound and the
   uniforms located, or null when WebGL or the shader is unavailable.
   Uniforms: uRes, uTime, uWorldA, uWorldB, uMix (0..1, B burning up through
   A), uLocal, uMouse, uFocus, uFocusR, uFlame, uHeat. Positions are in
   units of the canvas height with the origin at its centre, y up.
   ========================================================================== */
(function () {
  "use strict";

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

  function init(sky) {
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
  window.ChamaSky = { FRAG: FRAG, init: init };
})();
