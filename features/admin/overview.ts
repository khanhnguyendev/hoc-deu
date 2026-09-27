/**
 * `/admin` as data (platform design §2.4, §2.3 backups, §8.4 item 5; Part B-M5 decisions 25, 26;
 * task 5.6): the warnings, the account and activity counts, the latest ops metrics and the links
 * to the other admin pages. No React, no I/O: the aggregate readers' results and the latest
 * `ops_metrics` row per key come in; `now` is a parameter.
 */
import type { AccountStatus } from '@/lib/auth/dal'
import { fill, formatDayTimeIn, formatNumber, variantLabel } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { REPOSITORY_URL } from '@/lib/ops/repository'
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

const LINKS = {
  backupsRunbook: `${REPOSITORY_URL}/blob/main/docs/ops/backups.md`,
  compaction: `${REPOSITORY_URL}/blob/main/docs/adr/0031-event-compaction-deferred.md`,
  backupRuns: `${REPOSITORY_URL}/actions/workflows/backup.yml`,
  restoreRuns: `${REPOSITORY_URL}/actions/workflows/restore-test.yml`,
  maintenanceCron: `${REPOSITORY_URL}/blob/main/docs/adr/0034-maintenance-cron.md`,
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
  readonly kind: 'db-size' | 'backup' | 'restore-test' | 'cron' | 'coverage'
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
 * No reading for 36 hours: the daily cron (or its read) has missed a day. Measuring `runWarning`'s
 * own staleness at the check, not now, matters too (decision 26, ADR-0034): the cron runs about an
 * hour before the 22:17 UTC backup, so a healthy backup is ~23 hours old when read and ~47 hours
 * old just before the next read.
 */
const isOldReading = (reading: MetricReading, now: Date) =>
  now.getTime() - Date.parse(reading.recordedAt) > READING_MAX_AGE_HOURS * HOUR_MS

function whenText(seconds: number): string {
  const { day, time } = clock(seconds)
  return fill(copy.system.when, { time, day })
}

/**
 * The backup or restore-test warning: its last success is stale (above), or — once the cron has
 * run at all (`cron.last_run_at`, fresh or not) — no success was ever read. Only before the first
 * cron run does a missing reading stay silent ("chưa có dữ liệu", the first-run hint).
 *
 * A reading that was already old *when the cron last checked it* (`wasAlreadyStale`) is a genuine
 * backup or restore-test problem, shown regardless of the cron's own freshness. A reading that has
 * merely gone unrefreshed for 36 hours, while the cron itself has also gone unrefreshed that long
 * (`cronIsStale`), is not this run's fault — it means the cron has not run to check it, so it stays
 * silent here and surfaces once, through `cronWarning` (I2): a dead cron must never be read as a
 * failed backup.
 */
function runWarning(
  kind: 'backup' | 'restore-test',
  reading: MetricReading | null,
  cron: MetricReading | null,
  cronIsStale: boolean,
  now: Date,
): AdminWarning | null {
  const maxAgeMs =
    kind === 'backup' ? BACKUP_MAX_AGE_HOURS * HOUR_MS : RESTORE_TEST_MAX_AGE_DAYS * DAY_MS
  const backup = kind === 'backup'
  const base = {
    key: kind,
    kind,
    tone: 'warning' as const,
    action: backup
      ? { label: copy.warnings.actions.backupRuns, href: LINKS.backupRuns }
      : { label: copy.warnings.actions.restoreRuns, href: LINKS.restoreRuns },
  }
  if (reading === null) {
    if (cron === null) return null
    return { ...base, message: backup ? copy.warnings.backupNever : copy.warnings.restoreNever }
  }
  const checkedAt = Date.parse(reading.recordedAt)
  const wasAlreadyStale = checkedAt - reading.value * 1000 > maxAgeMs
  const stale = wasAlreadyStale || (isOldReading(reading, now) && !cronIsStale)
  if (!stale) return null
  return {
    ...base,
    message: fill(backup ? copy.warnings.backupStale : copy.warnings.restoreStale, {
      when: whenText(reading.value),
    }),
  }
}

/**
 * ADR-0034, I2: `cron.last_run_at` itself going unrefreshed for 36 hours means the maintenance
 * cron has not run — a registration lost, a runtime error, `CRON_SECRET` on the wrong scope — so
 * nothing has confirmed a recent backup or restore test either. Surfaced on its own so a dead cron
 * is never read as a failed backup (`runWarning` above suppresses that misreading).
 */
function cronWarning(cron: MetricReading | null, now: Date): AdminWarning | null {
  if (cron === null || !isOldReading(cron, now)) return null
  return {
    key: 'cron',
    kind: 'cron',
    tone: 'warning',
    message: fill(copy.warnings.cronStale, { when: whenText(cron.value) }),
    action: { label: copy.warnings.actions.maintenanceCron, href: LINKS.maintenanceCron },
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

/**
 * A card of an instant. No reading: "chưa có dữ liệu" with the first-run hint — or, once the cron
 * has run, the hint that it found no successful run.
 */
function instantCard(
  id: SystemCard['id'],
  label: string,
  reading: MetricReading | null,
  cronHasRun: boolean,
): SystemCard {
  if (reading === null) {
    return cronHasRun
      ? { id, label, value: copy.system.noData, hint: copy.system.noSuccessHint }
      : { id, label, ...NO_DATA }
  }
  const { day, time } = clock(reading.value)
  return { id, label, value: day, hint: fill(copy.system.at, { time }) }
}

/** The DB size; a size the cron has not measured for 36 hours says so, with when it was. */
function dbSizeCard(reading: MetricReading | null, now: Date): SystemCard {
  const base = { id: 'db-size' as const, label: copy.system.dbSize }
  if (reading === null) return { ...base, ...NO_DATA }
  const stale = isOldReading(reading, now)
  return {
    ...base,
    value: formatSize(reading.value),
    hint: stale
      ? fill(copy.system.staleHint, { when: whenText(Date.parse(reading.recordedAt) / 1000) })
      : copy.system.dbSizeHint,
  }
}

function systemCards(metrics: OpsMetrics, now: Date): SystemCard[] {
  const cronHasRun = metrics['cron.last_run_at'] !== null
  return [
    dbSizeCard(metrics['db.size_bytes'], now),
    instantCard('backup', copy.system.backup, metrics['backup.last_success_at'], cronHasRun),
    instantCard(
      'restore-test',
      copy.system.restoreTest,
      metrics['restore_test.last_success_at'],
      cronHasRun,
    ),
    instantCard('cron', copy.system.cron, metrics['cron.last_run_at'], false),
  ]
}

export function buildAdminOverview(input: {
  counts: AdminCounts
  metrics: OpsMetrics
  coverage: readonly CoverageWarning[]
  now: Date
}): AdminOverviewPage {
  const { counts, metrics, now } = input
  const cron = metrics['cron.last_run_at']
  const cronIsStale = cron !== null && isOldReading(cron, now)
  const redWeeks = input.coverage.reduce((sum, warning) => sum + warning.weeks.length, 0)
  const warnings = [
    ...input.coverage.map(coverageWarning),
    dbSizeWarning(metrics['db.size_bytes']),
    cronWarning(cron, now),
    runWarning('backup', metrics['backup.last_success_at'], cron, cronIsStale, now),
    runWarning('restore-test', metrics['restore_test.last_success_at'], cron, cronIsStale, now),
  ].filter((warning) => warning !== null)
  return {
    // A stable sort: red and critical first, each group in the order above.
    warnings: [
      ...warnings.filter((warning) => warning.tone === 'danger'),
      ...warnings.filter((warning) => warning.tone === 'warning'),
    ],
    counts,
    system: systemCards(metrics, now),
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
