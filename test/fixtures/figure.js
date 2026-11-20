// The figure fixture's figures (figure.html), built in the browser from the
// same kit the pages use, so the fixture shows kit.js as it is.
import { subject, shape, offset, c, out, place, label, WARM, FIT_GAP } from "/site/figures/kit.js";

const R = 100;
const VB = [-170, -150, 340, 290];
const vb = VB.join(" ");
// the platform the business stands on, seen from above
const PX = 155, PY = 74, PRX = 0, PRY = 40;
const RING = `M${PRX} ${PY - PRY} A${PX} ${PRY} 0 1 1 ${PRX} ${PY + PRY} A${PX} ${PRY} 0 1 1 ${PRX} ${PY - PRY} Z`;
// the boundary's top point, where "The software" is called out, and the ring's
// near edge, where it is named: both inside the figure's box at every width
const corner = offset(shape(R), FIT_GAP * R)[0];
const CALL = "--ang:-40deg;--len:34px";
const SOFTWARE = "--tx:calc(26px + 6px);--ty:calc(-22px - 50%)";
const NEAR = [0, PY + PRY], UNDER = "--ty:8px";

const svg = (cls, body, box = vb) => `<svg class="fx-svg ${cls}" viewBox="${box}" aria-hidden="true" focusable="false">${body}</svg>`;
const lb = (text, at, style, cls = "") => `<span class="fx-lb ${cls}"${/--p/.test(style) ? " data-p" : ""} style="${place(VB, ...at)};${style}">${text}</span>`;

// 1. drawn from nothing: arrive, draw, fit, then a lap of the marker, then
// the land warms it
const drawn = `<figure class="fx hero">
  ${svg("", `
  <ellipse class="fx-plat" cx="0" cy="${PY}" rx="${PX}" ry="${PRY}"/>
  <path class="fx-ring" data-p d="${RING}" style="opacity:${c(0.04, 0.12)}"/>
  <circle class="fx-mk" data-p r="4.5" style="offset-path:path('${RING}');offset-rotate:0deg;offset-distance:calc(${out(0.22, 0.62)} * 100%);opacity:calc(${c(0.2, 0.25)} * (1 - ${c(0.62, 0.67)}))"/>
  ${subject({ R, warm: WARM })}`)}
  ${lb("Your business", [0, -4], label(0.12), "is-live")}
  <span class="fx-lb fx-call" data-p style="${place(VB, ...corner)};${CALL};${label(0.2)}"></span>
  ${lb("The software", corner, `${SOFTWARE};${label(0.2)}`, "is-hot")}
  ${lb("Our AI system", NEAR, `${UNDER};${label(0.14)}`)}
</figure>`;

// 2. the same business carried on: whole from the start, at the same size
// and place; the ring becomes yours and the business warms
const continued = `<figure class="fx hero">
  ${svg("", `
  <ellipse class="fx-plat" cx="0" cy="${PY}" rx="${PX}" ry="${PRY}"/>
  <path class="fx-ring" data-p d="${RING}" style="opacity:calc(1 - ${c(0.22, 0.4)})"/>
  <path class="fx-ring is-yours" data-p d="${RING}" style="opacity:${c(0.22, 0.4)}"/>
  ${subject({ R, drawn: true, warm: WARM })}`)}
  ${lb("Your business", [0, -4], "", "is-live")}
  ${lb("The software", corner, SOFTWARE, "is-hot")}
  <span class="fx-lb fx-call" style="${place(VB, ...corner)};${CALL}"></span>
  ${lb("Yours", NEAR, `${UNDER};${label(0.4)}`)}
</figure>`;

// 3. a quiet band: a crowd of businesses, the same shape smaller, one warm
const band = `<figure class="fx band">
  ${svg("", [0, 1, 2, 3, 4].map((i) => subject({ R: 34, at: [60 + i * 120, 56], drawn: true, owned: i === 2 })).join(""), "0 0 600 120")}
</figure>`;

const put = (name, html, ar) => {
  const el = document.querySelector(`[data-fig="${name}"]`);
  el.style.setProperty("--ar", ar);
  el.innerHTML = html;
};
put("drawn", drawn, VB[2] / VB[3]);
put("continued", continued, VB[2] / VB[3]);
put("band", band, 5);
