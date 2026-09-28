/**
 * Content signals (§6.4.7; Part B-M6 decision 19; task 6.7a): the input of the shared content loop,
 * **aggregates only**. Item results come from `content_signal_results(90)` — a `SECURITY DEFINER`
 * reader that already drops items fewer than 5 distinct learners answered (checked again here) —
 * and the learners' roadmap weeks from `bot_track_positions()` (counts per track, variant and week;
 * the admin reader `admin_track_positions()` refuses the secret key). Everything else comes from
 * the deployed catalog. No user id, ref, note or other learner text is read or answered; notes
 * never feed the loop (§6.5). Server-only; the secret-key client (a bot request has no session).
 */
import 'server-only'
import {
  contentSignalsResponse,
  type ContentSignals,
  type DerivedDeckGapSignal,
  type EnglishGapSignal,
  type HighFailSignal,
  type MissingSignal,
} from '@/lib/bot/contract/signals'
import { getCatalog } from '@/lib/content/catalog'
import type { Catalog, CatalogItem } from '@/lib/content/catalog-types'
import { placedItems } from '@/lib/content/schemas/roadmap'
import { createAdminClient } from '@/lib/supabase/admin'
import { RUN_KEY_PATTERN } from './contract/runs'
import { opsDay } from './ops-day'
import { readBotSettings } from './settings'

/** The window of `item.result` events the signals read (§6.4.7). */
export const SIGNAL_DAYS = 90
/** `highFail` only for items at least this many distinct learners answered (decision 19). */
export const MIN_USERS = 5
/** A fail rate from which an item is "high fail". */
export const HIGH_FAIL_RATE = 0.3
/** At most this many `highFail` entries, the highest fail rates first. */
export const HIGH_FAIL_LIMIT = 20
/**
 * Decision 25 of M5 (`/admin/content`'s red rows): a roadmap week is about seven study days, so a
 * learner in week `w` reaches weeks up to `w + 2` within 14 days.
 */
export const HORIZON_WEEKS = 2
export const DAYS_PER_WEEK = 7
/** The track whose weeks `englishGaps` reads (§6.4.7). */
export const ENGLISH_TRACK_ID = 'english'

/** One `content_signal_results` row: counts over the window, never a user. */
export type ResultAggregate = {
  readonly itemId: string
  readonly attempts: number
  readonly fails: number
  readonly hints: number
  readonly users: number
}

/** One `bot_track_positions()` row: `learners` active learners are in `week` of the variant. */
export type TrackPosition = {
  readonly trackId: string
  readonly variant: string
  readonly week: number
  readonly learners: number
}

export type SignalInputs = {
  readonly catalog: Catalog
  readonly results: readonly ResultAggregate[]
  readonly positions: readonly TrackPosition[]
  /** Targets of pending publish requests (§6.6). */
  readonly pendingTargets: readonly string[]
  /** The content PR of today's plan run, or null. */
  readonly contentPrUrl: string | null
}

const rate = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) / 100 : 0
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const hasDeepDive = (item: CatalogItem): boolean =>
  item.type === 'problem' && (item.content.note?.deepDiveId ?? null) !== null

function highFail(catalog: Catalog, results: readonly ResultAggregate[]): HighFailSignal[] {
  return results
    .flatMap((row) => {
      const item = catalog.items[row.itemId]
      if (row.users < MIN_USERS || row.attempts <= 0 || item === undefined) return []
      if (item.status === 'retired') return []
      const failRate = rate(row.fails, row.attempts)
      if (failRate < HIGH_FAIL_RATE) return []
      return [
        {
          itemId: item.id,
          attempts: row.attempts,
          failRate,
          hintRate: rate(row.hints, row.attempts),
          hasDeepDive: hasDeepDive(item),
        },
      ]
    })
    .sort((a, b) => b.failRate - a.failRate || compare(a.itemId, b.itemId))
    .slice(0, HIGH_FAIL_LIMIT)
}

/**
 * The weeks of a track variant that its learners reach within 14 days, each with the fewest days
 * until one of them gets there (0: a learner is in it now; 7 per week ahead).
 */
function neededWeeks(
  positions: readonly TrackPosition[],
  trackId: string,
  variant: string,
): Map<number, number> {
  const needed = new Map<number, number>()
  for (const position of positions) {
    if (position.trackId !== trackId || position.variant !== variant || position.learners <= 0)
      continue
    for (let ahead = 0; ahead <= HORIZON_WEEKS; ahead += 1) {
      const week = position.week + ahead
      const days = ahead * DAYS_PER_WEEK
      needed.set(week, Math.min(needed.get(week) ?? days, days))
    }
  }
  return needed
}

