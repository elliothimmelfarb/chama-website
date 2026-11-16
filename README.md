# chama-website

The deployable source for **https://chamainteligente.com** (and `www.`), plus the company's brand assets. This repository is public. The company's private repository, the wiki and the history of the site's copy live in `../chama-inteligente/`, which is never connected to any hosting provider.

## What is here

| File | What it is |
|---|---|
| `site/site.js` | The one list of public pages (`PAGES`: path, file, nav label, whether the router swaps it, sitemap priority and `lastmod`, `noindex`) and the facts every page shares (`SITE`). |
| `site/pages/<id>.js` | Each page as a function that returns the whole document. Small page-only styles sit in the page's own `<style>`. |
| `site/content/en/<id>.js` | Each page's words, kept apart from its markup. `common.js` holds the header, menu, footer and Talk to us words; `talk.js` the chat widget's. |
| `site/parts/` | What pages share: `chrome.js` (head, header, menu, Display popover, Talk to us field, footer, `page()`), `boot.js` (the snippet that sets theme and motion before the first paint), `logos.js` (client and partner logos). |
| `site/figures/` | The inline SVG figures, drawn from `--p`. `kit.js` holds what they share: the `--p` timing helpers, the pentagon's geometry and `subject()`, the protagonist on its five layers (`docs/DESIGN.md` section 14). |
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
| `assets/flame.js`, `assets/figures.css` | Left from the old site. Only the Hearth room still loads them (`hearth-room.html`). |
| `api/chat.js`, `api/chat-prompt.js` | The chat endpoint (same origin, SSE streaming, one tool: `send_note_to_elliot`, a visitor asking to be contacted) and its frozen system prompt, which is reviewed like copy. |
| `lib/site-pages.js` | The site's pages as the chat agent knows them: path, title, what each covers, and whether it is live. |
| `evals/` | The agent's evals (`npm run evals`, `npm run evals:conversations`). Both spend API credit and are not part of `npm run check`. |
| `api/intake.js`, `api/intake-cleanup.js` | The contact pipeline and its daily 12-month retention cleanup. |
| `api/watchdog.js`, `lib/flame-health.js` | The cron that reviews conversations and can take the chat offline, and the check that the chat can reach its model. |
| `admin.html`, `assets/admin.*`, `api/admin-auth.js`, `api/admin-data.js` | The private, read-only admin area at `/admin`. |
| `hearth-room.html`, `assets/hearth*`, `api/hearth.js`, `api/mcp.js`, `api/oauth.js`, `api/feed.js`, `api/hearth-cron.js`, `lib/hearth/` | The Hearth, the members' platform. See [The Hearth](#the-hearth). |
| `docs/DESIGN.md` | The design: type, colour, grounds, motion, each page's sections, the Talk to us sheet, low motion. |
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

**Theme.** `html[data-theme="light"|"dark"]` when the visitor chose one, otherwise the system's. **Motion.** `html[data-motion="low"]` when the visitor chose low or the system asks for reduced motion and they have not chosen full. Low motion is the same page, designed in its own right (`docs/DESIGN.md` section 10): no pinning, no router, no autoplay, every figure complete, stages as steppers. `site/parts/boot.js` sets both before the first stylesheet, from `localStorage` (`chama-theme`, `chama-motion`), so the first paint is already right, and adds `html.pin` (the pinned layout) when there is room for it.

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

`/build` shows each thing's real pages scrolling inside a laptop and a phone (`site/figures/devices.js`, `drawDevices` in `worlds.js`). Each picture is a tall capture in `assets/built/` (`<name>-desktop*.webp`, `<name>-phone*.webp`) with resized copies; `SHOTS` in `devices.js` lists each one's widths and full height, and `PICTURES` in `site/pages/build.js` maps a thing to its pictures. Private work shows seeded demo data, never real records.

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

