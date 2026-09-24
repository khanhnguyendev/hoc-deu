/**
 * Synthetic users for end-to-end tests (decision 14): every test creates its own users through the
 * local stack's admin API, so the parallel desktop and mobile projects never race. The secret key
 * is the local stack's, read from `process.env` (playwright.config.ts sets it from `supabase
 * status`, decision 15). Only types are imported from `lib/`.
 */
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type * as Supabase from '@supabase/supabase-js'
import type { AccountStatus, Role } from '@/lib/auth/dal'
import type { Database } from '@/lib/supabase/database.types'

// Playwright loads specs through Node's ESM loader hooks, and Node 22 then fails on the circular
// CommonJS requires inside @supabase/auth-js ("Unexpected module status 3"). The CommonJS loader
// handles the cycle, so the client is required rather than imported.
const { createClient } = createRequire(import.meta.url)('@supabase/supabase-js') as typeof Supabase

export const TEST_PASSWORD = 'test-password-123'

export type TestUser = { id: string; email: string; password: string; name: string }

type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type TestProfile = Pick<
  ProfileRow,
  'role' | 'status' | 'approved_at' | 'onboarded_at' | 'display_name' | 'code_language'
>
type UserTrackRow = Database['public']['Tables']['user_tracks']['Row']
export type TestUserTrack = Pick<
  UserTrackRow,
  'track_id' | 'roadmap_variant' | 'budget_minutes' | 'start_date' | 'status'
>
type ScheduleVersionRow = Database['public']['Tables']['schedule_versions']['Row']
export type TestScheduleVersion = Pick<
  ScheduleVersionRow,
  'timezone' | 'day_starts_at' | 'effective_at'
>

let client: Supabase.SupabaseClient<Database> | undefined

/** The secret-key client for the local stack (bypasses RLS). */
function admin(): Supabase.SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!url || !secretKey) {
      throw new Error('The local Supabase env is missing — run e2e through playwright.config.ts.')
    }
    client = createClient<Database>(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

/**
 * Creates a confirmed e-mail/password user (the test login) and sets their profile. Defaults: an
 * **active learner who has not onboarded**, e-mail `e2e-<uuid>@example.test`, name
 * "Học viên <4 chars>". An active or suspended user gets `approved_at` (they were approved once);
 * a pending or rejected one does not — a pending user is never-processed (decision 23).
 */
export async function createTestUser(
  options: {
    status?: AccountStatus
    role?: Role
    onboarded?: boolean
    email?: string
    name?: string
  } = {},
): Promise<TestUser> {
  const email = options.email ?? `e2e-${randomUUID()}@example.test`
  const name = options.name ?? `Học viên ${randomUUID().slice(0, 4)}`
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  if (error || !data.user) throw new Error(`createUser(${email}) failed: ${error?.message}`)

  const status = options.status ?? 'active'
  const now = new Date().toISOString()
  const { error: updateError } = await admin()
    .from('profiles')
    .update({
      role: options.role ?? 'learner',
      status,
      approved_at: status === 'active' || status === 'suspended' ? now : null,
      onboarded_at: options.onboarded ? now : null,
    })
    .eq('id', data.user.id)
  if (updateError) throw new Error(`profile update for ${email} failed: ${updateError.message}`)

  return { id: data.user.id, email, password: TEST_PASSWORD, name }
}

export async function getProfile(id: string): Promise<TestProfile> {
  const { data, error } = await admin()
    .from('profiles')
    .select('role, status, approved_at, onboarded_at, display_name, code_language')
    .eq('id', id)
    .single()
  if (error) throw new Error(`getProfile(${id}) failed: ${error.message}`)
  return data
}

/** The user's enrolled tracks, by track id. */
export async function getUserTracks(userId: string): Promise<TestUserTrack[]> {
  const { data, error } = await admin()
    .from('user_tracks')
    .select('track_id, roadmap_variant, budget_minutes, start_date, status')
    .eq('user_id', userId)
    .order('track_id')
  if (error) throw new Error(`getUserTracks(${userId}) failed: ${error.message}`)
  return data
}

/** The user's schedule versions, oldest first (`day_starts_at` reads as `HH:MM:SS`). */
export async function getScheduleVersions(userId: string): Promise<TestScheduleVersion[]> {
  const { data, error } = await admin()
    .from('schedule_versions')
    .select('timezone, day_starts_at, effective_at')
    .eq('user_id', userId)
    .order('effective_at')
  if (error) throw new Error(`getScheduleVersions(${userId}) failed: ${error.message}`)
  return data
}

/**
 * Gives an onboarded test user a schedule and tracks directly (secret key), as onboarding would
 * have: one `schedule_versions` row (the first version may lie in the past) and one `user_tracks`
 * row per track, all `active`. No events are written.
 */
export async function seedLearnerSetup(
  userId: string,
  setup: {
    schedule?: { timezone: string; dayStartsAt: string; effectiveAt: string }
    tracks?: { trackId: string; roadmapVariant: string; budgetMinutes: number; startDate: string }[]
  },
): Promise<void> {
  if (setup.schedule) {
    const { timezone, dayStartsAt, effectiveAt } = setup.schedule
    const { error } = await admin().from('schedule_versions').insert({
      user_id: userId,
      timezone,
      day_starts_at: dayStartsAt,
      effective_at: effectiveAt,
    })
    if (error) throw new Error(`seed schedule for ${userId} failed: ${error.message}`)
  }
  if (setup.tracks && setup.tracks.length > 0) {
    const { error } = await admin()
      .from('user_tracks')
      .insert(
        setup.tracks.map((track) => ({
          user_id: userId,
          track_id: track.trackId,
          roadmap_variant: track.roadmapVariant,
          budget_minutes: track.budgetMinutes,
          start_date: track.startDate,
        })),
      )
    if (error) throw new Error(`seed tracks for ${userId} failed: ${error.message}`)
  }
}

/** How many events the user's log holds — of one type (and track) when given. */
export async function countEvents(
  userId: string,
  filter: { type?: string; trackId?: string } = {},
): Promise<number> {
  let query = admin()
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (filter.type !== undefined) query = query.eq('type', filter.type)
  if (filter.trackId !== undefined) query = query.eq('track_id', filter.trackId)
  const { count, error } = await query
  if (error || count === null) {
    throw new Error(`countEvents(${userId}) failed: ${error?.message ?? 'no count'}`)
  }
  return count
}

/** Sets the status directly, as the approval queue would (an active user gets `approved_at`). */
export async function setStatus(id: string, status: AccountStatus): Promise<void> {
  const { error } = await admin()
    .from('profiles')
    .update(status === 'active' ? { status, approved_at: new Date().toISOString() } : { status })
    .eq('id', id)
  if (error) throw new Error(`setStatus(${id}) failed: ${error.message}`)
}

/** Deletes the user and, by cascade, their profile and data. A missing user is not an error. */
export async function deleteTestUser(id: string): Promise<void> {
  const { error } = await admin().auth.admin.deleteUser(id)
  if (error && error.status !== 404) throw new Error(`deleteUser(${id}) failed: ${error.message}`)
}

/** Deletes the user with this e-mail if one exists (a fixed address left by an earlier run). */
export async function deleteUserByEmail(email: string): Promise<void> {
  const wanted = email.toLowerCase()
  for (let page = 1; ; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const user = data.users.find((u) => u.email?.toLowerCase() === wanted)
    if (user) return deleteTestUser(user.id)
    if (data.users.length < 1000) return
  }
}
