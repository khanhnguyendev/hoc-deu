"""Compute WCAG contrast + OKLCH for the Học Đều palette candidates."""
import math, json, sys

def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))

def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(h):
    r, g, b = (lin(c) for c in hex2rgb(h)); return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(a, b):
    la, lb = lum(a), lum(b); hi, lo = max(la, lb), min(la, lb); return (hi + 0.05) / (lo + 0.05)

def oklch(h):
    r, g, b = (lin(c) for c in hex2rgb(h))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (x ** (1 / 3) for x in (l, m, s))
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    C = math.hypot(a, bb); H = (math.degrees(math.atan2(bb, a)) + 360) % 360
    return f"oklch({L:.3f} {C:.3f} {H:.1f})" if C > 0.002 else f"oklch({L:.3f} 0 0)"

LIGHT = {
    'background': '#FAFAF9', 'surface': '#FFFFFF', 'surface-muted': '#F5F5F4', 'surface-sunken': '#F0EFED',
    'foreground': '#1C1917', 'muted-foreground': '#57534E', 'subtle-foreground': '#6B645F',
    'border': '#E7E5E4', 'border-strong': '#8A847F', 'ring': '#0D9488',
    'primary': '#0F766E', 'primary-hover': '#115E59', 'primary-foreground': '#FFFFFF',
    'primary-soft': '#F0FDFA', 'primary-soft-foreground': '#115E59',
    'success': '#157539', 'success-foreground': '#FFFFFF', 'success-soft': '#F0FDF4', 'success-soft-foreground': '#166534',
    'warning': '#A34A0B', 'warning-foreground': '#FFFFFF', 'warning-soft': '#FFFBEB', 'warning-soft-foreground': '#92400E',
    'danger': '#B91C1C', 'danger-foreground': '#FFFFFF', 'danger-soft': '#FEF2F2', 'danger-soft-foreground': '#991B1B',
}
DARK = {
    'background': '#0C0A09', 'surface': '#1C1917', 'surface-muted': '#292524', 'surface-sunken': '#151312',
    'foreground': '#FAFAF9', 'muted-foreground': '#A8A29E', 'subtle-foreground': '#9A938E',
    'border': '#3A3532', 'border-strong': '#78716C', 'ring': '#2DD4BF',
    'primary': '#2DD4BF', 'primary-hover': '#5EEAD4', 'primary-foreground': '#042F2E',
    'primary-soft': '#0F2E2B', 'primary-soft-foreground': '#99F6E4',
    'success': '#4ADE80', 'success-foreground': '#052E16', 'success-soft': '#0F2A1A', 'success-soft-foreground': '#86EFAC',
    'warning': '#FBBF24', 'warning-foreground': '#451A03', 'warning-soft': '#2E2106', 'warning-soft-foreground': '#FCD34D',
    'danger': '#F87171', 'danger-foreground': '#450A0A', 'danger-soft': '#3A1414', 'danger-soft-foreground': '#FCA5A5',
}
# track accents: (light solid, light soft, dark solid, dark soft)
TRACKS = {
    'track-1': ('#4338CA', '#EEF2FF', '#A5B4FC', '#1E1B4B'),   # indigo — DSA
    'track-2': ('#C2410C', '#FFF7ED', '#FDBA74', '#3B1906'),   # orange — English
    'track-3': ('#6D28D9', '#F5F3FF', '#C4B5FD', '#2A1650'),   # violet
    'track-4': ('#0369A1', '#F0F9FF', '#7DD3FC', '#0B2A3F'),   # sky
    'track-5': ('#BE185D', '#FDF2F8', '#F9A8D4', '#3D0C24'),   # pink
    'track-6': ('#A21CAF', '#FDF4FF', '#F0ABFC', '#3B0D40'),   # fuchsia
    'track-7': ('#3F6212', '#F7FEE7', '#BEF264', '#1F2A0B'),   # olive (lime-800)
    'track-8': ('#155E75', '#ECFEFF', '#67E8F9', '#0A2A33'),   # cyan-800
}
HEAT_LIGHT = ['#F0EFED', '#2DD4BF', '#0D9488', '#115E59', '#042F2E']
HEAT_DARK = ['#292524', '#134E4A', '#0D9488', '#2DD4BF', '#CCFBF1']

