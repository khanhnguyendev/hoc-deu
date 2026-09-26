/**
 * M-13 (ruling M4-R19): a TypeScript ↔ Postgres parity sweep for `nextDayStart`, for every
 * timezone-picker option (`timeZoneOptions()`) and every allowed day start (`DAY_STARTS`), around
 * every UTC-offset change each of those zones makes in 2026 and 2027. `pnpm db:tz-sweep` prints
 * one `select` to stdout — nothing else, no connection of its own (docs/ops/production.md pipes it
 * into `psql`, locally or against a hosted project's Management API query endpoint). The `select`
 * holds the swept cases as a `VALUES` list and asks Postgres to compare its own reading of "the
 * next day start" — the exact formula `schedule_versions_guard_history` uses (ADR-0017,
 * `supabase/migrations/20260926000400_schedule_history_floor.sql`) — against what this file's
 * `nextDayStart` computed for the same inputs. The report wants two numbers back: the count of
 * cases where TypeScript's reading is *later* than Postgres's (must be 0 — TypeScript must never
 * promise a version window Postgres would then reject), and the largest Postgres-minus-TypeScript
 * gap in minutes (≤ 65 everywhere except `Antarctica/Troll`, a 2-hour shift — task 4.12's sweep,
 * done by hand, found the same exception).
 */
import { DAY_STARTS, nextDayStart, type DayStart, type Schedule } from '@/lib/domain/time/localDay'
import { timeZoneOptions } from '@/lib/domain/time/timeZones'

const MS_PER_MINUTE = 60_000
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE
/** The same raster `nextDayStart` itself steps on (localDay.ts) — for the same reason: every
 * offset change and every allowed day start falls on a multiple of 15 minutes, and only a forward
 * scan (never a binary search) is guaranteed to find the earliest instant on the far side. */
const RASTER_STEP_MS = 15 * MS_PER_MINUTE

/** Every 2026 and 2027 transition falls inside this window (a UTC year is never enough on its
 * own: a zone can change offset in the first days of January in its own local time). */
export const SWEEP_FROM = new Date('2026-01-01T00:00:00Z')
export const SWEEP_TO = new Date('2028-01-01T00:00:00Z')

/** The walk's seed sits this many days before the transition and takes this many day-start hops —
 * comfortably brackets it whatever the transition's own local clock time, because every allowed
 * day start is 00:00–12:00: a seed 3 days back can never itself land past the transition, and 6
 * hops of about a day each reach 3 days past it. */
const SEED_LEAD_DAYS = 3
const WALK_STEPS = 6

export type SweepCase = {
  now: Date
  timezone: string
  dayStartsAt: DayStart
  tsNext: Date
}

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(zone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(zone)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(zone, formatter)
  }
  return formatter
}

/** `zone`'s UTC offset (minutes) at `instant` — the wall-clock reading minus the instant itself,
 * independent of `lib/domain/time`'s own (private) copy of this trick, so this audit tool never
 * depends on that module's internals, only its public `nextDayStart`. */
function offsetMinutes(zone: string, instant: Date): number {
  const parts = formatterFor(zone).formatToParts(instant)
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type)
    if (part === undefined) throw new Error(`formatToParts did not include a "${type}" part`)
    return Number(part.value)
  }
  const wallClockAsUtcMs = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return Math.round((wallClockAsUtcMs - instant.getTime()) / MS_PER_MINUTE)
}

/**
 * Every UTC-offset change `zone` makes in `[from, to)`, earliest first. A daily coarse scan flags
 * the 24-hour window a change falls in (no real zone changes offset twice in a day), then a
 * 15-minute forward scan inside that window finds the exact instant — the earliest one, which is
 * what matters here exactly as it does for `nextDayStart` (ADR-0017): a binary search would only
 * be guaranteed to land *on* the far side, not on its first instant.
 */
