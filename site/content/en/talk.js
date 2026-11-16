// The Talk to us sheet's own words, beyond what common.js shares with the
// field. assets/talk.js carries the same strings (a browser script cannot
// import this), and test/talk.test.js fails while the two differ. The
// /agent page's no-JavaScript fallback form can render its labels from here.
// Layout copy for the lead to confirm against brand-language.md.

export const talk = {
  composePlaceholder: "Write a message",
  composeLabel: "Message",
  composing: "Writing a reply",
  chips: ["Leave my details", "How does pricing work?"],
  confirmChips: ["Yes, send it", "Change something"],
  confirmMessage: "Yes, send it.",

  detailsName: "Your name",
  detailsContact: "Email or phone number",
  detailsHint: "Next you'll see exactly what we'll pass on. Nothing is sent until you say yes.",
  detailsSubmit: "Continue",
  detailsCancel: "Not now",
  detailsIntro: "Please get in touch.",
  detailsNameLine: "Name",
  detailsEmailLine: "Email",
  detailsPhoneLine: "Phone",
  needName: "Add your name, so we know who to ask for.",
  needContact: "Add an email address or a phone number.",
  badEmail: "That email address looks incomplete. Check the part after the @.",
  badPhone: "That number looks too short. Include the country code.",
  sent: "Your details were passed on.",

  generic: "Something went wrong on our side. Please try again.",
  busy: "The agent is busy right now. Please try again in a minute.",
  timedOut: "The reply took too long. Please try again.",
  tryAgain: "Try again",

  fallbackOffline: "Leave a message here instead and we'll reach out.",
  fallbackUnreachable: "We can't reach the chat right now. Leave a message here instead and we'll reach out.",
  fallbackName: "Your name",
  fallbackContact: "Email or phone number",
  fallbackRequest: "What you need",
  fallbackSubmit: "Send",
  fallbackSending: "Sending",
  fallbackBack: "Back to the conversation",
  thanks: "Thank you. We have your message and will reach out.",
  lastResortBefore: "That didn't go through either. Write to us at ",
  lastResortAfter: " and we'll reach out.",
};
