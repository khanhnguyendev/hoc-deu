import { Banner } from '@/components/patterns/banner'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { fill, formatDay } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { ResumeButton, type ResumeAction } from './resume-button'

const copy = vi.today.paused

/**
 * The gate is closed (§5.2): a `warning` banner — icon, "Lộ trình đang tạm dừng — hoàn thành ít
 * nhất một phần để tiếp tục.", the paused plan's own date — and, when the plan is more than 2
 * local days old, "Học tiếp hôm nay" (§5.8). Encouraging, never guilt-driven (DESIGN_SYSTEM §11).
 */
function PausedBanner({
  planDate,
  offerResume,
  resume,
}: {
  planDate: LocalDay
  offerResume: boolean
  resume: ResumeAction
}) {
  return (
    <Banner tone="warning" action={offerResume ? <ResumeButton resume={resume} /> : undefined}>
      {copy.title}{' '}
      <span className="mt-1 block font-medium">
        {fill(copy.planDate, { date: formatDay(planDate) })}
      </span>
    </Banner>
  )
}

export { PausedBanner }
