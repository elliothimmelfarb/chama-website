# Design direction: chamainteligente.com rebuild (2026-11-16)

This is the design the rebuild follows. Builders read it with `build-brief.md` (what must be true), `brand-language.md` (the words) and `architecture.md` (the engine, adopted). Where this file names copy, the copy comes from `brand-language.md`; anything here that is not in that file is a layout placeholder for the lead to replace.

Mockups next to this file, each one self-contained (fonts inlined, zero requests):

| File | Shows |
|---|---|
| `mockup-home.html` | Home first screen, stage (beat 4 still) and the three doors. Add `?theme=dark` or `?theme=light` to force a theme. |
| `mockup-chrome.html` | The phone menu (`?state=menu`), the Talk to us sheet (`?state=talk`), the desktop Display popover (`?state=desk`) and the desktop Talk panel (`?state=desktalk`). |
| `mockup-low-motion.html` | The same home in low motion: still ground, stage as a stepper, the hairline between worlds, and the proof chart. |

Screenshots of all three at 364x610 (text at 106.25%) and 1440x900, light and dark, are in `design-shots/`.

---

## 1. The design read and the dials

**Reading this as:** a redesign that preserves an established world, for referred business owners on a phone, with a calm, quietly confident language, leaning toward what the site already is: paper and ember, WebGL grounds that blend one into the next, and drawn line figures, now rebuilt on tokens with both themes designed and far fewer words on screen.

The current site is the evidence, not something to replace. People praise it for three things: the scroll-driven worlds, the paper with its contours, and the burn between sections. The first two stay. The burn was retired on 2026-11-16 (Elliot: "it doesn't fit anymore"): it belonged to the flame persona the rebuild dropped, it was the loudest thing on a calm site, and steering words around its fire line caused most of the empty scroll and the late words on a page change. One ground now blends softly into the next. What changes is everything that made it crowded or inconsistent: worlds that flipped the page between light and dark, a second accent colour (blue on the grid), long paragraphs, a header that could not hold the pages, and a chat with a character.

| Dial | Value | Why |
|---|---|---|
| DESIGN_VARIANCE | 6 | Asymmetric, left-anchored type with figures to the right on desktop; one column on the phone. Not playful, because the tone is calm. |
| MOTION_INTENSITY | 6 in full motion, 2 in low motion | Motion explains (the stage, the loop, the figures). Nothing loops forever except the slow ground. |
| VISUAL_DENSITY | 3 | Each screen holds one idea: a heading, at most one short paragraph, one figure or one action. Depth opens on request. |

**Grammar.** Chaptered worlds: each section is a world on one of four grounds, pinned while its figure plays, and handed to the next by a soft blend of grounds. Hard rules that follow from it: the ground changes only between sections; a section never changes theme; the rail on the right is the progress readout.

**Signature move (new): the doors catch.** The opening stage ends by collapsing its whole picture into three small glyphs (the rings, the spiral, the devices), which drop into the three door rows directly below and become their icons. The visitor watches the explanation turn into the navigation. The door glyphs in the mockup are those end frames.

---

## 2. Type

### Families and files

Two families from one superfamily, both SIL Open Font License 1.1, self-hosted as variable woff2, Latin subset (which covers Portuguese for later).

| Role | Family | File | Size |
|---|---|---|---|
| Display: headings, door titles, stage words, cycling phrases | Funnel Display, variable 300 to 800 | `assets/fonts/funnel-display-latin-wght.woff2` | 17.7 KB |
| Text: body, UI, captions, numbers | Funnel Sans, variable 300 to 800 | `assets/fonts/funnel-sans-latin-wght.woff2` | 17.4 KB |
| Text italic, only if a quote needs it | Funnel Sans Italic, variable | `assets/fonts/funnel-sans-latin-wght-italic.woff2` | 19.0 KB |

Total 35 KB, or 54 KB with the italic. Source: the `@fontsource-variable/funnel-display` and `@fontsource-variable/funnel-sans` packages (copy the files and the OFL text into the repo; never link them). Preload only Funnel Display, because it paints the H1 (the LCP element). `font-display: swap`, with a fallback stack of `"Helvetica Neue", Arial, sans-serif` and `size-adjust` tuned so the swap does not reflow the H1 by more than one line.

Why Funnel: it keeps the neo-grotesk calm the site already has in Helvetica Neue (which only rendered on Apple devices), but has its own voice in the a, y and g, reads warm at display sizes and stays plain at 15px. It is not on any of the default lists. Builders check `font-variant-numeric: tabular-nums` against the files; if Funnel Sans lacks `tnum`, numbers in figures are right-aligned instead.

### The scale

Root is 100% so the visitor's text size scales everything (Elliot's phone is at about 106%, so 1rem is about 17px there). Every size is in rem.

| Token | Family, weight | Size | Line height | Tracking | Used for |
|---|---|---|---|---|---|
| `--t-display` | Display 600 | `clamp(2rem, 1.15rem + 4vw, 4.5rem)` | 1.02 | -0.03em | The H1 on every page. 35px on Elliot's phone, 72px at 1440. |
| `--t-h2` | Display 600 | `clamp(1.625rem, 1rem + 2.6vw, 3rem)` | 1.08 | -0.025em | Section headings. |
| `--t-h3` | Display 600 | `clamp(1.125rem, 1rem + 0.5vw, 1.375rem)` | 1.15 | -0.015em | Door titles, objection questions, menu rows. |
| `--t-stage` | Display 500 (600 for the live phrase) | `clamp(1.0625rem, 0.95rem + 0.5vw, 1.25rem)` | 1.3 | -0.01em | Words inside the stage and the loop. |
| `--t-lead` | Sans 400 | `clamp(1.0625rem, 1rem + 0.2vw, 1.1875rem)` | 1.5 | 0 | The one paragraph under a heading. |
| `--t-body` | Sans 400 | 1rem | 1.5 | 0 | Body, disclosures, chat messages. |
| `--t-small` | Sans 400 or 500 | 0.875rem | 1.4 | 0 | Captions, door lines on phone, footer. |
| `--t-label` | Sans 600 | 0.8125rem | 1.2 | 0.01em | Control labels, figure station labels. Sentence case, never uppercase-tracked. |
| `--t-fine` | Sans 400 | 0.75rem | 1.4 | 0 | The chat's privacy line, axis ticks. Never smaller. |

