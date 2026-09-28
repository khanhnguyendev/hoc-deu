import type * as React from 'react'
import { ErrorState } from '@/components/patterns/error-state'
import { LinkList } from '@/components/patterns/link-list'
import { Section } from '@/components/patterns/section'
import { Badge } from '@/components/ui/badge'
import { vi } from '@/lib/i18n/vi'
import { HideCustomItemButton, type HideCustomItemAction } from './hide-custom-item-button'

const copy = vi.customItems

/** One custom item's line: its registry row (built by the page), and whether it is hidden. */
export type CustomItemSlot = {
  readonly itemId: string
  readonly title: string
  readonly row: React.ReactNode
  readonly hidden: boolean
}

/** The tab's data: the items (active first, then hidden), or the read failed. */
export type CustomItemsTabData =
  | { readonly state: 'ready'; readonly items: readonly CustomItemSlot[] }
  | { readonly state: 'error' }

/**
 * The track page's "Mục riêng" tab (§2.4, §5.12; task 6.6a): the learner's custom items of the
 * track, whatever the AI flag — each its registry row (a link to the item page, where it is
 * studied) with "Ẩn" (HideCustomItemButton), or the "Đã ẩn" badge once hidden (words, never
 * colour alone). Nothing without items (the page then shows no tab); the error state when the
 * items could not be read. Server-compatible: only the button is a client leaf.
 */
function CustomItemsTab({
  data,
  hide,
  requestId,
}: {
  data: CustomItemsTabData
  hide: HideCustomItemAction
  requestId: string
}) {
  if (data.state === 'ready' && data.items.length === 0) return null
  return (
    <Section title={copy.title} description={copy.description}>
      {data.state === 'error' ? (
        <ErrorState title={copy.error.title} description={copy.error.description} titleAs="h3" />
      ) : (
        <LinkList variant="divided" aria-label={copy.title}>
          {data.items.map((slot) => (
            <li key={slot.itemId} className="flex items-center gap-2 pr-2">
              <div className="min-w-0 flex-1">{slot.row}</div>
              {slot.hidden ? (
                <Badge tone="neutral">{copy.hidden}</Badge>
              ) : (
                <HideCustomItemButton
                  action={hide}
                  requestId={requestId}
                  itemId={slot.itemId}
                  title={slot.title}
                />
              )}
            </li>
          ))}
        </LinkList>
      )}
    </Section>
  )
}

export { CustomItemsTab }
