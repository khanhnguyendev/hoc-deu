import 'server-only'
import { z } from 'zod'
import { requireAdmin, type AccountStatus, type Role } from '@/lib/auth/dal'
import { getCatalog } from '@/lib/content/catalog'
import { serverEnv } from '@/lib/env'
import { rateLimitMode } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import {
  adminBotRunsSchema,
  adminBotSettingsSchema,
  buildAdminBotPage,
  type AdminBotPage,
  type AdminBotRun,
} from './bot'
import {
  buildContentPage,
  coverageWarnings,
  type ContentPage,
  type PublishRequestRow,
  type TrackPosition,
} from './content'
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
  /** `profiles.ai_personalization` — the AI flag toggle's state (task 6.3, decision 34). */
  aiPersonalization: boolean
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
    aiPersonalization: row.ai_personalization === true,
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
 * The sum of `ratelimit.fail_open` rows over the last 7 days (§8.4 item 5, decision 22): each row
 * is one UTC day's count (`ops_bump_metric`), so this reads every row recorded since, not just the
 * latest.
 */
async function readFailOpen7d(supabase: Client, now: Date): Promise<number> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('ops_metrics')
    .select('value')
    .eq('key', 'ratelimit.fail_open')
    .gte('recorded_at', since)
  if (error) throw new Error('Could not read the fail-open count', { cause: error })
  return data.reduce((sum, row) => sum + Number(row.value), 0)
}

/** The run log's length (§6.2): `/admin/bot` lists these; `/admin` reads today's run in them. */
export const BOT_RUN_LOG_LIMIT = 20

/**
 * `admin_bot_runs(20)`: the latest runs, newest first, with their user counts per outcome —
 * counts only, no user id or ref (it checks `is_admin()` itself, and times out stale runs first:
 * the lazy timeout on read, §6.2). An error or a malformed answer throws.
 */
async function readBotRuns(supabase: Client): Promise<AdminBotRun[]> {
  const { data, error } = await supabase.rpc('admin_bot_runs', { p_limit: BOT_RUN_LOG_LIMIT })
  if (error) throw new Error('Could not read the bot runs', { cause: error })
  return adminBotRunsSchema.parse(data)
}

/** `readBotRuns`, or null when it fails (logged by name only): the pages degrade, not break. */
function readBotRunsOrNull(supabase: Client): Promise<AdminBotRun[] | null> {
  return readBotRuns(supabase).catch(() => {
    console.error('[admin] the bot run log could not be read')
    return null
  })
}

/**
 * `/admin` (§2.4, §8.4 item 5): the aggregate readers (`admin_overview()`,
 * `admin_track_positions()` — counts only, §4.5), the latest ops metrics and the content catalog's
 * coverage, as the admin's own session. Any failed read throws, so the route's error boundary
 * shows "Thử lại" — except the bot's run log (`admin_bot_runs`, task 6.4a), whose failure only
 * makes the Bot card say it could not be read.
 */
export async function getAdminOverview(): Promise<AdminOverviewPage> {
  await requireAdmin()
  const supabase = await createClient()
  const now = new Date()
  const [overview, positions, metrics, failOpen7d, botRuns] = await Promise.all([
    supabase.rpc('admin_overview'),
    readTrackPositions(supabase),
    readMetrics(supabase),
    readFailOpen7d(supabase, now),
    // The bot is v1.1 and optional: a failed read degrades the Bot card, never the page.
    readBotRunsOrNull(supabase),
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
    rateLimit: { mode: rateLimitMode(), failOpen7d },
    vercelEnv: serverEnv().vercelEnv,
    botRuns,
    now,
  })
}

/** The recent (merged or cancelled) publish requests `/admin/content` lists. */
export const RECENT_PUBLISH_REQUESTS = 20

const REQUEST_COLUMNS = 'id, target, status, pr_url, requested_at'
const REQUEST_STATUSES: readonly PublishRequestRow['status'][] = ['pending', 'merged', 'cancelled']

/**
 * Every pending `content_publish_requests` row and the 20 latest others (§6.6; task 6.7a) — admins
 * read the table under RLS (6.2a), with their own session. Null when a read fails (logged by name
 * only): the section says so, the drafts and coverage still render.
 */
async function readPublishRequests(supabase: Client): Promise<PublishRequestRow[] | null> {
  const table = () => supabase.from('content_publish_requests').select(REQUEST_COLUMNS)
  const [pending, recent] = await Promise.all([
    table().eq('status', 'pending').order('requested_at', { ascending: false }),
    table()
      .neq('status', 'pending')
      .order('updated_at', { ascending: false })
      .limit(RECENT_PUBLISH_REQUESTS),
  ])
  if (pending.error || recent.error) {
    console.error('[admin] the publish requests could not be read')
    return null
  }
  return [...pending.data, ...recent.data].map((row) => ({
    id: row.id,
    target: row.target,
    // The check constraint allows only these values; anything else reads as history.
    status: REQUEST_STATUSES.find((status) => status === row.status) ?? 'cancelled',
    prUrl: row.pr_url,
    requestedAt: row.requested_at,
  }))
}

/**
 * `/admin/content` (§2.4): the catalog's stats, verification, coverage and drafts, with the
 * learners' roadmap weeks from `admin_track_positions()` for the red rows (decision 25), and the
 * publish requests (task 6.7a: a draft's pending request, the "Yêu cầu xuất bản" section).
 */
export async function getAdminContent(): Promise<ContentPage> {
  await requireAdmin()
  const supabase = await createClient()
  const positions = await readTrackPositions(supabase)
  const requests = await readPublishRequests(supabase)
  return buildContentPage(getCatalog(), positions, requests)
}

/**
 * `/admin/bot` (§2.4, §6.2, §6.3): `admin_bot_settings()` as the admin's own session (it checks
 * `is_admin()` itself and never returns a hash) and `BOT_API_ENABLED`, read on the server — the
 * page can say the env lock is off, the switch itself is env-only — and the run log
 * (`admin_bot_runs(20)`, task 6.4a). A failed settings read throws, so the route's error boundary
 * shows "Thử lại"; a failed run-log read shows the log's own error state and keeps the controls
 * (the kill switch must stay reachable).
 */
export async function getAdminBot(): Promise<AdminBotPage> {
  await requireAdmin()
  const supabase = await createClient()
  const [settings, runs] = await Promise.all([
    supabase.rpc('admin_bot_settings'),
    readBotRunsOrNull(supabase),
  ])
  if (settings.error) throw new Error('Could not read the bot settings', { cause: settings.error })
  return buildAdminBotPage({
    settings: adminBotSettingsSchema.parse(settings.data),
    apiEnabled: serverEnv().botApiEnabled,
    runs,
    now: new Date(),
  })
}
