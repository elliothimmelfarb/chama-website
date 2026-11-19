# Design: what the site is for and what we know

This file holds the purpose, the goals, and what Elliot has decided and said about how the site looks and feels. It has no rules, sizes or timings. Those are in the code, which is the only place they are kept, and the last section says where. How to reach a goal is the designer's call.

## What the site is for

A referred business owner, usually on a phone and already somewhat warm from a personal introduction, understands within a minute what Chama sells, trusts it, finds their page and sees proof that it has been done before. Coaching clients, executives, engineering leads and founders find their door as fast. People route by what they need, not by who they are.

Elliot's measure of success (2026-11-16): more trust in first conversations, inbound sales, coaching sign-ups, and people looking at the site and thinking "these people really know what they're doing".

## What it should feel like

- **The original site is the bar for quality and polish.** It is kept at `/original`. People praised its scroll-driven worlds, its paper with contours, and how one section gave way to the next. Its figures were large and had material: a fill, a crisp outline, an ember outline that hugged the shape. On 2026-11-19 Elliot said the rebuild does not have the quality and polish the original had, and that it sits in the middle between the old site and a new one. A change here should close that gap.
- **The brand speaks calmly**, with quiet confidence: "we can solve any software problem", never "almost". Elliot said this about tone of voice (2026-11-16). Whether the visuals should be as calm as the words or as dramatic as the original's worlds is open, and it is his call.
- **Pictures do the explaining.** The original's core problem was too many words on screen at once. Each area holds a little focused text, depth opens for those who want it, and moving figures carry the ideas a few words at a time. Motion is silent and never stands between a visitor and the content.
- **Real people.** A small, family-owned, AI-native business you can reach. You talk to a person, and AI does the heavy work behind them.
- **It reads as designed by someone with taste**, not as a template or an AI default.

## What Elliot has decided, and why

- **The flame is the mark and the name, not a character.** The flame chatbot felt gimmicky, so the chat is simply "Talk to us": no persona, no avatar, no flame animation. The button always says "Talk to us" while the phrases above it cycle, because the box does several jobs and one phrase is not enough.
- **The chat is the way in.** No phone number and no email address are offered as contact. info@chamainteligente.com appears only as the legal contact, because Portuguese e-commerce law and GDPR need one. A plain form stands in when the chat is down.
- **The visitor chooses light or dark**, and both are fully designed. On the original, sections flipped the page between bright and dark on their own, and he wanted that to stop.
- **Low motion is an edition in its own right**, for people who choose it or whose system asks for it. On the original it was a stale copy of an older site.
- **The fire between sections is retired** (2026-11-16): "it doesn't fit anymore". It belonged to the flame persona.
- **Ember is the brand's colour**, with ink and paper. Ink sits on ember because white on ember measures 3.35 to 1 and fails AA for button text, while ink on ember is 5.5 to 1.
- **No prices.** The price shape and the setup-fee guarantee are stated on `/engineering-department`.
- **Proof is real and measured.** The numbers on `/engineering-department` are the plant's own measured requests. The plant is unnamed until Elliot says LA Metal can be named (`SITE.laMetalNamed`). He decides which clients and logos appear.
- **Rozalie is named only on About, and so is "Shama".** Home's photo caption names Elliot and Annie.
- **"Engineering department", never "Engineering" alone.** To a manufacturer, "Engineering" is a discipline they already employ, and it reads as an engineering consultancy.
- **Members is in the header on every page** (2026-11-18), so coaching clients see the way into the Hearth without scrolling.
- **Home says, in order,** who we are, what we believe and want for you, what we can do, who we have done it for, how we work, and who we are as people. Each line is said once. The change time is said only where its evidence stands, on `/engineering-department`, which is built to stand alone for a referral link.
- **English first**, built so European and Brazilian Portuguese can be added.

## What Elliot's reactions have shown

- Choosing from finished pictures works. On 2026-11-17 he picked from boards of samples: for openings, one continuous ember line Love, real product screens and an isometric workshop Maybe, Swiss poster shapes No. For diagrams, technical drawing Love, hand-inked and real interface fragments Maybe, soft solid objects and bold graphic No. In his words: "the hand-drawn and the technical drawing are my two favorites", "beautifully integrated", great on phone and desktop. Those picks held. Designs that went from words straight to code needed correcting afterwards.
- "A lot of awkward empty space", and diagrams that needed to be "seriously elevated" to the original's polish (2026-11-16). The rebuild's figures had shrunk to a tenth of the original's size, in one flat stroke.
- Transitions that "feel haphazard" (2026-11-16). He wants the original's consistency: one way of arriving and leaving, everywhere.
- "Amateur" and "low effort" for home's first diagrams and opening, whose text "disappears too quickly to read" (2026-11-17). Text stays up for its reading time.
- On his phone: "a lot of things bouncing up and down or weird kind of magnet points" (2026-11-17). Nothing should fight the scroll.
- 2026-11-19: this file had grown to 11,000 words of rules, sizes and timings, and he asked for truth and goals in their place, with as few rules as possible.

## Facts that are easy to miss

- Elliot's phone renders at about 364 by 610 CSS px with text at about 106%. A plain 390-wide emulator hides most of the crowding.
- Funnel Display and Funnel Sans are self-hosted, because the public pages make no external requests. They replaced Helvetica Neue, which only rendered on Apple devices.
- Every figure and ground exists twice, light and dark, so a new one is designed twice.
- The tests pin the site as built: section order, figure timing, how much of each screen is filled. A redesign changes those tests with it. They are a record of what is, not a brief for what should be.

## Where the design lives

| What | Where |
|---|---|
| Colour, type, spacing and motion values | `assets/tokens.css`, `assets/base.css` |
| The grounds | `assets/sky.js` |
| Each page's sections and words | `site/pages/`, `site/content/en/` |
| The figures and what they share | `site/figures/`, `kit.js` first |
| How worlds pin, arrive and leave | `assets/worlds.js`, `assets/worlds.css`, and the skill's `pages.md` |
| The chat | `assets/talk.js`, `assets/talk.css` |
| What is checked on every change | `test/`, and `test/shots/README.md` for the screenshot rig |
| The original site | `/original` |
| How each round went and what Elliot chose | `docs/reports/` |

The longer design specification this file replaced is in git history, last at commit `c5fae67`.
