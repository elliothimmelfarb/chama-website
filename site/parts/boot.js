// The first script on every page, before any stylesheet, so the first paint
// is already in the visitor's theme and motion mode. test/site.test.js
// holds it identical on every public page.
//
// data-theme: only set when the visitor chose light or dark; absent means
// follow the system (tokens.css). data-motion="low": chosen, or the system
// asks for reduced motion and the visitor has not chosen full. html.pin:
// the pinned layout, which needs room (worlds.js uses the same query); if
// worlds.js has not marked html[data-engine] 4s after the DOM is ready, the
// pinned words would stay hidden, so the page falls back to one column.

export const PIN_QUERY = "(min-height: 501px)";

export const BOOT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem("chama-theme");if(t==="light"||t==="dark")d.dataset.theme=t;var m=localStorage.getItem("chama-motion");if(m==="low"||(m!=="full"&&matchMedia("(prefers-reduced-motion: reduce)").matches))d.dataset.motion="low"}catch(e){}if(d.dataset.motion!=="low"&&matchMedia("${PIN_QUERY}").matches){d.classList.add("pin");addEventListener("DOMContentLoaded",function(){setTimeout(function(){if(!d.dataset.engine)d.classList.remove("pin")},4e3)})}})();`;