/** An active problem with an active note (what `/admin/content` counts as noted, §3.6). */
const isNoted = (item: CatalogItem | undefined): boolean =>
  item?.type === 'problem' && item.status === 'active' && item.content.note?.status === 'active'

type Placement = { trackId: string; week: number; itemId: string; neededWithinDays: number }

const missingKey = (signal: MissingSignal) =>
  `${signal.trackId}|${signal.kind}|${'itemId' in signal ? signal.itemId : signal.topic}`

const missingOrder = (a: MissingSignal, b: MissingSignal) =>
  compare(a.trackId, b.trackId) ||
  a.week - b.week ||
  compare(a.kind, b.kind) ||
  compare(missingKey(a), missingKey(b))

/**
 * Per track variant with learners: the placed items (core, and recap entries without a mode) and
 * the week topics of the weeks they reach within 14 days. The same item or topic in two variants
 * is kept once, at its nearest need.
 */
function coverage(catalog: Catalog, positions: readonly TrackPosition[]) {
  const placements: Placement[] = []
  const lessons: MissingSignal[] = []
  for (const track of catalog.tracks) {
    for (const ref of track.roadmaps) {
      const needed = neededWeeks(positions, track.id, ref.id)
      if (needed.size === 0) continue
      const roadmap = catalog.roadmaps[track.id]?.[ref.id]
      for (const week of roadmap?.weeks ?? []) {
        const neededWithinDays = needed.get(week.week)
        if (neededWithinDays === undefined) continue
        for (const itemId of placedItems(week)) {
          placements.push({ trackId: track.id, week: week.week, itemId, neededWithinDays })
        }
      }
      if (!track.itemTypes.includes('lesson')) continue
      for (const week of catalog.coverage[track.id]?.[ref.id] ?? []) {
        const neededWithinDays = needed.get(week.week)
        if (neededWithinDays === undefined) continue
        for (const lesson of week.lessons) {
          if (lesson.lessonId !== null) continue
          lessons.push({
            trackId: track.id,
            week: week.week,
            kind: 'lesson',
            topic: lesson.topic,
            neededWithinDays,
          })
        }
      }
    }
  }
  return { placements, lessons }
}

/** Keeps, per key, the entry needed soonest. */
function nearest<T>(entries: readonly T[], key: (entry: T) => string, days: (entry: T) => number) {
  const kept = new Map<string, T>()
  for (const entry of entries) {
    const current = kept.get(key(entry))
    if (current === undefined || days(entry) < days(current)) kept.set(key(entry), entry)
  }
  return [...kept.values()]
}

function missing(
  catalog: Catalog,
  placements: readonly Placement[],
  lessons: readonly MissingSignal[],
  highFailIds: ReadonlySet<string>,
): MissingSignal[] {
  const signals: MissingSignal[] = [...lessons]
  for (const placement of placements) {
    const item = catalog.items[placement.itemId]
    if (item?.type !== 'problem' || item.status !== 'active') continue
    const { trackId, week, itemId, neededWithinDays } = placement
    if (!isNoted(item)) signals.push({ trackId, week, kind: 'note', itemId, neededWithinDays })
    if (highFailIds.has(itemId) && !hasDeepDive(item)) {
      signals.push({ trackId, week, kind: 'deep-dive', itemId, neededWithinDays })
    }
  }
  return nearest(signals, missingKey, (signal) => signal.neededWithinDays).sort(missingOrder)
}

function englishGaps(catalog: Catalog, positions: readonly TrackPosition[]): EnglishGapSignal[] {
  const track = catalog.tracks.find((candidate) => candidate.id === ENGLISH_TRACK_ID)
  const weeks = new Map<number, EnglishGapSignal>()
  for (const ref of track?.roadmaps ?? []) {
    const needed = neededWeeks(positions, ENGLISH_TRACK_ID, ref.id)
    for (const week of catalog.coverage[ENGLISH_TRACK_ID]?.[ref.id] ?? []) {
      if (!needed.has(week.week) || week.extendedCards > 0) continue
      weeks.set(week.week, { week: week.week, extendedCards: week.extendedCards })
    }
  }
  return [...weeks.values()].sort((a, b) => a.week - b.week)
}