Rules: measure 46ch for leads, 65ch maximum for any running text; headings use `text-wrap: balance`; more space above a heading than below it; no eyebrows or kickers above headings anywhere (the descriptor line on the home page is a sentence the visitor reads first, not a label, and it is the only small line above an H1 on the site). Figure labels inside SVG never render below 12px at any width (set them in HTML over the figure, or size them per breakpoint, as the mockup does).

---

## 3. Colour

### Strategy

Restrained in the chrome, committed in the grounds. Ink, paper and one accent, ember, on every page in both themes. The four grounds bring the variety the old second accent tried to bring. Ember is used for: the mark, the primary button, the one live element in a figure (the marker, the refit outline, the bar), the current-page dot, and the focus ring (as `--accent-text`). It is never a background for text larger than a button, never a gradient, never a glow behind a heading.

### Semantic tokens (in `assets/tokens.css`, second layer)

Written with `light-dark()`; values below are light / dark.

| Token | Light | Dark | Job |
|---|---|---|---|
| `--bg` | `#f3f0e8` (paper) | `#161513` | Page and paper ground. |
| `--surface` | `#fbf9f4` | `#22201c` | Sheets, popovers, the chat field, menu. |
| `--fg` | `#141412` (ink) | `#f3f0e8` | Text, figure strokes. |
| `--fg-2` | `#57544d` | `#aaa498` | Secondary text, logos at rest, the H1's second half. |
| `--line` | `rgb(20 20 18 / 0.14)` | `rgb(243 240 232 / 0.14)` | Hairlines and dividers (decorative). |
| `--line-strong` | `#8a857b` | `#6b665d` | Input and control outlines (3:1 or better against `--bg`). |
| `--accent` | `#f4581f` (ember) | `#f4581f` | Fills and strokes, never small text. |
| `--accent-text` | `#b33d0b` | `#ff7a45` | Ember-coloured text and links, and the focus ring. |
| `--on-accent` | `#141412` | `#141412` | Text on an ember button, in both themes. |
| `--focus` | `= --accent-text` of the current ground | | 2px ring, 3px offset. |

**Ink on ember, not white.** White on `#f4581f` is 3.35:1 and fails AA for button text. Ink on ember is 5.50:1. The old site's white-on-ember button changes to ink-on-ember everywhere (header, field, sheet, footer).

### Ground tokens (third layer, per `[data-world]`, light / dark)

Each ground sets `--fg`, `--fg-2`, `--accent-text` and `--line-strong` for the text that sits on it. Contrast is measured against the ground's base colour and against its brightest region where text can sit (second number). Text never sits where the shader is brighter than that second value; the shader keeps those regions out of the text column, and the existing scrim covers what remains.

| Ground | Theme | Base / brightest under text | `--fg` | `--fg-2` | `--accent-text` | `--line-strong` |
|---|---|---|---|---|---|---|
| Paper contours | light | `#f3f0e8` / `#ebe6da` | `#141412` 16.20 / 14.81 | `#57544d` 6.63 / 6.06 | `#b33d0b` 5.14 / 4.70 | `#8a857b` 3.22 / 2.95 * |
| Paper contours | dark | `#161513` / `#1f1d1a` | `#f3f0e8` 16.02 / 14.76 | `#aaa498` 7.36 / 6.78 | `#ff7a45` 7.06 / 6.50 | `#6b665d` 3.20 / 2.95 * |
| Grid | light | `#e3e8ec` / `#d3dbe2` | `#0f1b26` 14.12 / 12.45 | `#3d4c59` 7.16 / 6.31 | `#a5380a` 5.37 / 4.73 | `#7d8b97` 2.83 / 2.50 * |
| Grid | dark | `#0e151c` / `#16212b` | `#e6edf3` 15.55 / 13.81 | `#9cadbc` 7.98 / 7.09 | `#ff7a45` 7.11 / 6.31 | `#4f6273` 2.91 / 2.59 * |
| Tides | light | `#dcebe7` / `#c9e0da` | `#0b2829` 12.65 / 11.23 | `#355a58` 6.20 / 5.50 | `#a5380a` 5.39 / 4.78 | `#6f8f8b` 2.86 / 2.54 * |
| Tides | dark | `#06343a` / `#0b4a4f` | `#f2fcf9` 12.86 / 9.53 | `#b4dcd4` 9.06 / 6.71 | `#ff9a6e` 6.47 / 4.79 | `#3f7c7a` 2.80 / 2.08 * |
| Ember | light | `#f3dfcd` / `#eecfb8` | `#1f120b` 14.13 / 12.33 | `#674637` 6.48 / 5.65 | `#a1360a` 5.33 / 4.65 | `#a08474` 2.92 / 2.50 * |
| Ember | dark | `#0f0b09` / `#2a140b` | `#fff4e8` 18.06 / 16.09 | `#cdb8a4` 10.25 / 9.13 | `#ff8a55` 8.41 / 7.49 | `#6e5546` 2.85 / 2.54 * |

All text pairs pass AA (4.5:1) on both the base and the brightest text region. `*` The `--line-strong` values are hairlines for figures and dividers; they are decorative. Any outline that defines a control (an input, a segmented control, a quiet button) uses `--fg-2` on grounds where `--line-strong` is under 3:1, and controls that sit on a ground always have a `--surface` fill, which carries them. Ember fills used as data (the bars) are 2.7 to 2.9:1 on the light grounds; every bar's value is also printed as text beside it, so the bar is never the only carrier of the number.

Text selection is ember with ink text on every ground. The caret is `--accent-text`. Scrollbars (where styled) use `--line-strong` on `--bg`.

