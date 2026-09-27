import { cva } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const linkListVariants = cva('flex flex-col rounded-lg border border-border bg-surface', {
  variants: {
    variant: {
      /** Rows apart on one surface: weak topics, admin links, drafts, related items. */
      spaced: 'gap-1 p-2',
      /** Rows divided by a rule: a roadmap week's item rows, Weak items. */
      divided: 'divide-y divide-border p-1',
    },
  },
  defaultVariants: { variant: 'spaced' },
})

/**
 * A bordered list of link rows on one surface (m-2: it was a class string copied into five
 * components): its children are `<li>`s, usually each holding one `LinkRow` or a registry Row.
 * `role="list"` keeps list semantics in Safari after Tailwind removes the bullets. Name it with
 * `aria-label` or `aria-labelledby` when the page has several.
 */
function LinkList({
  variant = 'spaced',
  children,
  ...props
}: Omit<React.ComponentProps<'ul'>, 'className' | 'role'> & {
  variant?: 'spaced' | 'divided'
}) {
  return (
    <ul role="list" data-slot="link-list" {...props} className={cn(linkListVariants({ variant }))}>
      {children}
    </ul>
  )
}

export { LinkList }
