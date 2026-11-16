// /brand: the media kit. The files stay in brand/kit/, where other sites
// link to them. Ported from the old brand/index.html; the description of
// what we do follows brand-language.md, and the pronunciation lives on
// About only.

export const brand = {
  title: "Media kit | Chama Inteligente",
  description: "The Chama Inteligente logo, mark, colours and fonts, for anyone linking to or writing about us.",
  ogAlt: "The Chama Inteligente logo.",

  h1: "Media kit.",
  lead: "You are welcome to use these files to link to or write about Chama Inteligente. There is no need to ask first.",
  zip: { text: "Download everything (zip)", href: "/brand/kit/chama-inteligente-media-kit.zip" },

  describe: {
    h2: "Describing Chama",
    lead: "Use either of these as they are:",
    lines: [
      "Custom software and AI coaching, from a family business in Lisbon.",
      "A small, family-owned, AI-native business. Based in Lisbon, working worldwide.",
    ],
    after: "The name is Chama Inteligente, or Chama for short. Link to chamainteligente.com, or to chamainteligente.com/coaching for the coaching in particular.",
  },

  logo: {
    h2: "The logo",
    light: { label: "On light", file: "chama-logo-light.png", note: "for light backgrounds, transparent" },
    dark: { label: "On dark", file: "chama-logo-dark.png", note: "for dark backgrounds, transparent" },
    files: [
      { file: "chama-mark.svg", note: "the mark alone, vector" },
      { file: "chama-mark-1024.png", note: "the mark alone, transparent" },
      { file: "chama-avatar-light-1024.png", note: "profile pictures and round crops" },
      { file: "chama-avatar-dark-1024.png", note: "the same, dark" },
    ],
    alt: "Alt text for any of them: \"Chama Inteligente\".",
    imgAlt: "Chama Inteligente",
  },

  rules: {
    h2: "Using the logo",
    items: [
      "Use the files as they are. The mark is always ember; the name is ink on light backgrounds and paper on dark ones.",
      "Keep clear space around the logo of at least half the mark's height. The logo files already carry it.",
      "Below about 24 px tall, use the mark alone.",
      "Do not stretch, rotate, recolour, outline or add effects to it.",
      "To put the mark in a square or circle, use an avatar file rather than centring it yourself. The spark on the right makes a centred mark look off-balance, so the avatars are optically centred for you.",
      "In running text, write the name in your own typeface.",
    ],
  },

  colours: {
    h2: "Colours",
    swatches: [
      { name: "Ember", hex: "#f4581f", token: "ember", contrast: "Ink on ember 5.50:1", on: "ink" },
      { name: "Ink", hex: "#141412", token: "ink", contrast: "Paper on ink 16.20:1", on: "paper" },
      { name: "Paper", hex: "#f3f0e8", token: "paper", contrast: "Ink on paper 16.20:1", on: "ink" },
    ],
    note: "Text on ember is ink, never white: white on ember is 3.35:1. Ember text on paper is #b33d0b (5.14:1).",
  },

  fonts: {
    h2: "Fonts",
    lead: "Two families from one superfamily, both under the SIL Open Font License 1.1.",
    items: [
      { name: "Funnel Display", use: "Headings", family: "display", sample: "What you have to do, made easier.", href: "/assets/fonts/funnel-display-latin-wght.woff2" },
      { name: "Funnel Sans", use: "Text", family: "text", sample: "Based in Lisbon, working worldwide.", href: "/assets/fonts/funnel-sans-latin-wght.woff2" },
    ],
    download: "Download",
    licence: { text: "The licence", href: "/assets/fonts/OFL.txt" },
  },

  questions: {
    h2: "Questions",
    before: "Write to ",
    email: "info@chamainteligente.com",
    after: ". The same guidelines are in the zip as plain text, and at ",
    guidelines: { text: "GUIDELINES.txt", href: "/brand/kit/GUIDELINES.txt" },
    end: ".",
  },
};
