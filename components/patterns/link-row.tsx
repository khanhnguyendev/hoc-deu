import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type * as React from 'react'

export type LinkRowProps = {
  href: string
  title: React.ReactNode
  /** `en` for English learning content (a LeetCode title, a card front). */
  titleLang?: 'en' | 'vi'
  /** Short facts, joined with " · " (the separators are hidden from screen readers). */
  meta?: React.ReactNode[]
  badges?: React.ReactNode
  /** Right-aligned, e.g. a StatusPill. */
  trailing?: React.ReactNode
}

/**
 * A list row that is one link (DESIGN_SYSTEM §5, §9): at least 44 px tall, the whole row the
 * target, the global focus ring, a hover surface and a chevron. Item rows, related items.
 */
export function LinkRow({ href, title, titleLang, meta, badges, trailing }: LinkRowProps) {
  const facts = (meta ?? []).filter((part) => part !== null && part !== undefined && part !== '')
  const hasDetails = facts.length > 0 || Boolean(badges)
  return (
    <Link
      href={href}
      data-slot="link-row"
      className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-foreground transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-muted"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span lang={titleLang} className="font-medium">
          {title}
        </span>
        {hasDetails && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {facts.length > 0 && (
              <span data-slot="link-row-meta">
                {facts.map((part, index) => (
                  // The facts are a fixed, ordered list: the index is their identity.
                  <span key={index}>
                    {index > 0 && <span aria-hidden="true"> · </span>}
                    <span>{part}</span>
                  </span>
                ))}
              </span>
            )}
            {badges}
          </span>
        )}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
      <ChevronRight
        aria-hidden="true"
        strokeWidth={1.75}
        className="size-4 shrink-0 text-subtle-foreground"
      />
    </Link>
  )
}
