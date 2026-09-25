/**
 * `content:build` step 6 (platform design §3.4–§3.6): the cross-references between files —
 * roadmaps against items, decks and topics; lessons against their format, their problems and each
 * other; notes against their solution files and tests; exercise and prompt weeks; derived deck
 * sources. `buildContent` runs it once every file loads cleanly, so a missing reference is a real
 * one and not a file that failed to load.
 */
import path from 'node:path'
import type { Catalog, CatalogItem, DeckSummary } from '@/lib/content/catalog-types'
import { CODE_LANGUAGES, type CodeLanguage } from '@/lib/content/schemas/common'
import { parseItemId } from '@/lib/content/schemas/ids'
import { LESSON_REFS, type Topic, type TrackManifest } from '@/lib/content/schemas/manifest'
import { placedItems, type Roadmap } from '@/lib/content/schemas/roadmap'
import { testsMinimumIssues, type TestsFile } from '@/lib/content/schemas/tests'
import { sortIssues, type ContentIssue } from './issues'
import { SOLUTION_FILES, type LoadedContent, type LoadedRoadmap } from './load'
import type { MdxFacts } from './mdx/facts'
import { byId, compareNames, count } from './util'

export type CrossrefInput = {
  tracks: readonly TrackManifest[]
  /** Track ID → its manifest's repo-relative path, where manifest issues are reported. */
  manifestFiles: ReadonlyMap<string, string>
  roadmaps: Catalog['roadmaps']
  roadmapFiles: readonly { trackId: string; file: string; roadmap: Roadmap }[]
  items: Readonly<Record<string, CatalogItem>>
  decks: Readonly<Record<string, DeckSummary>>
  /** By item ID (lessons) and `<id>#note`. */
  facts: ReadonlyMap<string, MdxFacts>
  problemFiles: ReadonlyMap<string, { solutions: CodeLanguage[]; tests: TestsFile | null }>
}

/** trackId → variant (file name) → roadmap, for the roadmap files that exist; variants sorted. */
export function roadmapRecord(
  tracks: readonly TrackManifest[],
  roadmapFiles: readonly LoadedRoadmap[],
): Catalog['roadmaps'] {
  const roadmaps: Catalog['roadmaps'] = {}
  for (const track of tracks) roadmaps[track.id] = {}
  const sorted = [...roadmapFiles].sort((a, b) => compareNames(a.variant, b.variant))
  for (const { trackId, variant, roadmap } of sorted) {
    roadmaps[trackId] = { ...roadmaps[trackId], [variant]: roadmap }
  }
  return roadmaps
}

/** The cross-reference input of loaded content. */
export function crossrefInput(loaded: LoadedContent): CrossrefInput {
  return {
    tracks: loaded.tracks,
    manifestFiles: loaded.manifestFiles,
    roadmaps: roadmapRecord(loaded.tracks, loaded.roadmapFiles),
    roadmapFiles: loaded.roadmapFiles,
    items: Object.fromEntries(loaded.items.map((item) => [item.id, item])),
    decks: Object.fromEntries(loaded.decks.map((deck) => [deck.id, deck])),
    facts: new Map(loaded.mdx.map((entry) => [entry.key, entry.facts])),
    problemFiles: new Map(
      [...loaded.problemFiles].map(([id, files]) => [
        id,
        {
          solutions: CODE_LANGUAGES.filter((language) => files.solutions[language] !== undefined),
          tests: files.tests,
        },
      ]),
    ),
  }
}

/** Manifest roadmaps without a file: coverage, not an error (decision 4). */
export function missingRoadmaps(
  tracks: readonly TrackManifest[],
  roadmaps: Catalog['roadmaps'],
): Catalog['missingRoadmaps'] {
  return tracks.flatMap((track) =>
    track.roadmaps
      .filter((ref) => roadmaps[track.id]?.[ref.id] === undefined)
      .map((ref) => ({ trackId: track.id, variant: ref.id })),
  )
}

