/**
 * A JavaScript port of `apply_system_event`'s `roadmap.override_set` and `roadmap.override_revoked`
 * branches (20260928000200_bot_functions.sql, task 6.2b) and of `readOverrideRows`
 * (`lib/plans/reads.ts`) for the fake database of the overrides unit tests (task 6.6c). The real
 * function is covered by pgTAP; this only mirrors its answers: the AI flag (`ai_off`, the bot's
 * writes), `bot_settings.dry_run` (`invalid_event`), the enrollment (`not_enrolled`), a duplicate
 * event id, a kind change (`invalid_event`), a key the learner revoked (`revoked_key`), the same
 * override in force (`unchanged`), the counts under decision 18's expiry (`limit_reached`) and the
 * 21-day cooldown (`cooldown`), then the row and the event.
 */
import { overrideParamsSchemas, type RoadmapOverride } from '@/lib/domain/plan/overrides'
import { addDays, type LocalDay } from '@/lib/domain/time/localDay'
import type { OverrideRow } from '@/lib/plans/reads'
import { RaisedError, type FakeDb, type Row } from './fake-db'

const rows = (db: FakeDb, table: string): Row[] => (db.tables[table] ??= [])
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Plans of the user dated on or after `from` whose `trackId` snapshot names `key`. */
function planDates(db: FakeDb, userId: string, trackId: string, key: string, from: string) {
  return rows(db, 'day_plans')
    .filter((plan) => {
      const weeks = plan.roadmap_weeks as Record<string, { extraWeek?: string }> | undefined
      return (
        plan.user_id === userId &&
        String(plan.plan_date) >= from &&
        weeks?.[trackId]?.extraWeek === key
      )
    })
    .map((plan) => String(plan.plan_date))
}

/** `roadmap_override_active` (decision 18). */
function sqlActive(db: FakeDb, row: Row, today: LocalDay): boolean {
  if (row.status !== 'active') return false
  if (row.kind === 'insert_block') return String(row.until_local_day) >= today
  if (row.kind === 'extra_week') {
    const used = planDates(
      db,
      String(row.user_id),
      String(row.track_id),
      String(row.key),
      String(row.start_local_day),
    )
    return used.length < Number(row.study_days)
  }
  return true
}

