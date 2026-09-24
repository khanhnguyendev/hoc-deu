'use server'

import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/dal'
import { publicRoute } from '@/lib/auth/guards'
import { safeNextPath, signInErrorPath } from '@/lib/auth/paths'
import { completeSignIn } from '@/lib/auth/sign-in'
import { serverEnv } from '@/lib/env'
import { vi } from '@/lib/i18n/vi'
import { createClient } from '@/lib/supabase/server'

const PROVIDERS = ['google', 'github'] as const
type Provider = (typeof PROVIDERS)[number]
const isProvider = (value: unknown): value is Provider =>
  PROVIDERS.some((provider) => provider === value)

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value : '')

/**
 * Starts Google or GitHub OAuth (§2.4, ADR-0003): the PKCE code verifier goes into a cookie and
 * the browser to the provider; `/auth/callback` finishes the sign-in and returns to `next`.
 */
export async function signInWithProvider(formData: FormData): Promise<never> {
  publicRoute()
  const provider = formData.get('provider')
  const next = safeNextPath(text(formData.get('next')))
  if (!isProvider(provider)) redirect(signInErrorPath(next))

  const callback = new URL('/auth/callback', serverEnv().siteUrl)
  if (next) callback.searchParams.set('next', next)
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString() },
  })
  if (error || !data.url) redirect(signInErrorPath(next))
  redirect(data.url)
}

export type TestLoginState = { error: string | null }

/**
 * E-mail/password sign-in for synthetic users, local and CI only (§2.3). The form is not the only
 * lock: this refuses unless `AUTH_TEST_LOGIN=true`, which `lib/env.ts` rejects in production, and
 * the hosted projects have the e-mail provider disabled.
 */
export async function signInWithTestLogin(
  _previous: TestLoginState,
  formData: FormData,
): Promise<TestLoginState> {
  publicRoute()
  if (!serverEnv().authTestLogin) return { error: vi.auth.testLoginDisabled }

  const email = text(formData.get('email')).trim()
  const password = text(formData.get('password'))
  if (email === '' || password === '') return { error: vi.auth.wrongCredentials }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return {
      error:
        error?.code === 'invalid_credentials' ? vi.auth.wrongCredentials : vi.auth.signInFailed,
    }
  }
  redirect(await completeSignIn(supabase, data.user, text(formData.get('next'))))
}

/** Ends the session and returns to sign-in. */
export async function signOut(): Promise<never> {
  await requireUser()
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
