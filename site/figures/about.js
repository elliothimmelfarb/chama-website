// The mark drawing itself, beside "Chama means flame." on /about
// (docs/DESIGN.md, "/about"). A stage: it plays once when it is in view. The
// ring's outline draws, the ring fills, then the spark lands with a small
// overshoot, over a soft floor shadow. Each part reads --p inline and is
// whole at --p 1, so the mark is complete in low motion, without JavaScript
// and in print. The words beside it say what it is, so it is hidden from
// assistive tech; its one button is not.
import { html, raw } from "../html.js";
import { c, ss, out } from "./kit.js";

const RING = "M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z";
const SPARK =
  "M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67C55.19 30.46 56.13 30.06 57 29.32C56.46 31.88 55.66 34.16 53.91 35.91C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z";

// ---- the stage's controls --------------------------------------------------
// One quiet button at the figure's corner: pause while it plays, play
// again once it has ended (worlds.css shows the one that fits the state;
// none in low motion or without JavaScript).
const ICON = {
  play: '<path d="M7 4.5v11l9-5.5z"/>',
  pause: '<path d="M7 4.5v11M13 4.5v11"/>',
  replay: '<path d="M4.5 10a5.5 5.5 0 1 0 1.8-4.1"/><path d="M4.5 3.5v3.2h3.2"/>',
};
const button = (action, name) =>
  `<button class="replay-btn" type="button" data-stage-action="${action}" aria-label="${name}"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">${ICON[action]}</svg></button>`;
export const STAGE_BUTTONS_CSS = `
.replay { position: absolute; right: 0; bottom: 0; }
.replay-btn { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: var(--r-pill); background: color-mix(in srgb, var(--surface) 72%, transparent); color: var(--fg-2); box-shadow: inset 0 0 0 1px var(--line); cursor: pointer; transition: color var(--dur-quick) var(--ease-out), box-shadow var(--dur-quick) var(--ease-out), scale var(--dur-press) var(--ease-out); }
.replay-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; }
.replay-btn:active { scale: 0.97; }
@media (hover: hover) { .replay-btn:hover { color: var(--fg); box-shadow: inset 0 0 0 1px var(--fg-2); } }
`;
const stageButtons = () => raw(`<div class="replay">${button("play", "Play")}${button("pause", "Pause")}${button("replay", "Play again")}</div>`);

// the spark grows past its size as it lands, then settles
const SPARK_STYLE = `opacity:calc(0.01 + 0.99 * ${c(0.5, 0.56)});transform-box:fill-box;transform-origin:20% 80%;scale:calc(0.4 + 0.66 * ${out(0.5, 0.62)} - 0.06 * ${out(0.62, 0.7)})`;

export const markDraw = () =>
  html`<figure class="fx md" data-stage data-duration="3.2" data-delay="0.2" tabindex="-1">
  ${raw(`<svg class="fx-svg md-svg" viewBox="0 -2 64 68" aria-hidden="true" focusable="false">
    <defs><radialGradient id="md-floor"><stop offset="0" class="fx-s-shadow"/><stop offset="1" class="fx-s-clear"/></radialGradient></defs>
    <ellipse class="fx-floor" data-p fill="url(#md-floor)" cx="32" cy="60" rx="22" ry="3.5" style="opacity:${c(0.3, 0.45)}"/>
    <g transform="translate(2.06 0.06)">
      <path class="md-line" data-p pathLength="1" d="${RING}" style="opacity:${c(0, 0.05)};stroke-dashoffset:calc(1 - ${ss(0, 0.4)})"/>
      <path class="md-fill" data-p d="${RING}" style="opacity:calc(0.01 + 0.99 * ${c(0.35, 0.5)})"/>
      <path class="md-spark" data-p d="${SPARK}" style="${SPARK_STYLE}"/>
    </g>
  </svg>`)}
  ${stageButtons()}
</figure>`;
