#!/usr/bin/env python3
"""Build every Chama Inteligente mark asset from one glyph, optically centred.

Rule (see brand/mark/README.md): the mark is centred on its OPTICAL centre,
the midpoint between the ink bounding-box centre and the ink area centroid,
never on the bounding box alone. The bare C-plus-spark glyph has a heavy ring
on the left and a light spark on the right, so bounding-box centring parks the
visual mass left of centre. That is the drift Elliot saw on LinkedIn.

Usage:  python3 build-mark.py          (writes every asset, from website/)
No third-party rasteriser required; PNGs are drawn from sampled path outlines
with PIL at 8x and downsampled.
"""
import math, os, re
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.abspath(os.path.join(HERE, "..", ".."))
BRAND = os.path.join(WEB, "brand")

EMBER = "#f4581f"
LIGHT_BG = "#f3f0e8"
DARK_BG = "#1c1917"

# The glyph, exactly as drawn in 2026-08 ("R2 Spark"), in a 64-unit box.
GLYPH = [
    "M44.55 19.07A21 21 0 1 0 44.55 44.93L36.83 41.81A13.2 13.2 0 1 1 36.83 22.19Z",
    "M45.04 27.44C48.27 24.22 51.63 24.75 56.33 24.49C54.78 26.84 54.38 28.85 54.18 30.67"
    "C55.19 30.46 56.13 30.06 57.0 29.32C56.46 31.88 55.66 34.16 53.91 35.91"
    "C51.16 38.66 47.33 38.73 44.91 36.31C42.49 33.89 42.22 30.26 45.04 27.44Z",
]

# How much of the canvas the ink may use.
SQUARE_COVERAGE = 0.78   # fraction of the side, longest ink axis
CIRCLE_COVERAGE = 0.84   # fraction of the inscribed-circle radius, furthest ink point
CENTROID_WEIGHT = 0.5    # optical centre = bbox centre blended this far toward centroid


# ---------------------------------------------------------------- path sampling
def _tokens(d):
    return re.findall(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?", d)


def _arc(x0, y0, rx, ry, phi, fa, fs, x1, y1, n=256):
    phi = math.radians(phi)
    dx2, dy2 = (x0 - x1) / 2, (y0 - y1) / 2
    x1p = math.cos(phi) * dx2 + math.sin(phi) * dy2
    y1p = -math.sin(phi) * dx2 + math.cos(phi) * dy2
    rx, ry = abs(rx), abs(ry)
    lam = x1p ** 2 / rx ** 2 + y1p ** 2 / ry ** 2
    if lam > 1:
        s = math.sqrt(lam)
        rx, ry = rx * s, ry * s
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    c = math.sqrt(max(0.0, num / den))
    if fa == fs:
        c = -c
    cxp, cyp = c * rx * y1p / ry, -c * ry * x1p / rx
    cx = math.cos(phi) * cxp - math.sin(phi) * cyp + (x0 + x1) / 2
    cy = math.sin(phi) * cxp + math.cos(phi) * cyp + (y0 + y1) / 2

    def angle(ux, uy, vx, vy):
        d = (ux * vx + uy * vy) / (math.hypot(ux, uy) * math.hypot(vx, vy))
        a = math.acos(max(-1.0, min(1.0, d)))
        return -a if ux * vy - uy * vx < 0 else a

    th1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dth = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not fs and dth > 0:
        dth -= 2 * math.pi
    if fs and dth < 0:
        dth += 2 * math.pi
    out = []
    for i in range(n + 1):
        t = th1 + dth * i / n
        out.append((math.cos(phi) * rx * math.cos(t) - math.sin(phi) * ry * math.sin(t) + cx,
                    math.sin(phi) * rx * math.cos(t) + math.cos(phi) * ry * math.sin(t) + cy))
    return out


def sample(d, steps=256):
    t = _tokens(d)
    i, cur, start, pts, cmd = 0, (0.0, 0.0), (0.0, 0.0), [], None
    def num():
        nonlocal i
        v = float(t[i]); i += 1; return v
    while i < len(t):
        if re.match(r"[A-Za-z]", t[i]):
            cmd = t[i]; i += 1
        c, rel = cmd.upper(), cmd.islower()
        ox, oy = cur if rel else (0.0, 0.0)
        if c == "M":
            cur = (num() + ox, num() + oy); start = cur; pts.append(cur)
            cmd = "l" if rel else "L"
        elif c == "L":
            cur = (num() + ox, num() + oy); pts.append(cur)
        elif c == "C":
            p0 = cur
            p1 = (num() + ox, num() + oy); p2 = (num() + ox, num() + oy); p3 = (num() + ox, num() + oy)
            for k in range(1, steps + 1):
                s = k / steps; m = 1 - s
                pts.append((m**3*p0[0] + 3*m*m*s*p1[0] + 3*m*s*s*p2[0] + s**3*p3[0],
                            m**3*p0[1] + 3*m*m*s*p1[1] + 3*m*s*s*p2[1] + s**3*p3[1]))
            cur = p3
        elif c == "A":
            rx, ry, ph = num(), num(), num()
            fa = int(float(t[i])); i += 1
            fs = int(float(t[i])); i += 1
            x, y = num() + ox, num() + oy
            pts += _arc(cur[0], cur[1], rx, ry, ph, fa, fs, x, y, steps)
            cur = (x, y)
        elif c == "Z":
            pts.append(start); cur = start
        else:
            raise ValueError("unsupported path command " + cmd)
    return pts


# ---------------------------------------------------------------- measurement
POLYS = [sample(d) for d in GLYPH]
ALL = [p for poly in POLYS for p in poly]
MINX, MAXX = min(p[0] for p in ALL), max(p[0] for p in ALL)
MINY, MAXY = min(p[1] for p in ALL), max(p[1] for p in ALL)


def _area_centroid(poly):
    a = cx = cy = 0.0
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        cr = x0 * y1 - x1 * y0
        a += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr
    a /= 2.0
    return abs(a), cx / (6 * a), cy / (6 * a)


_tot = _cx = _cy = 0.0
for poly in POLYS:
    a, cx, cy = _area_centroid(poly)
    _tot += a; _cx += a * cx; _cy += a * cy
CENTROID = (_cx / _tot, _cy / _tot)
BBOX_CENTRE = ((MINX + MAXX) / 2, (MINY + MAXY) / 2)
OPTICAL = (BBOX_CENTRE[0] + CENTROID_WEIGHT * (CENTROID[0] - BBOX_CENTRE[0]),
           BBOX_CENTRE[1] + CENTROID_WEIGHT * (CENTROID[1] - BBOX_CENTRE[1]))

HALF_EXTENT = max(max(abs(p[0] - OPTICAL[0]) for p in ALL),
                  max(abs(p[1] - OPTICAL[1]) for p in ALL))
RADIUS = max(math.hypot(p[0] - OPTICAL[0], p[1] - OPTICAL[1]) for p in ALL)


def placement(size, profile):
    """Return (scale, dx, dy) putting the optical centre at the canvas centre."""
    if profile == "circle":
        scale = (size / 2 * CIRCLE_COVERAGE) / RADIUS
    elif profile == "square":
        scale = (size / 2 * SQUARE_COVERAGE) / HALF_EXTENT
    elif profile == "native":       # same size as drawn, re-centred only
        scale = size / 64.0
    else:
        raise ValueError(profile)
    return scale, size / 2 - OPTICAL[0] * scale, size / 2 - OPTICAL[1] * scale


# ---------------------------------------------------------------- emitters
def svg(size, profile, fill=EMBER, bg=None, rounded=False):
    s, dx, dy = placement(size, profile)
    body = "".join('<path d="%s"/>' % d for d in GLYPH)
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %g %g" width="%g" height="%g">'
             % (size, size, size, size)]
    if bg:
        if rounded:
            parts.append('<rect width="%g" height="%g" rx="%g" fill="%s"/>' % (size, size, size * 0.22, bg))
        else:
            parts.append('<rect width="%g" height="%g" fill="%s"/>' % (size, size, bg))
    parts.append('<g transform="translate(%.4f %.4f) scale(%.6f)" fill="%s">%s</g>'
                 % (dx, dy, s, fill, body))
    parts.append("</svg>")
    return "".join(parts)


