/* ==========================================================================
   The fire, on its own thread.

   A phone cannot paint the fire and move a scroll in the same frame, because
   both want the same thread. So on touch the canvas is handed over to this
   worker and the fire burns here: the main thread keeps the finger, the
   keyboard and the transcript, and never waits on a particle again.

   There is no logic in this file. It is a switchboard: one message per engine
   method, one postMessage per emit, and nothing in between. Everything the
   fire actually does lives in flame.js, which is the same file the page loads
   for the inline path, from the same origin, with no network request of its
   own beyond it.
   ========================================================================== */
"use strict";

importScripts("/assets/flame.js");

var flame = null;

function emit(type, payload) {
  postMessage({ type: type, payload: payload });
}

onmessage = function (ev) {
  var m = ev.data;
  if (!m || typeof m !== "object") return;
  var a = m.args || [];

  if (m.type === "init") {
    if (flame) return;
    flame = self.ChamaFlame.create({
      canvas: m.canvas,
      touchDevice: !!m.touchDevice,
      reduceMotion: !!m.reduceMotion,
      settings: m.settings,
      emit: emit
    });
    return;
  }

  if (!flame) return;

  switch (m.type) {
    case "resize": flame.resize(a[0], a[1], a[2]); break;
    case "start": flame.start(); break;
    case "stop": flame.stop(); break;
    case "pointer": flame.pointer(a[0], a[1], a[2]); break;
    case "pointerSeed": flame.pointerSeed(a[0], a[1], a[2]); break;
    case "pointerEnd": flame.pointerEnd(); break;
    case "tap": flame.tap(a[0], a[1]); break;
    case "press": flame.press(a[0], a[1]); break;
    case "pressEnd": flame.pressEnd(); break;
    case "state": flame.setState(a[0]); break;
    case "flicker": flame.flicker(a[0]); break;
    case "spark": flame.launchSpark(); break;
    case "set": flame.set(a[0]); break;
    case "tau": flame.setTau(a[0]); break;
    case "dim": flame.setDim(a[0]); break;
    case "wake": flame.wake(); break;
    case "drawStatic": flame.drawStatic(); break;
    case "reduceMotion": flame.setReduceMotion(a[0]); break;
  }
};
