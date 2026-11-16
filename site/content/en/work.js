// /work: a short index of everything we've made, grouped by offer. The
// depth lives on the offering pages; /built and /clients redirect here, so
// the ids are their old anchors (also: a second old anchor for the same row).

export const work = {
  title: "Work | Chama Inteligente",
  description:
    "Everything Chama Inteligente has built and the businesses we have worked with: software we run for one business, websites, apps, our own products, and coaching.",
  ogAlt: "Everything we've built. Chama Inteligente.",

  h1: "Everything we've built.",
  lead: "Every business is a different shape. Here is who we have worked with and what we made.",

  groups: [
    {
      offer: "engineering-department",
      h2: "Your own engineering department",
      items: [
        { id: "stamping", name: "A metal stamping plant in Toronto", nameNamed: "LA Metal Stamping", line: "The software an 88-person plant runs on. It replaced their old system, a second app and four spreadsheets.", href: "/engineering-department" },
      ],
    },
    {
      offer: "build",
      h2: "Websites, apps and products",
      items: [
        { id: "toraya-lisboa", name: "Toraya Lisboa", line: "Website and staff app for a Japanese deli in Rossio station. Changes live within the hour.", href: "/build#toraya", logo: "toraya-lisboa" },
        { id: "original-site", name: "The original chamainteligente.com", line: "Our first site, kept online as it was.", href: "/original" },
        { id: "alves-limited-group", also: "vsf-lead-automation", name: "Alves Limited Group", line: "From an ad to a booked call: a landing page and an AI that asks each enquiry the team's questions.", href: "/build#vsf", logo: "alves-limited" },
        { id: "alves-teamwear", name: "Alves Teamwear", line: "Teams design their own kit and order it; the operators and supplier track everything.", href: "/build#alves" },
        { id: "shopintake", name: "ShopIntake", line: "Our own product. Reads emailed purchase orders so nobody types them into the ERP.", href: "/build#partnership" },
        { id: "view-the-place", name: "View the Place", line: "Our own product. Walk through a home for sale in 3D, on your phone, before you visit.", href: "https://viewtheplace.com" },
        { id: "the-hearth", name: "The Hearth", line: "Our own platform for coaching: booking, session records and an MCP server.", href: "/hearth" },
        { id: "aimade-games", name: "aimade.games", line: "Free to play. An arcade of browser games your AI agent can build and keep changing.", href: "https://aimade.games" },
        { id: "battle-of-mogadishu", name: "Battle of Mogadishu", line: "Free to explore. A full-scale 3D reconstruction from the historical record.", href: "https://battle-of-mogadishu.vercel.app" },
      ],
    },
    {
      offer: "coaching",
      h2: "AI fluency coaching and training",
      items: [
        { id: "springlar", name: "Springlar", line: "Healthy, carbon-neutral timber houses in Cascais. We work with them through coaching.", href: "/coaching", logo: "springlar" },
      ],
    },
  ],

  close: "Yours could be next.",
};
