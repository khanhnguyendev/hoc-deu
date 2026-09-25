import Link from 'next/link'
import { Banner } from '@/components/patterns/banner'
import { buttonVariants } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'

type LandingProps = {
  /** `?account=deleted` (§4.6): shows the deleted-account notice above the wordmark. */
  deleted?: boolean
}

/** The signed-out landing page's content (§2.4): wordmark, positioning line, "Đăng nhập". */
function Landing({ deleted = false }: LandingProps) {
  return (
    <div data-slot="landing" className="flex flex-col items-center gap-6 text-center">
      {deleted && <Banner tone="info">{vi.landing.deletedBanner}</Banner>}
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold md:text-4xl">Học Đều</h1>
        <p className="text-base text-muted-foreground">{vi.landing.positioning}</p>
      </div>
      <Link href="/sign-in" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
        {vi.landing.signIn}
      </Link>
    </div>
  )
}

export { Landing }
export type { LandingProps }
