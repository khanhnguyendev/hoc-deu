/**
 * `roadmap_overrides` and `profiles` rows for the `lib/plans` override tests (task 6.6c). Not a
 * test file itself: tests import it.
 */
import type { Json } from '@/lib/supabase/database.types'
import type { RowOf } from '@/lib/testing/fake-supabase'
import { TODAY, USER_ID } from './fixtures'

const CREATED = '2026-09-01T00:00:00.000Z'

export function profileRow(change: Partial<RowOf<'profiles'>> = {}): RowOf<'profiles'> {
  return {
    id: USER_ID,
    ai_personalization: true,
    approved_at: CREATED,
    approved_by: null,
    avatar_url: null,
    bot_ref: '0123456789abcdef',
    code_language: null,
    created_at: CREATED,
    display_name: null,
    onboarded_at: CREATED,
    role: 'learner',
    share_notes_with_ai: false,
    status: 'active',
    updated_at: CREATED,
    ...change,
  }
}

type Kind = 'insert_block' | 'extra_week' | 'reorder_topics'

/** An override row of `kind` (status active, started TODAY, created by today's run). */
export function overrideRow(
  kind: Kind,
  change: Partial<RowOf<'roadmap_overrides'>> = {},
): RowOf<'roadmap_overrides'> {
  const params: Record<Kind, Json> = {
    insert_block: { topicId: 'arrays', weekdays: ['mon', 'wed'], minutes: 15, until: '2026-10-05' },
    extra_week: { topicId: 'arrays', studyDays: 5 },
    reorder_topics: { order: ['two-pointers'] },
  }
  return {
    id: crypto.randomUUID(),
    user_id: USER_ID,
    track_id: 'dsa',
    key: kind.replaceAll('_', '-'),
    kind,
    params: params[kind],
    status: 'active',
    until_local_day: kind === 'insert_block' ? '2026-10-05' : null,
    study_days: kind === 'extra_week' ? 5 : null,
    start_local_day: TODAY,
    created_by_run: `run_${TODAY}`,
    created_at: CREATED,
    revoked_at: null,
    revoked_by: null,
    ...change,
  }
}
