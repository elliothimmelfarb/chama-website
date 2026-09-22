/* The Words / Pictures switch. The page has two views of the same copy:
   Words, the page as written, and Pictures, which keeps the headlines and
   the figures and drops the explanatory paragraphs ("big pictures, few
   words"). The view is an attribute on <html>, data-view="pictures", set
   before first paint by the inline script in each page's head (from
   localStorage or ?view=pictures) so nothing flashes; this script only
   wires the switch and remembers the choice. Shared by index, training,
   and about. Nothing here talks to the network. */
(() => {
  const root = document.documentElement;
  const KEY = "chama-view";
  const switches = Array.from(document.querySelectorAll("[data-view-switch]"));
  if (!switches.length) return;

  const current = () => root.getAttribute("data-view") === "pictures" ? "pictures" : "words";

  const reflect = () => {
    const on = current() === "pictures";
    switches.forEach((el) => el.setAttribute("aria-checked", on ? "true" : "false"));
  };

  const remember = (view) => {
    try {
      if (view === "pictures") localStorage.setItem(KEY, "pictures");
      else localStorage.removeItem(KEY);
    } catch (e) { /* private mode, blocked storage: the choice lasts the page */ }
  };

  const stillness = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  const set = (view) => {
    if (view === current()) return;
    const apply = () => {
      if (view === "pictures") root.setAttribute("data-view", "pictures");
      else root.removeAttribute("data-view");
      reflect();
      remember(view);
      /* Figures that are on screen draw themselves again in their new
         size, so the switch reads as the page redrawing rather than
         reflowing. figures.js listens for this. */
      document.dispatchEvent(new CustomEvent("chama:view", { detail: { view } }));
    };
    if (stillness || !("startViewTransition" in document)) {
      apply();
      return;
    }
    document.startViewTransition(apply);
  };

  switches.forEach((el) => {
    el.addEventListener("click", () => set(current() === "pictures" ? "words" : "pictures"));
  });

  reflect();
})();
