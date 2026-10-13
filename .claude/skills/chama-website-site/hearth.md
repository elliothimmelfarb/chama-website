# The Hearth

- The Google Auth Platform app is published but unverified (2026-09-02). The owner sees Google's "unverified app" screen once when connecting, and at most 100 users may grant the sensitive scopes before verification.
- The original `GOOGLE_CLIENT_SECRET` cannot be viewed again. If it is ever needed, add a new secret on the client in Google Cloud (project `chama-website-admin`).
- Discord sign-in is built but its credentials are not set (2026-09-02): the Discord developer portal needs a captcha only a person can tick. The button appears once both variables exist.
- `ADMIN_EMAILS` is a Sensitive variable, so `vercel env pull` returns it empty and it cannot be read back. Since 2026-10-13 it is `elliothimmelfarb@gmail.com,elliot@chamainteligente.com`. To change it, `vercel env rm` then `vercel env add --sensitive`, then redeploy production; the old value is lost, so write the whole list.
- Until 2026-10-13 a closed signup (`open_signup` off) also refused an admin address with no account yet. `mayEnter` in `api/hearth.js` now lets `ADMIN_EMAILS` through every door.
- Preview deployments share the production database (`DATABASE_URL` is set for Production, Preview and Development). A preview is not a sandbox for Hearth data.
- Claude operates the Hearth through the `chama-hearth` MCP server in the user-level Claude Code config, with an API key named "Claude Code (Elliot's machine)" on `elliot@chamainteligente.com`. The secret is in the macOS Keychain, service `chama-hearth-api-key`. Revoke it in the Hearth under Agents.
- For a direct database query, `vercel env pull` into the scratchpad gives `DATABASE_URL`, and `@neondatabase/serverless` from this repo's `node_modules` runs it. Run the script from the repo root so the import resolves, and never commit the env file.
