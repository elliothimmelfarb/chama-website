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

  figures.forEach((figure) => {
    seen.observe(figure);
    figure.addEventListener("click", () => {
      figure.classList.remove("in");
      void figure.getBoundingClientRect();
      figure.classList.add("in");
    });
  });
})();
