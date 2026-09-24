'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, type Role } from '@/lib/auth/dal'
import { vi } from '@/lib/i18n/vi'
import { createClient } from '@/lib/supabase/server'

/** What an admin action tells the queue: a Vietnamese message for the toast (and the row). */
export type AdminActionResult = { ok: true; message: string } | { ok: false; message: string }

const statusInput = z.object({
  userId: z.uuid(),
  status: z.enum(['active', 'rejected', 'suspended']),
})
const roleInput = z.object({ userId: z.uuid(), role: z.enum(['learner', 'admin']) })
/** `admin_set_status` / `admin_set_role` return `{ from, to }`. */
const change = z.object({ from: z.string(), to: z.string() })

/** The codes the admin functions raise as the error message (20260925000300_rpc.sql). */
const ERRORS: ReadonlyMap<string, string> = new Map([
  ['forbidden', vi.errors.notAllowed],
  ['cannot_change_self', vi.admin.errors.self],
  ['not_found', vi.admin.errors.notFound],
  ['invalid_transition', vi.admin.errors.changed],
  ['no_change', vi.admin.errors.noChange],
])

const failure = (error: { message: string }): AdminActionResult => ({
  ok: false,
  message: ERRORS.get(error.message) ?? vi.admin.errors.failed,
})

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
 * one audit event. On success the queue re-renders.
 */
export async function setUserStatus(
  userId: string,
  status: 'active' | 'rejected' | 'suspended',
): Promise<AdminActionResult> {
  await requireAdmin()
  const input = statusInput.safeParse({ userId, status })
  if (!input.success) return { ok: false, message: vi.admin.errors.invalid }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_set_status', {
    p_user_id: input.data.userId,
    p_status: input.data.status,
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
