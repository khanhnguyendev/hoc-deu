import { describe, expect, it } from 'vitest'
import { placedItems, RECAP_MODES, roadmapSchema, weekSizes, type Roadmap } from './roadmap'

/** The §3.4 example: DSA 10w, week 1. */
const w1 = {
  week: 1,
  topics: ['arrays-hashing'],
  core: [
    'dsa:lc-0217',
    'dsa:lc-0242',
    'dsa:lc-0001',
    'dsa:lc-0049',
    'dsa:lc-0347',
    'dsa:lc-0238',
    'dsa:lc-0128',
    'dsa:lc-0036',
  ],
  bonus: [],
  recap: [
    { item: 'dsa:lc-0271' },
    { item: 'dsa:lc-0128', mode: 'redo' },
    { item: 'dsa:lc-0049', mode: 'explain-aloud' },
  ],
}

const w2 = {
  week: 2,
  topics: ['two-pointers'],
  core: [
    'dsa:lc-0125',
    'dsa:lc-0167',
    'dsa:lc-0015',
    'dsa:lc-0011',
    'dsa:lc-0042',
    'dsa:lc-0121',
    'dsa:lc-0003',
    'dsa:lc-0424',
  ],
}

function pathsOf(input: unknown): string[] {
  const result = roadmapSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('roadmapSchema', () => {
  it('parses the §3.4 10w week 1 example, with defaults for the missing lists', () => {
    const roadmap = roadmapSchema.parse({ id: '10w', weeks: [w1] })
    expect(roadmap.weeks[0]?.core).toHaveLength(8)
    expect(roadmap.weeks[0]?.decks).toEqual([])
    const english = roadmapSchema.parse({
      id: '10w',
      weeks: [{ week: 1, topics: ['standup'], decks: ['english:deck-w01-standup'] }],
    })
    expect(english.weeks[0]).toEqual({
      week: 1,
      topics: ['standup'],
      core: [],
      bonus: [],
      recap: [],
      decks: ['english:deck-w01-standup'],
    })
  })

  it('numbers weeks 1..n in file order', () => {
    expect(pathsOf({ id: '10w', weeks: [w1, { ...w2, week: 3 }] })).toEqual(['weeks.1.week'])
    expect(pathsOf({ id: '10w', weeks: [w2] })).toEqual(['weeks.0.week'])
  })

  it('places an item at most once across core, bonus and introducing recap entries', () => {
    expect(pathsOf({ id: '10w', weeks: [w1, { ...w2, bonus: ['dsa:lc-0001'] }] })).toEqual([
      'weeks.1.bonus.0',
    ])
    const introducedTwice = { ...w1, recap: [{ item: 'dsa:lc-0217' }] }
    expect(pathsOf({ id: '10w', weeks: [introducedTwice] })).toEqual(['weeks.0.recap.0'])
    const twiceInCore = { ...w2, core: ['dsa:lc-0125', 'dsa:lc-0125'] }
    expect(pathsOf({ id: '10w', weeks: [w1, twiceInCore] })).toEqual(['weeks.1.core.1'])
  })

  it('lets a recap entry with a mode revisit a placed item', () => {
    const recap = [{ item: 'dsa:lc-0001', mode: 'recall' }]
    expect(pathsOf({ id: '10w', weeks: [w1, { ...w2, recap }] })).toEqual([])
  })

  it('lists a deck at most once and a topic in at most one week', () => {
    const decks = ['english:deck-w01-standup']
    expect(
      pathsOf({
        id: '10w',
        weeks: [
          { week: 1, topics: ['standup'], decks },
          { week: 2, topics: ['code-review'], decks },
        ],
      }),
    ).toEqual(['weeks.1.decks.0'])
    expect(pathsOf({ id: '10w', weeks: [w1, { ...w2, topics: ['arrays-hashing'] }] })).toEqual([
      'weeks.1.topics.0',
    ])
  })

  it('rejects an unknown recap mode, a missing topic list and unknown keys', () => {
    const explain = { ...w1, recap: [{ item: 'dsa:lc-0049', mode: 'explain' }] }
    expect(pathsOf({ id: '10w', weeks: [explain] })).toEqual(['weeks.0.recap.0.mode'])
    expect(pathsOf({ id: '10w', weeks: [{ ...w1, topics: [] }] })).toEqual(['weeks.0.topics'])
    expect(pathsOf({ id: '10w', weeks: [{ ...w1, extras: [] }] })).toEqual(['weeks.0'])
    expect(pathsOf({ id: '10w', weeks: [] })).toEqual(['weeks'])
    expect(pathsOf({ id: '10W', weeks: [w1] })).toEqual(['id'])
    expect(pathsOf({ id: '10w', weeks: [{ ...w1, core: ['user:x'] }] })).toEqual(['weeks.0.core.0'])
  })

  it('lists the recap modes', () => {
    expect(RECAP_MODES).toEqual(['recall', 'redo', 'explain-aloud'])
  })
})

describe('placedItems', () => {
  it('is core, then recap entries without a mode, in queue order (§5.3); bonus is not placed', () => {
    const roadmap: Roadmap = roadmapSchema.parse({
      id: '10w',
      weeks: [{ ...w1, bonus: ['dsa:lc-0560'] }],
    })
    expect(placedItems(roadmap.weeks[0]!)).toEqual([...w1.core, 'dsa:lc-0271'])
  })
})

describe('weekSizes', () => {
  it('counts core items per week', () => {
    const roadmap = roadmapSchema.parse({ id: '10w', weeks: [w1, w2] })
    expect(weekSizes(roadmap, () => 0)).toEqual([8, 8])
  })

  it("adds the tier: core cards of each week's decks through the callback", () => {
    const roadmap = roadmapSchema.parse({
      id: '10w',
      weeks: [
        { week: 1, topics: ['standup'], decks: ['english:deck-w01-standup', 'english:deck-w01-x'] },
        { week: 2, topics: ['code-review'], decks: [] },
      ],
    })
    const cores: Record<string, number> = {
      'english:deck-w01-standup': 12,
      'english:deck-w01-x': 3,
    }
    const asked: string[] = []
    expect(
      weekSizes(roadmap, (deckId) => {
        asked.push(deckId)
        return cores[deckId] ?? 0
      }),
    ).toEqual([15, 0])
    expect(asked).toEqual(['english:deck-w01-standup', 'english:deck-w01-x'])
  })
})
