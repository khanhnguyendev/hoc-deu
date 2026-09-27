import Link from 'next/link'
import { Banner } from '@/components/patterns/banner'
import { buttonVariants } from '@/components/ui/button'
import { reviewHref } from '@/features/items/href'
import { vi } from '@/lib/i18n/vi'
import type { TrackProgressView } from '../view-model'

const copy = vi.today.throttle

/**
 * §5.5 throttle, explained (DESIGN_SYSTEM §11 "explain why") — the one place `/today` says it (UI
 * I-5): a `warning` banner with the plan snapshot's message in the past tense — "Kế hoạch này được
 * lập khi bạn có 52 thẻ cần ôn — tạm giảm thẻ mới." (the plan-time count; the live one is in
 * TodayStats) — and one action, the track's review queue. Nothing when the track is not throttled.
 */
function ThrottleNotice({ track }: { track: TrackProgressView }) {
  if (track.throttleMessage === null) return null
  return (
    <Banner
      tone="warning"
      action={
        <Link href={reviewHref(track.trackId)} className={buttonVariants({ variant: 'outline' })}>
          {copy.action} <span className="sr-only">{track.title}</span>
        </Link>
      }
    >
      {track.throttleMessage}
    </Banner>
  )
}

export { ThrottleNotice }
