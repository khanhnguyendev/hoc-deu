/**
 * `/admin` as data (platform design §2.4, §2.3 backups, §8.4 item 5; Part B-M5 decisions 25, 26;
 * task 5.6): the warnings, the account and activity counts, the latest ops metrics and the links
 * to the other admin pages. No React, no I/O: the aggregate readers' results and the latest
 * `ops_metrics` row per key come in; `now` is a parameter.
 */
import type { AccountStatus } from '@/lib/auth/dal'
import { fill, formatDayTimeIn, formatNumber, variantLabel } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { CoverageWarning } from './content'

const copy = vi.adminOverview

/** Sizes in MB are MiB, as Postgres and the Supabase dashboard report them. */
export const MB = 1024 * 1024
/** §2.3, §8.4 item 5: switch to the incremental backup chain; warn (ADR-0031's trigger); critical. */
export const DB_SIZE_MB = { incremental: 100, warn: 350, critical: 450 } as const
export const BACKUP_MAX_AGE_HOURS = 36
export const RESTORE_TEST_MAX_AGE_DAYS = 8
/**
 * The maintenance cron reads the backup runs once a day (ADR-0034). A reading older than this
 * means it has missed a day — the cron did not run, or GitHub could not be read — so nothing has
 * confirmed a recent backup either.
 */
export const READING_MAX_AGE_HOURS = 36

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS
/** Admin times read in the platform's default zone (§5.1), as the queue's sign-up days do. */
const ADMIN_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const REPOSITORY = 'https://github.com/khanhnguyendev/hoc-deu'
const LINKS = {
  backupsRunbook: `${REPOSITORY}/blob/main/docs/ops/backups.md`,
  compaction: `${REPOSITORY}/blob/main/docs/adr/0031-event-compaction-deferred.md`,
  backupRuns: `${REPOSITORY}/actions/workflows/backup.yml`,
  restoreRuns: `${REPOSITORY}/actions/workflows/restore-test.yml`,
} as const

/** The `ops_metrics` keys (20260927000200_ops.sql). */
export const OPS_METRIC_KEYS = [
  'db.size_bytes',
  'backup.last_success_at',
  'restore_test.last_success_at',
  'cron.last_run_at',
] as const
export type OpsMetricKey = (typeof OPS_METRIC_KEYS)[number]

/**
 * The latest `ops_metrics` row of a key: its value — bytes, or an instant as Unix epoch seconds —
 * and when the cron recorded it (ISO-8601).
 */
export type MetricReading = { readonly value: number; readonly recordedAt: string }
/** null: no row yet (before the first cron run, or before the first backup succeeds). */
export type OpsMetrics = Readonly<Record<OpsMetricKey, MetricReading | null>>

/** `admin_overview()`. */
export type AdminCounts = {
  readonly users: Readonly<Record<AccountStatus, number>>
  readonly learnersCompleted7d: number
  readonly plansCreated7d: number
}

export type AdminWarning = {
  readonly key: string
  readonly kind: 'db-size' | 'backup' | 'restore-test' | 'coverage'
  /** `danger`: red (coverage) and critical; `warning`: the rest (DESIGN_SYSTEM §9 Banners). */
  readonly tone: 'danger' | 'warning'
  readonly message: string
  /** One action: an admin page, or a runbook / workflow page on GitHub. */
  readonly action: { readonly label: string; readonly href: string }
}

export type SystemCard = {
  readonly id: 'db-size' | 'backup' | 'restore-test' | 'cron'
  readonly label: string
  readonly value: string
  readonly hint: string
}

export type AdminLink = { readonly href: string; readonly title: string; readonly meta: string }

export type AdminOverviewPage = {
  /** Red and critical first, then the warnings. */
  readonly warnings: readonly AdminWarning[]
  readonly counts: AdminCounts
  /** DB size, last backup, last restore test, last cron run. */
  readonly system: readonly SystemCard[]
  readonly links: readonly AdminLink[]
}

export type DbSizeLevel = 'ok' | 'incremental' | 'warn' | 'critical'

export function dbSizeLevel(bytes: number): DbSizeLevel {
  if (bytes >= DB_SIZE_MB.critical * MB) return 'critical'
  if (bytes >= DB_SIZE_MB.warn * MB) return 'warn'
  if (bytes >= DB_SIZE_MB.incremental * MB) return 'incremental'
  return 'ok'
}

/** `360 MB`, `99,9 MB` — truncated, so a size never reads as a threshold it has not reached. */
function formatSize(bytes: number): string {
  return `${formatNumber(Math.floor((bytes / MB) * 10) / 10, { maximumFractionDigits: 1 })} MB`
}

/** An epoch-seconds instant as a day and a 24-hour time in Vietnam. */
const clock = (seconds: number) => formatDayTimeIn(new Date(seconds * 1000), ADMIN_TIME_ZONE)

