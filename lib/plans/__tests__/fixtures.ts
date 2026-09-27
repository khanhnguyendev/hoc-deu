/**
 * Rows and a `plan.generated` stand-in for the `lib/plans` tests (task 5.1a). The catalog is the
 * plan engine's hand-built one (`lib/domain/plan/__tests__/fixtures.ts`): DSA 8w and English 10w,
 * enrollments starting Monday 2026-09-28.
 */
import type { PlanBlock, StoredPlan, TrackSnapshot } from '@/lib/domain/plan/types'
import { RULES_VERSION } from '@/lib/domain/rules'
import type { CheckInStatus, ItemState } from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { EventErrorCode } from '@/lib/events/apply'
import type { Json } from '@/lib/supabase/database.types'
import type { FakeSupabase, RowOf, RpcAnswer } from '@/lib/testing/fake-supabase'

export const USER_ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'
export const OTHER_USER_ID = '0f8d6a52-3b1c-4d7e-9a2f-6c5b4e3d2a10'

/** Monday; 10:00 in Asia/Ho_Chi_Minh (day start 04:00) is 03:00 UTC. */
export const TODAY = '2026-09-28'
export const NOW = new Date('2026-09-28T03:00:00.000Z')
export const YESTERDAY = '2026-09-27'

const CREATED = '2026-09-01T00:00:00.000Z'

export function scheduleRow(
  change: Partial<RowOf<'schedule_versions'>> = {},
): RowOf<'schedule_versions'> {
  return {
    user_id: USER_ID,
    timezone: 'Asia/Ho_Chi_Minh',
    day_starts_at: '04:00:00',
    effective_at: '2026-09-01T00:00:00+00:00',
    created_at: CREATED,
    ...change,
  }
}

/** An active enrollment starting TODAY with every setting at the track default (null). */
export function trackRow(
  trackId: string,
  change: Partial<RowOf<'user_tracks'>> = {},
): RowOf<'user_tracks'> {
  return {
    user_id: USER_ID,
    track_id: trackId,
    roadmap_variant: trackId === 'dsa' ? '8w' : '10w',
    status: 'active',
    start_date: TODAY,
    budget_minutes: trackId === 'dsa' ? 60 : 25,
    new_per_day: null,
    throttle: null,
    weekly_template: null,
    include_bonus: false,
    reset_on: null,
    created_at: CREATED,
    updated_at: CREATED,
    ...change,
  }
}

/** Block `n` of `kind` for `trackId` on `date`, its items at 10 minutes each. */
export function planBlock(
  date: LocalDay,
  trackId: string,
  kind: PlanBlock['kind'],
  itemIds: readonly string[],
  change: Partial<PlanBlock> = {},
): PlanBlock {
  return {
    id: `${date}:${trackId}:${kind}:1`,
    trackId,
    kind,
    estMinutes: itemIds.length * 10,
    items: itemIds.map((itemId) => ({
      itemId,
      mode: kind === 'new' ? 'new' : 'review',
      minutes: 10,
    })),
    ...change,
  }
}

export const SNAPSHOT: TrackSnapshot = {
  variant: '8w',
  week: 1,
  dueCount: 0,
  newPerDay: null,
  throttled: false,
  reviewDebt: false,
}

let planSeq = 0

/** A plan id that sorts after every earlier one (a UUID shape, like the database's). */
export function planId(): string {
  planSeq += 1
  return `00000000-0000-4000-8000-${String(planSeq).padStart(12, '0')}`
}

export function planRow(input: {
  readonly date: LocalDay
  readonly blocks?: readonly PlanBlock[] | Json
  readonly tracks?: Readonly<Record<string, TrackSnapshot>> | Json
  readonly seenAt?: string | null
  readonly version?: number
  readonly id?: string
  readonly userId?: string
}): RowOf<'day_plans'> {
  return {
    id: input.id ?? planId(),
    user_id: input.userId ?? USER_ID,
    plan_date: input.date,
    blocks: (input.blocks ?? []) as Json,
    roadmap_weeks: (input.tracks ?? { dsa: SNAPSHOT }) as Json,
    version: input.version ?? 1,
    source: 'baseline',
    seen_at: input.seenAt ?? null,
    rules_version: RULES_VERSION,
    created_at: CREATED,
    updated_at: CREATED,
  }
}

/** The StoredPlan `storedPlanFromRow` reads from `row` (for rows built from typed blocks). */
export function storedOf(row: RowOf<'day_plans'>): StoredPlan {
  return {
    id: row.id,
    planDate: row.plan_date,
    version: row.version,
    source: 'baseline',
    seenAt: row.seen_at,
    blocks: row.blocks as unknown as PlanBlock[],
    tracks: row.roadmap_weeks as unknown as Record<string, TrackSnapshot>,
  }
}

export function blockStateRow(
  plan: { readonly id: string },
  block: PlanBlock,
  status: CheckInStatus,
  checkedInOn: LocalDay,
): RowOf<'plan_block_state'> {
  return {
    user_id: USER_ID,
    plan_id: plan.id,
    block_id: block.id,
    track_id: block.trackId,
    status,
    minutes: block.estMinutes,
    note: null,
    auto: false,
    checked_in_on: checkedInOn,
    checked_in_at: `${checkedInOn}T05:00:00.000Z`,
    version: 1,
    rules_version: RULES_VERSION,
  }
}

