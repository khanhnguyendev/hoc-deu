/**
 * AI plans (platform design §6.4.3, §5.4, §5.5; Part B-M6 decisions 13, 15, 37): the checks a
 * bot's proposed day plan must pass before `PUT …/plan` (6.5b) hands it to
 * `apply_system_event('plan.ai_proposed')`. Pure — the allowance (what the server lets the bot
 * plan for this user today) is built by `lib/bot/context.ts` (6.4b), already cut by decision 37.
 *
 * Every rule yields an issue and all issues are collected; only an unknown item (or a custom item
 * that is not the user's own, or an item already planned) skips that item's later checks. Minutes
 * always come from the catalog: the bot's numbers are never read.
 */
import { type ItemMode, ITEM_MODES, type PlanCatalog, type PlanItem } from '../catalog'
import { own } from '../compare'
import type { LocalDay } from '../time/localDay'
import { largestItemMinutes, plannedMinutes } from './buildPlan'
import { type PlanBlock, type PlanBlockItem, planBlockSchema } from './types'

// Public API
// ---------------------------------------------------------------------------------------------

export type AiBlockKind = 'review' | 'new' | 'practice' | 'recap'

export type AiBlockInput = {
  readonly trackId: string
  readonly kind: AiBlockKind
  readonly itemIds: readonly string[]
  /** For review / recap blocks: recall | redo | explain-aloud | review; new blocks: omitted. */
  readonly mode?: ItemMode
}

export type AiPlanInput = {
  readonly targetDate: LocalDay
  readonly blocks: readonly AiBlockInput[]
  readonly rationale: string
}

/** What the server allows for this user today (built by lib/bot/context.ts, 6.4b). */
export type AiPlanAllowance = {
  readonly today: LocalDay
  /** With the user's custom items (6.6a overlay). */
  readonly catalog: PlanCatalog
  readonly activeTrackIds: ReadonlySet<string>
  /** Track → budget minutes. */
  readonly budgets: Readonly<Record<string, number>>
  /** = newQueueHead, per §6.4.2 (cut by decision 37). */
  readonly allowedNew: ReadonlySet<string>
  /** Due + introduced, not mastered. */
  readonly allowedReview: ReadonlySet<string>
  /** Active only. */
  readonly ownCustomItems: ReadonlySet<string>
  /** Active and not completed. */
  readonly openDeepDives: ReadonlySet<string>
}

export type AiIssueCode =
  | 'wrong_date'
  | 'unknown_item'
  | 'inactive_track'
  | 'not_allowed_new'
  | 'not_allowed_review'
  | 'not_own_custom'
  | 'deep_dive_not_open'
  | 'bad_mode'
  | 'bad_kind'
  | 'duplicate_item'
  | 'track_mismatch'
  | 'over_budget'
  | 'empty_block'
  | 'rationale'

export type AiPlanIssue = {
  readonly path: string
  readonly code: AiIssueCode
  readonly itemId?: string
}

export type AiPlanResult =
  | { readonly ok: true; readonly blocks: readonly PlanBlock[]; readonly rationale: string }
  | { readonly ok: false; readonly issues: readonly AiPlanIssue[] }

/** §6.4.3 rule 6: the most graphemes a cleaned rationale may hold. */
export const RATIONALE_MAX_GRAPHEMES = 280

/** Custom item IDs are `user:<bot_ref>:<slug>` (§6.4.4, decision 17). */
const CUSTOM_ITEM_PREFIX = 'user:'

const AI_BLOCK_KINDS: readonly string[] = ['review', 'new', 'practice', 'recap']

/** The modes a review, recap or practice block may name. */
const REVIEW_BLOCK_MODES: readonly string[] = ['review', 'recall', 'redo', 'explain-aloud']

/** A problem (`reviewModes`) is reviewed by recall, redo or explaining aloud (§5.5). */
const PROBLEM_MODES: readonly ItemMode[] = ['recall', 'redo', 'explain-aloud']

/**
 * Checks `input` against `allow` (§6.4.3 rules 1–6): the plan's blocks with server minutes and
 * IDs `<date>:<track>:<kind>:<n>` (per kind within the track, in input order), and the cleaned
 * rationale; or every issue found. Never throws.
 */
