'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { itemHref } from '@/features/items/href'
import { requireOnboarded } from '@/lib/auth/dal'
import { own } from '@/lib/domain/compare'
import { checkInMinutes } from '@/lib/domain/plan/buildPlan'
import { blocksToAutoCheckIn, blocksWithItem } from '@/lib/domain/plan/checkin'
import type { PlanBlock, StoredPlan } from '@/lib/domain/plan/types'
import { projectEvent, type DomainEvent } from '@/lib/domain/projection/project'
import { RULES_VERSION } from '@/lib/domain/rules'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { applyLearnerEvent, applySystemEvent, EventError, withRetry } from '@/lib/events/apply'
import { derivedWrite } from '@/lib/events/derived'
import { deriveEventId } from '@/lib/events/ids'
import { loadDerivedFor, loadItemStates, type DerivedLoad } from '@/lib/events/load-derived'
import { vi } from '@/lib/i18n/vi'
import { planCatalog } from '@/lib/plans/catalog'
import { currentPlan, type CurrentPlan } from '@/lib/plans/current'
import { readEnrollments, readScheduleVersions, todayOf } from '@/lib/plans/reads'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { autoCheckInKey, checkInKey, outcomeKey } from './event-keys'
import {
  checkInInputSchema,
  checkInPayload,
  isCountedOutcome,
  outcomeEvent,
  outcomeInputSchema,
  type CheckInInput,
  type OutcomeInput,
} from './schema'

type Client = SupabaseClient<Database>

const copy = vi.checkIn
const TODAY_PATH = '/today'

export type CheckInResult = { readonly ok: boolean; readonly message: string }

export type OutcomeResult = {
  readonly ok: boolean
  readonly message: string
  /** Blocks the server checked in automatically after this result (§5.5). */
  readonly autoCheckedIn: readonly string[]
}

/**
 * The learner's today — from a fresh clock, so a retry after `day_changed` works on the new day
 * (RF-1) — and the plan check-ins and results go to on that day (decision 13, `currentPlan`).
 */
async function currentNow(
  supabase: Client,
  userId: string,
): Promise<{ readonly today: LocalDay; readonly current: CurrentPlan | null }> {
  const [versions, enrollments] = await Promise.all([
    readScheduleVersions(supabase, userId),
    readEnrollments(supabase, userId, planCatalog()),
  ])
  const today = todayOf(versions, new Date())
  const active = new Set(
    enrollments
      .filter((enrollment) => enrollment.status === 'active')
      .map((enrollment) => enrollment.trackId),
  )
  return { today, current: await currentPlan(supabase, userId, today, active) }
}

/** The event as `project` reads it (the database fills in `occurred_at` and `local_day`). */
function domainEvent(
  event: Pick<DomainEvent, 'id' | 'type' | 'localDay' | 'payload'> &
    Partial<Pick<DomainEvent, 'trackId' | 'itemId' | 'planId' | 'blockId'>>,
): DomainEvent {
  return {
    occurredAt: new Date().toISOString(),
    trackId: null,
    itemId: null,
    planId: null,
    blockId: null,
    rulesVersion: RULES_VERSION,
    ...event,
  }
}

type Loaded = Awaited<ReturnType<typeof loadDerivedFor>>

/** `project` → `derivedWrite` on `loaded`: the rows `event` changes, with their versions. */
function writeFor({ state, versions }: Loaded, event: DomainEvent) {
  const { state: after, ignored } = projectEvent(state, event, planCatalog())
  return { ignored, write: derivedWrite(state, after, versions) }
}

/** `loadDerivedFor` → `project` → `derivedWrite`. */
async function derivedFor(supabase: Client, userId: string, load: DerivedLoad, event: DomainEvent) {
  return writeFor(await loadDerivedFor(supabase, userId, load), event)
}

/** The parse error's message: the note's own (RF-3), else "invalid". */
function inputError(issues: readonly { readonly message: string }[]): string {
  return issues.some((issue) => issue.message === copy.errors.noteTooLong)
    ? copy.errors.noteTooLong
    : copy.errors.invalid
}

