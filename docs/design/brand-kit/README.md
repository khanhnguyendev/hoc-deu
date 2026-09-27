# Học Đều — brand kit

The mark is **six calendar-heatmap cells in an even staircase**. Each cell is one study day, every
step is the same height (*đều* means steady), and the colour deepens left to right exactly as the
heatmap does when you log more minutes. Open `preview.html` for the visual guide.

## Source of truth

Nothing in this folder is hand-picked. `_source/gen_brand.py` reads:

- colours from `docs/design/assets/palette.py` (the same file `gen_tokens.py` uses), and
- glyphs from `app/fonts/be-vietnam-pro/*.woff2` (the app's own Vietnamese subset).

Rebuild after changing either:

```sh
pip install fonttools brotli cairosvg pillow
python3 docs/design/brand-kit/_source/gen_brand.py      # svg/, png/, brand-tokens.json, contrast.md
python3 docs/design/brand-kit/_source/build_preview.py  # preview.html
```

| Element | Value | Design-system source |
| --- | --- | --- |
| Mark cells, light | `#2DD4BF` `#0D9488` `#115E59` | `heat-1` `heat-2` `heat-3` |
| Mark cells, dark | `#0D9488` `#2DD4BF` `#CCFBF1` | dark `heat-2` `heat-3` `heat-4` (dark `heat-1` is 2.1:1 on `background`, so it is skipped) |
| Wordmark | `#1C1917` / `#FAFAF9`, weight 600, tracking 0 | `foreground`; `text-lg font-semibold` in `FocusLayout` and the sidebar |
| Cell : gap | 24 : 6 (4 : 1) | Year-view heatmap: `size-3` cells, `gap-0.75` |
| Cell corner | 18 % of the cell | Month-view day cell: `rounded-md` on `size-11` |
| App icon tile | `#042F2E` + dark ramp | light `heat-4` |

Contrast of every cell against its background is in `contrast.md`. Light cell 1 is 1.8:1 on
`background`; logos are exempt from WCAG 1.4.11 and cells 2–3 carry the shape, but use a
one-colour mark where the logo is the only cue.

## Folder map

| Folder | Contents |
| --- | --- |
| `svg/mark/` | Mark: colour (light), on-dark, mono black, mono white, mono teal |
| `svg/wordmark/` | "Học Đều" outlined (no font needed): light, on-dark, white |
| `svg/lockup/` | Horizontal and stacked lockups, light and dark; horizontal mono black and white |
| `svg/app-icon/` | App icon (rounded tile), maskable icon (full bleed), `favicon.svg` |
| `svg/social/` | Open Graph image source |
| `png/` | `favicon-16/32/48.png`, `favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png`, `og-image.png`, mark and lockup PNGs |

## Wiring it into the app

Next.js reads these by file name:

```
app/icon.svg              ← svg/app-icon/favicon.svg
app/favicon.ico           ← png/favicon.ico
app/apple-icon.png        ← png/apple-touch-icon.png
app/opengraph-image.png   ← png/og-image.png
public/icon-192.png       ← png/icon-192.png
public/icon-512.png       ← png/icon-512.png
public/icon-maskable-512.png ← png/icon-maskable-512.png
```

In the UI, draw the mark inline with the existing heat utilities so it follows the theme and passes
the token guard (no hex, no arbitrary values):

```tsx
// components/patterns/logo-mark.tsx
import { cn } from '@/lib/utils'

const CELLS = [[2, 0], [2, 1], [2, 2], [1, 1], [1, 2], [0, 2]] as const
const FILL = [
  'fill-heat-1 dark:fill-heat-2',
  'fill-heat-2 dark:fill-heat-3',
  'fill-heat-3 dark:fill-heat-4',
] as const

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 84 84" aria-hidden="true" className={cn('size-6 shrink-0', className)}>
      {CELLS.map(([r, c]) => (
        <rect key={`${r}-${c}`} x={c * 30} y={r * 30} width={24} height={24} rx={4.36} className={FILL[c]} />
      ))}
    </svg>
  )
}
```

Then put `<LogoMark />` before the "Học Đều" text in `FocusLayout`'s header link and the sidebar
title (keep the text, so the link's accessible name stays "Học Đều" and the existing tests pass).
If you add it, list it in `COMPONENTS.md` and `/dev/components` as the design system asks.

## Rules

- **Clear space:** one cell on every side. **Minimum size:** mark 16 px, horizontal lockup 96 px wide.
- **Colour:** the heat ramp, one flat colour, or white on teal. Track colours (indigo, orange…)
  identify tracks and never go on the logo.
- **Don't** rotate, mirror or reorder the cells, add gradients, shadows or glow, set the wordmark in
  capitals, or tighten its letter spacing (Vietnamese diacritics collide).

Fonts: Be Vietnam Pro, SIL Open Font License 1.1 (`app/fonts/be-vietnam-pro/OFL.txt`).
