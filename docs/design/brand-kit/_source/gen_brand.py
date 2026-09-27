"""Học Đều brand kit generator.

Every colour comes from docs/design/assets/palette.py and every glyph from the self-hosted fonts in
app/fonts/, so the kit cannot drift from the design system. Rebuild after changing either:

    pip install fonttools brotli cairosvg pillow
    python3 docs/design/brand-kit/_source/gen_brand.py

Writes svg/, png/, brand-tokens.json, contrast.md and preview.html next to this folder.
"""
import json, os, re, shutil, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
KIT = HERE.parent                      # docs/design/brand-kit
DESIGN = KIT.parent                    # docs/design
REPO = DESIGN.parent.parent
sys.path.insert(0, str(DESIGN / "assets"))
import palette as P                    # noqa: E402  (the design system's own palette + contrast())

from fontTools.ttLib import TTFont                         # noqa: E402
from fontTools.pens.svgPathPen import SVGPathPen           # noqa: E402
from fontTools.pens.boundsPen import BoundsPen             # noqa: E402
from fontTools.pens.transformPen import TransformPen       # noqa: E402
import cairosvg                                            # noqa: E402
from PIL import Image                                      # noqa: E402

L, D = P.LIGHT, P.DARK
HEAT_L, HEAT_D = P.HEAT_LIGHT, P.HEAT_DARK

# ---- colour roles (all tokens) --------------------------------------------------------------
RAMP_LIGHT = HEAT_L[1:4]   # heat-1..3  #2DD4BF #0D9488 #115E59  (same classes as the heatmap)
RAMP_DARK = HEAT_D[2:5]    # heat-2..4  #0D9488 #2DD4BF #CCFBF1  (dark heatmap, skipping heat-1)
WORD_L, WORD_D = L["foreground"], D["foreground"]
TILE = HEAT_L[4]           # heat-4 #042F2E: app icon tile, carries the dark ramp
MONO_TEAL = L["primary"]   # #0F766E
TAGLINE = "Mỗi ngày một chút, AI giúp bạn tiến đều."

# ---- mark geometry --------------------------------------------------------------------------
# Cell : gap = 4 : 1, the year-view heatmap's 12 px cell / 3 px gap.
# Corner radius = 18 % of the cell, the month-view day cell's rounded-md (8 px) on 44 px.
CELL, GAP = 24, 6
STEP = CELL + GAP
GRID = 3 * CELL + 2 * GAP          # 84
RADIUS = round(CELL * 8 / 44, 2)   # 4.36
CELLS = [(2, 0), (2, 1), (2, 2), (1, 1), (1, 2), (0, 2)]   # (row, col) staircase

# ---- fonts: the app's own self-hosted Be Vietnam Pro (latin + vietnamese subset) -------------
FONT_DIR = REPO / "app" / "fonts" / "be-vietnam-pro"
WORD_WEIGHT = 600                  # the app's header/sidebar wordmark is text-lg font-semibold
_fonts = {}


def font(w):
    if w not in _fonts:
        _fonts[w] = TTFont(str(FONT_DIR / f"be-vietnam-pro-{w}.woff2"))
    return _fonts[w]


def _r(d):
    return re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.2f}".rstrip("0").rstrip("."), d)


def text_path(text, w, size, x=0.0, y=0.0):
    f = font(w)
    s = size / f["head"].unitsPerEm
    cmap, gs = f.getBestCmap(), f.getGlyphSet()
    hmtx = f["hmtx"]
    pen, bp = SVGPathPen(None), BoundsPen(None)
    cx = x
    for ch in text:
        g = cmap[ord(ch)]
        t = (s, 0, 0, -s, cx, y)
        gs[g].draw(TransformPen(pen, t))
        gs[g].draw(TransformPen(bp, t))
        cx += hmtx[g][0] * s
    return _r(pen.getCommands()), bp.bounds


def mark_rects(x0, y0, size, colors):
    k = size / GRID
    return "".join(
        f'<rect x="{x0 + c*STEP*k:.2f}" y="{y0 + r*STEP*k:.2f}" width="{CELL*k:.2f}" height="{CELL*k:.2f}" '
        f'rx="{RADIUS*k:.2f}" fill="{colors[c] if isinstance(colors, list) else colors}"/>'
        for r, c in CELLS)


def svg(w, h, body, bg=None):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}">'
            f"{b}{body}</svg>\n")


def write(rel, content):
    p = KIT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    return p


def png(src, rel, w, h=None):
    p = KIT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(url=str(src), write_to=str(p), output_width=w, output_height=h or w)
    return p


