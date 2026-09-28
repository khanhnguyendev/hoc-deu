/**
 * `PUT /runs/{runId}/users/{userRef}/overrides` (platform design §5.12, §6.4.5, §6.10; Part B-M6
 * decisions 6, 10–12, 18, 33, 35; task 6.6c): the write `idempotentWrite` runs for kind
 * `overrides`, so an invalid answer is counted and never binds the key.
 *
 * In order: the AI flag still on (else `409 {"error":"ai_off"}`, not recorded); the body
 * (`overridesRequest`); the learner's day (`loadDay` with the secret key — every read filters
 * `user_id`) and every override row of the user (`readOverrideRows`); then every entry is checked
 * and **every** issue collected — a `set`'s params by its kind's schema (`overrideParamsSchemas`),
 * its track one of the learner's active tracks, its key not used by another kind nor revoked by
 * the learner (`revoked_key`), then 6.6b's `validateOverride` against the learner's day (the bounds
 * of `effectiveLimits`; a reorder checked against the other overrides in force, §6.10's
 * `breaks_requires`); a `revoke` only an existing key of the user; the counts as SQL keeps them
 * (`perTrack` in force, one extra week, the cooldown — counted here for a precise detail, and
 * again by SQL under its lock, decision 33). The same override already in force is a no-op.
 * **All or nothing:** any issue is `invalid` with `details` and nothing is written. A dry run
 * stores the proposal in `bot_run_users.detail.overrides` and writes nothing else (decision 11). A
 * live run revokes, then sets (`lib/events/overrides.ts`), each under its own event id — the set's
 * `deriveEventId(<run uuid>, '<ref>:overrides:<trackId>:<key>:<digest of kind and params>')` (the
 * digest makes a corrected set after an invalid answer a new event, not a `duplicate` of the
 * first), the revoke's `'<ref>:overrides:revoke:<trackId>:<key>'` — so a retry after a crash is a
 * `duplicate`. A database refusal part-way (`limit_reached`, `cooldown`, `revoked_key`,
 * `not_enrolled`) is `invalid` with that code and what was written. `active` = the overrides in
 * force after the call. Server-only; nothing a learner wrote is logged.
 */
import 'server-only'
import { issueDetails } from './route'
import type { RunUser } from './runs'
import type { WriteOutcome } from './writes'
import { readBotSettings } from './settings'
import type { BotLimits } from './limits'
import {
  overridesRequest,
  type OverrideSet,
  type OverridesRequest,
  type OverridesResponse,
} from '@/lib/bot/contract/overrides'
import { canonicalJson } from '@/lib/canonical-json'
import {
  type OverrideLimits,
  overrideActive,
  overrideParamsSchemas,
  type RoadmapOverride,
  validateOverride,
} from '@/lib/domain/plan/overrides'
import { addDays, type LocalDay } from '@/lib/domain/time/localDay'
import { EventError } from '@/lib/events/apply'
import { deriveEventId, digest } from '@/lib/events/ids'
import { revokeOverride, setOverride } from '@/lib/events/overrides'
import { loadDay, type Day } from '@/lib/plans/day'
import { readOverrideRows, type OverrideRow } from '@/lib/plans/reads'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import { boundedProposal, PROPOSAL_BYTES, recordProposal } from './proposals'

export const KIND = 'overrides'

export { PROPOSAL_BYTES }

export type Detail = {
  readonly path: string
  readonly code: string
  readonly message: string
  readonly [key: string]: unknown
}

/** An answer with an outcome is recorded by `idempotentWrite`; `409 ai_off` has none. */
export type OverridesAnswer = {
  status: number
  body: OverridesResponse | { error: string }
  outcome?: WriteOutcome
}

type Admin = ReturnType<typeof createAdminClient>
type TrackKey = { readonly trackId: string; readonly key: string }

const idOf = (entry: TrackKey) => `${entry.trackId}\u0000${entry.key}`

/**
 * Decision 18 as SQL computes it (`roadmap_override_active`): status `active`, and an insert block
 * until its last day, an extra week while fewer plans than its study days name it — today's plan
 * included (`sqlUsedDays`) — a reorder until revoked. A row whose params no longer parse counts
 * as in force (SQL counts it).
 */
export function inForce(row: OverrideRow, today: LocalDay): boolean {
  if (row.status !== 'active') return false
  const o = row.override
  if (o === null) return true
  if (o.kind === 'extra_week') return row.sqlUsedDays < o.params.studyDays
  return overrideActive(o, today)
}

const activeOf = (rows: readonly OverrideRow[], today: LocalDay): TrackKey[] =>
  rows.filter((row) => inForce(row, today)).map(({ trackId, key }) => ({ trackId, key }))

