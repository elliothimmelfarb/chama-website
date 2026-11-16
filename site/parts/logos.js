// Client and partner logos as one-colour masks, so one file works on every
// ground in both themes (docs/DESIGN.md, "Logos"). Elliot decides who is
// listed. Each logo's file is a transparent image whose opaque pixels are
// the mark; w and h are its natural size, used to give each the same
// optical weight.
import { html } from "../html.js";

export const CLIENTS = [
  { id: "toraya-lisboa", name: "Toraya Lisboa", src: "/assets/work/toraya-lisboa-300.webp", w: 300, h: 287 },
  { id: "alves-limited", name: "Alves Limited", src: "/assets/work/alves-limited.webp", w: 399, h: 158 },
  { id: "springlar", name: "Springlar", src: "/assets/work/springlar-480.webp", w: 480, h: 81 },
];

export const PARTNERS = [
  { id: "tlc-automation", name: "TLC Automation", src: "/assets/work/tlc-automation-480.webp", w: 480, h: 94 },
  { id: "alves-limited", name: "Alves Limited Group", src: "/assets/work/alves-limited.webp", w: 399, h: 158 },
];

// Equal area, capped height: a square mark and a wide wordmark read the
// same weight.
const sizeOf = (l) => {
  const area = 2400;
  const ratio = l.w / l.h;
  const h = Math.min(44, Math.sqrt(area / ratio));
  return { w: Math.round(h * ratio), h: Math.round(h) };
};

export function logo(l) {
  const s = sizeOf(l);
  return html`<span class="logo" role="img" aria-label="${l.name}" style="--logo:url('${l.src}');--lw:${s.w};--lh:${s.h}"></span>`;
}

export function logoStrip(list) {
  return html`<ul class="logos">${list.map((l) => html`<li>${logo(l)}</li>`)}</ul>`;
}
