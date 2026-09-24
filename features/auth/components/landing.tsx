import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'

/** The signed-out landing page's content (§2.4): wordmark, positioning line, "Đăng nhập". */
function Landing() {
  return (
    <div data-slot="landing" className="flex flex-col items-center gap-6 text-center">
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
