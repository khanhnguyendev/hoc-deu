import { ExternalLink as ExternalLinkIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { vi } from '@/lib/i18n/vi'

/**
 * The MDX `a` override: content links are `https:` only (the safety check guarantees it) and open
 * in a new tab, safely, saying so to screen readers. Anything else renders as plain text — fail
 * closed if a link ever gets past the check.
 */
function ExternalLink({ href, children }: ComponentProps<'a'>) {
  if (typeof href !== 'string' || !href.startsWith('https://')) return <span>{children}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4 hover:text-primary-hover"
    >
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