export function validateAiPlan(input: AiPlanInput, allow: AiPlanAllowance): AiPlanResult {
  const issues: AiPlanIssue[] = []
  if (input.targetDate !== allow.today) issues.push({ path: 'targetDate', code: 'wrong_date' })

  const seen = new Set<string>()
  const counts = new Map<string, number>()
  const blocks: PlanBlock[] = []
  input.blocks.forEach((block, index) => {
    const items = checkBlock(block, index, allow, seen, issues)
    const key = `${block.trackId}:${block.kind}`
    const n = (counts.get(key) ?? 0) + 1
    counts.set(key, n)
    blocks.push({
      id: `${input.targetDate}:${block.trackId}:${block.kind}:${n}`,
      trackId: block.trackId,
      kind: block.kind,
      estMinutes: items.reduce((sum, planned) => sum + planned.minutes, 0),
      items,
    })
  })

  const plan = { blocks }
  for (const trackId of new Set(blocks.map((block) => block.trackId))) {
    if (!allow.activeTrackIds.has(trackId)) continue
    const budget = own(allow.budgets, trackId) ?? 0
    const planned = plannedMinutes(plan, trackId)
    if (planned > budget && planned > budget + largestItemMinutes(plan, trackId)) {
      issues.push({ path: `tracks.${trackId}`, code: 'over_budget' })
    }
  }

  // The stored shape (§4.1): an estimate or item count the schema refuses is over any budget.
  blocks.forEach((block, index) => {
    if (issues.length === 0 && !planBlockSchema.safeParse(block).success) {
      issues.push({ path: `blocks[${index}]`, code: 'over_budget' })
    }
  })

  const rationale = cleanRationale(input.rationale)
  if (graphemeCount(rationale) > RATIONALE_MAX_GRAPHEMES) {
    issues.push({ path: 'rationale', code: 'rationale' })
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, blocks, rationale }
}

/** Plain text for a rationale (§6.4.3 rule 6): markup, control characters and URLs removed,
 *  whitespace collapsed, NFC; ≤ 280 graphemes after cleaning, else an issue. */
