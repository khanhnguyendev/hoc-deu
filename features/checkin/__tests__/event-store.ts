/**
 * `apply_event` and `apply_system_event` for item outcomes and check-ins, in the fake's tables
 * (task 5.2a), as the SQL applies them (20260926000200, 20260927000100): a known id is
 * `duplicate`; the event's `local_day` must be the database's (`day_changed`); every derived row
 * must be at the version the caller read (`version_conflict`); then the event and the rows are
 * stored, each row at version + 1. A new `plan_block_state` row counts for the event's day; an
 * update keeps its day, except a `skipped` block checked in `done` / `partial` on a later day,
 * which moves there (M-6 a). The database's local day comes from the fake's `schedule_versions`
 * and the (fake) clock, so a test that moves the clock between two calls sees `day_changed`.
 */
import { RULES_VERSION } from '@/lib/domain/rules'
import { CHECK_IN_STATUSES, type CheckInStatus, isDoneOrPartial } from '@/lib/domain/state'
import { localDay, scheduleAt, type LocalDay } from '@/lib/domain/time/localDay'
import type { EventErrorCode } from '@/lib/events/apply'
import { eventRow } from '@/lib/plans/__tests__/fixtures'
import type { FakeSupabase, RowOf, RpcAnswer } from '@/lib/testing/fake-supabase'

type Change = { readonly table: string; readonly row: Record<string, unknown> }

export type StoreArgs = {
  readonly p_user_id?: string
  readonly p_event: Record<string, unknown> & {
    readonly id: string
    readonly type: string
    readonly local_day?: LocalDay
    readonly payload: Record<string, unknown>
  }
  readonly p_changes?: readonly Change[]
  readonly p_expected?: Readonly<Record<string, number>>
}

/**
 * What the next call does before it is applied: raise a code, or run a hook — which may change
 * the tables or the clock (another request, the day start passing) — and then answer what the
 * hook returns, or be applied as usual when it returns nothing.
 */
export type Step = EventErrorCode | ((args: StoreArgs) => RpcAnswer | void)

const answer = (data: unknown): RpcAnswer => ({ data, error: null })
const raise = (code: string): RpcAnswer => ({ data: null, error: { message: code } })

/** The user's local day now, as the `events` trigger computes it. */
export function databaseDay(fake: FakeSupabase, userId: string): LocalDay {
  const versions = (fake.tables.schedule_versions ?? [])
    .filter((row) => row.user_id === userId)
    .map((row) => ({
      timezone: row.timezone,
      dayStartsAt: row.day_starts_at.slice(0, 5),
      effectiveAt: new Date(row.effective_at).toISOString(),
    }))
  const now = new Date()
  return localDay(now, scheduleAt(versions, now))
}

function keyOf(change: Change): string {
  const { table, row } = change
  switch (table) {
    case 'item_state':
      return `item_state:${String(row.item_id)}`
    case 'plan_block_state':
      return `plan_block_state:${String(row.plan_id)}/${String(row.block_id)}`
    case 'daily_activity':
      return `daily_activity:${String(row.local_day)}`
    default:
      throw new Error(`event store: unexpected table ${table}`)
  }
}

/** The stored row a change replaces, if any. */
function storedRow(fake: FakeSupabase, userId: string, change: Change) {
  const { table, row } = change
  switch (table) {
    case 'item_state':
      return (fake.tables.item_state ?? []).find(
        (stored) => stored.user_id === userId && stored.item_id === row.item_id,
      )
    case 'plan_block_state':
      return (fake.tables.plan_block_state ?? []).find(
        (stored) =>
          stored.user_id === userId &&
          stored.plan_id === row.plan_id &&
          stored.block_id === row.block_id,
      )
    default:
      return (fake.tables.daily_activity ?? []).find(
        (stored) => stored.user_id === userId && stored.local_day === row.local_day,
      )
  }
}

/** `row` in place of `previous`, or appended. */
function upsert<T>(table: T[], previous: T | undefined, row: T): void {
  if (previous === undefined) table.push(row)
  else table[table.indexOf(previous)] = row
}

