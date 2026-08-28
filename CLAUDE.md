# Chama Website

The deployable source for **chamainteligente.com** and the brand asset library of Chama Inteligente, Lda. This is the company's public surface: everything in this repo is either visible to strangers or is a brand asset that will be. It was extracted from the company's private repository (`../chama-inteligente/`, "the brain") on 2026-08-28, keeping its full git history; the two repos are siblings and stay separate on purpose.

## The split, and why it exists

- **This repo (the surface):** `index.html`, `privacy.html`, `404.html`, the intake API, SEO/crawler files, and `brand/` (logo mark, LinkedIn banners, avatars). Nothing private belongs here, ever: no wiki pages, no financials, no credentials, no client material. Assume this repo could be made public tomorrow.
- **The brain (`../chama-inteligente/`):** the company wiki, org state, and raw records. It is the canonical home of the website's *copy* and of every claim the site makes.

## Rails (walls, not design constraints)

1. **Copy is authored in the brain first.** The canonical copy and its claims ledger live in `../chama-inteligente/wiki/topics/website-content-chamainteligente-com.md`. Change the copy there first, then bring it here, so the live page is never the only record of what it asserts. Every claim is sourced there or carries a visible review marker.
2. **Never connect this repo (or the brain) to Vercel's git integration.** Deploys are always the manual CLI run below. Committing and pushing never deploy anything by themselves. This repo is public at https://github.com/elliothimmelfarb/chama-website (Elliot's decision, 2026-08-28); a public remote is compatible with the split, git integration with the host is not. Being public also means: everything pushed here is world-readable the moment it lands, so the no-private-material rule above is enforced at commit time, not at publish time.
3. **Deploying the site as it stands is pre-approved** (Elliot's standing exception, 2026-08-12) and expected: a website change left undeployed is an unfinished task. But new claims, offers, pages, or any genuinely new public surface still needs Elliot's approval through the org's owner queue in the brain.
4. **`index.html` publicly promises zero external network requests**, three times, and invites readers to verify it in devtools. No external font, script, image, or endpoint may ever be added to the page.
5. **Never handle credentials in plaintext.** `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `RESEND_EMAIL_DOMAIN`, and `CRON_SECRET` live only in Vercel. `.vercel/` is gitignored and holds the project link.

## Deploying

```bash
cd /Users/elliothimmelfarb/claude/chama-website && vercel deploy --prod
```

Vercel CLI at `/opt/homebrew/bin/vercel`; project `chama-inteligente/chama-inteligente` on Elliot's Vercel Pro workspace. After deploying, verify the live page at https://chamainteligente.com. After a content change worth announcing, push IndexNow (command in [README.md](README.md)).

## Conventions

- What each file is, the intake pipeline, DNS state, and search-presence details: [README.md](README.md). Keep it current; it is the operating manual.
- No em dashes anywhere. Dates ISO `YYYY-MM-DD`. Anything named or created uses "Young Ju", never "Annie".
- Brand assets live in `brand/`; the mark's construction rules are in `brand/mark/README.md` (optical centring rule included).
- Commit after every meaningful unit of work, path-scoped (`git commit -m "..." -- <paths>`).
- This repo is a registered satellite of the Chama org: its heartbeats diff this repo and ingest what matters into the brain. Work done here gets picked up; substantive decisions should still be recorded in the brain's wiki, not only in commit messages.
