---
name: chama-website-site
description: Read before changing chamainteligente.com's pages, the "Talk to us" chat agent, the Hearth, Vercel config, or anything about search and link previews. Holds the non-obvious lessons about this site; the README says what each part is.
---

# chama-website: lessons

The README is the operating manual. This skill holds what it does not say: the traps found the hard way and why things are the way they are.

- `vercel.md`: routing and header traps, asset caching, what lives in the dashboard instead of the repo. Read before touching `vercel.json` or `api/`.
- `flame.md`: the "Talk to us" agent: where its speed comes from, how consent is checked, why the watchdog and the chat's error handling look the way they do. Read before changing `api/chat.js`, `api/chat-prompt.js`, `lib/site-pages.js`, `api/watchdog.js` or `assets/talk.js`.
- `hearth.md`: the Hearth's sign-in providers, Google app, records, Stripe and how the room loads. Read before working in the Hearth.
- `pages.md`: the worlds engine's API (pinning, `--u`/`--e`/`--p`, stages, theme, low motion), its frame-cost lessons, the router, /build's devices, and client logos. Read before adding a page, a section or a figure, or touching the engine.
- `search.md`: reading Search Console, validating structured data, link preview caching, machine-readable summaries, proving a redesign changed nothing. Read before SEO, sharing card or redesign work.
