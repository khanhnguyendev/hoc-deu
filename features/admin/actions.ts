'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, type AccountStatus, type Role } from '@/lib/auth/dal'
import { newBotToken } from '@/lib/bot/token'
import { getCatalog } from '@/lib/content/catalog'
import { PUBLISH_TARGET_PATTERN, targetStatus } from '@/lib/content/publish-targets'
import { vi } from '@/lib/i18n/vi'
import { checkLimit } from '@/lib/rate-limit'
import type { Database } from '@/lib/supabase/database.types'
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

function failure(
  error: { message: string },
  errors: ReadonlyMap<string, string> = ERRORS,
): AdminActionResult {
  const message = errors.get(error.message) ?? vi.admin.errors.failed
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
  const admin = await requireAdmin()
  const limit = await checkLimit('adminAction', admin.id)
  if (!limit.ok) return { ok: false, message: vi.rateLimit.tooMany }
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
  const admin = await requireAdmin()
  const limit = await checkLimit('adminAction', admin.id)
  if (!limit.ok) return { ok: false, message: vi.rateLimit.tooMany }
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

// ---------------------------------------------------------------------------------------------
// /admin/bot and the AI flag (task 6.3; §2.4, §6.2, §6.3, ADR-0026). Each: requireAdmin, then the
// admin-action rate limit, then the input; the RPCs run with the admin's own session.
// ---------------------------------------------------------------------------------------------

/**
 * One field per form (§2.4): a switch or the per-run cap (1–100). No `limits`: no UI sets them, and
 * the hard maxima are enforced at read time (`effectiveLimits`, decision 33).
 */
const botSettingsInput = z
  .strictObject({
    enabled: z.boolean().optional(),
    dryRun: z.boolean().optional(),
    contentProposals: z.boolean().optional(),
    perRunUserCap: z.number().int().min(1).max(100).optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined))

export type BotSettingsInput = z.input<typeof botSettingsInput>

const BOT_ERRORS: ReadonlyMap<string, string> = new Map([
  ['forbidden', vi.errors.notAllowed],
  ['invalid_settings', vi.adminBot.errors.invalid],
])

type UpdateBotSettingsArgs = Database['public']['Functions']['admin_update_bot_settings']['Args']

/**
 * Saves one `/admin/bot` control (§6.2): null leaves every other column as it is
 * (`admin_update_bot_settings`, 6.2b). No event: `updated_at` / `updated_by` on the row say who
 * changed it (decision 31).
 */
export async function updateBotSettings(input: BotSettingsInput): Promise<AdminActionResult> {
  const admin = await requireAdmin()
  const limit = await checkLimit('adminAction', admin.id)
  if (!limit.ok) return { ok: false, message: vi.rateLimit.tooMany }
  const parsed = botSettingsInput.safeParse(input)
  if (!parsed.success) return { ok: false, message: vi.adminBot.errors.invalid }

  const { enabled, dryRun, contentProposals, perRunUserCap } = parsed.data
  // The generated types mark every argument as required; SQL reads null as "unchanged".
  const args = {
    p_enabled: enabled ?? null,
    p_dry_run: dryRun ?? null,
    p_content_proposals: contentProposals ?? null,
    p_per_run_user_cap: perRunUserCap ?? null,
    p_limits: null,
  } as unknown as UpdateBotSettingsArgs
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_update_bot_settings', args)
  if (error) {
    return { ok: false, message: BOT_ERRORS.get(error.message) ?? vi.adminBot.errors.failed }
  }
  revalidatePath('/admin/bot')
  return { ok: true, message: vi.adminBot.results.saved }
}

/**
 * "Tạo token mới" (§6.3, ADR-0026): a fresh 32-byte token; only its SHA-256 goes to
 * `admin_rotate_bot_token`, which keeps the old hash valid for 24 hours and writes
 * `admin.bot_token_rotated`. The token is returned once, to the page that asked, and is never
 * logged or stored.
 */
export async function rotateBotToken(): Promise<
  { ok: true; token: string; message: string } | { ok: false; message: string }
> {
  const admin = await requireAdmin()
  const limit = await checkLimit('adminAction', admin.id)
  if (!limit.ok) return { ok: false, message: vi.rateLimit.tooMany }

  const { token, hash } = newBotToken()
  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_rotate_bot_token', { p_token_hash: hash })
  if (error) {
    return {
      ok: false,
      message:
        error.message === 'forbidden' ? vi.errors.notAllowed : vi.adminBot.errors.rotateFailed,
    }
  }
  revalidatePath('/admin/bot')
  return { ok: true, token, message: vi.adminBot.results.rotated }
}

const aiFlagInput = z.object({ userId: z.uuid(), on: z.boolean() })

const AI_FLAG_ERRORS: ReadonlyMap<string, string> = new Map([
  ...ERRORS,
  ['no_change', vi.adminBot.aiFlag.changed],
])

/**
 * The AI flag (§2.4 `/admin/users`, decision 34): active accounts only, the admin's own included
 * (the owner is the first AI learner). `admin_set_ai_flag` also turns notes sharing off with the
 * flag and suspends / resumes the overrides, and writes `admin.ai_flag_changed`. The list
 * re-renders — also after a stale failure, so it shows the account's current state.
 */
export async function setAiFlag(userId: string, on: boolean): Promise<AdminActionResult> {
  const admin = await requireAdmin()
  const limit = await checkLimit('adminAction', admin.id)
  if (!limit.ok) return { ok: false, message: vi.rateLimit.tooMany }
  const input = aiFlagInput.safeParse({ userId, on })
  if (!input.success) return { ok: false, message: vi.admin.errors.invalid }

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_set_ai_flag', {
    p_user_id: input.data.userId,
    p_on: input.data.on,
  })
  if (error) return failure(error, AI_FLAG_ERRORS)

  revalidatePath('/admin/users')
  return {
    ok: true,
    message: input.data.on ? vi.adminBot.results.aiOn : vi.adminBot.results.aiOff,
  }
}