function store(fake: FakeSupabase, userId: string, change: Change, day: LocalDay): number {
  const stored = storedRow(fake, userId, change)
  const version = (stored?.version ?? 0) + 1
  const base = { user_id: userId, version, rules_version: RULES_VERSION }
  if (change.table === 'item_state') {
    const row = { ...change.row, ...base } as RowOf<'item_state'>
    upsert((fake.tables.item_state ??= []), stored as RowOf<'item_state'> | undefined, row)
  } else if (change.table === 'plan_block_state') {
    const previous = stored as RowOf<'plan_block_state'> | undefined
    const status = change.row.status as CheckInStatus
    if (!CHECK_IN_STATUSES.includes(status)) throw new Error(`event store: status ${status}`)
    const moved =
      previous !== undefined &&
      previous.status === 'skipped' &&
      isDoneOrPartial(status) &&
      day > previous.checked_in_on
    const row = {
      ...change.row,
      ...base,
      checked_in_on: previous === undefined || moved ? day : previous.checked_in_on,
      checked_in_at: new Date().toISOString(),
    } as RowOf<'plan_block_state'>
    upsert((fake.tables.plan_block_state ??= []), previous, row)
  } else {
    const row = { ...change.row, ...base } as RowOf<'daily_activity'>
    upsert((fake.tables.daily_activity ??= []), stored as RowOf<'daily_activity'> | undefined, row)
  }
  return version
}

function apply(
  fake: FakeSupabase,
  userId: string,
  args: StoreArgs,
  source: 'user' | 'system',
): RpcAnswer {
  const event = args.p_event
  const events = (fake.tables.events ??= [])
  if (events.some((row) => row.id === event.id)) {
    return answer({ outcome: 'duplicate', versions: {} })
  }
  if (source === 'system' && (event.type !== 'block.checked_in' || event.payload.auto !== true)) {
    return raise('invalid_event')
  }
  const day = databaseDay(fake, userId)
  if (event.local_day !== undefined && event.local_day !== day) return raise('day_changed')
  const changes = args.p_changes ?? []
  const expected = args.p_expected ?? {}
  for (const change of changes) {
    if (expected[keyOf(change)] !== (storedRow(fake, userId, change)?.version ?? 0)) {
      return raise('version_conflict')
    }
  }
  events.push(
    eventRow({
      id: event.id,
      user_id: userId,
      actor_id: userId,
      source,
      type: event.type,
      track_id: (event.track_id as string | undefined) ?? null,
      item_id: (event.item_id as string | undefined) ?? null,
      plan_id: (event.plan_id as string | undefined) ?? null,
      block_id: (event.block_id as string | undefined) ?? null,
      payload: event.payload as RowOf<'events'>['payload'],
      local_day: day,
      occurred_at: new Date().toISOString(),
    }),
  )
  const versions = Object.fromEntries(
    changes.map((change) => [keyOf(change), store(fake, userId, change, day)]),
  )
  return answer({ outcome: 'applied', versions })
}

/**
 * Answers `apply_event` (the session user `userId`) and `apply_system_event` in `fake`; the first
 * calls of each take their `script`'s steps in turn.
 */
export function eventStore(
  fake: FakeSupabase,
  userId: string,
  script: { readonly learner?: readonly Step[]; readonly system?: readonly Step[] } = {},
): void {
  const handler = (steps: Step[], source: 'user' | 'system') => (raw: Record<string, unknown>) => {
    const args = raw as unknown as StoreArgs
    const step = steps.shift()
    if (typeof step === 'string') return raise(step)
    const answered = step?.(args)
    if (answered !== undefined) return answered
    return apply(fake, source === 'system' ? (args.p_user_id ?? '') : userId, args, source)
  }
  fake.onRpc('apply_event', handler([...(script.learner ?? [])], 'user'))
  fake.onRpc('apply_system_event', handler([...(script.system ?? [])], 'system'))
}