/**
 * The deep-dive reverse lookup (§3.5): problem ID → the first lesson (by ID) that is not retired,
 * whose format requires `about`, and whose `about` is that problem.
 */
export function deepDiveIndex(
  items: Readonly<Record<string, CatalogItem>>,
  tracks: readonly TrackManifest[],
): Map<string, string> {
  const formats = new Map(tracks.map((track) => [track.id, track.lessonFormats ?? {}]))
  const index = new Map<string, string>()
  for (const item of Object.values(items).sort(byId)) {
    if (item.type !== 'lesson' || item.status === 'retired') continue
    const { about, format } = item.content
    if (about === undefined || index.has(about) || items[about]?.type !== 'problem') continue
    if (formats.get(item.trackId)?.[format]?.requires.includes('about')) index.set(about, item.id)
  }
  return index
}

// -----------------------------------------------------------------------------------------------
// One track's checks
// -----------------------------------------------------------------------------------------------

type Report = (file: string, at: string | undefined, message: string, line?: number) => void

/** One track's view of the input, and where its issues go. */
type TrackCheck = {
  input: CrossrefInput
  track: TrackManifest
  topics: ReadonlyMap<string, Topic>
  /** The track's items, sorted by ID. */
  items: readonly CatalogItem[]
  issue: Report
}

/** Why `id` is not an item of this track, or null. */
function otherTrack(check: TrackCheck, id: string): string | null {
  const owner = parseItemId(id)?.trackId
  return owner !== undefined && owner !== check.track.id
    ? `${id} belongs to track ${owner}, not ${check.track.id}`
    : null
}

/** A problem of the check's track, or null after reporting why `id` is not one. */
function problemRef(
  check: TrackCheck,
  file: string,
  at: string,
  id: string,
): CatalogItem<'problem'> | null {
  const item = check.input.items[id]
  const elsewhere = otherTrack(check, id)
  if (elsewhere === null && item?.type === 'problem') return item
  check.issue(
    file,
    at,
    elsewhere ??
      (item === undefined
        ? `${id} is not in content/**`
        : `${id} is a ${item.type}, not a problem`),
  )
  return null
}

function deckRef(check: TrackCheck, file: string, at: string, id: string): void {
  const item = check.input.items[id]
  const problem =
    otherTrack(check, id) ??
    (check.input.decks[id] !== undefined
      ? null
      : item === undefined
        ? `${id} is not in content/**`
        : `${id} is a ${item.type}, not a deck`)
  if (problem !== null) check.issue(file, at, problem)
}