def png(path, size, profile, fill=EMBER, bg=None, ss=8):
    s, dx, dy = placement(size, profile)
    big = size * ss
    img = Image.new("RGBA", (big, big), bg if bg else (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for poly in POLYS:
        draw.polygon([((p[0] * s + dx) * ss, (p[1] * s + dy) * ss) for p in poly], fill=fill)
    img.resize((size, size), Image.LANCZOS).save(path)


def write(path, text):
    with open(path, "w") as fh:
        fh.write(text + "\n")
    print("  wrote", os.path.relpath(path, WEB))


if __name__ == "__main__":
    print("ink bbox centre %.3f,%.3f | area centroid %.3f,%.3f | optical centre %.3f,%.3f"
          % (BBOX_CENTRE + CENTROID + OPTICAL))
    print("drift corrected: %+.3f x, %+.3f y (64-unit glyph)"
          % (32 - OPTICAL[0], 32 - OPTICAL[1]))

    # Canonical glyph, drawn at its native weight, optically centred in its box.
    write(os.path.join(BRAND, "mark", "mark.svg"), svg(64, "native"))
    # Circle- and square-safe masters for any container.
    write(os.path.join(BRAND, "mark", "mark-circle-safe.svg"), svg(64, "circle"))
    write(os.path.join(BRAND, "mark", "mark-square-safe.svg"), svg(64, "square"))

    # Site icons.
    write(os.path.join(WEB, "favicon.svg"), svg(64, "native"))
    png(os.path.join(WEB, "favicon-32.png"), 32, "square")
    png(os.path.join(WEB, "apple-touch-icon.png"), 180, "square", bg=LIGHT_BG)

    # Avatar assets: circle-safe, so a round crop never clips the spark.
    for name, bg in (("light", LIGHT_BG), ("dark", DARK_BG)):
        png(os.path.join(BRAND, "linkedin-logo-%s-400.png" % name), 400, "circle", bg=bg)
        png(os.path.join(BRAND, "mark", "avatar-%s-1024.png" % name), 1024, "circle", bg=bg)
    png(os.path.join(BRAND, "mark", "avatar-transparent-1024.png"), 1024, "circle")
    print("  wrote brand PNGs")
