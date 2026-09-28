import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { PlanCatalog } from '../catalog'
import { CATALOG, flat, MONDAY, planItem } from './__tests__/fixtures'
import {
  type AiBlockInput,
  type AiIssueCode,
  type AiPlanAllowance,
  type AiPlanInput,
  cleanRationale,
  RATIONALE_INPUT_MAX,
  RATIONALE_MAX_GRAPHEMES,
  validateAiPlan,
} from './ai'
import { planBlockSchema } from './types'

// ---------------------------------------------------------------------------------------------
// Fixture: the plan-engine catalog plus two custom items (one the user's own, one hidden)
// ---------------------------------------------------------------------------------------------

const OWN_CUSTOM = 'user:k3j9:ah-anagram-drill'
const HIDDEN_CUSTOM = 'user:k3j9:old-drill'

const AI_CATALOG: PlanCatalog = {
  ...CATALOG,
  items: {
    ...CATALOG.items,
    [OWN_CUSTOM]: planItem({
      id: OWN_CUSTOM,
      trackId: 'dsa',
      itemType: 'flashcard',
      minutes: { ...flat(1.5), review: 0.5 },
    }),
    [HIDDEN_CUSTOM]: planItem({
      id: HIDDEN_CUSTOM,
      trackId: 'dsa',
      itemType: 'flashcard',
      status: 'retired',
    }),
    'music:m1': planItem({ id: 'music:m1', trackId: 'music', itemType: 'flashcard' }),
  },
}

const ALLOW: AiPlanAllowance = {
  today: MONDAY,
  catalog: AI_CATALOG,
  activeTrackIds: new Set(['dsa', 'english']),
  budgets: { dsa: 60, english: 30 },
  allowedNew: new Set(['dsa:p5', 'dsa:p6', 'dsa:lesson-two-pointers', 'english:e5', 'english:e6']),
  allowedReview: new Set([
    'dsa:p1',
    'dsa:p2',
    'dsa:p3',
    'english:e1',
    'english:e2',
    'english:ex-w1-a',
    'english:prompt-w1',
  ]),
  ownCustomItems: new Set([OWN_CUSTOM]),
  openDeepDives: new Set(['dsa:lesson-deep-dive-p3']),
}

const RATIONALE = 'Ôn lại Group Anagrams vì lần trước chưa làm được, sau đó học tiếp Stack.'

const VALID: AiPlanInput = {
  targetDate: MONDAY,
  blocks: [
    {
      trackId: 'dsa',
      kind: 'review',
      itemIds: ['dsa:lesson-deep-dive-p3', 'dsa:p3'],
      mode: 'redo',
    },
    { trackId: 'dsa', kind: 'practice', itemIds: [OWN_CUSTOM] },
    { trackId: 'dsa', kind: 'new', itemIds: ['dsa:p5'] },
    { trackId: 'english', kind: 'review', itemIds: ['english:e1', 'english:e2'], mode: 'review' },
    { trackId: 'english', kind: 'new', itemIds: ['english:e5'] },
    { trackId: 'english', kind: 'review', itemIds: ['english:ex-w1-a'], mode: 'review' },
  ],
  rationale: RATIONALE,
}

const withBlocks = (...blocks: AiBlockInput[]): AiPlanInput => ({ ...VALID, blocks })

function issuesOf(input: AiPlanInput, allow: AiPlanAllowance = ALLOW) {
  const result = validateAiPlan(input, allow)
  if (result.ok) throw new Error('expected issues, got a valid plan')
  return result.issues
}

// ---------------------------------------------------------------------------------------------
// A valid plan
// ---------------------------------------------------------------------------------------------

