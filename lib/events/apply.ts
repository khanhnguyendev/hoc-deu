/**
 * The only way the app writes events (platform design §4.3–§4.5, ADR-0007): learner events go
 * through `apply_event` with the user's own client (RLS applies), system, bot and admin events
 * through `apply_system_event` with the secret-key client. Payloads are validated here first, so
 * an invalid payload never reaches the database; RPC errors become an `EventError` whose
 * `userMessage` is safe to show.
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
import { vi } from '@/lib/i18n/vi'
import type { Database, Json } from '@/lib/supabase/database.types'

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
}

/** The RPC error message is the code (`raise exception '<code>'`); anything else is `unknown`. */
function codeOf(message: string): EventErrorCode {
  return Object.hasOwn(USER_MESSAGES, message) ? (message as EventErrorCode) : 'unknown'
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
  // A parsed payload is plain JSON (parseEventPayload checks it is storable as jsonb).
  body.payload = payload as Json
  body.rules_version = RULES_VERSION
  return body
}

function outcomeOf(data: Json | null, error: { message: string } | null): ApplyOutcome {
  if (error) {
    throw new EventError(codeOf(error.message), { cause: error })
  }
  const outcome =
    data !== null && typeof data === 'object' && !Array.isArray(data) ? data.outcome : undefined
  if (outcome === 'applied' || outcome === 'duplicate') return outcome
  throw new EventError('unknown')
}

/**
 * Records a learner event and applies its state change, as the signed-in user (`apply_event`).
 * `duplicate` means an event with this id was already recorded; nothing changed.
 */
export async function applyLearnerEvent<T extends LearnerEventType>(
  supabase: SupabaseClient<Database>,
  event: EventInput<T>,
): Promise<ApplyOutcome> {
  const p_event = eventBody(event, LEARNER_EVENT_TYPES)
  const { data, error } = await supabase.rpc('apply_event', { p_event })
  return outcomeOf(data, error)
}

/**
 * Records a system, bot or admin event for `userId` (`apply_system_event`). `admin` must be the
 * secret-key client; the caller has already checked who may do this (DAL guard).
 */
export async function applySystemEvent<T extends SystemEventType>(
  admin: SupabaseClient<Database>,
  userId: string,
  event: EventInput<T> & { source?: 'system' | 'bot' | 'admin'; actorId?: string },
): Promise<ApplyOutcome> {
  const p_event = eventBody(event, SYSTEM_EVENT_TYPES)
  if (event.source !== undefined) p_event.source = event.source
  if (event.actorId !== undefined) p_event.actor_id = event.actorId
  const { data, error } = await admin.rpc('apply_system_event', { p_user_id: userId, p_event })
  return outcomeOf(data, error)
}
