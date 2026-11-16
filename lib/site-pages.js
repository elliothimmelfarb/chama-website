// The site's pages, as the "Talk to us" agent knows them. The agent's prompt
// lists every live page with its line here, and the agent links visitors only
// to those. test/site-pages.test.js holds "live" to what vercel.json and the
// HTML files actually serve, so landing a page means setting live: true here,
// and redirecting one away means setting it to false.
//
// "covers" is read by the model when it decides where to send someone: say
// what a visitor finds there, in plain words, and only what the page says.

export const SITE = "https://chamainteligente.com";

export const PAGES = [
  {
    path: "/",
    title: "Home",
    covers: "Who we are and what we do, in short, and where to go next.",
    live: true
  },
  {
    path: "/engineering-department",
    title: "Your own engineering department",
    covers:
      "Software that fits your business process and changes when you do, with an AI system around it that you talk to.",
    live: false
  },
  {
    path: "/coaching",
    title: "AI fluency coaching and training",
    covers:
      "Coaching for individuals and executive teams, agentic engineering training for engineering teams, coaching as a company benefit, and the Members link into the Hearth.",
    live: true
  },
  {
    path: "/build",
    title: "Websites, apps and products",
    covers:
      "Websites built to be found, apps for a phone or a computer, and building a product with you as a partner.",
    live: false
  },
  {
    path: "/work",
    title: "Our work",
    covers: "What we have built and who we have worked with.",
    live: false
  },
  {
    path: "/built",
    title: "Built",
    covers:
      "What we have built: software for one business (Toraya Lisboa, VSF Lead Automation, Alves Teamwear), our own products (ShopIntake, View the Place, the Hearth), and free things to try.",
    live: true
  },
  {
    path: "/clients",
    title: "Clients",
    covers:
      "The businesses we have built software for or coached: Toraya Lisboa, Alves Limited Group and Springlar.",
    live: true
  },
  {
    path: "/about",
    title: "About",
    covers: "The family behind the company, how it started, and the people we work alongside.",
    live: true
  },
  {
    path: "/hearth",
    title: "The Hearth",
    covers:
      "The members' room for coaching clients: booking sessions, session records, and connecting your own AI agents.",
    live: true
  },
  {
    path: "/agent",
    title: "Talk to us, full screen",
    covers: "This same conversation on a page of its own.",
    live: true
  },
  {
    path: "/privacy",
    title: "Privacy",
    covers: "What we store about visitors and contact requests, for how long, and who sees it.",
    live: true
  },
  {
    path: "/brand",
    title: "Brand kit",
    covers: "Our logo and brand files, for anyone writing about us or linking to us.",
    live: true
  }
];

export function livePages() {
  return PAGES.filter((page) => page.live);
}

export function pageUrl(pagePath) {
  return pagePath === "/" ? `${SITE}/` : `${SITE}${pagePath}`;
}

// Whether an address on our own domain points at a live page. The scheme,
// a trailing slash, a query and a fragment do not matter.
export function isLiveSiteUrl(address) {
  const match = /^(?:https?:\/\/)?(?:www\.)?chamainteligente\.com(?=[/?#]|$)(\/[^\s?#]*)?/i.exec(address);
  if (!match) return false;
  const pagePath = (match[1] || "/").replace(/\/+$/, "") || "/";
  return livePages().some((page) => page.path === pagePath.toLowerCase());
}

// The lines the system prompt carries. Built once from constants, so the
// prompt stays byte-identical between requests and its cache keeps hitting.
export function sitePagesForPrompt() {
  return livePages()
    .map((page) => `- ${pageUrl(page.path)} (${page.title}): ${page.covers}`)
    .join("\n");
}
