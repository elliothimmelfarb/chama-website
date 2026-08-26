# The mark, and the centring rule

One glyph ("R2 Spark", 2026-08-16), one builder, one rule. Every square or
circular container the company appears in gets its mark from
[build-mark.py](build-mark.py), never from a hand-placed copy.

## The rule

**Centre the mark on its optical centre, never on its bounding box.**

The glyph is a heavy ring (the C) with a small light spark outboard on the
right. Bounding-box centring gives the sparse spark the same say as the solid
ring, so the visual mass parks left of centre. Measured on the 64-unit glyph:

| Reading | x |
|---|---|
| Ink bounding-box centre | 32.00 |
| Ink area centroid (where the mass actually is) | 27.88 |
| Optical centre used (midpoint of the two) | 29.94 |

So every asset shifts the glyph **+2.061 x, +0.064 y** relative to the old
bounding-box placement. That is the leftward drift Elliot saw on the LinkedIn
company page on 2026-08-26.

## The three profiles

| Profile | Fit | Use for |
|---|---|---|
| `native` | drawn weight, re-centred only | inline on the site, favicon.svg |
| `square` | longest ink axis = 78% of the side | square icons with no round crop (favicon-32, apple-touch) |
| `circle` | furthest ink point = 84% of the inscribed-circle radius | any avatar: LinkedIn, X, Patreon, Telegram, GitHub |

`circle` is the safe default for a profile picture, because platforms round-crop
avatars without warning and the spark is the part that would clip.

## Regenerating

```bash
python3 brand/mark/build-mark.py   # run from website/
```

It rewrites `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`,
`brand/linkedin-logo-{light,dark}-400.png`, and the masters in this folder. No
third-party rasteriser is needed; PNGs are drawn from sampled path outlines at
8x and downsampled. Add a new size or platform by adding a line to the script,
not by exporting from a design tool.

Inline site copies of the glyph carry the same correction as
`<g transform="translate(2.0612 0.0639)">`; grep for that string.
