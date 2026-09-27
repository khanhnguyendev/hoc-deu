/**
 * `/today`'s plan (platform design §2.3, §5.2, §5.4; Part B-M5 decisions 5–10): `ensureToday`
 * returns today's plan — building and storing it on the first visit of the day while the gate is
 * open — or the state that stands in for it. It runs in the `/today` render (decision 6): the only
 * write is `plan.generated`, which is idempotent (one plan per date, `plan_exists`). It never marks
 * a plan seen; only the browser does (§5.2, ADR-0039).
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlanCatalog } from '@/lib/domain/catalog'
import { buildPlan } from '@/lib/domain/plan/buildPlan'
import type { Enrollment, PlanBlock, StoredPlan } from '@/lib/domain/plan/types'
import type { BlockState, ItemState } from '@/lib/domain/state'
import type { LocalDay, ScheduleVersion } from '@/lib/domain/time/localDay'
import { EventError } from '@/lib/events/apply'
import { storePlan } from '@/lib/events/plans'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { loadDay, planContext, resolveDay, storable, type Day } from './day'
import { readBlockStates, readPlan, readPlanById, type PlanRead } from './reads'
import { assertSessionUser } from './session'

type Client = SupabaseClient<Database>

export type TodayState =
  | {
      readonly kind: 'plan'
      readonly plan: StoredPlan
      readonly blocks: Readonly<Record<string, BlockState>>
    }
  /** Gate open with resumedToday (decision 32 of M4): the last seen plan is today's work. */
  | {
      readonly kind: 'resumed'
      readonly plan: StoredPlan
      readonly blocks: Readonly<Record<string, BlockState>>
    }
  | {
      readonly kind: 'paused'
      readonly plan: StoredPlan
      readonly unfinished: readonly PlanBlock[]
      readonly blocks: Readonly<Record<string, BlockState>>
      readonly daysSince: number
      readonly offerResume: boolean
    }
  | { readonly kind: 'notStarted'; readonly startDate: LocalDay }
  | { readonly kind: 'noTracks' }
  /** Today's stored plan cannot be read and is in use (M-4, decision 10). */
  | { readonly kind: 'unreadable' }

export type TodayData = {
  readonly today: LocalDay
  readonly now: string
  readonly state: TodayState
  readonly catalog: PlanCatalog
  readonly enrollments: readonly Enrollment[]
  readonly items: Readonly<Record<string, ItemState>>
  readonly versions: readonly ScheduleVersion[]
}

/** How many times a build that crossed the day start starts again (decision 9), then throws. */
const DAY_RETRIES = 2

/** The local day changed under the attempt: start again at step 1 with a fresh clock. */
const DAY_CHANGED = Symbol('day changed')
type Attempt = TodayState | typeof DAY_CHANGED

const isDayChanged = (error: unknown) => error instanceof EventError && error.code === 'day_changed'

/** Today's plan with its block states. */
async function planState(supabase: Client, plan: StoredPlan): Promise<TodayState> {
  return { kind: 'plan', plan, blocks: await readBlockStates(supabase, [plan.id]) }
}

/**
 * Today's stored row (§5.4 step 1). Unreadable (M-4, decision 10): rebuilt at its version — which
 * `apply_system_event` does only while the plan is untouched (no check-in, no event naming it but
 * its generation) — and read again. A `version_conflict` (another request changed the row) reads
 * the row once more and shows it when it is readable now. In use, or the rebuild fails: the
 * `unreadable` state.
 */
