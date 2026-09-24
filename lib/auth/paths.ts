import type { SessionUser } from './dal'

export type HomePath = '/pending' | '/onboarding' | '/today'

/** Where a signed-in user belongs: the waiting room, onboarding or today's plan (§2.2). */
export function homePathFor(user: Pick<SessionUser, 'status' | 'onboardedAt'>): HomePath {
  if (user.status !== 'active') return '/pending'
  if (!user.onboardedAt) return '/onboarding'
  return '/today'
}

// Browsers strip tabs and newlines from URLs (`/\t/evil.test` becomes `//evil.test`) and treat a
// backslash like a slash, so any control character, space or backslash disqualifies the value.
const UNSAFE_CHARACTERS = /[\u0000-\u0020\u007f\\]/

/**
 * The `next` parameter if it is a same-origin path we may redirect to after sign-in, else `null`
 * (open-redirect guard). Returns the value unchanged: the browser resolves it against our origin.
 * Sign-in and the OAuth callback are never targets, so a redirect cannot loop back into them.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  if (UNSAFE_CHARACTERS.test(next)) return null
  let url: URL
  try {
    url = new URL(next, 'http://x')
  } catch {
    return null
  }
  if (url.host !== 'x') return null
  const { pathname } = url
  if (pathname === '/sign-in' || pathname.startsWith('/sign-in/')) return null
  if (pathname === '/auth' || pathname.startsWith('/auth/')) return null
  return next
}
