// The picture a record can carry: an SVG Elliot draws for one session, a
// map of what was talked about, shown above the summary.
//
// The room never parses it. The page shows it with <img>, where an SVG
// cannot run script or fetch anything, and the route serves it with a
// sandboxing CSP for anyone who opens the URL directly. This check is the
// third wall: anything that could run, or reach past the file itself, is
// refused before it is stored.

export const MAX_VISUAL_CHARS = 512 * 1024;

const FORBIDDEN = [
  /<script/i,
  /<foreignobject/i,
  /<(iframe|embed|object|audio|video|canvas)\b/i,
  /<!(entity|doctype)/i,
  /\bon[a-z]+\s*=/i,
  /javascript:/i,
  /@import/i,
  /url\(\s*['"]?(?!#)/i,
  /attributename\s*=\s*['"]?(xlink:)?href/i
];

// Every href must point inside the file (#id); nothing may be fetched.
const HREF = /(?:xlink:)?href\s*=\s*(['"])(.*?)\1/gi;

export function checkVisual(value) {
  if (typeof value !== "string") return { ok: false, reason: "The picture must be SVG text." };
  const svg = value.trim();
  if (svg.length > MAX_VISUAL_CHARS) return { ok: false, reason: "That picture is too large." };
  if (!/^(<\?xml[^>]*\?>\s*)?<svg[\s>]/i.test(svg) || !/<\/svg>$/i.test(svg)) return { ok: false, reason: "The picture must be a single SVG." };
  if (FORBIDDEN.some((pattern) => pattern.test(svg))) return { ok: false, reason: "The picture may not run code or load anything." };
  for (const match of svg.matchAll(HREF)) {
    if (!match[2].startsWith("#")) return { ok: false, reason: "The picture may not load anything." };
  }
  if (/(?:xlink:)?href\s*=\s*[^'"\s>]/i.test(svg)) return { ok: false, reason: "The picture may not load anything." };
  return { ok: true, svg };
}
