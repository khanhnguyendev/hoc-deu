import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import {
  DERIVED_FIELDS,
  derivedDeckSchema,
  LESSON_REFS,
  LESSON_RULES,
  lessonFormatSchema,
  srsSchema,
  TEMPLATE_PLACEHOLDERS,
  templateBlockSchema,
  topicCycle,
  TRACK_ACCENTS,
  trackManifestSchema,
  WEEKDAY_KEYS,
} from './manifest'

const repoFile = (...parts: string[]) => path.join(process.cwd(), ...parts)
const readManifest = (trackId: string): unknown =>
  parseYaml(readFileSync(repoFile('content', 'tracks', trackId, 'track.yaml'), 'utf8'))

type Issue = { path: string; message: string }

function issuesOf(input: unknown): Issue[] {
  const result = trackManifestSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }))
}
const pathsOf = (input: unknown) => issuesOf(input).map((issue) => issue.path)

type Manifest = Record<string, unknown>
const without = (manifest: Manifest, ...keys: string[]): Manifest =>
  Object.fromEntries(Object.entries(manifest).filter(([key]) => !keys.includes(key)))

const title = { vi: 'Chủ đề', en: 'Topic' }

/** A valid DSA-shaped manifest: every item type but exercise. */
const dsaLike: Manifest = {
  id: 'demo',
  status: 'active',
  title: { vi: 'Demo', en: 'Demo' },
  accent: 'track-1',
  itemTypes: ['lesson', 'problem', 'prompt', 'flashcard'],
  codeLanguages: ['python', 'java', 'go'],
  srs: {
    intervals: [7, 21, 60],
    relearnDays: 3,
    masteredAfter: 2,
    byType: { flashcard: { intervals: [1, 3, 7, 14], relearnDays: 1 } },
  },
  review: { recallMinutes: 5, redoFactor: 0.6 },
  topics: [
    { id: 'a', title, requires: [] },
    { id: 'b', title, signals: ['sorted input'], requires: ['a'] },
  ],
  lessonFormats: {
    pattern: {
      sections: ['signals', 'approach', 'quiz'],
      requires: ['anchor', 'practice'],
      rules: ['anchor!=practice', 'same-topic', 'one-per-topic'],
    },
  },
  defaults: { budgetMinutes: 60, newPerDay: null, throttle: [] },
  estimates: {
    lesson: 25,
    problem: { new: { E: 20, M: 35, H: 50 } },
    prompt: 10,
    flashcard: { new: 1.5, review: 0.5 },
  },
  roadmaps: [{ id: '8w', recommendedBelowMinutes: 75 }, { id: '10w' }],
  weeklyTemplate: {
    'mon-fri': [{ kind: 'review', maxMinutes: 15 }, { kind: 'new' }],
    sat: [{ kind: 'review' }],
    sun: [
      { kind: 'practice', tag: 'mock-interview', minutes: 45, fromWeek: 3 },
      { kind: 'recap', count: 3 },
    ],
  },
}

const explainingCode = {
  id: 'explaining-code',
  kind: 'derived',
  from: { track: 'dsa', itemType: 'problem' },
  unlock: 'attempted',
  map: {
    front: { template: 'Explain the optimal approach for {problem.title} in English.' },
    back: 'note.bilingual.en',
    hint: 'note.bilingual.vi',
  },
}

/** A valid English-shaped manifest: cards, exercises, prompts and a derived deck. */
const englishLike: Manifest = {
  id: 'demo-english',
  status: 'active',
  title: { vi: 'Tiếng Anh', en: 'English' },
  accent: 'track-2',
  itemTypes: ['flashcard', 'exercise', 'prompt'],
  srs: { intervals: [1, 3, 7, 14], relearnDays: 1, masteredAfter: 2 },
  defaults: {
    budgetMinutes: 25,
    newPerDay: 8,
    throttle: [
      { dueAbove: 40, newPerDay: 4 },
      { dueAbove: 60, newPerDay: 0 },
    ],
  },
  estimates: { flashcard: { new: 1.5, review: 0.5 }, exercise: 5, prompt: 10 },
  decks: [explainingCode],
  roadmaps: [{ id: '10w' }],
  weeklyTemplate: {
    'mon-fri': [
      { kind: 'practice', itemType: 'exercise', minutes: 5 },
      { kind: 'practice', tag: 'shadowing', minutes: 3 },
      { kind: 'review' },
      { kind: 'new' },
    ],
  },
}

