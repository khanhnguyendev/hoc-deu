/**
 * The only way the app writes events (platform design §4.3–§4.5, ADR-0007): learner events go
 * through `apply_event` with the user's own client (RLS applies), system, bot and admin events
 * through `apply_system_event` with the secret-key client. Payloads are validated here first, so
 * an invalid payload never reaches the database; RPC errors become an `EventError` whose
 * `userMessage` is safe to show. A learner event — and the system's auto check-in — may carry its
 * derived rows (`DerivedWrite`, `./derived`) with the versions they were computed from, and then
 * always its `localDay` (ruling M4-R15); a conflict is retried by `withRetry` (§4.4, Part B-M4
 * decision 10). Plans are stored through `./plans`.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  LEARNER_EVENT_TYPES,
  parseEventPayload,
  SYSTEM_EVENT_TYPES,
  type EventPayload,
  type EventType,
  type LearnerEventType,
  type SystemEventType,
} from '@/lib/domain/events'
import { RULES_VERSION } from '@/lib/domain/rules'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { vi } from '@/lib/i18n/vi'
import type { Database, Json } from '@/lib/supabase/database.types'
import type { DerivedWrite } from './derived'

export type ApplyOutcome = 'applied' | 'duplicate'

/** The codes the RPCs raise as the error message, plus `unknown` for anything else. */
export type EventErrorCode =
  | 'quota_exceeded'
  | 'forbidden'
  | 'inactive'
  | 'invalid_event'
  | 'not_implemented'
  | 'invalid_transition'
  | 'track_not_enrolled'
  | 'invalid_timezone'
  | 'ai_personalization_off'
  | 'id_conflict'
  | 'schedule_backdated'
  | 'schedule_in_force'
  | 'too_many_tracks'
  | 'too_many_pending_schedules'
  | 'version_conflict'
  | 'day_changed'
  | 'unknown'

const USER_MESSAGES = {
  quota_exceeded: vi.errors.quotaExceeded,
  forbidden: vi.errors.notAllowed,
  inactive: vi.errors.notAllowed,
  invalid_event: vi.errors.saveFailed,
  not_implemented: vi.errors.saveFailed,
  invalid_transition: vi.errors.invalidTransition,
  track_not_enrolled: vi.errors.invalidTransition,
  invalid_timezone: vi.errors.invalidTimezone,
  ai_personalization_off: vi.errors.saveFailed,
  id_conflict: vi.errors.saveFailed,
  schedule_backdated: vi.errors.saveFailed,
  schedule_in_force: vi.errors.saveFailed,
  too_many_tracks: vi.errors.tooManyTracks,
  too_many_pending_schedules: vi.errors.tooManyPendingSchedules,
  // Retried by withRetry first; shown only when every attempt conflicted.
  version_conflict: vi.errors.saveFailed,
  day_changed: vi.errors.saveFailed,
  unknown: vi.errors.saveFailed,
} as const satisfies Record<EventErrorCode, string>

/** An event the database (or the payload check) rejected. `message` is the code, never user data. */
export class EventError extends Error {
  readonly code: EventErrorCode
  /** Vietnamese, from `vi.errors`: safe to show to the user. */
  readonly userMessage: string

  constructor(code: EventErrorCode, options?: ErrorOptions) {
    super(code, options)
    this.name = 'EventError'
    this.code = code
    this.userMessage = USER_MESSAGES[code]
  }
}

export type EventInput<T extends EventType> = {
  id: string
  type: T
  payload: EventPayload<T>
  trackId?: string
  itemId?: string
  planId?: string
  blockId?: string
  /**
   * The local day the caller computed the event's derived rows for (decision 10): the database
   * raises `day_changed` when its own local day for the event differs.
   */
  localDay?: LocalDay
}

/**
 * An event sent with its derived rows: the local day they were computed for is required
 * (decision 10, ruling M4-R15), so a derived write can never skip the `day_changed` check.
 */
export type DerivedEventInput<T extends EventType> = EventInput<T> & { localDay: LocalDay }

/** A system, bot or admin event: `source` defaults to `system`, `actorId` to the user. */
export type SystemEventInput<T extends SystemEventType> = EventInput<T> & {
  source?: 'system' | 'bot' | 'admin'
  actorId?: string
}

/** The RPC error message is the code (`raise exception '<code>'`); anything else is `unknown`. */
function codeOf(message: string): EventErrorCode {
  return Object.hasOwn(USER_MESSAGES, message) ? (message as EventErrorCode) : 'unknown'
}

/** An RPC error as an `EventError` (its message is the code). */
export function eventErrorOf(error: { message: string }): EventError {
  return new EventError(codeOf(error.message), { cause: error })
}