describe('validateAiPlan: a valid plan', () => {
  it('returns the blocks with server minutes, numbered per kind within the track', () => {
    const result = validateAiPlan(VALID, ALLOW)
    expect(result).toEqual({
      ok: true,
      rationale: RATIONALE,
      blocks: [
        {
          id: '2026-09-28:dsa:review:1',
          trackId: 'dsa',
          kind: 'review',
          estMinutes: 25 + 21,
          items: [
            { itemId: 'dsa:lesson-deep-dive-p3', mode: 'new', minutes: 25 },
            { itemId: 'dsa:p3', mode: 'redo', minutes: 21 },
          ],
        },
        {
          id: '2026-09-28:dsa:practice:1',
          trackId: 'dsa',
          kind: 'practice',
          estMinutes: 0.5,
          items: [{ itemId: OWN_CUSTOM, mode: 'review', minutes: 0.5 }],
        },
        {
          id: '2026-09-28:dsa:new:1',
          trackId: 'dsa',
          kind: 'new',
          estMinutes: 20,
          items: [{ itemId: 'dsa:p5', mode: 'new', minutes: 20 }],
        },
        {
          id: '2026-09-28:english:review:1',
          trackId: 'english',
          kind: 'review',
          estMinutes: 1,
          items: [
            { itemId: 'english:e1', mode: 'review', minutes: 0.5 },
            { itemId: 'english:e2', mode: 'review', minutes: 0.5 },
          ],
        },
        {
          id: '2026-09-28:english:new:1',
          trackId: 'english',
          kind: 'new',
          estMinutes: 1.5,
          items: [{ itemId: 'english:e5', mode: 'new', minutes: 1.5 }],
        },
        {
          id: '2026-09-28:english:review:2',
          trackId: 'english',
          kind: 'review',
          estMinutes: 5,
          items: [{ itemId: 'english:ex-w1-a', mode: 'review', minutes: 5 }],
        },
      ],
    })
    if (result.ok) for (const block of result.blocks) planBlockSchema.parse(block)
  })

  it('ignores a minutes field the bot sends anyway', () => {
    const block = { trackId: 'dsa', kind: 'new', itemIds: ['dsa:p5'], minutes: 1 } as AiBlockInput
    const result = validateAiPlan(withBlocks(block), ALLOW)
    expect(result.ok && result.blocks[0]!.items[0]!.minutes).toBe(20)
  })

  it('accepts `new` as the mode of a new block, and a practice problem with its mode', () => {
    const result = validateAiPlan(
      withBlocks(
        { trackId: 'dsa', kind: 'new', itemIds: ['dsa:p5'], mode: 'new' },
        { trackId: 'dsa', kind: 'practice', itemIds: ['dsa:p1'], mode: 'explain-aloud' },
        { trackId: 'dsa', kind: 'practice', itemIds: ['dsa:p2'] },
        { trackId: 'english', kind: 'recap', itemIds: ['english:prompt-w1'], mode: 'review' },
      ),
      ALLOW,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.blocks.map((block) => block.id)).toEqual([
      '2026-09-28:dsa:new:1',
      '2026-09-28:dsa:practice:1',
      '2026-09-28:dsa:practice:2',
      '2026-09-28:english:recap:1',
    ])
    expect(result.blocks[1]!.items[0]).toEqual({
      itemId: 'dsa:p1',
      mode: 'explain-aloud',
      minutes: 5,
    })
    // A practice problem without a mode is a quick recall.
    expect(result.blocks[2]!.items[0]).toEqual({ itemId: 'dsa:p2', mode: 'recall', minutes: 5 })
  })

  it('accepts a track over budget by at most its largest item (the §5.4 invariant)', () => {
    // 60 + the 35-minute p6: 20 + 35 + 21 = 76 ≤ 60 + 35.
    const result = validateAiPlan(
      withBlocks(
        { trackId: 'dsa', kind: 'new', itemIds: ['dsa:p5', 'dsa:p6'] },
        { trackId: 'dsa', kind: 'review', itemIds: ['dsa:p2'], mode: 'redo' },
      ),
      ALLOW,
    )
    expect(result.ok).toBe(true)
  })

  it('returns the cleaned rationale', () => {
    const result = validateAiPlan({ ...VALID, rationale: '  <b>Ôn</b>   lại\n\tStack  ' }, ALLOW)
    expect(result.ok && result.rationale).toBe('Ôn lại Stack')
  })
})

// ---------------------------------------------------------------------------------------------
// One row per rule and code
// ---------------------------------------------------------------------------------------------

type Row = {
  readonly name: string
  readonly input: AiPlanInput
  readonly allow?: AiPlanAllowance
  readonly issues: readonly { path: string; code: AiIssueCode; itemId?: string }[]
}

