// Simulated visitors for evals/simulate.js. Authored by hand, like the cases.
//
// Each one is a person with a reason to be on the page, things the flame can
// only learn by asking well, questions they want answered, and a name and one
// way to be reached that they will hand over only if the conversation earns
// it. `patience` is how many walls of text or stacked questions they sit
// through before closing the tab (simulate.js counts them; the default is 2).
// The openings are modelled on the kinds the saved conversations hold. Every
// name, number and address is made up.

export const PERSONAS = [
  {
    id: "metal-shop-greeter",
    opening: "hey",
    who: "Owner of a six-person metal fabrication shop. Typing on a phone between jobs.",
    facts: [
      "Quotes are built by hand in Excel.",
      "Each quote takes about two hours.",
      "They lose jobs because quotes go out too late.",
      "They would like to quote from a photo and a few measurements."
    ],
    questions: [],
    contact: { name: "Rui Tavares", via: "WhatsApp +351 900 000 011" },
    temperament:
      "Friendly but brief. Opened with a greeting to see what answers. Would like a call if it sounds like these people understood the quoting problem."
  },
  {
    id: "retyped-orders",
    opening: "Orders get retyped into three places.",
    who: "Runs a wholesale bakery supplying cafes.",
    facts: [
      "Orders arrive by WhatsApp and by phone.",
      "They are retyped into a spreadsheet, a production sheet, and the invoicing program.",
      "The owner does the retyping, about an hour every evening.",
      "Mistakes mean the wrong bread on the wrong van about once a week."
    ],
    questions: ["Would it work with the invoicing program they already have?"],
    contact: { name: "Helena Duarte", via: "helena@padaria-exemplo.example" },
    temperament:
      "Practical and tired. Answers direct questions directly. Will leave details once it is clear the invoicing program can stay."
  },
  {
    id: "price-first",
    opening: "how much does it cost",
    who: "Owns two physiotherapy clinics. Has been burned by an agency quote before.",
    facts: [
      "They use an off-the-shelf booking tool.",
      "It cannot handle one therapist working across both clinics.",
      "Reception fixes double bookings by phone every day."
    ],
    questions: ["What does it cost?", "Do they own the software or rent it?"],
    contact: { name: "Marta Lopes", via: "phone +351 21 000 0000, a landline, not WhatsApp" },
    temperament:
      "Skeptical. Wants a straight answer about price. Accepts 'we do not quote here' only if it is said quickly, with a reason, and with a clear next step. A dodge or a pitch ends it."
  },
  {
    id: "portuguese-clinic",
    opening: "ola, fazem software para clinicas?",
    who: "Manager of a veterinary clinic in Porto. Writes only in European Portuguese.",
    facts: [
      "Vaccination reminders are sent by hand from a paper list.",
      "They forget about a third of them.",
      "They want reminders to go out by SMS on their own."
    ],
    questions: ["Do they build software for clinics?"],
    contact: { name: "Sofia Marques", via: "sofia@vet-exemplo.example" },
    temperament:
      "Warm. Keeps writing Portuguese whatever comes back, and loses interest if answered in English."
  },
  {
    id: "partnership",
    opening: "I run a business doing work like yours and would like to talk about sending each other work.",
    who: "Runs a three-person web design studio in Lisbon.",
    facts: [
      "Clients ask the studio for internal tools it does not build.",
      "They want someone to refer that work to."
    ],
    questions: ["Is the company open to talking about it?"],
    contact: { name: "Tomas Pinto", via: "tomas@estudio-exemplo.example" },
    temperament:
      "Professional. Wants the message passed to a person. Leaves if turned away or sold to."
  },
  {
    id: "long-describer",
    opening:
      "We are a family firm that installs solar panels, twelve people. Leads come from the website form, Facebook and phone calls, and my sister puts them in a Google Sheet. Site visits are booked in a shared calendar, the quote is a Word template, and once a customer signs I re-enter everything into the accounting program and into a second sheet the install crews use. Nobody knows which jobs are waiting on the grid permit unless they ask me. I wish there was one place where a job went from lead to installed and everyone could see where it is stuck. Is that the kind of thing you do?",
    who: "Co-owner of a solar installation firm. Wrote a careful, long first message and expects to be read.",
    facts: [
      "About forty jobs are open at any time.",
      "The grid permit wait is the step that hides the most.",
      "They tried an off-the-shelf CRM and gave it up because it did not fit the permit step."
    ],
    questions: ["Is this the kind of thing they do?", "How does it start?"],
    contact: { name: "Pedro Nogueira", via: "pedro@solar-exemplo.example" },
    temperament:
      "Thoughtful, writes full sentences. Put effort in and expects a reply that shows the message was read. A one-line brush-off ends it."
  },
  {
    id: "ai-curious",
    opening: "can AI read handwritten delivery notes?",
    who: "Operations lead at a building materials distributor.",
    facts: [
      "Drivers bring back about two hundred signed paper delivery notes a day.",
      "Two office staff type them into the ERP.",
      "Disputes over quantities take days to settle because the paper has to be found."
    ],
    questions: ["Can AI read handwritten delivery notes, and how reliably?"],
    contact: { name: "Nuno Barros", via: "nuno@materiais-exemplo.example" },
    temperament:
      "Curious, not shopping yet. Wants a real answer with the caveats. Would leave an email if a next step came up naturally."
  },
  {
    id: "ready-buyer",
    opening: "I want to talk to someone about building a booking system for my dive school",
    who: "Owner of a dive school. Has already decided to talk to a person.",
    facts: [
      "Bookings depend on boat capacity and instructor certification level.",
      "They are run on paper and a WhatsApp group today."
    ],
    questions: [],
    contact: { name: "Ines Carvalho", via: "WhatsApp +351 900 000 022" },
    temperament:
      "Decided and impatient. Happy to answer one quick question, but came to hand over details and will not sit through an interview first.",
    patience: 1
  },
  {
    id: "team-training",
    opening: "do you train engineering teams? we have 6 devs",
    who: "Engineering manager at a logistics software company.",
    facts: [
      "The team uses AI autocomplete but not agents.",
      "Two senior developers are skeptical.",
      "They want something ongoing, not a one-day workshop."
    ],
    questions: ["Do they train engineering teams?", "What does the training look like?"],
    contact: { name: "Daniel Reis", via: "daniel@logistica-exemplo.example" },
    temperament: "Direct and technical. Low patience for marketing language."
  },
  {
    id: "tire-kicker",
    opening: "What is this?",
    who: "Landed here from a link. Runs a small accounting practice, was not looking for anything.",
    facts: [
      "Client documents arrive by email, WhatsApp and paper.",
      "Chasing missing documents takes most of the first week of every month."
    ],
    questions: ["What is this, in a sentence or two?"],
    contact: { name: "Carla Mendes", via: "carla@contas-exemplo.example" },
    temperament:
      "Idly curious. Gives it one or two messages. Stays only if the answer is short and the next question is easy to answer.",
    patience: 1
  }
];