/** The roadmap rules of §3.4 and §3.6 for one roadmap file. */
function checkRoadmap(check: TrackCheck, file: string, roadmap: Roadmap): void {
  const { input, track, topics, issue } = check
  const variant = path.posix.basename(file, '.yaml')
  if (roadmap.id !== variant) {
    issue(file, 'id', `must be "${variant}" to match the file name ${variant}.yaml`)
  }
  if (!track.roadmaps.some((ref) => ref.id === variant)) {
    const manifest = input.manifestFiles.get(track.id) ?? 'track.yaml'
    issue(file, undefined, `the track does not list roadmap ${variant} in roadmaps (${manifest})`)
  }

  /**
   * Topics listed so far; items placed so far — core and recap entries without a mode, the new
   * items every learner gets (§5.3). Bonus is opt-in (`include_bonus`), so a recap with a mode of a
   * bonus-only problem would reach learners who never had it.
   */
  const reached = new Set<string>()
  const placed = new Set<string>()
  /** A bonus or introducing recap item: its topic, or all of its topic's requires, reached. */
  const unreachable = (id: string, topic: string, n: number): string | null => {
    const known = topics.get(topic)
    // An unknown topic is the problem's own issue.
    if (known === undefined || reached.has(topic) || known.requires.every((t) => reached.has(t))) {
      return null
    }
    return `${id} has topic ${topic}: neither it nor all of its requires (${known.requires.join(', ')}) are in week ${n} or earlier`
  }

  roadmap.weeks.forEach((week, w) => {
    const at = (list: string, j: number): string => `weeks.${w}.${list}.${j}`
    const n = week.week

    // A topic's requires come in an earlier week or earlier in this week's list (§3.6).
    week.topics.forEach((topic, j) => {
      const known = topics.get(topic)
      if (known === undefined) {
        issue(file, at('topics', j), `${topic} is not a topic of track ${track.id}`)
      }
      for (const required of known?.requires ?? []) {
        if (reached.has(required)) continue
        issue(
          file,
          at('topics', j),
          `${topic} requires ${required} — list it in an earlier week or before ${topic} in this week`,
        )
      }
      reached.add(topic)
    })
    for (const id of placedItems(week)) placed.add(id)

    week.core.forEach((id, j) => {
      const topic = problemRef(check, file, at('core', j), id)?.content.topic
      if (topic !== undefined && !week.topics.includes(topic)) {
        issue(
          file,
          at('core', j),
          `${id} has topic ${topic}, not one of week ${n}'s topics (${week.topics.join(', ')})`,
        )
      }
    })
    week.bonus.forEach((id, j) => {
      const topic = problemRef(check, file, at('bonus', j), id)?.content.topic
      const problem = topic === undefined ? null : unreachable(id, topic, n)
      if (problem !== null) issue(file, at('bonus', j), problem)
    })
    week.recap.forEach((entry, j) => {
      const where = `${at('recap', j)}.item`
      const topic = problemRef(check, file, where, entry.item)?.content.topic
      if (topic === undefined) return
      if (entry.mode === undefined) {
        const problem = unreachable(entry.item, topic, n)
        if (problem !== null) issue(file, where, problem)
      } else if (!placed.has(entry.item)) {
        issue(
          file,
          where,
          `${entry.item} is recapped (${entry.mode}) in week ${n} but not placed (core or a recap without a mode) by then`,
        )
      }
    })
    week.decks.forEach((id, j) => deckRef(check, file, at('decks', j), id))
  })
}

/** Format, sections, references, rules and `<Practice>` of one lesson (§3.4, §3.6). */
function checkLesson(check: TrackCheck, lesson: CatalogItem<'lesson'>): void {
  const { input, track, issue } = check
  const { content, source: file } = lesson
  const formats = track.lessonFormats ?? {}
  const format = formats[content.format]
  if (format === undefined) {
    const known = Object.keys(formats).join(', ') || 'none'
    issue(
      file,
      'format',
      `${content.format} is not a lesson format of track ${track.id} (${known})`,
    )
    return
  }

  // Sections: the format's list, in order; reported at the first section that differs.
  const facts = input.facts.get(lesson.id)
  const sections = facts?.sections ?? content.sections.map((kind) => ({ kind, line: 0 }))
  const kinds = sections.map((section) => section.kind)
  if (kinds.join(',') !== format.sections.join(',')) {
    const line = sections.find((section, i) => section.kind !== format.sections[i])?.line ?? 0
    const found = kinds.length === 0 ? 'none' : kinds.join(', ')
    issue(
      file,
      undefined,
      `sections must be ${format.sections.join(', ')} in this order (the ${content.format} format) — found ${found}`,
      line > 0 ? line : undefined,
    )
  }

  // References: exactly the ones the format requires, each a problem of the track.
  for (const ref of LESSON_REFS) {
    const id = content[ref]
    const required = format.requires.includes(ref)
    if (required && id === undefined) {
      issue(file, ref, `the ${content.format} format requires ${ref}`)
    } else if (!required && id !== undefined) {
      issue(file, ref, `the ${content.format} format does not use ${ref}`)
    } else if (id !== undefined) {
      const topic = problemRef(check, file, ref, id)?.content.topic
      if (topic !== undefined && format.rules.includes('same-topic') && topic !== content.topic) {
        issue(
          file,
          ref,
          `${id} has topic ${topic}, not the lesson's topic ${content.topic} (same-topic)`,
        )
      }
    }
  }
  const { anchor, practice, about } = content
  if (format.rules.includes('anchor!=practice') && anchor !== undefined && anchor === practice) {
    issue(file, 'practice', 'practice must differ from anchor (anchor!=practice)')
  }
  if (format.rules.includes('practice!=about') && practice !== undefined && practice === about) {
    issue(file, 'practice', 'practice must differ from about (practice!=about)')
  }

  // `<Practice problem>` is the frontmatter's practice (a missing required one is reported above).
  if (practice === undefined && format.requires.includes('practice')) return
  for (const { problem, line } of facts?.practice ?? []) {
    if (problem === practice) continue
    issue(
      file,
      undefined,
      practice === undefined
        ? `<Practice problem="${problem}"> is not allowed: the ${content.format} format has no practice`
        : `<Practice problem="${problem}"> must be the lesson's practice, ${practice}`,
      line > 0 ? line : undefined,
    )
  }
}

