import { describe, expect, it } from 'vitest'
import type { PlanItem } from '@/lib/domain/catalog'
import { CATALOG, itemState } from '@/lib/domain/plan/__tests__/fixtures'
import { cardItem, derivedCardItem, problemItem } from './fixtures'
import {
  cardSidesOf,
  flashcardSides,
  isDue,
  itemActionsFor,
  modesFor,
  outcomeInput,
  resolveMode,
} from './outcome'

const TODAY = '2026-10-05'
const item = (id: string): PlanItem => {
  const found = CATALOG.items[id]
  if (found === undefined) throw new Error(`no fixture item ${id}`)
  return found
}
const PROBLEM = item('dsa:p2')
const CARD = item('english:e1')
const EXERCISE = item('english:ex-w1-a')
const PROMPT = item('dsa:prompt-mock')

/** A problem introduced a week ago: `ok`, due on `dueOn`. */
const problemState = (dueOn: string | null, patch = {}) =>
  itemState('dsa:p2', '2026-09-28', { dueOn, ...patch })

describe('modesFor (the modes a page may be opened in)', () => {
  it('problems: new, quick recall, redo and explain-aloud (§5.5); never plain review', () => {
    expect(modesFor(PROBLEM)).toEqual(['new', 'recall', 'redo', 'explain-aloud'])
  })

  it('every other item: new, or review (a due card, an introduced practice item)', () => {
    for (const other of [CARD, EXERCISE, PROMPT]) expect(modesFor(other)).toEqual(['new', 'review'])
  })
})

describe('isDue (§5.4 step 3, as the due queue)', () => {
  it('is due on or after its due day', () => {
    expect(isDue(PROBLEM, problemState(TODAY), TODAY)).toBe(true)
    expect(isDue(PROBLEM, problemState('2026-10-01'), TODAY)).toBe(true)
    expect(isDue(PROBLEM, problemState('2026-10-06'), TODAY)).toBe(false)
    expect(isDue(PROBLEM, problemState(null), TODAY)).toBe(false)
  })

  it('never when mastered, skipped, or the item is completion-only', () => {
    expect(isDue(PROBLEM, problemState(TODAY, { status: 'mastered' }), TODAY)).toBe(false)
    expect(isDue(PROBLEM, problemState(TODAY, { status: 'skipped' }), TODAY)).toBe(false)
    const done = itemState('english:ex-w1-a', '2026-09-28', { dueOn: TODAY })
    expect(isDue(EXERCISE, done, TODAY)).toBe(false)
  })
})

describe('resolveMode', () => {
  const base = { item: PROBLEM, requested: undefined, planMode: null, state: null, today: TODAY }

  it('takes a valid ?mode= first — over the plan block and the review mode', () => {
    expect(resolveMode({ ...base, requested: 'recall' })).toBe('recall')
    expect(resolveMode({ ...base, requested: 'redo', planMode: 'new' })).toBe('redo')
    expect(resolveMode({ ...base, requested: 'explain-aloud', state: problemState(TODAY) })).toBe(
      'explain-aloud',
    )
    expect(resolveMode({ ...base, item: CARD, requested: 'review' })).toBe('review')
  })

  it('ignores an invalid ?mode= (unknown, or not a mode of the item)', () => {
    expect(resolveMode({ ...base, requested: 'hard' })).toBe('new')
    expect(resolveMode({ ...base, requested: 'review' })).toBe('new')
    expect(resolveMode({ ...base, item: CARD, requested: 'recall' })).toBe('new')
    expect(resolveMode({ ...base, requested: '__proto__' })).toBe('new')
    expect(resolveMode({ ...base, requested: 'toString', planMode: 'redo' })).toBe('redo')
  })

  it("else the current plan block's mode for the item", () => {
    expect(resolveMode({ ...base, planMode: 'redo' })).toBe('redo')
    expect(resolveMode({ ...base, planMode: 'explain-aloud', state: problemState(TODAY) })).toBe(
      'explain-aloud',
    )
    expect(resolveMode({ ...base, item: EXERCISE, planMode: 'review' })).toBe('review')
    // A block mode the item cannot take is ignored like an invalid ?mode=.
    expect(resolveMode({ ...base, item: CARD, planMode: 'redo' })).toBe('new')
  })

  it('else the review mode of an introduced, due SRS item (reviewMode)', () => {
    expect(resolveMode({ ...base, state: problemState(TODAY) })).toBe('recall')
    expect(resolveMode({ ...base, state: problemState(TODAY, { weak: true }) })).toBe('redo')
    const card = itemState('english:e1', '2026-10-01', { dueOn: '2026-10-02' })
    expect(resolveMode({ ...base, item: CARD, state: card })).toBe('review')
  })

  it("else 'new' — not introduced, not due yet, mastered or skipped", () => {
    expect(resolveMode(base)).toBe('new')
    expect(resolveMode({ ...base, state: problemState('2026-10-12') })).toBe('new')
    expect(resolveMode({ ...base, state: problemState(TODAY, { status: 'mastered' }) })).toBe('new')
    expect(resolveMode({ ...base, state: problemState(TODAY, { status: 'skipped' }) })).toBe('new')
  })
})

