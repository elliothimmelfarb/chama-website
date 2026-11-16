// A laptop and a phone with a tall picture of a real page on each screen
// (the .rig that assets/worlds.css draws and drawDevices in assets/worlds.js
// scrolls). The pictures are in assets/built/<name>-desktop-* and -phone-*.
import { html } from "../html.js";

// Each picture's widths on disk and its full size. The largest width is
// the file without a width suffix, except where `top` names it.
const SHOTS = {
  "toraya-lisboa": { desktop: { widths: [640, 960, 1200, 1440], h: 4500 }, phone: { widths: [160, 240, 320], top: 440, h: 3836 } },
  "vsf-lead-automation": { desktop: { widths: [640, 960, 1200, 1440], h: 4500 }, phone: { widths: [160, 240, 320], top: 440, h: 3809 } },
  "alves-teamwear": { desktop: { widths: [640, 960, 1200, 1440], top: 1800, suffixed: true, h: 2248 }, phone: { widths: [160, 240], top: 360, h: 4674 } },
  "original-site": { desktop: { widths: [640, 960, 1200, 1440], h: 4500 }, phone: { widths: [160, 240, 320], top: 440, h: 3836 } },
  shopintake: { desktop: { widths: [640, 960, 1200, 1440], h: 4500 }, phone: { widths: [160, 240, 320], top: 440, h: 3836 } },
};

const SIZES = {
  desktop: "(max-width: 759px) calc(83vw - 27px), (max-aspect-ratio: 9/10) calc(83vw - 27px), (min-width: 1680px) 770px, 47vw",
  phone: "(max-width: 759px) calc(17.4vw - 6px), (max-aspect-ratio: 9/10) calc(17.4vw - 6px), (min-width: 1680px) 162px, 9.8vw",
};

function picture(name, kind) {
  const s = SHOTS[name][kind];
  const top = s.top || 1800;
  const base = `/assets/built/${name}-${kind}`;
  const full = s.suffixed ? `${base}-${top}.webp` : `${base}.webp`;
  const srcset = [...s.widths.map((w) => `${base}-${w}.webp ${w}w`), `${full} ${top}w`].join(", ");
  return { src: full, srcset, sizes: SIZES[kind], w: top, h: s.h };
}

// lazy: the picture waits in data-src until drawDevices says its thing is
// next, with a <noscript> copy for a visitor without JavaScript. Without
// lazy it loads at once (the first thing, and pictures outside the pin).
function screenImg(pic, lazy, first) {
  if (!lazy) {
    return html`<img src="${pic.src}" srcset="${pic.srcset}" sizes="${pic.sizes}" alt="" width="${pic.w}" height="${pic.h}" decoding="async"${first ? html` fetchpriority="high"` : html` loading="lazy"`}>`;
  }
  return html`<img data-src="${pic.src}" data-srcset="${pic.srcset}" sizes="${pic.sizes}" alt="" width="${pic.w}" height="${pic.h}" decoding="async"><noscript><img src="${pic.src}" srcset="${pic.srcset}" sizes="${pic.sizes}" alt="" width="${pic.w}" height="${pic.h}" loading="lazy" decoding="async"></noscript>`;
}

export function rig(name, { lazy = false, first = false, desktop } = {}) {
  const d = desktop || picture(name, "desktop");
  const p = picture(name, "phone");
  return html`<div class="rig" aria-hidden="true">
  <div class="laptop"><div class="lid"><div class="screen">${screenImg(d, lazy, first)}</div></div><div class="base"></div></div>
  <div class="phone"><div class="screen">${screenImg(p, lazy, first)}</div></div>
</div>`;
}

// ShopIntake's own first screen, 16:10, which fills the laptop's screen.
export const SHOPINTAKE_TOP = {
  src: "/assets/built/shopintake-thumb-1080.webp",
  srcset: "/assets/built/shopintake-thumb-320.webp 320w, /assets/built/shopintake-thumb-640.webp 640w, /assets/built/shopintake-thumb-1080.webp 1080w",
  sizes: "(min-width: 1100px) 40vw, calc(100vw - 32px)",
  w: 1080,
  h: 675,
};
