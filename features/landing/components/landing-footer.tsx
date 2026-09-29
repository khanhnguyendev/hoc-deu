import Link from 'next/link'
import { LogoMark } from '@/components/patterns/logo-mark'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { vi } from '@/lib/i18n/vi'

const copy = vi.landing.footer

/**
 * The landing's quiet page footer (DESIGN_SYSTEM §15): a hairline, the mark and wordmark on the
 * left, the repository link and the licences on the right. No teal, no button look.
 */
function LandingFooter() {
  return (
    <footer
      data-slot="landing-footer"
      className="flex flex-col gap-4 border-t border-border pt-6 md:flex-row md:items-center md:justify-between"
    >
      <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
        <LogoMark />
        Học Đều
      </Link>
      <div className="flex flex-col gap-1 md:items-end">
        <a
          href={copy.githubHref}
          className={cn(
            buttonVariants({ variant: 'link' }),
            'justify-start px-0 text-foreground underline md:justify-end',
          )}
        >
          {copy.openSource}
        </a>
        <p className="text-sm text-muted-foreground">{copy.licences}</p>
      </div>
    </footer>
  )
}

export { LandingFooter }
