import { NextResponse, type NextRequest } from 'next/server'
import { publicRoute } from '@/lib/auth/guards'
import { signInErrorPath } from '@/lib/auth/paths'
import { completeSignIn } from '@/lib/auth/sign-in'
import { createClient } from '@/lib/supabase/server'

/**
 * `GET /auth/callback` — Google or GitHub return here with a PKCE `code` (§2.4, ADR-0003). The
 * code is exchanged for a session (its verifier is in a cookie from `signInWithProvider`), a
 * listed admin is bootstrapped (§2.5), and the user goes to the safe `next` or their home path.
 * No code (e.g. the user cancelled) or a failed exchange → `/sign-in?error=oauth`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  publicRoute()
  const code = request.nextUrl.searchParams.get('code')
  const next = request.nextUrl.searchParams.get('next')
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url))

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) return redirectTo(await completeSignIn(supabase, data.user, next))
  }
  return redirectTo(signInErrorPath(next))
}