/** One attempt of `checkInBlock`, on the plan current at this attempt's clock. */
async function checkInAttempt(
  supabase: Client,
  userId: string,
  request: CheckInInput,
): Promise<CheckInResult> {
  const { today, current } = await currentNow(supabase, userId)
  const block =
    current?.plan.id === request.planId
      ? current.plan.blocks.find((candidate) => candidate.id === request.blockId)
      : undefined
  // Decision 13: only the plan /today shows now — never yesterday's plan as if it were today's.
  if (block === undefined) return { ok: false, message: copy.errors.stale }

  // One-tap pre-fills the block's minutes (decision 34 of M4); a skip without minutes is 0.
  const minutes = request.minutes ?? (request.status === 'skipped' ? 0 : checkInMinutes(block))
  const payload = checkInPayload({ ...request, minutes })
  const id = deriveEventId(request.requestId, checkInKey({ ...request, minutes }))
  const keys = { planId: request.planId, blockId: block.id, trackId: block.trackId }
  const { write } = await derivedFor(
    supabase,
    userId,
    {
      kind: 'block',
      planId: keys.planId,
      blockId: keys.blockId,
      localDay: today,
      status: payload.status,
    },
    domainEvent({ id, type: 'block.checked_in', localDay: today, payload, ...keys }),
  )
  // `duplicate` (the same tap twice) is success: the first one was recorded.
  await applyLearnerEvent(
    supabase,
    { id, type: 'block.checked_in', payload, localDay: today, ...keys },
    write,
  )
  return { ok: true, message: copy.checkedIn[request.status] }
}

/**
 * A block check-in (§5.5): one-tap (`minutes` omitted = checkInMinutes(block); 0 for a skip) or
 * the sheet (status, minutes, a note of at most 280 graphemes, NFC — RF-3). Each attempt
 * re-derives today and the current plan (decision 13, RF-1), which must still be the plan named —
 * else the answer is "stale" and nothing is written — then loads the rows the check-in reads,
 * projects and applies it (`withRetry`: a version conflict or a day change runs the attempt
 * again). The event id digests the payload (decision 16): the same tap twice is one event.
 * `/today` re-renders whatever the outcome; an EventError becomes its Vietnamese message,
 * anything else reaches the route's error boundary.
 */
export async function checkInBlock(input: CheckInInput): Promise<CheckInResult> {
  const user = await requireOnboarded()
  const parsed = checkInInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: inputError(parsed.error.issues) }
  const supabase = await createClient()
  let result: CheckInResult
  try {
    result = await withRetry(() => checkInAttempt(supabase, user.id, parsed.data))
  } catch (error) {
    if (!(error instanceof EventError)) throw error
    result = { ok: false, message: error.userMessage }
  }
  revalidatePath(TODAY_PATH)
  return result
}

/** The block a result belongs to (decision 14): `blockId` when it lists the item, else the first
 *  block listing it; none when no block of the plan lists it (off-plan study, 5.4). */
function blockFor(plan: StoredPlan, itemId: string, blockId?: string): PlanBlock | undefined {
  const blocks = blocksWithItem(plan, itemId)
  return blocks.find((block) => block.id === blockId) ?? blocks[0]
}

/** The item's outcome does not apply to it (a lesson completion for a problem, a re-add of an
 *  item never studied): nothing is written. */
const NOT_APPLICABLE = Symbol('not applicable')

/** One attempt of `recordOutcome`: the plan it was recorded on, when a block was found. */
async function outcomeAttempt(
  supabase: Client,
  userId: string,
  request: OutcomeInput,
  trackId: string,
): Promise<StoredPlan | null | typeof NOT_APPLICABLE> {
  const { today, current } = await currentNow(supabase, userId)
  const plan = current?.plan ?? null
  const block = plan === null ? undefined : blockFor(plan, request.itemId, request.blockId)
  const placed = plan !== null && block !== undefined ? { planId: plan.id, blockId: block.id } : {}
  const { type, payload } = outcomeEvent(request.outcome)
  const id = deriveEventId(request.requestId, outcomeKey(request))
  const keys = { itemId: request.itemId, trackId, ...placed }
  const { ignored, write } = await derivedFor(
    supabase,
    userId,
    { kind: 'item', itemId: request.itemId, localDay: today, outcome: isCountedOutcome(type) },
    domainEvent({ id, type, localDay: today, payload, ...keys }),
  )
  if (ignored !== null) return NOT_APPLICABLE
  // `duplicate` (the same grade tapped twice) is success: the first one was recorded.
  await applyLearnerEvent(supabase, { id, type, payload, localDay: today, ...keys }, write)
  return block === undefined ? null : plan
}

/**
 * The auto check-in after a result on `planId` (§5.5, decision 15), in its own `withRetry`: each
 * attempt re-derives the current plan (it must still be `planId`, decision 13 — a day start in
 * between may have replaced it) with its block states, reloads the item states of the blocks
 * listing the item, and picks `blocksToAutoCheckIn` of those rows. Each pick is decided again on
 * the rows its write is computed from (`loadDerivedFor`, whose versions the write expects): a
 * learner's check-in that landed after the plan's block states were read — the sheet racing the
 * auto check-in — is seen there and left alone, and one that lands later makes the write conflict
 * and the attempt run again. Written through `apply_system_event` with `auto: true` and the key
 * `auto:<planId>:<blockId>:<minutes>:<itemCount>` (decision 16). The result is already saved: a
 * failure here is logged (its name and message only) and reported with the blocks checked in so
 * far.
 */
