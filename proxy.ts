import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Next 16 proxy (formerly middleware, §2.2): refreshes the Supabase session and sends signed-out
 * visitors of private pages to `/sign-in`. It never decides access beyond that — layouts, server
 * actions and route handlers call the DAL guards (ADR-0006).
 */
export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Pages only: not route handlers under /api/, build assets, image optimisation, the favicon or
  // a path whose last segment has a file extension. `.rsc` is the exception: Next matches React
  // Server Component requests as `/page.rsc` or `/page.segments/….segment.rsc` on some platforms
  // (Vercel), and those must refresh the session like the page itself.
  matcher: ['/((?!api/|_next/static/|_next/image|favicon\\.ico$|.*\\.(?!rsc$)\\w+$).*)'],
}
