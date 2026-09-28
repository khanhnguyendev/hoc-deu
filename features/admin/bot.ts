/**
 * `/admin/bot`'s view model (§2.4, §6.2, §6.3; task 6.3): pure — the loader (`queries.ts`) reads
 * `admin_bot_settings()` and `BOT_API_ENABLED`, and passes `now`. Times read in Asia/Ho_Chi_Minh,
 * like the rest of `/admin`. The run log (`admin_bot_runs(20)`: counts only) and the
 * deferred-users warning came with 6.4a (§2.4, §6.2).
 */
import { z } from 'zod'
import { OPS_TIMEZONE, opsDay } from '@/lib/bot/ops-day'
import { fill, formatDay, formatDayTimeIn, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

/** The per-run user cap's range (`bot_settings.per_run_user_cap` check: 1–100). */
export const CAP_MAX = 100

const ADMIN_TIME_ZONE = 'Asia/Ho_Chi_Minh'

/** `admin_bot_settings()` (20260928000200_bot_functions.sql `bot_settings_json`): never a hash. */
export const adminBotSettingsSchema = z.object({
  enabled: z.boolean(),
  dryRun: z.boolean(),
  contentProposals: z.boolean(),
  perRunUserCap: z.number().int(),
  limits: z.record(z.string(), z.unknown()),
  hasToken: z.boolean(),
  prevValidUntil: z.string().nullable(),
  rotatedAt: z.string().nullable(),
  updatedAt: z.string(),
})
export type AdminBotSettings = z.infer<typeof adminBotSettingsSchema>

export type BotControlsView = {
  enabled: boolean
  dryRun: boolean
  contentProposals: boolean
  perRunUserCap: number
  /** The hard maximum of the cap, shown beside the field. */
  capMax: number
}

/** Times are already formatted (`{time}, {day}`); a token itself is never part of a render. */
export type BotTokenView =
  { state: 'none' } | { state: 'set'; createdAt: string | null; previousValidUntil: string | null }

export type AdminBotPage = {
  /** `BOT_API_ENABLED` — env only; the page can say so, not change it. */
  apiEnabled: boolean
  controls: BotControlsView
  token: BotTokenView
  runLog: BotRunLogView
  /** Today's plan run left eligible users out (§6.2); null otherwise, or while unknown. */
  deferredWarning: string | null
}

const at = (instant: string) => fill(vi.adminBot.at, formatDayTimeIn(instant, ADMIN_TIME_ZONE))

function tokenView(settings: AdminBotSettings, now: Date): BotTokenView {
  if (!settings.hasToken) return { state: 'none' }
  const overlap =
    settings.prevValidUntil !== null && Date.parse(settings.prevValidUntil) > now.getTime()
  return {
    state: 'set',
    createdAt: settings.rotatedAt === null ? null : at(settings.rotatedAt),
    previousValidUntil: overlap && settings.prevValidUntil ? at(settings.prevValidUntil) : null,
  }
}

export function buildAdminBotPage(input: {
  settings: AdminBotSettings
  apiEnabled: boolean
  /** `admin_bot_runs(20)`, newest first; null when it could not be read. */
  runs: readonly AdminBotRun[] | null
  now: Date
}): AdminBotPage {
  const { settings } = input
  return {
    apiEnabled: input.apiEnabled,
    controls: {
      enabled: settings.enabled,
      dryRun: settings.dryRun,
      contentProposals: settings.contentProposals,
      perRunUserCap: settings.perRunUserCap,
      capMax: CAP_MAX,
    },
    token: tokenView(settings, input.now),
    runLog: botRunLog(input.runs),
    deferredWarning: deferredWarning(input.runs, input.now),
  }
}

// ---------------------------------------------------------------------------------------------
// The run log and the deferred-users warning (task 6.4a)
// ---------------------------------------------------------------------------------------------

const logCopy = vi.adminBot.runLog
const count = z.number().int().min(0)

/** One run of `admin_bot_runs()` (20260928000200_bot_functions.sql): counts only, no user. */
export const adminBotRunSchema = z.object({
  runKey: z.string(),
  kind: z.enum(['plan', 'publish']),
  mode: z.enum(['live', 'dry_run']),
  status: z.enum(['running', 'completed', 'failed']),
  failureReason: z.string().nullable(),
  usersEligible: count,
  usersDeferred: count,
  /** Users per outcome; `pending` for those without one yet. */
  outcomes: z.record(z.string(), count),
  contentPrUrl: z.string().nullable(),
  summary: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
})
export const adminBotRunsSchema = z.array(adminBotRunSchema)
export type AdminBotRun = z.infer<typeof adminBotRunSchema>

export type BotRunCounts = {
  eligible: number
  pending: number
  applied: number
  dryRun: number
  /** `skipped_plan_in_use` + `skipped_gate_closed` + `skipped_unseen`. */
  skipped: number
  invalid: number
  error: number
  deferred: number
}

export type BotRunRow = {
  key: string
  /** The run's date (its key's Asia/Ho_Chi_Minh date), formatted. */
  day: string
  /** When it started, `HH:MM` in Asia/Ho_Chi_Minh. */
  startedAt: string
  kind: string
  mode: 'live' | 'dry_run'
  modeLabel: string
  status: AdminBotRun['status']
  /** The status, and a failure's reason: `Thất bại (quá 2 giờ)`. */
  statusLabel: string
  counts: BotRunCounts
  pr: { href: string; label: string } | null
  summary: string | null
}

export type BotRunLogView =
  { state: 'ready'; rows: BotRunRow[] } | { state: 'empty' } | { state: 'error' }

const KEY = /^run_(\d{4}-\d{2}-\d{2})(?:_publish-(\d+))?$/
const PR_NUMBER = /\/pull\/(\d+)$/

const REASONS: Readonly<Record<string, string>> = logCopy.reason

/** The status label, with a failure's reason (a known one in words, another as its code). */
export function runStatusLabel(run: Pick<AdminBotRun, 'status' | 'failureReason'>): string {
  const status = logCopy.status[run.status]
  if (run.status !== 'failed' || run.failureReason === null) return status
  const reason = REASONS[run.failureReason] ?? run.failureReason
  return fill(logCopy.statusWithReason, { status, reason })
}

/** The run's date from its key (`run_<date>…`), formatted; the start's day otherwise. */
export function runDay(run: Pick<AdminBotRun, 'runKey' | 'startedAt'>): string {
  const date = KEY.exec(run.runKey)?.[1]
  return date === undefined ? formatDayTimeIn(run.startedAt, OPS_TIMEZONE).day : formatDay(date)
}

function kindLabel(run: AdminBotRun): string {
  if (run.kind === 'plan') return logCopy.kind.plan
  return fill(logCopy.kind.publish, { n: KEY.exec(run.runKey)?.[2] ?? '?' })
}

function runRow(run: AdminBotRun): BotRunRow {
  const outcome = (name: string) => run.outcomes[name] ?? 0
  const number = run.contentPrUrl === null ? undefined : PR_NUMBER.exec(run.contentPrUrl)?.[1]
  return {
    key: run.runKey,
    day: runDay(run),
    startedAt: formatDayTimeIn(run.startedAt, OPS_TIMEZONE).time,
    kind: kindLabel(run),
    mode: run.mode,
    modeLabel: logCopy.mode[run.mode],
    status: run.status,
    statusLabel: runStatusLabel(run),
    counts: {
      eligible: run.usersEligible,
      pending: outcome('pending'),
      applied: outcome('applied'),
      dryRun: outcome('dry_run'),
      skipped:
        outcome('skipped_plan_in_use') + outcome('skipped_gate_closed') + outcome('skipped_unseen'),
      invalid: outcome('invalid'),
      error: outcome('error'),
      deferred: run.usersDeferred,
    },
    pr:
      run.contentPrUrl === null
        ? null
        : {
            href: run.contentPrUrl,
            label: number === undefined ? run.contentPrUrl : fill(logCopy.prLabel, { number }),
          },
    summary: run.summary,
  }
}

/** The run log: a row per run (newest first), empty without runs, an error when unread. */
export function botRunLog(runs: readonly AdminBotRun[] | null): BotRunLogView {
  if (runs === null) return { state: 'error' }
  if (runs.length === 0) return { state: 'empty' }
  return { state: 'ready', rows: runs.map(runRow) }
}

/** `users_deferred` of today's plan run (`run_<today in Asia/Ho_Chi_Minh>`), 0 without one. */
export function deferredUsersToday(runs: readonly AdminBotRun[] | null, now: Date): number {
  const key = `run_${opsDay(now)}`
  return runs?.find((run) => run.runKey === key)?.usersDeferred ?? 0
}

/** §6.2: "N người dùng AI không được xử lý hôm nay — …" while today's plan run deferred users. */
export function deferredWarning(runs: readonly AdminBotRun[] | null, now: Date): string | null {
  const deferred = deferredUsersToday(runs, now)
  return deferred > 0 ? fill(vi.adminBot.deferred.warning, { count: formatNumber(deferred) }) : null
}