async function autoCheckIn(
  supabase: Client,
  userId: string,
  request: OutcomeInput,
  planId: string,
): Promise<{ readonly checked: string[]; readonly failed: boolean }> {
  const checked = new Set<string>()
  let admin: Client | undefined
  try {
    await withRetry(async () => {
      const { today, current } = await currentNow(supabase, userId)
      if (current === null || current.plan.id !== planId) return
      const { plan, blocks } = current
      const itemIds = blocksWithItem(plan, request.itemId).flatMap((block) =>
        block.items.map((item) => item.itemId),
      )
      const items = await loadItemStates(supabase, userId, itemIds)
      for (const block of blocksToAutoCheckIn(plan, blocks, items, request.itemId)) {
        const loaded = await loadDerivedFor(supabase, userId, {
          kind: 'block',
          planId: plan.id,
          blockId: block.id,
          localDay: today,
          status: 'done',
        })
        const due = blocksToAutoCheckIn(plan, loaded.state.blocks, items, request.itemId)
        if (!due.some((candidate) => candidate.id === block.id)) continue

        const minutes = checkInMinutes(block)
        const payload = { status: 'done', minutes, auto: true } as const
        const id = deriveEventId(request.requestId, autoCheckInKey(plan.id, block, minutes))
        const keys = { planId: plan.id, blockId: block.id, trackId: block.trackId }
        const { write } = writeFor(
          loaded,
          domainEvent({ id, type: 'block.checked_in', localDay: today, payload, ...keys }),
        )
        admin ??= createAdminClient()
        const outcome = await applySystemEvent(
          admin,
          userId,
          { id, type: 'block.checked_in', payload, localDay: today, ...keys },
          write,
        )
        if (outcome === 'applied') checked.add(block.id)
      }
    })
  } catch (error) {
    console.error(
      '[checkin] auto check-in failed:',
      error instanceof Error ? `${error.name}: ${error.message}` : typeof error,
    )
    return { checked: [...checked], failed: true }
  }
  return { checked: [...checked], failed: false }
}

/**
 * An item's result (§4.4, §5.5, §5.7; decisions 14–17): each attempt re-derives today and the
 * current plan (decision 13, RF-1), resolves the block — `blockId` when it lists the item, else
 * the first block listing it, else none (off-plan: recorded without a plan until 5.4 attaches
 * it) — loads the item's rows, projects and applies the event (`withRetry`). Then, when a block
 * was found, the auto check-in of the blocks it completed (`autoCheckIn`). The event id digests
 * the payload (decision 16): the same grade twice is one event, another grade a second one.
 * Revalidates `/today` and the item's page — not `/review`, whose card session keeps its own list
 * (5.2c). An EventError becomes its Vietnamese message; anything else reaches the error boundary.
 */
export async function recordOutcome(input: OutcomeInput): Promise<OutcomeResult> {
  const user = await requireOnboarded()
  const parsed = outcomeInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: copy.errors.invalid, autoCheckedIn: [] }
  const request = parsed.data
  const item = own(planCatalog().items, request.itemId)
  if (item === undefined) return { ok: false, message: copy.errors.unknownItem, autoCheckedIn: [] }

  const supabase = await createClient()
  const revalidate = () => {
    revalidatePath(TODAY_PATH)
    revalidatePath(
      itemHref({ trackId: item.trackId, localId: item.id.slice(item.trackId.length + 1) }),
    )
  }
  let recorded: StoredPlan | null | typeof NOT_APPLICABLE
  try {
    recorded = await withRetry(() => outcomeAttempt(supabase, user.id, request, item.trackId))
  } catch (error) {
    if (!(error instanceof EventError)) throw error
    revalidate()
    return { ok: false, message: error.userMessage, autoCheckedIn: [] }
  }
  if (recorded === NOT_APPLICABLE) {
    return { ok: false, message: copy.errors.invalid, autoCheckedIn: [] }
  }

  const auto =
    recorded === null
      ? { checked: [], failed: false }
      : await autoCheckIn(supabase, user.id, request, recorded.id)
  revalidate()
  const message = auto.failed
    ? copy.outcome.savedAutoCheckInFailed
    : auto.checked.length > 0
      ? copy.outcome.savedAndCheckedIn
      : copy.outcome.saved
  return { ok: true, message, autoCheckedIn: auto.checked }
}