describe('the real track manifests', () => {
  it('both parse, DSA with the §3.4 lesson formats and card estimates', () => {
    const dsa = trackManifestSchema.parse(readManifest('dsa'))
    expect(dsa.lessonFormats).toEqual({
      pattern: {
        sections: [
          'signals',
          'analogy',
          'visual',
          'approach',
          'code',
          'complexity',
          'bilingual',
          'practice',
          'quiz',
        ],
        requires: ['anchor', 'practice'],
        rules: ['anchor!=practice', 'same-topic', 'one-per-topic'],
      },
      'deep-dive': {
        sections: [
          'analogy',
          'visual',
          'approach',
          'code',
          'complexity',
          'bilingual',
          'practice',
          'quiz',
        ],
        requires: ['about', 'practice'],
        rules: ['practice!=about', 'same-topic', 'max-1-per-about'],
      },
    })
    expect(dsa.estimates.flashcard).toEqual({ new: 1.5, review: 0.5 })
    expect(dsa.topics.map((topic) => topic.id)).toContain('arrays-hashing')
    expect(dsa.topics[0]?.signals).toEqual([])

    const english = trackManifestSchema.parse(readManifest('english'))
    expect(english.decks.map((deck) => deck.id)).toEqual(['explaining-code'])
    expect(english.topics).toEqual([])
  })

  it('the fixtures above are valid', () => {
    expect(issuesOf(dsaLike)).toEqual([])
    expect(issuesOf(englishLike)).toEqual([])
  })

  it('every accent has a --track-N token in the token set (§3.6)', () => {
    const tokens = readFileSync(repoFile('docs', 'design', 'tokens.css'), 'utf8')
    for (const accent of TRACK_ACCENTS) {
      expect(tokens).toMatch(new RegExp(`--${accent}:`))
    }
  })
})

describe('trackManifestSchema — strict fields', () => {
  it('rejects an unknown top-level key', () => {
    const issues = issuesOf({ ...dsaLike, foo: 1 })
    expect(issues).toHaveLength(1)
    expect(issues[0]?.path).toBe('')
    expect(issues[0]?.message).toMatch(/foo/)
  })

  it('rejects the reserved track ID user', () => {
    expect(pathsOf({ ...dsaLike, id: 'user' })).toEqual(['id'])
  })

  it('rejects an unknown item type and a repeated one', () => {
    expect(pathsOf({ ...dsaLike, itemTypes: ['problem', 'video'] })).toEqual(['itemTypes.1'])
    expect(
      pathsOf({ ...dsaLike, itemTypes: ['lesson', 'problem', 'prompt', 'flashcard', 'prompt'] }),
    ).toEqual(['itemTypes'])
  })

  it('rejects an unknown or repeated code language', () => {
    expect(pathsOf({ ...dsaLike, codeLanguages: ['python', 'rust'] })).toEqual(['codeLanguages.1'])
    expect(pathsOf({ ...dsaLike, codeLanguages: ['go', 'go'] })).toEqual(['codeLanguages'])
  })

  it('roadmap IDs follow the database roadmap_variant rule and are unique', () => {
    expect(pathsOf({ ...dsaLike, roadmaps: [{ id: '8W' }] })).toEqual(['roadmaps.0.id'])
    expect(pathsOf({ ...dsaLike, roadmaps: [{ id: '8w' }, { id: '8w' }] })).toEqual(['roadmaps'])
  })

  it('keeps the M2 budget rule for the default minutes', () => {
    const defaults = { budgetMinutes: 245, newPerDay: null, throttle: [] }
    expect(pathsOf({ ...dsaLike, defaults })).toEqual(['defaults.budgetMinutes'])
  })

  it('names weeklyTemplate for an unknown weekday key', () => {
    const issues = issuesOf({ ...dsaLike, weeklyTemplate: { xyz: [{ kind: 'review' }] } })
    expect(issues[0]?.path).toBe('weeklyTemplate')
    expect(issues[0]?.message).toMatch(/xyz/)
  })
})

