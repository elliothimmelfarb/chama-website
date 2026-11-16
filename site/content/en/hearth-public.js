// /hearth for visitors who are not signed in: what the members' room is.
// Ported from the old hearth-public.html. Members sign in at /hearth/sign-in.

export const hearthPublic = {
  title: "The Hearth | Chama Inteligente",
  description:
    "The members' room for our coaching clients. Book time with Elliot, keep a record of every session, remember what you learned, and connect your own AI agent.",
  ogAlt:
    "The Hearth. For our coaching clients: book sessions with Elliot, keep a record of each one, and connect your own AI agent. Chama Inteligente, Lisbon.",

  h1: "The Hearth.",
  lead: "The members' room for our coaching clients. Everything that comes out of your sessions with Elliot is kept in one place, and it belongs to you.",
  signIn: { text: "Members sign in", href: "/hearth/sign-in" },
  coaching: { text: "How coaching works", href: "/coaching" },

  features: [
    {
      h2: "Book a session.",
      lead: "Pick a time from Elliot's open hours. The Hearth shows every time in your own timezone, so there is nothing to work out.",
    },
    {
      h2: "A record of every session.",
      lead: "After each session you get a short summary, what we decided, a playbook of things to try before the next one, and follow-ups for both of us. The record is yours, and so is the transcript.",
    },
    {
      h2: "Remember what you learned.",
      lead: "A record can come with Remember cards, short questions about what came up. A card comes back after one day, then three, seven, sixteen and thirty-five, just before you would forget it.",
      figure: "gaps",
    },
    {
      h2: "Bring your own AI agent.",
      lead: "The Hearth has an MCP server. Connect Claude, or any agent that speaks MCP, and it can read your records and follow-ups and see your sessions. You approve what it may do, and can disconnect it at any time.",
    },
  ],
  gaps: {
    label: "A card comes back after 1, 3, 7, 16 and 35 days. Each gap is longer than the last.",
    days: [1, 3, 7, 16, 35],
    unit: "days",
  },

  private: {
    h2: "Private.",
    lead: "Your room is private to you and to the people at Chama who coach you. Nothing in it is sold or shared.",
  },
  join: {
    h2: "How to join.",
    lead: "Membership comes with coaching. The room is by invitation: when you start coaching with Elliot, he invites you in.",
  },
  member: { before: "Already a member? ", link: "Sign in", after: "." },

  close: "What would you like to be able to do?",
};