// ---------------------------------------------------------------------------------------------
// Publish requests (task 6.7a; §2.4 /admin/content, §6.6, ADR-0024; Part B-M6 decision 20). Each:
// requireAdmin, then the admin-action rate limit, then the input; the RPCs run with the admin's own
// session. The app holds no GitHub write token: a request waits for the next publish run.
// ---------------------------------------------------------------------------------------------

const publishCopy = vi.publish

/**
 * "Xuất bản" (§6.6): a pending `content_publish_requests` row for a **draft** item or draft note
 * (`<itemId>#note`) of the deployed catalog — anything else is refused before the RPC.
 * `admin_request_publish` returns the pending request that already exists for the target, so a
 * second click is harmless. The admin ticked the publish checklist in the dialog first.
 */
export async function requestPublish(target: string): Promise<AdminActionResult> {
  const admin = await requireAdmin()
  const limit = await checkLimit('adminAction', admin.id)
  if (!limit.ok) return { ok: false, message: vi.rateLimit.tooMany }
  if (
    typeof target !== 'string' ||
    !PUBLISH_TARGET_PATTERN.test(target) ||
    targetStatus(getCatalog(), target) !== 'draft'
  ) {
    return { ok: false, message: publishCopy.errors.notDraft }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_request_publish', { p_target: target })
  if (error) {
    return {
      ok: false,
      message: error.message === 'forbidden' ? vi.errors.notAllowed : publishCopy.errors.failed,
    }
  }
  revalidatePath('/admin/content')
  return { ok: true, message: publishCopy.results.requested }
}

const requestId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)

/**
 * "Huỷ" (§6.6): a pending request → cancelled. When it is no longer pending (merged, or cancelled
 * by another admin) the answer is stale and `/admin/content` re-renders with its current state.
 */
export async function cancelPublish(id: number): Promise<AdminActionResult> {
  const admin = await requireAdmin()
  const limit = await checkLimit('adminAction', admin.id)
  if (!limit.ok) return { ok: false, message: vi.rateLimit.tooMany }
  const input = requestId.safeParse(id)
  if (!input.success) return { ok: false, message: vi.admin.errors.invalid }

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_cancel_publish', { p_id: input.data })
  if (error) {
    if (error.message === 'not_found' || error.message === 'invalid_transition') {
      revalidatePath('/admin/content')
      return { ok: false, message: publishCopy.errors.changed, stale: true }
    }
    return {
      ok: false,
      message: error.message === 'forbidden' ? vi.errors.notAllowed : publishCopy.errors.failed,
    }
  }
  revalidatePath('/admin/content')
  return { ok: true, message: publishCopy.results.cancelled }
}