describe('itemActionsFor (§5.7)', () => {
  const view = (status: 'weak' | 'ok' | 'strong' | 'mastered' | 'skipped') => ({
    status,
    level: 2,
    dueOn: null,
  })

  it('offers "Bỏ qua mục này" while the item is not introduced or is due', () => {
    expect(itemActionsFor({ state: null, due: false })).toEqual({ skip: true, readd: false })
    expect(itemActionsFor({ state: view('ok'), due: true })).toEqual({ skip: true, readd: false })
    expect(itemActionsFor({ state: view('ok'), due: false })).toEqual({ skip: false, readd: false })
    expect(itemActionsFor({ state: view('skipped'), due: false })).toEqual({
      skip: false,
      readd: false,
    })
  })

  it('offers "Ôn lại" on a mastered item', () => {
    expect(itemActionsFor({ state: view('mastered'), due: false })).toEqual({
      skip: false,
      readd: true,
    })
  })
})

describe('outcomeInput (the OutcomeInput a control sends)', () => {
  const record = async () => ({ ok: true, message: '', autoCheckedIn: [] })
  const target = { requestId: 'r', itemId: 'dsa:p2', record }

  it('sends the block when the page has one, and nothing else of the binding', () => {
    expect(
      outcomeInput({ ...target, blockId: 'b' }, { type: 'item.result', result: 'solved' }),
    ).toEqual({
      requestId: 'r',
      itemId: 'dsa:p2',
      blockId: 'b',
      outcome: { type: 'item.result', result: 'solved' },
    })
  })

  it('omits blockId when there is none (off-plan)', () => {
    const input = outcomeInput(target, { type: 'item.skipped' })
    expect(input).toEqual({ requestId: 'r', itemId: 'dsa:p2', outcome: { type: 'item.skipped' } })
    expect(input).not.toHaveProperty('blockId')
  })
})

describe('flashcardSides (the one FlashcardContent → FlashcardSides mapping, task 5.3 review M4)', () => {
  it('picks the sides FlashcardView renders, nothing else', () => {
    const card = cardItem().content
    expect(flashcardSides(card)).toEqual({
      front: card.front,
      back: card.back,
      hint: card.hint,
      usage: card.usage,
      example: card.example,
      pronunciation: card.pronunciation,
      lang: card.lang,
    })
  })

  it('a derived card (no hint, no usage) maps just as plainly', () => {
    const card = derivedCardItem().content
    expect(flashcardSides(card)).toEqual({
      front: card.front,
      back: card.back,
      hint: card.hint,
      usage: card.usage,
      example: card.example,
      pronunciation: card.pronunciation,
      lang: card.lang,
    })
  })
})

describe('cardSidesOf (m-5: the one "is this a card, and its sides")', () => {
  it('gives a flashcard’s sides, and null for any other item', () => {
    const card = cardItem()
    expect(cardSidesOf(card)).toEqual(flashcardSides(card.content))
    expect(cardSidesOf(problemItem())).toBeNull()
  })
})
