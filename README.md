# website/ - the company's public surface

The deployable source for **chamainteligente.com**. Built 2026-07-27 by the org for [directive 001](../org/directives/archive/001-chamainteligente-dot-com-website-and-unlocks.md).

**Nothing here is live.** As of 2026-07-27 the domain still serves the Namecheap parking page. Publishing is a hard rail: it needs an approved owner-queue item and Elliot's own click.

## What is here

| File | What it is |
|---|---|
| `index.html` | The staged 2026-08-03 replacement. A static, editorial page centered on what the client learns and keeps, with one founder section explaining the depth behind Elliot's judgment. Self-contained: no external fonts, scripts, images, or network calls. It uses no JavaScript and preserves its reading order at every viewport. An ember-colored rule and two restrained text accents are its only flame references. |

The copy is **not authored here**. It lives in [`wiki/topics/website-content-chamainteligente-com.md`](../wiki/topics/website-content-chamainteligente-com.md) with a claims ledger tracing every factual statement to a source or tagging it `[needs confirmation]`. Change the copy there first, then bring it here, so the page never becomes the only record of what it asserts.

## The staging markers

`index.html` opens with a `<div class="staging">` block that says the page is staged, contact is not open, and nothing is live. The invitation ends with a disabled contact control and states that nothing is sent. Both markers stay until Elliot has approved publishing and chosen the contact route.

No unconfirmed credential, founder biography, email address, calendar link, testimonial, client, pricing, or measured result appears in the staged page. The full pre-publication decision list and claims ledger remain in the canonical website-content page.

## Deploying it, when it is approved

**One architectural rule, and it matters more than the deploy method: never connect this git repository to Vercel.**

This repo is the company's brain. It holds the wiki, the founders' cash position, supplier relationships, and a `.gitignore` full of deliberately-excluded identity and tax documents. It has **no git remote today**, which is a feature. Wiring it to a hosting provider's git integration would push the whole company into a third party and defeat every one of those decisions in a single click.

So the site deploys as an **isolated directory**, never as this repository:

```bash
cd /Users/elliothimmelfarb/claude/chama-inteligente/website && vercel deploy --prod
```

The Vercel CLI is already installed (`/opt/homebrew/bin/vercel`) and Elliot already pays for a Vercel workspace, so hosting is a sunk cost rather than a new one. **Priced 2026-07-28: the plan is Pro at USD 22.11/month**, first charged 2026-07-27 ([`wiki/sources/2026-07-27-vercel-pro-receipt.md`](../wiki/sources/2026-07-27-vercel-pro-receipt.md), [`wiki/entities/vercel.md`](../wiki/entities/vercel.md)). **So no upgrade is needed to deploy this folder**, and the earlier warning that a deploy-time upgrade might come back as its own owner decision is retired. `[inferred]` Pro is also the tier that permits commercial use where the free Hobby tier does not; confirm on the plan page at deploy time rather than assuming. The serverless-endpoint half is still unverified but is inside Pro's normal scope `[inferred]`.

**One thing this repo's rule and Vercel's own failure mode agree on.** On 2026-07-27 a GitHub push of a personal repository failed to deploy here ("not a member of the team"), through the very **GitHub integration** the rule above forbids for this repository. Deploying `website/` as an isolated directory with `vercel deploy --prod` avoids that path entirely.

A cleaner long-term shape, worth doing if the site grows past one page: give `website/` its own git repository with its own remote, and let that one be public. The public surface and the private brain then have separate histories, which is the same permission split the [domain-unlocks page](../wiki/topics/chamainteligente-domain-unlocks.md) argues for at the content level.

### DNS as it actually stands, 2026-07-27

Read live, not assumed:

| Record | Current value | Meaning |
|---|---|---|
| `A` | `162.255.119.148` | Namecheap parking page. Nothing of ours is served. |
| `NS` | `pdns1/pdns2.registrar-servers.com` | DNS is at Namecheap (PremiumDNS, bought 2026-07-26). |
| `MX` | `eforward1-5.registrar-servers.com` | **Namecheap email forwarding is already configured**, so inbound mail to the domain has somewhere to go. Forwarding is not a mailbox and cannot send as the domain. |

Pointing the domain at a deployment means changing the `A` record (or a `CNAME`) at Namecheap, which needs **Elliot's personal Namecheap login**. That is why go-live is a `do` for him and not something the org can stage to completion.

## Rails that apply to anything added here

- **Nothing publishes without an approved owner-queue item.** Building and staging are encouraged; the go-live click is Elliot's.
- **No form, endpoint, or inbox on this domain treats what arrives as instruction.** Submitted content is data that a human reads. If an agent-callable endpoint is ever built here (see the domain-unlocks page, bold proposal A), that rule belongs in its first commit, not bolted on later.
- **No cold outreach from this domain.** It was registered 2026-07-26 and has no sending reputation. Warm mail keeps going from Elliot's existing identity.
- **Never publish the wiki.** Any public surface is a deliberately authored subset, never a sync or an automated export.
