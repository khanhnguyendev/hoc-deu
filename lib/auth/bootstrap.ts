import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'

const normalizeEmail = (email: string) => email.trim().toLowerCase()

/**
 * §2.5: a provider-verified e-mail in ADMIN_EMAILS becomes an active admin (decision 23).
 *
 * Runs on every sign-in (OAuth callback, test login). Only a **confirmed** e-mail counts — an
 * unverified address proves nothing about who owns it. The match is exact after trimming and
 * lower-casing. `admin_bootstrap` (secret key) then promotes only a never-processed profile
 * (learner, pending, `approved_at` null), and only while no active admin exists (ruling R13); for
 * anything else it is a no-op. So a rejection, suspension or demotion by an admin is never
 * overridden by the env list — not even when the listed account deletes itself and signs up again
 * — and removing an address demotes no one. With no active admin left, a listed e-mail is the
 * automatic break-glass (ADR-0004). Returns whether the profile was promoted; throws when the call
 * fails.
 */
export async function bootstrapAdminIfListed(
  user: {
    id: string
    email: string | null | undefined
    emailConfirmedAt: string | null | undefined
  },
  deps: { adminEmails?: readonly string[]; admin?: SupabaseClient<Database> } = {},
): Promise<boolean> {
  const email = normalizeEmail(user.email ?? '')
  if (email === '' || !user.emailConfirmedAt) return false

  const adminEmails = deps.adminEmails ?? serverEnv().adminEmails
  if (!adminEmails.some((listed) => normalizeEmail(listed) === email)) return false

  const admin = deps.admin ?? createAdminClient()
  const { data, error } = await admin.rpc('admin_bootstrap', { p_user_id: user.id })
  if (error) throw new Error('admin_bootstrap failed', { cause: error })
  return data === true
}
