// The home page's words. Approved wording: brand-language.md (brain); the
// order and what each section says: docs/DESIGN.md section 7, "/ Home".

export const home = {
  title: "Chama Inteligente | Custom software and AI coaching, from a family business in Lisbon",
  description:
    "A small, family-owned, AI-native business in Lisbon, working worldwide. We can solve any software problem, and teach you to use AI yourself: your own engineering department, websites, apps and products, and AI fluency coaching.",
  ogAlt: "What you have to do, made easier. What you wish you could do, made possible. Chama Inteligente, Lisbon.",

  descriptor: "Custom software and AI coaching, from a family business in Lisbon.",
  h1: ["What you have to do, made easier.", "What you wish you could do, made possible."],
  sub: "You talk to a person. AI does the heavy work behind us, which is how a small team can take on any software problem.",

  stageLabel: "How Chama works, in eight short scenes",
  // The opening stage: each beat's sentence, cut into the phrases it says
  // one after another (site/figures/stage.js times them).
  stageBeats: [
    { name: "The old way", say: ["Software companies have engineers,", "and their customers wait in line."] },
    { name: "The turn", say: ["Here the engineers", "work only for you."] },
    { name: "A small team", say: ["A small, family-owned,", "AI-native business."] },
    { name: "The loop", say: ["Tell us what you need.", "It gets built.", "You use it.", "You find what's next."] },
    { name: "Fit", say: ["Fits your process,", "and changes when you do."] },
    { name: "Breadth", say: ["If it can be solved with something", "on a phone,", "a computer", "or in the cloud,", "we can do it."] },
    { name: "Learning", say: ["When AI can do something new,", "so can you."] },
    { name: "More time", say: ["More time for human things,", "and for each other."] },
  ],

  // No door's line repeats the stage beat its glyph comes from.
  doors: [
    { id: "engineering-department", title: "Your own engineering department", line: "You get what a software company has, without becoming one." },
    { id: "coaching", title: "AI fluency coaching and training", line: "Time with someone who knows AI deeply and makes it simple." },
    { id: "build", title: "Websites, apps and products", line: "Websites built to be found." },
  ],
  also: "We also partner with founders on new products, and help leadership teams with AI enablement.",

  // Elliot's sentence (2026-11-16), then the goals it names, drawn as the
  // five sides of the business: the three must-haves, then the two hopes.
  belief: {
    label: "What we believe",
    h2: "We believe that through using and teaching AI we can enable people to spend more time doing human things and accomplish more of their goals.",
    line: "We help you make money, save money and stay compliant, while you enjoy your business more and do things with it you couldn't before.",
    reasons: ["Make money", "Save money", "Stay compliant", "Enjoy it more", "Do what you couldn't before"],
  },

  // One pinned world, two beats of words that take turns.
  cando: {
    label: "What we can do",
    h2: "We can solve any software problem.",
    line: "We take on things we haven't done before.",
    fig: "Something new",
  },
  dayOne: {
    h2: "Every new AI capability is ours on day one.",
    line: "AI is levelling up fast. We level up with it, and we help you level up too.",
    fig: "Day one",
  },

  clients: {
    h2: "Who we have worked with",
    line: "Including the software an 88-person metal stamping plant in Toronto runs on.",
    lineNamed: "Including the software LA Metal Stamping runs on.",
  },

  approach: {
    label: "How we work",
    h2: "Done for you, and taught.",
    line: "We give you access to AI beyond your current abilities, and teach you to make it yours, if you want.",
    paths: ["Done for you", "Taught"],
  },

  people: {
    h2: "Real people you can reach.",
    photoAlt: "Elliot and Annie, smiling, with their baby daughter, in Lisbon.",
    caption: "Elliot and Annie, in Lisbon.",
    cta: { text: "About us", href: "/about" },
  },

  // Shown at /#thanks, where the no-JavaScript contact form lands.
  thanks: "Thank you. We have your details, and a person will reach out soon.",

  close: "What do you need?",
};
