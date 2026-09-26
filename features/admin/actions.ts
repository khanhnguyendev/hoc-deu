'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, type AccountStatus, type Role } from '@/lib/auth/dal'
import { vi } from '@/lib/i18n/vi'
import { createClient } from '@/lib/supabase/server'

/**
 * What an admin action tells the queue: a Vietnamese message for the toast (and the row). `stale`
 * marks a failure because the list was out of date: the queue re-renders with the account's
 * current state, and keyboard focus follows the row there (UserRowActions).
 */
export type AdminActionResult =
  { ok: true; message: string } | { ok: false; message: string; stale?: true }

const statusInput = z.object({
  userId: z.uuid(),
  status: z.enum(['active', 'rejected', 'suspended']),
  expectedFrom: z.enum(['pending', 'active', 'rejected', 'suspended']),
})
const roleInput = z.object({ userId: z.uuid(), role: z.enum(['learner', 'admin']) })
/** `admin_set_status` / `admin_set_role` return `{ from, to }`. */
const change = z.object({ from: z.string(), to: z.string() })

/**
 * The codes the admin functions raise as the error message (20260925000300_rpc.sql;
 * `status_changed` from 20260927000300_admin_overview.sql).
 */
const ERRORS: ReadonlyMap<string, string> = new Map([
  ['forbidden', vi.errors.notAllowed],
  ['cannot_change_self', vi.admin.errors.self],
  ['not_found', vi.admin.errors.notFound],
  ['invalid_transition', vi.admin.errors.changed],
  ['status_changed', vi.admin.errors.changed],
  ['no_change', vi.admin.errors.noChange],
])

/** The account changed since the list was rendered: re-render it, so it shows the current state. */
const STALE: ReadonlySet<string> = new Set([
  'not_found',
  'invalid_transition',
  'status_changed',
  'no_change',
])

function failure(error: { message: string }): AdminActionResult {
  const message = ERRORS.get(error.message) ?? vi.admin.errors.failed
  if (!STALE.has(error.message)) return { ok: false, message }
  revalidatePath('/admin/users')
  return { ok: false, message, stale: true }
}

function statusMessage(data: unknown, status: 'active' | 'rejected' | 'suspended'): string {
  if (status === 'rejected') return vi.admin.results.rejected
  if (status === 'suspended') return vi.admin.results.suspended
  const from = change.safeParse(data).data?.from
  return from === 'pending' ? vi.admin.results.approved : vi.admin.results.reactivated
}

/**
 * Approves, rejects, suspends or reactivates an account (§2.4, decision 17): pending → active |
 * rejected, active → suspended, suspended | rejected → active. The RPC runs with the admin's own
 * session and checks `is_admin()`, the transition and "never yourself" again; each change writes
 * one audit event. `expectedFrom` is the status the row was rendered with: when another admin has
 * decided since, the RPC raises `status_changed` instead of overriding that decision (task 5.6,
 * the M2 2.8 minor). On success — and when the list was stale — the queue re-renders.
 */
export async function setUserStatus(
  userId: string,
  status: 'active' | 'rejected' | 'suspended',
  expectedFrom: AccountStatus,
): Promise<AdminActionResult> {
  await requireAdmin()
  const input = statusInput.safeParse({ userId, status, expectedFrom })
  if (!input.success) return { ok: false, message: vi.admin.errors.invalid }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_set_status', {
    p_user_id: input.data.userId,
    p_status: input.data.status,
    p_expected_from: input.data.expectedFrom,
  })
  if (error) return failure(error)

  revalidatePath('/admin/users')
  return { ok: true, message: statusMessage(data, input.data.status) }
}

/** Makes an account an admin or a learner again (§2.4); never the acting admin (decision 17). */
export async function setUserRole(userId: string, role: Role): Promise<AdminActionResult> {
  await requireAdmin()
  const input = roleInput.safeParse({ userId, role })
  if (!input.success) return { ok: false, message: vi.admin.errors.invalid }

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_set_role', {
    p_user_id: input.data.userId,
    p_role: input.data.role,
  })
  if (error) return failure(error)

  revalidatePath('/admin/users')
  return {
    ok: true,
    message: input.data.role === 'admin' ? vi.admin.results.promoted : vi.admin.results.demoted,
  }
}
