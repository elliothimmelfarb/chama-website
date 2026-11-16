// The home page's words. Approved wording: brand-language.md (brain).

export const home = {
  title: "Chama Inteligente | Custom software and AI coaching, from a family business in Lisbon",
  description:
    "A small, family-owned, AI-native business in Lisbon. You talk to a person. AI does the heavy work behind us, which is how a small team can take on any software problem. Custom software, websites and apps, and AI fluency coaching.",
  ogAlt: "What you have to do, made easier. What you wish you could do, made possible. Chama Inteligente, Lisbon.",

  descriptor: "Custom software and AI coaching, from a family business in Lisbon.",
  h1: ["What you have to do, made easier.", "What you wish you could do, made possible."],
  // Two paragraphs, so neither paints a larger text block than the H1 (LCP).
  sub: [
    "You talk to a person. AI does the heavy work behind us, which is how a small team can take on any software problem.",
    "If you'd like to learn it yourself, we teach that too.",
  ],

  stageLabel: "How Chama works, in eight short scenes",
  // The opening stage: each beat's sentence, cut into the phrases it says
  // one after another (site/figures/stage.js times them).
  stageBeats: [
    { name: "The old way", say: ["Software companies have engineers,", "and their customers wait in line."] },
    { name: "The turn", say: ["Here the engineers", "work only for you."] },
    { name: "A small team", say: ["You talk to a person.", "AI does the heavy work behind us."] },
    { name: "The loop", say: ["Tell us what you need.", "It gets built.", "You use it.", "You find what's next."] },
    { name: "Fit", say: ["Fits your process,", "and changes when you do."] },
    { name: "Breadth", say: ["If it can be solved with something", "on a phone,", "a computer", "or in the cloud,", "we can do it."] },
    { name: "Learning", say: ["When AI can do something new,", "so can you."] },
    { name: "More time", say: ["More time for human things,", "and for each other."] },
  ],

  doors: [
    { id: "engineering-department", title: "Your own engineering department", line: "Fits your process, and changes when you do." },
    { id: "coaching", title: "AI fluency coaching and training", line: "When AI can do something new, so can you." },
    { id: "build", title: "Websites, apps and products", line: "Websites built to be found." },
  ],
  also: "We also partner with founders on new products, and help leadership teams with AI enablement.",

  proof: {
    h2: "Most changes are live in under an hour.",
    lead: "Measured on the software we run for an 88-person metal stamping plant in Toronto.",
    leadNamed: "Measured on the software we run for LA Metal Stamping, an 88-person plant in Toronto.",
    caption:
      "Median 30 minutes from request to live, across 123 requests since 2026-09-29. 88% were live within the hour, and every one the same day.",
    cta: { text: "See how it works", href: "/engineering-department" },
    clientsLabel: "Who we have worked with",
  },

  people: {
    h2: "Real people you can reach.",
    lead: "You talk to a person. AI does the heavy work behind us.",
    more: "We're a small, family-owned, AI-native business, based in Lisbon and working worldwide.",
    photoAlt: "Elliot and Annie, smiling, with their baby daughter, in Lisbon.",
    caption: "Elliot and Annie, in Lisbon.",
    cta: { text: "About us", href: "/about" },
  },

  belief: {
    lines: [
      "We believe mastery of AI can give people more time for the things they want to do.",
      "More time for human things, and for each other.",
    ],
  },

  // Shown at /#thanks, where the no-JavaScript contact form lands.
  thanks: "Thank you. We have your details, and a person will reach out soon.",

  close: "What do you need?",
};
