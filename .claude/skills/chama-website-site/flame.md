# The flame

- The watchdog's batch is capped (40 conversations, 400 KB). If anything was dropped, a `clear` verdict is raised to `concern` so the email still goes out. Flooding the window to push an attack out of review is a known trick.
- The Anthropic SDK never sets `error.name`, so every failure used to log as a bare `Error`. `describeError` in `api/chat.js` logs class, HTTP status and API error type. Keep using it.
- Hitting the account's API spend limit comes back as a `400` whose message mentions usage limits. `api/chat.js` treats that as the flame resting and shows the offline message, not a "try again".
- The fire runs in a Web Worker on touch devices because sharing the main thread with scrolling, the keyboard and streamed text made it jank on phones. Desktops run it inline.
- On touch, the embedded room is never a nested scroller. Engaging it pins it to the visual viewport as a sheet so a soft keyboard cannot push the layout off screen.
