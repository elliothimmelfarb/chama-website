# Design: what the site is for and what we know

This file holds the purpose, the goals, and what Elliot has decided and said about how the site looks and feels. It has no rules, sizes or timings. Those are in the code, which is the only place they are kept, and the last section says where. How to reach a goal is the designer's call. Where a choice was made by a session and not by Elliot, this file says so, because those are open to change.

## What the site is for

Elliot's near-term case (2026-11-16): the person who introduced LA Metal is about to refer more business owners. They need to see right away what Chama is, get some trust, find the page for their need, and see proof it has been done before. Coaching clients, executives, engineering leads and founders find their door as fast. People route by what they need, not by who they are. That these visitors are probably on a phone and already somewhat warm is Claude's reading, not something Elliot said.

His measure of success: more trust in first conversations, inbound sales, coaching sign-ups, and people looking at the site and thinking "these people really know what they're doing".

## What it should feel like

- **Quality and polish that match the original site**, which is kept at `/original`. Elliot, 2026-11-19, on the rebuild: "I'm not seeing the quality and polish that was present in the iteration that we started with", and "we're kind of in the middle", neither the old site nor fully a new one. The original's figures were large and had material: a fill, a crisp outline, an ember outline that hugged the shape. The original is the measure of polish, not a design to return to: he called it "cool but not sacred" and is "open to what's better".
- **Home's first view is what he likes on the rebuild**: "the first page is awesome" (2026-11-19). Below it fell short for him. See his reactions further down.
- **The animated scroll stays.** It is the thing visitors praise.
- **The brand speaks calmly**, with quiet confidence: "we can solve any software problem", never "almost". He said this about tone of voice.
- **Pictures do the explaining.** He named too much text as the original's core design problem: each area should hold a little focused text, with depth for those who want it, and moving images that explain the ideas a few words at a time.
- **The central picture is a loop of three rings**: you, the software around you, and around that the AI system we run. You tell it what you need, it gets built, you use it, you find what's next. This is his idea of the engineering department offer.
- **Real people you can reach**: a small, family-owned, AI-native business.
- **No AI-default looks.** The bar in his own design notes is god-tier UI and UX.

## What Elliot has decided, and why

- **The flame is the mark and the name, not a character.** The flame chatbot felt gimmicky to him, so the chat is simply "Talk to us", with no persona and no flame animation. He wants phrases cycling above it because the box does several jobs. Keeping the button's label the same while they cycle was an advisor's suggestion he approved.
- **The chat is the way in.** He called it very important that no email address or phone number is offered for contact. He allowed info@chamainteligente.com "in any other places that make sense"; the session put it in the legal line, on the privacy page and as the fallback form's last resort, because Portuguese e-commerce law and GDPR need a contact.
- **The visitor chooses light or dark**, and both are fully designed. On the original, sections flipped the page between bright and dark on their own, and he wanted that to stop.
- **Low motion is designed in its own right.** On the original it was a stale copy of an older site.
- **The fire between sections is retired** (2026-11-16). After two reviews he said "it's almost like it doesn't fit anymore", and agreed it belonged to the flame persona. It had also cost a lot: steering words around the fire line caused most of the empty scroll and the late words on a page change.
- **No prices.** Pricing is part of the conversation. The price shape and the setup-fee guarantee are stated on `/engineering-department`.
- **He decides what proof the site shows.** The plant is unnamed until he says LA Metal can be named (`SITE.laMetalNamed`).
- **Rozalie is named only on About, and "Shama" appears only there.**
- **The first offer is named "Your own engineering department".** To a manufacturer, "Engineering" alone is a discipline they already employ, which is why the header spells it out (the session's reasoning).
- **Members is in the header on every page** (2026-11-18), so coaching clients see the way into the Hearth without scrolling.
- **Home carries what we believe, our goals, values and approach, with nothing said twice** (2026-11-16). The order of its sections was the session's.
- **English first**, built so European and Brazilian Portuguese can be added.

## What Elliot's reactions have shown

- He chooses well from finished pictures, and asks for them: on 2026-11-19 he wanted options to pick from, not another build. His picks for the rest of home are in the artifact "Chama Homepage Picks". Read it before designing home below the first view.
- From boards of samples on 2026-11-17: for openings, one continuous ember line Love, real product screens and an isometric workshop Maybe, Swiss poster shapes No. For diagrams, technical drawing Love, hand-inked and real interface fragments Maybe, soft solid objects and bold graphic No. "The hand-drawn and the technical drawing are my two favorites", "beautifully integrated". The one-line opening and the pen marking the headline came from these boards and he still likes them. The pentagon diagram built in technical drawing he later said "isn't a nice quality".
- 2026-11-19, on home below the first view: the moving coloured grounds are "too much", there is too much text, the family photo is too big, and he did not connect with the line "You talk to a person, and AI does the heavy work behind us".
- 2026-11-16: "a lot of awkward empty space", and diagrams that needed to be "seriously elevated" to the original's polish. The rebuild's figures were 10 to 25% of the original's size, and flat.
- 2026-11-16: the transitions "feel haphazard". He asked for the original's consistency.
- 2026-11-17: home's first diagrams and opening felt "amateur" and "low effort", and the opening's text "disappears too quickly to read".
- 2026-11-17, on his phone: "a lot of things bouncing up and down or weird kind of magnet points".
- 2026-11-19: this file had grown to 11,000 words of rules, sizes and timings. "There's too many rules. And what I want is truth and goals."

## Facts that are easy to miss

- Elliot's phone renders at about 364 by 610 CSS px with text at about 106%. A plain 390-wide emulator hides most of the crowding.
- White text on ember measures 3.35 to 1 and fails AA for button text. Ink on ember is 5.5 to 1, which is why ember buttons carry ink.
- `--line-strong` is under 3 to 1 on the grid, tides and ember grounds, so it is only safe for decoration. A control's outline there needs `--fg-2` or a `--surface` fill.
- Ember dots used as data are about 2.8 to 1 on the light grounds, so the counts are also printed as text.
- Funnel Display and Funnel Sans are self-hosted, because the public pages make no external requests. They replaced Helvetica Neue, which only rendered on Apple devices.
- Every ground and figure exists in light and dark.
- As built, by the design session and not by Elliot: each ground was given a subject (grid for measurement, proof and things we build; tides for coaching and belief; ember for the loop, the people and the Hearth; paper for calm openings), and a business in a figure turns warm only when it is owned or complete.
- The Hearth's room is dark only because its light theme has not been checked yet.
- The tests pin the site as built: section order, figure timing, how much of each screen is filled. They record what is, not what should be, and a redesign changes them with it.

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
