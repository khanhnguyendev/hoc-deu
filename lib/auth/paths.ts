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
  // Compare the decoded path: `/%73ign-in` is routed as `/sign-in`. A malformed escape is refused.
  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return null
  }
  if (pathname === '/sign-in' || pathname.startsWith('/sign-in/')) return null
  if (pathname === '/auth' || pathname.startsWith('/auth/')) return null
  return next
}

export type SignInErrorCode = 'oauth' | 'rate_limited'

/**
 * Where a failed sign-in returns: `/sign-in?error=oauth` by default (the page shows "Đăng nhập
 * không thành công"), or `/sign-in?error=rate_limited` over the `oauthCallback` rate limit (§2.3,
 * task 6.1; the page shows `vi.rateLimit.tooMany`) — keeping a safe `next` so another try still
 * ends up where the user was going. The OAuth callback route uses this for both codes (fix round
 * 1, item 3: it must not rebuild the query string itself).
 */
export function signInErrorPath(
  next: string | null | undefined,
  code: SignInErrorCode = 'oauth',
): string {
  const params = new URLSearchParams({ error: code })
  const safeNext = safeNextPath(next)
  if (safeNext) params.set('next', safeNext)
  return `/sign-in?${params}`
}