const ROWS: readonly Row[] = [
  {
    name: 'the target date is not today',
    input: { ...VALID, targetDate: '2026-09-29' },
    issues: [{ path: 'targetDate', code: 'wrong_date' }],
  },
  {
    name: 'an item not in the catalog',
    input: withBlocks({ trackId: 'dsa', kind: 'new', itemIds: ['dsa:nope'] }),
    issues: [{ path: 'blocks[0].itemIds[0]', code: 'unknown_item', itemId: 'dsa:nope' }],
  },
  {
    name: 'a retired catalog item',
    input: withBlocks({ trackId: 'dsa', kind: 'review', itemIds: ['dsa:p8'], mode: 'recall' }),
    issues: [{ path: 'blocks[0].itemIds[0]', code: 'unknown_item', itemId: 'dsa:p8' }],
  },
  {
    name: 'an own-object key is not an item',
    input: withBlocks({ trackId: 'dsa', kind: 'new', itemIds: ['constructor'] }),
    issues: [{ path: 'blocks[0].itemIds[0]', code: 'unknown_item', itemId: 'constructor' }],
  },
  {
    name: 'a block of a track the user does not study',
    input: withBlocks({ trackId: 'music', kind: 'review', itemIds: ['music:m1'], mode: 'review' }),
    issues: [
      { path: 'blocks[0].trackId', code: 'inactive_track' },
      { path: 'blocks[0].itemIds[0]', code: 'not_allowed_review', itemId: 'music:m1' },
    ],
  },
  {
    name: "an item of another track than the block's",
    input: withBlocks({ trackId: 'dsa', kind: 'review', itemIds: ['english:e1'], mode: 'review' }),
    issues: [{ path: 'blocks[0].itemIds[0]', code: 'track_mismatch', itemId: 'english:e1' }],
  },
  {
    name: "an item of an inactive track in an active track's block",
    input: withBlocks({ trackId: 'dsa', kind: 'review', itemIds: ['music:m1'], mode: 'review' }),
    issues: [
      { path: 'blocks[0].itemIds[0]', code: 'inactive_track', itemId: 'music:m1' },
      { path: 'blocks[0].itemIds[0]', code: 'track_mismatch', itemId: 'music:m1' },
      { path: 'blocks[0].itemIds[0]', code: 'not_allowed_review', itemId: 'music:m1' },
    ],
  },
  {
    name: 'a new item beyond the allowed new items',
    input: withBlocks({ trackId: 'dsa', kind: 'new', itemIds: ['dsa:p7'] }),
    issues: [{ path: 'blocks[0].itemIds[0]', code: 'not_allowed_new', itemId: 'dsa:p7' }],
  },
  {
    name: 'a review item that is not due',
    input: withBlocks({ trackId: 'dsa', kind: 'review', itemIds: ['dsa:p4'], mode: 'recall' }),
    issues: [{ path: 'blocks[0].itemIds[0]', code: 'not_allowed_review', itemId: 'dsa:p4' }],
  },
  {
    name: 'a practice item that is neither custom nor due',
    input: withBlocks({ trackId: 'english', kind: 'practice', itemIds: ['english:ex-w2-a'] }),
    issues: [
      { path: 'blocks[0].itemIds[0]', code: 'not_allowed_review', itemId: 'english:ex-w2-a' },
    ],
  },
  {
    name: "someone else's custom item",
    input: withBlocks({ trackId: 'dsa', kind: 'practice', itemIds: ['user:zzzz:drill'] }),
    issues: [{ path: 'blocks[0].itemIds[0]', code: 'not_own_custom', itemId: 'user:zzzz:drill' }],
  },
  {
    name: 'a hidden (not active) custom item of the user',
    input: withBlocks({ trackId: 'dsa', kind: 'practice', itemIds: [HIDDEN_CUSTOM] }),
    issues: [{ path: 'blocks[0].itemIds[0]', code: 'not_own_custom', itemId: HIDDEN_CUSTOM }],
  },
  {
    name: 'a completed (not open) deep-dive',
    input: withBlocks({
      trackId: 'dsa',
      kind: 'review',
      itemIds: ['dsa:lesson-deep-dive-p3'],
      mode: 'recall',
    }),
    allow: { ...ALLOW, openDeepDives: new Set() },
    issues: [
      {
        path: 'blocks[0].itemIds[0]',
        code: 'deep_dive_not_open',
        itemId: 'dsa:lesson-deep-dive-p3',
      },
    ],
  },
  {
    name: 'a pattern lesson in a review block',
    input: withBlocks({
      trackId: 'dsa',
      kind: 'review',
      itemIds: ['dsa:lesson-arrays'],
      mode: 'review',
    }),
    issues: [
      { path: 'blocks[0].itemIds[0]', code: 'not_allowed_review', itemId: 'dsa:lesson-arrays' },
    ],
  },
  {
    name: 'a problem reviewed with plain review',
    input: withBlocks({ trackId: 'dsa', kind: 'review', itemIds: ['dsa:p1'], mode: 'review' }),
    issues: [{ path: 'blocks[0].mode', code: 'bad_mode', itemId: 'dsa:p1' }],
  },
  {
    name: 'a card reviewed with redo',
    input: withBlocks({
      trackId: 'english',
      kind: 'review',
      itemIds: ['english:e1'],
      mode: 'redo',
    }),
    issues: [{ path: 'blocks[0].mode', code: 'bad_mode', itemId: 'english:e1' }],
  },
  {
    name: 'a review block without a mode',
    input: withBlocks({ trackId: 'english', kind: 'review', itemIds: ['english:e1'] }),
    issues: [{ path: 'blocks[0].mode', code: 'bad_mode' }],
  },
  {
    name: 'a recap block with mode new',
    input: withBlocks({ trackId: 'english', kind: 'recap', itemIds: ['english:e1'], mode: 'new' }),
    issues: [{ path: 'blocks[0].mode', code: 'bad_mode' }],
  },
  {
    name: 'a new block with a review mode',
    input: withBlocks({ trackId: 'dsa', kind: 'new', itemIds: ['dsa:p5'], mode: 'recall' }),
    issues: [{ path: 'blocks[0].mode', code: 'bad_mode' }],
  },
  {
    name: 'a mode that does not exist',
    input: withBlocks({
      trackId: 'dsa',
      kind: 'review',
      itemIds: ['dsa:p1'],
      mode: 'skim' as AiBlockInput['mode'],
    }),
    issues: [{ path: 'blocks[0].mode', code: 'bad_mode' }],
  },
  {
    name: 'an extra block (the bot plans no extras)',
    input: withBlocks({
      trackId: 'dsa',
      kind: 'extra' as AiBlockInput['kind'],
      itemIds: ['dsa:p5'],
    }),
    issues: [{ path: 'blocks[0].kind', code: 'bad_kind' }],
  },
  {
    name: 'a deep-dive in a practice block',
    input: withBlocks({ trackId: 'dsa', kind: 'practice', itemIds: ['dsa:lesson-deep-dive-p3'] }),
    issues: [{ path: 'blocks[0].kind', code: 'bad_kind', itemId: 'dsa:lesson-deep-dive-p3' }],
  },
  {
    name: 'an item twice in the plan',
    input: withBlocks(
      { trackId: 'dsa', kind: 'review', itemIds: ['dsa:p1'], mode: 'recall' },
      { trackId: 'dsa', kind: 'practice', itemIds: ['dsa:p1'], mode: 'redo' },
    ),
    issues: [{ path: 'blocks[1].itemIds[0]', code: 'duplicate_item', itemId: 'dsa:p1' }],
  },
  {
    name: 'an empty block',
    input: withBlocks({ trackId: 'dsa', kind: 'new', itemIds: [] }),
    issues: [{ path: 'blocks[0].itemIds', code: 'empty_block' }],
  },
  {
    name: 'a track over budget + its largest item',
    // 20 + 35 new, + 21 + 12 + 21 redo = 109 > 60 + 35.
    input: withBlocks(
      { trackId: 'dsa', kind: 'new', itemIds: ['dsa:p5', 'dsa:p6'] },
      { trackId: 'dsa', kind: 'review', itemIds: ['dsa:p2', 'dsa:p1', 'dsa:p3'], mode: 'redo' },
    ),
    issues: [{ path: 'tracks.dsa', code: 'over_budget' }],
  },
  {
    name: 'over-budget items in a practice block (the block is not one item, ruling M6-R5)',
    // 20 + 35 new, + 21 + 12 + 21 redo in practice = 109 > 60 + 35 (the largest item).
    input: withBlocks(
      { trackId: 'dsa', kind: 'new', itemIds: ['dsa:p5', 'dsa:p6'] },
      { trackId: 'dsa', kind: 'practice', itemIds: ['dsa:p2', 'dsa:p1', 'dsa:p3'], mode: 'redo' },
    ),
    issues: [{ path: 'tracks.dsa', code: 'over_budget' }],
  },
  {
    name: 'a pattern lesson in a review block, even when the allowance lists it',
    input: withBlocks({
      trackId: 'dsa',
      kind: 'review',
      itemIds: ['dsa:lesson-arrays'],
      mode: 'review',
    }),
    allow: { ...ALLOW, allowedReview: new Set([...ALLOW.allowedReview, 'dsa:lesson-arrays']) },
    issues: [
      { path: 'blocks[0].itemIds[0]', code: 'not_allowed_review', itemId: 'dsa:lesson-arrays' },
    ],
  },
  {
    name: 'a pattern lesson in a practice block, even when the allowance lists it',
    input: withBlocks({ trackId: 'dsa', kind: 'practice', itemIds: ['dsa:lesson-arrays'] }),
    allow: { ...ALLOW, allowedReview: new Set([...ALLOW.allowedReview, 'dsa:lesson-arrays']) },
    issues: [
      { path: 'blocks[0].itemIds[0]', code: 'not_allowed_review', itemId: 'dsa:lesson-arrays' },
    ],
  },
  {
    name: 'a deep-dive in a new block, even when the allowance lists it',
    input: withBlocks({ trackId: 'dsa', kind: 'new', itemIds: ['dsa:lesson-deep-dive-p3'] }),
    allow: { ...ALLOW, allowedNew: new Set([...ALLOW.allowedNew, 'dsa:lesson-deep-dive-p3']) },
    issues: [{ path: 'blocks[0].kind', code: 'bad_kind', itemId: 'dsa:lesson-deep-dive-p3' }],
  },
  {
    name: 'an over-long rationale',
    input: { ...VALID, rationale: 'a'.repeat(RATIONALE_MAX_GRAPHEMES + 1) },
    issues: [{ path: 'rationale', code: 'rationale' }],
  },
]

