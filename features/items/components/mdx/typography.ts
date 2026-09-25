import { cva } from 'class-variance-authority'

/**
 * Shared classes of the MDX content components (DESIGN_SYSTEM §4.2–§4.3): headings, the vertical
 * rhythm between blocks and the frame of a scrollable table. Components compose these instead of
 * copying class strings (platform design §7.4).
 */
export const contentHeading = cva('font-semibold text-foreground', {
  variants: {
    level: {
      2: 'text-xl md:text-2xl',
      3: 'text-lg',
      4: 'text-base',
    },
  },
})

/** Space between the blocks of a container (safe around inline content too). */
export const CONTENT_FLOW = 'space-y-4'

/** A focusable horizontal scroll region around a table (`VarTable`, a Markdown table). */
export const TABLE_FRAME = 'overflow-x-auto rounded-lg border border-border'
