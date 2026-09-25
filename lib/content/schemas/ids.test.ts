import { describe, expect, it } from 'vitest'
import { ROADMAP_VARIANT_PATTERN } from '@/lib/domain/settings'
import {
  derivedCardId,
  isReservedId,
  itemIdSchema,
  LOCAL_ID_PREFIX,
  parseDerivedId,
  parseItemId,
  parseProblemFolder,
  problemLocalId,
  RESERVED_TRACK_ID,
  slugSchema,
  SLUG_PATTERN,
  trackIdSchema,
} from './ids'

describe('parseItemId', () => {
  it('splits a track ID and a local ID', () => {
    expect(parseItemId('dsa:lc-0001')).toEqual({ trackId: 'dsa', localId: 'lc-0001' })
    expect(parseItemId('english:w01-blocker')).toEqual({
      trackId: 'english',
      localId: 'w01-blocker',
    })
  })

  it.each([
    'DSA:lc-0001',
    'dsa:lc-0001 ',
    ' dsa:lc-0001',
    'dsa:',
    ':lc-0001',
    'dsa',
    'dsa:Lc-1',
    'dsa:bài-1', // [RF-3] ASCII only
    'dsa:-lc',
    'dsa:lc_0001',
    'dsa:lc-0001:x',
    '1dsa:lc-0001',
    'user:abc',
    'user:x:y',
    `dsa:${'a'.repeat(65)}`,
  ])('rejects %j', (id) => {
    expect(parseItemId(id)).toBeNull()
  })

  it('accepts a 64-character local ID', () => {
    expect(parseItemId(`dsa:${'a'.repeat(64)}`)?.localId).toHaveLength(64)
  })
})

describe('reserved IDs', () => {
  it('reserves the user: prefix and the track ID user', () => {
    expect(RESERVED_TRACK_ID).toBe('user')
    expect(isReservedId('user:abc')).toBe(true)
    expect(isReservedId('user:x:y')).toBe(true)
    expect(isReservedId('dsa:user')).toBe(false)
    expect(isReservedId('users:abc')).toBe(false)
  })

  it('trackIdSchema rejects user and anything outside the pattern', () => {
    expect(trackIdSchema.safeParse('dsa').success).toBe(true)
    expect(trackIdSchema.safeParse('system-design').success).toBe(true)
    expect(trackIdSchema.safeParse('user').success).toBe(false)
    expect(trackIdSchema.safeParse('1dsa').success).toBe(false)
    expect(trackIdSchema.safeParse('Dsa').success).toBe(false)
    expect(trackIdSchema.safeParse('a'.repeat(33)).success).toBe(false)
  })

  it('itemIdSchema says why a reserved ID is rejected', () => {
    const result = itemIdSchema.safeParse('user:abc')
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toMatch(/reserved/)
    expect(itemIdSchema.safeParse('dsa:lc-0001').success).toBe(true)
    expect(itemIdSchema.safeParse('dsa:lc-0001:x').success).toBe(false)
  })
})

describe('parseDerivedId / derivedCardId', () => {
  it('splits a derived card ID into track, deck and source item', () => {
    expect(parseDerivedId('english:explaining-code:dsa:lc-0001')).toEqual({
      trackId: 'english',
      deckId: 'explaining-code',
      sourceId: 'dsa:lc-0001',
    })
  })

  it.each([
    'english:explaining-code',
    'english:explaining-code:dsa',
    'english:explaining-code:dsa:lc-0001:x',
    'english:Explaining:dsa:lc-0001',
    'user:explaining-code:dsa:lc-0001',
    'english:explaining-code:user:abc',
  ])('rejects %j', (id) => {
    expect(parseDerivedId(id)).toBeNull()
  })

  it('builds the ID parseDerivedId reads back', () => {
    const id = derivedCardId('english', 'explaining-code', 'dsa:lc-0001')
    expect(id).toBe('english:explaining-code:dsa:lc-0001')
    expect(parseDerivedId(id)).toEqual({
      trackId: 'english',
      deckId: 'explaining-code',
      sourceId: 'dsa:lc-0001',
    })
  })
})

describe('problem IDs and folders', () => {
  it('zero-pads the LeetCode number to at least four digits', () => {
    expect(problemLocalId(1)).toBe('lc-0001')
    expect(problemLocalId(1143)).toBe('lc-1143')
    expect(problemLocalId(10000)).toBe('lc-10000')
  })

  it('parses a problem folder name', () => {
    expect(parseProblemFolder('lc-0001-two-sum')).toEqual({ leetcode: 1, slug: 'two-sum' })
    expect(parseProblemFolder('lc-0015-3sum')).toEqual({ leetcode: 15, slug: '3sum' })
    expect(
      parseProblemFolder('lc-0105-construct-binary-tree-from-preorder-and-inorder-traversal'),
    ).toEqual({
      leetcode: 105,
      slug: 'construct-binary-tree-from-preorder-and-inorder-traversal',
    })
    expect(parseProblemFolder('lc-10000-some-problem')).toEqual({
      leetcode: 10000,
      slug: 'some-problem',
    })
    expect(parseProblemFolder(`lc-0001-${'a'.repeat(80)}`)?.slug).toHaveLength(80)
  })

  it.each([
    'lc-1-two-sum',
    'lc-0001',
    'lc-0001-',
    'lc-0001-Two-Sum',
    'lc-0001-two_sum',
    'lc-0001-two--sum',
    'lc-0001--two-sum',
    'lc-0001-two-sum-',
    'lc-00001-two-sum', // not canonical: 1 is lc-0001
    'lc-0000-zero',
    'LC-0001-two-sum',
    `lc-0001-${'a'.repeat(81)}`,
  ])('rejects the folder %j', (name) => {
    expect(parseProblemFolder(name)).toBeNull()
  })
})

describe('slugs and local ID prefixes', () => {
  it('slugs are the database roadmap_variant rule (topics, variants, formats, tags)', () => {
    expect(SLUG_PATTERN.source).toBe(ROADMAP_VARIANT_PATTERN.source)
    expect(slugSchema.safeParse('two-pointers').success).toBe(true)
    expect(slugSchema.safeParse('8w').success).toBe(true)
    expect(slugSchema.safeParse('Two').success).toBe(false)
    expect(slugSchema.safeParse('-a').success).toBe(false)
    expect(slugSchema.safeParse('a'.repeat(33)).success).toBe(false)
  })

  it('lists the local ID prefix of each prefixed item kind', () => {
    expect(LOCAL_ID_PREFIX).toEqual({
      problem: 'lc-',
      lesson: 'lesson-',
      deck: 'deck-',
      exercise: 'ex-',
      prompt: 'prompt-',
    })
  })
})
