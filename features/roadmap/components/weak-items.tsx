import type * as React from 'react'
import { Section } from '@/components/patterns/section'
import { vi } from '@/lib/i18n/vi'
import { RowList } from './week-section'

const copy = vi.extra.weak

/**
 * The track's Weak items on the track page (§5.7; Part B-M3 decision 25; task 5.4): their registry
 * rows (built by the page with the learner's state and status pill, `renderItemRow`) in the
 * roadmap's bordered list, or "Chưa có mục yếu nào trong lộ trình này." Server-compatible.
 */
function WeakItems({ rows }: { rows: readonly React.ReactNode[] }) {
  return (
    <Section title={copy.title} description={rows.length > 0 ? copy.description : undefined}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      ) : (
        <RowList rows={[...rows]} />
      )}
    </Section>
  )
}

export { WeakItems }
