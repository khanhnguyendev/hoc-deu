import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { ItemStatus } from '@/lib/content/schemas/common'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import { derivedCards } from './derived'
import { loadContent, type LoadedContent } from './load'

const REPO = path.resolve(import.meta.dirname, '../..')
const OK = path.join(import.meta.dirname, '__fixtures__', 'content', 'ok')
const MANIFEST = 'tools/content/__fixtures__/content/ok/tracks/english/track.yaml'
const CARD_ID = 'english:explaining-code:dsa:lc-0001'

let loaded: LoadedContent
beforeAll(async () => {
  loaded = await loadContent({ repoRoot: REPO, contentDir: OK })
  expect(loaded.issues).toEqual([])
})

const itemsOf = (): Record<string, CatalogItem> =>
  Object.fromEntries(loaded.items.map((item) => [item.id, item]))

/** The ok items with Two Sum's problem and note statuses changed. */
function withTwoSum(problem: ItemStatus, note: ItemStatus): Record<string, CatalogItem> {
  const items = itemsOf()
  const twoSum = items['dsa:lc-0001']
  if (twoSum?.type !== 'problem' || twoSum.content.note === null) throw new Error('no Two Sum note')
  items[twoSum.id] = {
    ...twoSum,
    status: problem,
    content: { ...twoSum.content, status: problem, note: { ...twoSum.content.note, status: note } },
  }
  return items
}

const run = (
  items: Record<string, CatalogItem> = itemsOf(),
  lockedIds: ReadonlySet<string> = new Set(),
  tracks: readonly TrackManifest[] = loaded.tracks,
) => derivedCards({ tracks, items, lockedIds, manifestFiles: loaded.manifestFiles })

describe('derivedCards', () => {
  it('builds one card per noted, active problem (§3.4 "Explaining code")', () => {
    const { cards, decks } = run()
    expect(cards).toEqual([
      {
        id: CARD_ID,
        type: 'flashcard',
        trackId: 'english',
        localId: 'explaining-code:dsa:lc-0001',
        topicId: null,
        week: null,
        status: 'active',
        title: 'Explain the optimal approach for Two Sum in English.',
        source: MANIFEST,
        content: {
          id: CARD_ID,
          tier: 'derived',
          front: 'Explain the optimal approach for Two Sum in English.',
          back: 'Store each number in a hash map to look up its complement in O(1).',
          hint: 'Lưu mỗi số vào hash map để tìm phần bù trong O(1).',
          tags: [],
          status: 'active',
          deckId: 'english:explaining-code',
          lang: { front: 'en', back: 'en', hint: 'vi' },
          derivedFrom: 'dsa:lc-0001',
        },
      },
    ])
    expect(decks).toEqual([
      {
        id: 'english:explaining-code',
        trackId: 'english',
        kind: 'derived',
        week: null,
        topicId: null,
        title: { vi: 'explaining-code', en: 'explaining-code' },
        status: 'active',
        cardIds: [CARD_ID],
      },
    ])
  })

  it('a draft note gives no card; the deck stays, empty', () => {
    const { cards, decks } = run(withTwoSum('active', 'draft'))
    expect(cards).toEqual([])
    expect(decks.map((deck) => deck.cardIds)).toEqual([[]])
  })

  it('a draft problem with an active note gives a draft card', () => {
    const { cards } = run(withTwoSum('draft', 'active'))
    expect(cards.map((card) => [card.id, card.status, card.content.status])).toEqual([
      [CARD_ID, 'draft', 'draft'],
    ])
  })

  it('a retired problem gives no card', () => {
    expect(run(withTwoSum('retired', 'active')).cards).toEqual([])
  })

  it('a locked card whose note became a draft stays, retired (decision 8)', () => {
    const { cards, decks } = run(withTwoSum('active', 'draft'), new Set([CARD_ID]))
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      id: CARD_ID,
      status: 'retired',
      title: 'Explain the optimal approach for Two Sum in English.',
      content: { status: 'retired', tier: 'derived', derivedFrom: 'dsa:lc-0001' },
    })
    expect(decks[0]?.cardIds).toEqual([CARD_ID])
  })

  it('a locked card whose problem is gone stays, retired, its text the source ID', () => {
    const items = itemsOf()
    delete items['dsa:lc-0001']
    const { cards } = run(items, new Set([CARD_ID, 'english:other-deck:dsa:lc-0001']))
    expect(
      cards.map((card) => [card.id, card.status, card.content.front, card.content.back]),
    ).toEqual([[CARD_ID, 'retired', 'dsa:lc-0001', 'dsa:lc-0001']])
  })

  it('fills the map from problem fields, the note and templates, with each side in its language', () => {
    const tracks = loaded.tracks.map((track) =>
      track.id !== 'english'
        ? track
        : {
            ...track,
            decks: track.decks.map((deck) => ({
              ...deck,
              title: { vi: 'Giải thích code', en: 'Explaining code' },
              map: {
                front: 'problem.title' as const,
                back: 'note.bilingual.vi' as const,
                hint: { template: 'LeetCode {problem.leetcode} ({problem.difficulty})' },
              },
            })),
          },
    )
    const { cards, decks } = run(itemsOf(), new Set(), tracks)
    expect(cards[0]?.content).toMatchObject({
      front: 'Two Sum',
      back: 'Lưu mỗi số vào hash map để tìm phần bù trong O(1).',
      hint: 'LeetCode 1 (E)',
      lang: { front: 'en', back: 'vi', hint: 'en' },
    })
    expect(decks[0]?.title).toEqual({ vi: 'Giải thích code', en: 'Explaining code' })
  })

  it('a map without a hint gives a card without one', () => {
    const tracks = loaded.tracks.map((track) => ({
      ...track,
      decks: track.decks.map((deck) => ({
        ...deck,
        map: { front: deck.map.front, back: deck.map.back },
      })),
    }))
    const card = run(itemsOf(), new Set(), tracks).cards[0]
    expect(card?.content.hint).toBeUndefined()
    expect(card?.content.lang).toEqual({ front: 'en', back: 'en', hint: 'en' })
  })
})
