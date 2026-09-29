/**
 * A JavaScript port of `apply_system_event`'s `user_item.created` and `user_item.retired` branches
 * (20260928000200_bot_functions.sql, task 6.2b) for the fake database of the custom-items unit
 * tests (task 6.6a). The real function is covered by pgTAP; this only mirrors its answers: the AI
 * flag (`ai_off`), `bot_settings.dry_run` (`invalid_event`), the enrollment (`not_enrolled`), the
 * server's ID, a duplicate event id, the same item again (`unchanged`) or another one under the
 * slug (`slug_taken`), the per-day and active quotas (`limit_reached`), then the row and the event.
 */
import { RaisedError, type FakeDb, type Row } from './fake-db'

const rows = (db: FakeDb, table: string): Row[] => (db.tables[table] ??= [])

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function applyUserItemEvent(args: Record<string, unknown>, db: FakeDb): unknown {
  const userId = args.p_user_id as string
  const event = args.p_event as Row
  const type = event.type as string
  const payload = event.payload as Row
  const profile = rows(db, 'profiles').find((row) => row.id === userId)
  if (profile === undefined || profile.status !== 'active') throw new RaisedError('inactive')
  // The bot's writes need the AI flag and dry-run off; the learner's hide needs neither.
  const botWrite = type !== 'user_item.hidden'
  if (botWrite && profile.ai_personalization !== true) throw new RaisedError('ai_off')
  if (botWrite && rows(db, 'bot_settings')[0]?.dry_run !== false) {
    throw new RaisedError('invalid_event')
  }
  if (rows(db, 'events').some((row) => row.id === event.id)) {
    return { outcome: 'duplicate', versions: {} }
  }
  const items = rows(db, 'user_items')
  const today = event.local_day as string

  if (type === 'user_item.created') {
    const trackId = event.track_id as string
    const change = (args.p_changes as { row: Row }[])[0]!.row
    const limits = event.limits as { perDay: number; active: number }
    const enrolled = rows(db, 'user_tracks').some(
      (row) => row.user_id === userId && row.track_id === trackId && row.status === 'active',
    )
    if (!enrolled) throw new RaisedError('not_enrolled')
    if (event.item_id !== `user:${String(profile.bot_ref)}:${String(payload.slug)}`) {
      throw new RaisedError('invalid_event')
    }
    const existing = items.find((row) => row.user_id === userId && row.item_id === event.item_id)
    if (existing !== undefined) {
      if (
        existing.item_type === payload.itemType &&
        existing.track_id === trackId &&
        existing.topic_id === change.topic_id &&
        same(existing.payload, change.payload)
      ) {
        return { outcome: 'unchanged', versions: {} }
      }
      throw new RaisedError('slug_taken')
    }
    const createdToday = rows(db, 'events').filter(
      (row) => row.user_id === userId && row.type === type && row.local_day === today,
    ).length
    const active = items.filter((row) => row.user_id === userId && row.status === 'active').length
    if (createdToday >= Math.min(limits.perDay, 10) || active >= Math.min(limits.active, 200)) {
      throw new RaisedError('limit_reached')
    }
    items.push({
      user_id: userId,
      item_id: event.item_id,
      item_type: payload.itemType,
      track_id: trackId,
      topic_id: change.topic_id,
      payload: change.payload,
      status: 'active',
      created_by_run: change.created_by_run,
      created_on: today,
    })
  } else if (type === 'user_item.retired' || type === 'user_item.hidden') {
    const item = items.find((row) => row.user_id === userId && row.item_id === event.item_id)
    if (item === undefined || item.item_type !== payload.itemType) {
      throw new RaisedError('invalid_event')
    }
    const status = type === 'user_item.retired' ? 'retired' : 'hidden'
    if (item.status === status) return { outcome: 'unchanged', versions: {} }
    if (status === 'hidden' && item.status !== 'active') throw new RaisedError('invalid_transition')
    item.status = status
  } else {
    throw new RaisedError('not_implemented')
  }
  rows(db, 'events').push({
    id: event.id,
    user_id: userId,
    type,
    source: event.source,
    item_id: event.item_id,
    track_id: event.track_id ?? null,
    local_day: today,
    payload,
  })
  return { outcome: 'applied', versions: {} }
}
