// The home page's words. Approved wording: brand-language.md (brain).

export const home = {
  title: "Chama Inteligente | Custom software and AI coaching, from a family business in Lisbon",
  description:
    "A small, family-owned, AI-native business in Lisbon, working worldwide. We're ready to solve any problem that can be solved with software, and teach you to use AI yourself: your own engineering department, websites, apps and products, and AI fluency coaching.",
  ogAlt: "We're ready to solve any problem that can be solved with software. Chama Inteligente, Lisbon.",

  // the sub says where we are and who we are, so the descriptor does not
  descriptor: "Custom software and AI coaching.",
  // Elliot, 2026-11-17: the ready-to-solve line is the main line, marked up
  // by the ember pen (the underline, then the ring).
  h1: ["We're ready to solve any problem", "that can be solved with software."],
  h1Marks: { under: "any problem", ring: "software" },
  // Elliot's pick, 2026-11-19
  sub: "A small family business in Lisbon. You work with us directly.",

  stageLabel: "How Chama works, in eight short scenes",
  // The opening stage: one sentence a scene, each shown whole for its
  // reading time (site/figures/stage.js).
  stageBeats: [
    { name: "Big companies", say: "Big companies have their own engineers." },
    { name: "Your own engineers", say: "Now your business can too." },
    { name: "A small team", say: "We're a small, family-owned, AI-native business." },
    { name: "The loop", say: "Tell us what you need. It gets built. You use it. You find what's next." },
    { name: "Fit", say: "Fits your process, and changes when you do." },
    { name: "Breadth", say: "If it can be solved with something on a phone, a computer or in the cloud, we can do it." },
    { name: "Learning", say: "When AI can do something new, so can you." },
    { name: "More time", say: "More time for human things, and for each other." },
  ],

  // No door's line repeats the stage beat its glyph comes from.
  doors: [
    { id: "engineering-department", title: "Your own engineering department", line: "You get what a big company has, without becoming one." },
    { id: "coaching", title: "AI fluency coaching and training", line: "Time with someone who knows AI deeply and makes it simple." },
    { id: "build", title: "Websites, apps and products", line: "Websites built to be found." },
  ],
  also: "We also partner with founders on new products, and help leadership teams with AI enablement.",

  // After the first view, each section opens with a question a visitor has
  // and answers it in one sentence (Elliot's pick, 2026-11-19, from
  // "Chama Homepage Picks"). Few sections, all on paper, each pointing to
  // the page that goes deeper, so home stays light beside the others.
  belief: {
    label: "Why it matters",
    ask: "What will it do for my business?",
    // the goals are the answer; "more time for human things" is the
    // stage's last beat, so it is not said again here
    h2: "What we work toward with you.",
    h2Mark: { under: "with you" },
    hopesLabel: "and two we hope for:",
    // the three must-haves, then the two hopes
    reasons: ["Make money", "Save money", "Stay compliant", "Enjoy your business more", "Do what you couldn't before"],
    hopesFrom: 3,
  },

  clients: {
    label: "Who we have worked with",
    ask: "Who have you built for?",
    h2Mark: { ring: "88-person" },
    line: "An 88-person metal stamping plant in Toronto runs on software we built.",
    lineNamed: "LA Metal Stamping in Toronto runs on software we built.",
    logosLabel: "Some of the businesses we have worked with",
  },

  approach: {
    label: "How we work",
    ask: "Will you do it for us, or teach us?",
    h2: "Both. Done for you, and taught.",
    h2Mark: { under: "Both" },
    line: "We give you access to AI beyond your current abilities, and teach you to make it yours, if you want.",
  },

  people: {
    label: "Real people you can reach",
    ask: "Who will I be talking to?",
    h2: "Real people you can reach.",
    h2Mark: { under: "Real people" },
    photoAlt: "Elliot and Annie, smiling, with their baby daughter, in Lisbon.",
    caption: "Elliot and Annie.",
    cta: { text: "About us", href: "/about" },
  },

  // Shown at /#thanks, where the no-JavaScript contact form lands.
  thanks: "Thank you. We have your details, and a person will reach out soon.",

  close: "What do you need?",
};
