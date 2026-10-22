# Vercel

- Read a redirect or header live before claiming it works: `curl -sI` against both `chamainteligente.com` and `www.`. A `/:path*` source does not match the bare root `/`, so a redirect written that way returned 200 on `/` for two weeks while the config looked right.
- Vercel's `[...path]` catch-all matches only one segment for plain (non-framework) functions. That is why `/api/hearth/*` is rewritten in `vercel.json` to the flat `api/hearth.js`, which routes internally.
- `/assets/*.js` and `*.css` are cached for 10 minutes in the browser (until the next deploy at the edge). A browser that just loaded the old `agent.js` can keep it for up to ten minutes after a deploy. Hard reload before calling a fix broken. Keep `stale-while-revalidate` out of the browser's `Cache-Control` for these: in a browser it serves the stale file one more time after the 10 minutes, so a plain reload kept showing the old version (2026-10-22). The edge rules live in `Vercel-CDN-Cache-Control`.
- The `/api/chat` rate limit (10 per IP per minute) is a Vercel Firewall rule in the dashboard. It is not in this repo, so grep will not find it.