export function itemStateRow(state: ItemState, userId = USER_ID): RowOf<'item_state'> {
  return {
    user_id: userId,
    item_id: state.itemId,
    track_id: state.trackId,
    topic_id: state.topicId,
    item_type: state.itemType,
    level: state.level,
    weak: state.weak,
    top_successes: state.topSuccesses,
    status: state.status,
    due_on: state.dueOn,
    last_result: state.lastResult,
    last_result_on: state.lastResultOn,
    introduced_on: state.introducedOn,
    lapses: state.lapses,
    reps: state.reps,
    version: 1,
    rules_version: RULES_VERSION,
  }
}

let eventSeq = 0

export function eventRow(change: Partial<RowOf<'events'>> & Pick<RowOf<'events'>, 'type'>) {
  eventSeq += 1
  return {
    id: `10000000-0000-4000-8000-${String(eventSeq).padStart(12, '0')}`,
    user_id: USER_ID,
    actor_id: USER_ID,
    source: 'system',
    track_id: null,
    item_id: null,
    plan_id: null,
    block_id: null,
    payload: {},
    local_day: TODAY,
    occurred_at: new Date(Date.UTC(2026, 8, 28) + eventSeq * 1000).toISOString(),
    rules_version: RULES_VERSION,
    ...change,
  } satisfies RowOf<'events'>
}

const UNTOUCHING = new Set([
  'plan.generated',
  'plan.ai_proposed',
  'plan.ai_applied',
  'plan.ai_skipped',
])

type StoreArgs = {
  readonly p_user_id: string
  readonly p_event: {
    readonly id: string
    readonly type: string
    readonly local_day: LocalDay
    readonly payload: { readonly mode: 'baseline' | 'resume' | 'rebuild' }
  }
  readonly p_changes: readonly {
    readonly row: {
      readonly plan_date: LocalDay
      readonly blocks: Json
      readonly roadmap_weeks: Json
    }
  }[]
  readonly p_expected: Readonly<Record<string, number>>
}

const answer = (data: unknown): RpcAnswer => ({ data, error: null })

/** `plan.generated` as `apply_system_event` answers it (20260927000100 steps 6–7), in the fake's
 *  tables: one plan per date (`plan_exists`), a rebuild at the stored version of an untouched plan
 *  (`version_conflict`, `plan_in_use`), and the event with the plan's id. */
function store(fake: FakeSupabase, args: StoreArgs): RpcAnswer {
  const { p_user_id: userId, p_event: event } = args
  const row = args.p_changes[0]?.row
  if (event.type !== 'plan.generated' || row === undefined) {
    throw new Error(`planStore: unexpected event ${event.type}`)
  }
  const plans = (fake.tables.day_plans ??= [])
  const existing = plans.find((plan) => plan.user_id === userId && plan.plan_date === row.plan_date)
  let stored: RowOf<'day_plans'>
  if (event.payload.mode === 'rebuild') {
    const expected = args.p_expected[`day_plans:${row.plan_date}`]
    if (existing === undefined || existing.version !== expected) {
      return { data: null, error: { message: 'version_conflict' } }
    }
    const touched =
      (fake.tables.plan_block_state ?? []).some((state) => state.plan_id === existing.id) ||
      (fake.tables.events ?? []).some(
        (candidate) => candidate.plan_id === existing.id && !UNTOUCHING.has(candidate.type),
      )
    if (touched) return answer({ outcome: 'plan_in_use', plan_id: existing.id, versions: {} })
    existing.blocks = row.blocks
    existing.roadmap_weeks = row.roadmap_weeks
    existing.version = expected + 1
    existing.source = 'baseline'
    stored = existing
  } else {
    if (existing !== undefined) {
      return answer({ outcome: 'plan_exists', plan_id: existing.id, versions: {} })
    }
    stored = planRow({
      date: row.plan_date,
      blocks: row.blocks,
      tracks: row.roadmap_weeks,
      userId,
    })
    plans.push(stored)
  }
  ;(fake.tables.events ??= []).push(
    eventRow({
      id: event.id,
      user_id: userId,
      actor_id: userId,
      type: 'plan.generated',
      plan_id: stored.id,
      payload: event.payload,
      local_day: event.local_day,
    }),
  )
  return answer({
    outcome: 'applied',
    plan_id: stored.id,
    versions: { [`day_plans:${row.plan_date}`]: stored.version },
  })
}

/** What `apply_system_event` does next: store the plan, raise a code, or answer as given. */
export type StoreStep = 'store' | EventErrorCode | RpcAnswer

/**
 * Answers `apply_system_event` in `fake`: the first calls take `script`'s steps in turn (an error
 * code is raised as the RPC error), then every call stores the plan (`store` above).
 */
export function planStore(fake: FakeSupabase, script: readonly StoreStep[] = []): void {
  const steps = [...script]
  fake.onRpc('apply_system_event', (args) => {
    const step = steps.shift() ?? 'store'
    if (step === 'store') return store(fake, args as unknown as StoreArgs)
    if (typeof step === 'string') return { data: null, error: { message: step } }
    return step
  })
}

/** The `plan.generated` calls made so far, with their plan and mode. */
export function storeCalls(fake: FakeSupabase) {
  return fake.rpcs('apply_system_event').map((call) => {
    const args = call.args as unknown as StoreArgs
    const row = args.p_changes[0]?.row
    return {
      client: call.client,
      mode: args.p_event.payload.mode,
      localDay: args.p_event.local_day,
      expected: args.p_expected,
      planDate: row?.plan_date,
      blocks: row?.blocks as unknown as PlanBlock[],
      tracks: row?.roadmap_weeks as unknown as Record<string, TrackSnapshot>,
    }
  })
}
