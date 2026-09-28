/**
 * "Học thêm" and off-plan study on the server (platform design §5.9; Part B-M5 decisions 15, 16,
 * 20–22): both append items to a track's `extra` block of the plan the dashboard shows, through
 * `plan.extra_added` (`addExtraItems`, secret key) at the plan's version — `withRetry` reloads the
 * plan and recomputes on a `version_conflict` or a `day_changed`. The event ids repeat exactly when
 * the same work repeats (decision 16): "Học thêm" `extra:<planId>:<trackId>` (a double tap adds
 * once — the second is a `duplicate`), the attachment `offplan:<planId>:<itemId>`. Server-only;
 * the entry points check the session user first (decision 5) and call no guard themselves.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isCustomItemId, type ItemMode } from '@/lib/domain/catalog'
import { own } from '@/lib/domain/compare'
import { blocksWithItem } from '@/lib/domain/plan/checkin'
import {
  extraBlockOf,
  extraCandidates,
  freshExtraBlockNeeded,
  withExtraItems,
} from '@/lib/domain/plan/extra'
import { planBlockSchema, type StoredPlan } from '@/lib/domain/plan/types'
import type { BlockState } from '@/lib/domain/state'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { withRetry } from '@/lib/events/apply'
import { deriveEventId } from '@/lib/events/ids'
import { loadItemStates } from '@/lib/events/load-derived'
import { addExtraItems } from '@/lib/events/plans'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { planCatalog } from './catalog'
import { currentPlan } from './current'
import { catalogWith, loadDay } from './day'
import { readEnrollments, readScheduleVersions, readUserItems, todayOf } from './reads'
import { assertSessionUser } from './session'
import { ensureToday } from './today'

type Client = SupabaseClient<Database>

/**
 * `added` (also when the same tap was already recorded: `duplicate`), `nothing_to_add` (the
 * track's queue is empty), `throttled` (the plan's snapshot caps the track at 0 new items, §5.5),
 * `no_plan` (no plan the dashboard shows as today's work: none yet, or the paused view).
 */
export type ExtraOutcome = 'added' | 'nothing_to_add' | 'throttled' | 'no_plan'

/**
 * "Học thêm" for `trackId` on the current plan (decision 20) — kinds `today` and `resumed`, never
 * the paused view — for the signed-in learner `userId` (the caller ran requireOnboarded). Each
 * attempt loads the day (`loadDay`: every item state, so the queue skips introduced items),
 * re-derives the plan (`currentPlan`), recomputes the candidates (`extraCandidates`) and appends
 * them with the plan's version; a retry reads the clock again.
 */
export async function addExtraForTrack(
  userId: string,
  trackId: string,
  requestId: string,
  now: Date = new Date(),
): Promise<ExtraOutcome> {
  await assertSessionUser(userId)
  const supabase = await createClient()
  let tries = 0
  return withRetry(async () => {
    const day = await loadDay(supabase, userId, tries === 0 ? now : new Date())
    tries += 1
    const current = await currentPlan(supabase, userId, day.today, day.activeTrackIds)
    if (current === null || current.kind === 'paused') return 'no_plan'
    const { plan } = current
    if (own(plan.tracks, trackId)?.newPerDay === 0) return 'throttled'
    const ctx = {
      planDate: day.today,
      catalog: day.catalog,
      enrollments: day.enrollments,
      items: day.items,
      recapDone: {},
    }
    const items = extraCandidates(ctx, plan, trackId)
    if (items.length === 0) return 'nothing_to_add'
    await addExtraItems(createAdminClient(), userId, {
      eventId: deriveEventId(requestId, `extra:${plan.id}:${trackId}`),
      planId: plan.id,
      planDate: plan.planDate,
      trackId,
      block: withExtraItems(plan, trackId, items),
      itemIds: items.map((item) => item.itemId),
      expectedVersion: plan.version,
      localDay: day.today,
    })
    return 'added'
  })
}

/** Where an item studied now is attached (decision 21): the plan, with what the paused view needs
 *  to know about it (M-3). */
type Target = {
  readonly plan: StoredPlan
  readonly today: LocalDay
  /** The plan is the paused one: its blocks of tracks not `active` are hidden (M-5 A). */
  readonly paused: boolean
  readonly blocks: Readonly<Record<string, BlockState>>
  /** The tracks of the learner's `active` enrollments. */
  readonly active: ReadonlySet<string>
}

