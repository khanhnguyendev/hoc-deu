import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { TABLE_FRAME } from './typography'

/**
 * `<VarTable caption?>` — a step-by-step variable table around one GFM table: a focusable
 * horizontal scroll region (keyboard users can scroll it) named by the caption, cells in mono.
 * The MDX `table` override frames a table on its own; here it is told not to (`framed={false}`),
 * so there is one region, not two.
 */
function VarTable({ caption, children }: { caption?: string; children?: ReactNode }) {
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={caption ?? vi.content.varTable}
      data-slot="var-table"
      className={cn(TABLE_FRAME, '[&_td]:font-mono')}
    >
      {Children.map(children, (child) =>
        isValidElement(child) && typeof child.type !== 'string'
          ? cloneElement(child as ReactElement<{ framed?: boolean }>, { framed: false })
          : child,
      )}
    </div>
  )
}

export { VarTable }
