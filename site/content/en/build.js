// /build: websites, apps and products, with product partnership.

export const build = {
  title: "Websites, apps and products | Chama Inteligente",
  description:
    "Websites built to be found, apps for one business, and products built with founders. If it can be solved with something on a phone, a computer or in the cloud, we can do it. Chama Inteligente, Lisbon.",
  ogAlt: "Websites, apps and products. Chama Inteligente.",

  h1: "Websites, apps and products.",
  lead: "If it can be solved with something on a phone, a computer or in the cloud, we can do it.",

  websites: {
    h2: "Websites built to be found.",
    lead: "Fast, clear, and set up for search from the first day.",
  },
  apps: {
    h2: "Apps made for one business.",
    lead: "The tools a team runs on, shaped around how it already works.",
  },
  // The things shown on the laptop and phone, in order. Private work shows
  // demo data, never real records.
  things: [
    {
      id: "toraya",
      name: "Toraya Lisboa",
      kind: "Website and staff app",
      text: "A Japanese deli in Rossio station. We built their website and an app for the staff that goes with it. They circle any part of the site, write what they want changed, and the change is live within the hour. The version they approved was ready four hours after we started.",
      href: "https://toraya.pt",
      link: "toraya.pt",
    },
    {
      id: "vsf",
      name: "VSF Lead Automation",
      kind: "App for one business",
      text: "Vivir Sin Fronteras helps students get into universities abroad. When someone enquires, a bot messages them on WhatsApp, asks the questions the team would ask, and books the meeting straight into the team's calendar when it's worth it.",
      private: "This is private software, built for one business.",
    },
    {
      id: "alves",
      name: "Alves Teamwear",
      kind: "App for one business",
      text: "Alves Teamwear sells custom kits to sports teams. We built an app where a team designs its own kit and places the order, and a command center where the operators and the supplier keep track of everything.",
      private: "This is private software, built for one business.",
    },
  ],

  partnership: {
    h2: "Have an idea? We'll build it with you, as a partner or co-founder.",
    lead: "We build our own products too, so we know the road from an idea to something people use.",
    proof: {
      name: "ShopIntake",
      text: "Our own product. It reads the purchase orders customers email you and pulls the order out, so nobody has to type it into your ERP.",
      href: "https://shop-intake.com",
      link: "shop-intake.com",
    },
  },

  close: "What would you like built?",
};
