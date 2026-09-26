import Link from 'next/link'
import { Banner } from '@/components/patterns/banner'
import { buttonVariants } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { TrackProgressView } from '../view-model'

const copy = vi.today.throttle

/**
 * §5.5 throttle, explained (DESIGN_SYSTEM §11 "explain why"): a `warning` banner with the plan
 * snapshot's message — "Đang có 52 thẻ cần ôn — tạm giảm thẻ mới." — and one action, the track's
 * review queue. Nothing when the track is not throttled.
 */
function ThrottleNotice({ track }: { track: TrackProgressView }) {
  if (track.throttleMessage === null) return null
  return (
    <Banner
      tone="warning"
      action={
        <Link
          href={`/review?${new URLSearchParams({ track: track.trackId }).toString()}`}
          className={buttonVariants({ variant: 'outline' })}
        >
          {copy.action} <span className="sr-only">{track.title}</span>
        </Link>
      }
    >
      {track.throttleMessage}
    </Banner>
  )
}

export { ThrottleNotice }
