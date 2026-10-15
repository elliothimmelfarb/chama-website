# chama-website

The deployable source for **https://chamainteligente.com** (and `www.`), plus the company's brand assets. This repository is public. The company's private repository, the wiki and the history of the site's copy live in `../chama-inteligente/`, which is never connected to any hosting provider.

## What is here

| File | What it is |
|---|---|
| `index.html`, `coaching.html`, `about.html` | The three public pages at `/`, `/coaching` and `/about`, in the animated version. They carry the full search and sharing metadata (canonical, hreflang, Open Graph, JSON-LD) and are the URLs in the sitemap. The home page ends in the flame room. `/coaching` holds the Members link into the Hearth. |
| `simple.html`, `simple/coaching.html`, `simple/about.html` | The low motion version of the same three pages at `/simple/*`: the same copy as plain pages. They canonicalise to their animated counterparts and are not in the sitemap. |
| `assets/worlds.css`, `assets/worlds.js`, `assets/sky.js` | The animated version's engine. Each `<section class="world">` names its ground (`data-world`) and figure (`data-scene`). `sky.js` paints the ground with one WebGL shader, `worlds.js` draws the figures and writes `--u` per section, which every `.r` element reads against its own `--in` and `--out`, so the choreography lives in the markup. `worlds.js` also runs the site nav and moves between the three pages without a full load. |
| `assets/site.css` | The low motion pages' shared stylesheet. The footer is repeated in each low motion page and `privacy.html`; change all four together. |
| `assets/figures.css`, `assets/figures.js` | The section figures' motion system for the low motion pages and `privacy.html`. Without JavaScript or under reduced motion every figure is drawn complete. |
| `agent.html`, `assets/agent.js`, `assets/agent.css` | The intelligent flame, the live chat agent: full screen at `/agent`, embedded in the home page with `ChamaAgent.mount(root, { mode: "page" \| "embed" })`. Vanilla, no libraries. |
| `assets/flame.js`, `assets/flame-worker.js` | The fire engine. On touch devices with OffscreenCanvas it runs in a Web Worker so it never shares a thread with scrolling or typing. |
| `api/chat.js`, `api/chat-prompt.js` | The agent endpoint (same origin, SSE streaming, two tools: `send_note_to_elliot` and `adjust_experience`) and its frozen system prompt, which is reviewed like copy. |
| `evals/` | Prompt-injection and quality evals. `npm run evals` spends API credit and is not part of `npm run check`. |
| `api/intake.js`, `api/intake-cleanup.js` | The contact pipeline and its daily 12-month retention cleanup. |
| `api/watchdog.js` | The cron job that reviews conversations and can put the flame out. |
| `admin.html`, `assets/admin.*`, `api/admin-auth.js`, `api/admin-data.js` | The private, read-only admin area at `/admin`. |
| `hearth.html`, `assets/hearth*`, `api/hearth.js`, `api/mcp.js`, `api/oauth.js`, `api/feed.js`, `api/hearth-cron.js`, `lib/hearth/` | The Hearth, the members' platform. See [The Hearth](#the-hearth). |
| `privacy.html` | The privacy notice. |
| `404.html`, `assets/sparks.js` | The not-found page, with a small catch-the-sparks game. |
| `vercel.json` | Headers, redirects, rewrites and cron schedules. |
| `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt` | Crawler policy, the canonical URLs, and the site text for AI crawlers. |
| `<64-hex>.txt` | The IndexNow key file. Do not rename or delete it. |
| `assets/` images | Page images with resized `srcset` variants. Root-level images (`og-*.png`, favicons) stay at root because they are cached externally at those URLs. |
| `brand/` | Logo sources and exports, banners, avatars. `brand/og/` renders the link preview card. See `brand/mark/README.md`. |

Every public page makes zero external requests. `test/pages.test.js` holds that rule, the navigation rules and the sitemap rules.

## Copy

Copy is written here. The brain keeps its history and the reasons for each change in `wiki/topics/website-content-chamainteligente-com.md`. These retired lines must not come back: "Your process, your words, your rules", "Your business, your rules", "whenever you ask", the export line, and the olden-days framing.

## The flame

### Saved conversations

After every exchange, `api/chat.js` writes the whole transcript to the private EU Blob store as `chat/<YYYY-MM-DD>/<conversationId>.json`, overwriting in place so one conversation is one file. The page makes the id once per load. A record holds the turns and tool calls only: no IP, no user agent, no headers. A storage failure never reaches the visitor. Only Elliot and the watchdog read them.

### Watchdog

A cron calls `/api/watchdog` at `:05` and `:35` past each hour, authenticated with `CRON_SECRET`. It reviews conversations uploaded in the last 40 minutes (capped at 40 conversations and 400 KB) with a second model that has no tools, and gets back a verdict:

