/**
 * JavaScript ports of the 6.2b SQL the bot service calls (20260928000200_bot_functions.sql), for
 * the fake database of `lib/bot` unit tests. The real functions are covered by pgTAP; these only
 * mirror their answers.
 */
import { RaisedError, type FakeDb, type FakeDbOptions, type Row } from './fake-db'

const OUTCOMES = [
  'applied',
  'dry_run',
  'skipped_plan_in_use',
  'skipped_gate_closed',
  'skipped_unseen',
  'invalid',
]

const isObject = (value: unknown): value is Row =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** `bot_record_write(p_run_user_id, p_kind, p_body_hash, p_entry)` (decision 10, M6-R18). */
export function botRecordWrite(args: Record<string, unknown>, db: FakeDb): unknown {
  const kind = args.p_kind as string
  const hash = args.p_body_hash as string
  const entry = args.p_entry
  if (
    !['plan', 'custom-items', 'overrides'].includes(kind) ||
    !/^[0-9a-f]{64}$/.test(hash) ||
    !isObject(entry) ||
    !OUTCOMES.includes(entry.outcome as string)
  ) {
    throw new RaisedError('invalid_event')
  }
  const row = (db.tables.bot_run_users ?? []).find((user) => user.id === args.p_run_user_id)
  if (row === undefined) throw new RaisedError('not_found')
  const writes = row.writes as Row
  if (kind in writes) return { stored: false, entry: writes[kind] }
  if (entry.outcome === 'invalid') {
    const detail = isObject(row.detail) ? row.detail : {}
    const current = isObject(detail[kind]) ? (detail[kind] as Row) : {}
    const attempts = (typeof current.invalidAttempts === 'number' ? current.invalidAttempts : 0) + 1
    if (attempts > 3) throw new RaisedError('too_many_attempts')
    row.detail = { ...detail, [kind]: { ...current, invalidAttempts: attempts } }
    return { stored: false, invalidAttempts: attempts }
  }
  const stored = { ...entry, bodyHash: hash }
  row.writes = { ...writes, [kind]: stored }
  row.processed_at ??= new Date().toISOString()
  if (kind === 'plan') row.outcome = entry.outcome
  return { stored: true, entry: stored }
}

/** `publish_set_pr(p_ids, p_pr_url)`: the PR on the listed pending requests; the count. */
export function publishSetPr(args: Record<string, unknown>, db: FakeDb): number {
  const ids = args.p_ids as number[]
  let count = 0
  for (const request of db.tables.content_publish_requests ?? []) {
    if (ids.includes(request.id as number) && request.status === 'pending') {
      request.pr_url = args.p_pr_url
      count += 1
    }
  }
  return count
}

/** The bot tables' defaults and unique keys (20260928000100_bot_and_ai_tables.sql). */
export const BOT_TABLES: Pick<FakeDbOptions, 'defaults' | 'unique'> = {
  defaults: {
    bot_runs: {
      status: 'running',
      failure_reason: null,
      users_eligible: 0,
      users_deferred: 0,
      content_pr_url: null,
      summary: null,
      started_at: () => new Date().toISOString(),
      finished_at: null,
    },
    bot_run_users: {
      outcome: null,
      writes: {},
      detail: null,
      processed_at: null,
      created_at: () => new Date().toISOString(),
    },
  },
  unique: {
    bot_runs: [['run_key']],
    bot_run_users: [
      ['run_id', 'user_ref'],
      ['run_id', 'user_id'],
    ],
  },
}
