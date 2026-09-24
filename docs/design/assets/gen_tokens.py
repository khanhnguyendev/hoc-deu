"""Generate docs/design/tokens.css, the contrast report and preview.html from palette.py values."""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import palette as P

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(ROOT, exist_ok=True)
o = P.oklch

SEM = ['background', 'surface', 'surface-muted', 'surface-sunken', 'foreground', 'muted-foreground',
       'subtle-foreground', 'border', 'border-strong', 'ring', 'primary', 'primary-hover',
       'primary-foreground', 'primary-soft', 'primary-soft-foreground',
       'success', 'success-foreground', 'success-soft', 'success-soft-foreground',
       'warning', 'warning-foreground', 'warning-soft', 'warning-soft-foreground',
       'danger', 'danger-foreground', 'danger-soft', 'danger-soft-foreground']


def block(t, dark):
    lines = []
    for k in SEM:
        lines.append(f'  --{k}: {o(t[k])}; /* {t[k]} */')
    lines.append('')
    for k, (ls, lsoft, ds, dsoft) in P.TRACKS.items():
        s, soft = (ds, dsoft) if dark else (ls, lsoft)
        lines.append(f'  --{k}: {o(s)}; /* {s} */')
        lines.append(f'  --{k}-soft: {o(soft)}; /* {soft} */')
    on = '#0C0A09' if dark else '#FFFFFF'
    lines.append(f'  --track-on-solid: {o(on)}; /* {on} */')
    lines.append('')
    heat = P.HEAT_DARK if dark else P.HEAT_LIGHT
    for i, h in enumerate(heat):
        lines.append(f'  --heat-{i}: {o(h)}; /* {h} */')
    lines.append('')
    # shadcn/ui compatibility aliases (primitives expect these names)
    alias = {
        'card': 'surface', 'card-foreground': 'foreground', 'popover': 'surface',
        'popover-foreground': 'foreground', 'secondary': 'surface-muted',
        'secondary-foreground': 'foreground', 'muted': 'surface-muted', 'accent': 'surface-muted',
        'accent-foreground': 'foreground', 'destructive': 'danger',
        'destructive-foreground': 'danger-foreground', 'input': 'border-strong',
        'chart-1': 'track-1', 'chart-2': 'track-2', 'chart-3': 'track-3', 'chart-4': 'track-4',
        'chart-5': 'track-5', 'sidebar': 'surface', 'sidebar-foreground': 'foreground',
        'sidebar-primary': 'primary', 'sidebar-primary-foreground': 'primary-foreground',
        'sidebar-accent': 'surface-muted', 'sidebar-accent-foreground': 'foreground',
        'sidebar-border': 'border', 'sidebar-ring': 'ring',
    }
    lines.append('  /* shadcn/ui aliases — `accent` here is shadcn\'s hover surface, NOT a track colour */')
    for a, b in alias.items():
        lines.append(f'  --{a}: var(--{b});')
    lines.append('')
    if dark:
        lines += ['  --elevation-xs: 0 0 0 0 transparent;',
                  '  --elevation-sm: 0 0 0 0 transparent;',
                  '  --elevation-md: 0 12px 32px -8px oklch(0 0 0 / 0.6);']
    else:
        lines += ['  --elevation-xs: 0 1px 2px 0 oklch(0.216 0.006 56 / 0.05);',
                  '  --elevation-sm: 0 1px 3px 0 oklch(0.216 0.006 56 / 0.08), 0 1px 2px -1px oklch(0.216 0.006 56 / 0.06);',
                  '  --elevation-md: 0 12px 32px -8px oklch(0.216 0.006 56 / 0.16);']
    return '\n'.join(lines)


theme_inline = []
for k in SEM:
    theme_inline.append(f'  --color-{k}: var(--{k});')
for a in ['card', 'card-foreground', 'popover', 'popover-foreground', 'secondary', 'secondary-foreground',
          'muted', 'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'input',
          'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'sidebar', 'sidebar-foreground',
          'sidebar-primary', 'sidebar-primary-foreground', 'sidebar-accent', 'sidebar-accent-foreground',
          'sidebar-border', 'sidebar-ring']:
    theme_inline.append(f'  --color-{a}: var(--{a});')
for i in range(5):
    theme_inline.append(f'  --color-heat-{i}: var(--heat-{i});')
theme_inline += ['  --color-track: var(--track);', '  --color-track-soft: var(--track-soft);',
                 '  --color-track-foreground: var(--track-foreground);',
                 '  --shadow-xs: var(--elevation-xs);', '  --shadow-sm: var(--elevation-sm);',
                 '  --shadow-md: var(--elevation-md);',
                 '  --font-sans: var(--font-be-vietnam-pro), ui-sans-serif, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
                 '  --font-mono: var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;']

