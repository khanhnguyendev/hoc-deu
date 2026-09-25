import { Archive, PencilLine, type LucideIcon } from 'lucide-react'
import { Banner } from '@/components/patterns/banner'
import { Badge } from '@/components/ui/badge'
import type { ItemStatus } from '@/lib/content/schemas/common'
import { vi } from '@/lib/i18n/vi'

type HiddenStatus = Exclude<ItemStatus, 'active'>

const STATUS: Record<
  HiddenStatus,
  { label: string; notice: string; icon: LucideIcon; tone: 'warning' | 'neutral' }
> = {
  draft: {
    label: vi.items.status.draft,
    notice: vi.items.notice.draft,
    icon: PencilLine,
    tone: 'warning',
  },
  retired: {
    label: vi.items.status.retired,
    notice: vi.items.notice.retired,
    icon: Archive,
    tone: 'neutral',
  },
}

/** A row's "Bản nháp" / "Đã ngừng" badge (§3.3): icon + label; nothing for an active item. */
function ItemStatusBadge({ status }: { status: ItemStatus }) {
  if (status === 'active') return null
  const { label, icon: Icon, tone } = STATUS[status]
  return (
    <Badge tone={tone} data-status={status}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {label}
    </Badge>
  )
}

/**
 * The notice at the top of a draft (info: only admins see it) or retired (warning: no longer
 * scheduled) item's page; nothing for an active item.
 */
function ItemStatusNotice({ status }: { status: ItemStatus }) {
  if (status === 'active') return null
  return <Banner tone={status === 'draft' ? 'info' : 'warning'}>{STATUS[status].notice}</Banner>
}

export { ItemStatusBadge, ItemStatusNotice }
