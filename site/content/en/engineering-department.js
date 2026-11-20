import { SITE } from "../../site.js";
// /engineering-department. It stands alone for a referral link, so its first
// screen says who we are without the home page.

// The numbers the summary figure draws, read from the one sentence every
// change-time claim comes from, so the figure and its words never differ.
const CAUGHT = /^(Median \d+ minutes from request to live, across (\d+) requests since \d{4}-\d\d-\d\d\.) (\d+)% were live within the hour, and every one the same day\.$/.exec(SITE.changeCaption);
if (!CAUGHT) throw new Error("SITE.changeCaption no longer reads as the numbers figure expects; update site/content/en/engineering-department.js");
const [, CAPTION_FIRST, REQUESTS, WITHIN] = CAUGHT;

export const ed = {
  title: "Your own engineering department | Chama Inteligente",
  description:
    "Software that fits how your business works and changes when you do. Tell us what you need and it gets built. You own the code, and we manage it for you. From a small, family-owned, AI-native business in Lisbon.",
  // the sharing card prints the change-time line, so its alt says it too
  ogAlt: "Your own engineering department. Most changes are live in under an hour. Chama Inteligente.",

  who: "A small, family-owned, AI-native business in Lisbon, working worldwide.",
  h1: "Your own engineering department.",
  lead: "Software that fits your process, and changes when you do. You talk to a person. AI does the heavy work behind us.",

  // the first picture: a survey sheet of a business, the boxes laid over it,
  // then its own software round it
  survey: {
    label: "A business is an irregular shape. Boxes of off-the-shelf software are laid over it one after another as it grows: their corners go unused, where two overlap is paid for twice, and parts of the business are never covered. Then one outline, your own software, hugs the real shape. When the business needs room, the outline makes the room first and the business grows into it.",
    unused: "Unused",
    missing: "Missing",
    twice: "Paid twice",
    shelf: ["Off the shelf", "Off the shelf, twice", "Off the shelf, three times"],
    own: "Your own software",
  },

  contrast: {
    h2: "Big companies have their own engineers. Now your business can too.",
    lead: "Software bought off the shelf puts you in line behind its other customers. Your engineers work only for you. You get what a big company has, without becoming one.",
    figLabel: "Customers wait in line at an off-the-shelf software company. Yours stands in front, with three engineers of its own.",
    them: "Off the shelf",
    you: "Yours",
  },

  loop: {
    h2: "Tell us what you need. It gets built. You use it. You find what's next.",
    stations: ["Tell us", "It gets built", "You use it", "What's next"],
    you: "You",
    ledgerLabel: "Four real requests, from request to live",
    cta: "Tell us yours",
  },

  numbers: {
    h2: SITE.changeTime,
    lead: "Measured on the software we run for an 88-person metal stamping plant in Toronto.",
    leadNamed: "Measured on the software we run for LA Metal Stamping, an 88-person plant in Toronto.",
    replaced: "It replaced their old system, a second app and four spreadsheets.",
    week: [
      { value: "19", text: "people use it every day" },
      { value: "about 15", text: "changes go live in a typical week" },
    ],
    // the summary figure: every request as a dot, those live within the
    // hour in ember. Its caption is the sentence's first half; its labels
    // are the share, in ember, and "every one the same day", because the
    // heading above already says "within the hour".
    summary: {
      requests: +REQUESTS,
      within: Math.round((+REQUESTS * +WITHIN) / 100),
      caption: CAPTION_FIRST,
      share: `${WITHIN}%`,
      day: "Every one the same day",
      label: SITE.changeCaption,
    },
    // the before and after figure, beside the sentence it draws
    figure: { after: "One system", label: "Their old system, a second app and four spreadsheets, replaced by one system." },
    finds: "Ask it anything. Why don't these two numbers add up? It finds the step someone forgot two months ago, and offers to fix it for you.",
  },

  recording: {
    h2: "A request, then the change.",
    play: "Play the recording",
    pause: "Pause the recording",
    posterAlt: "The supplier orders page in the app, with the new Vendor filter marked as new.",
    lead: "A real request and the change it became, recorded on the same app with demo data.",
  },

  own: {
    h2: "You own the IP.",
    lead: "We manage it for you, and you can take it anywhere.",
    ours: "We manage it",
    yours: "You own it",
  },

  price: {
    h2: "A setup fee and a fixed monthly fee, quoted after a first conversation.",
    guarantee: "The setup fee is due only when you switch off your old system.",
    // the timeline under it is how it starts, step by step, saying only
    // what the page says nowhere else: how soon is in the questions, and
    // the guarantee above already says the fee is due at the switch.
    line: {
      steps: [
        "A first conversation about how your business works today.",
        "A first version your team can use.",
        "You switch off the old system when you're ready.",
      ],
      old: "Your old system",
      setup: "Setup fee",
      monthly: "Then the monthly fee",
      label: "A first conversation, then a first version, then the old system is switched off, which is when the setup fee is due. After that, the fixed monthly fee.",
    },
  },

  objections: {
    h2: "Questions owners ask",
    items: [
      { q: "What if you disappear?", a: ["You own the code and the data. It runs on standard tools, it's backed up, and any engineer can take it over."] },
      { q: "How much of my time does it take?", a: ["A few conversations at the start, so we understand how you work. After that, you ask for changes when you notice them, in a sentence."] },
      { q: "How soon is there a first version?", a: ["Usually within days of those first conversations. Your team uses it alongside the old system until it has earned its place."] },
      { q: "Does it work with what we already use?", a: ["Yes. It connects to the tools you keep, such as QuickBooks, and brings in what lives in your spreadsheets today."] },
      { q: "Where does our data live?", a: ["In your own database, on standard cloud hosting, backed up every night. It's yours."] },
      { q: "Who checks the AI's work?", a: ["Every change is written with its tests first and goes live only after the whole test suite passes and the change has been reviewed. Anything that touches money or another company's system waits for Elliot."] },
    ],
  },

  close: "Tell us what gets in your way.",

  // The names of the sections on the rail (assistive tech and the rail's labels).
  rail: {
    first: "Your engineering department",
    contrast: "Only for you",
    loop: "The loop",
    numbers: "The numbers",
    recording: "The recording",
    own: "You own it",
    price: "Price",
    close: "Talk to us",
  },
};
