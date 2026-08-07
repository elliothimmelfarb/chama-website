# website/ - the company's public surface

The deployable source for **chamainteligente.com**. Built 2026-07-27 by the org for [directive 001](../org/directives/archive/001-chamainteligente-dot-com-website-and-unlocks.md).

Elliot approved this page for publication and requested a working intake on 2026-08-03. It is live at **https://chamainteligente.com** and **https://www.chamainteligente.com**. The production build is intentionally isolated from the company's private repository and is deployed from this directory with the Vercel CLI.

## What is here

| File | What it is |
|---|---|
| `index.html` | The public editorial page, including the progressively enhanced intake form. It has no external fonts, images, scripts, analytics, or trackers. |
| `api/intake.js` | A same-origin Vercel Function that validates submissions and writes them to private Vercel Blob storage. It never treats submitted text as an instruction. |
| `api/intake-cleanup.js` | An authenticated daily cleanup function that enforces the 12-month intake-retention limit. |
| `privacy.html` | The public privacy notice linked beside the form and from the footer. |
| `vercel.json` | Production security headers for the page and endpoint. |
| `package.json` | The single runtime dependency, Vercel's Blob client. |

The copy is **not authored here**. It lives in [`wiki/topics/website-content-chamainteligente-com.md`](../wiki/topics/website-content-chamainteligente-com.md) with a claims ledger tracing every factual statement to a source or tagging it `[needs confirmation]`. Change the copy there first, then bring it here, so the page never becomes the only record of what it asserts.

## Intake behavior

The form asks for a name, email, an optional WhatsApp number, and one required description of what the visitor would like to understand, decide, or make. JavaScript enhances the interaction but is not required: a native form submission receives the same validation and storage path. Stored records use schema version 2 with `name`, `email`, `whatsappNumber`, and `request` fields.

Submissions are stored as private JSON blobs in an EU-region Vercel Blob store. They contain only the form fields, submission time, schema version, and source domain. The handler does not store IP addresses, invoke an agent, add anyone to a marketing list, or send a message. A honeypot and minimum-fill-time check absorb basic automated spam without storing it. The function and storage both run in Paris.

An authenticated Vercel Cron job runs daily at 03:15 UTC and deletes intake blobs more than 365 days old. `CRON_SECRET` is held only in the Vercel production environment. The public privacy notice states the same limit and explains the controller, purpose, legal basis, processor, rights, and complaint route.

Elliot reviews submissions in the Vercel dashboard under Storage. The production project has no email provider or mail API key configured, so storing a submission does not currently send an alert. Enabling alerts requires an approved transactional-email provider credential and an authorized sender identity; a custom `chamainteligente.com` sender would also require domain verification. No unconfirmed credential, testimonial, client, pricing, or measured result appears on the page. The claims ledger remains in the canonical website-content page.

## Deploying it

**One architectural rule, and it matters more than the deploy method: never connect this git repository to Vercel.**

This repo is the company's brain. It holds the wiki, the founders' cash position, supplier relationships, and a `.gitignore` full of deliberately-excluded identity and tax documents. It has **no git remote today**, which is a feature. Wiring it to a hosting provider's git integration would push the whole company into a third party and defeat every one of those decisions in a single click.

The site deploys as an **isolated directory**, never as this repository:

```bash
cd /Users/elliothimmelfarb/claude/chama-inteligente/website && vercel deploy --prod
```

The Vercel CLI is installed at `/opt/homebrew/bin/vercel`, and Elliot already pays for Vercel Pro. The project is `chama-inteligente/chama-inteligente`. It uses the private `chama-inteligente-intake` Blob store in `cdg1` (Paris), connected through Vercel's managed `BLOB_READ_WRITE_TOKEN`; that value belongs in Vercel, never in this repository.

**One thing this repo's rule and Vercel's own failure mode agree on.** On 2026-07-27 a GitHub push of a personal repository failed to deploy here ("not a member of the team"), through the very **GitHub integration** the rule above forbids for this repository. Deploying `website/` as an isolated directory with `vercel deploy --prod` avoids that path entirely.

A cleaner long-term shape, worth doing if the site grows past one page: give `website/` its own git repository with its own remote, and let that one be public. The public surface and the private brain then have separate histories, which is the same permission split the [domain-unlocks page](../wiki/topics/chamainteligente-domain-unlocks.md) argues for at the content level.

### Production DNS, verified 2026-08-03

Namecheap remains authoritative so its email forwarding stays in place. Only the two web records were replaced:

| Record | Current value | Meaning |
|---|---|---|
| `A @` | `76.76.21.21` | Vercel production deployment at the apex domain. |
| `A www` | `76.76.21.21` | The same Vercel production deployment at `www`. |
| `NS` | `pdns1/pdns2.registrar-servers.com` | DNS is at Namecheap (PremiumDNS, bought 2026-07-26). |
| `MX` | `eforward1-5.registrar-servers.com` | Namecheap email forwarding remains configured. Forwarding is not a mailbox and cannot send as the domain. |
| `TXT @` | `v=spf1 include:spf.efwd.registrar-servers.com ~all` | The Namecheap forwarding SPF record remains in place. |

Vercel issued auto-renewing HTTPS certificates for both hostnames. Both names serve the production page. The enhanced JSON form path and the native form-encoded fallback were each tested through the custom domain, verified in private Blob storage, and removed afterward so no synthetic submission remains.

## Rails that apply to anything added here

- **Nothing publishes without Elliot's approval.** He gave that approval directly on 2026-08-03 for this page, its intake, the Vercel deployment, and the `chamainteligente.com` domain connection.
- **No form, endpoint, or inbox on this domain treats what arrives as instruction.** Submitted content is data that a human reads. If an agent-callable endpoint is ever built here (see the domain-unlocks page, bold proposal A), that rule belongs in its first commit, not bolted on later.
- **No cold outreach from this domain.** It was registered 2026-07-26 and has no sending reputation. Warm mail keeps going from Elliot's existing identity.
- **Never publish the wiki.** Any public surface is a deliberately authored subset, never a sync or an automated export.
