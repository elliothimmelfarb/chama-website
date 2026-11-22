# chama-website

The deployable source for **https://chamainteligente.com** (and `www.`), plus the company's brand assets. This repository is public. The company's private repository, the wiki and the history of the site's copy live in `../chama-inteligente/`, which is never connected to any hosting provider.

## What is here

| File | What it is |
|---|---|
| `site/site.js` | The one list of public pages (`PAGES`: path, file, nav label, whether the router swaps it, sitemap priority and `lastmod`, `noindex`) and the facts every page shares (`SITE`). |
| `site/pages/<id>.js` | Each page as a function that returns the whole document. Small page-only styles sit in the page's own `<style>`. |
| `site/content/en/<id>.js` | Each page's words, kept apart from its markup. `common.js` holds the header, menu, footer and Talk to us words; `talk.js` the chat widget's. |
| `site/parts/` | What pages share: `chrome.js` (head, header, menu, Display popover, Talk to us field, footer, `page()`), `boot.js` (the snippet that sets theme and motion before the first paint), `logos.js` (client and partner logos). |
| `site/figures/` | The inline SVG figures, drawn from `--p`. `kit.js` holds what they share: the `--p` timing helpers, the business's irregular shape (`BUSINESS`, nine points) and its geometry, `subject()` (the business drawn flat with its ember boundary and survey ticks, and optionally growing), `ripple()` and `morph()`. `survey.js` is the first picture on `/engineering-department`, `loop.js` its loop, and `stage.js` home's opening stage. A path that changes shape carries `data-morph`, which `worlds.js` turns into its `d` wherever it writes `--p`. |
| `site/html.js` | The `html` tag every page is written with. Copy is escaped; `inline()` allows only `*emphasis*` and `[links](/path)`. |
| `site/machine.js` | `sitemap.xml`, `llms.txt` and `llms-full.txt`, built from the same pages and copy as the HTML, and the one-line company `SUMMARY` they open with. |
| `scripts/build.js` | Writes the pages, sitemap and llms files from `site/`. |
| `index.html`, `engineering-department.html`, `coaching.html`, `build.html`, `work.html`, `about.html`, `hearth-public.html`, `privacy.html`, `brand/index.html`, `agent.html`, `404.html` | The generated pages. Each starts with a comment naming its source. Never edit them by hand. |
| `assets/tokens.css` | The design tokens: primitives, the light and dark colours, and each ground's `--ground`. No colour is written anywhere else on the public pages. |
| `assets/base.css` | Type, buttons, the header with its menu and Display popover, the Talk to us field, the doors, the footer. |
| `assets/worlds.css`, `assets/worlds.js`, `assets/sky.js` | The engine. Each `<section class="world">` stands on one of four grounds (`data-world`: paper, grid, tides, ember), which one WebGL sky paints in a light and a dark palette and blends softly into the next as the page scrolls. `worlds.js` pins worlds, writes `--u`, `--e` and `--p`, plays stages, and is the router that moves between the six main pages (`inRouter` in `site/site.js`) without a full load. The `chama-website-site` skill's `pages.md` has its API. |
| `assets/chrome.js` | The Theme and Motion controls, the cycling Talk to us phrases, the header strip over scrolling sections (`data-strip`), and the recording player on `/engineering-department`. |
| `assets/talk.js`, `assets/talk.css` | The Talk to us chat: a bottom sheet on phones, a panel beside the page from 1100px wide, and the whole page at `/agent`. Every "Talk to us" button and field on every page opens it. See [The chat agent](#the-chat-agent). |
| `assets/fonts/` | Funnel Display and Funnel Sans, self-hosted, under the SIL Open Font License (`OFL.txt`). |
| `assets/media/` | The recording on `/engineering-department`: a wide and a tall cut, their posters, and `captions.json`. |
| `assets/work/` | Client and partner logos, drawn as one-colour masks so one file works on every ground in both themes. |
| `assets/built/` | The device pictures on `/build`. |
| `api/chat.js`, `api/chat-prompt.js` | The chat endpoint (same origin, SSE streaming, one tool: `send_note_to_elliot`, a visitor asking to be contacted) and its frozen system prompt, which is reviewed like copy. |
| `lib/site-pages.js` | The site's pages as the chat agent knows them: path, title, what each covers, and whether it is live. |
| `evals/` | The agent's evals (`npm run evals`, `npm run evals:conversations`). Both spend API credit and are not part of `npm run check`. |
| `api/intake.js`, `api/intake-cleanup.js` | The contact pipeline and its daily 12-month retention cleanup. |
| `api/watchdog.js`, `lib/flame-health.js` | The cron that reviews conversations and can take the chat offline, and the check that the chat can reach its model. |
| `admin.html`, `assets/admin.*`, `api/admin-auth.js`, `api/admin-data.js` | The private, read-only admin area at `/admin`. |
| `hearth-public.html` | The public page about the Hearth at `/hearth`. The Hearth itself (the members' room, its API, `/mcp` for agents and the public feed's code) lives in its own repo, `chama-hearth`, at https://hearth.chamainteligente.com. See [The Hearth](#the-hearth). |
| `docs/DESIGN.md` | What the site is for, what it should feel like, and what Elliot has decided and said about its design. Purpose and facts only: the values and layouts are in the code. |
| `original/` | The old site at `/original`, frozen as it was on `main` on 2026-11-16: its pages, low motion pages, chat page and their assets, every address moved under `/original` and a note on each page saying it is the original site. Not indexed, not in the sitemap, and not built or stamped. Its chat still calls the live `/api/chat`, so it must keep the [chat event contract](#chat-event-contract). `test/original.test.js` keeps it self-contained. |
| `vercel.json` | Headers, redirects, rewrites and cron schedules. |
| `robots.txt` | Crawler policy. `sitemap.xml`, `llms.txt` and `llms-full.txt` are generated. |
| `<64-hex>.txt` | The IndexNow key file. Do not rename or delete it. |
| `og-*.png` | Sharing cards, at the root because messengers cache them at those URLs. The current ones are `og-2026-11-16.png` (every page) and `og-ed-2026-11-16.png` (`/engineering-department`), rendered from `brand/og/og-2026-11-16.html` and `og-ed-2026-11-16.html` with `sh brand/og/render.sh <out.png> <source.html>`; `/hearth` keeps `og-hearth-2026-10-22.png`. Older cards stay for links already sent. |
| `brand/kit/` | The media kit's files, linked from `/brand` and `llms.txt`. Rebuild with `sh brand/kit/build.sh` after the mark changes. |
| `brand/` | Logo sources and exports, banners, avatars. See `brand/mark/README.md`. |

## How the pages are made

Vercel runs no build. `npm run pages` writes every page, `sitemap.xml`, `llms.txt` and `llms-full.txt` from `site/`, then stamps them (see [Caching](#caching)), and the generated files are committed. `test/build.test.js` fails while any committed file differs from what the build makes, so what is committed is what is deployed. `node scripts/build.js --out <dir>` builds into another folder, unstamped, for a preview.

To add a page: an entry in `PAGES` in `site/site.js`, its source in `site/pages/<id>.js` (export `render(page, site)`, and `text()` for its words in `llms-full.txt`), its copy in `site/content/en/<id>.js`, a line in `lib/site-pages.js` with `live: true`, then `npm run pages`. A `nav` label puts it in the header, menu and footer, and `inRouter: true` lets the router swap it (add it to `PAGES` in `worlds.js` too; the test checks they agree). In the same change as any page's copy, bump its `lastmod`. A new page is a new public surface, so it is Elliot's call.

**Theme.** `html[data-theme="light"|"dark"]` when the visitor chose one, otherwise the system's. **Motion.** `html[data-motion="low"]` when the visitor chose low or the system asks for reduced motion and they have not chosen full. Low motion is the same page, designed in its own right: no pinning, no router, no autoplay, every figure complete, stages as steppers. `site/parts/boot.js` sets both before the first stylesheet, from `localStorage` (`chama-theme`, `chama-motion`), so the first paint is already right, and adds `html.pin` (the pinned layout) when there is room for it.

## Copy and brand

Copy is written in `site/content/en/`, in the approved brand language (the brain's `strategy/2026-11-16-brand-reframing/brand-language.md`). The brain keeps the history of the copy and the reasons for each change in `wiki/topics/website-content-chamainteligente-com.md`. Elliot decides what the site newly says and shows, including which clients are named and which logos appear.

`test/site.test.js` holds these on every built page:

- No em dash, no price, and no phone or WhatsApp link.
- The only email address is `info@chamainteligente.com`, in the footer's legal line (and the JSON-LD), on `/privacy`, and in the chat as its last resort when even the plain form fails. The chat agent itself gives out none.
- These retired lines never come back: "Your process, your words, your rules", "Your business, your rules", "whenever you ask", "intelligent flame is", "shrink-wrapped", "almost any".
- "Shama" and Rozalie are named only on `/about`.
- LA Metal is never named while `SITE.laMetalNamed` in `site/site.js` is `false`. Flipping it is Elliot's decision; `/`, `/engineering-department` and `/work` then switch to the name.

## Work, logos and /build

`/work` is one index of everything we have made, grouped by offer, in `site/content/en/work.js`. Logos are in `CLIENTS` and `PARTNERS` in `site/parts/logos.js`: a transparent image in `assets/work/` whose opaque pixels are the mark, with its natural width and height so every logo gets the same optical weight. `CLIENTS` is the strip on `/` and the logos on `/work`; `PARTNERS` are on `/about`.

`/build` shows each thing's real pages scrolling inside a laptop and a phone (`site/figures/devices.js`, `drawDevices` in `worlds.js`); the page opens on them, with the H1 beside the first thing's pair. Each picture is a tall capture in `assets/built/` (`<name>-desktop*.webp`, `<name>-phone*.webp`) with resized copies; `SHOTS` in `devices.js` lists each one's widths and full height, and `PICTURES` in `site/pages/build.js` maps a thing to its pictures. Private work shows seeded demo data, never real records.

## Redirects

`/built`, `/clients` and every `/simple` address redirect to their new pages (`vercel.json`; `test/site.test.js` checks each lands on a real page in one step). They went live as temporary (307) on 2026-11-16, so a mistake could be undone without browsers remembering it. From 2026-11-23, if nothing needs undoing, make them permanent: set `"permanent": true` on every `/built*`, `/clients*` and `/simple*` entry (leave `/hearth-public`, which is temporary on purpose), merge, and check with `curl -sI https://chamainteligente.com/simple` that it answers `308`.

## The chat agent

The chat is the "Talk to us" sheet, not a character. Its code, logs and watchdog still say "flame" in places.

### What it is for, and how that is measured

The chat is how people reach us. A conversation has gone well when every question the visitor asked got a straight answer, we know what they need, and, if they want to hear from us, they left a name and a way to be reached and confirmed it. The prompt (`api/chat-prompt.js`) speaks the brand language and claims nothing that is not there or on the site. Its replies are sized to the visitor's last message.

### The widget

`assets/talk.js` keeps one conversation per page load. The sheet lives outside the `<main>` the router swaps, so the conversation survives moving between pages. On a phone it is modal and sits above the keyboard; from 1100px wide it is a panel beside the page. Without JavaScript every "Talk to us" button is a link to `/agent` and every field a GET form to `/agent?q=`, which opens the chat with that message, and `/agent` has a `<noscript>` form that posts to `/api/intake`.

`createChat()` holds every decision and knows nothing about the DOM, so `test/talk.test.js` drives it with a scripted `fetch`: reading the stream, retries, the details form, the fallback, and that the widget's words match `site/content/en/`. When a visitor leaves their details, they go to the agent as the visitor's own message ("Please get in touch. Name: ..."), the agent shows them back, and nothing is passed on until the visitor presses "Yes, send it". A failure the visitor can fix by sending again offers Try again and takes the message out of the history; once the note tool has run, nothing is ever resent. When the chat is offline or cannot be reached, the thread is swapped for a plain form to `/api/intake`, keeping what the visitor wrote, and only if that fails too does it show `info@chamainteligente.com`.

### Pages it links to

`lib/site-pages.js` is the one list of pages and what each covers. The prompt carries the live ones, built once at load so the prompt stays byte-identical for caching. `test/site-pages.test.js` fails when a page is marked live but nothing serves it or `vercel.json` redirects it, and when a page's file exists but it is not marked live. So landing a page means setting `live: true` and checking its line, and redirecting one away means setting it to `false`. The eval runner also fails any reply that links to an address on our domain that is not live, or that gives out an email address or phone number other than the visitor's own.

### How fast it answers

The model reads the whole prompt before its first word, and the API caches what it read for five minutes. Visitors arrive further apart than that, so `assets/talk.js` sends `{ "warm": true }` to `/api/chat` when someone looks ready to talk (focus in a Talk to us field or the composer, the sheet opening, `/agent` loading), at most once per 4.5 minutes, and a real message counts as one. A warm-up without an `Origin` header is refused, and each one logs its cache use as `Chat warm-up`. The server answers it with a `max_tokens: 0` request built from the same prefix as a real one (`warmRequest` and `chatRequest` in `api/chat.js`), so it costs one cache write and no output. Measured 2026-11-16: a first message on a cold cache started in about 1.8 s in production, on a warm one about 1.1 s.

Two runners measure it, both with tool execution stubbed so nothing is stored or emailed:

- `npm run evals` plays the cases in `evals/cases.js`: `attack` (injection and tool abuse), `quality` (facts, tools, Elliot's voice) and `conversation` (openings modelled on the saved conversations). Reply length and question count are asserted in code (`expectReply`, `evals/shape.js`); a judge model scores the rest against the case's rubric.
- `npm run evals:conversations` plays the visitors in `evals/personas.js` through whole conversations. A second model is the visitor and decides each turn whether to keep typing. Patience is counted in code: a wall of text next to a short message, or two questions at once, is a strike. It reports how many got in contact, how much of their situation the agent learned, and how many of their questions were answered.

Both take `--prompt path/to/another/chat-prompt.js` to run an earlier prompt for comparison (`git show main:api/chat-prompt.js > api/_old.js`; the file has to sit in `api/` for its imports) and `--json file` to keep the transcripts. Change the prompt only with both runs before and after.

### Chat event contract

What the widget and `/api/chat` agree on. It is frozen: a change to it is agreed with whoever owns the widget first, and `api/chat.test.js` holds it.

**Request.** `POST /api/chat`, same origin, `Content-Type: application/json`.

| Body | Meaning |
|---|---|
| `{ "conversationId": "<uuid>", "messages": [{ "role": "user" \| "assistant", "content": "<text>" }, ...] }` | One exchange. `messages` is the whole conversation as text, oldest first, starting and ending with the visitor's turn: at most 40 entries, 4000 characters each, 32000 in all, 30 visitor turns. `conversationId` is made once per page load (8 to 64 letters, digits or dashes; anything else is replaced). The page sends the agent's earlier replies back exactly as they were streamed, because the contact tool checks that the visitor was shown their details in the reply just before their latest message. |
| `{ "warm": true }` | Fills the prompt cache so the next real message starts faster. Answers `204` with no body. Send it when a visitor looks ready to talk (composer focus, the full-screen page opening), at most once per 4.5 minutes; a real message counts as one. It needs an `Origin` header (a browser POST always has one) or it gets `403`. Failures are silent. |

**Refusals before streaming.** A JSON body `{ "error": "<text to show>", "kind": "offline" | "retry" | "final" }`:

| Status | `kind` | When | `error` |
|---|---|---|---|
| 503 | `offline` | `CHAT_DISABLED`, no API key, or the watchdog's kill switch | `MESSAGES.offline` |
| 400 | `final` | The body or the conversation could not be read | `MESSAGES.unreadable` |
| 429 | `final` | More than 30 visitor turns | `MESSAGES.tooLong` |
| 403 | `final` | Cross-origin request | "This request could not be accepted." |
| 405 | none | Not a POST | plain text |
| 429, no JSON | none | Vercel's firewall (10 requests per IP per minute, warm-ups included). Treat as `retry` and show `MESSAGES.overwhelmed`. | none |

**The stream.** Otherwise `200`, `text/event-stream`. Each event is one `data: <json>` line followed by a blank line:

| Event | Meaning |
|---|---|
| `{ "type": "text", "text": "<delta>" }` | The next piece of the reply. Append it. A reply can arrive in several stretches with a tool event between them. |
| `{ "type": "tool", "name": "send_note_to_elliot", "ok": true \| false }` | The agent asked to send the visitor's contact request. `ok: true`: it was stored (and normally emailed), so Elliot will see it; the agent's next words say so. `ok: false`: it was refused or could not be saved, and the agent's next words say what happens instead. Once this event has arrived, never resend the same message automatically: that could send a second request. |
| `{ "type": "error", "error": "<text to show>", "kind": "offline" \| "retry" }` | The model call failed. `offline` (the API spend limit) shows `MESSAGES.offline`; `retry` shows `MESSAGES.overwhelmed` or `MESSAGES.failed`. Text already received stays on screen. |
| `{ "type": "done", "usage": { "model", "effort", "inputTokens", "outputTokens", "cacheReadTokens" } }` | The exchange is over and the transcript is saved. `usage` is missing when an error came first. Always the last event. |

**What the page shows.** Only the `error` strings above, which come from `MESSAGES` in `api/chat.js`: `offline`, `unreadable`, `tooLong`, `overwhelmed` and `failed`. None of them names an email address or phone number. The other `MESSAGES` entries are tool results the model reads and the visitor never sees. When `kind` is `offline`, the page offers the plain contact form below (it says the chat is offline; the words pointing at the form belong to the widget).

**When the chat is down.** `/api/intake` takes the same contact request from a plain HTML form, so the widget's fallback and its `<noscript>` twin can post straight to it. Fields: `name`, `email`, `whatsappNumber` (at least one of the two), `request`, plus `company` (a honeypot: leave it empty and hidden) and `startedAt` (milliseconds since the epoch when the form was shown; a submission under a second later is treated as a bot). A urlencoded or multipart post is answered with a `303` to `/#thanks`, or a plain-text error: `400` (a field is missing or wrong), `403` (cross-origin), `500` (nothing was saved) or `502` (saved, so Elliot will see it, but the email to him did not go out). Send `Accept: application/json` to get `{ "ok": true }` or `{ "error": "<text>" }` instead.

### Saved conversations

After every exchange, `api/chat.js` writes the whole transcript to the private EU Blob store as `chat/<YYYY-MM-DD>/<conversationId>.json`, overwriting in place so one conversation is one file. The page makes the id once per load. A record holds the turns and tool calls only: no IP, no user agent, no headers. A storage failure never reaches the visitor. Only Elliot and the watchdog read them.

### Watchdog

A cron calls `/api/watchdog` at `:05` and `:35` past each hour, authenticated with `CRON_SECRET`. It reviews conversations uploaded in the last 40 minutes (capped at 40 conversations and 400 KB) with a second model that has no tools, and gets back a verdict:

- `clear`: nothing happens.
- `concern`: an email to `contact@chamainteligente.com`, "Flame watchdog: review needed". An attempted injection the agent resisted is a concern at most. Unparseable output and a capped window also count as a concern.
- `malicious`: something landed. The watchdog writes `ops/kill-switch.json` to the blob store and emails "The flame has been shut down".

The watchdog never logs visitor text.

The same cron also checks that the chat can answer at all (`lib/flame-health.js`). It asks the Anthropic API for the chat's model with the chat's key, which costs nothing. A dead key, a key without access or a retired model emails "The flame is not answering" with the error and the fix, again once a day while it stays broken, and "The flame is answering again" when it recovers. Overloads and network blips are ignored. State lives in `ops/flame-health.json` in the blob store. It cannot see the API spend limit.

### Taking the chat offline and back

The chat goes offline in three ways:

- **The kill switch.** `api/chat.js` checks `ops/kill-switch.json` (cached 60 seconds, fails open) and answers with the offline message while it says `disabled`. A switch the watchdog threw expires 24 hours after its `at`. To bring it back sooner, delete `ops/kill-switch.json` from the blob store in the Vercel dashboard. The chat is back within a minute.
- **`CHAT_DISABLED`.** Any value in the Vercel environment takes the chat offline on the next deploy. Only a person sets or clears it.
- **The API spend limit.** When the Anthropic account hits its limit, the page shows the offline message. Raise the limit in the Anthropic Console. No deploy is needed.

If every visitor gets "Something went wrong on our side", check the error logs first. `AuthenticationError status=401` means the Anthropic key is dead: create a new one in the Console (set it to never expire, Chama Inteligente workspace), replace `ANTHROPIC_API_KEY` in Vercel, and redeploy.

A Vercel Firewall rule in the dashboard (not in this repo) limits `/api/chat` to 10 requests per IP per minute.

## Intake

The agent's `send_note_to_elliot` tool and a direct POST to `/api/intake` both go through `api/intake.js`. Before the tool stores anything, `consentProblem` in `api/chat.js` checks the conversation the page sent, not the model's word: the name, email and number must be ones the visitor typed, and the agent's message just before the visitor's latest one must have shown them, so that latest message is the visitor's yes. Anything else goes back to the model as a refusal saying what to do. A note has a name, one way to reach the visitor (email, or a number in `whatsappNumber`; a phone that is not WhatsApp ends the request with "Phone, not WhatsApp."), and the request. Records are private JSON blobs (schema version 2) in the EU Blob store, with no IP address. Resend then emails `contact@chamainteligente.com` from `website@chamainteligente.com`, "Someone asked to be contacted: <name>", with the visitor's email as `Reply-To` and the chat's conversation id, so the transcript can be read in `/admin` first. Every field is visitor text: it sits between two rules under a line saying so, names and numbers are flattened to one line, the request is quoted line by line, and control and bidirectional characters are removed, so nothing a visitor types can pose as a line of ours. If the email fails, the record stays stored and Elliot sees it in storage. A honeypot and a minimum fill time absorb basic spam.

## Admin area

`/admin` is behind Google sign-in and only reads: chat status, counts, a 30-day chart, full transcripts and contact requests. Every value reaches the page through `textContent`. It is `noindex` by meta tag, header and `robots.txt`, and only this path's CSP opens `accounts.google.com`.

Sign-in uses Google's ID token flow with no client secret. `/api/admin-auth` verifies the token's signature against Google's keys, issuer, audience, expiry, `email_verified` and the allowlist, then sets an HMAC-signed `chama_admin` cookie for seven days. Three environment variables, all required, all only in Vercel:

| Variable | What it is |
|---|---|
| `GOOGLE_CLIENT_ID` | The public OAuth web client ID. Its authorized JavaScript origins must include `https://chamainteligente.com`. |
| `ADMIN_EMAILS` | The allowlist, comma separated. |
| `ADMIN_SESSION_SECRET` | At least 32 bytes of hex. Rotating it signs everyone out. |

## The Hearth

The members' room is its own product, in the private repo `chama-hearth` (`../chama-hearth`), served by its own Vercel project at https://hearth.chamainteligente.com. This site keeps only the public page about it, `/hearth` (`hearth-public.html`, generated from `site/pages/hearth-public.js`, indexable, with its sharing card `og-hearth-2026-10-22.png`), whose Members sign in button goes to the Hearth.

Everything the room used to answer here leads there, in `vercel.json`, because links in sent emails, calendar invites and agents' settings still carry the old addresses. `/hearth/*`, `/hearth-room`, `/api/hearth/*`, `/api/oauth/*` and the two OAuth documents under `/.well-known/` redirect permanently (308, which keeps a POST and its body). Their sources end in `/:path+`, since `/:path*` would also catch the bare `/hearth` this page lives at. `/mcp` and the public feed (`/feed`, `/feed.xml`, `/feed/<slug>`) are forwarded instead of redirected: a redirect would drop an agent's `Authorization` header, and the feed's address belongs to this site. The forward keeps agents with an API key working. An agent that signs in with OAuth has to use https://hearth.chamainteligente.com/mcp, because the Hearth names that address as the resource its tokens are for. `test/site.test.js` holds each of these.

## Checking and deploying

`npm run pages` after changing anything in `site/`, and `npm run stamp` after changing anything in `assets/` or a hand-written page (`npm run pages` already stamps). Both rewrite nothing on a tree that is already right. `npm run check` syntax-checks every shipped script and runs every unit test against a fake database, with no network, and fails while a generated file is out of date or any address is unstamped or stale. The tests that hold the public site:

| Test | What it holds |
|---|---|
| `test/build.test.js` | Every generated file is exactly what the build makes, and the build is deterministic. |
| `test/site.test.js` | Every page exists and asks no other host for anything, sets theme and motion before any stylesheet, keeps the brand rules above, has its own title, description and canonical; the sitemap lists exactly the indexable pages; no colour outside `tokens.css`; every old address redirects to a real page in one step; the Hearth's old addresses leading to its own host; the media kit's files exist. |
| `test/engine.test.js` | The engine's contracts (see `pages.md` in the skill). `test/fixtures/engine.html` exercises them in a browser. |
| `test/figures.test.js` | The figure kit's helpers and protagonist, complete at `--p` 1, the `data-morph` format against the engine's own reader, a business only growing into room its boundary has already made, no figure keeping its own copies, and `[data-p]` only on leaves or groups of at most three. `test/fixtures/figure.html` shows the language on the real engine. |
| `test/talk.test.js` | The chat widget's decisions, and its words against `site/content/en/`. |
| `test/html.test.js` | The `html` tag escapes copy and `inline()` links only to this site. |
| `test/site-pages.test.js` | The chat's page list agrees with what is served. |
| `test/stamp.test.js` | The stamp's rules (below). |

`test/shots/` is the visual rig for the built pages, with its own dependencies; see `test/shots/README.md`.

`vercel dev --listen 4990` serves the site locally.

Merging to `main` deploys through Vercel's GitHub integration (project `chama-inteligente/chama-inteligente`), and PRs get preview URLs. Do not run `vercel deploy` by hand. `.vercelignore` keeps `docs/`, `evals/`, `scripts/`, `site/` and `test/` out of every deploy, so internal reports and page sources live only on GitHub.

Storage and email are Vercel resources: the private Blob store `chama-inteligente-intake` in Paris (`BLOB_READ_WRITE_TOKEN`) and the Resend integration `chama-inteligente-email` (`RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`). Their values live only in Vercel. Crons: intake cleanup daily at 03:15 UTC and the watchdog at `:05` and `:35`.

### Caching

Every script and stylesheet under `/assets` is asked for as `/assets/<file>?v=<first 10 hex of its sha256>`, and `vercel.json` serves an address as `public, max-age=31536000, immutable` only when its `v` is one of this deploy's versions (`npm run stamp` writes the list). A changed file gets a new address, so a browser fetches it once and never asks about an unchanged one again. The same path without `?v`, or with any other `v`, is `public, max-age=0, must-revalidate`: it still works, and the browser checks it every time. Vercel does not look at `v` when it picks the file, so without the list any `v` was cached for a year: since the repo is public, a version worked out from a commit before its deploy finished could pin the old body under the new address in a visitor's browser.

Why this scheme: the HTML is always revalidated, and it names the exact bytes of everything it runs, so a page and its scripts always come from one deploy. A content hash in the query needs no renamed files and no build step on Vercel: the committed files are the deployed files. Vercel ignores the query string when it caches a static file and keeps a separate cache per deployment (docs: CDN cache, cache keys), so the edge always answers with the deployment's own file and the version only steers the browser. A per-deploy version for all files would have been simpler, but every deploy would download every file again.

The snapshot in `original/` is left out of the stamp: its scripts and stylesheets are asked for without `?v` and have no rule, so they get Vercel's default and are revalidated on each visit (a `304` while nothing changes). It is frozen and rarely visited, so a year's cache would save little, and leaving it out kept its addresses and the stamp's rules as they were.

Images (and the recording's posters) are cached for a day in the browser and a week at the edge. Fonts and the recording's `.mp4` files carry no version and have no rule, so they get Vercel's default and are revalidated on each visit; a changed font or recording goes out under a new filename.

The rules `scripts/stamp.js` keeps, and `test/stamp.test.js` enforces:

- Every address is a whole quoted literal from the root: the pages' tags, `talk.js` adding `talk.css`. Building one at run time (`"/assets/" + name`) fails the check, because no stamp can reach it.
- A file's version covers the versions it carries, so changing `talk.css` re-versions `talk.js` and the pages. `npm run stamp` repeats until nothing moves.
- `vercel.json`'s three `/assets/(.*)\.(js|css)` header rules carry the tree's versions, and the check fails while they are stale.
- The tree is what is added to git, symlinks left out: an address to an asset nobody has added fails the check rather than 404 in production, and the stamp never writes outside the repository.
- The router only swaps in a page whose scripts and stylesheets the running page already has. Anything else is another deploy and gets a full load.

The list also closes the gap between a page and its scripts coming from two deploys: if production switches deploy between a browser getting the HTML and its scripts, the new deploy answers the old address with its new body, but not as cacheable, so nothing outlives that one view.

### DNS

Namecheap is authoritative (PremiumDNS).

| Record | Value | Purpose |
|---|---|---|
| `A @`, `A www` | `76.76.21.21` | Vercel |
| `MX @` | `1 smtp.google.com` | Google Workspace receives company mail |
| `TXT @` | `v=spf1 include:_spf.google.com ~all` | Google Workspace may send |
| `MX send`, `TXT send` | Resend's EU return path and SPF | Resend sending |
| `TXT resend._domainkey` | Resend DKIM key | Resend sending |

## Search

- **Sitemap.** Generated from `PAGES`. In the same change as a page's copy, bump that page's `lastmod` in `site/site.js`.
- **Machine text.** `llms.txt` and `llms-full.txt` are generated from the same copy as the pages, so they cannot drift. Each page's `text()` decides what it contributes; the opening summary is `SUMMARY` in `site/machine.js` and must name both software and coaching.
- **IndexNow.** After a change worth announcing, push it to Bing and the others. A `202` means accepted. Google does not take IndexNow; use Request indexing in Search Console (Domain property on `elliot@chamainteligente.com`).

```bash
KEY=$(basename "$(ls [0-9a-f]*.txt)" .txt) && curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.indexnow.org/indexnow -H "Content-Type: application/json" -d "{\"host\":\"chamainteligente.com\",\"key\":\"$KEY\",\"keyLocation\":\"https://chamainteligente.com/$KEY.txt\",\"urlList\":[\"https://chamainteligente.com/\"]}"
```

- **Structured data.** Every page carries the same JSON-LD graph (organisation, website, page) from `site/parts/chrome.js`. After a change to it, check a live URL at `validator.schema.org`.
