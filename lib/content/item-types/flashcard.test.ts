import { describe, expect, it } from 'vitest'
import {
  CARD_TIERS,
  cardSchema,
  deckFileSchema,
  flashcardType,
  PARTS_OF_SPEECH,
  REGISTERS,
} from './flashcard'

const blocker = {
  id: 'english:w01-blocker',
  tier: 'core',
  front: 'blocker',
  back: 'vấn đề đang chặn, khiến không làm tiếp được',
  usage: { pos: 'noun', register: 'neutral', note: 'Hay dùng trong daily stand-up.' },
  example: "I have one blocker: I'm waiting for access to the staging database.",
  pronunciation: '/ˈblɒk.ər/',
  tags: ['standup'],
}

const standupDeck = {
  id: 'english:deck-w01-standup',
  kind: 'vocabulary',
  week: 1,
  topic: 'standup',
  title: { vi: 'Họp stand-up', en: 'Stand-up meetings' },
  cards: [blocker, { ...blocker, id: 'english:w01-eta', front: 'ETA', tier: 'extended' }],
}

const patternDeck = {
  id: 'dsa:deck-patterns',
  kind: 'recall',
  week: 1,
  topic: 'arrays-hashing',
  title: { vi: 'Nhận diện pattern', en: 'Pattern recall' },
  lang: { front: 'vi', back: 'en' },
  cards: [
    {
      id: 'dsa:pattern-hash-map-lookup',
      tier: 'core',
      front: 'Tìm cặp có tổng bằng target trong O(n)?',
      back: 'Hash map: value → index',
    },
  ],
}

function deckPaths(input: unknown): string[] {
  const result = deckFileSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

function cardPaths(input: unknown): string[] {
  const result = cardSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('deckFileSchema', () => {
  it('parses a vocabulary deck, defaulting lang to en → vi', () => {
    const deck = deckFileSchema.parse(standupDeck)
    expect(deck.lang).toEqual({ front: 'en', back: 'vi' })
    expect(deck.status).toBe('active')
    expect(deck.cards.map((card) => card.id)).toEqual(['english:w01-blocker', 'english:w01-eta'])
  })

  it('requires usage, example and pronunciation on every vocabulary card', () => {
    const cards = [{ ...blocker, pronunciation: undefined }]
    expect(deckPaths({ ...standupDeck, cards })).toEqual(['cards.0.pronunciation'])
    const bare = { id: 'english:w01-bare', tier: 'core', front: 'bare', back: 'trống' }
    expect(deckPaths({ ...standupDeck, cards: [blocker, bare] })).toEqual([
      'cards.1.usage',
      'cards.1.example',
      'cards.1.pronunciation',
    ])
  })

  it('does not require them in a recall deck', () => {
    expect(deckPaths(patternDeck)).toEqual([])
    expect(deckFileSchema.parse(patternDeck).lang).toEqual({ front: 'vi', back: 'en' })
  })

  it('rejects duplicate card IDs', () => {
    expect(deckPaths({ ...standupDeck, cards: [blocker, blocker] })).toEqual(['cards.1.id'])
  })

  it('rejects tier: derived in a deck file', () => {
    const derived = { ...blocker, id: 'english:explaining-code:dsa:lc-0001', tier: 'derived' }
    expect(deckPaths({ ...standupDeck, cards: [derived] })).toEqual(['cards.0.tier'])
  })

  it('checks the deck ID, kind, lang and card count', () => {
    expect(deckPaths({ ...standupDeck, id: 'english:w01-standup' })).toEqual(['id'])
    expect(deckPaths({ ...standupDeck, kind: 'grammar' })).toEqual(['kind'])
    expect(deckPaths({ ...standupDeck, lang: { front: 'en', back: 'fr' } })).toEqual(['lang.back'])
    expect(deckPaths({ ...standupDeck, cards: [] })).toEqual(['cards'])
    expect(deckPaths({ ...standupDeck, week: 0 })).toEqual(['week'])
  })
})

describe('cardSchema', () => {
  it('lists parts of speech, registers and tiers', () => {
    expect(PARTS_OF_SPEECH).toEqual([
      'noun',
      'verb',
      'adjective',
      'adverb',
      'phrase',
      'phrasal-verb',
      'idiom',
      'abbreviation',
    ])
    expect(REGISTERS).toEqual(['formal', 'neutral', 'informal'])
    expect(CARD_TIERS).toEqual(['core', 'extended', 'derived'])
  })

  it('rejects an unknown part of speech, a missing front and unknown keys', () => {
    expect(cardPaths({ ...blocker, usage: { pos: 'pronoun', register: 'neutral' } })).toEqual([
      'usage.pos',
    ])
    expect(cardPaths({ ...blocker, front: '' })).toEqual(['front'])
    expect(cardPaths({ ...blocker, meaning: 'x' })).toEqual([''])
  })

  it('keeps a card local ID clear of the other item prefixes', () => {
    for (const id of [
      'english:lc-0001',
      'english:lesson-x',
      'english:deck-x',
      'english:ex-x',
      'english:prompt-x',
    ]) {
      expect(cardPaths({ ...blocker, id })).toEqual(['id'])
    }
  })

  it('gives a derived card a derived ID, and only a derived card', () => {
    const derived = {
      id: 'english:explaining-code:dsa:lc-0001',
      tier: 'derived',
      front: 'Explain the optimal approach for Two Sum in English.',
      back: 'Store each value in a hash map and look up target − value.',
    }
    expect(cardPaths(derived)).toEqual([])
    expect(cardPaths({ ...derived, tier: 'core' })).toEqual(['id'])
    expect(cardPaths({ ...blocker, tier: 'derived' })).toEqual(['id'])
  })
})

describe('flashcardType', () => {
  it('maps know / unsure / dont_know and uses spaced repetition', () => {
    expect(flashcardType.type).toBe('flashcard')
    expect(flashcardType.outcomes).toEqual({
      know: 'success',
      unsure: 'partial',
      dont_know: 'fail',
    })
    expect(flashcardType.srs).toBe(true)
  })

  it('costs estimates.flashcard.new when new, .review otherwise', () => {
    const card = cardSchema.parse(blocker)
    const estimates = { estimates: { flashcard: { new: 1.5, review: 0.5 } } }
    expect(flashcardType.estimateMinutes(card, estimates, 'new')).toBe(1.5)
    expect(flashcardType.estimateMinutes(card, estimates, 'review')).toBe(0.5)
    expect(flashcardType.estimateMinutes(card, estimates, 'recall')).toBe(0.5)
    expect(() => flashcardType.estimateMinutes(card, { estimates: {} }, 'new')).toThrow(
      /estimates\.flashcard/,
    )
  })
})