describe('validateAiPlan: one row per rule', () => {
  it.each(ROWS)('$name', ({ input, allow, issues }) => {
    expect(issuesOf(input, allow)).toEqual(issues)
  })

  it('covers every issue code', () => {
    const codes = new Set(ROWS.flatMap((row) => row.issues.map((issue) => issue.code)))
    expect([...codes].sort()).toEqual(
      [
        'wrong_date',
        'unknown_item',
        'inactive_track',
        'not_allowed_new',
        'not_allowed_review',
        'not_own_custom',
        'deep_dive_not_open',
        'bad_mode',
        'bad_kind',
        'duplicate_item',
        'track_mismatch',
        'over_budget',
        'empty_block',
        'rationale',
      ].sort(),
    )
  })

  it('reports every issue of a plan, not only the first', () => {
    const issues = issuesOf({
      targetDate: '2026-09-27',
      blocks: [
        { trackId: 'dsa', kind: 'new', itemIds: ['dsa:p7'] },
        { trackId: 'english', kind: 'review', itemIds: [], mode: 'review' },
      ],
      rationale: RATIONALE,
    })
    expect(issues.map((issue) => issue.code)).toEqual([
      'wrong_date',
      'not_allowed_new',
      'empty_block',
    ])
  })
})

// ---------------------------------------------------------------------------------------------
// cleanRationale
// ---------------------------------------------------------------------------------------------