/**
 * `one-per-topic` and `max-1-per-about` (§3.6), per format, among lessons that are not retired:
 * the first lesson by ID holds the place; each later one is an issue.
 */
function checkLessonUniqueness(check: TrackCheck, lessons: readonly CatalogItem<'lesson'>[]) {
  const formats = check.track.lessonFormats ?? {}
  const holders = new Map<string, string>()
  /** The lesson already holding `key`, or null after `id` takes it. */
  const holder = (key: string, id: string): string | null => {
    const held = holders.get(key)
    if (held === undefined) holders.set(key, id)
    return held ?? null
  }
  for (const lesson of lessons) {
    const { content } = lesson
    const rules = formats[content.format]?.rules ?? []
    if (lesson.status === 'retired') continue
    if (rules.includes('one-per-topic')) {
      const held = holder(`${content.format} topic ${content.topic}`, lesson.id)
      if (held !== null) {
        check.issue(
          lesson.source,
          'topic',
          `${held} is already the ${content.format} lesson for ${content.topic} (one-per-topic)`,
        )
      }
    }
    if (rules.includes('max-1-per-about') && content.about !== undefined) {
      const held = holder(`${content.format} about ${content.about}`, lesson.id)
      if (held !== null) {
        check.issue(
          lesson.source,
          'about',
          `${held} is already the ${content.format} lesson about ${content.about} (max-1-per-about)`,
        )
      }
    }
  }
}

/** Lesson, problem, deck and exercise topics are manifest topics. */
function checkTopics(check: TrackCheck): void {
  const { input, track, topics, items, issue } = check
  const unknown = (topic: string) => `${topic} is not a topic of track ${track.id}`
  for (const item of items) {
    if (item.topicId === null || topics.has(item.topicId)) continue
    // Exercise files hold a list, so the message names the exercise; cards take their deck's.
    if (item.type === 'lesson' || item.type === 'problem') {
      issue(item.source, 'topic', unknown(item.topicId))
    } else if (item.type === 'exercise') {
      issue(item.source, undefined, `${item.id}: ${unknown(item.topicId)}`)
    }
  }
  const decks = Object.values(input.decks).filter((deck) => deck.trackId === track.id)
  for (const deck of decks.sort(byId)) {
    const file = input.items[deck.cardIds[0] ?? '']?.source
    if (deck.topicId !== null && !topics.has(deck.topicId) && file !== undefined) {
      issue(file, 'topic', unknown(deck.topicId))
    }
  }
}

