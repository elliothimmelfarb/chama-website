// The three door glyphs: the opening stage's end frames (docs/DESIGN.md,
// "The doors"). One 1.5px stroke, one ember part each.
import { raw } from "../html.js";

export const GLYPHS = {
  "engineering-department": raw(
    `<svg class="g" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><ellipse cx="18" cy="18" rx="15" ry="12.5" stroke-dasharray="1.5 3.5"/><path class="e" d="M18 9.5l8 5.8-3 9.4h-10l-3-9.4z"/><path d="M18 13l4.6 3.3-1.8 5.4h-5.6l-1.8-5.4z"/><circle class="dot" cx="30.5" cy="11" r="2.2"/></svg>`,
  ),
  coaching: raw(
    `<svg class="g" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><path d="M5 22c0-5 4-7 6.5-5.5S13 23 9.5 23 6 15 11 12.5s9 1 9 5-4 4-4 1.5 3-4.5 6-4.5h9"/><path class="e" d="M28 11.5l3.5 3.5-3.5 3.5"/></svg>`,
  ),
  build: raw(
    `<svg class="g" viewBox="0 0 36 36" aria-hidden="true" focusable="false"><rect x="3" y="8" width="21" height="14" rx="1.5"/><path d="M1 25.5h25"/><rect class="e" x="24.5" y="12" width="9" height="16" rx="2"/></svg>`,
  ),
};