export function cleanRationale(text: string): string {
  let clean = text.normalize('NFC')
  // Control characters become spaces; invisible format characters (bidi overrides, zero-width
  // spaces, BOM) go, except the zero-width joiner of emoji sequences.
  clean = clean.replace(/\p{Cc}/gu, ' ').replace(/(?!\u200d)\p{Cf}/gu, '')
  // HTML tags and comments, repeated until none is left (`<<b>b>` hides a tag in a tag).
  for (let previous = ''; previous !== clean;) {
    previous = clean
    clean = clean.replace(/<!--[\s\S]*?-->|<\/?[a-z!][^<>]*>/gi, ' ')
  }
  // Markdown links and images keep their text; then every URL goes.
  clean = clean
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S*/gi, ' ')
    .replace(/\b(?:javascript|vbscript|data|file|mailto):\S*/gi, ' ')
    .replace(/\bwww\.\S+/gi, ' ')
  // Markdown emphasis, code and heading / quote markers.
  clean = clean.replace(/[*`~]+|_{2,}/g, '').replace(/(^|\s)[#>]+(?=\s)/g, '$1')
  return clean.replace(/\s+/gu, ' ').trim().normalize('NFC')
}

// Internals
// ---------------------------------------------------------------------------------------------

function graphemeCount(text: string): number {
  return Array.from(new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text)).length
}

const isDeepDive = (item: PlanItem): boolean => item.about !== null

/** The block-level checks, then each item's; the block's planned items (server minutes). */
function checkBlock(
  block: AiBlockInput,
  index: number,
  allow: AiPlanAllowance,
  seen: Set<string>,
  issues: AiPlanIssue[],
): PlanBlockItem[] {
  const path = `blocks[${index}]`
  if (!allow.activeTrackIds.has(block.trackId)) {
    issues.push({ path: `${path}.trackId`, code: 'inactive_track' })
  }
  const kindOk = AI_BLOCK_KINDS.includes(block.kind)
  if (!kindOk) issues.push({ path: `${path}.kind`, code: 'bad_kind' })
  const modeOk = blockModeOk(block)
  if (kindOk && !modeOk) issues.push({ path: `${path}.mode`, code: 'bad_mode' })
  if (block.itemIds.length === 0) issues.push({ path: `${path}.itemIds`, code: 'empty_block' })

  const items: PlanBlockItem[] = []
  block.itemIds.forEach((itemId, at) => {
    const itemPath = `${path}.itemIds[${at}]`
    const issue = (code: AiIssueCode, where = itemPath) =>
      issues.push({ path: where, code, itemId })

    if (seen.has(itemId)) return issue('duplicate_item')
    seen.add(itemId)
    if (itemId.startsWith(CUSTOM_ITEM_PREFIX) && !allow.ownCustomItems.has(itemId)) {
      return issue('not_own_custom')
    }
    const item = own(allow.catalog.items, itemId)
    if (item === undefined || item.status !== 'active') return issue('unknown_item')

    if (item.trackId !== block.trackId) {
      if (!allow.activeTrackIds.has(item.trackId)) issue('inactive_track')
      issue('track_mismatch')
    }
    if (!kindOk || !modeOk) return

    const planned = planItemOf(block, item, allow, issue, `${path}.kind`, `${path}.mode`)
    if (planned !== null) items.push(planned)
  })
  return items
}

/** The block's own mode: omitted or `new` for a new block; one of the review modes for a review
 *  or recap block; omitted or a review mode for a practice block. */
function blockModeOk(block: AiBlockInput): boolean {
  const { kind, mode } = block
  if (mode !== undefined && !(ITEM_MODES as readonly string[]).includes(mode)) return false
  if (kind === 'new') return mode === undefined || mode === 'new'
  if (kind === 'practice') return mode === undefined || REVIEW_BLOCK_MODES.includes(mode)
  return mode !== undefined && REVIEW_BLOCK_MODES.includes(mode)
}

/**
 * One item of a block whose kind and mode are valid: the allowance for its kind, the mode for the
 * item, and the planned item with the catalog's minutes (null when an issue was found).
 * - `new`: in `allowedNew`, mode `new`.
 * - `review` / `recap`: a deep-dive lesson in `openDeepDives` (planned `new`, as `buildPlan`
 *   places a deep-dive before its Weak problem, §5.4 step 3); else in `allowedReview` or
 *   `ownCustomItems`, with the block's mode as the item allows it (problems: recall, redo,
 *   explain-aloud; anything else: review).
 * - `practice`: no deep-dive; in `allowedReview` or `ownCustomItems`; the block's mode as above,
 *   or when omitted the item's default (a problem's quick recall, otherwise review).
 */
function planItemOf(
  block: AiBlockInput,
  item: PlanItem,
  allow: AiPlanAllowance,
  issue: (code: AiIssueCode, where?: string) => void,
  kindPath: string,
  modePath: string,
): PlanBlockItem | null {
  const planned = (mode: ItemMode): PlanBlockItem => ({
    itemId: item.id,
    mode,
    minutes: item.minutes[mode],
  })

  if (block.kind === 'new') {
    if (!allow.allowedNew.has(item.id)) return (issue('not_allowed_new'), null)
    return planned('new')
  }

  if (isDeepDive(item)) {
    if (block.kind === 'practice') return (issue('bad_kind', kindPath), null)
    if (!allow.openDeepDives.has(item.id)) return (issue('deep_dive_not_open'), null)
    return planned('new')
  }

  let ok = true
  if (!allow.allowedReview.has(item.id) && !allow.ownCustomItems.has(item.id)) {
    issue('not_allowed_review')
    ok = false
  }
  const mode = block.mode ?? (item.reviewModes ? 'recall' : 'review')
  const allowed = item.reviewModes ? PROBLEM_MODES.includes(mode) : mode === 'review'
  if (!allowed) {
    issue('bad_mode', modePath)
    ok = false
  }
  return ok ? planned(mode) : null
}
