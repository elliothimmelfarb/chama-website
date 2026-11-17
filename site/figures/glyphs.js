// The three door glyphs, drawn as technical drawings (docs/DESIGN.md, "The
// doors"): one 1.5px ink stroke, hairline construction lines (.h), and one
// ember part each (.e, .dot). base.css's ".g *" clears every fill, so the
// hatch is drawn as strokes and nothing hides what is behind it.
import { raw } from "../html.js";

// The lens two circles share, hatched at 45 degrees: each hatch line is
// cut to the part of it inside both circles.
const A = [12.5, 18], B = [23.5, 18], RAD = 10;
const inside = (x, y) => Math.hypot(x - A[0], y - A[1]) <= RAD && Math.hypot(x - B[0], y - B[1]) <= RAD;
const hatch = [];
for (let k = -12; k <= 12; k += 2.6) {
  // the line y - 18 = (x - 18) + k, walked in small steps
  let from = null, to = null;
  for (let x = 6; x <= 30; x += 0.05) {
    const y = 18 + (x - 18) + k;
    if (inside(x, y)) { if (!from) from = [x, y]; to = [x, y]; }
  }
  if (from && Math.hypot(to[0] - from[0], to[1] - from[1]) > 1.2) hatch.push(`M${from[0].toFixed(2)} ${from[1].toFixed(2)}L${to[0].toFixed(2)} ${to[1].toFixed(2)}`);
}
const top = 18 - Math.sqrt(RAD * RAD - 5.5 * 5.5), bot = 36 - top;

export const GLYPHS = {
  // a compass drawing an arc: engineering, made to measure
  "engineering-department": raw(
    `<svg class="g" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path class="h" d="M2 30.5h32"/><path class="e" d="M5 28.5a14.5 14.5 0 0 1 26 0"/><path d="M18 7.6 9.4 28.5M18 7.6l8.6 20.9M12.6 20.6h10.8"/><circle cx="18" cy="5.6" r="2"/><circle class="dot" cx="26.6" cy="28.5" r="1.6"/></svg>`,
  ),
  // two circles that share what they know: taught
  coaching: raw(
    `<svg class="g" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path class="h" d="M1 18h34"/><path class="h" d="${hatch.join("")}"/><circle cx="${A[0]}" cy="18" r="${RAD}"/><circle cx="${B[0]}" cy="18" r="${RAD}"/><path class="e" d="M18 ${top.toFixed(2)}A${RAD} ${RAD} 0 0 1 18 ${bot.toFixed(2)}"/></svg>`,
  ),
  // a screen and a phone in elevation, with a dimension line over them
  build: raw(
    `<svg class="g" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path class="h" d="M2 3.5h32M2 1.8v3.4M34 1.8v3.4"/><path d="M23 24.5H3.6A1.6 1.6 0 0 1 2 22.9V9.6A1.6 1.6 0 0 1 3.6 8h19.8a1.6 1.6 0 0 1 1.6 1.6v3.9"/><path d="M10 30h8M14 24.5V30"/><rect x="23" y="13.5" width="11" height="19" rx="2.2"/><path class="e" d="M26.4 28.5h4.2"/></svg>`,
  ),
};