def build():
    for d in ("svg", "png"):
        shutil.rmtree(KIT / d, ignore_errors=True)

    # 1. mark
    M = GRID
    write("svg/mark/hoc-deu-mark.svg", svg(M, M, mark_rects(0, 0, M, RAMP_LIGHT)))
    write("svg/mark/hoc-deu-mark-on-dark.svg", svg(M, M, mark_rects(0, 0, M, RAMP_DARK)))
    write("svg/mark/hoc-deu-mark-mono-black.svg", svg(M, M, mark_rects(0, 0, M, WORD_L)))
    write("svg/mark/hoc-deu-mark-mono-white.svg", svg(M, M, mark_rects(0, 0, M, "#FFFFFF")))
    write("svg/mark/hoc-deu-mark-mono-teal.svg", svg(M, M, mark_rects(0, 0, M, MONO_TEAL)))

    # 2. wordmark
    FS = 100
    wd, (bx0, by0, bx1, by1) = text_path("Học Đều", WORD_WEIGHT, FS)
    ww, wh = bx1 - bx0, by1 - by0
    _, (_, hy0, _, hy1) = text_path("H", WORD_WEIGHT, FS)
    cap = hy1 - hy0

    def wordmark(fill):
        return svg(round(ww, 1), round(wh, 1), f'<path d="{wd}" fill="{fill}" transform="translate({-bx0:.2f},{-by0:.2f})"/>')

    write("svg/wordmark/hoc-deu-wordmark.svg", wordmark(WORD_L))
    write("svg/wordmark/hoc-deu-wordmark-on-dark.svg", wordmark(WORD_D))
    write("svg/wordmark/hoc-deu-wordmark-white.svg", wordmark("#FFFFFF"))

    # 3. lockups: mark sits on the baseline and rises to the diacritic height
    def lockup_h(ramp, fg):
        mark, gap = cap * 1.24, cap * 0.42
        base = max(-by0, mark)
        W, H = mark + gap + ww, base + by1
        body = mark_rects(0, base - mark, mark, ramp)
        body += f'<path d="{wd}" fill="{fg}" transform="translate({mark + gap - bx0:.2f},{base:.2f})"/>'
        return svg(round(W, 1), round(H, 1), body)

    def lockup_v(ramp, fg):
        mark, gap = ww * 0.42, cap * 0.55
        base = mark + gap - by0
        body = mark_rects((ww - mark) / 2, 0, mark, ramp)
        body += f'<path d="{wd}" fill="{fg}" transform="translate({-bx0:.2f},{base:.2f})"/>'
        return svg(round(ww, 1), round(base + by1, 1), body)

    write("svg/lockup/hoc-deu-lockup-horizontal.svg", lockup_h(RAMP_LIGHT, WORD_L))
    write("svg/lockup/hoc-deu-lockup-horizontal-on-dark.svg", lockup_h(RAMP_DARK, WORD_D))
    write("svg/lockup/hoc-deu-lockup-horizontal-mono-black.svg", lockup_h(WORD_L, WORD_L))
    write("svg/lockup/hoc-deu-lockup-horizontal-mono-white.svg", lockup_h("#FFFFFF", "#FFFFFF"))
    write("svg/lockup/hoc-deu-lockup-stacked.svg", lockup_v(RAMP_LIGHT, WORD_L))
    write("svg/lockup/hoc-deu-lockup-stacked-on-dark.svg", lockup_v(RAMP_DARK, WORD_D))

    # 4. app icon: heat-4 tile + dark ramp (every colour a token, no opacity blends)
    def app_icon(size=512, maskable=False, radius_ratio=0.225):
        inner = size * (0.50 if maskable else 0.58)
        off = (size - inner) / 2
        rx = 0 if maskable else size * radius_ratio
        return svg(size, size, f'<rect width="{size}" height="{size}" rx="{rx:g}" fill="{TILE}"/>'
                   + mark_rects(off, off, inner, RAMP_DARK))

    p_icon = write("svg/app-icon/hoc-deu-app-icon.svg", app_icon())
    p_mask = write("svg/app-icon/hoc-deu-app-icon-maskable.svg", app_icon(maskable=True))
    p_fav = write("svg/app-icon/favicon.svg", app_icon(radius_ratio=0.22))

    # 5. PNG
    for s in (16, 32, 48):
        png(p_fav, f"png/favicon-{s}.png", s)
    Image.open(KIT / "png/favicon-48.png").save(KIT / "png/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    png(p_mask, "png/apple-touch-icon.png", 180)
    png(p_icon, "png/icon-192.png", 192)
    png(p_icon, "png/icon-512.png", 512)
    png(p_mask, "png/icon-maskable-512.png", 512)
    png(KIT / "svg/mark/hoc-deu-mark.svg", "png/hoc-deu-mark-512.png", 512)
    png(KIT / "svg/mark/hoc-deu-mark-on-dark.svg", "png/hoc-deu-mark-on-dark-512.png", 512)
    for name in ("hoc-deu-lockup-horizontal", "hoc-deu-lockup-horizontal-on-dark"):
        src = KIT / f"svg/lockup/{name}.svg"
        w, h = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', src.read_text()).groups())
        png(src, f"png/{name}@2x.png", 1200, round(1200 * h / w))

    # 6. Open Graph 1200x630
    OW, OH = 1200, 630
    td, (tx0, _, _, _) = text_path(TAGLINE, 500, 30)
    sc, mk = 1.25, 84
    wb = 150 + mk + 44 + (-by0) * sc
    body = mark_rects(96, 150, mk, RAMP_LIGHT)
    body += f'<path d="{wd}" fill="{WORD_L}" transform="translate({96 - bx0*sc:.1f},{wb:.1f}) scale({sc})"/>'
    body += f'<path d="{td}" fill="{L["muted-foreground"]}" transform="translate({96 - tx0:.1f},{wb + by1*sc + 58:.1f})"/>'
    hc, hg = 30, 7.5   # 4:1 like the year view
    weeks = [[0, 1, 1, 2, 1, 0, 2], [1, 2, 2, 1, 2, 1, 2], [2, 2, 3, 2, 3, 2, 3], [2, 3, 3, 3, 3, 2, 3],
             [3, 3, 4, 3, 4, 3, 4], [3, 4, 4, 4, 4, 3, 4]]
    gw, gh = len(weeks) * (hc + hg) - hg, 7 * (hc + hg) - hg
    hx, hy = OW - 96 - gw, (OH - gh) / 2
    for wk, col in enumerate(weeks):
        for d, lv in enumerate(col):
            body += (f'<rect x="{hx + wk*(hc+hg):g}" y="{hy + d*(hc+hg):g}" width="{hc}" height="{hc}" '
                     f'rx="{hc*8/44:.2f}" fill="{HEAT_L[lv]}"/>')
    body += f'<rect x="0" y="{OH-8}" width="{OW}" height="8" fill="{L["primary"]}"/>'
    p_og = write("svg/social/og-image.svg", svg(OW, OH, body, L["background"]))
    png(p_og, "png/og-image.png", OW, OH)

    # 7. tokens + contrast report (logos are exempt from WCAG 1.4.11; this is for information)
    rows = []
    for theme, t, ramp in (("light", L, RAMP_LIGHT), ("dark", D, RAMP_DARK)):
        for i, c in enumerate(ramp, 1):
            for s in ("background", "surface"):
                rows.append((theme, f"cell {i} {c}", f"{s} {t[s]}", P.contrast(c, t[s])))
    for i, c in enumerate(RAMP_DARK, 1):
        rows.append(("icon", f"cell {i} {c}", f"tile {TILE}", P.contrast(c, TILE)))
    md = ["# Logo contrast", "", "Generated by `_source/gen_brand.py` from `docs/design/assets/palette.py`.",
          "Logos are exempt from WCAG 1.4.11; cells under 3:1 are marked so you know where the",
          "one-colour versions are the safer choice.", "", "| Theme | Cell | On | Ratio | ≥ 3:1 |",
          "| --- | --- | --- | --- | --- |"]
    md += [f"| {a} | `{b}` | `{c}` | {r:.2f} | {'yes' if r >= 3 else 'no'} |" for a, b, c, r in rows]
    write("contrast.md", "\n".join(md) + "\n")
    write("brand-tokens.json", json.dumps({
        "name": "Học Đều", "tagline": TAGLINE,
        "mark": {"viewBox": GRID, "cell": CELL, "gap": GAP, "radius": RADIUS, "cells_row_col": CELLS,
                 "light": {"tokens": ["heat-1", "heat-2", "heat-3"], "hex": RAMP_LIGHT},
                 "dark": {"tokens": ["heat-2", "heat-3", "heat-4"], "hex": RAMP_DARK}},
        "wordmark": {"font": "Be Vietnam Pro", "weight": WORD_WEIGHT, "tracking": 0,
                     "light": "foreground " + WORD_L, "dark": "foreground " + WORD_D},
        "app_icon": {"tile": "heat-4 (light) " + TILE, "cells": "dark ramp"},
    }, ensure_ascii=False, indent=2) + "\n")
    return rows


if __name__ == "__main__":
    for row in build():
        print(f"{row[0]:<6} {row[1]:<18} on {row[2]:<20} {row[3]:.2f}")
    print("kit written to", KIT)
