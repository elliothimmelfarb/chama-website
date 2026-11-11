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
