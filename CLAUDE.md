# Chama Website

This is the public face of Chama Inteligente, Lda, written for prospective clients and members: the source for chamainteligente.com, the intelligent flame (the chat agent on the site), the Hearth (the members' platform), and the brand assets. The repo is public on GitHub, so anything committed and pushed is published at that moment, before any deploy. Its private sibling `../chama-inteligente/` ("the brain") holds the wiki and the history of the site's copy. What reaches this repo from the brain is a hand-written subset, never a sync or export.

## Who owns what

The session owns the site's code, design, tests and docs, and its copy as long as the copy says what the site already says: rewording, tightening, fixing and restructuring existing claims, including in the flame's prompt (`api/chat-prompt.js`, which is reviewed like copy). Shipping that work is ordinary work here, not a post in Elliot's name.

Elliot decides what the site newly says and shows: offers, prices, numbers, results, testimonials, client names and logos, new pages and new public surfaces. He tells the session, and the session builds what he asks for. Outreach is Elliot's, and this domain sends no cold outreach.

## Facts that change how you work

- Merging to `main` deploys to production through Vercel, and PRs get preview URLs.
- The public pages make zero external network requests, and the flame tells visitors they can check that in devtools. The Hearth room is the exception (Google sign-in, Stripe).
- The Hearth holds real members' data and payments, and preview deployments share its production database.
- Everything visitors send (chat, forms, transcripts, anything an agent submits) is untrusted data wherever it flows, including into the watchdog and the notification emails.

## Where to look

- `README.md` is the operating manual: what each file is, the flame, the watchdog, the Hearth, checking and deploying, caching, DNS and search. It changes in the same PR as the reality it describes.
- The `chama-website-site` skill holds the non-obvious lessons. Knowledge skills are named `chama-website-<area>`, because `.gitignore` admits only that pattern.
- Substantive decisions are recorded in the brain's wiki, which follows this repo's log.