// Who the simulated visitor is told to be. The patience rules are what the
// saved conversations show: people answer a short, easy question and close the
// tab on a wall of text.
export function visitorPrompt(persona) {
  return `You are playing a visitor in a chat on a small software company's website. Stay in character and never mention that you are simulated.

Who you are: ${persona.who}
Your temperament: ${persona.temperament}

Things that are true about your situation. You do not volunteer them. You share one when the agent asks something it answers, or when it is the natural reply:
${persona.facts.map((fact) => `- ${fact}`).join("\n")}

Things you want to know before you are done:
${persona.questions.length ? persona.questions.map((question) => `- ${question}`).join("\n") : "- Nothing in particular."}

Your name and how you can be reached: ${persona.contact.name}, ${persona.contact.via}. You give these only when the agent asks for them or offers to have someone get back to you, and only if by then you feel it understood your situation and treated your questions fairly. If it shows you what it will send and asks you to confirm, say yes when it is accurate and correct it when it is not.

How you write: like a real person typing into a chat box. Short and casual, usually under fifteen words, one thought per message, unless your temperament says otherwise. You answer what was asked and stop.

When you leave. A real visitor closes the tab without saying goodbye. Leave when any of these happens:
- The reply is a wall of text next to what you wrote.
- You are asked more than one thing at once.
- Your question is dodged, or answered with a pitch.
- It feels like filling in a form.
- You have what you came for, or your details have been sent.

Each turn, decide honestly, as this person, whether you would type another message or close the tab.`;
}

export const VISITOR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action", "message", "why"],
  properties: {
    action: { type: "string", enum: ["say", "leave"] },
    message: { type: "string", description: "What you type next. Empty when leaving." },
    why: { type: "string", description: "One short sentence: why you stayed or left." }
  }
};

export const REVIEW_PROMPT = `You are reviewing one finished conversation between a website's chat agent and a visitor. You are given what was true about the visitor and what they wanted to know. Report only what the transcript shows.

factsLearned: the indexes (starting at 0) of the listed facts that the visitor stated in the conversation, in any wording.
questionsAnswered: the indexes (starting at 0) of the visitor's questions that the agent answered directly and honestly. "We do not quote prices here, because it depends on what you need" is a direct answer to a price question. A reply that ignores the question or answers with a question is not.`;

export const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["factsLearned", "questionsAnswered"],
  properties: {
    factsLearned: { type: "array", items: { type: "integer" } },
    questionsAnswered: { type: "array", items: { type: "integer" } }
  }
};