/** `effectiveLimits`' override bounds as `validateOverride` reads them. */
export function overrideLimitsOf(limits: BotLimits): OverrideLimits {
  return {
    insertBlockMaxBudgetShare: limits.insertBlockShare,
    insertBlockMaxDaysAhead: limits.insertBlockDays,
    extraWeekMaxStudyDays: limits.extraWeekDays,
  }
}

const invalid = (details: readonly Detail[], active: TrackKey[]): OverridesAnswer => ({
  status: 422,
  body: { outcome: 'invalid', active, details: [...details] },
  outcome: 'invalid',
})

const ISSUE_MESSAGES: Record<string, string> = {
  bad_params: 'the params do not fit the kind (or until is before today)',
  unknown_topic: 'the topic is not in the track',
  not_upcoming: 'a started topic cannot move',
  breaks_requires: 'the order puts a topic before a topic it requires',
  not_permutation: 'the order must list every upcoming topic exactly once',
  over_budget_share: 'the minutes are over the share of the track budget',
  until_too_far: 'until is too many days ahead',
  no_weak_item: 'the topic has no Weak item',
  too_many_days: 'too many study days',
  not_reorderable: 'the roadmap has no core slot a reorder could move',
}

/** A `set` entry that passed every check: to write, or already in force (`unchanged`). */
type Checked = { readonly override: RoadmapOverride; readonly unchanged: boolean }

function engineOverride(entry: OverrideSet, params: unknown, today: LocalDay): RoadmapOverride {
  const base = { trackId: entry.trackId, key: entry.key, startLocalDay: today }
  switch (entry.kind) {
    case 'insert_block':
      return { ...base, kind: 'insert_block', params: params as never }
    case 'extra_week':
      return { ...base, kind: 'extra_week', params: params as never, usedDays: 0 }
    case 'reorder_topics':
      return { ...base, kind: 'reorder_topics', params: params as never }
  }
}

/** Every check of one `set` entry; its issues, or the override to write. */
function checkSet(
  entry: OverrideSet,
  index: number,
  day: Day,
  rows: readonly OverrideRow[],
  others: readonly RoadmapOverride[],
  limits: OverrideLimits,
): { issues: Detail[]; checked: Checked | null } {
  const at = `set.${index}`
  const issues: Detail[] = []
  const issue = (path: string, code: string, message: string) =>
    issues.push({ path: `${at}${path}`, code, message, trackId: entry.trackId, key: entry.key })

  const parsed = overrideParamsSchemas[entry.kind].safeParse(entry.params)
  if (!parsed.success) {
    for (const detail of issueDetails(parsed.error)) {
      issue(`.params${detail.path === '' ? '' : `.${detail.path}`}`, 'bad_params', detail.message)
    }
  }
  const enrollment = day.enrollments.find(
    (candidate) => candidate.trackId === entry.trackId && candidate.status === 'active',
  )
  if (enrollment === undefined) {
    issue('.trackId', 'not_enrolled', 'the track is not one of the learner’s active tracks')
  }
  const existing = rows.find((row) => row.trackId === entry.trackId && row.key === entry.key)
  if (existing !== undefined && existing.kind !== entry.kind) {
    issue('.kind', 'kind_changed', 'the key is in use by another kind (use a new key)')
  }
  if (existing?.status === 'revoked' && existing.revokedBy !== 'bot') {
    issue('.key', 'revoked_key', 'the learner revoked this key: it cannot be set again')
  }
  if (issues.length > 0 || !parsed.success || enrollment === undefined) {
    return { issues, checked: null }
  }

  const override = engineOverride(entry, parsed.data, day.today)
  // SQL's no-op: the same override already in force (§6.4.5 idempotent by trackId and key).
  if (
    existing !== undefined &&
    inForce(existing, day.today) &&
    canonicalJson(existing.params) === canonicalJson(entry.params)
  ) {
    return { issues, checked: { override, unchanged: true } }
  }
  const found = validateOverride(override, {
    catalog: day.catalog,
    enrollment,
    items: day.items,
    today: day.today,
    limits,
    overrides: others,
  })
  for (const { code } of found) issue('', code, ISSUE_MESSAGES[code] ?? code)
  return { issues, checked: issues.length > 0 ? null : { override, unchanged: false } }
}

