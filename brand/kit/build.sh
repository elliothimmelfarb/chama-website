#!/bin/sh
# Builds the media kit served at /brand: the logo PNGs, the mark files, and
# the zip that holds them all with GUIDELINES.txt.
# Usage, from the repo root:   sh brand/kit/build.sh
# Needs Chrome (renders lockup.html) and Python with Pillow (trims the
# render to the logo plus its clear space). Nothing is fetched.
set -e
KIT="$PWD/brand/kit"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for THEME in light dark; do
  HASH=""; [ "$THEME" = dark ] && HASH="#dark"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=4 \
    --default-background-color=00000000 --window-size=900,200 \
    --screenshot="$KIT/chama-logo-$THEME.png" "file://$KIT/lockup.html$HASH" 2>/dev/null
  # Keep clear space equal to half the mark's height (48 CSS px, 192 px here).
  python3 -I - "$KIT/chama-logo-$THEME.png" <<'PY'
import sys
from PIL import Image
path = sys.argv[1]
im = Image.open(path).convert("RGBA")
l, t, r, b = im.getbbox()
pad = 192
out = Image.new("RGBA", (r - l + 2 * pad, b - t + 2 * pad), (0, 0, 0, 0))
out.paste(im.crop((l, t, r, b)), (pad, pad))
out.save(path, optimize=True)
PY
done
cp brand/mark/mark.svg "$KIT/chama-mark.svg"
cp brand/mark/avatar-transparent-1024.png "$KIT/chama-mark-1024.png"
cp brand/mark/avatar-light-1024.png "$KIT/chama-avatar-light-1024.png"
cp brand/mark/avatar-dark-1024.png "$KIT/chama-avatar-dark-1024.png"
cd "$KIT"
rm -f chama-inteligente-media-kit.zip
# -X leaves out macOS extra attributes, so the zip opens cleanly anywhere.
zip -qX chama-inteligente-media-kit.zip GUIDELINES.txt chama-logo-light.png chama-logo-dark.png \
  chama-mark.svg chama-mark-1024.png chama-avatar-light-1024.png chama-avatar-dark-1024.png
echo "built brand/kit"
