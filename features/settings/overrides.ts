/**
 * The learner's AI roadmap overrides for `/settings` (§2.4, §5.12 "Learner control"; task 6.6c):
 * read with the session client (RLS: own rows), described in Vietnamese, and — on a roadmap
 * variant change — the track's reorders revoked (carried item (c): a reorder was checked against
 * the roadmap it was set for, so it never applies to another variant's). No guard of their own:
 * the callers (`getSettingsData`, the settings actions) are guarded.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTrack } from '@/lib/content/tracks'
import { overrideActive, type RoadmapOverride } from '@/lib/domain/plan/overrides'
import type { LocalDay } from '@/lib/domain/time/localDay'
import { deriveEventId } from '@/lib/events/ids'
import { revokeOverride } from '@/lib/events/overrides'
import { fill } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import { readOverrideRows } from '@/lib/plans/reads'
import type { Database } from '@/lib/supabase/database.types'
import type { AiOverrideView } from './components/ai-overrides'

type Client = SupabaseClient<Database>

const copy = vi.overrides
const WEEK_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** `19/10` for 2026-10-19. */
const dayMonth = (day: LocalDay) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

function topicTitle(trackId: string, topicId: string): string {
  return getTrack(trackId)?.topics.find((topic) => topic.id === topicId)?.title.vi ?? topicId
}

/** The one-line description of `o` (§2.4), by kind. */
export function describeOverride(o: RoadmapOverride): string {
  switch (o.kind) {
    case 'insert_block':
      return fill(copy.kinds.insertBlock, {
        minutes: o.params.minutes,
        topic: topicTitle(o.trackId, o.params.topicId),
        weekdays: WEEK_ORDER.filter((day) => o.params.weekdays.includes(day))
          .map((day) => copy.weekdays[day])
          .join(', '),
        until: dayMonth(o.params.until),
      })
    case 'extra_week':
      return fill(copy.kinds.extraWeek, {
        topic: topicTitle(o.trackId, o.params.topicId),
        days: Math.max(0, o.params.studyDays - o.usedDays),
      })
    case 'reorder_topics':
      return copy.kinds.reorder
  }
}

/**
 * The learner's overrides in force on `today`, active or suspended (decision 18's computed expiry;
 * revoked and expired ones are not listed), by track and key.
 */
export async function readAiOverrides(
  supabase: Client,
  userId: string,
  today: LocalDay,
): Promise<AiOverrideView[]> {
  const rows = await readOverrideRows(supabase, userId, today, ['active', 'suspended'])
  return rows.flatMap((row) =>
    row.override === null || !overrideActive(row.override, today)
      ? []
      : [
          {
            trackId: row.trackId,
            key: row.key,
            trackTitle: getTrack(row.trackId)?.title.vi ?? row.trackId,
            text: describeOverride(row.override),
            suspended: row.status === 'suspended',
          },
        ],
  )
}

/** The user's override `(trackId, key)`, any status: its kind and status, or null. */
export async function readOwnOverride(
  supabase: Client,
  userId: string,
  trackId: string,
  key: string,
): Promise<{ kind: RoadmapOverride['kind']; status: string } | null> {
  const { data, error } = await supabase
    .from('roadmap_overrides')
    .select('kind, status')
    .eq('user_id', userId)
    .eq('track_id', trackId)
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error('Could not read the override', { cause: error })
  if (data === null) return null
  const kind = (['insert_block', 'extra_week', 'reorder_topics'] as const).find(
    (candidate) => candidate === data.kind,
  )
  return kind === undefined ? null : { kind, status: data.status }
}

/**
 * Carried item (c): after the learner changed `trackId`'s roadmap variant, every reorder of the
 * track that is not revoked yet (active or suspended) is revoked as the learner's — the order was
 * checked against the other variant's roadmap (decision 35), and applying it to this one could
 * move started topics. Event ids derive from the page's `requestId`. `admin` is the secret-key
 * client the action created (only queries.ts and actions.ts create clients).
 */
export async function revokeReordersOfTrack(
  supabase: Client,
  admin: Client,
  userId: string,
  trackId: string,
  requestId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('roadmap_overrides')
    .select('key')
    .eq('user_id', userId)
    .eq('track_id', trackId)
    .eq('kind', 'reorder_topics')
    .in('status', ['active', 'suspended'])
    .order('key')
  if (error) throw new Error('Could not read the reorders', { cause: error })
  for (const { key } of data) {
    await revokeOverride(admin, userId, {
      eventId: deriveEventId(requestId, `roadmap.override_revoked:${trackId}:${key}`),
      trackId,
      key,
      kind: 'reorder_topics',
      by: 'learner',
    })
  }
  return data.length
}
