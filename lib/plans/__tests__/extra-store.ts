/**
 * `plan.extra_added` as `apply_system_event` answers it (20260927000100, decision 22), in the
 * fake's tables, for the "Học thêm" and off-plan tests (task 5.4): a known event id is
 * `duplicate`; the plan must be the user's, at the expected version (`version_conflict`); the
 * block must be the track's extra block holding the stored extra block's items, in order, then
 * exactly `payload.itemIds` (`invalid_event`); the event's `local_day` must be the database's
 * (`day_changed`). Then the block replaces the stored one (or is appended), the plan's version is
 * n + 1 and the event is stored with the plan's id. `planEvents` joins it with `planStore`'s
 * `plan.generated` (`./fixtures`), so an action that builds today's plan first works too.
 */
import type { PlanBlock } from '@/lib/domain/plan/types'
import { localDay, scheduleAt, type LocalDay } from '@/lib/domain/time/localDay'
import type { EventErrorCode } from '@/lib/events/apply'
import type { Json } from '@/lib/supabase/database.types'
import type { FakeSupabase, RpcAnswer, RpcHandler } from '@/lib/testing/fake-supabase'
import { eventRow, planStore } from './fixtures'

type ExtraArgs = {
  readonly p_user_id: string
  readonly p_event: {
    readonly id: string
    readonly type: string
    readonly plan_id?: string
    readonly track_id?: string
    readonly local_day?: LocalDay
    readonly payload: { readonly itemIds?: readonly string[] }
  }
  readonly p_changes: readonly { readonly table: string; readonly row: PlanBlock }[]
  readonly p_expected: Readonly<Record<string, number>>
}

const answer = (data: unknown): RpcAnswer => ({ data, error: null })
const raise = (code: string): RpcAnswer => ({ data: null, error: { message: code } })

/** The user's local day now, as the `events` trigger computes it. */
function databaseDay(fake: FakeSupabase, userId: string): LocalDay {
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

/** `plan.extra_added` (decision 22) in `fake`'s tables. */
export function extraAdded(fake: FakeSupabase, raw: Record<string, unknown>): RpcAnswer {
  const args = raw as unknown as ExtraArgs
  const { p_user_id: userId, p_event: event } = args
  const itemIds = event.payload.itemIds ?? []
  const plan = (fake.tables.day_plans ?? []).find(
    (row) => row.id === event.plan_id && row.user_id === userId,
  )
  if (event.type !== 'plan.extra_added' || plan === undefined || event.track_id === undefined) {
    return raise('invalid_event')
  }
  const events = (fake.tables.events ??= [])
  if (events.some((row) => row.id === event.id)) {
    return answer({ outcome: 'duplicate', versions: {} })
  }
  const key = `day_plans:${plan.plan_date}`
  if (args.p_expected[key] !== plan.version) return raise('version_conflict')

  const block = args.p_changes[0]?.row
  const blockId = `${plan.plan_date}:${event.track_id}:extra:1`
  const blocks = plan.blocks as unknown as PlanBlock[]
  const index = blocks.findIndex((candidate) => candidate.id === blockId)
  const before = index === -1 ? [] : (blocks[index]?.items ?? [])
  if (
    block === undefined ||
    block.id !== blockId ||
    block.kind !== 'extra' ||
    block.trackId !== event.track_id ||
    JSON.stringify(block.items) !==
      JSON.stringify([...before, ...block.items.slice(before.length)]) ||
    JSON.stringify(block.items.slice(before.length).map((item) => item.itemId)) !==
      JSON.stringify(itemIds)
  ) {
    return raise('invalid_event')
  }
  const day = databaseDay(fake, userId)
  if (event.local_day !== undefined && event.local_day !== day) return raise('day_changed')

  plan.blocks = (index === -1
    ? [...blocks, block]
    : blocks.map((stored, at) => (at === index ? block : stored))) as unknown as Json
  plan.version += 1
  events.push(
    eventRow({
      id: event.id,
      user_id: userId,
      actor_id: userId,
      type: 'plan.extra_added',
      track_id: event.track_id,
      plan_id: plan.id,
      payload: { itemIds: [...itemIds] },
      local_day: day,
      occurred_at: new Date().toISOString(),
    }),
  )
  return answer({ outcome: 'applied', plan_id: plan.id, versions: { [key]: plan.version } })
}

/** A step of `planEvents`' script: raise a code, or run a hook first (another request landing). */
export type PlanEventStep = EventErrorCode | ((args: Record<string, unknown>) => void)

/**
 * The plan types of `apply_system_event` in `fake`: `plan.generated` as `planStore` answers it,
 * `plan.extra_added` as `extraAdded`. The first calls take `script`'s steps in turn. Returns the
 * handler, for a test store that answers other types too (`features/checkin`'s event store).
 */
export function planEvents(fake: FakeSupabase, script: readonly PlanEventStep[] = []): RpcHandler {
  // planStore registers its handler with `onRpc`: catch it, over the same tables.
  const caught = new Map<string, RpcHandler>()
  planStore({
    ...fake,
    onRpc: (name: string, handler: RpcHandler) => caught.set(name, handler),
  } as FakeSupabase)
  const generated = caught.get('apply_system_event')
  const steps = [...script]
  return (args) => {
    const step = steps.shift()
    if (typeof step === 'string') return raise(step)
    step?.(args)
    const type = (args.p_event as { type?: string } | undefined)?.type
    if (type === 'plan.extra_added') return extraAdded(fake, args)
    if (type === 'plan.generated' && generated !== undefined) return generated(args)
    return raise('invalid_event')
  }
}

/** `planEvents` as the fake's `apply_system_event`. */
export function planEventStore(fake: FakeSupabase, script: readonly PlanEventStep[] = []): void {
  fake.onRpc('apply_system_event', planEvents(fake, script))
}
