import { ExternalLink as ExternalLinkIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { vi } from '@/lib/i18n/vi'

/** The inline style of a content link. */
const INLINE_LINK = 'text-primary underline underline-offset-4 hover:text-primary-hover'

/**
 * The MDX `a` override: content links are `https:` only (the safety check guarantees it) and open
 * in a new tab, safely, saying so to screen readers. Anything else renders as plain text — fail
 * closed if a link ever gets past the check. `className` (code only; Markdown cannot set it)
 * replaces the inline style, e.g. a button look for "Mở trên LeetCode".
 */
function ExternalLink({ href, className, children }: ComponentProps<'a'>) {
  if (typeof href !== 'string' || !href.startsWith('https://')) return <span>{children}</span>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className ?? INLINE_LINK}>
      {children} <span className="sr-only">{vi.content.newTab}</span>
      <ExternalLinkIcon
        aria-hidden="true"
        strokeWidth={1.75}
        className="inline size-4 align-text-bottom"
      />
    </a>
  )
}

export { ExternalLink }