- `clear`: nothing happens.
- `concern`: an email to `contact@chamainteligente.com`, "Flame watchdog: review needed". An attempted injection the agent resisted is a concern at most. Unparseable output and a capped window also count as a concern.
- `malicious`: something landed. The watchdog writes `ops/kill-switch.json` to the blob store and emails "The flame has been shut down".

The watchdog never logs visitor text.

### Putting the flame out and relighting it

The flame goes out in three ways:

- **The kill switch.** `api/chat.js` checks `ops/kill-switch.json` (cached 60 seconds, fails open) and answers with the offline message while it says `disabled`. A switch the watchdog threw expires 24 hours after its `at`. To relight sooner, delete `ops/kill-switch.json` from the blob store in the Vercel dashboard. The chat is back within a minute.
- **`CHAT_DISABLED`.** Any value in the Vercel environment takes the flame offline on the next deploy. Only a person sets or clears it.
- **The API spend limit.** When the Anthropic account hits its limit, the page shows the offline message. Raise the limit in the Anthropic Console. No deploy is needed.

A Vercel Firewall rule in the dashboard (not in this repo) limits `/api/chat` to 10 requests per IP per minute.

## Intake

The flame's `send_note_to_elliot` tool and a direct POST to `/api/intake` both go through `api/intake.js`. A note has a name, one way to reach the visitor (email, or a number in `whatsappNumber`; a phone that is not WhatsApp ends the request with "Phone, not WhatsApp."), and the request. Records are private JSON blobs (schema version 2) in the EU Blob store, with no IP address. Resend then emails the note to `contact@chamainteligente.com` from `website@chamainteligente.com`, with the visitor's email as `Reply-To` and the visitor's text marked as untrusted. If the email fails, the record stays stored and the visitor is told to write directly. A honeypot and a minimum fill time absorb basic spam.

## Admin area

`/admin` is behind Google sign-in and only reads: flame status, counts, a 30-day chart, full transcripts and contact requests. Every value reaches the page through `textContent`. It is `noindex` by meta tag, header and `robots.txt`, and only this path's CSP opens `accounts.google.com`.

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
| `hearth.html` | The shell for `/hearth/*`, `noindex`, with its own CSP. |
| `assets/hearth.js`, `assets/hearth.css` | The core app (router, sign-in, frame, account) and design. No `innerHTML` anywhere in the room. |
| `assets/hearth-*.js` | One file per area: sessions, transcripts, agents, feed, admin, each with an `-admin` file where the owner's side differs. |
| `api/hearth.js` | The router behind `/api/hearth/*`. The routes are in `lib/hearth/routes/`. |
| `lib/hearth/` | Database and migrations, auth, users, providers, permissions, audit, mail, time and slots, calendar files, transcript records, the OAuth server and the MCP server. |
| `api/mcp.js`, `api/oauth.js` | `/mcp` and the OAuth 2.1 endpoints with their well-known documents. |
| `api/feed.js` | The public feed at `/feed` and `/feed.xml`, off until `feed_public` is on. |
| `api/hearth-cron.js` | Hourly at `:20`: reminders, Meet transcript pulls, expired token sweep. |

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

`https://chamainteligente.com/mcp` is an MCP server. Claude connects with OAuth 2.1 (dynamic registration, PKCE, a consent page in the Hearth). Scripts use scoped API keys (`chama_sk_...`). The tools a caller gets are the intersection of the token's scopes and the person's permissions. The unauthenticated tools answer only when `mcp_public` is on. Nothing an agent submits is treated as an instruction to anyone.

### Sessions and money

Packs and prices are set in the room, never in code. A client requests a pack, Elliot issues the fatura from the certified invoicing software, marks the purchase invoiced and then paid, and the credits appear.

Each member pays one of two ways, set on their member page under How they pay (`users.billing`). Pre-buy (`prebuy`, the default) members need a credit to book, and the server refuses a booking without one. Billed after (`after`) members book any open time without credits; their held sessions wait under Purchases, To invoice, until marked invoiced (`bookings.billing`, `bookings.invoiced_at`). The rule lives in `POST /bookings`, so the MCP `book_session` tool follows it too.