const graphemes = (text: string): number =>
  [...new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(text)].length

describe('cleanRationale', () => {
  it.each([
    ['<b>Ôn</b> lại <i>Stack</i>', 'Ôn lại Stack'],
    ['<script>alert(1)</script>Ôn', 'alert(1) Ôn'],
    ['Xem javascript:alert(1) nhé', 'Xem nhé'],
    ['Đọc https://example.com/a?b=c trước', 'Đọc trước'],
    ['Đọc [bài này](https://example.com) và www.example.com', 'Đọc bài này và'],
    ['**Ôn** `Stack` __ngay__', 'Ôn Stack ngay'],
    ['Ôn\u0000 lại\u0007\u001b Stack\u202e', 'Ôn lại Stack'],
    ['  Ôn\n\n\t lại   Stack \r\n', 'Ôn lại Stack'],
  ])('%j → %j', (input, expected) => {
    expect(cleanRationale(input)).toBe(expected)
  })

  it('normalizes NFD to NFC', () => {
    const nfd = 'Ôn lại'.normalize('NFD')
    expect(nfd).not.toBe('Ôn lại')
    expect(cleanRationale(nfd)).toBe('Ôn lại')
  })

  // `lib/domain` reads no clock, so the test's timeout is the time limit (the uncapped regexes
  // took ~3 s on this input).
  it('caps its input, so adversarial text returns promptly', { timeout: 1000 }, () => {
    const hostile = 'a.'.repeat(30_000)
    expect(cleanRationale(hostile).length).toBeLessThanOrEqual(RATIONALE_INPUT_MAX)
    expect(issuesOf({ ...VALID, rationale: hostile })).toEqual([
      { path: 'rationale', code: 'rationale' },
    ])
    // Only the first RATIONALE_INPUT_MAX units are read.
    expect(cleanRationale('Ôn '.padEnd(RATIONALE_INPUT_MAX, ' ') + 'lại')).toBe('Ôn')
  })

  it('counts graphemes, not code points: 280 passes, 281 is an issue', () => {
    // "ệ" + a combining acute that NFC cannot fold: two or more code points, one grapheme.
    const unit = 'ệ\u0301'
    const at = (n: number) => ({ ...VALID, rationale: unit.repeat(n).normalize('NFD') })
    expect(graphemes(cleanRationale(at(280).rationale))).toBe(280)
    expect(cleanRationale(at(280).rationale).length).toBeGreaterThan(280)
    expect(validateAiPlan(at(280), ALLOW).ok).toBe(true)
    expect(issuesOf(at(281))).toEqual([{ path: 'rationale', code: 'rationale' }])
  })
})