The members' room at `/hearth`: clients buy session packs, book against Elliot's availability, own their session transcripts and the records made from them, and connect their own agents. Owners and staff manage members, roles, packs, purchases, availability, transcripts and the feed. The design record is in the brain at `wiki/topics/the-hearth-members-platform.md`.

| File | What it is |
|---|---|
| `hearth-public.html` | The public page at `/hearth` for anyone without a session cookie: what the room is, for prospective coaching clients. Generated from `site/pages/hearth-public.js` like every public page, indexable, with its own sharing card (`og-hearth-2026-10-22.png` from `brand/og/og-hearth.html`). It loads nothing from the room. |
| `hearth-room.html` | The room's shell, served at `/hearth` to anyone with the `__Host-chama_hearth` cookie and at `/hearth/*` always, `noindex`, with its own CSP. Signed-out members sign in at `/hearth/sign-in`. Hand-written, not generated, and still on the old look: it loads `assets/flame.js` (the fire in the room) and `assets/figures.css`. It paints the bar at once and asks `/config` and `/me` from an inline script while `hearth.js` downloads. |
| `assets/hearth.js`, `assets/hearth.css` | The core app (router, sign-in, frame, account) and design. No `innerHTML` anywhere in the room. |
| `assets/hearth-*.js` | One file per area: sessions, transcripts, agents, feed, admin, each with an `-admin` file where the owner's side differs. `hearth.js` loads only the ones `/me` names for the member's permissions, from the list in `lib/hearth/modules.js`, at the versioned addresses written in `hearth-room.html`. A new file goes on that list and in that page, or `modules.test.js` fails. |
| `api/hearth.js` | The router behind `/api/hearth/*`. The routes are in `lib/hearth/routes/`. |
| `lib/hearth/` | Database and migrations, auth, users, providers, permissions, audit, mail, time and slots, calendar files, transcript records, the OAuth server and the MCP server. |
| `api/mcp.js`, `api/oauth.js` | `/mcp` and the OAuth 2.1 endpoints with their well-known documents. |
| `api/feed.js` | The public feed at `/feed` and `/feed.xml`, off until `feed_public` is on. |
| `api/hearth-cron.js` | Hourly at `:20`: reminders, Meet transcript pulls, unsettled card checkouts, expired token sweep. |
| `api/stripe-webhook.js`, `lib/hearth/stripe.js`, `lib/hearth/routes/invoices.js`, `lib/hearth/routes/checkout.js` | Stripe: the client, invoices, card checkout for packs, and the signed webhook at `/api/stripe-webhook`. |

### Routing

