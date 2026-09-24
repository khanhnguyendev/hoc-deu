import 'server-only'
import { requireAdmin, type AccountStatus, type Role } from '@/lib/auth/dal'
import { createClient } from '@/lib/supabase/server'

/** One account in the approval queue (`admin_list_users()`, §2.4 `/admin/users`). */
export type AdminUserRow = {
  id: string
  email: string | null
  displayName: string | null
  role: Role
  status: AccountStatus
  /** ISO-8601 instant of the sign-up. */
  createdAt: string
  approvedAt: string | null
  onboardedAt: string | null
  /** The acting admin's own row: no actions (decision 17). */
  isSelf: boolean
}

const STATUSES: readonly AccountStatus[] = ['pending', 'active', 'rejected', 'suspended']

/**
 * Every account for `/admin/users`, pending first (oldest first), then everyone else (newest
 * first) — the order `admin_list_users()` returns. The function checks `is_admin()` itself and
 * runs with the admin's own session, so it is never called with the secret key.
 */
export async function listUsers(): Promise<AdminUserRow[]> {
  const admin = await requireAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) throw new Error('Could not list the users', { cause: error })

  // The generated types mark every returned column as non-null; the nullable ones are not.
  return data.map((row) => ({
    id: row.id,
    email: row.email ?? null,
    displayName: row.display_name ?? null,
    // The check constraints allow only these values; anything else reads as the least privilege.
    role: row.role === 'admin' ? 'admin' : 'learner',
    status: STATUSES.find((status) => status === row.status) ?? 'pending',
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? null,
    onboardedAt: row.onboarded_at ?? null,
    isSelf: row.id === admin.id,
  }))
}