/** A derived deck's active cards cover their source items (§3.5): the placed problems they miss. */
function derivedDeckGaps(
  catalog: Catalog,
  placements: readonly Placement[],
): DerivedDeckGapSignal[] {
  const problems = [
    ...new Set(
      placements
        .filter((placement) => catalog.items[placement.itemId]?.type === 'problem')
        .map((placement) => placement.itemId),
    ),
  ].sort(compare)
  return Object.values(catalog.decks)
    .filter((deck) => deck.kind === 'derived' && deck.status !== 'retired')
    .sort((a, b) => compare(a.id, b.id))
    .flatMap((deck) => {
      const covered = new Set(
        deck.cardIds.flatMap((cardId) => {
          const card = catalog.items[cardId]
          return card?.type === 'flashcard' &&
            card.status === 'active' &&
            card.content.derivedFrom !== null
            ? [card.content.derivedFrom]
            : []
        }),
      )
      const missingFor = problems.filter((id) => !covered.has(id))
      return missingFor.length === 0 ? [] : [{ deckId: deck.id, missingFor }]
    })
}

/** The signals from their inputs (pure). */
export function buildContentSignals(input: SignalInputs): ContentSignals {
  const { catalog, positions } = input
  const high = highFail(catalog, input.results)
  const { placements, lessons } = coverage(catalog, positions)
  return {
    highFail: high,
    missing: missing(catalog, placements, lessons, new Set(high.map((signal) => signal.itemId))),
    englishGaps: englishGaps(catalog, positions),
    derivedDeckGaps: derivedDeckGaps(catalog, placements),
    openProposals: [
      ...[...new Set(input.pendingTargets)].sort(compare),
      ...(input.contentPrUrl === null ? [] : [input.contentPrUrl]),
    ],
  }
}

function failed(what: string, error: unknown): Error {
  return new Error(`Could not read ${what}`, { cause: error })
}

/** Today's plan run key (the Asia/Ho_Chi_Minh date, ADR-0027). */
const todayRunKey = (now: Date) => `run_${opsDay(now)}`

/**
 * `GET /runs/{runId}/content-signals` (§6.4.7): the aggregates, the pending publish targets and
 * today's plan run's content PR, validated against the contract before they leave.
 */
export async function contentSignals(now: Date): Promise<ContentSignals> {
  const admin = createAdminClient()
  const [results, positions, requests, run] = await Promise.all([
    admin.rpc('content_signal_results', { p_days: SIGNAL_DAYS }),
    admin.rpc('bot_track_positions'),
    admin.from('content_publish_requests').select('target').eq('status', 'pending'),
    admin
      .from('bot_runs')
      .select('content_pr_url')
      .eq('run_key', todayRunKey(now))
      .eq('kind', 'plan')
      .maybeSingle(),
  ])
  if (results.error) throw failed('the item results', results.error)
  if (positions.error) throw failed('the track positions', positions.error)
  if (requests.error) throw failed('the publish requests', requests.error)
  if (run.error) throw failed("today's plan run", run.error)
  return contentSignalsResponse.parse(
    buildContentSignals({
      catalog: getCatalog(),
      results: results.data.map((row) => ({
        itemId: row.item_id,
        attempts: row.attempts,
        fails: row.fails,
        hints: row.hints,
        users: row.users,
      })),
      positions: positions.data.map((row) => ({
        trackId: row.track_id,
        variant: row.variant,
        week: row.week,
        learners: row.learners,
      })),
      pendingTargets: requests.data.map((row) => row.target),
      contentPrUrl: run.data?.content_pr_url ?? null,
    }),
  )
}

export type SignalsAccess = 'ok' | 'not_found' | 'content_proposals_off'

/**
 * The route's checks, after `requireBotToken`: the run must be today's plan run (`not_found`
 * otherwise — another day's run, a publish run, an unknown key), and `bot_settings.
 * content_proposals` must be on (`content_proposals_off`).
 */
export async function signalsAccess(runKey: string, now: Date): Promise<SignalsAccess> {
  if (!RUN_KEY_PATTERN.test(runKey) || runKey !== todayRunKey(now)) return 'not_found'
  const run = await createAdminClient()
    .from('bot_runs')
    .select('id')
    .eq('run_key', runKey)
    .eq('kind', 'plan')
    .maybeSingle()
  if (run.error) throw failed('the run', run.error)
  if (run.data === null) return 'not_found'
  const { settings } = await readBotSettings()
  return settings.contentProposals ? 'ok' : 'content_proposals_off'
}