/**
 * The plan an item studied now belongs to (decision 21): the current plan (decision 13) — today's,
 * the paused plan while the gate is closed, the resumed one — and, when there is none yet,
 * today's plan built by `ensureToday`. Null when there is no plan to show (no active track, every
 * track starting later, an unreadable plan of today).
 */
async function planToAttach(supabase: Client, userId: string, clock: Date): Promise<Target | null> {
  const [versions, enrollments] = await Promise.all([
    readScheduleVersions(supabase, userId),
    readEnrollments(supabase, userId, planCatalog()),
  ])
  const today = todayOf(versions, clock)
  const active = new Set(
    enrollments
      .filter((enrollment) => enrollment.status === 'active')
      .map((enrollment) => enrollment.trackId),
  )
  const current = await currentPlan(supabase, userId, today, active)
  if (current !== null) {
    const { plan, blocks } = current
    return { plan, today, paused: current.kind === 'paused', blocks, active }
  }
  if (active.size === 0) return null
  const built = await ensureToday(userId, clock)
  const { state } = built
  return state.kind === 'plan' || state.kind === 'paused' || state.kind === 'resumed'
    ? {
        plan: state.plan,
        today: built.today,
        paused: state.kind === 'paused',
        blocks: state.blocks,
        active,
      }
    : null
}

/**
 * M-3 (ruling M5-R36): whether the item of `trackId` goes to a fresh extra block — only on the
 * paused plan, for a track that is not active (the paused view hides its blocks), whose latest
 * extra block would not be checked in after the item's result (`freshExtraBlockNeeded`, on the
 * item states of that block, read here).
 */
async function freshBlockNeeded(
  supabase: Client,
  userId: string,
  target: Target,
  trackId: string,
): Promise<boolean> {
  if (!target.paused || target.active.has(trackId)) return false
  const extra = extraBlockOf(target.plan, trackId)
  if (extra === undefined) return false
  const itemIds = extra.items.map((entry) => entry.itemId)
  const items = await loadItemStates(supabase, userId, itemIds)
  return freshExtraBlockNeeded(target.plan, trackId, target.blocks, items)
}

/**
 * Off-plan study (decision 21, §5.9): attaches `itemId` in `mode` (its minutes in that mode) to
 * its track's latest extra block of the plan it belongs to (`planToAttach`) — building today's
 * plan first when there is none — and answers where it landed. An item a block of that plan
 * already lists (an extra block included) is answered with that block and added nothing: a second
 * call for one item never adds it twice. On the paused plan, a track the paused view hides gets a
 * fresh extra block when its latest one cannot count by itself (`freshBlockNeeded`, M-3), so the
 * study is checked in and counts. Null — nothing attached — for an unknown item, without a plan,
 * and when the extra block cannot hold it (`planBlockSchema`'s bounds). The auto check-in that
 * follows (decision 15) is the caller's (`recordOutcome`). A custom item (`user:…`, task 6.6a) is
 * looked up in the learner's overlay (`catalogWith`, decision 17): studying it from its page is
 * how the "Mục riêng" tab schedules it (§5.12).
 */
export async function attachOffPlan(
  userId: string,
  itemId: string,
  mode: ItemMode,
  requestId: string,
  now: Date = new Date(),
): Promise<{ readonly planId: string; readonly blockId: string } | null> {
  await assertSessionUser(userId)
  const supabase = await createClient()
  const catalog = isCustomItemId(itemId)
    ? catalogWith(await readUserItems(supabase, userId))
    : planCatalog()
  const item = own(catalog.items, itemId)
  if (item === undefined) return null
  let tries = 0
  return withRetry(async () => {
    const found = await planToAttach(supabase, userId, tries === 0 ? now : new Date())
    tries += 1
    if (found === null) return null
    const { plan, today } = found
    const listed = blocksWithItem(plan, itemId)[0]
    if (listed !== undefined) return { planId: plan.id, blockId: listed.id }

    const fresh = await freshBlockNeeded(supabase, userId, found, item.trackId)
    const block = withExtraItems(
      plan,
      item.trackId,
      [{ itemId, mode, minutes: item.minutes[mode] }],
      { fresh },
    )
    if (!planBlockSchema.safeParse(block).success) return null
    await addExtraItems(createAdminClient(), userId, {
      eventId: deriveEventId(requestId, `offplan:${plan.id}:${itemId}`),
      planId: plan.id,
      planDate: plan.planDate,
      trackId: item.trackId,
      block,
      itemIds: [itemId],
      expectedVersion: plan.version,
      localDay: today,
    })
    return { planId: plan.id, blockId: block.id }
  })
}
