// The first script on every page, before any stylesheet, so the first paint
// is already in the visitor's theme and motion mode. test/theme.test.js
// holds it byte-identical on every page, hearth-room.html included.
//
// data-theme: only set when the visitor chose light or dark; absent means
// follow the system (tokens.css). data-motion="low": chosen, or the system
// asks for reduced motion and the visitor has not chosen full. html.pin:
// the pinned layout, which needs room (worlds.js uses the same query).

export const PIN_QUERY = "(min-height: 501px)";

export const BOOT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("chama-theme");if(t==="light"||t==="dark")d.dataset.theme=t;var m=localStorage.getItem("chama-motion");if(m==="low"||(m!=="full"&&matchMedia("(prefers-reduced-motion: reduce)").matches))d.dataset.motion="low"}catch(e){}if(d.dataset.motion!=="low"&&matchMedia("${PIN_QUERY}").matches)d.classList.add("pin")})();`;
