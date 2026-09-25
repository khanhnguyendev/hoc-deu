/**
 * `content:build` step 7 (platform design §3.4, decision 8): the cards of derived decks (English
 * "Explaining code"). Each manifest `decks[]` entry gets one card per source problem whose note is
 * active and whose problem is not retired, and one deck summary. A locked card whose source no
 * longer qualifies stays, retired, so moving a note back to draft never breaks the build.
 */
import type {
  CatalogItem,
  DeckSummary,
  FlashcardContent,
  ProblemContent,
} from '@/lib/content/catalog-types'
import type { ItemStatus } from '@/lib/content/schemas/common'
import { derivedCardId, parseDerivedId } from '@/lib/content/schemas/ids'
import {
  TEMPLATE_PLACEHOLDERS,
  type DerivedDeck,
  type TrackManifest,
} from '@/lib/content/schemas/manifest'

export type DerivedInput = {
  tracks: readonly TrackManifest[]
  items: Readonly<Record<string, CatalogItem>>
  /** The `[published]` IDs of `content/ids.lock`. */
  lockedIds: ReadonlySet<string>
  /** Track ID → manifest path: a derived card's source is the manifest that declares its deck. */
  manifestFiles: ReadonlyMap<string, string>
}

type MapValue = DerivedDeck['map']['front']
type Placeholder = (typeof TEMPLATE_PLACEHOLDERS)[number]

const PLACEHOLDERS: { readonly [K in Placeholder]: (problem: ProblemContent) => string } = {
  'problem.title': (problem) => problem.title,
  'problem.leetcode': (problem) => String(problem.leetcode),
  'problem.difficulty': (problem) => problem.difficulty,
}

const isPlaceholder = (name: string): name is Placeholder =>
  (TEMPLATE_PLACEHOLDERS as readonly string[]).includes(name)

/** A map value's text for a problem; null without a problem, or without a note to read. */
function fill(value: MapValue, problem: ProblemContent | null): string | null {
  if (problem === null) return null
  if (typeof value === 'object') {
    return value.template.replace(/\{([^{}]*)\}/g, (text, name: string) =>
      isPlaceholder(name) ? PLACEHOLDERS[name](problem) : text,
    )
  }
  if (value === 'problem.title') return problem.title
  const bilingual = problem.note?.bilingual
  if (bilingual === undefined) return null
  return value === 'note.bilingual.vi' ? bilingual.vi : bilingual.en
}

/** Vietnamese for `note.bilingual.vi`; problem titles, templates and `note.bilingual.en` are English. */
const langOf = (value: MapValue): 'en' | 'vi' => (value === 'note.bilingual.vi' ? 'vi' : 'en')

const compareNames = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

function derivedCard(
  track: TrackManifest,
  deck: DerivedDeck,
  sourceId: string,
  problem: ProblemContent | null,
  status: ItemStatus,
  source: string,
): CatalogItem<'flashcard'> {
  const id = derivedCardId(track.id, deck.id, sourceId)
  // A retired card whose problem or note is gone keeps its source ID as text.
  const text = (value: MapValue) => fill(value, problem) ?? sourceId
  const { front, back, hint } = deck.map
  const content: FlashcardContent = {
    id,
    tier: 'derived',
    front: text(front),
    back: text(back),
    ...(hint === undefined ? {} : { hint: text(hint) }),
    tags: [],
    status,
    deckId: `${track.id}:${deck.id}`,
    // A hint is in the back's language when the map has none (as for authored cards).
    lang: { front: langOf(front), back: langOf(back), hint: langOf(hint ?? back) },
    derivedFrom: sourceId,
  }
  return {
    id,
    type: 'flashcard',
    trackId: track.id,
    localId: id.slice(track.id.length + 1),
    topicId: null,
    week: null,
    status,
    title: content.front,
    source,
    content,
  }
}

/** The cards and deck summaries of every derived deck, each sorted by ID. */
export function derivedCards(input: DerivedInput): {
  cards: CatalogItem<'flashcard'>[]
  decks: DeckSummary[]
} {
  const problems = Object.values(input.items)
    .filter((item): item is CatalogItem<'problem'> => item.type === 'problem')
    .sort((a, b) => compareNames(a.id, b.id))
  const cards: CatalogItem<'flashcard'>[] = []
  const decks: DeckSummary[] = []

  for (const track of input.tracks) {
    const source = input.manifestFiles.get(track.id) ?? 'track.yaml'
    for (const deck of track.decks) {
      const deckCards: CatalogItem<'flashcard'>[] = []
      const qualifying = new Set<string>()
      for (const problem of problems) {
        if (problem.trackId !== deck.from.track || problem.status === 'retired') continue
        if (problem.content.note?.status !== 'active') continue
        qualifying.add(problem.id)
        deckCards.push(
          derivedCard(track, deck, problem.id, problem.content, problem.status, source),
        )
      }
      // Decision 8: a locked card of this deck whose source stopped qualifying stays, retired.
      for (const id of input.lockedIds) {
        const parsed = parseDerivedId(id)
        if (parsed?.trackId !== track.id || parsed.deckId !== deck.id) continue
        if (qualifying.has(parsed.sourceId)) continue
        const item = input.items[parsed.sourceId]
        const problem = item?.type === 'problem' ? item.content : null
        deckCards.push(derivedCard(track, deck, parsed.sourceId, problem, 'retired', source))
      }
      deckCards.sort((a, b) => compareNames(a.id, b.id))
      cards.push(...deckCards)
      decks.push({
        id: `${track.id}:${deck.id}`,
        trackId: track.id,
        kind: 'derived',
        week: null,
        topicId: null,
        // A manifest deck's title is optional; its ID stands in (as section kinds do, decision 33).
        title: deck.title ?? { vi: deck.id, en: deck.id },
        status: 'active',
        cardIds: deckCards.map((card) => card.id),
      })
    }
  }
  return {
    cards: cards.sort((a, b) => compareNames(a.id, b.id)),
    decks: decks.sort((a, b) => compareNames(a.id, b.id)),
  }
}
