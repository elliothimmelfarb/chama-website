---
name: chama-website-site
description: Read before changing chamainteligente.com's pages, the flame, the Hearth, Vercel config, or anything about search and link previews. Holds the non-obvious lessons about this site; the README says what each part is.
---

# chama-website: lessons

The README is the operating manual. This skill holds what it does not say: the traps found the hard way and why things are the way they are.

- `vercel.md`: routing and header traps, asset caching, what lives in the dashboard instead of the repo. Read before touching `vercel.json` or `api/`.
- `flame.md`: why the watchdog and the chat error handling look the way they do. Read before changing `api/chat.js`, `api/watchdog.js` or the flame engine.
- `hearth.md`: the state of the Hearth's sign-in providers and Google app. Read before touching sign-in or Google Calendar and Meet.
- `records.md`: writing a session record from a transcript, and what Elliot corrects in them. Read before writing or revising one.
- `search.md`: reading Search Console, validating structured data, link preview caching, proving a redesign changed nothing. Read before SEO, sharing card or redesign work.