---

## 4. The four grounds, in both themes

One fragment shader (`sky.js`) paints them, with a `uTheme` uniform (0 light, 1 dark) that each world function reads. Between sections the next ground rises softly through the current one from below, along a slow uneven edge about a fifth of the screen wide either side, with no scorch, rim or smoke. On a page change the new ground dissolves evenly over the old one (`uFade`). The old night and forge worlds are retired; their jobs move to tides and ember.

| Ground | Light rendition | Dark rendition | What moves (full motion) | Carries |
|---|---|---|---|---|
| **Paper contours** | Paper `#f3f0e8` with a slow topography of ink lines at 8.5% opacity, faint grain, a soft vignette, and a warm lift under the pointer. This is today's paper. | The same topography on warm charcoal `#161513`, lines in paper at 7%, grain at half strength, a faint ember warmth at the bottom edge (4%). | Contours drift at today's speed; the pointer bends them. | Home first screen and stage, About, the calm beginnings of offering pages. |
| **Grid** | Cool sky `#e3e8ec` above a horizon, identical squares running to it in perspective, a faint scan line. Today's grid, with the blue tiles that flicker changed to ink. | Blueprint night: `#0e151c` with lines in `#9cadbc` at 10%, the horizon a thin cool glow, no flicker. | The floor scrolls toward the horizon slowly; the scan line passes every 15 seconds. | Off-the-shelf software, measurement, proof, the things we build. |
| **Tides** | Pale sea foam `#dcebe7` with long slow domain-warped currents in teal at low contrast, and a few bright crest lines. | Today's Atlantic: deep teal `#06343a` with foam crests. | Currents flow; the pointer stirs them. | Coaching, belief, Talk to us at the end of a page. |
| **Ember** | Warm ash `#f3dfcd`: no flames, but heat rising as a soft ember haze in the lower third and a few drifting sparks. | Today's forge: near-black `#0f0b09`, embers rising from the bottom, a glow that grows with the figure's progress (`uHeat`). | Heat rises; sparks drift up. | The loop, the people, the Hearth, product partnership. |

Rules for every ground: text sits in the upper 60% of an ember section and above the horizon line of the grid on phone; the shader keeps its brightest features out of the text column (the `uFocus` region already does this); ambient motion pauses when the tab is hidden and drops to 30fps after 8 seconds idle (the idle throttle stays).

---

## 5. Spacing, radii and motion tokens

### Spacing

A 4px base. Tokens `--s1` to `--s9`: 4, 8, 12, 16, 24, 32, 48, 64, 96. Gutter `--gutter: clamp(16px, 4.4vw, 64px)`, which gives exactly 16px on Elliot's phone. Content max width 1500px on a 12-column grid with a 24px column gap on desktop; one column under 760px. Section vertical rhythm: `--s8` between blocks inside a world, `--s9` above a section heading on desktop, `--s7` on phone.

### Radii

One rule, followed everywhere: anything you press is a pill (`--r-pill: 999px`): buttons, the chat field, segmented controls, chips. Anything that holds content is 16px (`--r-surface`): the menu, the Display popover, the Talk panel on desktop, the photo, the video. The phone Talk sheet is 20px on its top corners only. Grounds, figures, rules and the logo strip have no radius. Nothing else gets a radius.

### Motion

