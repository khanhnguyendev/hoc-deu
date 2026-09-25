import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicSupabaseEnv } from '@/lib/env'
import type { Database } from './database.types'

const PUBLIC_PATHS: ReadonlySet<string> = new Set(['/', '/sign-in', '/auth/callback'])

/**
 * Pages a signed-out visitor may open (§2.2). The `/dev` catalog stays open outside production
 * (e2e, previews); in production `requireDevAccess()` makes it admin-only.
 */
export function isPublicPath(pathname: string, vercelEnv: string | undefined): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  const devCatalog = pathname === '/dev' || pathname.startsWith('/dev/')
  return devCatalog && vercelEnv !== 'production'
}

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Refreshes the Supabase session and redirects signed-out visitors of private pages to
 * `/sign-in?next=…` (§2.2). **No database queries**: access decisions belong to the layouts and
 * the DAL (`lib/auth/dal.ts`). Reads only the public Supabase values — never `serverEnv()`.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { supabaseUrl, supabasePublishableKey } = publicSupabaseEnv()
  const cookiesToSet = new Map<string, CookieToSet>()
  const noStoreHeaders: Record<string, string> = {}

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        for (const cookie of cookies) {
          // On the request, so this request's Server Components see the refreshed session …
          request.cookies.set(cookie.name, cookie.value)
          // … and on the response (below), so the browser stores it.
          cookiesToSet.set(cookie.name, cookie)
        }
        // `Cache-Control: private, no-store …`: a response that sets auth cookies must never be
        // cached by a CDN and served to someone else.
        Object.assign(noStoreHeaders, headers)
      },
    },
  })

  // Nothing may run between creating the client and this call: `getClaims()` verifies the JWT and
  // refreshes an expired session, and `setAll` above runs before it resolves.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)
  const { pathname, search } = request.nextUrl

  let response: NextResponse
  if (signedIn || isPublicPath(pathname, process.env.VERCEL_ENV)) {
    // Created after `setAll`, so the forwarded request carries the refreshed cookies.
    response = NextResponse.next({ request })
  } else {
    const signIn = request.nextUrl.clone()
    signIn.pathname = '/sign-in'
    signIn.search = ''
    signIn.searchParams.set('next', `${pathname}${search}`)
    response = NextResponse.redirect(signIn)
  }

  for (const { name, value, options } of cookiesToSet.values()) {
    response.cookies.set(name, value, options)
  }
  for (const [key, value] of Object.entries(noStoreHeaders)) response.headers.set(key, value)
  return response
}
