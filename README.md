# website/ - the company's public surface

The deployable source for **chamainteligente.com**. Built 2026-07-27 by the org for [directive 001](../org/directives/archive/001-chamainteligente-dot-com-website-and-unlocks.md).

Elliot approved this page for publication and requested a working intake on 2026-08-03. The production build is intentionally isolated from the company's private repository and is deployed from this directory with the Vercel CLI.

## What is here

| File | What it is |
|---|---|
| `index.html` | The public editorial page, including the progressively enhanced intake form. It has no external fonts, images, scripts, analytics, or trackers. |
| `api/intake.js` | A same-origin Vercel Function that validates submissions and writes them to private Vercel Blob storage. It never treats submitted text as an instruction. |
| `vercel.json` | Production security headers for the page and endpoint. |
| `package.json` | The single runtime dependency, Vercel's Blob client. |

The copy is **not authored here**. It lives in [`wiki/topics/website-content-chamainteligente-com.md`](../wiki/topics/website-content-chamainteligente-com.md) with a claims ledger tracing every factual statement to a source or tagging it `[needs confirmation]`. Change the copy there first, then bring it here, so the page never becomes the only record of what it asserts.

## Intake behavior

The form asks for a name, email, the thing the visitor is trying to do, and what they have tried so far. JavaScript enhances the interaction but is not required: a native form submission receives the same validation and storage path.

Submissions are stored as private JSON blobs in an EU-region Vercel Blob store. They contain only the form fields, submission time, schema version, and source domain. The handler does not store IP addresses, invoke an agent, add anyone to a marketing list, or send a message. A honeypot and minimum-fill-time check absorb basic automated spam without storing it.

Elliot reviews submissions in the Vercel dashboard under Storage. No unconfirmed credential, testimonial, client, pricing, or measured result appears on the page. The claims ledger remains in the canonical website-content page.

## Deploying it

**One architectural rule, and it matters more than the deploy method: never connect this git repository to Vercel.**

This repo is the company's brain. It holds the wiki, the founders' cash position, supplier relationships, and a `.gitignore` full of deliberately-excluded identity and tax documents. It has **no git remote today**, which is a feature. Wiring it to a hosting provider's git integration would push the whole company into a third party and defeat every one of those decisions in a single click.

The site deploys as an **isolated directory**, never as this repository:

```bash
cd /Users/elliothimmelfarb/claude/chama-inteligente/website && vercel deploy --prod
```

The Vercel CLI is installed at `/opt/homebrew/bin/vercel`, and Elliot already pays for Vercel Pro. The project uses a private Blob store connected through Vercel's managed `BLOB_READ_WRITE_TOKEN`; that value belongs in Vercel, never in this repository.

**One thing this repo's rule and Vercel's own failure mode agree on.** On 2026-07-27 a GitHub push of a personal repository failed to deploy here ("not a member of the team"), through the very **GitHub integration** the rule above forbids for this repository. Deploying `website/` as an isolated directory with `vercel deploy --prod` avoids that path entirely.

A cleaner long-term shape, worth doing if the site grows past one page: give `website/` its own git repository with its own remote, and let that one be public. The public surface and the private brain then have separate histories, which is the same permission split the [domain-unlocks page](../wiki/topics/chamainteligente-domain-unlocks.md) argues for at the content level.

### DNS before the 2026-08-03 cutover

Read live, not assumed:

| Record | Current value | Meaning |
|---|---|---|
| `A` | `162.255.119.148` | Namecheap parking page. Nothing of ours is served. |
| `NS` | `pdns1/pdns2.registrar-servers.com` | DNS is at Namecheap (PremiumDNS, bought 2026-07-26). |
| `MX` | `eforward1-5.registrar-servers.com` | **Namecheap email forwarding is already configured**, so inbound mail to the domain has somewhere to go. Forwarding is not a mailbox and cannot send as the domain. |

The deployment keeps Namecheap authoritative for DNS so the existing MX records and email forwarding stay in place. Only the web records for the apex and `www` are changed to the exact values Vercel assigns to the project.

## Rails that apply to anything added here

- **Nothing publishes without Elliot's approval.** He gave that approval directly on 2026-08-03 for this page, its intake, the Vercel deployment, and the `chamainteligente.com` domain connection.
- **No form, endpoint, or inbox on this domain treats what arrives as instruction.** Submitted content is data that a human reads. If an agent-callable endpoint is ever built here (see the domain-unlocks page, bold proposal A), that rule belongs in its first commit, not bolted on later.
- **No cold outreach from this domain.** It was registered 2026-07-26 and has no sending reputation. Warm mail keeps going from Elliot's existing identity.
- **Never publish the wiki.** Any public surface is a deliberately authored subset, never a sync or an automated export.