Availability is painted on a weekly grid of half hours in the owner's zone (each painted run is one row in `availability_rules`). Under it, the coming weeks as dates: a day can be taken off (a whole-day block), given extra time (`availability_openings`), or blocked in part, and the panel shows exactly which times members are offered (`GET /admin/slots`, the same calculator they use). When Google is connected, the coming weeks also show the events on Elliot's Google calendars (titles only on the owner's side), and with Block booking on (`google_busy`, default on) members are not offered times that overlap them. The calendars read are `google_calendars` (default the connected account's `primary`); another account's calendar must be shared with the connected account first. Events are read with the existing `calendar.events` scope, cached two minutes per instance, and a failed read blocks nothing. Members book from a strip of days that glow by how open they are, see the chosen day as a daylight bar, and confirm with the cost spelled out. Booking emails both sides a calendar file. Once the owner connects Google in Settings, each booking gets a Calendar event with a Meet room, and the hourly cron pulls the Meet transcript after the session and writes the record.

Through MCP, `add_transcript` with `draft` attaches a transcript without writing the record or telling the member, and `write_record` writes it without mail, so the owner can read a record before the client is told. Without `draft`, adding a transcript writes the record and emails the member.

A record can also be written by hand (`set_record`, version 2 of the record shape in `lib/hearth/record.js`): the short version, a big-picture figure, the ideas as chapters with their own figures and the client's words, a playbook of actions with steps and prompts to copy, what is agreed, and what the next session is for. The playbook's actions become the client's follow-ups. Figures are SVGs keyed per record (`set_record_figure`, table `record_figures`), served from `/api/hearth/transcripts/<id>/figures/<key>` only to people who may read the record, shown through `<img>` so they cannot run, and refused on upload if they hold script, event handlers or any link that leaves the file (`lib/hearth/visual.js`).

Remember cards are spaced repetition for a record (`set_record_cards`, table `recall_cards`). A card comes back after 1, 3, 7, 16 and 35 days: "Got it" climbs a step, "Fuzzy" holds, "Missed it" starts over, and a card answered well at the top retires (`lib/hearth/recall.js`). Members review on the record, on the Remember page, and see the count due on Home.

An owner can view the room as any member (a member's page, or "See this as ... sees it" on a record). Their nav, Home, records and cards render exactly as the member's, under a banner with the way out. A second cookie names the member and means something only alongside an owner's session, every change is refused while it is set, and starting and ending a view are logged.

Settings has three switches, each a decision rather than a deploy: `open_signup`, `feed_public`, `mcp_public`.

### Environment variables

The Hearth also uses `ADMIN_EMAILS`, `RESEND_*`, `CRON_SECRET`, `ANTHROPIC_API_KEY` and `GOOGLE_CLIENT_ID` from above.

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Set by the Neon integration. Without it the Hearth answers "not open yet". |
| `HEARTH_SESSION_SECRET` | Seals the Google refresh token at rest. |
| `GOOGLE_CLIENT_SECRET` | The same Google OAuth client as `GOOGLE_CLIENT_ID`. Needs the redirect URI `https://chamainteligente.com/api/hearth/google/callback`, the Calendar and Meet REST APIs, and the scopes `calendar.events` and `meetings.space.readonly`. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | The GitHub OAuth app. Callback `https://chamainteligente.com/api/hearth/auth/github/callback`. |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | The Discord app. Redirect `https://chamainteligente.com/api/hearth/auth/discord/callback`. The Discord button appears once both are set. |

## Checking and deploying

`npm run check` syntax-checks every shipped script and runs every unit test against a fake database, with no network. `vercel dev --listen 4990` serves the site locally; without a database the Hearth API answers 503, which still proves the routing.

Merging to `main` deploys through Vercel's GitHub integration (project `chama-inteligente/chama-inteligente`), and PRs get preview URLs. Do not run `vercel deploy` by hand. `.vercelignore` keeps `docs/`, `evals/` and `test/` out of every deploy, so internal reports live only on GitHub.

Storage and email are Vercel resources: the private Blob store `chama-inteligente-intake` in Paris (`BLOB_READ_WRITE_TOKEN`) and the Resend integration `chama-inteligente-email` (`RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`). Their values live only in Vercel. Crons: intake cleanup daily at 03:15 UTC, the watchdog at `:05` and `:35`, the Hearth at `:20`.

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

- **Sitemap.** In the same PR as a content change, bump the `<lastmod>` of every page it touched.
- **IndexNow.** After a change worth announcing, push it to Bing and the others. A `202` means accepted. Google does not take IndexNow; use Request indexing in Search Console (Domain property on `elliot@chamainteligente.com`).

```bash
KEY=$(basename "$(ls [0-9a-f]*.txt)" .txt) && curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.indexnow.org/indexnow -H "Content-Type: application/json" -d "{\"host\":\"chamainteligente.com\",\"key\":\"$KEY\",\"keyLocation\":\"https://chamainteligente.com/$KEY.txt\",\"urlList\":[\"https://chamainteligente.com/\"]}"
```

- **Structured data.** After a JSON-LD change, check each live URL at `validator.schema.org`.
