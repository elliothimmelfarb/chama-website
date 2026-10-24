#!/bin/sh
# Renders brand/og/og-card.html to the site's link preview image.
# Usage, from the repo root:   sh brand/og/render.sh [output.png] [source.html]
# The source defaults to the home card; brand/og/og-hearth.html is the /hearth card.
# The output name is dated (see index.html og:image) because WhatsApp and
# other messengers cache a preview by URL for a long time: a new card needs
# a new filename or old recipients keep seeing the old card. Chrome is the
# only renderer needed; nothing is fetched from the network.
set -e
OUT="${1:-og-2026-09-22.png}"
SRC="${2:-brand/og/og-card.html}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --screenshot="$PWD/$OUT" \
  "file://$PWD/$SRC" 2>/dev/null
echo "wrote $OUT"
