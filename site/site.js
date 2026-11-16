// The site's one list of public pages and the facts every page shares.
// Adding a page: an entry here, site/pages/<id>.js, its copy in
// site/content/en/<id>.js, then npm run build.

export const SITE = {
  origin: "https://chamainteligente.com",
  name: "Chama Inteligente",
  legalName: "Chama Inteligente, Lda.",
  nipc: "519425235",
  lang: "en",
  // Elliot decides when LA Metal can be named. Until then the proof is
  // described without the name.
  laMetalNamed: false,
  // Measured 2026-11-16 from 127 LA Metal requests: median 30 minutes
  // from note to live, 88% within an hour since 2026-09-29.
  changeTime: "Most changes are live in under an hour.",
  ogImage: "/og-2026-11-16.png",
};

// nav: the label in the header, in order. inRouter: swapped by worlds.js
// without a full load. lastmod: bump in the same change as the page's copy.
export const PAGES = [
  { id: "home", path: "/", file: "index.html", nav: null, inRouter: true, priority: "1.0", lastmod: "2026-11-16" },
  { id: "engineering-department", path: "/engineering-department", file: "engineering-department.html", nav: "Engineering", inRouter: true, priority: "0.9", lastmod: "2026-11-16", ogImage: "/og-ed-2026-11-16.png" },
  { id: "coaching", path: "/coaching", file: "coaching.html", nav: "Coaching", inRouter: true, priority: "0.8", lastmod: "2026-11-16" },
  { id: "build", path: "/build", file: "build.html", nav: "Build", inRouter: true, priority: "0.8", lastmod: "2026-11-16" },
  { id: "work", path: "/work", file: "work.html", nav: "Work", inRouter: true, priority: "0.7", lastmod: "2026-11-16" },
  { id: "about", path: "/about", file: "about.html", nav: "About", inRouter: true, priority: "0.6", lastmod: "2026-11-16" },
  { id: "hearth-public", path: "/hearth", file: "hearth-public.html", nav: null, inRouter: false, priority: "0.5", lastmod: "2026-11-16", ogImage: "/og-hearth-2026-10-22.png" },
  { id: "privacy", path: "/privacy", file: "privacy.html", nav: null, inRouter: false, priority: "0.3", lastmod: "2026-11-16" },
  { id: "brand", path: "/brand", file: "brand/index.html", nav: null, inRouter: false, priority: "0.3", lastmod: "2026-11-16" },
  { id: "agent", path: "/agent", file: "agent.html", nav: null, inRouter: false, noindex: true, lastmod: "2026-11-16" },
  { id: "not-found", path: "/404", file: "404.html", nav: null, inRouter: false, noindex: true, lastmod: "2026-11-16" },
];

export const pageById = (id) => PAGES.find((p) => p.id === id);
export const url = (path) => SITE.origin + path;