export function detectTransitions(zone: string, from: Date, to: Date): Date[] {
  const transitions: Date[] = []
  let previousOffset = offsetMinutes(zone, from)
  for (let dayMs = from.getTime() + MS_PER_DAY; dayMs < to.getTime(); dayMs += MS_PER_DAY) {
    const offset = offsetMinutes(zone, new Date(dayMs))
    if (offset !== previousOffset) {
      let probeMs = dayMs - MS_PER_DAY
      while (offsetMinutes(zone, new Date(probeMs)) === previousOffset) probeMs += RASTER_STEP_MS
      transitions.push(new Date(probeMs))
    }
    previousOffset = offset
  }
  return transitions
}

/** One walk of `WALK_STEPS` real `nextDayStart` outputs, seeded before `transition` — every case
 * is a genuine (now, tsNext) pair `nextDayStart` produced, not a contrived one. */
function walkAround(transition: Date, schedule: Schedule): SweepCase[] {
  const cases: SweepCase[] = []
  let now = new Date(transition.getTime() - SEED_LEAD_DAYS * MS_PER_DAY)
  for (let step = 0; step < WALK_STEPS; step++) {
    const tsNext = nextDayStart(now, schedule)
    cases.push({ now, timezone: schedule.timezone, dayStartsAt: schedule.dayStartsAt, tsNext })
    now = tsNext
  }
  return cases
}

/**
 * Every swept case: every timezone-picker option (`zones`, default `timeZoneOptions()`) × every
 * day start, walked around every 2026 and 2027 transition that option's zone makes. A zone with no
 * transition in the window contributes nothing — there is no offset change to sweep around.
 */
export function buildSweepCases(zones: readonly string[] = timeZoneOptions()): SweepCase[] {
  const cases: SweepCase[] = []
  for (const zone of zones) {
    for (const transition of detectTransitions(zone, SWEEP_FROM, SWEEP_TO)) {
      for (const dayStartsAt of DAY_STARTS) {
        cases.push(...walkAround(transition, { timezone: zone, dayStartsAt }))
      }
    }
  }
  return cases
}

const literal = (value: string): string => `'${value.replaceAll("'", "''")}'`
const instant = (d: Date): string => `${literal(d.toISOString())}::timestamptz`

/**
 * The whole check as one `select`: a `VALUES` list of every swept case, Postgres's own reading of
 * the next day start alongside (the `schedule_versions_guard_history` formula, ADR-0017), and the
 * two numbers the report wants.
 */
export function renderSweepSql(cases: readonly SweepCase[]): string {
  const rows = cases.map(
    (c) =>
      `  (${instant(c.now)}, ${literal(c.timezone)}, ${literal(c.dayStartsAt)}::time, ${instant(c.tsNext)})`,
  )
  return [
    '-- Generated by `pnpm db:tz-sweep` (tools/db/tz-sweep.ts). Prints only, no connection of its',
    '-- own — run it locally through psql, or on a hosted project through the Management API',
    "-- query endpoint (docs/ops/production.md). M-13, ruling M4-R19: TypeScript's nextDayStart",
    '-- vs. the day-start formula schedule_versions_guard_history uses (ADR-0017), around every',
    '-- 2026 and 2027 DST transition of every timezone-picker option and every allowed day start.',
    'with cases(at, tz, day_starts_at, ts_next) as (',
    '  values',
    rows.join(',\n'),
    '),',
    'postgres_reading as (',
    '  select',
    '    ts_next,',
    '    ((public.local_day(at, tz, day_starts_at) + 1) + day_starts_at) at time zone tz as pg_next',
    '  from cases',
    ')',
    'select',
    '  count(*) filter (where ts_next > pg_next) as ts_later_count,',
    '  max(extract(epoch from (pg_next - ts_next)) / 60) as max_gap_minutes',
    'from postgres_reading;',
    '',
  ].join('\n')
}

const isMain =
  typeof process.argv[1] === 'string' && import.meta.url === `file://${process.argv[1]}`
if (isMain) {
  console.log(renderSweepSql(buildSweepCases()))
}
