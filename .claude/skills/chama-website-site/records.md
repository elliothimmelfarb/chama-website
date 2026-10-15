# Session records

How a coaching session becomes a record in the Hearth, and what Elliot corrected on the first ones.

## The mechanics

- Wispr Flow keeps meeting transcripts in `~/Library/Application Support/Wispr Flow/`: the `Meetings` table of `flow.sqlite` (title, start, Wispr's own summary) and `meetings/<id>/refined.ndjson`, one line per utterance with a numbered speaker. Speaker 1 is usually Elliot's mic. Merge consecutive lines into `Name: text` before attaching.
- A crafted record: `add_transcript` with `draft: true` (no model, no mail), then `set_record_figure` per picture, `set_record`, `set_record_cards`. None of them email the member; the invite does. Session 1 for the first client was 2026-10-13, session 2 on 2026-10-15.
- A whole transcript is too big to pass through a tool call by hand. Call the MCP endpoint directly instead: JSON-RPC `tools/call` to `https://chamainteligente.com/mcp` with `Authorization: Bearer` and the key from the Keychain (`chama-hearth-api-key`), and the arguments read from a file.
- To read a past record whole (figures and cards included), query `transcripts`, `record_figures` and `recall_cards` directly (see `hearth.md`).
- Figures render at about half size on a phone (600-unit viewBox in a ~375px column). Draw at 600 wide with body text at 17 or more and labels at 14 or more, and check them as PNGs with `qlmanage -t -s 900` before uploading. Colours: paper `#ebe6da`, card `#f3f0e8`, ember `#f4581f`, dark ember `#c2410c`, ink `#141412`, muted `#66635c`.
- To see a record as the member sees it without signing in: run the PGlite harness (`hearth.md`), seed the member and copy the record's rows from production into it, and open `/login/<token>` then `/hearth/transcripts/<id>`.

## What Elliot corrects

- Every prompt in the record practises what the session teaches. Short "I need" prompts that say the outcome and why, with no steps and no spec. A prompt that tells Claude what to build, or how, gets rewritten.
- Carry Elliot's reasoning, not the surface of what was said. Each idea states why it's true, at the level he'd explain it. When he reframes an idea, the figure changes with it.
- His spoken corrections steer the meaning. Don't echo his speech-to-text wording, and an edit should not make a passage longer.
- The end stays lean: no prep homework he didn't assign, short "From Elliot" lines, and only what he actually committed to (not "I might look at that").
- No stacked phrases. "Own this end to end" on top of an outcome is extraneous where the outcome already says it.
- Build on the last record; don't reuse its shape or lean on it. The sessions are one corpus, each adding its own ideas. Open with this session's through-line, not with "last time", and don't praise the previous session or keep pointing back at it. Filling the old chapter shapes with new material reads as a repeat.
- Check every factual claim against the transcript, including small framing ones like when the client did something. A plausible detail that wasn't said gets caught.
- Match the session's energy. When the session is about asking for more, the record shouldn't drift into caution, hedges and trimming. Applying "keep it lean" is not a reason to make it safer.
- Keep his prompts close to how he said them out loud, messy wording and all. They are his speech-to-text prompts, and paraphrasing loses the hype and the exact asks. Include every prompt he built live with the client.
- "Moving right" is not "say why instead of what". The far-right ask is still a what: what you're trying to accomplish, not the thing you'd build to get it ("I need a better visual way to interact with this data", not "build me a UI that shows these one by one"). Don't repeat "say why you need it".
- Use his words for his ideas ("unhappy", not "confused"; "what, not how").
- In a what-versus-how contrast, the "how" side is process prescription (plan, then sub-agents, then phases), not a vaguer version of the same ask.
- Name the box the model checks. "Please verify X" makes the box "I did the check"; "we need X to be true" makes it "X is true", so it does more work. Not "more per prompt".
- It's the newest Claude models that balk at expanding their own permissions. Elliot's answer is stages: a plan first, which it will write and then carry out where it wouldn't act in one shot, and the plan can be changed.
- The context cascade ends with the conversation, not the prompt.