/** A problem with `note.mdx`: a solution per code language and `tests.yaml` (§3.5, §3.6). */
function checkNotes(check: TrackCheck): void {
  const { input, track, items, issue } = check
  const languages = track.codeLanguages ?? []
  for (const problem of items) {
    if (problem.type !== 'problem' || !input.facts.has(`${problem.id}#note`)) continue
    const dir = path.posix.dirname(problem.source)
    const files = input.problemFiles.get(problem.id)
    for (const language of languages) {
      if (files?.solutions.includes(language)) continue
      issue(
        `${dir}/${SOLUTION_FILES[language]}`,
        undefined,
        `missing — a problem with note.mdx needs a solution for every language in codeLanguages (${languages.join(', ')})`,
      )
    }
    const tests = files?.tests ?? null
    if (tests === null) {
      issue(
        `${dir}/tests.yaml`,
        undefined,
        'missing — a problem with note.mdx needs tests.yaml (platform design §3.5)',
      )
      continue
    }
    // testsFileSchema already holds the minimum; checked again for any other source of input.
    for (const message of testsMinimumIssues(tests.cases)) {
      issue(`${dir}/tests.yaml`, 'cases', message)
    }
  }
}

/** Exercise and prompt weeks exist in the track's longest roadmap (none yet: nothing to check). */
function checkWeeks(check: TrackCheck): void {
  const { input, track, items, issue } = check
  const roadmaps = Object.values(input.roadmaps[track.id] ?? {})
  const longest = Math.max(0, ...roadmaps.map((roadmap) => roadmap.weeks.length))
  if (longest === 0) return
  for (const item of items) {
    if (item.type !== 'exercise' && item.type !== 'prompt') continue
    if (item.week === null || item.week <= longest) continue
    issue(
      item.source,
      undefined,
      `${item.id} has week ${item.week}, beyond the longest roadmap of track ${track.id} (${count(longest, 'week')})`,
    )
  }
}

/**
 * A derived deck's ID is its own — not an authored deck's, which the catalog would otherwise
 * overwrite — and its source track exists and lists the source item type (it may have none yet).
 */
function checkDerivedDecks(check: TrackCheck): void {
  const { input, track, issue } = check
  const file = input.manifestFiles.get(track.id) ?? 'track.yaml'
  track.decks.forEach((deck, index) => {
    const authored = input.decks[`${track.id}:${deck.id}`]
    if (authored !== undefined) {
      const deckFile = input.items[authored.cardIds[0] ?? '']?.source
      const where = deckFile === undefined ? '' : ` (${deckFile})`
      issue(
        file,
        `decks.${index}.id`,
        `${authored.id} is already the ID of an authored deck${where}`,
      )
    }
    const at = `decks.${index}.from.track`
    const source = input.tracks.find((candidate) => candidate.id === deck.from.track)
    if (source === undefined) {
      issue(file, at, `track ${deck.from.track} does not exist`)
    } else if (!source.itemTypes.includes(deck.from.itemType)) {
      issue(file, at, `track ${source.id} does not list ${deck.from.itemType} in itemTypes`)
    }
  })
}

/** Every cross-reference issue, sorted (file, position, message). */
export function crossrefIssues(input: CrossrefInput): ContentIssue[] {
  const issues: ContentIssue[] = []
  const issue: Report = (file, at, message, line) => {
    issues.push({
      file,
      ...(line === undefined ? {} : { line }),
      ...(at === undefined ? {} : { path: at }),
      message,
    })
  }
  const sorted = Object.values(input.items).sort(byId)

  for (const track of input.tracks) {
    const check: TrackCheck = {
      input,
      track,
      topics: new Map(track.topics.map((topic) => [topic.id, topic])),
      items: sorted.filter((item) => item.trackId === track.id),
      issue,
    }
    for (const { trackId, file, roadmap } of input.roadmapFiles) {
      if (trackId === track.id) checkRoadmap(check, file, roadmap)
    }
    const lessons = check.items.filter(
      (item): item is CatalogItem<'lesson'> => item.type === 'lesson',
    )
    for (const lesson of lessons) checkLesson(check, lesson)
    checkLessonUniqueness(check, lessons)
    checkTopics(check)
    checkNotes(check)
    checkWeeks(check)
    checkDerivedDecks(check)
  }
  return sortIssues(issues)
}