SURFACES = ('background', 'surface', 'surface-muted', 'surface-sunken')
TEXT_TOKENS = ('foreground', 'muted-foreground', 'subtle-foreground', 'primary', 'success', 'warning', 'danger')


def checks(t, dark):
    """Every text token on every surface (4.5:1), every control/focus colour on every surface (3:1),
    every on-colour pair, every track accent, and the heat ramp."""
    rows = []

    def add(fg, bg, need, label=None):
        a = t[fg] if fg in t else fg
        b = t[bg] if bg in t else bg
        cr = contrast(a, b)
        rows.append((label or f'{fg} on {bg}', round(cr, 2), need, cr >= need))

    for fg in TEXT_TOKENS:
        for bg in SURFACES:
            add(fg, bg, 4.5)
    for fg in ('border-strong', 'ring'):
        for bg in SURFACES:
            add(fg, bg, 3.0, f'{fg} (control / focus) on {bg}')
    add('primary-foreground', 'primary', 4.5)
    add('primary-foreground', 'primary-hover', 4.5)
    add('primary-soft-foreground', 'primary-soft', 4.5)
    for s in ('success', 'warning', 'danger'):
        add(f'{s}-foreground', s, 4.5)
        add(f'{s}-soft-foreground', f'{s}-soft', 4.5)
    onsolid = '#0C0A09' if dark else '#FFFFFF'
    for k, (ls, lsoft, ds, dsoft) in TRACKS.items():
        solid, soft = (ds, dsoft) if dark else (ls, lsoft)
        for bg in SURFACES:
            cr = contrast(solid, t[bg])
            rows.append((f'{k} text on {bg}', round(cr, 2), 4.5, cr >= 4.5))
        cr = contrast(onsolid, solid)
        rows.append((f'{k}: track-foreground on {k}', round(cr, 2), 4.5, cr >= 4.5))
        cr = contrast(solid, soft)
        rows.append((f'{k} text on {k}-soft', round(cr, 2), 4.5, cr >= 4.5))
    heat = HEAT_DARK if dark else HEAT_LIGHT
    for i in range(2, len(heat)):
        cr = contrast(heat[i], heat[0])
        rows.append((f'heat-{i} vs heat-0 (graphic, 3:1)', round(cr, 2), 3.0, cr >= 3.0))
    for i in range(1, len(heat)):
        cr = contrast(heat[i], heat[i - 1])
        rows.append((f'heat-{i} vs heat-{i - 1} (adjacent levels, ≥ 1.5 target)', round(cr, 2), 1.5, cr >= 1.5))
    return rows


if __name__ == '__main__':
    out = {}
    for name, t, dark in (('light', LIGHT, False), ('dark', DARK, True)):
        rows = checks(t, dark)
        fails = [r for r in rows if not r[3]]
        print(f'== {name}: {len(rows)} checks, {len(fails)} failing')
        for r in rows:
            print(('  OK ' if r[3] else '  !! ') + f'{r[0]:<58} {r[1]:>5}  (need {r[2]})')
        out[name] = {'tokens': {k: {'hex': v, 'oklch': oklch(v)} for k, v in t.items()}, 'checks': rows}
    out['tracks'] = {k: {'light': {'solid': v[0], 'soft': v[1], 'solid_oklch': oklch(v[0]), 'soft_oklch': oklch(v[1])},
                         'dark': {'solid': v[2], 'soft': v[3], 'solid_oklch': oklch(v[2]), 'soft_oklch': oklch(v[3])}}
                     for k, v in TRACKS.items()}
    out['heat'] = {'light': [(h, oklch(h)) for h in HEAT_LIGHT], 'dark': [(h, oklch(h)) for h in HEAT_DARK]}
    json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else 'palette.json', 'w'), indent=1, ensure_ascii=False)
