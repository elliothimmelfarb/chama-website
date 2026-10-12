# The Hearth

- The Google Auth Platform app is published but unverified (2026-09-02). The owner sees Google's "unverified app" screen once when connecting, and at most 100 users may grant the sensitive scopes before verification.
- The original `GOOGLE_CLIENT_SECRET` cannot be viewed again. If it is ever needed, add a new secret on the client in Google Cloud (project `chama-website-admin`).
- Discord sign-in is built but its credentials are not set (2026-09-02): the Discord developer portal needs a captcha only a person can tick. The button appears once both variables exist.