// ---------------------------------------------------------------------------------------------
// Property: never throws; a valid result satisfies the invariant and the block schema
// ---------------------------------------------------------------------------------------------

const CANDIDATES = [
  ...ALLOW.allowedNew,
  ...ALLOW.allowedReview,
  ...ALLOW.ownCustomItems,
  ...ALLOW.openDeepDives,
]
const KINDS = ['review', 'new', 'practice', 'recap'] as const
const MODES = [undefined, 'new', 'review', 'recall', 'redo', 'explain-aloud'] as const
const PROBLEM_MODES = ['recall', 'redo', 'explain-aloud'] as const

type Entry = { readonly itemId: string; readonly block: Omit<AiBlockInput, 'itemIds'> }

/** A kind and mode the item's allowance and type accept (a deep-dive takes any problem mode). */
function fitting(itemId: string): fc.Arbitrary<Omit<AiBlockInput, 'itemIds'>> {
  const item = AI_CATALOG.items[itemId]!
  const trackId = item.trackId
  if (ALLOW.allowedNew.has(itemId)) {
    return fc.constantFrom<Omit<AiBlockInput, 'itemIds'>>(
      { trackId, kind: 'new' },
      { trackId, kind: 'new', mode: 'new' },
    )
  }
  const modes = item.reviewModes || item.about !== null ? PROBLEM_MODES : (['review'] as const)
  const kinds =
    item.about !== null ? (['review', 'recap'] as const) : KINDS.filter((k) => k !== 'new')
  return fc.record({
    trackId: fc.constant(trackId),
    kind: fc.constantFrom(...kinds),
    mode: fc.constantFrom(...modes),
  })
}