describe('trackManifestSchema — cross-field rules', () => {
  it('every listed item type has its estimate', () => {
    const estimates = { lesson: 25, prompt: 10, flashcard: { new: 1.5, review: 0.5 } }
    expect(pathsOf({ ...dsaLike, estimates })).toEqual(['estimates.problem'])
    const noExercise = { flashcard: { new: 1.5, review: 0.5 }, prompt: 10 }
    expect(pathsOf({ ...englishLike, estimates: noExercise })).toEqual(['estimates.exercise'])
  })

  it('a problem track needs review and codeLanguages', () => {
    expect(pathsOf(without(dsaLike, 'review'))).toEqual(['review'])
    expect(pathsOf(without(dsaLike, 'codeLanguages'))).toEqual(['codeLanguages'])
  })

  it('lesson is listed exactly when lessonFormats is present and non-empty', () => {
    expect(pathsOf(without(dsaLike, 'lessonFormats'))).toEqual(['lessonFormats'])
    expect(pathsOf({ ...dsaLike, lessonFormats: {} })).toEqual(['lessonFormats'])
    expect(pathsOf({ ...englishLike, lessonFormats: dsaLike.lessonFormats })).toEqual([
      'lessonFormats',
    ])
  })

  it('srs.byType names SRS item types the track lists', () => {
    const srs = (byType: unknown) => ({ ...(dsaLike.srs as object), byType })
    expect(pathsOf({ ...dsaLike, srs: srs({ lesson: { relearnDays: 1 } }) })).toEqual([
      'srs.byType.lesson',
    ])
    const englishSrs = { ...(englishLike.srs as object), byType: { problem: { relearnDays: 2 } } }
    expect(pathsOf({ ...englishLike, srs: englishSrs })).toEqual(['srs.byType.problem'])
  })

  it('SRS intervals increase strictly', () => {
    const srs = { ...(dsaLike.srs as object), intervals: [7, 3] }
    expect(pathsOf({ ...dsaLike, srs })).toEqual(['srs.intervals'])
    expect(
      srsSchema.safeParse({ intervals: [1, 1], relearnDays: 1, masteredAfter: 2 }).success,
    ).toBe(false)
    expect(srsSchema.safeParse({ intervals: [], relearnDays: 1, masteredAfter: 2 }).success).toBe(
      false,
    )
  })

  it('topic requires name a topic', () => {
    const topics = [
      { id: 'a', title, requires: [] },
      { id: 'b', title, requires: ['a', 'nope'] },
    ]
    const issues = issuesOf({ ...dsaLike, topics })
    expect(issues.map((issue) => issue.path)).toEqual(['topics.1.requires.1'])
    expect(issues[0]?.message).toMatch(/nope/)
  })

  it('topic IDs are unique', () => {
    const topics = [
      { id: 'a', title, requires: [] },
      { id: 'a', title, requires: [] },
    ]
    expect(pathsOf({ ...dsaLike, topics })).toEqual(['topics.1.id'])
  })

  it('topic requires form no cycle, and the message names the cycle', () => {
    const topics = [
      { id: 'a', title, requires: ['b'] },
      { id: 'b', title, requires: ['a'] },
    ]
    const issues = issuesOf({ ...dsaLike, topics })
    expect(issues.map((issue) => issue.path)).toEqual(['topics'])
    expect(issues[0]?.message).toContain('a → b → a')
  })

  it('decks need flashcards listed, and deck IDs are unique', () => {
    const noCards = { ...englishLike, itemTypes: ['exercise', 'prompt'] }
    expect(pathsOf({ ...noCards, decks: [explainingCode] })).toEqual(['decks'])
    expect(pathsOf({ ...noCards, decks: [] })).toEqual([])
    expect(pathsOf({ ...englishLike, decks: [explainingCode, explainingCode] })).toEqual([
      'decks.1.id',
    ])
  })

  it("a practice block's item type is one the track lists", () => {
    const weeklyTemplate = {
      'mon-fri': [{ kind: 'practice', itemType: 'exercise', minutes: 5 }, { kind: 'new' }],
    }
    expect(pathsOf({ ...dsaLike, weeklyTemplate })).toEqual(['weeklyTemplate.mon-fri.0.itemType'])
  })
})

