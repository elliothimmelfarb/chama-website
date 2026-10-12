# Search and sharing

- Search Console "not indexed" rows that are fine: *Page with redirect* (`www.` and `http://` variants), *Alternate page with proper canonical tag* (old addresses before they became redirects), and *Not found (404)* for a literal `https://chamainteligente.com/*` Google picked up from nowhere. The row that matters is a sitemap page under *Discovered, currently not indexed*. Fix it with URL Inspection, then Request indexing.
- Use `validator.schema.org` for JSON-LD. Google's Rich Results Test has returned server errors here, and a failure there says nothing about the page.
- Messengers cache a link preview by URL for a long time. A changed sharing card ships under a new dated filename (`og-YYYY-MM-DD.png`), never over the old one, and the old file stays for links already sent.
- When a change is meant to leave the design untouched, prove it: serve the old and new versions locally, screenshot both full page at desktop and mobile widths, and compare.
