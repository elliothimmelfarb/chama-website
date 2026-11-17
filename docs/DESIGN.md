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

Restrained in the chrome, committed in the grounds. Ink, paper and one accent, ember, on every page in both themes. The four grounds bring the variety the old second accent tried to bring. Ember is used for: the mark, the primary button, the one live element in a figure (the marker, the refit outline, the bar), the current-page dot, and the focus ring (as `--accent-text`); and, at 12 to 22% on the ground, the tint inside the software's outline and the warmth of an owned business. It is never a background for text larger than a button, never a gradient, never a glow behind a heading.

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

All text pairs pass AA (4.5:1) on both the base and the brightest text region. `*` The `--line-strong` values are hairlines for figures and dividers; they are decorative. Any outline that defines a control (an input, a segmented control, a quiet button) uses `--fg-2` on grounds where `--line-strong` is under 3:1, and controls that sit on a ground always have a `--surface` fill, which carries them. Ember fills used as data (the change-time dots) are 2.7 to 2.9:1 on the light grounds; the counts are also printed as text beside them, so colour is never the only carrier of the number.

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

Home says, in order, who we are, what we believe and want for you, what we can do, who we have done it for, how we work, and who we are as people (2026-11-16, after Elliot asked that the home page carry the brand's beliefs, goals, values and approach, and that "Most changes are live in under an hour" and repeated lines leave it). Each line is said once on the page. The change time is said on `/engineering-department` only.

| # | Section | Ground | What moves |
|---|---|---|---|
| 1 | First screen: descriptor, H1 in two halves, one sub paragraph, the chat field; the stage beside it (desktop, columns 7 to 12) or under it (phone); the three doors and the "also" line under both | Paper | The H1 halves arrive by CSS (first half 0 to 0.6s, second 0.4s to 1.2s, each a 12px rise and fade from 0.01). The phrase above the field cycles. The stage self-plays at 60% in view; at its last beat the doors catch their glyphs. Not pinned. |
| 2 | What we believe: Elliot's sentence as the heading, "We help you make money, save money and stay compliant, while you enjoy your business more and do things with it you couldn't before." under it | Tides | Pinned, `--h` 180, split frame. The business is drawn from nothing (arrive, draw), then its ember fit draws one side at a time, each side one of the five reasons, called out beside it (desktop) and lit in the line under the heading as it draws (the three must-haves in ink, the two hopes in ember). It lands warm. |
| 3 | What we can do, then day one: "We can solve any software problem." / "We take on things we haven't done before.", then "Every new AI capability is ours on day one." / "AI is levelling up fast..." | Grid | Pinned, `--h` 220, split frame, one `.slot` whose two beats take turns (the first leaves by 0.5 of the hold, the second arrives from 0.5). The business continues from the belief at the same size and place, whole and warm. A shape it has never seen arrives dashed, its fit draws and it turns solid ("Something new"); then a step grows up under both and they rise on it together ("Day one"). |
| 4 | Who we have worked with: the heading, the plant line (a link to `/engineering-department`; it names LA Metal only behind `SITE.laMetalNamed`), "Everything we've built" to `/work`, and the client logos: on desktop a list beside the words, one to a row between hairlines at twice the strip's size, on a phone the strip | Grid | Not pinned. |
| 5 | Done for you, and taught: the heading and #5 without "superpowers" | Ember | Pinned, `--h` 180, split frame. The business arrives drawn but without its fit. One person stands to its left. Their first path reaches its top and the marker runs on round it, drawing the fit ("Done for you"); the second reaches the ground in front of it and its marker draws a solid ring of the business's own ("Taught"). It lands warm. |
| 6 | Real people you can reach: the heading, About us, the family photo with its caption | Ember | Pinned, `--h` 140, split frame flipped (photo left). The photo settles from scale 1.04 to 1 over the first 40% of the hold. On a phone it is the column's width, cropped 16:10 to the faces. |
| 7 | Talk to us: "What do you need?" and the field | Ember | The cycling phrase. Ember, not tides, because a fourth change of ground would break the rule above. |

Test (from the architecture): after one viewport of scroll at 364x610 with 17px text, all three doors are in view. The mockup measures the third door's bottom at 1196px against a limit of 1220px, with the stage at 40svh. Since 2026-11-16 the stage is 46svh and the sub one paragraph, and the check still holds.

### `/engineering-department`

Built to stand alone for a referral link: the first screen says what it is without the home page.

"Most changes are live in under an hour." is said once on this page, as the numbers heading (`SITE.changeTime`), where the evidence for it stands. The contrast, the loop and the numbers share one figure box (480 by 340) in the same cell, so the business the contrast draws is the one the loop carries on, at the same size and place. Nothing is said twice on the page: the loop is shown once, and each answer lives in one place.

| # | Section | Ground | What moves |
|---|---|---|---|
| 1 | One-line who-we-are, H1 "Your own engineering department.", the line from D.17, Talk to us field; from 1100px your business beside them, standing still with its software round it (the loop is shown once, in its own world) | Paper | H1 arrives. Not pinned. |
| 2 | The contrast with buying software: a software company's customers wait in line; here the engineers work only for you | Paper | Pinned, `--h` 190, two acts. Act one, large: five customers queue at a grey block with a doorway; the line moves up twice (10 to 22%, 24 to 36%), the front one going in and a new one joining at the back. Then the camera moves on (36 to 46%): the block and its queue step back to stand behind, centred, at half size and dimmed, and "Yours" arrives in front of them at full size (40 to 60%), drawn from nothing, with three engineers to its right and a line to the one you talk to. On a phone the picture sits between the heading and the lead. |
| 3 | The loop (see section 12) | Ember | Pinned, `--h` 320, scroll-driven, four laps. The business arrives already drawn, where the contrast left it. |
| 4 | "Most changes are live in under an hour.", the plant's lead, and the summary of every measured request: one dot per request on one sheet, in the order they went live, the 88% within the hour in ember, the rest of the same day in ink | Grid | Pinned, `--h` 170. The sheet arrives with the words, already holding a grey dot for every request; the ember rows fill in turn from the left, whole by 44%, then "88%" in ember and "Every one the same day". The caption's first sentence stands under the lead. No label says "within the hour", because the heading does. It does not repeat the loop's four requests. |
| 5 | What the plant's software replaced and the plant's week, beside a before-and-after figure: an old system's window, a second app and four spreadsheets in a pile, gathered into one warm business. Then the recording: a feedback note becoming a live change (muted video, poster first) | Grid | Still, not pinned. The video plays muted when 60% in view, pauses out of view, has a play/pause control; captions are HTML under it. Text on the grid stands on `.backed`. |
| 6 | You own it: "You own the IP. We manage it for you, and you can take it anywhere." (what happens if we stop is the first question owners ask, further down) | Paper | Pinned, `--h` 160, figure on the left. The software's outline is drawn round the copy we run on our platform, behind, then lifts out and flies to your business on yours, in front, its shadow shrinking in the air; it lands at 60 to 70% and your business warms. |
| 7 | Price shape and the guarantee, set large, then how it starts across the page: your old system as a hatched band until the third step, where you switch it off and the setup fee falls due (an ember tag), then the monthly fee as fading ticks. Then the objections, as a disclosure list beside their sticky heading | Paper | None. The timeline runs down the column on a phone. Disclosures open with a height and fade over `--dur-base`. |
| 8 | Talk to us, with a link to this offer's group on /work | Tides | The cycling phrase. |

### `/coaching`

Every world is a `.frame`; two are pinned, each for a figure that moves.

| # | Section | Ground | Layout | What moves |
|---|---|---|---|---|
| 1 | H1 "AI fluency coaching and training.", line E.25, Talk to us field, and beside them (under them on a phone) the session figure | Tides | split, a screen tall | The figure is whole from the first paint: a tangled line runs into the session (the mark on a lit coin, on its platform, a dotted ring round it), goes once round it in ember and leaves rising to the top right, with "Where you are", "A session" and "Where you're going" on their parts. Once, in time, a point travels the line into the session and out along the ember while the ring turns a little; low and reduced motion leave that out. As the page scrolls, the figure fades before it reaches the header. |
| 2 | "Time with someone who knows AI deeply and makes it simple." with its lead, then Who it's for: four rows, each opening for detail, each with a small group of dots (two, a table of five, a team of nine, a ring), the coach's dot in ember | Tides | pair, not pinned | Disclosure only; an open row's dots turn `--fg`. |
| 3 | Each new model can do more: thinking effort, then and now | Grid | split, pinned 180 | Two grooves with four notches. The older models' ink knob sits at extra high; the current models' ember knob slides to medium (0.12 to 0.44 of the hold), leaving a dashed ghost, and lands with a small settle as "Medium" lights. Whole by 0.56. |
| 4 | AI enablement: policy, structure and enablement as three slabs, enablement on top in ember and warm, labels on each slab's edge | Grid | split, mirrored, not pinned | None; the stack fades before it reaches the header. |
| 5 | The Hearth, with the Members link: six sessions on a line, each with its record below it on alternating rows, the latest in ember | Ember | split, pinned 160 | Each record, a paper card, rises onto its shadow in turn (0.04 to 0.44 of the hold). |
| 6 | Talk to us | Ember | statement, not pinned | The cycling phrase. |

The video slot waits for the video; until then the page has no empty box.

### `/build`

| # | Section | Ground | What moves |
|---|---|---|---|
| 1 | The devices world opens the page: H1 "Websites, apps and products.", line C.12 and the Talk to us field stand beside Toraya Lisboa's laptop and phone (on a phone, under them), so the first screen is the same split as every frame after it | Grid | Pinned, `--h` 100 + 40 + 135 a thing. The H1 arrives; after 0.4 of a screen (`data-open`) its words Swap for the first thing's. |
| 2 | Websites built to be found (the heading over Toraya Lisboa's name), then Apps made for one business (over VSF Lead Automation's): four real things, drawn by `drawDevices` | Grid | Each thing's pictures scroll inside its screens; the next pair fades in over it and the words Swap. The pair stands on a soft floor shadow. On a phone the devices fill the column and the words sit under them. |
| 3 | Product partnership: "Have an idea? We'll build it with you, as a partner or co-founder." with ShopIntake as proof | Ember | Pinned, `--h` 140, a split frame whose words start on the devices' line, so it reads as the run's last thing on a new ground. The laptop arrives with the words; ShopIntake's phone rises in beside it in the first half of the hold. On a phone the words come first and the rig under them. |
| 4 | Talk to us | Ember | The cycling phrase. |

### `/work`

One scrolling index on paper, not pinned, no figures: the H1 with its line beside it, then the three offers. Each offer is a pair frame: its glyph and name stand sticky on the left while its rows pass on the right, so no frame is a bare list. Each row is the name, one line at body size, the logo where there is one, and the arrow; the whole row is the link (with `#anchor`). Header strip on. Logos use the same mask treatment as the strip. `/built` and `/clients` redirect here with anchors kept.

### `/about`

Nothing on this page moves with the scroll, so no world is pinned.

| # | Section | Ground | Layout | What moves |
|---|---|---|---|---|
| 1 | H1 "A small, family-owned, AI-native business." and its lead, then the family: Elliot, Annie and Rozalie, moving to Portugal in fall 2023 sight unseen, growing it together. The only page that names Rozalie | Paper | pair, mirrored: the photo stands on the right while the words scroll beside it (on a phone, words, photo, family) | The photo settles. |
| 2 | Elliot's background and superpowers (C.15), whose paragraph ends at "can now build anything, fast." (the home page says "Every new AI capability is ours on day one."), with his background as a four-point timeline under the heading, the latest point in ember. Then the partners, side by side beside their heading: TLC Automation and Alves Limited Group, each named once by its wordmark, which is the heading and the link, with where they are and one line | Ember | a pair (the heading stands while the text scrolls), then a split | None. |
| 3 | The name: Chama means flame; it is said "Shama" (the only page with "Shama"). Then "Say hello." and the Talk to us field | Tides | split; on a phone the mark sits above the words at 60% of the column | The mark is a stage: once in view, its ring draws, fills, and the spark lands with a small overshoot over a soft shadow, about 3 seconds, with a pause and play-again button. |

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

Proof is shown as measured data, not as a row of big numbers, on `/engineering-department` only (home names the plant in one line and links there). The loop's ledger names four real requests with their times (a fix 14 min, a new filter 31 min, a new report 33 min, download to Excel 42 min), and the numbers section shows every measured request as one dot, ember for those live within the hour and ink for the rest of the same day, with the counts read from `SITE.changeCaption`. The unnamed fallback is used until the `laMetalNamed` flag is on: "an 88-person metal stamping plant in Toronto". When it flips, the name appears in the lead and the heading does not change.

The engineering department page does not repeat the bars: the loop's ledger shows its four requests, and the numbers section shows all of them as one dot each (see section 7). It adds the plant's week: 19 users and about 15 changes a week, set as one sentence with the figures in `--fg` and the rest in `--fg-2`, beside a before and after figure (an old system's window, a second app and four spreadsheets in a pile, gathered into one warm business). No card grid of stats, no icons beside numbers.

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
- **Glyphs** are the stage's end frames, drawn in one 1.5px stroke with one ember part each: the rings with the business pentagon (with a 7% body) and the marker; the spiral resolving into an arrow; the laptop (with a body) and an ember phone (with the ember tint inside).
- **Titles and lines:** "Your own engineering department" with "You get what a software company has, without becoming one."; "AI fluency coaching and training" with "Time with someone who knows AI deeply and makes it simple."; "Websites, apps and products" with "Websites built to be found." No door's line repeats the stage beat its glyph comes from.

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
- **No pinning, no rail, no router,** no photo settle, no figure growth (every figure drawn whole). The chat sheet opens with a 200ms fade instead of a slide. The cycling phrases crossfade or hold.
- **Switching** from the Display control reloads in the other mode; the choice is stored (`chama-motion`) and a system reduced-motion setting picks low on a first visit.

---

## 11. The opening stage, beat by beat

One inline SVG (`site/figures/stage.js`, viewBox 400x260), about 46svh on a phone at the column's full width, and columns 7 to 12 of the first screen on desktop (the picture up to 56svh tall). Words sit at the stage's top-left in `--t-stage`: the phrase being said is `--fg` 600, the rest of the sentence `--fg-2` 500, and words arrive a few at a time. Under it: a play/pause button and an eight-segment beat bar (the current segment fills in ember across its 3.5 seconds; tapping a segment jumps to that beat). It starts when 60% in view and no earlier than 1.4s after load (after the H1), pauses out of view, never loops, ends on a still, and has a replay button in place of pause at the end.

The actors, all present from the start and reused, drawn in the figure language (section 14): **the business** (the protagonist pentagon, R 44, on its floor shadow with a lit body), **the outline** (ember, the software, 0.14 R outside it), **the ring** (a dotted ellipse on a faint platform, the AI system), **the people** (three small ink dots), **the marker** (an ember dot with a short tail), **the devices** (a laptop, a phone and a cloud in ember outline, tinted inside), **the software company** (a grey block seen from above, with a dark doorway). Each part moves on its own: no group whose transform changes holds more than three parts, so the loop collapses into the first glyph part by part.

| Beat | Time | Words (from brand-language) | Picture |
|---|---|---|---|
| 1. The old way | 0 to 3.5s | "Software companies have engineers, and their customers wait in line." | The software company, a grey block seen from above, on the right. Five small pentagons queue to its left on one shared shadow; ours is fourth. The queue steps forward once and the front one walks into the doorway; ours does not reach the front. |
| 2. The turn | 3.5 to 7s | "Here the engineers work only for you." | The block and the queue fade to 10%. Ours steps out of line and grows to the centre at the old site's scale (1.9 times), and an ember outline draws around it, close-fitting, following its corners, then settles. |
| 3. A small team | 7 to 10.5s | "A small, family-owned, AI-native business." | The business settles to its place in the ring. Three ink dots (us) appear beside it. Behind them the dotted ring and its platform draw a full circle around everything, with small ticks travelling along it (the AI doing the work). One dot connects to the pentagon with a short line (the person you talk to). |
| 4. The loop | 10.5 to 14s | "Tell us what you need. It gets built. You use it. You find what's next." | The ring becomes the loop: four stations appear at the top, right, bottom and left, labelled. The marker runs one lap; each station fills ember and its label turns `--fg` as it passes, in step with the words. |
| 5. Fit | 14 to 17.5s | "Fits your process, and changes when you do." | The pentagon grows a sixth corner. The marker runs a quick lap and the ember outline refits to the new shape (dashoffset redraw), tight again. |
| 6. Breadth | 17.5 to 21s | "If it can be solved with something on a phone, a computer or in the cloud, we can do it." | The outline lifts off and draws, in turn, a phone, a laptop and a cloud, each filling with the ember tint as it closes and held for a moment, then returns to the shape. |
| 7. Taught | 21 to 24.5s | "When AI can do something new, so can you." | A second, smaller pentagon (you, learning) appears up to the side. A small dotted ring of its own draws around it, smaller than ours but the same kind, and its own ember marker draws its own fit. |
| 8. Belief, then the doors | 24.5 to 28s | "More time for human things, and for each other." | Everything settles and quiets for 1.5s. Then the picture collapses into three glyphs (the rings, the spiral, the devices), which drop with `--ease-in-out` over 700ms into the three door rows below and become their icons. The stage keeps a still of the loop at 40% opacity, with Replay. |

Words are the lead's to finalise from `brand-language.md`; these are all approved phrases. The low-motion stepper uses the same eight pictures as stills.

---

## 12. The loop figure, beat by beat

`site/figures/loop.js`, on the ember ground of `/engineering-department`, held for two and a fifth screens (`--h` 320) and driven by `--p` from 0 to 1. Three rings, seen slightly from above, so the whole reads as the torus Elliot described:

- **Inner: you.** The business as the protagonist (section 14), labelled "You". It is the contrast's "Yours", carried on at the same size and place, so it arrives already drawn.
- **Middle: the software.** An ember outline that fits the business and refits on every lap, each time adding a corner outside the one before, so it always fits.
- **Outer: the AI system we run.** A platform with a dotted rim and four stations at 12, 3, 6 and 9 o'clock: "Tell us", "It gets built", "You use it", "What's next".
- **The marker:** an ember dot on a ring of the ground's colour, with a 40-degree fading tail, running the rim.

| `--p` | What happens |
|---|---|
| 0 to 0.08 | The business is already there. The rim fades in around it, then the stations and their names, then the marker. The heading sits beside it (above it on a phone), the ledger under the heading. |
| 0.08 to 0.27 | Lap 1. The marker leaves "Tell us". As it passes "It gets built" the outline refits with a new facet on the right, and the ledger gains its row: "A new filter, 31 min". At "You use it" the business warms once. |
| 0.27 to 0.46 | Lap 2: "A fix", 14 min. A facet at the lower left. |
| 0.46 to 0.65 | Lap 3: "Download to Excel", 42 min. A small sheet (the export) appears inside the business, and the outline makes room at the bottom. |
| 0.65 to 0.84 | Lap 4: "A new report", 33 min. The outline grows to its fullest shape. The marker slows and parks at "Tell us", and the business stays warm. |
| 0.84 to 1 | Nothing moves: the finished picture and the ledger with all four laps stand while the pin lets go. The words end on "Tell us yours"; the next section's heading says the change-time line. |

On the phone the figure fills the column, station labels are HTML over it, and the ledger sits under the figure. The lap's name is said once, in the ledger, not again in a pill on the ring. Transforms, opacity and dashoffset only. The four examples are the real, measured ones.

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
13. Icon-library pictograms or emoji standing in for figures. Figures are authored inline SVG on the five layers of the figure language (section 14): ink at one weight, the ember fit at one heavier weight, and ember only for the software, the marker and the owned warmth.
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

## 14. The frame and the figure language

Added 2026-11-16, after Elliot asked for the diagrams "seriously elevated" to the original site's polish and for no awkward empty space in any frame. The old site's pentagon spanned about half the screen and had material: a fill, a crisp outline, an ember outline that hugged it. The rebuild's figures had shrunk to a tenth of that, in one flat stroke.

**The frame.** Every world's contents sit in one `.frame` (`assets/worlds.css`): a 12-column grid under the header whose rows are centred as one group, with the words in `.words` and the figure in `.fig`. It names one of five layouts with `data-layout`:

| Layout | Desktop | For |
|---|---|---|
| `split` (default; `data-flip` mirrors it) | words 1-5, figure 6-12 | a heading, a lead, one figure that plays |
| `wide` | words 1-7, figure 1-12 under them at 48svh | timelines, charts with many labels |
| `index` | a list 1-5 that lights in turn, figure 6-12 | parallel things: offers, steps, reasons |
| `statement` | one sentence 1-10 at display size, a quiet band under it | a belief or a promise |
| `pair` | heading and lead 1-4, sticky, content 6-12 | flow worlds: lists, disclosures, long text |

No two worlds in a row use the same layout. On a phone the frame is one column, words first and the figure under them, centred under the header. The figure fills its cell: by height when the cell is wide, by width when it is tall. A figure sets `--ar` (its viewBox's width over height) and gets its size from the cell, so the protagonist's size follows the frame and is never fixed in px or vw. At 1440x900 that makes it about 220px in circumradius, the old site's scale, and about 90px on a 364px phone.

**Fill.** Words and figure together span at least 40% of the screen's height on desktop and 50% on a phone at every scroll position (the floor), and aim for 55% and 65% at the middle of a pinned world's hold, with the figure 45% tall on desktop. `test/shots/run.mjs` measures both (`test/shots/README.md`).

**The protagonist.** Your business is always the same pentagon: regular, first vertex at the top, seen slightly from above (height 0.86). The ember outline, the software, stands 0.14 of its circumradius outside it, mitred at the corners, which is the old site's hug as measured. It is drawn on five layers, back to front:

| Layer | What it gives |
|---|---|
| Floor shadow | a soft radial ellipse under it, so it stands on the ground |
| Body | a radial gradient lit from the top left, opaque, so a ring behind it is hidden |
| Ink outline | the shape, at one weight (1.75px, 1.5px on a phone) |
| Halo | the ground's own colour under the fit, so a line passing behind is cut cleanly |
| Ember fit | the software, at one heavier weight (2.5px, 2.25px on a phone) |

An owned or complete business warms: its body turns to ember at 16% on the ground (22% in dark). Only Why, Own and Approach use the warmth, so it keeps its meaning. The supporting cast (the platform, people, the marker, devices, the off-the-shelf company) is drawn in the same family; anything that holds content gets a body and a floor shadow, hairlines and rings never do. Every colour is a token in `assets/tokens.css` section 4, mixed from the ground, so both themes come free.

**Motion.** Inside a figure there is one timeline, on the world's `--p`: arrive (0 to 0.10, floor and body rise into place), draw (the ink, from the top vertex, clockwise), fit (the ember a moment behind it, the old site's lag), act (0.22 to 0.62, the figure's story), land (0.62 to 0.72, the fit settles from 1.035, end labels and the warmth arrive), then hold, still. No part or label fades in over less than 0.05 of the hold. A protagonist that continues from the world before, at the same size and place, arrives drawn and animates only what is new; a pentagon is drawn from nothing only where it first appears on a page. Labels are HTML on their part (`.fx-lb`), never a row of captions under the figure.

**Cost.** `data-p` goes on each moving leaf, or a group of at most three; a figure restyles at most 24 elements a frame (the protagonist costs five, none when it arrives drawn); only opacity, transforms, dash offset, offset distance and fill opacity change with `--p`. `site/figures/kit.js` holds the helpers and `subject()`, the protagonist; `test/figures.test.js` holds these rules, and `test/fixtures/figure.html` shows the language on the real engine.

---

## Notes for the lead

- The impeccable context loader ran and reported no PRODUCT.md; this direction was written from the brief, the decisions and the incumbent site instead of the interactive interview, because the brief pins the world.
- Menu lines, the sheet's intro line and the home photo caption are layout copy, marked as such above, for the lead to confirm against `brand-language.md`.
- Two things to verify in the build: Funnel Sans's tabular figures, and the per-logo alpha masks on all eight ground renditions.
