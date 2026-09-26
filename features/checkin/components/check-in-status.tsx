import { Pencil } from 'lucide-react'
import Link from 'next/link'
import { StatusPill } from '@/components/patterns/status-pill'
import { buttonVariants } from '@/components/ui/button'
import type { BlockState } from '@/lib/domain/state'
import { formatMinutes } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

const copy = vi.checkIn.status

type CheckInStatusProps = {
  checkIn: Pick<BlockState, 'status' | 'minutes' | 'auto'>
  /** `/today?block=<id>`: "Sửa" opens the check-in sheet for this block (§2.4). */
  editHref: string
  /** Marks the "Sửa" link (`data-check-in-edit`): the sheet and the one-tap put focus back on
   *  it (DESIGN_SYSTEM §10). */
  blockId: string
  /** "{kind} · {track}": names the "Sửa" link for screen readers (several on one page). */
  blockLabel: string
  /** The paused view (§5.2): a skipped block says how to correct it (M-6 a). */
  paused?: boolean
}

/**
 * A checked-in block's status row (DESIGN_SYSTEM §9: the one-tap button collapses into it):
 * "Đã check-in", the block status pill (§3.3 — Xong / Một phần / Bỏ qua, icon + label, never
 * colour alone), the minutes, "tự động" for the server's auto check-in (§5.5), and "Sửa", a link
 * to `/today?block=<id>` (it keeps the scroll position; the sheet opens on top). In the paused
 * view a skipped block adds "Đã bỏ qua — bấm Sửa khi bạn làm xong" — its items' results never
 * check it in again automatically (§5.5) — and the owner's line on when the correction counts
 * (ruling M-6 a). Server-compatible.
 */
function CheckInStatus({
  checkIn,
  editHref,
  blockId,
  blockLabel,
  paused = false,
}: CheckInStatusProps) {
  return (
    <div
      data-slot="check-in-status"
      data-status={checkIn.status}
      className="flex flex-col gap-2 border-t border-border pt-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{copy.checkedIn}</span> <StatusPill status={`block-${checkIn.status}`} />{' '}
          <span>{formatMinutes(checkIn.minutes)}</span>
          {checkIn.auto && (
            <>
              {' '}
              <span aria-hidden="true">·</span> <span>{copy.auto}</span>
            </>
          )}
        </p>
        <Link
          href={editHref}
          scroll={false}
          data-check-in-edit={blockId}
          className={buttonVariants({ variant: 'outline' })}
        >
          <Pencil aria-hidden="true" strokeWidth={1.75} />
          {copy.edit} <span className="sr-only">{blockLabel}</span>
        </Link>
      </div>
      {paused && checkIn.status === 'skipped' && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{copy.skippedHint}</p>
          <p className="text-muted-foreground">{copy.skippedRule}</p>
        </div>
      )}
    </div>
  )
}

export { CheckInStatus }
export type { CheckInStatusProps }