`/hearth` is two pages on one address, chosen in `vercel.json` by the session cookie: with `__Host-chama_hearth` it rewrites to the room (`hearth-room.html`, `noindex`, the room's CSP), without it to the public page (`hearth-public.html`). Crawlers and link previews never carry the cookie, so they always get the public page. `/hearth/*` is always the room and stays `noindex` and disallowed in `robots.txt`. Sign-in errors land on `/hearth/sign-in?error=...`, and a signed-in member who opens `/hearth/sign-in` is moved to Home. `vercel dev` ignores `has` conditions, so check the routing on a preview deployment with and without the cookie.

The navigation is built from each page's `register(..., { nav })`: an unlabelled daily list, then Money and Setup. An entry with `hideFor` is hidden from anyone holding that permission, which is how the owner sees Sessions, Session records and Client notes for the whole business instead of his own empty member pages. The owner's "See it as a member" opens the room as a chosen member sees it, read-only (view-as). On a phone the first four entries are tabs and the rest sit under More.

Loading a part only for those who can use it saves bytes; it never guards anything. Every API route checks its own permission, and the page's `can()` only decides what to draw.

### Data

Neon Postgres (`chama-hearth`, Frankfurt) through Vercel's managed `DATABASE_URL`. There is no migration command: the first request after a cold start applies any unapplied migration in `lib/hearth/migrations.js`, and every statement is idempotent. The rules:

- One person per email, whatever they signed in with. Unverified emails are refused.
- Credit balances are sums over the append-only `credit_ledger`.
- The database refuses double bookings (an exclusion constraint) and a second transcript per booking (`transcripts_booking_idx`).
- Every cancel and referral reward is a compare-and-set, so a second concurrent call changes nothing.
- The audit log is append-only and never holds an IP, a raw user agent or visitor text.
- Transcripts are data: shown through `textContent`, given to models as untrusted text, never logged.

If `transcripts_booking_idx` is missing because duplicates existed when migration 004 ran, find them with `select booking_id, count(*) from transcripts where booking_id is not null group by 1 having count(*) > 1`, remove the extras by hand, then run `create unique index transcripts_booking_idx on transcripts(booking_id) where booking_id is not null`.

### Signing in

Google (ID token), GitHub and Discord (authorization code with a state nonce, verified email required), and email (a 15-minute magic link, or an optional password of 12 or more characters). Every auth endpoint is rate limited. A session is an opaque token in the `chama_hearth` cookie, 30 days sliding, stored hashed, and members can end any of their sessions. Everyone on `ADMIN_EMAILS` is an owner every time they sign in, so the owner cannot be locked out.

### Agents

`https://chamainteligente.com/mcp` is an MCP server. Claude connects with OAuth 2.1 (dynamic registration, PKCE S256, a consent page in the Hearth, tokens bound to `/mcp`). A malformed authorize request stops on a page here with a labelled link back and never redirects by itself, because registration is open. `/mcp` refuses a browser `Origin` other than this site's or Claude's. Scripts use scoped API keys (`chama_sk_...`). The tools a caller gets are the intersection of the token's scopes and the person's permissions. The unauthenticated tools answer only when `mcp_public` is on. Nothing an agent submits is treated as an instruction to anyone.

### Sessions and money

Packs and prices are set in the room, never in code. A client requests a pack, Elliot issues the fatura from the certified invoicing software, marks the purchase invoiced and then paid, and the credits appear. With card payment on, a client can instead pay for a priced pack by card (see Card payment for packs).

Each member pays one of two ways, set on their member page under How they pay (`users.billing`). Pre-buy (`prebuy`, the default) members need a credit to book, and the server refuses a booking without one. Billed after (`after`) members book any open time without credits; their held sessions wait under Purchases, To invoice, until marked invoiced (`bookings.billing`, `bookings.invoiced_at`). The rule lives in `POST /bookings`, so the MCP `book_session` tool follows it too.

### Invoices through Stripe

Under Money, Invoices, the owner bills one member through Stripe: the sessions they held while billed after, the sessions recorded for them with no booking behind them (`transcripts.invoice_id`), a pack they asked for, or lines typed by hand. Ready to invoice, at the top of that page, lists everyone with sessions waiting and opens the form for them with every session ticked; the price per session starts from the last one used for that member, else the last one used (`settings.session_price_cents`). "Invoice with Stripe" on the To invoice list, on a pack request and on a member's page opens the same form. The Hearth reuses or makes the member's Stripe customer (`users.stripe_customer_id`), creates and finalizes a `send_invoice` invoice tagged `metadata.source = hearth` that always offers card, marks those sessions or the pack invoiced, and emails the member the link from Resend (Stripe's own invoice emails are not used). Each invoice is a row in `invoices`. Members, guests included, see theirs at `/hearth/invoices` (in the nav once they have one), an open one on Home with a Pay button, and a notice with a See invoice button once per visit while one is open: notice, Pay, Stripe. Pay opens a dialog in the room with Stripe's card form (the Payment Element, confirming the invoice's own payment via `POST /invoices/:id/pay`, which returns its `confirmation_secret`); Stripe.js loads only when Pay is pressed, and the Hearth's CSP allows `js.stripe.com`, `hooks.stripe.com` and `api.stripe.com` for that. After the card goes through, `POST /invoices/:id/sync` asks Stripe and marks it paid at once, without waiting for the webhook. Receipt opens the paid invoice in a dialog too, with its PDF. Stripe's own invoice page can't be framed, so it is only the fallback (new tab) when the card form can't load or `STRIPE_PUBLISHABLE_KEY` is missing.

Stripe calls `/api/stripe-webhook` (endpoint `we_1UQsBvKIjHJB7AoptnkdEcEw`, events `invoice.finalized`, `invoice.paid`, `invoice.voided`, `invoice.marked_uncollectible`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`). Paid is a compare-and-set, so a replay adds nothing; a paid pack invoice adds its credits through the same path as Mark paid, and the owner gets an email. Voiding, in the room or in Stripe, frees the sessions to be invoiced again and puts the pack back to requested. The Hearth follows only invoices it made: one sent from the Stripe dashboard is never attached to anyone, because the account also bills ShopIntake and AI Made Games.

Who pays decides the IVA (`lib/hearth/iva.js`, CIVA artigo 6.º n.º 6). Each member has billing details (`billing_profiles`), which they fill in at `/hearth/billing` or the owner records under Bill to in the invoice form. A business must have its legal name, address and tax ID before it can be invoiced as one. The tax ID is checked on save (a NIF's check digit, an EIN's nine digits) and is named for the country (NIF, EIN, VAT number). For an EU number, Look up asks the EU's VIES register (`lib/hearth/vies.js`) and fills in the registered name and address; a live answer is kept as proof (`vies_valid_at`), and an EU number VIES rejects is refused, except a Portuguese NIF, since small firms outside the IVA regime are not in VIES. A Portuguese business pays 23 percent and its NIF goes on the invoice as Customer NIF, so it can deduct the IVA. When a member saves complete company details the owner gets an email with a link to invoice them. A business outside Portugal with its legal name, address and tax ID (an EIN for a US LLC, a VAT number in the EU) is invoiced with no IVA: the Stripe customer gets the legal name, address and `tax_exempt = reverse`, the invoice footer gives the legal reason (IVA - autoliquidação), and the tax ID is added to the Stripe customer as a real tax ID (`us_ein`, `eu_vat` and so on, `stripeTaxId`) so the invoice carries it in `customer_tax_ids`, which Stripe prints. A number Stripe has no type for, or one it refuses, is printed as a custom field instead. Without those details the Hearth refuses the invoice. Everyone else, private people and Portuguese businesses, gets 23 percent added through one Stripe tax rate (`settings.stripe_iva_rate`). Saving the details is the member's declaration and records who and when (`declared_by`, `declared_at`); the owner can note how they checked it, and changing only the currency or the note keeps the member's declaration. The billing details also hold the member's currency (EUR or USD) and their last price per session. The owner's paid email repeats the bill-to and the IVA reason so the fatura matches.

The Stripe invoice is the payment request, not the fatura: the fatura still comes from the certified software. The Stripe account (Chama Inteligente, Lda) is shared with ShopIntake and AI Made Games, each with its own restricted key; the Hearth's is `chama-hearth-prod`. ShopIntake's webhook sends a fatura notice for every paid invoice, Hearth ones included.

### Card payment for packs

Off until the owner turns on "Members can pay by card" under Money, Purchases (`card_checkout`), and shown only while `STRIPE_SECRET_KEY` is set. With it on, each priced pack has Pay by card next to Ask for an invoice, and a requested pack has a Pay by card button under In progress. The member is sent to Stripe's hosted Checkout (no Stripe script on any page) for the pack's price less any referral discount, with billing address required and a tax ID optional. The session is tagged `metadata.source = hearth` and `hearth_purchase_id`, and its id is kept on the purchase (`purchases.checkout_session_id`). A second click while it is open returns the same session. A pack that already has a Stripe invoice is paid from the invoice instead.

Three paths settle it, all through `settleCheckout` and the same compare-and-set as Mark paid: the member's return to `/hearth/sessions/packs?checkout=done`, which asks Stripe about the stored session (never the address bar); the webhook on `checkout.session.completed` and `checkout.session.async_payment_succeeded`; and the hourly cron, which checks unsettled sessions from the last 15 days and forgets expired ones. Credits arrive once, the purchase records `provider = stripe_checkout` and the session id, an open invoice for the same pack is voided, and the owner gets an email with the billing details the buyer typed (marked untrusted) for the fatura. Stripe also issues a paid invoice for the payment (`invoice_creation`, tagged `source = hearth` like everything the Hearth makes); the Hearth's invoice webhook ignores it because it is not `send_invoice`. A card payment that arrives for a pack already paid another way, or voided, adds nothing, is logged as `purchase.card_duplicate`, and the owner is emailed to refund it. If Stripe refuses to start a checkout, the member is told Elliot can invoice instead and the owner is emailed Stripe's reason.

Before turning card payment on: add `checkout.session.completed` and `checkout.session.async_payment_succeeded` to the webhook endpoint `we_1UQsBvKIjHJB7AoptnkdEcEw` (without them the return page and the cron still settle payments, only later), and make sure the restricted key can write Checkout Sessions and read and write Customers and Invoices. The site has no terms or refund page yet.

Availability is painted date by date on a grid of half hours in the owner's zone: the grid is always a real week, chosen with arrows, and each painted run is one row in `availability_days` for that date alone, so nothing repeats into the next week (since 2026-10-22; the old weekly `availability_rules` were laid onto the next 60 days by migration 010 and are no longer read, and migration 011 cleared those copies from 2026-11-09 on so the weeks ahead start closed). Under the week's total, a line says the last date open for booking, which is where the Friday routine of setting the next week or two picks up. Quick fills work on the week shown, and "Same as last week" and "Copy to next week" copy a whole week when it should repeat. Past dates are locked. The Google Calendar events and booked sessions of those dates are drawn over the grid, so the week is painted around them. Under it, the coming weeks as dates: picking one shows its week in the grid, and a day can be taken off (a whole-day block), given more hours, or blocked in part (older one-off `availability_openings` still count), and the panel shows exactly which times members are offered (`GET /admin/slots`, the same calculator they use). When Google is connected, the coming weeks also show the events on Elliot's Google calendars (titles only on the owner's side), and with Block booking on (`google_busy`, default on) members are not offered times that overlap them. The calendars read are `google_calendars` (default the connected account's `primary`); another account's calendar must be shared with the connected account first. Someone else's calendar shared with him (Young Ju's) goes in `google_shared_calendars` instead, the second field under Calendars: every event on those is drawn in the colour she gave it, so he knows what is going on at home, but only the ones that involve him block booking: they invite one of his addresses, name him in the title, or are coloured green (Sage or Basil, her mark for both of them). The rest, and anything she marked free, are outlined boxes marked "shared, does not block". An event seen on two calendars is kept once. Events are read with the existing `calendar.events` scope, cached two minutes per instance, and a failed read blocks nothing. Members book from a strip of days that glow by how open they are, see the chosen day as a daylight bar, and confirm with the cost spelled out. Booking emails both sides a calendar file. On the owner's Sessions page, opening a booking lets Elliot cancel it with a message to the member, or move it to any free time (no notice window, same length, same Meet room); either way the member gets one email in their timezone with his message, and the list says who cancelled and why. The refund toggle shows only for sessions that spent a credit. Moves, by either side, send a "Session moved" email with the old and new time. Once the owner connects Google in Settings, each booking gets a Calendar event with a Meet room, and the hourly cron pulls the Meet transcript after the session and writes the record.

Through MCP, `add_transcript` with `draft` attaches a transcript without writing the record or telling the member, and `write_record` writes it without mail, so the owner can read a record before the client is told. Without `draft`, adding a transcript writes the record and emails the member.

A record can also be written by hand (`set_record`, version 2 of the record shape in `lib/hearth/record.js`): the short version, a big-picture figure, the ideas as chapters with their own figures (each placed after a chosen paragraph, `after`) and the client's words, a playbook of actions with steps and prompts to copy, what is agreed, and what the next session is for. The playbook's actions become the client's follow-ups. Figures are SVGs keyed per record (`set_record_figure`, table `record_figures`), served from `/api/hearth/transcripts/<id>/figures/<key>` only to people who may read the record, shown through `<img>` so they cannot run, and refused on upload if they hold script, event handlers or any link that leaves the file (`lib/hearth/visual.js`).

Remember cards are spaced repetition for a record (`set_record_cards`, table `recall_cards`). A card comes back after 1, 3, 7, 16 and 35 days: "Got it" climbs a step, "Fuzzy" holds, "Missed it" starts over, and a card answered well at the top retires (`lib/hearth/recall.js`). Members review on the record, on the Remember page, and see the count due on Home.

An owner can view the room as any member (a member's page, or "See this as ... sees it" on a record). Their nav, Home, records and cards render exactly as the member's, under a banner with the way out. A second cookie names the member and means something only alongside an owner's session, every change is refused while it is set, and starting and ending a view are logged.

Settings has three switches, each a decision rather than a deploy: `open_signup`, `feed_public`, `mcp_public`.

### Environment variables

The Hearth also uses `ADMIN_EMAILS`, `RESEND_*`, `CRON_SECRET`, `ANTHROPIC_API_KEY` and `GOOGLE_CLIENT_ID` from above.

The Hearth's mail comes from `Hearth · Chama Inteligente <hearth@chamainteligente.com>` (`lib/hearth/mail.js`). Everything meant for Elliot (bookings, pack requests, billing details, payments, failures) goes to `elliot@chamainteligente.com` (`OWNER_INBOX`), never to the address the owner signs in with. A paid invoice or card payment is the fatura request: it opens with "This payment needs a fatura." (it never says where to send it) and carries who paid, the bill-to and the IVA reason. ShopIntake's Stripe webhook asks for the fatura for every other sale on the shared Stripe account and skips anything tagged `metadata.source = hearth`, so each Hearth payment brings one email, from the Hearth.

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Set by the Neon integration. Without it the Hearth answers "not open yet". |
| `HEARTH_SESSION_SECRET` | Seals the Google refresh token at rest. |
| `GOOGLE_CLIENT_SECRET` | The same Google OAuth client as `GOOGLE_CLIENT_ID`. Needs the redirect URI `https://chamainteligente.com/api/hearth/google/callback`, the Calendar and Meet REST APIs, and the scopes `calendar.events` and `meetings.space.readonly`. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | The GitHub OAuth app. Callback `https://chamainteligente.com/api/hearth/auth/github/callback`. |
| `STRIPE_SECRET_KEY` | The restricted key `chama-hearth-prod` on the Chama Inteligente Stripe account: Customers, Invoices, Checkout Sessions and Webhook Endpoints write. Without it the Invoices page says Stripe is not connected and nothing else changes. |
| `STRIPE_WEBHOOK_SECRET` | The signing secret of the Hearth's webhook endpoint above. |
| `STRIPE_PUBLISHABLE_KEY` | The account's live publishable key (public by design), for the card form in the Pay dialog. Without it Pay opens Stripe's page in a new tab. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | The Discord app. Redirect `https://chamainteligente.com/api/hearth/auth/discord/callback`. The Discord button appears once both are set. |

## Checking and deploying

`npm run pages` after changing anything in `site/`, and `npm run stamp` after changing anything in `assets/` or a hand-written page (`npm run pages` already stamps). Both rewrite nothing on a tree that is already right. `npm run check` syntax-checks every shipped script and runs every unit test against a fake database, with no network, and fails while a generated file is out of date or any address is unstamped or stale. The tests that hold the public site:

| Test | What it holds |
|---|---|
| `test/build.test.js` | Every generated file is exactly what the build makes, and the build is deterministic. |
| `test/site.test.js` | Every page exists and asks no other host for anything, sets theme and motion before any stylesheet, keeps the brand rules above, has its own title, description and canonical; the sitemap lists exactly the indexable pages; no colour outside `tokens.css`; every old address redirects to a real page in one step; `/hearth` routing; the media kit's files exist. |
| `test/engine.test.js` | The engine's contracts (see `pages.md` in the skill). `test/fixtures/engine.html` exercises them in a browser. |
| `test/figures.test.js` | The figure kit's helpers and protagonist, complete at `--p` 1, no figure keeping its own copies, and `[data-p]` only on leaves or groups of at most three. `test/fixtures/figure.html` shows the language on the real engine. |
| `test/talk.test.js` | The chat widget's decisions, and its words against `site/content/en/`. |
| `test/html.test.js` | The `html` tag escapes copy and `inline()` links only to this site. |
| `test/site-pages.test.js` | The chat's page list agrees with what is served. |
| `test/stamp.test.js` | The stamp's rules (below). |

`test/shots/` is the visual rig for the built pages, with its own dependencies; see `test/shots/README.md`.

`vercel dev --listen 4990` serves the site locally; without a database the Hearth API answers 503, which still proves the routing.

Merging to `main` deploys through Vercel's GitHub integration (project `chama-inteligente/chama-inteligente`), and PRs get preview URLs. Do not run `vercel deploy` by hand. `.vercelignore` keeps `docs/`, `evals/`, `scripts/`, `site/` and `test/` out of every deploy, so internal reports and page sources live only on GitHub.

Storage and email are Vercel resources: the private Blob store `chama-inteligente-intake` in Paris (`BLOB_READ_WRITE_TOKEN`) and the Resend integration `chama-inteligente-email` (`RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`). Their values live only in Vercel. Crons: intake cleanup daily at 03:15 UTC, the watchdog at `:05` and `:35`, the Hearth at `:20`.

### Caching

Every script and stylesheet under `/assets` is asked for as `/assets/<file>?v=<first 10 hex of its sha256>`, and `vercel.json` serves an address as `public, max-age=31536000, immutable` only when its `v` is one of this deploy's versions (`npm run stamp` writes the list). A changed file gets a new address, so a browser fetches it once and never asks about an unchanged one again. The same path without `?v`, or with any other `v`, is `public, max-age=0, must-revalidate`: it still works, and the browser checks it every time. Vercel does not look at `v` when it picks the file, so without the list any `v` was cached for a year: since the repo is public, a version worked out from a commit before its deploy finished could pin the old body under the new address in a visitor's browser.

Why this scheme: the HTML is always revalidated, and it names the exact bytes of everything it runs, so a page and its scripts always come from one deploy. A content hash in the query needs no renamed files and no build step on Vercel: the committed files are the deployed files. Vercel ignores the query string when it caches a static file and keeps a separate cache per deployment (docs: CDN cache, cache keys), so the edge always answers with the deployment's own file and the version only steers the browser. A per-deploy version for all files would have been simpler, but every deploy would download every file again.

The snapshot in `original/` is left out of the stamp: its scripts and stylesheets are asked for without `?v` and have no rule, so they get Vercel's default and are revalidated on each visit (a `304` while nothing changes). It is frozen and rarely visited, so a year's cache would save little, and leaving it out kept its addresses and the stamp's rules as they were.

Images (and the recording's posters) are cached for a day in the browser and a week at the edge. Fonts and the recording's `.mp4` files carry no version and have no rule, so they get Vercel's default and are revalidated on each visit; a changed font or recording goes out under a new filename.

The rules `scripts/stamp.js` keeps, and `test/stamp.test.js` enforces:

- Every address is a whole quoted literal from the root: the pages' tags, `talk.js` adding `talk.css`, and the Hearth's parts in `hearth-room.html`. Building one at run time (`"/assets/" + name`) fails the check, because no stamp can reach it.
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
