import type * as React from 'react'

/** Rows of 44 px or more with dividers; renders `empty` when there are no items. */
function DataList<T>({
  items,
  getKey,
  renderItem,
  empty,
  label,
}: {
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T) => React.ReactNode
  empty: React.ReactNode
  label?: string
}) {
  if (items.length === 0) return <>{empty}</>
  return (
    // role="list" keeps list semantics in Safari after Tailwind removes the bullets.
    <ul
      data-slot="data-list"
      role="list"
      aria-label={label}
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
    >
      {items.map((item) => (
        <li key={getKey(item)} className="flex min-h-11 items-center gap-3 px-4 py-3">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  )
}

export { DataList }