/** Mostly fitting entries; one in eight gets a random track, kind and mode. */
const entry = (itemId: string): fc.Arbitrary<Entry> =>
  fc
    .oneof(
      { weight: 7, arbitrary: fitting(itemId) },
      {
        weight: 1,
        arbitrary: fc
          .record({
            trackId: fc.constantFrom('dsa', 'english'),
            kind: fc.constantFrom(...KINDS),
            mode: fc.constantFrom(...MODES),
          })
          .map(({ mode, ...rest }) => (mode === undefined ? rest : { ...rest, mode })),
      },
    )
    .map((block) => ({ itemId, block }))

/** Consecutive entries with the same track, kind and mode share a block, and so, when `join`
 *  says so, do those with the same track and kind (the block keeps the first mode) — so blocks of
 *  several items, practice ones included, are common. An item may repeat. */
const plans: fc.Arbitrary<AiBlockInput[]> = fc
  .tuple(
    fc.shuffledSubarray(CANDIDATES, { maxLength: 10 }),
    fc.subarray(CANDIDATES, { maxLength: 1 }),
  )
  .chain(([ids, again]) =>
    fc.tuple(...[...ids, ...again].map((id) => fc.tuple(entry(id), fc.boolean()))),
  )
  .map((entries) => {
    const blocks: { block: Omit<AiBlockInput, 'itemIds'>; itemIds: string[] }[] = []
    for (const [{ itemId, block }, join] of entries) {
      const last = blocks.at(-1)
      const same =
        last !== undefined &&
        last.block.trackId === block.trackId &&
        last.block.kind === block.kind &&
        (join || last.block.mode === block.mode)
      if (same) last.itemIds.push(itemId)
      else blocks.push({ block, itemIds: [itemId] })
    }
    return blocks.map(({ block, itemIds }) => ({ ...block, itemIds }))
  })

describe('validateAiPlan: property', () => {
  it('returns issues or blocks that satisfy the invariant — never throws', () => {
    // Tight budgets half the time: that is where the invariant's limit decides.
    const budget = fc.oneof(fc.integer({ min: 0, max: 30 }), fc.integer({ min: 0, max: 240 }))
    const budgets = fc.record({ dsa: budget, english: budget })
    let valid = 0
    fc.assert(
      fc.property(plans, budgets, (blocks, budgetOf) => {
        const result = validateAiPlan({ ...VALID, blocks }, { ...ALLOW, budgets: budgetOf })
        if (!result.ok) {
          expect(result.issues.length).toBeGreaterThan(0)
          return
        }
        if (result.blocks.length > 0) valid++
        for (const out of result.blocks) planBlockSchema.parse(out)
        for (const trackId of ['dsa', 'english'] as const) {
          // Computed here, not with the engine's helpers: the item minutes of the track's blocks.
          const minutes = result.blocks
            .filter((out) => out.trackId === trackId)
            .flatMap((out) => out.items.map((planned) => planned.minutes))
          const planned = minutes.reduce((sum, m) => sum + m, 0)
          const limit = budgetOf[trackId] + Math.max(0, ...minutes)
          expect(planned <= budgetOf[trackId] || planned <= limit).toBe(true)
        }
      }),
      { numRuns: 1000 },
    )
    // The generator reaches valid, non-empty plans, not only refusals.
    expect(valid).toBeGreaterThan(100)
  })
})

describe('validateAiPlan: property, practice blocks', () => {
  it('accepts a practice block exactly when its items keep the invariant (M6-R5)', () => {
    fc.assert(
      fc.property(
        fc.subarray(['dsa:p1', 'dsa:p2', 'dsa:p3'], { minLength: 1 }),
        fc.constantFrom(...PROBLEM_MODES),
        fc.integer({ min: 0, max: 80 }),
        (itemIds, mode, dsa) => {
          const result = validateAiPlan(
            withBlocks({ trackId: 'dsa', kind: 'practice', itemIds, mode }),
            { ...ALLOW, budgets: { dsa, english: 30 } },
          )
          const minutes = itemIds.map((id) => AI_CATALOG.items[id]!.minutes[mode])
          const planned = minutes.reduce((sum, m) => sum + m, 0)
          const keeps = planned <= dsa || planned <= dsa + Math.max(...minutes)
          expect(result.ok).toBe(keeps)
        },
      ),
      { numRuns: 300 },
    )
  })
})
