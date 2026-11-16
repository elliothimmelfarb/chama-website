// /privacy: what happens to what visitors type, in plain language. Ported
// from the old privacy.html (effective 2026-09-02) and brought up to date
// with api/chat.js and api/intake.js: the chat has no persona or settings
// tool, the address for requests is info@. The retention promise here is
// what api/intake-cleanup.js enforces.

export const privacy = {
  title: "Privacy | Chama Inteligente",
  description: "How Chama Inteligente handles conversations with the chat on its website and the details you send.",
  ogAlt: "Privacy, in plain language. Chama Inteligente.",

  h1: "Privacy, in plain language.",
  effective: "Effective 2026-11-16.",

  who: {
    h2: "Who is responsible",
    lead: "Chama Inteligente, Lda. is the controller of information submitted through this website.",
    registry: "Company registry and tax number 519425235",
    address: ["Rua Cascais 33, bloco E, 3.º D", "1300-120 Lisboa, Portugal"],
  },

  chat: {
    h2: "Talking to us",
    paras: [
      "The chat on this site (Talk to us) is an AI, a Claude model. Conversations with it are saved: what you write and its replies. We save them so Elliot can read where the agent does well or badly and make it better. A second model, with no tools, reads recent conversations to catch misuse.",
      "A conversation is not linked to your name or an account (there are none); it contains only what you choose to type. Please do not share sensitive personal information in the chat. The legal basis for this processing is our legitimate interest in operating and improving the agent, under Article 6(1)(f) of the General Data Protection Regulation.",
    ],
  },

  details: {
    h2: "Asking us to reach out",
    paras: [
      "If you ask to be contacted, the agent shows you exactly what it will pass on: your name, a way to reach you (an email address, or a WhatsApp or phone number), and what you would like to be able to do. Nothing is sent until you confirm. If the chat is unreachable, a plain form takes the same details.",
      "Confirmed details are stored privately and emailed to us for Elliot to review. The legal basis is taking steps at your request before a possible agreement, under Article 6(1)(b).",
    ],
  },

  flow: {
    h2: "Where it goes",
    label:
      "Where your words go. You, with no name, no account and no IP address stored, write in the chat on this site. Your message goes to the Claude API, where Anthropic writes the reply, and the reply comes back to you. The whole conversation is saved to private storage with Vercel in the European Union, Paris, and deleted within 12 months. Only if you ask, and confirm your details, an email goes to us through Resend. Your words are never treated as instructions.",
    nodes: {
      you: ["You", "no name, no account,", "no IP address stored"],
      chat: ["Talk to us", "the chat on this site"],
      api: ["Claude API", "Anthropic writes the reply"],
      store: ["Private storage", "Vercel, EU (Paris)", "deleted within 12 months"],
      email: ["Email to us", "sent with Resend"],
    },
    edges: {
      typed: "what you type",
      back: "and the reply",
      saved: "saved to make it better",
      asked: "only if you ask, and confirm",
    },
    note: "Your words are never treated as instructions.",
    paras: [
      "Chat messages are sent to Anthropic (the Claude API) to generate the agent's replies. Saved conversations and details are stored privately with Vercel, our hosting provider, in the European Union (Paris). Resend delivers the email. Like any website host, Vercel processes technical data such as IP addresses to serve the pages; we do not store IP addresses in conversations or details.",
      "We do not sell your information, use it for marketing, profile you, or make automated decisions with legal or similarly significant effects about you. Your words are never treated as instructions that change how our systems behave beyond the reply you see.",
    ],
  },

  hearth: {
    h2: "The Hearth, the members' room",
    paras: [
      "If you create an account in the Hearth (the members' room at /hearth), we keep what an account needs: your email address, the name you give, a picture if the sign-in provider offers one, your role, your timezone, and the link to the Google, GitHub or Discord account you signed in with. Each sign-in is recorded with its time, the kind of device and browser, and the country, never the IP address, so you can see where you are signed in and end any session. The legal basis is the agreement with you as a member (Article 6(1)(b)) and, for the sign-in records, our legitimate interest in keeping the room secure (Article 6(1)(f)).",
      "If you work with Elliot, the room holds the record of that work: the packs you asked for and paid, your sessions, the transcripts of those sessions and what is derived from them (a summary, key points, decisions, follow-ups), the notes you leave, and your follow-up list. Transcripts come from Google Meet when a session is held there, or Elliot attaches them. A transcript is sent to Anthropic (the Claude API) to write its record and, when you ask about your sessions in the room, to answer you. These records are yours: you can read every one, and ask for them or their deletion at any time.",
      "You can let your own software read your room: an API key you create, or an app you connect through the consent page, sees only what you grant it, every call is logged, and you can revoke it in the room. Nothing an app sends is treated as an instruction to anyone.",
      "The Hearth's database is hosted by Neon in the European Union (Frankfurt); the pages and functions run with Vercel in Paris; Resend delivers the room's email; Google provides Calendar and Meet when Elliot has connected his account, in which case your session is an event on his calendar with you as a guest.",
    ],
  },

  keep: {
    h2: "How long we keep it",
    paras: [
      "We delete saved conversations and details within 12 months. A Hearth account and its records are kept while you are a member and for 12 months after your last sign-in, then deleted, except what accounting and tax law requires us to keep about a purchase; the sign-in and activity log is kept for 12 months. If we begin working together, information that becomes part of that relationship may be kept longer where the relationship or law requires it.",
    ],
  },

  rights: {
    h2: "Your choices and rights",
    before: "You can ask to access, correct, delete, restrict, or receive your information, and object where the law gives you that right. Write to ",
    email: "info@chamainteligente.com",
    after: " with \"Privacy request\" in the subject, or to the registered office above. A conversation is not linked to your identity, so to find yours we may need you to tell us roughly when it happened and what was discussed.",
    complain: "You can also complain to Portugal's Comissão Nacional de Proteção de Dados (Data Protection Authority).",
  },
};