/** What the request would do, or every reason it cannot (all or nothing). */
function plan(
  request: OverridesRequest,
  day: Day,
  rows: readonly OverrideRow[],
  limits: BotLimits,
): { details: Detail[] } | { sets: Checked[]; revoke: OverrideRow[] } {
  const details: Detail[] = []
  const { today } = day

  const revoke: OverrideRow[] = []
  const revoking = new Set<string>()
  request.revoke.forEach((entry, index) => {
    const row = rows.find(
      (candidate) => candidate.trackId === entry.trackId && candidate.key === entry.key,
    )
    if (row === undefined) {
      details.push({
        path: `revoke.${index}`,
        code: 'unknown_key',
        message: 'not one of the learner’s overrides',
        trackId: entry.trackId,
        key: entry.key,
      })
    } else if (!revoking.has(idOf(entry))) {
      revoking.add(idOf(entry))
      revoke.push(row)
    }
  })

  // The overrides in force for the engine after the revocations: a reorder is checked against
  // them and the sets accepted before it (validateOverride replaces a same key).
  let others: RoadmapOverride[] = rows.flatMap((row) =>
    row.override !== null &&
    row.status === 'active' &&
    !revoking.has(idOf(row)) &&
    overrideActive(row.override, today)
      ? [row.override]
      : [],
  )
  const sets: Checked[] = []
  const setting = new Set<string>()
  request.set.forEach((entry, index) => {
    const at = { trackId: entry.trackId, key: entry.key }
    if (setting.has(idOf(entry))) {
      details.push({
        path: `set.${index}.key`,
        code: 'duplicate_key',
        message: 'the key is set twice',
        ...at,
      })
      return
    }
    setting.add(idOf(entry))
    if (revoking.has(idOf(entry))) {
      details.push({
        path: `set.${index}.key`,
        code: 'set_and_revoke',
        message: 'a key cannot be set and revoked in one request',
        ...at,
      })
      return
    }
    const result = checkSet(entry, index, day, rows, others, overrideLimitsOf(limits))
    details.push(...result.issues)
    if (result.checked !== null) {
      sets.push(result.checked)
      const { override } = result.checked
      others = [
        ...others.filter((o) => !(o.trackId === override.trackId && o.key === override.key)),
        override,
      ]
    }
  })
  if (details.length > 0) return { details }

  // The counts (decision 33), as SQL keeps them: after the revocations and the sets, at most
  // `perTrack` overrides in force per track, one of them an extra week; a new extra week needs
  // `extraWeekCooldownDays` since the track's last extra-week start (its own previous one too).
  const fresh = sets.filter((checked) => !checked.unchanged)
  for (const trackId of new Set(fresh.map((checked) => checked.override.trackId))) {
    const newKeys = new Set(
      fresh.filter((c) => c.override.trackId === trackId).map((c) => c.override.key),
    )
    const kept = rows.filter(
      (row) =>
        row.trackId === trackId &&
        inForce(row, today) &&
        !revoking.has(idOf(row)) &&
        !newKeys.has(row.key),
    )
    const added = fresh.filter((c) => c.override.trackId === trackId)
    const count = kept.length + added.length
    if (count > limits.overridesPerTrack) {
      details.push({
        path: 'set',
        code: 'limit_reached',
        message: `at most ${limits.overridesPerTrack} overrides in force per track`,
        trackId,
        limit: limits.overridesPerTrack,
        count,
      })
    }
    const extras =
      kept.filter((row) => row.kind === 'extra_week').length +
      added.filter((c) => c.override.kind === 'extra_week').length
    if (extras > 1) {
      details.push({
        path: 'set',
        code: 'limit_reached',
        message: 'at most one extra week in force per track',
        trackId,
        limit: 1,
        count: extras,
      })
    }
    const since = addDays(today, -limits.extraWeekCooldownDays)
    for (const checked of added) {
      if (checked.override.kind !== 'extra_week') continue
      const recent = rows.some(
        (row) => row.trackId === trackId && row.kind === 'extra_week' && row.startLocalDay > since,
      )
      if (recent) {
        details.push({
          path: `set.${request.set.findIndex(
            (entry) => entry.trackId === trackId && entry.key === checked.override.key,
          )}`,
          code: 'cooldown',
          message: `an extra week needs ${limits.extraWeekCooldownDays} days since the track’s last one`,
          trackId,
          key: checked.override.key,
        })
      }
    }
  }
  return details.length > 0 ? { details } : { sets, revoke }
}

/** Decision 11: the proposal in `bot_run_users.detail.overrides` (its other keys — the invalid
 *  attempts — kept), via `recordProposal` (`lib/bot/proposals.ts`, shared with 6.5b's `plan.ts`
 *  and `custom-items.ts`). */
function overridesProposal(request: OverridesRequest): Json {
  return boundedProposal(request as unknown as Json, () => ({
    set: request.set.map(({ key, kind, trackId }) => ({ key, kind, trackId })),
    revoke: request.revoke,
    paramsOmitted: true,
  }))
}

/** What a live write had written when the database refused a later part of it. */
type Written = { readonly set: TrackKey[]; readonly revoked: TrackKey[] }

/**
 * A database refusal part-way through a live write: the answer, or null to rethrow. `kindChanged`
 * re-reads the entry's row: SQL's `invalid_event` for a key another write took with another kind
 * between the check and this write (a race — the bot is one serial client, ADR-0027) is the same
 * `kind_changed` the check gives, not a 500.
 */
