import { NextResponse, type NextRequest } from 'next/server'
import { publicRoute } from '@/lib/auth/guards'
import { signInErrorPath } from '@/lib/auth/paths'
import { completeSignIn } from '@/lib/auth/sign-in'
import { createClient } from '@/lib/supabase/server'

/**
 * `GET /auth/callback` — Google or GitHub return here with a PKCE `code` (§2.4, ADR-0003). The
 * code is exchanged for a session (its verifier is in a cookie from `signInWithProvider`), a
 * listed admin is bootstrapped (§2.5), and the user goes to the safe `next` or their home path.
 * No code (e.g. the user cancelled) or a failed exchange → `/sign-in?error=oauth`. A failure
 * *after* the exchange succeeded — the bootstrap RPC or the profile read, inside `completeSignIn`
 * — signs the exchanged session out locally (cookies only) and returns the same way, instead of
 * a bare 500 (route handlers bypass `error.tsx`, M2 minor; ADR-0003).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  publicRoute()
  const code = request.nextUrl.searchParams.get('code')
  const next = request.nextUrl.searchParams.get('next')
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      try {
        return redirectTo(await completeSignIn(supabase, data.user, next))
      } catch {
        await supabase.auth.signOut({ scope: 'local' })
      }
    }
  }
  return redirectTo(signInErrorPath(next))
}
