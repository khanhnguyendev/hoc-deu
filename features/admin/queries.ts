import 'server-only'
import { z } from 'zod'
import { requireAdmin, type AccountStatus, type Role } from '@/lib/auth/dal'
import { getCatalog } from '@/lib/content/catalog'
import { createClient } from '@/lib/supabase/server'
import { buildContentPage, coverageWarnings, type ContentPage, type TrackPosition } from './content'
import {
  buildAdminOverview,
  OPS_METRIC_KEYS,
  type AdminOverviewPage,
  type MetricReading,
  type OpsMetricKey,
  type OpsMetrics,
} from './overview'

type Client = Awaited<ReturnType<typeof createClient>>

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

const count = z.number().int().min(0)
/** `admin_overview()` (20260927000300_admin_overview.sql). */
const overviewSchema = z.object({
  users: z.object({ pending: count, active: count, suspended: count, rejected: count }),
  learners_completed_7d: count,
  plans_created_7d: count,
})

/** `admin_track_positions()`: active learners per track, variant and roadmap week (decision 25). */
async function readTrackPositions(supabase: Client): Promise<TrackPosition[]> {
  const { data, error } = await supabase.rpc('admin_track_positions')
  if (error) throw new Error('Could not read the track positions', { cause: error })
  return data.map((row) => ({
    trackId: row.track_id,
    variant: row.variant,
    week: row.week,
    learners: row.learners,
  }))
}

/**
 * The latest `ops_metrics` row of `key` (admins read the table under RLS; the
 * `(key, recorded_at desc)` index serves it), or null before the first one. An error throws: a
 * failed read must never show as "chưa có dữ liệu".
 */
async function readMetric(supabase: Client, key: OpsMetricKey): Promise<MetricReading | null> {
  const { data, error } = await supabase
    .from('ops_metrics')
    .select('value, recorded_at')
    .eq('key', key)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`Could not read the metric ${key}`, { cause: error })
  return data === null ? null : { value: Number(data.value), recordedAt: data.recorded_at }
}

async function readMetrics(supabase: Client): Promise<OpsMetrics> {
  const readings = await Promise.all(OPS_METRIC_KEYS.map((key) => readMetric(supabase, key)))
  return Object.fromEntries(
    OPS_METRIC_KEYS.map((key, index) => [key, readings[index] ?? null]),
  ) as Record<OpsMetricKey, MetricReading | null>
}

/**
 * `/admin` (§2.4, §8.4 item 5): the aggregate readers (`admin_overview()`,
 * `admin_track_positions()` — counts only, §4.5), the latest ops metrics and the content catalog's
 * coverage, as the admin's own session. Any failed read throws, so the route's error boundary
 * shows "Thử lại".
 */
export async function getAdminOverview(): Promise<AdminOverviewPage> {
  await requireAdmin()
  const supabase = await createClient()
  const [overview, positions, metrics] = await Promise.all([
    supabase.rpc('admin_overview'),
    readTrackPositions(supabase),
    readMetrics(supabase),
  ])
  if (overview.error)
    throw new Error('Could not read the admin overview', { cause: overview.error })
  const counts = overviewSchema.parse(overview.data)
  return buildAdminOverview({
    counts: {
      users: counts.users,
      learnersCompleted7d: counts.learners_completed_7d,
      plansCreated7d: counts.plans_created_7d,
    },
    metrics,
    coverage: coverageWarnings(getCatalog(), positions),
    now: new Date(),
  })
}

/**
 * `/admin/content` (§2.4): the catalog's stats, verification, coverage and drafts, with the
 * learners' roadmap weeks from `admin_track_positions()` for the red rows (decision 25).
 */
export async function getAdminContent(): Promise<ContentPage> {
  await requireAdmin()
  const supabase = await createClient()
  return buildContentPage(getCatalog(), await readTrackPositions(supabase))
}