function dbSizeWarning(reading: MetricReading | null): AdminWarning | null {
  if (reading === null) return null
  const level = dbSizeLevel(reading.value)
  if (level === 'ok') return null
  const size = formatSize(reading.value)
  const base = { key: 'db-size', kind: 'db-size' as const }
  if (level === 'incremental') {
    return {
      ...base,
      tone: 'warning',
      message: fill(copy.warnings.dbIncremental, { size }),
      action: { label: copy.warnings.actions.backupsRunbook, href: LINKS.backupsRunbook },
    }
  }
  return {
    ...base,
    tone: level === 'critical' ? 'danger' : 'warning',
    message: fill(level === 'critical' ? copy.warnings.dbCritical : copy.warnings.dbWarn, { size }),
    action: { label: copy.warnings.actions.compaction, href: LINKS.compaction },
  }
}

/**
 * Decision 26 with the daily read (ADR-0034): stale when the last success was already older than
 * `maxAgeMs` when the cron checked it, or when no check has happened for 36 hours. Measuring at
 * the check, not now, matters: the cron runs about an hour before the 22:17 UTC backup, so a
 * healthy backup is ~23 hours old when read and ~47 hours old just before the next read.
 */
function isStale(reading: MetricReading, maxAgeMs: number, now: Date): boolean {
  const checkedAt = Date.parse(reading.recordedAt)
  return (
    checkedAt - reading.value * 1000 > maxAgeMs ||
    now.getTime() - checkedAt > READING_MAX_AGE_HOURS * HOUR_MS
  )
}

function whenText(seconds: number): string {
  const { day, time } = clock(seconds)
  return fill(copy.system.when, { time, day })
}

function runWarning(
  kind: 'backup' | 'restore-test',
  reading: MetricReading | null,
  now: Date,
): AdminWarning | null {
  const maxAgeMs =
    kind === 'backup' ? BACKUP_MAX_AGE_HOURS * HOUR_MS : RESTORE_TEST_MAX_AGE_DAYS * DAY_MS
  if (reading === null || !isStale(reading, maxAgeMs, now)) return null
  const backup = kind === 'backup'
  return {
    key: kind,
    kind,
    tone: 'warning',
    message: fill(backup ? copy.warnings.backupStale : copy.warnings.restoreStale, {
      when: whenText(reading.value),
    }),
    action: backup
      ? { label: copy.warnings.actions.backupRuns, href: LINKS.backupRuns }
      : { label: copy.warnings.actions.restoreRuns, href: LINKS.restoreRuns },
  }
}

function coverageWarning(warning: CoverageWarning): AdminWarning {
  return {
    key: `coverage:${warning.trackId}:${warning.variant}`,
    kind: 'coverage',
    tone: 'danger',
    message: fill(copy.warnings.coverage, {
      track: warning.trackTitle,
      variant: variantLabel(warning.variant),
      weeks: warning.weeks.join(', '),
    }),
    action: { label: copy.warnings.actions.content, href: '/admin/content' },
  }
}

const NO_DATA = { value: copy.system.noData, hint: copy.system.noDataHint }

function instantCard(
  id: SystemCard['id'],
  label: string,
  reading: MetricReading | null,
): SystemCard {
  if (reading === null) return { id, label, ...NO_DATA }
  const { day, time } = clock(reading.value)
  return { id, label, value: day, hint: fill(copy.system.at, { time }) }
}

function systemCards(metrics: OpsMetrics): SystemCard[] {
  const size = metrics['db.size_bytes']
  const dbSize = { id: 'db-size' as const, label: copy.system.dbSize }
  return [
    size === null
      ? { ...dbSize, ...NO_DATA }
      : { ...dbSize, value: formatSize(size.value), hint: copy.system.dbSizeHint },
    instantCard('backup', copy.system.backup, metrics['backup.last_success_at']),
    instantCard('restore-test', copy.system.restoreTest, metrics['restore_test.last_success_at']),
    instantCard('cron', copy.system.cron, metrics['cron.last_run_at']),
  ]
}

export function buildAdminOverview(input: {
  counts: AdminCounts
  metrics: OpsMetrics
  coverage: readonly CoverageWarning[]
  now: Date
}): AdminOverviewPage {
  const { counts, metrics, now } = input
  const redWeeks = input.coverage.reduce((sum, warning) => sum + warning.weeks.length, 0)
  const warnings = [
    ...input.coverage.map(coverageWarning),
    dbSizeWarning(metrics['db.size_bytes']),
    runWarning('backup', metrics['backup.last_success_at'], now),
    runWarning('restore-test', metrics['restore_test.last_success_at'], now),
  ].filter((warning) => warning !== null)
  return {
    // A stable sort: red and critical first, each group in the order above.
    warnings: [
      ...warnings.filter((warning) => warning.tone === 'danger'),
      ...warnings.filter((warning) => warning.tone === 'warning'),
    ],
    counts,
    system: systemCards(metrics),
    links: [
      {
        href: '/admin/users',
        title: vi.nav.adminUsers,
        meta: fill(copy.links.usersMeta, { count: formatNumber(counts.users.pending) }),
      },
      {
        href: '/admin/content',
        title: vi.nav.adminContent,
        meta:
          redWeeks === 0
            ? copy.links.contentOk
            : fill(copy.links.contentRed, { count: formatNumber(redWeeks) }),
      },
    ],
  }
}
