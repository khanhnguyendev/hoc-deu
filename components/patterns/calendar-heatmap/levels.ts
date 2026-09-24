/** Five levels on the teal ramp (DESIGN_SYSTEM §3.4): 0, 1–15, 16–40, 41–75, > 75 minutes. */
export type HeatLevel = 0 | 1 | 2 | 3 | 4

export function levelFor(minutes: number): HeatLevel {
  if (minutes <= 0) return 0
  if (minutes <= 15) return 1
  if (minutes <= 40) return 2
  if (minutes <= 75) return 3
  return 4
}

export const CELL: Record<HeatLevel, string> = {
  0: 'bg-heat-0',
  1: 'bg-heat-1',
  2: 'bg-heat-2',
  3: 'bg-heat-3',
  4: 'bg-heat-4',
}

/**
 * Dot and day-number colours that keep contrast on each level: `foreground` on light levels,
 * `background` on dark ones. Level 2 is light in the light theme and dark in the dark theme.
 */
export const ON_CELL: Record<HeatLevel, { dot: string; text: string }> = {
  0: { dot: '', text: 'text-foreground' },
  1: { dot: 'bg-foreground/40', text: 'text-foreground' },
  2: {
    dot: 'bg-foreground/40 dark:bg-background/70',
    text: 'text-foreground dark:text-background',
  },
  3: { dot: 'bg-background/70', text: 'text-background' },
  4: { dot: 'bg-background/70', text: 'text-background' },
}