| Token | Value | Use |
|---|---|---|
| `--dur-press` | 120ms | `:active` scale to 0.97 on buttons and door rows. |
| `--dur-quick` | 180ms | Hover colour, header strip fade, chip states. |
| `--dur-base` | 240ms | Popover and menu open, sheet close, disclosure open. |
| `--dur-theme` | 250ms | The theme change, a view-transition dissolve (architecture). |
| `--dur-sheet` | 420ms | Talk sheet open on phone. |
| `--dur-arrive` | 1200ms | The H1's two halves, done by 1.2s, from opacity 0.01. |
| `--rise`, `--lift` | 16px, 8px | Every arrival rises 16px; every exit lifts 8px. Both 0 under reduced motion. |
| `--dur-arrive-ui`, `--stagger-ms` | 450ms, 50ms | A timed arrival and the step between items (at most five). |
| `--dur-leave` | 200ms | A timed exit (the router's lift). |
| `--dur-swap-out`, `--swap-gap`, `--dur-swap-in` | 220ms, 120ms, 340ms | One thing replacing another in place: the cycling phrases, /build's words. |
| `--dur-carry` | 700ms | The stage's glyphs flying to the doors. |
| Page change | 200ms lift, 300ms dissolve | The words in view lift away (`LIFT`), the sky dissolves into the new page's ground (`FADE`), and the new words rise in by their place, done within 0.7s of the swap (`ENTER`). |
| `--dur-beat` | 3500ms | One stage beat. |
| `--dur-phrase` | 2800ms hold, 560ms swap | The cycling phrases. |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Everything that enters or responds. The default. |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Things that move from one place to another on screen (the stage actors, the door glyphs dropping). |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Things that leave (sheet close, outgoing phrase). |
| `--ease-spring` | `cubic-bezier(0.34, 1.45, 0.5, 1)` | Only the door arrow's 3px nudge on hover. |
| Scroll-driven | linear in `--p` | Figures read `--p` (0 to 1); easing is authored into the figure's keyframes, never added on top of scroll. |

Every transition is one of six moves, the same in scroll and in time. Arrivals are slower and longer than exits.

| Move | In scroll (screens) | In time |
|---|---|---|
| Arrive | fade up and rise `--rise`, eased out over 0.25 from `--arrive-at` (-0.6) | `--dur-arrive-ui`, `--ease-out` |
| Stagger | 0.05 per word in reading order (`--i`, written by the engine); a figure box (`.fig`) after its words, from `--fig-at` (-0.4) | `--stagger-ms` |
| Draw, then the figure's own timeline | `--p`, per the figure kit | stage beats |
| Hand off | the stage catch | `--dur-carry`, `--ease-in-out` |
| Leave | the whole world: stands `EXIT_AT` (0.12), then each part fades over `EXIT_SPAN` (0.2), `EXIT_STAGGER` (0.03) apart, lifting `--lift`; a part goes sooner only where the next words or its pin's edge would reach it, and the next world's words then come as it fades | `--dur-leave`, `--ease-exit` |
| Swap | `--in`/`--out` beats in a hold | out `--dur-swap-out` `--ease-exit`, in `--dur-swap-in` `--ease-out` after `--swap-gap` |

A page writes only `--in` (0 to 0.5) and `--out` for a beat inside a hold; never `--k`, `--i` or `!important`. Popovers and the desktop Talk panel open on `--dur-base --ease-out` and close on `--dur-quick --ease-exit`; the header's Talk pill only fades; the rail and press use `--dur-quick` and `--dur-press` on `--ease-out`.

Rules: hover effects sit under `@media (hover: hover)`; nothing animates when it was triggered from the keyboard except focus rings; content is visible by default and motion starts from an already-visible state; reduced motion (or `data-motion="low"`) keeps colour and opacity changes up to 200ms and drops all movement: under the system setting in full mode the same arrivals and exits run as fades (`--rise` and `--lift` are 0), the router fades the words in and still dissolves the sky, the H1 and /build's words fade, and the stage catch becomes a fade of the icons in place.

---

## 6. Header and footer

### The decision

Five pages, Talk to us, theme, motion and Members do not fit one row at 364px, and the two-row phone header the site has today costs about 96px of a 610px screen and collides once text is at 106%. So:

- **Desktop (1100px and wider):** one 72px row. Lockup on the left; then the five pages with full labels; then a quiet **Display** button; then the ember **Talk to us** pill. The current page is an ink pill (`--fg` fill, `--bg` text).
- **Phone and tablet (under 1100px):** one 56px row. Lockup (mark plus "Chama Inteligente" at 15px; the wordmark drops to the mark alone under 340px), the ember **Talk to us** pill, and a 40px **Menu** button (two lines, labelled "Menu" for assistive tech).
- **The menu** (phone and tablet) is a sheet that drops from the top inside 8px margins, on a `--surface` card with a light scrim behind. It holds the five pages as large rows, each with a one-line purpose; then Theme (Auto, Light, Dark) and Motion (Full, Low) as segmented controls; then a quiet "Coaching members: The Hearth" line. The current page has an ember dot after its name. Opens in 240ms with `--ease-out` (a 12px drop and fade), closes on the close button, Escape, a scrim tap or any navigation.
- **Display popover** (desktop): a 300px `--surface` card anchored under the Display button with Theme (System, Light, Dark), Motion (Full, Low) and one line: "Low motion keeps every word and figure, without the moving scenes." It is a non-modal popover (the Popover API), closes on outside click and Escape. Choosing Low reloads the page in low motion (architecture).
- **Members** moves out of the header. It lives in the footer, in the menu's last line, and as a section on /coaching.

This improves on the proposal in two ways: the phone gets one row instead of two, and the pages in the menu carry a line each, so the menu doubles as a map of the offers for someone who skipped the home page.

### Labels

| Page | Desktop and menu label | Menu line |
|---|---|---|
| `/engineering-department` | Engineering department | Software that changes when you do |
| `/coaching` | Coaching | AI fluency coaching and training |
| `/build` | Websites & apps | Websites, apps and products |
| `/work` | Work | Everything we've built |
| `/about` | About | The family behind Chama |

**"Engineering" on its own is not right.** For the referred owners this site is for (manufacturers like the stamping plant), "Engineering" names a discipline they already employ (tooling, dies, process) and reads like an engineering consultancy. "Engineering department" is the approved offer name, says it is something you get rather than a field, and fits: the desktop row measures about 760px including Display and Talk at 1100px. Menu lines are layout copy for the lead to confirm against `brand-language.md`.

### Header behaviour

The header has no background over a pinned world (words never reach it). Whenever content that is not pinned is under it (an unpinned world, every section in one column or low motion, the footer) it gains a strip in the current ground's `--bg` and a `--line` bottom border, faded in over `--dur-quick`. No blur, no glass. The rail stays on the right edge on desktop (2px line, a dot per world, ember fill to the current position) and as a 2px edge line with ticks on the phone.

### Footer

Ground: the page's last world continues into it; on a non-world page it sits on paper. Desktop: three columns. Left: the mark, "Chama Inteligente, Lda.", "Based in Lisbon, working worldwide." Middle: the five pages, then Members (the Hearth), Brand, Privacy. Right: a small Talk to us block (the cycling phrase line and the ember button), then Theme and Motion as the same segmented controls, so the settings are findable at the end of every page. Phone: the same in one column in that order, with the Talk block first. No phone number and no social icons. The only email address is info@chamainteligente.com in the small legal line (legal name, NIPC, info@), required by Portuguese e-commerce law. The footer type is `--t-small`; links underline on hover with a 3px offset in `--accent-text`.

---

## 7. Pages, sections, grounds and motion

"Pinned" means the section holds while its figure plays from `--p`, for the hold its `--h` sets (in screens times 100; 150 by default). A pinned section without enough hold never shows its words. At most three changes of ground per page, and never two within about two screens: merge short sections onto a neighbour's ground. Consecutive sections on the same ground scroll as one world with no blend. As a pinned section leaves, its words stand still and fade in place before the next section's words, rising from below, would reach them, so no stretch of scroll is bare ground (`test/shots` checks it). Every page ends with a Talk to us block and the footer.

### `/` Home

| # | Section | Ground | What moves |
|---|---|---|---|
| 1 | First screen: descriptor, H1 in two halves, sub-line, the chat field with the cycling phrase | Paper | The H1 halves arrive by CSS (first half 0 to 0.6s, second 0.4s to 1.2s, each a 12px rise and fade from 0.01). The phrase above the field cycles. Not pinned. |
| 2 | The stage (see section 11) and the three doors | Paper | The stage self-plays at 60% in view; at its last beat the doors catch their glyphs. Desktop: the stage sits in the first screen's right columns, the doors are a band under both. Phone: stage (40svh) under the field, doors as rows under the stage. |
| 3 | Proof: "Most changes are live in under an hour." The note-to-live bars, then the client logo strip | Grid | Pinned: the four bars grow in turn and are whole by 60% of the hold; each value fades in over the last third of its bar. The logos arrive inside the same pin once the bars are whole (on a phone they take the caption's place). |
| 4 | The people: the family photo, "Real people you can reach.", the line about talking to a person | Ember | The photo settles from scale 1.04 to 1 over the first 40% of the hold. On a phone it is the column's width, cropped 16:10 to the faces. |
| 5 | The belief: "We believe mastery of AI can give people more time for the things they want to do." then "More time for human things, and for each other." | Tides | Pinned. The first sentence arrives with the world; the second between 30% and 55% of the hold. |
| 6 | Talk to us | Tides | The cycling phrase. |

Test (from the architecture): after one viewport of scroll at 364x610 with 17px text, all three doors are in view. The mockup measures the third door's bottom at 1196px against a limit of 1220px, with the stage at 40svh.

### `/engineering-department`

Built to stand alone for a referral link: the first screen says what it is without the home page.

| # | Section | Ground | What moves |
|---|---|---|---|
| 1 | One-line who-we-are, H1 "Your own engineering department.", the line from D.17, Talk to us field; from 1100px the loop's finished picture beside them | Paper | H1 arrives. The next heading peeks over the fold. |
| 2 | The contrast with buying software: a software company's customers wait in line; here the engineers work only for you | Paper | Pinned. Left: a queue of small pentagons at one big square (the software company). It moves up three times (10 to 28%, 34 to 52%, 58 to 76% of the hold); each time the front one goes in and a new one joins at the back. Right: one pentagon with its own ember outline, which grows a sixth corner and refits between 20% and 32%. |
| 3 | The loop (see section 12) | Ember | Pinned for about three screens, scroll-driven, four laps. |
| 4 | The week in numbers and the measured change time: the four real examples as bars, the median, the 88% | Grid | The bars grow as on home. On this page they carry the full sentence: measured on 123 requests since 2026-09-29, median 30 minutes, 88% within an hour, all the same day. |
| 5 | The recording: a feedback note becoming a live change (muted video, poster first) | Grid | The video plays muted when 60% in view, pauses out of view, has a play/pause control; captions are HTML under it. |
| 5b | The plant's numbers in words, beside a before-and-after figure: the old system, a second app and four spreadsheets as outlines, gathered into one ember-outlined pentagon | Grid | Still. Text on the grid stands on a feathered patch of its ground (`.backed`). |
| 6 | You own it: "You own the IP. We manage it for you, and you can take it anywhere." and "what if you disappear" | Paper | A small figure: the software outline lifts out of our ring and sets down in yours. |
| 7 | Price shape and the guarantee, with a timeline beside them: the three steps of How it starts, the third in ember where the setup fee falls due, then the monthly fee as fading ticks | Paper | None. Two short lines, set large: the price shape, then the risk reversal in `--accent-text`. |
| 8 | Objections, as a disclosure list (six questions, each a `<details>` row with an h3 question and a short answer) | Paper | Disclosure opens with a height and fade over `--dur-base`. |
| 9 | How it starts, then Talk to us, with a link to this offer's group on /work | Tides | The cycling phrase. |

### `/coaching`

| # | Section | Ground | What moves |
|---|---|---|---|
| 1 | H1 "AI fluency coaching and training.", line E.25, Talk to us field | Tides | H1 arrives. |
| 2 | The coaching figure: you arrive unsure (a tangled line), a session (the mark in a ring), you leave with a direction (a straight ember line) | Tides | Pinned, centred, the figure filling its six columns. The tangle draws (5 to 35%), the ring and the mark arrive, the line runs out (42 to 64%) and its head lands at 62%; each label arrives with its part. |
| 3 | Who it is for: individuals, executive teams, engineering teams (agentic engineering training, on site or remote), coaching as a company benefit. Four rows, each opens for detail, each with a small group of dots (two, a table of five, a team of nine, a ring), one ember dot for the coach | Tides | Disclosure only; an open row's dots turn `--fg`. |
| 4 | The model-effort example | Grid | The example's figure plays with `--p` (as today, redrawn in SVG). |
| 5 | AI enablement: company policy, structure and enablement, one short section, with the three as stacked layers, enablement on top in ember | Grid | None. |
| 6 | Elliot's coaching video slot | Paper | A 16:9 frame with a poster and a play button; until the video exists, the slot holds a still of Elliot and one line, never an empty box. |
| 7 | The Hearth, the members' room, with the Members link | Ember | The Hearth screenshot (existing assets) rises 16px into place. |
| 8 | Talk to us | Tides | The cycling phrase. |

### `/build`

| # | Section | Ground | What moves |
|---|---|---|---|
| 1 | H1 "Websites, apps and products.", line C.12, Talk to us field | Grid | H1 arrives. |
| 2 | Websites built to be found: three or four real sites (Toraya Lisboa and others), drawn by `drawDevices` | Grid | Pinned. Each site arrives in a laptop and phone pair, as today. |
| 3 | Apps | Grid | Continues the same world: the next things in the device sequence. |
| 4 | Product partnership: "Have an idea? We'll build it with you, as a partner or co-founder." with ShopIntake as proof | Ember | ShopIntake's screens rise into place. |
| 5 | Talk to us | Paper | The cycling phrase. |

### `/work`

One scrolling index on paper, not pinned, no figures. Grouped under three h2s (the three offers), each entry a row: name, one line, the offer page link (with `#anchor`). Header strip on. Logos appear here at the entry, in the same mask treatment as the strip. `/built` and `/clients` redirect here with anchors kept.

### `/about`

| # | Section | Ground | What moves |
|---|---|---|---|
| 1 | H1 "A small, family-owned, AI-native business.", the photo | Paper | H1 arrives; the photo settles. |
| 2 | The family: Elliot, Annie and Rozalie, moving to Portugal in fall 2023 sight unseen, growing it together. The only page that names Rozalie | Paper | None. |
| 3 | Elliot's background and superpowers (C.15), with his background as a four-point timeline under the heading | Ember | None. |
| 4 | Partners: TLC Automation and Alves Limited Group, logos plus one line each | Grid | None. |
| 5 | The name: Chama means flame; it is said "Shama". The only page with "Shama" | Tides | The mark's flame draws itself once. |
| 6 | Talk to us | Tides | The cycling phrase. |

### Other pages

| Page | Design |
|---|---|
| `/agent` | Full-screen Talk to us: the sheet's content at full height on the paper ground, the cycling phrase as the page heading, header kept. No flame, no particles. |
| `/hearth`, the public Hearth page | Ember ground, the members' room screenshot, a sign-in button for members. The Hearth room itself stays pinned dark until its light theme is checked (architecture). |
| `/privacy` | Paper, one scrolling column at 65ch, header strip on, h2 per topic. |
| `/brand` | Paper, the mark on light and dark tiles, the palette as swatches with their hex and contrast, the two fonts as specimens. |
| 404 | The paper ground giving way to ember, "This page isn't here.", the five pages as door rows, Talk to us. The sparks game may stay if it fits the tokens. |

---

## 8. Proof, logos, the photo and the doors

### Proof

Proof is shown as measured data, not as a row of big numbers. The note-to-live chart is the centrepiece: four horizontal bars on an hour-long axis (0, 15, 30, 45 minutes, 1 hour), one per real example (a fix 14 min, a new filter 31 min, a new report 33 min, download to Excel 42 min), sorted shortest first, each labelled on the left and valued on the right in Funnel Sans 600 tabular figures. Bars are ember, 10px high on phone and 14px on desktop, square at the start and rounded at the end (5px). A caption under it gives the median and the sample in one sentence. The unnamed fallback is used until the `laMetalNamed` flag is on: "an 88-person metal stamping plant in Toronto". When it flips, the name appears in the caption and the heading does not change.

The engineering department page adds the plant's week: 19 users and about 15 changes a week, set as one sentence with the figures in `--fg` and the rest in `--fg-2`, and a small before and after figure (the systems it replaced, drawn as four document outlines and two app outlines, collapsing into one ember outline). No card grid of stats, no icons beside numbers.

### Logos

Every client and partner logo becomes a single-colour alpha mask, so one asset works on all eight ground renditions:

- Each logo is prepared once as a WebP or PNG whose alpha is the logo's ink (luminance keyed, with the threshold tuned per logo so inner detail survives; Toraya's tiger keeps its stripes, Alves keeps its gold-as-ink weight). Check every mask on paper and on blueprint night before commit.
- It renders as an element with `mask-image` and `background-color: var(--fg-2)`, changing to `var(--fg)` on hover. This replaces the `multiply` treatment, which cannot work on a dark ground.
- Sizes are optical, not equal heights: each logo gets a target area (about 1,400 square px on phone, 2,400 on desktop) with a height cap of 32px on phone and 44px on desktop, so wide wordmarks and square marks look the same weight.
- The strip is a wrapped row with 32px gaps on phone and 56px on desktop, no labels under logos, no marquee. Names are the alt text. Each client's own written yes decides whether they appear (Elliot decides; the repo no longer gates it).

### The photo

`family-2026.jpg` (2048x1804), in true colour with no filter, duotone or blend. Cropped at its natural 8:7 so Rozalie, Annie and Elliot all stay in frame; on desktop it spans 5 of 12 columns beside the words, on phone it is full gutter width above them. Radius 16px, and in dark theme a 1px `--line` inner border so its warm edge does not bleed into the dark ground. Served as AVIF and WebP at 480, 720, 960 and 1440 wide with `sizes`. On home the caption is "Elliot and Annie, in Lisbon." (Rozalie is named only on About); on About the caption names all three.

### The doors

Three rows on phone, a band of three on desktop, never cards.

- **Phone:** each row is a full-width link, 12px vertical padding, a 36px glyph, the title in `--t-h3`, one line in `--t-small` `--fg-2`, and an ember arrow on the right. Hairlines between rows and above the first and below the last. The whole row is the tap target (at least 64px tall).
- **Desktop:** one band under the first screen, a top hairline, three columns at 1.35 : 1 : 1 (the engineering department is the widest, because that is the pipeline), separated by vertical hairlines, no fill, no shadow. On hover the column's ground warms with a 6% ember wash over `--dur-quick`, the arrow nudges 3px with `--ease-spring`, and the glyph plays its small motion (the marker runs a quarter lap; the spiral straightens; the phone slides in beside the laptop).
- **Glyphs** are the stage's end frames, drawn in one 1.5px stroke with one ember part each: the rings with the business pentagon and the marker; the spiral resolving into an arrow; the laptop with an ember phone.
- **Titles and lines:** "Your own engineering department" with "Fits your process, and changes when you do."; "AI fluency coaching and training" with "When AI can do something new, so can you."; "Websites, apps and products" with "Websites built to be found."

---

## 9. The Talk to us sheet and the cycling phrases

### Where people meet it

1. **The first-screen field** (home and every offering page's first screen): the cycling phrase is the field's visible label, above a pill-shaped field on `--surface` with an ink-on-ember **Talk to us** button inside it on the right. Typing and pressing the button opens the sheet with the message already sent. The placeholder is a hint ("What do you need?"), never the label.
2. **The header pill**, on every page.
3. **Small calls to action** where someone might be ready: one line plus a quiet link ("Talk to us about yours") after the proof chart, after the loop, after the price shape, after the objections. Never more than one per screen.
4. **The closing block** of every page and the footer.

### The cycling phrases

The three phrases are "Talk to us", "Ask a question" and "Get in touch". The button label is always "Talk to us".

- Each phrase holds for 2800ms, then swaps over 560ms: the outgoing phrase rises 0.45em, blurs to 3px and fades out over 220ms with `--ease-exit`; the incoming phrase rises from 0.45em below, unblurs and fades in over 340ms with `--ease-out`, starting 120ms after the outgoing one began, word by word with a 40ms stagger.
- The phrase sits in a clipped line box of fixed height, so nothing below it moves. Its width animates between phrases over 340ms where the phrase sits inline.
- It pauses while the field has focus, while the pointer is over it, and when out of view. It stops on "Talk to us" when the sheet is open on desktop.
- Screen readers get the label "Talk to us, ask a question, or get in touch" once; the cycling element is `aria-hidden`.
- Low motion: no movement and no blur; the phrases crossfade over 200ms every 4 seconds, or stand still as one line if the visitor's system asks for reduced motion.

### The sheet

- **Phone:** a bottom sheet at 86svh with 20px top corners, a 36x4px grab handle, on `--surface` over a scrim (ink at 32% in light, black at 50% in dark). It opens over 420ms with `--ease-out` from below and closes over 240ms with `--ease-exit`; it can be dragged down to close (release past 30% of its height or with a fast flick). The header stays visible above it.
- **Desktop:** a panel 440px wide, 16px from the right, top and bottom edges, the same contents, entering 24px from the right with a fade over 320ms. The page stays readable beside it.
- **Contents, top to bottom:** the cycling phrase at 1.5rem in Funnel Display with the close button; one line, "A person reads every conversation. Leave your details and we'll reach out." (layout copy for the lead); the thread; up to two suggestion chips; the field (same as the first-screen field, button "Talk to us"); the privacy line at `--t-fine` with a link.
- **Messages:** the visitor's are ink pills on the right (`--fg` fill, `--bg` text, the tail corner squared to 6px); ours are plain text on the sheet, left-aligned with no box (a box inside the sheet would be a card in a card), links in `--accent-text` underlined at 3px. While we compose, three 4px dots in `--fg-2` breathe in sequence. No flame, no avatar, no name, no typing cursor.
- **Leaving details:** a short inline form appears inside the thread (name, and email or phone as the visitor chooses), labels above inputs, errors below in `--accent-text` with the fix. This is the only place the site asks for contact details. A plain fallback form to `/api/intake` replaces the thread when the chat is unreachable.

---

## 10. Low motion, designed in its own right

Low motion (`html[data-motion="low"]`) is a calm printed edition of the same site, not the full site with things switched off. The mockup is `mockup-low-motion.html`.

- **Layout:** one column of sections on desktop and phone, the same type, tokens and section order. Desktop keeps the two-column first screen (words left, stage right) and the door band; everything after is a centred 12-column flow.
- **Grounds:** no WebGL. Each world is its base colour with a still version of its motif drawn in CSS or a small inline SVG: paper gets a very soft top-right warmth; the grid gets a 40px square grid at 6% (as in the mockup); tides get three long curves at 8% across the top of the section; ember gets a soft warm gradient rising from the bottom at 10%. All in both themes, from the same ground tokens.
- **The hairline:** where the full site blends one ground into the next, low motion draws a 1px `--line-strong` line across the full width, 64px above the next section, so the visitor sees the world has changed.
- **The stage** becomes a stepper: the same eight scenes as still pictures, each with its words, with previous and next buttons (44px) and "4 of 8 · The loop" between them. It opens on scene 1. Arrow keys step when the stepper has focus.
- **Figures** are drawn complete (`--p` unset). The loop shows the full picture with all four stations and the four real examples as labels around the outer ring.
- **No pinning, no rail, no router,** no photo settle, no bar growth (bars drawn at their value). The chat sheet opens with a 200ms fade instead of a slide. The cycling phrases crossfade or hold.
- **Switching** from the Display control reloads in the other mode; the choice is stored (`chama-motion`) and a system reduced-motion setting picks low on a first visit.

---

## 11. The opening stage, beat by beat

One inline SVG (`site/figures/stage.js`), at most 40svh on a phone and the right five columns of the first screen on desktop (up to 560px tall). Words sit at the stage's top-left in `--t-stage`: the phrase being said is `--fg` 600, the rest of the sentence `--fg-2` 500, and words arrive a few at a time. Under it: a play/pause button and an eight-segment beat bar (the current segment fills in ember across its 3.5 seconds; tapping a segment jumps to that beat). It starts when 60% in view and no earlier than 1.4s after load (after the H1), pauses out of view, never loops, ends on a still, and has a replay button in place of pause at the end. Moving parts stay under 30.

The actors, all present from the start and reused: **the business** (an ink pentagon, the shape the site already uses), **the outline** (ember, the software), **the ring** (a dotted ellipse, the AI system), **the people** (three small ink dots), **the marker** (an ember dot with a short tail), **the devices** (a laptop and phone in outline).

| Beat | Time | Words (from brand-language) | Picture |
|---|---|---|---|
| 1. The old way | 0 to 3.5s | "Software companies have engineers, and their customers wait in line." | A large grey square (the software company) on the right. Five small pentagons queue to its left; ours is fourth. The queue steps forward once; ours does not reach the front. |
| 2. The turn | 3.5 to 7s | "Here the engineers work only for you." | The square and the queue fade to 10%. Ours steps out of line, grows to the centre, and an ember outline draws around it, close-fitting, following its corners. |
| 3. Why a small team can | 7 to 10.5s | "You talk to a person. AI does the heavy work behind us." | Three ink dots (us) appear beside the pentagon. Behind them the dotted ring draws a full circle around everything, with eight small ticks travelling along it (the AI doing the work). One dot connects to the pentagon with a short line (the person you talk to). |
| 4. The loop | 10.5 to 14s | "Tell us what you need. It gets built. You use it. You find what's next." | The ring becomes the loop: four stations appear at the top, right, bottom and left, labelled. The marker runs one lap; each station label turns `--fg` as it passes, in step with the words. (This is the mockup's still.) |
| 5. Fit | 14 to 17.5s | "Fits your process, and changes when you do." | The pentagon grows a sixth corner. The marker runs a quick lap and the ember outline refits to the new shape (dashoffset redraw), tight again. |
| 6. Breadth | 17.5 to 21s | "If it can be solved with something on a phone, a computer or in the cloud, we can do it." | The outline lifts off and draws, in turn, a laptop, a phone and a cloud, each held for a moment, then returns to the shape. |
| 7. Taught | 21 to 24.5s | "When AI can do something new, so can you." | A second, smaller pentagon (you, learning) appears to the side. A small dotted ring of its own draws around it, smaller than ours but the same kind. |
| 8. Belief, then the doors | 24.5 to 28s | "More time for human things, and for each other." | Everything settles and quiets for 1.5s. Then the picture collapses into three glyphs (the rings, the spiral, the devices), which drop with `--ease-in-out` over 700ms into the three door rows below and become their icons. The stage keeps a still of the loop at 40% opacity, with Replay. |

Words are the lead's to finalise from `brand-language.md`; these are all approved phrases. The low-motion stepper uses the same eight pictures as stills.

---

## 12. The loop figure, beat by beat

`site/figures/loop.js`, on the ember ground of `/engineering-department`, pinned for about three screens and driven by `--p` from 0 to 1. Three rings drawn as concentric shapes seen slightly from above, so the whole reads as the torus Elliot described:

- **Inner: you.** The business as an ink pentagon with a 7% fill, labelled "You".
- **Middle: the software.** An ember outline that fits the pentagon closely and refits on every lap.
- **Outer: the AI system we run.** A dotted ellipse with eight small ticks drifting along it, and four stations at 12, 3, 6 and 9 o'clock: "Tell us", "It gets built", "You use it", "What's next".
- **The marker:** an ember dot with a 40-degree fading tail, running the outer ring.

| `--p` | What happens |
|---|---|
| 0 to 0.1 | The rings draw in from the inside out (pentagon, outline, dotted ring), then the stations. The heading "Tell us what you need. It gets built. You use it. You find what's next." sits above at `--t-h2`. |
| 0.1 to 0.32 | Lap 1. The marker leaves "Tell us"; a note appears beside the station in a small `--surface` pill: "A new filter". As it passes "It gets built" the outline refits (a new facet on the pentagon's right). At "You use it" the pentagon's fill pulses once. At "What's next" the lap's time appears under the pill: "31 min". |
| 0.32 to 0.54 | Lap 2: "A fix", 14 min. The outline tightens a corner. |
| 0.54 to 0.76 | Lap 3: "Download to Excel", 42 min. A small rectangle (the export) appears inside the outline. |
| 0.76 to 0.92 | Lap 4: "A new report", 33 min. The outline grows to its fullest shape. The four laps' pills remain, stacked by the "What's next" station, as a short ledger. |
| 0.92 to 1 | The marker slows and parks at "Tell us". The line "Most changes are live in under an hour." arrives under the figure. The pin releases and the page moves on to the grid. |

On the phone the figure fills the width minus gutters, station labels are HTML at `--t-label` placed over it, and the heading sits above the figure with the pills below it rather than beside the station. Transforms, opacity and dashoffset only. The four examples are the real, measured ones.

---

## 13. Anti-patterns to avoid

Builders and reviewers check each of these. A page that has one is not done.

1. An em dash anywhere: copy, alt text, captions, comments shipped to the page, meta descriptions.
2. A second accent colour. Ember is the only accent on every ground and in both themes (the grid's old blue is gone).
3. White text on ember. Ember buttons carry ink text.
4. A section that flips the page between light and dark. Theme is global; grounds have both renditions.
5. Eyebrows, kickers or small uppercase tracked labels above headings, and section numbers.
6. Same-size cards of icon, heading and text, for the doors or anything else. Cards inside cards.
7. The hero-metric template: big numbers with small labels as proof. Proof is the measured chart.
8. Gradient text, glass or blur as decoration, glowing halos behind headings, purple or blue gradients.
9. A chat bubble floating in a corner, a flame persona, a bot avatar, a typing cursor, "Hi! I'm..." copy.
10. Placeholder text used as the field's label.
11. Logos made grey with `multiply` (vanish on dark), logos with labels under them, or a logo marquee.
12. A photo with a filter, duotone or overlay; a stock photo; a second photo of the family on home.
13. Icon-library pictograms or emoji standing in for figures. Figures are authored inline SVG in one stroke weight with one ember part.
14. Div-built fake screenshots. Product views are real screenshots or the real recording.
15. Text placed where the shader is brighter than the ground's measured text region, or text under the header.
16. Motion that gates content: anything starting at opacity 0 (start at 0.01), entrances that hide words until a scroll position, autoplay that loops forever, a stage that cannot be paused.
17. Hover-only meaning, and hover styles outside `@media (hover: hover)`.
18. A modal for the menu or the Display popover; focus traps anywhere but the Talk sheet on phone.
19. More than one call to action per screen, or a second label for the same intent ("Contact us", "Get in touch" as a button). The button is always "Talk to us".
20. Any external request: hosted fonts, CDNs, analytics, embeds. Fonts are files in the repo.
21. More than two font families, a system display face as a fallback that ships, or Inter.
22. Long paragraphs. One lead of at most about 40 words per section; more depth goes in a disclosure.
23. An email address other than info@chamainteligente.com in the footer's legal line, on /privacy and as the fallback form's last resort; a phone number; a price; "Shama" outside About, Rozalie's name outside About, or "LA Metal" while the flag is off.

---

## Notes for the lead

- The impeccable context loader ran and reported no PRODUCT.md; this direction was written from the brief, the decisions and the incumbent site instead of the interactive interview, because the brief pins the world.
- Menu lines, the sheet's intro line and the home photo caption are layout copy, marked as such above, for the lead to confirm against `brand-language.md`.
- Two things to verify in the build: Funnel Sans's tabular figures, and the per-logo alpha masks on all eight ground renditions.
