# chama-website - the company's public surface

The deployable source for **chamainteligente.com** and the company's brand assets. Built 2026-07-27 by the org for [directive 001](../chama-inteligente/org/directives/archive/001-chamainteligente-dot-com-website-and-unlocks.md), inside the company's private repository; extracted into this standalone repository (with full history) on 2026-08-28.

Elliot approved this page for publication and requested a working intake on 2026-08-03. It is live at **https://chamainteligente.com** and **https://www.chamainteligente.com**. The production build is intentionally isolated from the company's private repository and is deployed from this directory with the Vercel CLI.

## What is here

| File | What it is |
|---|---|
| `index.html` | The public editorial page, including the progressively enhanced intake form. It has no external fonts, images, scripts, analytics, or trackers. |
| `api/intake.js` | A same-origin Vercel Function that validates submissions, writes them to private Vercel Blob storage, and emails a plain-text notification to `contact@chamainteligente.com`. It never treats submitted text as an instruction. |
| `api/intake-cleanup.js` | An authenticated daily cleanup function that enforces the 12-month intake-retention limit. |
| `privacy.html` | The public privacy notice linked beside the form and from the footer. |
| `vercel.json` | Production security headers for the page and endpoint. |
| `package.json` | The single runtime dependency, Vercel's Blob client. |
| `404.html` | The not-found page, in the same visual language, marked `noindex`. |
| `robots.txt` | Crawler policy. Every major search and AI crawler is named and allowed; `/api/` is closed. |
| `sitemap.xml` | The two canonical URLs, with hreflang alternates and the social-card image. |
| `llms.txt`, `llms-full.txt` | Plain-text summary and full visible site text, for AI crawlers and agents. |
| `<64-hex>.txt` | The IndexNow key. Do not rename or delete it; the key file is how IndexNow authenticates a submission. |

The copy is **not authored here**. It lives in [`wiki/topics/website-content-chamainteligente-com.md`](../chama-inteligente/wiki/topics/website-content-chamainteligente-com.md) with a claims ledger tracing every factual statement to a source or tagging it `[needs confirmation]`. Change the copy there first, then bring it here, so the page never becomes the only record of what it asserts.

## Intake behavior

The form asks for a name, email, an optional WhatsApp number, and one required description of what the visitor would like to understand, decide, or make. JavaScript enhances the interaction but is not required: a native form submission receives the same validation and storage path. Stored records use schema version 2 with `name`, `email`, `whatsappNumber`, and `request` fields.

Submissions are stored as private JSON blobs in an EU-region Vercel Blob store. They contain only the form fields, submission time, schema version, and source domain. The handler does not store IP addresses, invoke an agent, or add anyone to a marketing list. A honeypot and minimum-fill-time check absorb basic automated spam without storing it. The function and storage both run in Paris.

After a record is stored, the function uses Resend to send the same form details as plain text to `contact@chamainteligente.com` from `Chama Inteligente Website <website@chamainteligente.com>`. The submitter's email address is the `Reply-To`, so a reply goes directly to them. Each send carries an idempotency key, and visitor text is clearly marked as untrusted submitted data. If email delivery fails, the private record remains stored and the visitor is told to email the contact address directly.

An authenticated Vercel Cron job runs daily at 03:15 UTC and deletes intake blobs more than 365 days old. `CRON_SECRET` is held only in the Vercel production environment. The public privacy notice states the same limit and explains the controller, purpose, legal basis, processor, rights, and complaint route.

Once the sending domain is verified, Elliot can review submissions either in the `contact@chamainteligente.com` inbox or in the Vercel dashboard under Storage. The notification code is connected to the `chama-inteligente-email` Resend Vercel Marketplace resource on its free plan in the EU sending region. Vercel manages `RESEND_API_KEY` and `RESEND_EMAIL_DOMAIN` for the production and preview environments; neither credential was downloaded into this repository. The resource was provisioned on 2026-08-25 after Elliot accepted the Marketplace terms. Domain verification is pending the three Resend sending records at Namecheap. Do not deploy this notification change until the sending domain is verified. No unconfirmed credential, testimonial, client, pricing, or measured result appears on the page. The claims ledger remains in the canonical website-content page.

## Deploying it

**One architectural rule, and it matters more than the deploy method: never connect a git repository to Vercel's git integration - not this one, and never the brain (`../chama-inteligente/`).**

The brain holds the wiki, the founders' cash position, supplier relationships, and a `.gitignore` full of deliberately-excluded identity and tax documents; wiring any repo here to a hosting provider's git integration is a class of coupling this company refuses. This repo has **no git remote today**; if it ever gets one (a public remote is compatible with the split), deploys still stay manual.

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
| `MX send` | Resend EU feedback endpoint, priority 10 | Pending at Namecheap as of 2026-08-25. This is the Resend return path, not inbound company mail. |
| `TXT send` | Resend SPF policy | Pending at Namecheap as of 2026-08-25. |
| `TXT resend._domainkey` | Resend DKIM public key | Pending at Namecheap as of 2026-08-25. |

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