/** `p_event` for the RPCs: snake_case keys, the validated payload and `rules_version`. */
function eventBody(
  event: EventInput<EventType>,
  types: readonly EventType[],
): Record<string, Json> {
  if (!types.includes(event.type)) {
    throw new EventError('invalid_event')
  }
  let payload: EventPayload<EventType>
  try {
    payload = parseEventPayload(event.type, event.payload)
  } catch (cause) {
    throw new EventError('invalid_event', { cause })
  }
  const body: Record<string, Json> = { id: event.id, type: event.type }
  if (event.trackId !== undefined) body.track_id = event.trackId
  if (event.itemId !== undefined) body.item_id = event.itemId
  if (event.planId !== undefined) body.plan_id = event.planId
  if (event.blockId !== undefined) body.block_id = event.blockId
  if (event.localDay !== undefined) body.local_day = event.localDay
  // A parsed payload is plain JSON (parseEventPayload checks it is storable as jsonb).
  body.payload = payload as Json
  body.rules_version = RULES_VERSION
  return body
}

/**
 * `p_changes` and `p_expected` for a derived write, none without one. The types already require
 * `localDay` with a derived write (M4-R15); this also refuses a caller that casts it away.
 */
function derivedArgs(
  event: EventInput<EventType>,
  derived: DerivedWrite | undefined,
): { p_changes?: Json; p_expected?: Json } {
  if (derived === undefined) return {}
  if (event.localDay === undefined) {
    throw new EventError('invalid_event')
  }
  return { p_changes: derived.changes, p_expected: derived.expected }
}

function outcomeOf(data: Json | null, error: { message: string } | null): ApplyOutcome {
  if (error) {
    throw eventErrorOf(error)
  }
  const outcome =
    data !== null && typeof data === 'object' && !Array.isArray(data) ? data.outcome : undefined
  if (outcome === 'applied' || outcome === 'duplicate') return outcome
  throw new EventError('unknown')
}

/**
 * Records a learner event and applies its state change, as the signed-in user (`apply_event`),
 * with its derived rows when given (`derivedWrite`, `./derived`) — and then the event's `localDay`
 * (M4-R15). `duplicate` means an event with this id was already recorded; nothing changed. A
 * derived row another write changed first raises `version_conflict`: reload, recompute and call
 * again (`withRetry`).
 */
export function applyLearnerEvent<T extends LearnerEventType>(
  supabase: SupabaseClient<Database>,
  event: EventInput<T>,
): Promise<ApplyOutcome>
export function applyLearnerEvent<T extends LearnerEventType>(
  supabase: SupabaseClient<Database>,
  event: DerivedEventInput<T>,
  derived: DerivedWrite,
): Promise<ApplyOutcome>
export async function applyLearnerEvent(
  supabase: SupabaseClient<Database>,
  event: EventInput<LearnerEventType>,
  derived?: DerivedWrite,
): Promise<ApplyOutcome> {
  const p_event = eventBody(event, LEARNER_EVENT_TYPES)
  const { data, error } = await supabase.rpc('apply_event', {
    p_event,
    ...derivedArgs(event, derived),
  })
  return outcomeOf(data, error)
}

const RETRYABLE: ReadonlySet<EventErrorCode> = new Set(['version_conflict', 'day_changed'])

/**
 * Whether reloading the derived rows, recomputing and applying again can succeed: another write
 * changed a row first (`version_conflict`), or the request crossed the day start (`day_changed`).
 */
export function isRetryable(error: unknown): boolean {
  return error instanceof EventError && RETRYABLE.has(error.code)
}

/**
 * Runs `attempt` — which reloads, recomputes and applies — again after a retryable error, at most
 * `attempts` times in all (§4.4: 3); any other error, or the last attempt's, is rethrown.
 */
export async function withRetry<T>(attempt: () => Promise<T>, attempts = 3): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt()
    } catch (error) {
      if (tries >= attempts || !isRetryable(error)) throw error
    }
  }
}

/**
 * `p_event` for `apply_system_event`: the validated payload, snake_case keys, `source` and
 * `actor_id` when given. For callers whose outcomes go beyond applied / duplicate (`storePlan`).
 */
export function systemEventBody<T extends SystemEventType>(
  event: SystemEventInput<T>,
): Record<string, Json> {
  const p_event = eventBody(event, SYSTEM_EVENT_TYPES)
  if (event.source !== undefined) p_event.source = event.source
  if (event.actorId !== undefined) p_event.actor_id = event.actorId
  return p_event
}

/**
 * Records a system, bot or admin event for `userId` (`apply_system_event`), with its derived rows
 * when given — the auto check-in (§5.5) — and then the event's `localDay` (M4-R15). `admin` must
 * be the secret-key client; the caller has already checked who may do this (DAL guard).
 */
export function applySystemEvent<T extends SystemEventType>(
  admin: SupabaseClient<Database>,
  userId: string,
  event: SystemEventInput<T>,
): Promise<ApplyOutcome>
export function applySystemEvent<T extends SystemEventType>(
  admin: SupabaseClient<Database>,
  userId: string,
  event: SystemEventInput<T> & DerivedEventInput<T>,
  derived: DerivedWrite,
): Promise<ApplyOutcome>
export async function applySystemEvent(
  admin: SupabaseClient<Database>,
  userId: string,
  event: SystemEventInput<SystemEventType>,
  derived?: DerivedWrite,
): Promise<ApplyOutcome> {
  const p_event = systemEventBody(event)
  const { data, error } = await admin.rpc('apply_system_event', {
    p_user_id: userId,
    p_event,
    ...derivedArgs(event, derived),
  })
  return outcomeOf(data, error)
}
