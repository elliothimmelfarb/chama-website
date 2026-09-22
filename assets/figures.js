/* Section figures draw themselves the first time they scroll into view,
   and again on a tap. Arming the page (html.figs-armed) is what gives a
   figure its hidden starting state, so without this script every figure
   is simply complete. Shared by index.html and privacy.html. */
(() => {
  const figures = Array.from(document.querySelectorAll(".figure"));
  if (!figures.length) return;

  if (!("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("figs-armed");

  const seen = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        seen.unobserve(entry.target);
      }
    });
  }, { threshold: 0.35 });

  /* Replaying a figure is a control, so it is reachable from the keyboard
     as well as the pointer: role="button" and tabindex, with the figure's
     own aria-labelledby description left in place, so a screen reader still
     reads the whole picture and then hears that it can be activated.

     Under reduced motion nothing animates and a replay would do nothing, so
     there is no control to offer and the figures stay plain images. */
  const stillness = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  const replay = (figure) => {
    figure.classList.remove("in");
    void figure.getBoundingClientRect();
    figure.classList.add("in");
  };

  figures.forEach((figure) => {
    seen.observe(figure);
    if (stillness) return;
    figure.setAttribute("role", "button");
    figure.setAttribute("tabindex", "0");
    figure.addEventListener("click", () => replay(figure));
    figure.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
        ev.preventDefault();
        replay(figure);
      }
    });
  });
})();

/* The Words / Pictures switch (view.js) announces a change of view. The
   figures that are on screen at that moment draw themselves again at
   their new size, so the switch reads as the page redrawing. */
document.addEventListener("chama:view", () => {
  const stillness = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
  if (stillness || !document.documentElement.classList.contains("figs-armed")) return;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  document.querySelectorAll(".figure").forEach((figure) => {
    const r = figure.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    figure.classList.remove("in");
    void figure.getBoundingClientRect();
    figure.classList.add("in");
  });
});
