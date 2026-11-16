---
name: chama-website-site
description: Read before changing chamainteligente.com's pages, the "Talk to us" chat agent, the Hearth, Vercel config, or anything about search and link previews. Holds the non-obvious lessons about this site; the README says what each part is.
---

# chama-website: lessons

The README is the operating manual. This skill holds what it does not say: the traps found the hard way and why things are the way they are.

- `vercel.md`: routing and header traps, asset caching, what lives in the dashboard instead of the repo. Read before touching `vercel.json` or `api/`.
- `flame.md`: the "Talk to us" agent: where its speed comes from, how consent is checked, why the watchdog and the chat error handling look the way they do. Read before changing `api/chat.js`, `api/chat-prompt.js`, `lib/site-pages.js`, `api/watchdog.js` or the flame engine.
- `hearth.md`: the state of the Hearth's sign-in providers and Google app. Read before touching sign-in or Google Calendar and Meet.
- `pages.md`: the worlds pages, the router, `/built`, `/clients`, the friends on `/about`, and client logos. Read before adding a page or a section, or touching the logo rows.
- `search.md`: reading Search Console, validating structured data, link preview caching, proving a redesign changed nothing. Read before SEO, sharing card or redesign work.
