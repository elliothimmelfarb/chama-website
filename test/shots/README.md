# Shots: the headless check rig

Run `npm install` here once, then `node test/shots/run.mjs [--base URL] [--pages home coaching] [--jobs 4]` from the repo root. Without `--base` it serves the repo root with vercel.json's headers and a stub for `/api/*`. It drives the installed Chrome (`CHROME_PATH` to change), because Playwright's Chromium cannot play H.264.

It opens every page in `site/site.js` in light and dark (stored `chama-theme`, with the system set to the opposite), full and low motion (`chama-motion`), at 364x610 with a 17px font and at 1440x900. Full motion is shot at the top, the middle of each world's hold and the end; low motion as one full page. Extras: no JavaScript on `/` and `/engineering-department`, 610x364 one column on every page, a dark router trip from `/` to `/engineering-department` and Back, and `/#thanks`.

Every state must have: no horizontal overflow, console errors, failed or off-origin requests; no visible text under the bare header (checked every half screen); a first frame in the stored theme; a sky that reads as its theme (never black in light); AA contrast for every visible text node against its world's `--ground` or the nearest painted background; a hold on every pinned world; no hidden words in low motion or without JavaScript. On `/` and `/engineering-department` the H1 is the LCP element, and on `/` at 364x610 the three doors are in view after one screen of scroll.

Output goes to `test/shots/out/` (ignored): the shots per page, `sheet-<page>.png` contact sheets with failing shots outlined in red, and `report.json` listing each failure with its page, state and shot. The exit code is 1 when anything fails.
