import 'server-only'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { bootstrapAdminIfListed } from './bootstrap'
import { homePathFor, safeNextPath } from './paths'

/**
 * The last step of every sign-in — the OAuth callback and the test login (§2.2, §2.5): bootstrap
 * a listed admin, then return where the user goes next — the safe `next` path, else their home
 * path. `supabase` is the session client that has just signed the user in; the profile is read
 * fresh through it (RLS: own row), never through the cached DAL, which may have read it before
 * the bootstrap changed it.
 */
export async function completeSignIn(
  supabase: SupabaseClient<Database>,
  user: Pick<User, 'id' | 'email' | 'email_confirmed_at'>,
  next: string | null | undefined,
): Promise<string> {
  await bootstrapAdminIfListed({
    id: user.id,
    email: user.email,
    emailConfirmedAt: user.email_confirmed_at,
  })

  const safeNext = safeNextPath(next)
  if (safeNext) return safeNext

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('status, onboarded_at')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw new Error('Could not read the profile after sign-in', { cause: error })
  // As in the DAL, a missing row or an unknown status reads as pending, never as a grant.
  return homePathFor({
    status: profile?.status === 'active' ? 'active' : 'pending',
    onboardedAt: profile?.onboarded_at ?? null,
  })
}
