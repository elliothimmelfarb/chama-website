// The mark drawing itself, for the name section on /about (docs/DESIGN.md,
// "/about", section 5). Three moving parts: the ring's outline draws, the
// ring fills, then the spark lands. Complete at --p 1, so it is whole in low
// motion, without JavaScript and in print. The words beside it say what it
// is, so it is hidden from assistive tech.
import { raw } from "../html.js";

const RING = "M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z";
const SPARK =
  "M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z";

export const markDraw = () =>
  raw(`<svg class="mark-draw" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g transform="translate(2.06 0.06)"><path class="md-line" data-p pathLength="1" d="${RING}"/><path class="md-fill" data-p d="${RING}"/><path class="md-spark" data-p d="${SPARK}"/></g></svg>`);

// The rules that read --p sit on the [data-p] parts themselves.
export const MARK_DRAW_CSS = `
.mark-draw { display: block; width: 100%; height: auto; overflow: visible; }
.mark-draw .md-line { fill: none; stroke: var(--accent); stroke-width: 0.6; stroke-dasharray: 1; stroke-dashoffset: calc(1 - clamp(0, var(--p) / 0.55, 1)); }
.mark-draw .md-fill { fill: var(--accent); opacity: clamp(0, (var(--p) - 0.45) * 4, 1); }
.mark-draw .md-spark { fill: var(--accent); transform-box: fill-box; transform-origin: 20% 80%; opacity: clamp(0, (var(--p) - 0.7) * 5, 1); scale: calc(0.4 + 0.6 * clamp(0, (var(--p) - 0.7) * 5, 1)); }
`;
