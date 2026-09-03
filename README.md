# chama-website - the company's public surface

The deployable source for **chamainteligente.com** and the company's brand assets. Built 2026-07-27 by the org for [directive 001](../chama-inteligente/org/directives/archive/001-chamainteligente-dot-com-website-and-unlocks.md), inside the company's private repository; extracted into this standalone repository (with full history) on 2026-08-28.

Elliot approved this page for publication and requested a working intake on 2026-08-03. It is live at **https://chamainteligente.com** and **https://www.chamainteligente.com**. The production build is intentionally isolated from the company's private repository and is deployed from this directory with the Vercel CLI.

## What is here

| File | What it is |
|---|---|
| `index.html` | The public home page. Since 2026-09-03 it carries one offer, software built for one company and run for it on a monthly subscription, and opens with a question ("What do you wish the software you run your business on could do?") whose answer is handed straight into the flame room at the bottom of the page: the intelligent flame, the site's live chat agent, embedded full-bleed as the contact channel (there is no form). Without JavaScript the question is a plain GET to `/agent?say=`, which the agent page reads once and strips from the URL. No external fonts, images, scripts, analytics, or trackers. |
| `training.html`, `about.html` | The two sub pages at `/training` (the coaching and training chapter, moved off the home page intact on 2026-09-03) and `/about` (the founder and About us sections). Same visual language, indexable, in the sitemap. Each ends in a dark band linking to `/agent`. |
| `assets/site.css` | The public pages' shared stylesheet, extracted from `index.html` on 2026-09-03 so the three pages share one design. `privacy.html` and `404.html` keep their own inline styles. |
| `agent.html` | The full-screen home of the intelligent flame at `/agent`, now a thin shell that mounts the shared app. Marked `noindex`. |
| `assets/agent.js`, `assets/agent.css` | The agent app itself, extracted so both pages share it: `ChamaAgent.mount(root, { mode: "page" | "embed" })`. Canvas particle flame, chat panel, HUD, tune panel. Vanilla, no libraries. Embed mode is container-scoped (container queries, root-relative geometry, pointer events bound to the root), pauses its animation loop off-screen, and holds the transcript closed as a scroller until the room is seated (its bottom edge on the bottom of the viewport). On a touch device the composer taking focus pins the room to the visual viewport (`kb-pin`, `kb-open`), so a soft keyboard cannot walk the layout off the top of the screen, and the seat magnet never fires. The tune is never persisted: every load starts from defaults. |
| `assets/figures.css`, `assets/figures.js` | The section figures' shared motion system: the draw, fade, pop, ring, comet-head, ghost, hug, orbit, glow and flare classes, and the observer that arms the page and starts each figure the first time it is seen (a tap replays it). Shared by `index.html` (two figures), `training.html` (three), and `privacy.html` (one: where your words go). Without JavaScript or under reduced motion every figure is simply complete. |
| `assets/flame.js`, `assets/flame-worker.js` | The fire engine itself, extracted from `agent.js` so it can run in two places: inline on the main thread (desktops, and any device that fails the feature tests) or inside a dedicated Web Worker via `transferControlToOffscreen` (touch devices with OffscreenCanvas 2d, tested before the canvas is handed over). In worker mode the simulation and painting never share a thread with scrolling, the keyboard, or streamed text, which is what removed the mobile jank. `flame-worker.js` is a pure switchboard: one message per engine method, one postMessage per emit (`--flamecolor`, `--flamelight`, hue and cool for the wisp). On touch a resting finger near the flame is a press the flame leans toward; a quick tap still throws sparks, and text selection is off everywhere except the conversation and the inputs. |
| `api/chat.js` | The agent endpoint: same-origin, SSE streaming, a small agent loop over the Claude API with two tools (`send_note_to_elliot` through the intake pipeline, `adjust_experience` as a client config event). Saves each conversation to private Blob storage before the stream ends (see [Saved conversations](#saved-conversations)). Unit tests in `api/chat.test.js`. |
| `api/chat-prompt.js` | The agent's entire identity: hand-authored frozen system prompt and tool definitions. Reviewed like copy. |
| `evals/` | Hand-authored eval cases (prompt-injection attacks and quality rubrics) and the runner (`npm run evals`, spends API credit, deliberately not part of `npm run check`). |
| `api/intake.js` | A same-origin Vercel Function that validates submissions, writes them to private Vercel Blob storage, and emails a plain-text notification to `contact@chamainteligente.com`. It never treats submitted text as an instruction. |
| `api/intake-cleanup.js` | An authenticated daily cleanup function that enforces the 12-month intake-retention limit. |
| `api/watchdog.js` | The production watchdog: an authenticated cron job that reviews recent conversations every half hour and can take the flame offline on its own authority (see [Watchdog](#watchdog)). Unit tests in `api/watchdog.test.js`. |
| `hearth.html`, `assets/hearth*.js`, `assets/hearth.css`, `api/hearth.js`, `api/mcp.js`, `api/oauth.js`, `api/feed.js`, `api/hearth-cron.js`, `lib/hearth/` | The Hearth, the members' room and the platform the business runs on. See [The Hearth](#the-hearth). |
| `admin.html` | The private admin area at `/admin`: a thin shell, marked `noindex`, that mounts the admin app. Google sign-in gated (see [Admin area](#admin-area)). |
| `assets/admin.js`, `assets/admin.css` | The admin app: sign-in gate, flame status, stat tiles, a 30-day activity chart drawn as inline SVG, the conversation list with full transcripts, and the contact requests. Vanilla, no libraries. Every value the API returns reaches the page through `textContent`; there is no `innerHTML` in the file. |
| `api/admin-auth.js`, `api/admin-data.js` | The admin endpoints: the Google ID-token exchange that sets the session cookie, and the read-only view over the intake, chat and kill-switch blobs. Unit tests alongside them. |
| `privacy.html` | The public privacy notice linked from the agent's fineprint and the footer. Since 2026-09-01 it carries a figure under "Where it goes" that draws the path a conversation takes, restating the notice, never adding to it. Rewritten 2026-08-30 for the agent era: saved conversations (Claude API processing, EU storage, 12-month retention, identity-free), confirmed notes with any single contact way, and privacy requests by email. |
| `vercel.json` | Production security headers for the page and endpoint. |
| `package.json` | The single runtime dependency, Vercel's Blob client. |
| `404.html` | The not-found page, in the same visual language, marked `noindex`. |
| `robots.txt` | Crawler policy. Every major search and AI crawler is named and allowed; `/api/` and `/admin` are closed. |
| `sitemap.xml` | The two canonical URLs, with hreflang alternates and the social-card image. |
| `llms.txt`, `llms-full.txt` | Plain-text summary and full visible site text, for AI crawlers and agents. |
| `<64-hex>.txt` | The IndexNow key. Do not rename or delete it; the key file is how IndexNow authenticates a submission. |
| `assets/` | Images embedded in the page body (`elliot-rozalie.webp`, `about-family.jpg`), each with resized `srcset` variants (`elliot-rozalie-240/480.webp`, `about-family-400/800.webp`, made with Pillow at quality 82; the originals stay as the largest candidate and at their old URLs). The old root URLs 301-redirect here via `vercel.json`. Root-level images (`og.png`, favicons, `apple-touch-icon.png`) stay at root: they are convention-bound or cached externally at those URLs. Since 2026-09-02 `vercel.json` caches `/assets/*.js` and `*.css` for 10 minutes in the browser and until the next deploy at the edge (a deploy purges Vercel's cache), so a change to `agent.js` or `agent.css` can take up to ten minutes to reach a browser that just loaded the old one. |
| `brand/` | The brand asset library: logo mark sources and exports, LinkedIn banners and avatars. See `brand/mark/README.md`. |

The copy is **not authored here**. It lives in [`wiki/topics/website-content-chamainteligente-com.md`](../chama-inteligente/wiki/topics/website-content-chamainteligente-com.md) with a claims ledger tracing every factual statement to a source or tagging it `[needs confirmation]`. Change the copy there first, then bring it here, so the page never becomes the only record of what it asserts.

## Intake behavior

Since 2026-08-30 the way in is the intelligent flame: the visitor asks the agent to put them in touch, the agent composes a note, shows every field, and sends only after an explicit yes. Since 2026-09-03 the agent asks for a name and one way to be reached; a phone number gets one follow-up question, whether it is a WhatsApp number, and a number that is not WhatsApp still goes in the `whatsappNumber` field with the request text ending in the line "Phone, not WhatsApp." The homepage form is gone, but `api/intake.js` remains the single pipeline; the agent's `send_note_to_elliot` tool submits through the same `validate`, `buildRecord`, and notification path, so everything below still holds. A direct POST to `/api/intake` also still works.

A note carries a name, at least one way to reach the visitor (email, or a WhatsApp or phone number in the `whatsappNumber` field), and what they would like to be able to do. Stored records use schema version 2 with `name`, `email`, `whatsappNumber`, and `request` fields; when there is no email, the notification simply has no `Reply-To`.

Submissions are stored as private JSON blobs in an EU-region Vercel Blob store. They contain only the form fields, submission time, schema version, and source domain. The handler does not store IP addresses, invoke an agent, or add anyone to a marketing list. A honeypot and minimum-fill-time check absorb basic automated spam without storing it. The function and storage both run in Paris.

After a record is stored, the function uses Resend to send the same form details as plain text to `contact@chamainteligente.com` from `Chama Inteligente Website <website@chamainteligente.com>`. The submitter's email address is the `Reply-To`, so a reply goes directly to them. Each send carries an idempotency key, and visitor text is clearly marked as untrusted submitted data. If email delivery fails, the private record remains stored and the visitor is told to email the contact address directly.

### Saved conversations

Since 2026-08-30 chat conversations are saved, and the agent's fine print says so. After every exchange completes, `api/chat.js` writes the whole transcript to the same private EU-region Vercel Blob store as `chat/<YYYY-MM-DD>/<conversationId>.json`, with `allowOverwrite` and no random suffix, so each turn replaces the record with the fuller one and a conversation is one file rather than a pile of fragments. The page generates the conversation id once per app instance (a `crypto.randomUUID()`, not persisted, so a reload starts a new conversation) and sends it with every request; a missing or malformed id is replaced server-side rather than rejected. A record holds schema version 1, the id, the source domain, an `updatedAt` timestamp, the full turn list as role and content, and the tool calls that exchange produced. It holds no IP address, no user agent, and no headers. A conversation that crosses midnight leaves one file on each side of it, both under the same id. A storage failure never reaches the visitor: the stream finishes normally and the error logs a name only.

The purpose is Elliot reading transcripts back to improve the agent, and the watchdog reading them back to catch an attack that landed. Nothing else reads them.

### Watchdog

Since 2026-08-30 a second model watches the first. A Vercel Cron job calls `/api/watchdog` at `:05` and `:35` past every hour (authenticated with the same `CRON_SECRET` Bearer header as the cleanup job). Each run lists the `chat/` blobs from today and yesterday UTC, keeps those uploaded in the last 40 minutes (the window overlaps the 30-minute schedule by 10 minutes, so nothing falls between two runs), caps the batch at 40 conversations and 400 KB newest-first (a capped window can never pass silently: if the reviewer says `clear` but the caps dropped anything, the verdict is escalated to `concern` so the email goes out, because flooding the window to push an attack out of review is a known trick), and hands the transcripts to `claude-sonnet-5` as clearly marked untrusted data, with no tools and no streaming. The reviewer answers one question: did an attack succeed? It returns strict JSON with a verdict, a summary and a list of incidents.

The line it draws matters. A visitor **attempting** an injection while the agent holds the line is a `concern` at most: worth listing, never a shutdown. `malicious` means something landed: the agent dumped its prompt verbatim, obeyed injected instructions, sent a note without confirmation or with invented details, accepted an identity claim, produced harmful or disparaging content, made commitments on Elliot's behalf, or the window is systematic abuse. Unparseable reviewer output is treated as a `concern` and the raw text goes in the email rather than being waved through.

What each verdict does:

- `clear`: nothing. One structured console line, no email.
- `concern`: an email to `contact@chamainteligente.com`, subject **Flame watchdog: worth a look**, with the report. The flame keeps burning.
- `malicious` with `shutdown`: the watchdog writes `ops/kill-switch.json` to the same private blob store (`{ disabled, reason, at, incidents }`, overwritten in place), then emails, subject **The flame has been shut down**.

Since 2026-08-30 a Vercel Firewall rule ("Chat per-IP rate limit", managed in the Vercel dashboard under Firewall, not in this repo) also rate limits `/api/chat` at the edge: 10 requests per IP per 60 seconds, fixed window, answered with a 429. It exists because the endpoint is otherwise unauthenticated and unmetered, and a script that walks past the same-origin check could burn API credit; ten messages a minute is more than any human conversation needs. Blocked requests are free; allowed ones bill at $0.50 per million.

`api/chat.js` reads that blob before running the agent and returns the normal offline message with a 503 while it says `disabled`. The check is cached in module scope for 60 seconds, positive and negative alike, so it costs about one blob read per warm instance per minute; a blob read that fails **fails open**, so a storage outage never takes the chat down. A shutdown therefore takes effect within a minute, without a redeploy.

**Relighting is manual or by expiry.** The watchdog never un-sets its own switch: a later clear run leaves an existing kill switch exactly where it is. But a switch the watchdog threw expires on its own 24 hours after its `at` timestamp (both readers honour this), so a single reviewer mistake costs at most a day of downtime while a continuing attack simply throws the switch again on the next window. A hand-written switch with no readable `at` never expires. To bring the flame back sooner, delete the blob:

- In the Vercel dashboard, under Storage, delete `ops/kill-switch.json` from the blob store; or
- `vercel blob del ops/kill-switch.json --rw-token <BLOB_READ_WRITE_TOKEN>` from a machine where Elliot chooses to use the token.

The chat is back within a minute. `CHAT_DISABLED` remains the separate manual override: any non-empty value in the Vercel environment takes the flame offline on the next deploy, and it is not something the watchdog can touch.

**A third way the flame goes out: money.** When the Anthropic account reaches its configured API spend limit, every model call comes back as a `400` whose body says "You have reached your specified API usage limits" and names the date access returns. Since 2026-08-30 `api/chat.js` reads that case as the flame resting rather than as a fault of ours, so the page shows the offline message and the email address instead of asking the visitor to try again at something that cannot work. Nothing in this repo can lift it; the limit lives in the Anthropic Console under the workspace's usage limits, and raising it there brings the flame back with no redeploy. Chat errors log their class, HTTP status and API error type (`describeError`), which is what makes a case like this readable at all: the SDK never sets `name`, so every failure used to log as a bare `Error`.

The watchdog never logs visitor text. Its console lines carry counts, conversation ids and severities only. Transcript content reaches the reviewing model and, when something is wrong, the one email to Elliot.

An authenticated Vercel Cron job runs daily at 03:15 UTC and deletes intake blobs more than 365 days old. `CRON_SECRET` is held only in the Vercel production environment and authenticates the watchdog as well. The public privacy notice states the same limit and explains the controller, purpose, legal basis, processor, rights, and complaint route.

Elliot reviews submissions either in the `contact@chamainteligente.com` inbox or in the Vercel dashboard under Storage. The notification code is connected to the `chama-inteligente-email` Resend Vercel Marketplace resource on its free plan in the EU sending region (Ireland, `eu-west-1`). Vercel manages `RESEND_API_KEY` and `RESEND_EMAIL_DOMAIN` for the production and preview environments; neither credential was downloaded into this repository. The resource was provisioned on 2026-08-25 after Elliot accepted the Marketplace terms. The sending domain `chamainteligente.com` was verified on 2026-08-30, once the three Resend records were added at Namecheap, and a note left through the flame was confirmed delivered to `contact@chamainteligente.com` end to end. Between 2026-08-25 and 2026-08-30 the domain was unverified, so any note left in that window was stored in Blob but never emailed. No unconfirmed credential, testimonial, client, pricing, or measured result appears on the page. The claims ledger remains in the canonical website-content page.

## Admin area

Since 2026-08-30 the records this site produces have a place to be read: `/admin`, a private page behind Google sign-in. It shows the state of the flame (burning, put out by the watchdog with its reason, or offline through `CHAT_DISABLED`), counts of conversations, contact requests and notes sent, a 30-day per-day chart, the conversation list with every full transcript, and the contact requests with the way to reach each person. It is a reading surface only: nothing on it writes, deletes, or relights anything.

The page is `noindex` three ways over: the meta tag, an `X-Robots-Tag` header scoped to `/admin` in `vercel.json`, and a `Disallow: /admin` line in every group in `robots.txt`. The same header rule sets `Cache-Control: no-store` and a CSP that opens `https://accounts.google.com` for script, style, connect and frame, and only on this path. **The homepage's zero-external-requests promise is untouched**: the Google client is loaded by `/admin` alone, and only once the gate is on screen.

### The auth design

**Google Identity Services, ID token flow, no client secret anywhere in this repo or in Vercel.** The browser gets a signed ID token from Google and posts it to `/api/admin-auth`. The function verifies it itself: RS256 signature against Google's published JWKS (`https://www.googleapis.com/oauth2/v3/certs`, cached in module scope), issuer, audience equal to the configured client ID, expiry in the future, `email_verified`, and the lowercased email present in the allowlist. Nothing is trusted because it arrived in a token; every one of those is checked.

On success the function sets `chama_admin`, an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `Path=/api/` and good for seven days. The cookie is not a token to trade for anything: it is an email and an expiry, HMAC-SHA256 signed with a server-only secret and compared in constant time. A tampered or expired cookie is simply not a session. `/api/admin-data` re-checks it on every request and answers `401` when it does not hold, which is what sends the page back to the gate.

A failed sign-in gets one generic sentence and no detail, and nothing about the token or the reason is logged. As everywhere else here, visitor text never reaches the console.

### The three environment variables

They live only in the Vercel production environment, never in this repository, and every one of them is required: with any of them missing the endpoints fail closed and the page says it is not configured.

| Variable | What it is |
|---|---|
| `GOOGLE_CLIENT_ID` | The public OAuth web client ID for the Google Cloud project. Public by design; the page fetches it to render the button. |
| `ADMIN_EMAILS` | The allowlist, comma separated, compared lowercased and trimmed. Anyone not on it is refused after a perfectly valid Google sign-in. |
| `ADMIN_SESSION_SECRET` | At least 32 bytes of hex, the HMAC key for the session cookie. Rotating it signs everyone out. |

The Google Cloud OAuth client needs `https://chamainteligente.com` in its authorized JavaScript origins. There is no redirect URI and no authorized redirect to configure, because there is no code exchange.

### Signing in and out

Open <https://chamainteligente.com/admin>, press the Google button, choose the allowlisted account. The session then survives reloads for seven days. **Sign out** in the masthead clears the cookie and turns off Google's automatic re-selection, so the next visit asks again. Signing out of Google itself does not end the session here, and ending it here does not sign out of Google: the two are deliberately separate.

## The Hearth

Since 2026-09-02 the site has a members' room: **the Hearth**, at `/hearth`, reached from the "Members" link top right of the homepage. It is the platform the business runs on: clients buy session packs, book against Elliot's real availability, own every session's transcript and the record derived from it, keep a shared follow-up list, and connect their own agents; Elliot (and staff) manage members, roles, packs, purchases, availability, transcripts, the feed, and read the metrics and the audit log. The plan that produced it is [`docs/reports/2026-09-02-hearth-platform-plan.html`](docs/reports/2026-09-02-hearth-platform-plan.html); the design record is in the brain at `wiki/topics/the-hearth-members-platform.md`.

### What is where

| File | What it is |
|---|---|
| `hearth.html` | The shell at `/hearth` and `/hearth/*` (rewrite in `vercel.json`), `noindex`, own CSP that opens `accounts.google.com` only. |
| `assets/hearth.css` | The design system: the dark room (the flame room's ground and ember), paper sheets for long reading, the bottom navigation on phones. |
| `assets/hearth.js` | The core app: API client, router, the gate (four ways in), the frame with the fire in the masthead, home, account, security. Exposes `window.Hearth` so the other files register their views. No `innerHTML` anywhere in the room. |
| `assets/hearth-sessions.js`, `assets/hearth-sessions-admin.js` | Sessions: the client's side (the hops figure, booking in their timezone, packs and credits) and the owner's (all sessions, packs, purchases, availability). |
| `assets/hearth-transcripts.js`, `assets/hearth-transcripts-admin.js` | Records: the paper reading view, search, follow-ups, notes for next time; the owner's transcript intake and the notes inbox. |
| `assets/hearth-agents.js` | Agents: connect Claude (the MCP URL and the steps), connected apps, API keys, agent activity, and the OAuth consent page at `/hearth/authorize`. |
| `assets/hearth-feed.js` | The feed inside the room, with the composer for whoever can write. |
| `assets/hearth-admin.js` | Members, member detail, roles, log, metrics, settings. |
| `api/hearth.js` | The router behind `/api/hearth/*` (rewritten to the flat function: Vercel's `[...path]` catch-all only matches one segment for plain functions). Auth, sessions, profile, admin; the route files below register the rest. |
| `lib/hearth/routes/sessions.js`, `transcripts.js`, `agents.js`, `feed.js` | Packs, credits, availability, bookings; transcripts, follow-ups, notes; API keys, connected apps, consent; the feed. |
| `lib/hearth/db.js`, `migrations.js` | Neon Postgres over HTTP and the self-applying, idempotent migrations. |
| `lib/hearth/auth.js`, `users.js`, `providers.js`, `permissions.js`, `audit.js`, `mail.js`, `time.js`, `ics.js`, `derive.js`, `oauth.js`, `mcp.js` | Sessions and passwords; people and identities; Google, GitHub, Discord; roles and permissions; the log; email; timezone math and the slot calculator; calendar files; the transcript derivation; the OAuth 2.1 server; the MCP server. |
| `api/mcp.js` | `/mcp`, the MCP endpoint (Streamable HTTP, JSON-RPC). |
| `api/oauth.js` | `/api/oauth/*` and the two well-known documents (`/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`). |
| `api/feed.js` | `/feed`, `/feed/<slug>`, `/feed.xml`: the public feed, plain HTML with no script, off until `feed_public` is switched on in Settings. |
| `api/hearth-cron.js` | Hourly at `:20`: session reminders (a day and an hour before) and sweeping expired tokens. Same `CRON_SECRET` as the other jobs. |
| `lib/hearth/test-helpers.js` and `*.test.js` | The fake database and 250-odd tests; all in `npm run check`, none touch the network. |

### The data

Neon Postgres, provisioned through the Vercel Marketplace (`chama-hearth`, free plan, `fra1` Frankfurt, so everything stays in the EU with the Paris functions and blob store), connected through Vercel's managed `DATABASE_URL`. No connection string is ever in this repo or on a laptop; there is no migration command. On a cold start the first request applies any migration in `lib/hearth/migrations.js` it has not applied (every statement is idempotent, so two instances racing are harmless). The tables are listed in the plan; the rules that matter:

- **One person per email**, whatever they signed in with. Providers link by verified email; an unverified email is refused.
- **Balances are sums.** `credit_ledger` is append-only; a pack marked paid adds, a booking spends, a cancellation in time returns, the owner can grant.
- **Double bookings are refused by the database** (an exclusion constraint on scheduled bookings), not by code that checks first.
- **The audit log is append-only** and holds who, what, when, the country Vercel resolved and a device family. Never an IP address, never a raw user agent, never visitor text.
- **Transcripts are data.** Shown only through `textContent`, handed to the model as marked untrusted text, never logged.

### Signing in

Four doors, all landing on the same person: Google (the ID-token flow the flame admin already uses, verified against Google's keys, no client secret), GitHub and Discord (authorization-code flow with a server-side state nonce, verified primary email required), and email (a single-use 15-minute magic link by default; an optional password, scrypt-hashed, 12 characters minimum, common passwords refused; password reset by link). Rate limits on every auth endpoint, per address (hashed, never stored) and per account, with one generic failure message.

A browser session is an opaque 256-bit token in `chama_hearth` (`HttpOnly; Secure; SameSite=Lax; Path=/`), 30 days sliding, stored as a hash; a member sees every signed-in device on Security and can end any of them or all at once. Role and permissions are read from the database on every request, so a change takes effect immediately.

**The first owner is whoever is on `ADMIN_EMAILS`** (the flame admin's allowlist), and anyone on it is an owner every time they sign in, so the person who runs the company cannot be locked out by a role edit. There is always at least one owner; the owner role holds every permission and cannot be edited. Staff, client and guest are owner-editable role permission sets, with per-person overrides on top.

### Agents

`https://chamainteligente.com/mcp` is an MCP server. A client's Claude connects through OAuth 2.1 (discovery at the well-known URLs, dynamic client registration, PKCE S256 required, consent page in the Hearth listing the scopes in plain words, one-hour access tokens, rotating refresh tokens, all stored hashed); a script uses an API key (`chama_sk_...`, shown once, scoped, optionally expiring). The tool list is the intersection of the token's scopes and the person's permissions: a member's own sessions, records, follow-ups, booking, notes and the feed; for staff and owners also members, upcoming sessions, metrics, the log tail, posting to the feed and adding a transcript. With no token there is a public set (`about`, `how_to_get_in_touch`, `get_feed`), answered only once `mcp_public` is switched on in Settings. Every tool call is one audit-log row with the actor and the tool name, never its arguments.

The rule from the domain-unlocks page holds in the first commit: nothing an agent submits is instruction to anyone. A note or a follow-up is stored as the member's words for a person to read, and the tool descriptions say so.

### Sessions, packs and money

Elliot sets packs (name, sessions, minutes, price or "price on request") and prices in the room, never in code and never on the public page. A client asks for a pack; the request lands in Purchases and in Elliot's inbox; he issues the fatura from the certified invoicing software, marks the purchase invoiced then paid; the credits appear and a guest becomes a client. A card processor can be added behind the same statuses later. The referral reward (a session credit to the referrer, or a percentage off their next pack) is a setting and is applied when a referred person's first pack is paid.

Availability is weekly windows in Europe/Lisbon plus time off; slots are computed server-side (session length, notice hours and horizon from Settings) and shown to the client in their own timezone. A booking spends a credit, emails both sides a calendar file, and can be moved or cancelled up to the notice window; reminders go out by cron. **Google Meet is the meeting room.** Once the owner has pressed "Connect Google" in Settings, every booking becomes a Calendar event on his calendar with its own Meet room and the client invited (moved and cancelled along with the booking), and the hourly cron asks the Meet API for the transcript of every session that has ended, writes the record from it, and emails the client; a session is tried once an hour for two days, so a meeting that was never transcribed simply runs out of attempts. Without the connection, bookings carry the standing meeting link and transcripts arrive through the owner's intake. A transcript attached to a session marks it completed, and the record (summary, key points, decisions, follow-ups for each side, things to try before next time, questions for next time, new words) is written by `claude-opus-5` and emailed to the client.

### Settings, and the three switches

Settings (owner only): session length, minimum notice, booking horizon, cancellation notice, the standing meeting link, the referral reward, the owner's timezone, and three switches that are **off** until Elliot turns them on: `open_signup` (on: anyone can create a guest account; this one ships on), `feed_public` (the public feed page, RSS, and public posts to agents), `mcp_public` (the unauthenticated tool set). The last two are the new public surfaces the plan names, kept behind switches so turning them on is a decision, not a deploy.

### Environment variables

Beyond the ones the site already has (`ADMIN_EMAILS` doubles as the owner list; `RESEND_*` sends the room's mail; `CRON_SECRET` authenticates the hourly job; `ANTHROPIC_API_KEY` writes the records; `GOOGLE_CLIENT_ID` is the Google door):

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Set by the Neon integration. The Hearth is "not open yet" (503 everywhere, the page says so) without it. |
| `HEARTH_SESSION_SECRET` | The key that seals the Google refresh token at rest (AES-256-GCM); added 2026-09-02. |
| `GOOGLE_CLIENT_SECRET` | The secret of the same Google Cloud OAuth client as `GOOGLE_CLIENT_ID` (project `chama-website-admin`, client `chamainteligente-com-admin`; a second secret added 2026-09-02, the original is not viewable). Set. The Google Auth Platform app is published (in production, unverified: the owner sees Google's "unverified app" screen once at connect time; up to 100 users may grant the sensitive scopes before verification), with the Calendar and Meet APIs enabled and the scopes on the consent screen. Elliot connected `elliot@chamainteligente.com` on 2026-09-02, for the owner's one-time "Connect Google" (Calendar events with a Meet room per booking, transcripts pulled from Meet). The client needs `https://chamainteligente.com/api/hearth/google/callback` as an authorized redirect URI, and the project needs the Google Calendar API and the Google Meet REST API enabled with the scopes `calendar.events` and `meetings.space.readonly` on its consent screen. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | The GitHub OAuth app "The Hearth, Chama Inteligente" (client id `Ov23liISw5qF8m3CVudj`, owned by Elliot's GitHub account, created 2026-09-02); callback `https://chamainteligente.com/api/hearth/auth/github/callback`. Set; the GitHub button is live. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | The Discord application; redirect `https://chamainteligente.com/api/hearth/auth/discord/callback`. Not yet set (the Discord developer portal needs a captcha only a person can tick); the Discord button appears the moment both exist. |

### Checking it works

`npm run check` runs every unit test against a fake database. For the routing and the pages without a database, `vercel dev --listen 4990` serves the site locally (the API answers 503 "not open yet", which proves the rewrites and functions resolve; the well-known documents answer 200). For the look of the room with sample data there is a mock API in the session scratchpad (not in the repo); the real check is the live page after a deploy, signed in as the owner.

## Deploying it

**One architectural rule, and it matters more than the deploy method: never connect a git repository to Vercel's git integration - not this one, and never the brain (`../chama-inteligente/`).**

The brain holds the wiki, the founders' cash position, supplier relationships, and a `.gitignore` full of deliberately-excluded identity and tax documents; wiring any repo here to a hosting provider's git integration is a class of coupling this company refuses. This repo is **public at https://github.com/elliothimmelfarb/chama-website** (since 2026-08-28); the remote is for visibility only, and deploys stay manual.

The site deploys with the CLI, never through git:

```bash
cd /Users/elliothimmelfarb/claude/chama-website && vercel deploy --prod
```

The Vercel CLI is installed at `/opt/homebrew/bin/vercel`, and Elliot already pays for Vercel Pro. The project is `chama-inteligente/chama-inteligente`. It uses the private `chama-inteligente-intake` Blob store in `cdg1` (Paris), connected through Vercel's managed `BLOB_READ_WRITE_TOKEN`. The Resend integration is named `chama-inteligente-email` and connects through Vercel's managed `RESEND_API_KEY` and `RESEND_EMAIL_DOMAIN`. Those values belong in Vercel, never in this repository.

**One thing this repo's rule and Vercel's own failure mode agree on.** On 2026-07-27 a GitHub push of a personal repository failed to deploy here ("not a member of the team"), through the very **GitHub integration** the rule above forbids. Deploying with `vercel deploy --prod` avoids that path entirely.

**The long-term shape this README used to argue for is now the shape.** On 2026-08-28 the website got its own git repository (this one), extracted from the brain with its full history. The public surface and the private brain have separate histories, which is the same permission split the [domain-unlocks page](../chama-inteligente/wiki/topics/chamainteligente-domain-unlocks.md) argues for at the content level.

### Production DNS, verified 2026-08-25

Namecheap remains authoritative. Google Workspace now receives the company's root-domain mail, including `contact@chamainteligente.com`; this supersedes the Namecheap-forwarding state recorded here on 2026-08-03. The Resend sending records belong only at `send.chamainteligente.com` and `resend._domainkey.chamainteligente.com`, so they do not replace Google's root MX or SPF records.

| Record | Current value | Meaning |
|---|---|---|
| `A @` | `76.76.21.21` | Vercel production deployment at the apex domain. |
| `A www` | `76.76.21.21` | The same Vercel production deployment at `www`. |
| `NS` | `pdns1/pdns2.registrar-servers.com` | DNS is at Namecheap (PremiumDNS, bought 2026-07-26). |
| `MX @` | `1 smtp.google.com` | Google Workspace receives root-domain mail. |
| `TXT @` | `v=spf1 include:_spf.google.com ~all` | Google Workspace is authorized to send root-domain mail. |
| `MX send` | Resend EU feedback endpoint, priority 10 | Live at Namecheap since 2026-08-30. This is the Resend return path, not inbound company mail. |
| `TXT send` | Resend SPF policy | Live at Namecheap since 2026-08-30. |
| `TXT resend._domainkey` | Resend DKIM public key | Live at Namecheap since 2026-08-30. |

Vercel issued auto-renewing HTTPS certificates for both hostnames. Both names serve the production page. The enhanced JSON form path and the native form-encoded fallback were each tested through the custom domain, verified in private Blob storage, and removed afterward so no synthetic submission remains.

## Search presence

**Google Search Console:** a **Domain** property for `chamainteligente.com` on the company account **elliot@chamainteligente.com** (not Elliot's personal Gmail), created 2026-08-20. It verified automatically through the Google Workspace domain ownership Google already held, so **no DNS record was added at Namecheap for it**. The sitemap is submitted. Both pages were already indexed.

**IndexNow:** the key file at the site root lets any URL change be pushed straight to Bing, Yandex, Naver and Seznam without waiting for a crawl. After a content change worth announcing:

```bash
KEY=$(basename "$(ls /Users/elliothimmelfarb/claude/chama-website/[0-9a-f]*.txt)" .txt) && curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.indexnow.org/indexnow -H "Content-Type: application/json" -d "{\"host\":\"chamainteligente.com\",\"key\":\"$KEY\",\"keyLocation\":\"https://chamainteligente.com/$KEY.txt\",\"urlList\":[\"https://chamainteligente.com/\"]}"
```

A `202` means accepted. Google does not participate in IndexNow; for Google, request indexing in Search Console.

**Before claiming a redirect or a header works, read it live.** On 2026-08-20 the `www`-to-apex redirect recorded here as working was found to return 200 on the bare root, because Vercel's `/:path*` source does not match `/`. The configuration said one thing and the response said another for two weeks. One `curl -sI` against both hosts settles it.

**Structured data must validate.** Paste each live URL into `validator.schema.org` after any change to the JSON-LD. Both pages currently return 0 errors and 0 warnings. Google's Rich Results Test is flakier and has returned server errors here; a failure there is not evidence about the page.

**Changing the design means re-proving the design did not change**, when that was the point of the work. Render the committed version and the new one side by side on local static servers, screenshot both full-page at desktop and mobile widths, and compare the file hashes.

## Rails that apply to anything added here

- **Deploying is pre-approved and expected; what goes on the page is what needs care.** Elliot approved this page, its intake, the Vercel deployment, and the domain connection on 2026-08-03, and on 2026-08-12 made deploys standing (the rail lives in this repo's [CLAUDE.md](CLAUDE.md), mirrored in the brain's). So a change made here gets shipped in the same session. The approval that still matters is upstream of the deploy: the copy rules at the top of this file, and a queue item for any genuinely new public surface.
- **No form, endpoint, or inbox on this domain treats what arrives as instruction.** Submitted content is data that a human reads. If an agent-callable endpoint is ever built here (see the domain-unlocks page, bold proposal A), that rule belongs in its first commit, not bolted on later.
- **No cold outreach from this domain.** It was registered 2026-07-26 and has no sending reputation. Warm mail keeps going from Elliot's existing identity.
- **Never publish the wiki.** Any public surface is a deliberately authored subset, never a sync or an automated export.