describe('weekly template blocks', () => {
  const blockPaths = (sat: unknown[]) =>
    pathsOf({ ...dsaLike, weeklyTemplate: { ...(dsaLike.weeklyTemplate as object), sat } })

  it('a recap block needs a count', () => {
    expect(blockPaths([{ kind: 'recap' }])).toEqual(['weeklyTemplate.sat.0.count'])
  })

  it('a practice block needs minutes and exactly one of tag / itemType', () => {
    expect(blockPaths([{ kind: 'practice', minutes: 5 }])).toEqual(['weeklyTemplate.sat.0'])
    expect(
      blockPaths([{ kind: 'practice', minutes: 5, tag: 'mock-interview', itemType: 'prompt' }]),
    ).toEqual(['weeklyTemplate.sat.0'])
    expect(blockPaths([{ kind: 'practice', tag: 'mock-interview' }])).toEqual([
      'weeklyTemplate.sat.0.minutes',
    ])
  })

  it('each kind takes only its own fields', () => {
    const issues = issuesOf({
      ...dsaLike,
      weeklyTemplate: { sat: [{ kind: 'review', minutes: 5 }] },
    })
    expect(issues.map((issue) => issue.path)).toEqual(['weeklyTemplate.sat.0'])
    expect(issues[0]?.message).toMatch(/minutes/)
    expect(blockPaths([{ kind: 'new', count: 2 }])).toEqual(['weeklyTemplate.sat.0'])
    expect(blockPaths([{ kind: 'nap' }])).toEqual(['weeklyTemplate.sat.0.kind'])
  })

  it('any block may start from a roadmap week', () => {
    for (const block of [
      { kind: 'review', maxMinutes: 15, fromWeek: 2 },
      { kind: 'new', fromWeek: 2 },
      { kind: 'recap', count: 3, fromWeek: 2 },
      { kind: 'practice', itemType: 'prompt', minutes: 10, fromWeek: 2 },
    ]) {
      expect(templateBlockSchema.safeParse(block).success).toBe(true)
    }
    expect(templateBlockSchema.safeParse({ kind: 'new', fromWeek: 0 }).success).toBe(false)
  })

  it('lists the weekday keys in display order', () => {
    expect(WEEKDAY_KEYS).toEqual(['mon-fri', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })
})

describe('lesson formats', () => {
  it('lists the lesson references and rules', () => {
    expect(LESSON_REFS).toEqual(['anchor', 'practice', 'about'])
    expect(LESSON_RULES).toEqual([
      'anchor!=practice',
      'practice!=about',
      'same-topic',
      'one-per-topic',
      'max-1-per-about',
    ])
  })

  it('needs at least one section, each a unique kebab-case name', () => {
    expect(lessonFormatSchema.parse({ sections: ['overview'] })).toEqual({
      sections: ['overview'],
      requires: [],
      rules: [],
    })
    expect(lessonFormatSchema.safeParse({ sections: [] }).success).toBe(false)
    expect(lessonFormatSchema.safeParse({ sections: ['quiz', 'quiz'] }).success).toBe(false)
    expect(lessonFormatSchema.safeParse({ sections: ['Quiz'] }).success).toBe(false)
    expect(lessonFormatSchema.safeParse({ sections: ['quiz'], rules: ['nope'] }).success).toBe(
      false,
    )
    expect(lessonFormatSchema.safeParse({ sections: ['quiz'], requires: ['anchor'] }).success).toBe(
      true,
    )
  })

  it('format IDs are slugs', () => {
    const lessonFormats = { Pattern: { sections: ['quiz'] } }
    expect(pathsOf({ ...dsaLike, lessonFormats })).toEqual(['lessonFormats.Pattern'])
  })
})

describe('derived decks', () => {
  const mapIssues = (map: unknown) => {
    const result = derivedDeckSchema.safeParse({ ...explainingCode, map })
    return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
  }

  it('lists the mappable fields and template placeholders', () => {
    expect(DERIVED_FIELDS).toEqual(['note.bilingual.en', 'note.bilingual.vi', 'problem.title'])
    expect(TEMPLATE_PLACEHOLDERS).toEqual([
      'problem.title',
      'problem.leetcode',
      'problem.difficulty',
    ])
  })

  it('parses the English "Explaining code" deck', () => {
    expect(derivedDeckSchema.parse(explainingCode)).toEqual(explainingCode)
  })

  it('rejects a template placeholder outside the list, naming it', () => {
    const result = derivedDeckSchema.safeParse({
      ...explainingCode,
      map: { ...explainingCode.map, front: { template: 'Explain {problem.slug}.' } },
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path.join('.')).toBe('map.front.template')
    expect(result.error?.issues[0]?.message).toContain('{problem.slug}')
    const inManifest = issuesOf({
      ...englishLike,
      decks: [
        {
          ...explainingCode,
          map: { ...explainingCode.map, front: { template: 'Explain {problem.slug}.' } },
        },
      ],
    })
    expect(inManifest.map((issue) => issue.path)).toEqual(['decks.0.map.front.template'])
  })

  it('accepts every listed placeholder and rejects stray braces', () => {
    const template = '{problem.title} ({problem.leetcode}, {problem.difficulty})'
    expect(mapIssues({ front: { template }, back: 'problem.title' })).toEqual([])
    expect(
      mapIssues({ front: { template: 'Explain {problem.title' }, back: 'problem.title' }),
    ).toEqual(['map.front.template'])
  })

  it('rejects an unknown field, source type or unlock rule', () => {
    expect(mapIssues({ front: 'note.bilingual.fr', back: 'problem.title' })).toEqual(['map.front'])
    expect(mapIssues({ back: 'problem.title' })).toEqual(['map.front'])
    const lessons = { ...explainingCode, from: { track: 'dsa', itemType: 'lesson' } }
    expect(derivedDeckSchema.safeParse(lessons).success).toBe(false)
    expect(derivedDeckSchema.safeParse({ ...explainingCode, unlock: 'solved' }).success).toBe(false)
    expect(derivedDeckSchema.safeParse({ ...explainingCode, id: 'Explaining' }).success).toBe(false)
  })
})

describe('topicCycle', () => {
  it('returns null for an acyclic graph (unknown requires are ignored)', () => {
    expect(
      topicCycle([
        { id: 'a', requires: [] },
        { id: 'b', requires: ['a'] },
        { id: 'c', requires: ['a', 'b', 'nope'] },
      ]),
    ).toBeNull()
  })

  it('returns the cycle path', () => {
    expect(
      topicCycle([
        { id: 'a', requires: ['b'] },
        { id: 'b', requires: ['a'] },
      ]),
    ).toEqual(['a', 'b', 'a'])
    expect(
      topicCycle([
        { id: 'x', requires: [] },
        { id: 'a', requires: ['c'] },
        { id: 'b', requires: ['a'] },
        { id: 'c', requires: ['b'] },
      ]),
    ).toEqual(['a', 'c', 'b', 'a'])
    expect(topicCycle([{ id: 'a', requires: ['a'] }])).toEqual(['a', 'a'])
  })
})