async function fromTodaysRow(
  supabase: Client,
  userId: string,
  day: Day,
  read: PlanRead,
): Promise<Attempt> {
  if (read.plan !== null) return planState(supabase, read.plan)

  const plan = storable(buildPlan(await planContext(supabase, userId, day)))
  let stored: Awaited<ReturnType<typeof storePlan>>
  try {
    stored = await storePlan(createAdminClient(), userId, {
      eventId: crypto.randomUUID(),
      plan,
      mode: 'rebuild',
      expectedVersion: read.row.version,
    })
  } catch (error) {
    if (!(error instanceof EventError)) throw error
    if (isDayChanged(error)) return DAY_CHANGED
    if (error.code === 'version_conflict') {
      // Another request rebuilt or changed the row meanwhile: show it if it can be read now.
      const current = (await readPlan(supabase, userId, day.today))?.plan ?? null
      if (current !== null) return planState(supabase, current)
    }
    return { kind: 'unreadable' }
  }
  if (stored.outcome !== 'applied' || stored.planId === null) return { kind: 'unreadable' }
  const rebuilt = (await readPlanById(supabase, userId, stored.planId))?.plan ?? null
  if (rebuilt === null || rebuilt.planDate !== day.today) return { kind: 'unreadable' }
  return planState(supabase, rebuilt)
}

/**
 * §5.4 step 5–6: build today's plan, validate it, store it (the secret-key client, a random event
 * id — decision 8), and read the stored plan back by id: it must be today's (M4-R21). An empty
 * plan is stored like any plan — it keeps the gate open tomorrow (RF-4).
 */
async function buildToday(supabase: Client, userId: string, day: Day): Promise<Attempt> {
  const plan = storable(buildPlan(await planContext(supabase, userId, day)))
  let stored: Awaited<ReturnType<typeof storePlan>>
  try {
    stored = await storePlan(createAdminClient(), userId, {
      eventId: crypto.randomUUID(),
      plan,
      mode: 'baseline',
      expectedVersion: 0,
    })
  } catch (error) {
    if (isDayChanged(error)) return DAY_CHANGED
    throw error
  }
  // `applied` or `plan_exists` (a concurrent build): both name the stored plan. A random event
  // id is never a `duplicate`, and a baseline write is never `plan_in_use`.
  if (stored.planId === null || stored.outcome === 'plan_in_use') {
    throw new Error(`ensureToday: unexpected plan write outcome ${stored.outcome}`)
  }
  const read = await readPlanById(supabase, userId, stored.planId)
  if (read === null) throw new Error('ensureToday: the stored plan cannot be read back')
  // M4-R21's TypeScript half: a plan of another day means the request crossed the day start.
  if (read.row.plan_date !== day.today) return DAY_CHANGED
  return fromTodaysRow(supabase, userId, day, read)
}

async function attempt(supabase: Client, userId: string, day: Day): Promise<Attempt> {
  const resolution = await resolveDay(supabase, userId, day)
  switch (resolution.kind) {
    case 'today':
      return fromTodaysRow(supabase, userId, day, resolution.read)
    case 'open':
      return buildToday(supabase, userId, day)
    default:
      return resolution
  }
}

/**
 * §5.4 steps 1–4 for the signed-in learner `userId` (the caller ran requireOnboarded): today's
 * plan (built on the first visit while the gate is open), or the paused, resumed, not-started,
 * no-tracks or unreadable state. The session client reads (RLS); the secret-key client only
 * stores the plan. A `day_changed`, or a stored plan of another day, starts again with a fresh
 * clock — at most `DAY_RETRIES` times, then it throws (decision 9).
 */
export async function ensureToday(userId: string, now: Date = new Date()): Promise<TodayData> {
  await assertSessionUser(userId)
  const supabase = await createClient()
  for (let tries = 0; tries <= DAY_RETRIES; tries += 1) {
    const day = await loadDay(supabase, userId, tries === 0 ? now : new Date())
    const state = await attempt(supabase, userId, day)
    if (state !== DAY_CHANGED) {
      return {
        today: day.today,
        now: day.clock.toISOString(),
        state,
        catalog: day.catalog,
        enrollments: day.enrollments,
        items: day.items,
        versions: day.versions,
      }
    }
  }
  throw new Error('ensureToday: the local day changed under every attempt (decision 9)')
}
