import { useId, type ReactNode } from 'react'
import { vi } from '@/lib/i18n/vi'
import { own } from './copy'
import { CONTENT_FLOW, contentHeading } from './typography'

/**
 * `<Section kind>` — one section of a lesson (platform design §3.5): a region labelled by an `h2`
 * from `vi.content.sections[kind]`, falling back to the kind ID so a new track's lesson format
 * works without code (decision 33). `data-section` lets tests read the order.
 */
function Section({ kind, children }: { kind: string; children?: ReactNode }) {
  const headingId = useId()
  return (
    <section data-section={kind} aria-labelledby={headingId} className={CONTENT_FLOW}>
      <h2 id={headingId} className={contentHeading({ level: 2 })}>
        {own(vi.content.sections, kind) ?? kind}
      </h2>
      {children}
    </section>
  )
}

export { Section }