async function refused(
  error: unknown,
  path: string,
  written: Written,
  active: () => Promise<TrackKey[]>,
  kindChanged: () => Promise<boolean>,
): Promise<OverridesAnswer | null> {
  if (!(error instanceof EventError)) return null
  if (error.code === 'ai_off') return { status: 409, body: { error: 'ai_off' } }
  const detail = async (code: string, message: string, retryable: boolean, at = path) =>
    invalid(
      [
        {
          path: at,
          code,
          message,
          ...(retryable ? { retryable: true } : {}),
          written: { set: [...written.set], revoked: [...written.revoked] },
        },
      ],
      await active(),
    )
  if (error.code === 'day_changed') {
    return detail('day_changed', "the learner's day changed during the request; retry it", true)
  }
  if (error.code === 'invalid_event' && (await readBotSettings()).settings.dryRun) {
    return detail('dry_run_started', 'dry-run was turned on during the request; retry it', true)
  }
  if (error.code === 'invalid_event' && (await kindChanged())) {
    return detail(
      'kind_changed',
      'the key is in use by another kind (use a new key)',
      false,
      `${path}.kind`,
    )
  }
  if (['limit_reached', 'cooldown', 'revoked_key', 'not_enrolled'].includes(error.code)) {
    return detail(error.code, 'refused by the database', false)
  }
  return null
}

async function readAiFlag(admin: Admin, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('profiles')
    .select('ai_personalization')
    .eq('id', userId)
    .single()
  if (error || !data) throw new Error("Could not read the learner's profile", { cause: error })
  return data.ai_personalization
}

/** The write `idempotentWrite` runs (the route's). */
export async function writeOverrides(
  runUser: RunUser,
  body: unknown,
  now: Date,
): Promise<OverridesAnswer> {
  const admin = createAdminClient()
  // §5.12: no override once the AI flag is off (SQL refuses it too).
  if (!(await readAiFlag(admin, runUser.userId))) return { status: 409, body: { error: 'ai_off' } }

  const day = await loadDay(admin, runUser.userId, now)
  const rows = await readOverrideRows(admin, runUser.userId, day.today)
  const parsed = overridesRequest.safeParse(body)
  if (!parsed.success) return invalid(issueDetails(parsed.error), activeOf(rows, day.today))
  const request = parsed.data

  const { settings } = await readBotSettings()
  const checked = plan(request, day, rows, settings.limits)
  if ('details' in checked) return invalid(checked.details, activeOf(rows, day.today))

  if (runUser.mode === 'dry_run') {
    await recordProposal(admin, runUser, KIND, overridesProposal(request))
    return {
      status: 200,
      body: { outcome: 'dry_run', active: activeOf(rows, day.today) },
      outcome: 'dry_run',
    }
  }

  const active = async () =>
    activeOf(await readOverrideRows(admin, runUser.userId, day.today), day.today)
  /** Whether the row under this key now holds another kind than the entry's. */
  const kindChangedOf = (entry: TrackKey & { kind: string }) => async () =>
    (await readOverrideRows(admin, runUser.userId, day.today)).some(
      (row) => row.trackId === entry.trackId && row.key === entry.key && row.kind !== entry.kind,
    )
  const written: Written = { set: [], revoked: [] }
  for (const row of checked.revoke) {
    const at = { trackId: row.trackId, key: row.key }
    try {
      await revokeOverride(admin, runUser.userId, {
        eventId: deriveEventId(
          runUser.runUuid,
          `${runUser.userRef}:${KIND}:revoke:${row.trackId}:${row.key}`,
        ),
        ...at,
        kind: row.kind,
        by: 'bot',
      })
    } catch (error) {
      const index = request.revoke.findIndex((e) => idOf(e) === idOf(row))
      const answer = await refused(error, `revoke.${index}`, written, active, kindChangedOf(row))
      if (answer === null) throw error
      return answer
    }
    written.revoked.push(at)
  }
  for (const { override, unchanged } of checked.sets) {
    const at = { trackId: override.trackId, key: override.key }
    if (!unchanged) {
      try {
        await setOverride(admin, runUser.userId, {
          eventId: deriveEventId(
            runUser.runUuid,
            `${runUser.userRef}:${KIND}:${override.trackId}:${override.key}:${digest({
              kind: override.kind,
              params: override.params,
            })}`,
          ),
          runKey: runUser.runKey,
          override,
          localDay: day.today,
          perTrack: settings.limits.overridesPerTrack,
        })
      } catch (error) {
        const index = request.set.findIndex((e) => idOf(e) === idOf(override))
        const answer = await refused(
          error,
          `set.${index}`,
          written,
          active,
          kindChangedOf(override),
        )
        if (answer === null) throw error
        return answer
      }
    }
    written.set.push(at)
  }
  return { status: 200, body: { outcome: 'applied', active: await active() }, outcome: 'applied' }
}