export function applyOverrideEvent(args: Record<string, unknown>, db: FakeDb): unknown {
  const userId = args.p_user_id as string
  const event = args.p_event as Row
  const type = event.type as string
  const payload = event.payload as Row
  const trackId = event.track_id as string
  const profile = rows(db, 'profiles').find((row) => row.id === userId)
  if (profile === undefined || profile.status !== 'active') throw new RaisedError('inactive')
  const botWrite = type === 'roadmap.override_set' || event.source === 'bot'
  if (botWrite && profile.ai_personalization !== true) throw new RaisedError('ai_off')
  if (botWrite && rows(db, 'bot_settings')[0]?.dry_run !== false) {
    throw new RaisedError('invalid_event')
  }
  if (rows(db, 'events').some((row) => row.id === event.id)) {
    return { outcome: 'duplicate', versions: {} }
  }
  const overrides = rows(db, 'roadmap_overrides')
  const today = String(event.local_day ?? '')
  const existing = overrides.find(
    (row) => row.user_id === userId && row.track_id === trackId && row.key === payload.key,
  )

  if (type === 'roadmap.override_set') {
    const change = (args.p_changes as { row: Row }[])[0]!.row
    const perTrack = Math.min((event.limits as { perTrack: number }).perTrack, 3)
    const enrolled = rows(db, 'user_tracks').some(
      (row) => row.user_id === userId && row.track_id === trackId && row.status === 'active',
    )
    if (!enrolled) throw new RaisedError('not_enrolled')
    let prevStart: string | null = null
    if (existing !== undefined) {
      if (existing.kind !== payload.kind) throw new RaisedError('invalid_event')
      if (existing.status === 'revoked' && existing.revoked_by !== 'bot') {
        throw new RaisedError('revoked_key')
      }
      if (same(existing.params, payload.params) && sqlActive(db, existing, today)) {
        return { outcome: 'unchanged', versions: {} }
      }
      prevStart = existing.kind === 'extra_week' ? String(existing.start_local_day) : null
    }
    const row: Row = {
      id: existing?.id ?? crypto.randomUUID(),
      user_id: userId,
      track_id: trackId,
      key: payload.key,
      kind: payload.kind,
      params: payload.params,
      status: 'active',
      until_local_day: change.until_local_day ?? null,
      study_days: change.study_days ?? null,
      start_local_day: today,
      created_by_run: change.created_by_run,
      revoked_at: null,
      revoked_by: null,
    }
    const before = structuredClone(overrides)
    if (existing === undefined) overrides.push(row)
    else Object.assign(existing, row)
    const inTrack = overrides.filter(
      (o) => o.user_id === userId && o.track_id === trackId && sqlActive(db, o, today),
    )
    const refuse = (code: string) => {
      db.tables.roadmap_overrides = before
      throw new RaisedError(code)
    }
    if (inTrack.length > perTrack || inTrack.filter((o) => o.kind === 'extra_week').length > 1) {
      refuse('limit_reached')
    }
    const since = addDays(today, -21)
    if (
      payload.kind === 'extra_week' &&
      ((prevStart !== null && prevStart > since) ||
        overrides.some(
          (o) =>
            o.user_id === userId &&
            o.track_id === trackId &&
            o.key !== payload.key &&
            o.kind === 'extra_week' &&
            String(o.start_local_day) > since,
        ))
    ) {
      refuse('cooldown')
    }
  } else if (type === 'roadmap.override_revoked') {
    if (existing === undefined || existing.kind !== payload.kind) {
      throw new RaisedError('invalid_event')
    }
    if (existing.status === 'revoked') return { outcome: 'unchanged', versions: {} }
    existing.status = 'revoked'
    existing.revoked_by = event.source === 'bot' ? 'bot' : 'learner'
  } else {
    throw new RaisedError('not_implemented')
  }
  rows(db, 'events').push({
    id: event.id,
    user_id: userId,
    type,
    source: event.source,
    actor_id: event.actor_id ?? userId,
    track_id: trackId,
    local_day: event.local_day ?? null,
    payload,
  })
  return { outcome: 'applied', versions: {} }
}

function engineOf(row: Row, usedDays: number): RoadmapOverride | null {
  const kind = row.kind as RoadmapOverride['kind']
  const parsed = overrideParamsSchemas[kind].safeParse(row.params)
  if (!parsed.success) return null
  const base = {
    trackId: String(row.track_id),
    key: String(row.key),
    startLocalDay: String(row.start_local_day),
  }
  return kind === 'extra_week'
    ? ({ ...base, kind, params: parsed.data, usedDays } as RoadmapOverride)
    : ({ ...base, kind, params: parsed.data } as RoadmapOverride)
}

/** `readOverrideRows` over the fake's tables (every status). */
export function overrideRowsOf(db: FakeDb, userId: string, today: LocalDay): OverrideRow[] {
  return rows(db, 'roadmap_overrides')
    .filter((row) => row.user_id === userId)
    .toSorted(
      (a, b) =>
        String(a.track_id).localeCompare(String(b.track_id)) ||
        String(a.key).localeCompare(String(b.key)),
    )
    .map((row) => {
      const dates =
        row.kind === 'extra_week' && row.status !== 'revoked'
          ? planDates(
              db,
              userId,
              String(row.track_id),
              String(row.key),
              String(row.start_local_day),
            )
          : []
      const usedDays = dates.filter((date) => date < today).length
      return {
        trackId: String(row.track_id),
        key: String(row.key),
        kind: row.kind as OverrideRow['kind'],
        status: row.status as OverrideRow['status'],
        revokedBy: (row.revoked_by ?? null) as OverrideRow['revokedBy'],
        startLocalDay: String(row.start_local_day),
        params: row.params,
        override: engineOf(row, usedDays),
        usedDays,
        sqlUsedDays: dates.length,
      }
    })
}
