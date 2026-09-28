/**
 * A learner's roadmap overrides in the database (platform design §4.1 `roadmap_overrides`, §5.12,
 * §6.4.5; Part B-M6 decisions 18, 33; ruling M6-R17; task 6.6c), through `apply_system_event` with
 * the secret-key client. `roadmap.override_set` is the bot's (`source: 'bot'`, after
 * `requireBotToken` and `resolveRunUser`); `roadmap.override_revoked` is either the bot's
 * (`source: 'bot'` — the database records `revoked_by = 'bot'`, and the bot may set that key again)
 * or the learner's ("Thu hồi" in `/settings`, after `requireOnboarded`: `source: 'system'`, the
 * learner as the actor — `revoked_by = 'learner'`, final: the bot gets `revoked_key` for it). The
 * database takes the per-user-and-track lock and checks the AI flag (the bot's writes),
 * `bot_settings.dry_run`, the enrollment, the counts (`limits.perTrack`, one active extra week) and
 * the 21-day cooldown.
 *
 * `applied` — written (a replayed event id, `duplicate`, was written before: applied too);
 * `unchanged` — nothing to do (the same override in force, or one already revoked); anything else
 * is an `EventError` with the database's code (`limit_reached`, `cooldown`, `revoked_key`,
 * `not_enrolled`, `ai_off`, `invalid_event`, `day_changed`, …). Server-only.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RoadmapOverride } from '@/lib/domain/plan/overrides'
import type { LocalDay } from '@/lib/domain/time/localDay'
import type { Database, Json } from '@/lib/supabase/database.types'
import { EventError, eventErrorOf, systemEventBody } from './apply'

type Client = SupabaseClient<Database>

export type OverrideWriteOutcome = 'applied' | 'unchanged'

function outcomeOf(data: Json | null, error: { message: string } | null): OverrideWriteOutcome {
  if (error) throw eventErrorOf(error)
  const outcome =
    data !== null && typeof data === 'object' && !Array.isArray(data) ? data.outcome : undefined
  if (outcome === 'applied' || outcome === 'duplicate') return 'applied'
  if (outcome === 'unchanged') return 'unchanged'
  throw new EventError('unknown')
}

/** The row columns SQL keeps beside the params: `until` for an insert block, the study days for
 *  an extra week (checked there under the lock). */
function rowOf(override: RoadmapOverride, runKey: string): Record<string, Json> {
  switch (override.kind) {
    case 'insert_block':
      return { until_local_day: override.params.until, created_by_run: runKey }
    case 'extra_week':
      return { study_days: override.params.studyDays, created_by_run: runKey }
    case 'reorder_topics':
      return { created_by_run: runKey }
  }
}

/**
 * `roadmap.override_set` (§6.4.5): `override` already validated (`validateOverride`, 6.6b);
 * `localDay` the learner's day it was validated for (`day_changed` when the request crossed the
 * day start); `perTrack` the effective active-override limit (`effectiveLimits`).
 */
export async function setOverride(
  admin: Client,
  userId: string,
  input: {
    readonly eventId: string
    readonly runKey: string
    readonly override: RoadmapOverride
    readonly localDay: LocalDay
    readonly perTrack: number
  },
): Promise<OverrideWriteOutcome> {
  const { override } = input
  const p_event = systemEventBody({
    id: input.eventId,
    type: 'roadmap.override_set',
    source: 'bot',
    trackId: override.trackId,
    localDay: input.localDay,
    payload: {
      key: override.key,
      kind: override.kind,
      params: override.params as unknown as Record<string, Json>,
    },
  })
  p_event.limits = { perTrack: input.perTrack }
  const { data, error } = await admin.rpc('apply_system_event', {
    p_user_id: userId,
    p_event,
    p_changes: [{ table: 'roadmap_overrides', row: rowOf(override, input.runKey) }],
    p_expected: {},
  })
  return outcomeOf(data, error)
}

/**
 * `roadmap.override_revoked`: the user's own override `(trackId, key)` of its stored `kind`, by
 * the bot or by the learner (`by`; ruling M6-R17). Takes effect from the next plan (§5.9): no plan
 * is rebuilt here.
 */
export async function revokeOverride(
  admin: Client,
  userId: string,
  input: {
    readonly eventId: string
    readonly trackId: string
    readonly key: string
    readonly kind: RoadmapOverride['kind']
    readonly by: 'bot' | 'learner'
  },
): Promise<OverrideWriteOutcome> {
  const p_event = systemEventBody({
    id: input.eventId,
    type: 'roadmap.override_revoked',
    ...(input.by === 'bot'
      ? { source: 'bot' as const }
      : { source: 'system' as const, actorId: userId }),
    trackId: input.trackId,
    payload: { key: input.key, kind: input.kind },
  })
  const { data, error } = await admin.rpc('apply_system_event', { p_user_id: userId, p_event })
  return outcomeOf(data, error)
}
