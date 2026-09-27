'use client'

import Link from 'next/link'
import type * as React from 'react'
import { formatNumber } from '@/lib/i18n/format'
import { cn } from '@/lib/utils'
import { pillVariants, STATUS_PILL, type PillStatus } from './status-pill'

/** The 44 px hit-area technique every filter chip shares (DESIGN_SYSTEM §5): a 32 px pill with a
 *  transparent hit area of at least 44 px (8 px above and below the padding box). */
const CHIP_HIT_AREA = 'relative before:absolute before:inset-x-0 before:-inset-y-2'
/** The "on" / current ring, shared by the toggle chip and the link chip. */
const CHIP_RING = 'ring-2 ring-primary'

/**
 * Chips that act (DESIGN_SYSTEM §5): a 32 px pill with a transparent hit area of at least 44 px
 * (8 px above and below the padding box, so bordered chips still reach 44 px). The group keeps chips
 * 8 px apart in a row and 20 px between rows, so hit areas never overlap. `as="nav"` groups real
 * navigation links (`FilterChipLink`); the default `div` groups toggle buttons (`FilterChip`).
 */
function FilterChipGroup({
  label,
  as = 'div',
  children,
}: {
  label: string
  as?: 'div' | 'nav'
  children: React.ReactNode
}) {
  const Tag = as
  const attrs =
    as === 'nav' ? { 'aria-label': label } : { role: 'group' as const, 'aria-label': label }
  return (
    <Tag {...attrs} className="flex flex-wrap gap-x-2 gap-y-5">
      {children}
    </Tag>
  )
}

/** A status filter toggle: the StatusPill look, `aria-pressed`, a ring when on. */
function FilterChip({
  status,
  pressed,
  onPressedChange,
}: {
  status: PillStatus
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
}) {
  const { label, icon: Icon, classes } = STATUS_PILL[status]
  return (
    <button
      type="button"
      data-slot="filter-chip"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(pillVariants({ size: 'md' }), classes, CHIP_HIT_AREA, pressed && CHIP_RING)}
    >
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
      {label}
    </button>
  )
}

/**
 * A filter chip that is a real link (a page navigation, such as `/review?track=`) rather than a
 * client toggle: a neutral pill with `label` and `count`, `aria-current="page"` on the one in
 * force. Shares the toggle chip's pill shape and 44 px hit area (`pillVariants`, `CHIP_HIT_AREA`)
 * so the two never drift apart (task 5.3 review, finding I4).
 */
function FilterChipLink({
  href,
  label,
  count,
  current,
}: {
  href: string
  label: string
  count: number
  current: boolean
}) {
  return (
    <Link
      href={href}
      data-slot="filter-chip-link"
      aria-current={current ? 'page' : undefined}
      className={cn(
        pillVariants({ size: 'md' }),
        CHIP_HIT_AREA,
        current
          ? cn('bg-primary-soft text-primary-soft-foreground', CHIP_RING)
          : 'bg-surface-muted text-foreground',
      )}
    >
      {label} <span className="font-mono tabular-nums">{formatNumber(count)}</span>
    </Link>
  )
}

export { FilterChip, FilterChipGroup, FilterChipLink }
export type { PillStatus }
