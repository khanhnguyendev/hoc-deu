import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type CookieToSet = { name: string; value: string; options: Record<string, unknown> }
type CookieMethods = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookies: CookieToSet[], headers: Record<string, string>) => void
}

const ssr = vi.hoisted(() => ({
  claims: null as Record<string, unknown> | null,
  onGetClaims: undefined as ((cookies: CookieMethods) => void) | undefined,
  createServerClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: ssr.createServerClient.mockImplementation(
    (_url: string, _key: string, options: { cookies: CookieMethods }) => ({
      auth: {
        getClaims: async () => {
          ssr.onGetClaims?.(options.cookies)
          return ssr.claims
            ? { data: { claims: ssr.claims }, error: null }
            : { data: null, error: null }
        },
      },
    }),
  ),
}))

const { isPublicPath, updateSession } = await import('./proxy')

describe('isPublicPath', () => {
  it.each(['/', '/sign-in', '/auth/callback'])('%s is public everywhere', (pathname) => {
    expect(isPublicPath(pathname, undefined)).toBe(true)
    expect(isPublicPath(pathname, 'preview')).toBe(true)
    expect(isPublicPath(pathname, 'production')).toBe(true)
  })

  it.each([
    '/today',
    '/sign-in-x',
    '/sign-in/x',
    '/auth',
    '/auth/callback/x',
    '/pending',
    '/admin',
  ])('%s needs a session', (pathname) => {
    expect(isPublicPath(pathname, undefined)).toBe(false)
    expect(isPublicPath(pathname, 'production')).toBe(false)
  })

  it('keeps the /dev catalog public outside production only', () => {
    for (const pathname of ['/dev', '/dev/components', '/dev/app-shell']) {
      expect(isPublicPath(pathname, undefined)).toBe(true)
      expect(isPublicPath(pathname, 'development')).toBe(true)
      expect(isPublicPath(pathname, 'preview')).toBe(true)
      expect(isPublicPath(pathname, 'production')).toBe(false)
    }
    expect(isPublicPath('/devx', 'preview')).toBe(false)
  })
})

describe('updateSession', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
    vi.stubEnv('VERCEL_ENV', '')
    ssr.claims = null
    ssr.onGetClaims = undefined
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  const request = (path: string) => new NextRequest(new URL(path, 'http://localhost:3100'))

  it('uses the publishable key and the request cookies', async () => {
    const req = request('/')
    req.cookies.set('sb-test-auth-token', 'value')
    let seen: { name: string; value: string }[] = []
    ssr.onGetClaims = (cookies) => {
      seen = cookies.getAll()
    }
    await updateSession(req)
    expect(ssr.createServerClient).toHaveBeenLastCalledWith(
      'http://127.0.0.1:54321',
      'sb_publishable_test',
      expect.anything(),
    )
    expect(seen).toEqual([{ name: 'sb-test-auth-token', value: 'value' }])
  })

  it('redirects a signed-out visit to a private page to /sign-in with next', async () => {
    const response = await updateSession(request('/today?tab=x'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location') ?? '')
    expect(location.pathname).toBe('/sign-in')
    expect(location.searchParams.get('next')).toBe('/today?tab=x')
  })

  it('lets a signed-out visit to a public page through', async () => {
    const response = await updateSession(request('/sign-in'))
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('redirects /dev/* in production but not in a preview', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect((await updateSession(request('/dev/components'))).status).not.toBe(307)
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await updateSession(request('/dev/components'))).status).toBe(307)
  })

  it('lets a signed-in visit through', async () => {
    ssr.claims = { sub: 'user-1' }
    const response = await updateSession(request('/today'))
    expect(response.headers.get('location')).toBeNull()
  })

  it('writes refreshed cookies and the no-store headers onto the response', async () => {
    ssr.claims = { sub: 'user-1' }
    ssr.onGetClaims = (cookies) =>
      cookies.setAll([{ name: 'sb-test-auth-token', value: 'fresh', options: { path: '/' } }], {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
      })
    const response = await updateSession(request('/today'))
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('fresh')
    expect(response.headers.get('cache-control')).toContain('no-store')
    // The refreshed cookie is also forwarded to the Server Components of this request.
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      'sb-test-auth-token=fresh',
    )
  })

  it('keeps cleared cookies and the no-store headers on a sign-in redirect', async () => {
    ssr.onGetClaims = (cookies) =>
      cookies.setAll([{ name: 'sb-test-auth-token', value: '', options: { maxAge: 0 } }], {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
      })
    const response = await updateSession(request('/today'))
    expect(response.status).toBe(307)
    expect(response.headers.get('set-cookie')).toContain('sb-test-auth-token=;')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })
})
