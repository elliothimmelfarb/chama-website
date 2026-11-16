import { isLiveSiteUrl } from "../lib/site-pages.js";

// The measurable shape of a reply: how long it is and how many questions it
// asks. A visitor who types three words and gets a hundred back stops typing,
// so these are checked mechanically and never left to a judge.

export function countWords(text) {
  const trimmed = String(text ?? "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function countQuestions(text) {
  return (String(text ?? "").match(/\?+/g) || []).length;
}

// expectReply: { maxWords: [limit or null, one per visitor message], maxQuestions }.
// replies: what the agent said in answer to each visitor message, in order.
// Returns a failure reason, or null.
export function checkReplyShape(expectReply, replies) {
  if (!expectReply) return null;

  for (let index = 0; index < replies.length; index += 1) {
    const reply = replies[index];
    const wordLimit = expectReply.maxWords ? expectReply.maxWords[index] : null;
    const words = countWords(reply);

    if (words === 0) {
      return `Reply ${index + 1} is empty.`;
    }

    if (typeof wordLimit === "number" && words > wordLimit) {
      return `Reply ${index + 1} is ${words} words; the case allows ${wordLimit}.`;
    }

    if (typeof expectReply.maxQuestions === "number") {
      const questions = countQuestions(reply);
      if (questions > expectReply.maxQuestions) {
        return `Reply ${index + 1} asks ${questions} questions; the case allows ${expectReply.maxQuestions}.`;
      }
    }
  }

  return null;
}

// Where a reply may send someone: only to pages the site serves today
// (lib/site-pages.js), and never to an email address or phone number of
// ours, since the site shows none. The visitor's own address and number,
// given in `visitorTurns`, may be repeated back to them.
const SITE_ADDRESS = /(?:https?:\/\/)?(?:www\.)?chamainteligente\.[a-z.]+(?:\/[^\s?#)]*)?/gi;
const EMAIL = /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;

function digitsOf(value) {
  return value.replace(/\D/g, "");
}

export function checkReplyLinks(replies, visitorTurns = []) {
  const visitor = visitorTurns.join("\n").toLowerCase();
  const visitorDigits = visitorTurns.map(digitsOf);

  for (let index = 0; index < replies.length; index += 1) {
    const reply = String(replies[index] ?? "");

    for (const match of reply.matchAll(SITE_ADDRESS)) {
      const address = match[0].replace(/[.,;:!]+$/, "");
      if (!isLiveSiteUrl(address)) return `Reply ${index + 1} links to ${address}, which is not a live page.`;
    }

    for (const match of reply.matchAll(EMAIL)) {
      const address = match[0].replace(/[.,;:!]+$/, "").toLowerCase();
      if (!visitor.includes(address)) return `Reply ${index + 1} gives out an email address: ${address}.`;
    }

    for (const match of reply.matchAll(PHONE)) {
      const number = digitsOf(match[0]);
      if (number.length < 9) continue;
      if (!visitorDigits.some((digits) => digits.includes(number))) {
        return `Reply ${index + 1} gives out a phone number: ${match[0].trim()}.`;
      }
    }
  }

  return null;
}