accent_rules = '\n'.join(
    f'[data-accent="{k}"] {{ --track: var(--{k}); --track-soft: var(--{k}-soft); --track-foreground: var(--track-on-solid); }}'
    for k in P.TRACKS)

css = f'''/*
 * Học Đều — design token spec (gate 2).
 * GENERATED from docs/design/DESIGN_SYSTEM.md §3 values; M0 copies this into app/globals.css
 * (after `@import "tailwindcss"` and `@import "tw-animate-css"`; `shadcn eject` output is merged
 * so every visual value lives in one file). Hex comments are for review only.
 * Contrast of every pair is verified in DESIGN_SYSTEM.md Appendix A.
 */

@custom-variant dark (&:is(.dark *));

:root {{
  color-scheme: light;
  --radius: 0.5rem;
{block(P.LIGHT, False)}
}}

.dark {{
  color-scheme: dark;
{block(P.DARK, True)}
}}

/* Track accent context: a track's manifest names one of track-1..track-8 (§3.4 of the platform
   design). Components render data-accent="track-N" and use bg-track / text-track / bg-track-soft /
   ring-track — never a track number directly. */
:root {{ --track: var(--track-1); --track-soft: var(--track-1-soft); --track-foreground: var(--track-on-solid); }}
{accent_rules}

/* Tailwind's default theme is cleared for every namespace these tokens own, so only token
   utilities exist: a raw `bg-red-500`, `shadow-lg`, `text-5xl` or `font-serif` is an unknown class. */
@theme {{
  --color-*: initial;
  --font-*: initial;
  --text-*: initial;
  --text-shadow-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --inset-shadow-*: initial;
  --drop-shadow-*: initial;
  --ease-*: initial;
}}

@theme inline {{
{chr(10).join(theme_inline)}
}}

@theme {{
  /* Type scale — generous leading for stacked Vietnamese diacritics (ế, ộ, ữ) */
  --text-xs: 0.75rem;   --text-xs--line-height: 1.5;
  --text-sm: 0.875rem;  --text-sm--line-height: 1.55;
  --text-base: 1rem;    --text-base--line-height: 1.65;
  --text-lg: 1.125rem;  --text-lg--line-height: 1.6;
  --text-xl: 1.25rem;   --text-xl--line-height: 1.45;
  --text-2xl: 1.5rem;   --text-2xl--line-height: 1.35;
  --text-3xl: 1.875rem; --text-3xl--line-height: 1.3;
  --text-4xl: 2.25rem;  --text-4xl--line-height: 1.25;

  /* Radius */
  --radius-sm: calc(var(--radius) - 0.125rem);  /* 6px  — chips, inputs inner */
  --radius-md: var(--radius);                   /* 8px  — buttons, inputs */
  --radius-lg: calc(var(--radius) + 0.25rem);   /* 12px — cards */
  --radius-xl: calc(var(--radius) + 0.5rem);    /* 16px — sheets, dialogs */

  /* Layout widths */
  --container-prose: 72ch;  /* lessons, notes */
  --container-app: 80rem;   /* dashboard max width */

  /* Motion — easing curves (durations below are plain custom properties) */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15);
}}

:root {{
  --duration-fast: 120ms;   /* hover, press */
  --duration-base: 200ms;   /* state changes, toggles */
  --duration-slow: 300ms;   /* sheet / dialog enter */
  --duration-exit: 150ms;   /* exits are faster than enters */
}}

@media (prefers-reduced-motion: reduce) {{
  :root {{ --duration-fast: 0ms; --duration-base: 0ms; --duration-slow: 0ms; --duration-exit: 0ms; }}
  *, *::before, *::after {{
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }}
}}

@layer base {{
  * {{ @apply border-border; }}
  html {{ @apply bg-background text-foreground font-sans antialiased; }}
  :focus-visible {{ @apply outline-2 outline-offset-2 outline-ring; }}
}}
'''
open(f'{ROOT}/tokens.css', 'w').write(css)

# contrast report (markdown) for the appendix
rep = []
for name, t, dark in (('Light', P.LIGHT, False), ('Dark', P.DARK, True)):
    rows = P.checks(t, dark)
    rep.append(f'#### {name} theme — {len(rows)} checks, {sum(1 for r in rows if not r[3])} failing\n')
    rep.append('| Pair | Ratio | Needs | Result |\n| --- | --- | --- | --- |')
    for r in rows:
        rep.append(f'| {r[0]} | {r[1]:.2f} | {r[2]} | {"pass" if r[3] else "FAIL"} |')
    rep.append('')
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'contrast.md'), 'w').write('\n'.join(rep))

# token tables (markdown) for §3
def token_table(keys):
    out = ['| Token | Light | Dark | Use |', '| --- | --- | --- | --- |']
    return out

print('ok')
