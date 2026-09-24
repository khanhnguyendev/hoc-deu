import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { FocusLayout } from '@/components/patterns/focus-layout'
import { SignInPanel, signInWithProvider, signInWithTestLogin } from '@/features/auth'
import { getSessionUser } from '@/lib/auth/dal'
import { homePathFor, safeNextPath } from '@/lib/auth/paths'
import { serverEnv } from '@/lib/env'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.auth.signInTitle} — Học Đều` }

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/** Public (§2.2): Google/GitHub OAuth, and the test login where enabled. */
export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  // The session read comes first: it makes the page dynamic, so `serverEnv()` below never runs
  // while `next build` prerenders (CI builds without runtime secrets).
  const user = await getSessionUser()
  if (user) redirect(homePathFor(user))

  const params = await searchParams
  return (
    <FocusLayout>
      <SignInPanel
        next={safeNextPath(first(params.next))}
        oauthError={first(params.error) === 'oauth'}
        testLogin={serverEnv().authTestLogin}
        signInWithProvider={signInWithProvider}
        signInWithTestLogin={signInWithTestLogin}
      />
    </FocusLayout>
  )
}
