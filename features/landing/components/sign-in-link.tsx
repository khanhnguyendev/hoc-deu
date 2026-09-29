import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'

/** The landing header's "Đăng nhập" (outline link-button to `/sign-in`), for `FocusLayout`. */
function SignInLink() {
  return (
    <Link href="/sign-in" className={buttonVariants({ variant: 'outline' })}>
      {vi.landing.signIn}
    </Link>
  )
}

/** The landing's primary action: "Bắt đầu học" → `/sign-in`. */
function StartLink() {
  return (
    <Link href="/sign-in" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
      {vi.landing.cta}
    </Link>
  )
}

export { SignInLink, StartLink }
