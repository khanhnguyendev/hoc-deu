/**
 * Data access layer for the session (platform design §2.1, §2.2). Layouts, server actions, route
 * handlers and feature loaders call these guards; `proxy.ts` only refreshes the session.
 * `redirect()` and `notFound()` throw, so callers never wrap a guard in `try`/`catch`.
 */
import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { CODE_LANGUAGES, type CodeLanguage } from '@/lib/content/schemas/common'
import { createClient } from '@/lib/supabase/server'

export type Role = 'learner' | 'admin'
export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended'

export type SessionUser = {
  id: string
  email: string | null
  role: Role
  status: AccountStatus
  displayName: string | null
  avatarUrl: string | null
  codeLanguage: CodeLanguage | null
  onboardedAt: string | null
  aiPersonalization: boolean
  /** `role === 'admin' && status === 'active'`. */
  isAdmin: boolean
}

const STATUSES: readonly AccountStatus[] = ['pending', 'active', 'rejected', 'suspended']

// The database's check constraints allow exactly these values; anything else reads as the least
// privileged value, never as a grant.
const asRole = (value: string): Role => (value === 'admin' ? 'admin' : 'learner')
const asStatus = (value: string): AccountStatus =>
  STATUSES.find((status) => status === value) ?? 'pending'
const asCodeLanguage = (value: string | null): CodeLanguage | null =>
  CODE_LANGUAGES.find((language) => language === value) ?? null

/**
 * The signed-in user with their own profile, or `null` when signed out. Verifies the JWT with
 * `getClaims()` (never `getSession()`, §2.1) and reads the caller's `profiles` row through RLS. A
 * missing row reads as a pending learner. Wrapped in React `cache()`: one profile read per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'role, status, display_name, avatar_url, code_language, onboarded_at, ai_personalization',
    )
    .eq('id', claims.sub)
    .maybeSingle()
  if (error) throw new Error('Could not read the signed-in user’s profile', { cause: error })

  const role = asRole(profile?.role ?? 'learner')
  const status = asStatus(profile?.status ?? 'pending')
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' && claims.email !== '' ? claims.email : null,
    role,
    status,
    displayName: profile?.display_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    codeLanguage: asCodeLanguage(profile?.code_language ?? null),
    onboardedAt: profile?.onboarded_at ?? null,
    aiPersonalization: profile?.ai_personalization ?? false,
    isAdmin: role === 'admin' && status === 'active',
  }
})

/** Any signed-in user, whatever their status; signed out → `/sign-in`. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/sign-in')
  return user
}

/** An approved (`active`) user; pending, rejected or suspended → `/pending`. */
export async function requireActive(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.status !== 'active') redirect('/pending')
  return user
}

/** An active user who finished onboarding (the `(app)` group); otherwise → `/onboarding`. */
export async function requireOnboarded(): Promise<SessionUser> {
  const user = await requireActive()
  if (!user.onboardedAt) redirect('/onboarding')
  return user
}

/** An active admin; an active non-admin gets a 404, so admin routes are not advertised. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireActive()
  if (!user.isAdmin) notFound()
  return user
}

/**
 * The `/dev/*` catalog: open outside production (e2e, previews), admin-only in production.
 * Reads `process.env.VERCEL_ENV` directly — `/dev/*` is prerendered at build time, where no
 * runtime secrets exist, so `serverEnv()` must not run here (decision 10).
 */
export async function requireDevAccess(): Promise<void> {
  if (process.env.VERCEL_ENV === 'production') await requireAdmin()
}
