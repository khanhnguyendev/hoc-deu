/**
 * The `content:build` report (platform design §3.6 step 5): counts by type and status,
 * verification, week sizes and coverage per roadmap week, missing roadmaps, and what is still a
 * draft. Coverage columns appear only for the item types a track lists.
 */
import type { Catalog, CatalogItem, WeekCoverage } from '@/lib/content/catalog-types'
import type { ItemStatus, ItemType } from '@/lib/content/schemas/common'
import type { TrackManifest } from '@/lib/content/schemas/manifest'
import { weekSizes } from '@/lib/content/schemas/roadmap'
import type { LockDiff } from './ids-lock'
import { compareNames, count } from './util'

/** The item rows and status columns, in order. */
const ITEM_ROWS: readonly ItemType[] = ['problem', 'lesson', 'flashcard', 'exercise', 'prompt']
const STATUS_COLUMNS: readonly ItemStatus[] = ['active', 'draft', 'retired']
/** An indented type name and a gap before the first count. */
const LABEL_WIDTH = 2 + Math.max(...ITEM_ROWS.map((type) => type.length)) + 6

const listOrNone = (values: readonly string[]): string =>
  values.length === 0 ? 'none' : values.join(', ')

/** Coverage columns in order; each belongs to an item type (lessons last: its text is long). */
const COVERAGE_COLUMNS: readonly {
  type: ItemType
  header: string
  cell: (week: WeekCoverage) => string
}[] = [
  {
    type: 'problem',
    header: 'notes (placed)',
    cell: (week) => `${week.notedProblems}/${week.placedProblems}`,
  },
  {
    type: 'problem',
    header: 'bonus notes',
    cell: (week) => `${week.notedBonus}/${week.bonusProblems}`,
  },
  { type: 'flashcard', header: 'core', cell: (week) => String(week.coreCards) },
  { type: 'flashcard', header: 'extended', cell: (week) => String(week.extendedCards) },
  { type: 'exercise', header: 'exercises', cell: (week) => String(week.exercises) },
  { type: 'prompt', header: 'prompts', cell: (week) => String(week.prompts) },
  { type: 'lesson', header: 'lessons', cell: lessonsCell },
]

/** `a, b` when every week topic has its lesson; `a (b missing)`; `— (a, b missing)` for none. */
function lessonsCell(week: WeekCoverage): string {
  const present = week.lessons.filter((lesson) => lesson.lessonId !== null)
  const missing = week.lessons.filter((lesson) => lesson.lessonId === null)
  const topics = (lessons: typeof present) => lessons.map((lesson) => lesson.topic).join(', ')
  if (missing.length === 0) return topics(present)
  return `${present.length === 0 ? '—' : topics(present)} (${topics(missing)} missing)`
}

/** Rows of cells as columns two spaces apart, each as wide as its widest cell. */
function columns(rows: readonly (readonly string[])[], align: 'left' | 'right'): string[] {
  const widths = (rows[0] ?? []).map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? '').length)),
  )
  return rows.map((row) =>
    row
      .map((cell, index) => {
        const width = widths[index] ?? 0
        return align === 'right' ? cell.padStart(width) : cell.padEnd(width)
      })
      .join('  ')
      .trimEnd(),
  )
}

function itemTable(catalog: Catalog): string[] {
  const listed = new Set(catalog.tracks.flatMap((track) => track.itemTypes))
  const types = ITEM_ROWS.filter((type) => listed.has(type))
  const items = Object.values(catalog.items)
  const counts = types.map((type) =>
    STATUS_COLUMNS.map((status) =>
      String(items.filter((item) => item.type === type && item.status === status).length),
    ),
  )
  const labels = ['Items', ...types.map((type) => `  ${type}`)]
  return columns([STATUS_COLUMNS, ...counts], 'right').map(
    (line, row) => (labels[row] ?? '').padEnd(LABEL_WIDTH) + line,
  )
}

function verificationLine(catalog: Catalog): string {
  const problems = Object.values(catalog.items).filter(
    (item): item is CatalogItem<'problem'> => item.type === 'problem',
  )
  const notes = problems.map((problem) => problem.content.note)
  const tested = notes.filter((note) => note?.verification === 'tested').length
  const compileOnly = notes.filter((note) => note?.verification === 'compile-only').length
  const noNote = notes.filter((note) => note === null).length
  return `Verification: tested ${tested} · compile-only ${compileOnly} · no note ${noNote}`
}

/** Week sizes (§3.4) count core problems and the active `tier: core` cards of the week's decks. */
function activeCoreCards(catalog: Catalog, deckId: string): number {
  return (catalog.decks[deckId]?.cardIds ?? []).filter((id) => {
    const item = catalog.items[id]
    return item?.type === 'flashcard' && item.status === 'active' && item.content.tier === 'core'
  }).length
}

/** A track's header, week sizes per roadmap, then a coverage table per roadmap. */
function trackLines(catalog: Catalog, track: TrackManifest): string[] {
  const lines = [`${track.id} · ${track.status} · ${track.title.vi}`]
  const roadmaps = track.roadmaps.flatMap((ref) => {
    const roadmap = catalog.roadmaps[track.id]?.[ref.id]
    const coverage = catalog.coverage[track.id]?.[ref.id]
    return roadmap === undefined || coverage === undefined
      ? []
      : [{ variant: ref.id, roadmap, coverage }]
  })
  const width = Math.max(0, ...roadmaps.map(({ variant }) => variant.length))
  for (const { variant, roadmap } of roadmaps) {
    const sizes = weekSizes(roadmap, (deckId) => activeCoreCards(catalog, deckId))
    lines.push(
      `  ${variant.padEnd(width)}  ${count(roadmap.weeks.length, 'week')} · week sizes ${sizes.join(' ')}`,
    )
  }
  const shown = COVERAGE_COLUMNS.filter((column) => track.itemTypes.includes(column.type))
  for (const { variant, coverage } of roadmaps) {
    const prefix = `  ${variant} coverage  `
    const table = columns(
      [
        ['week', ...shown.map((column) => column.header)],
        ...coverage.map((week) => [String(week.week), ...shown.map((column) => column.cell(week))]),
      ],
      'left',
    )
    table.forEach((line, index) => {
      lines.push(`${index === 0 ? prefix : ' '.repeat(prefix.length)}${line}`)
    })
  }
  return lines
}

export function formatReport(catalog: Catalog, lock: LockDiff, ms: number): string {
  const items = Object.values(catalog.items)
  const drafts = [
    ...items.filter((item) => item.status === 'draft').map((item) => item.id),
    // A draft note is its own publish target (§3.3).
    ...items.flatMap((item) =>
      item.type === 'problem' && item.content.note?.status === 'draft'
        ? [item.content.note.mdxKey]
        : [],
    ),
  ].sort(compareNames)
  const summary = [
    'content:build',
    count(catalog.tracks.length, 'track'),
    count(items.length, 'item'),
    `ids.lock +${lock.added.length}`,
    `${(ms / 1000).toFixed(1)} s`,
  ].join(' · ')
  return [
    summary,
    '',
    ...itemTable(catalog),
    '',
    verificationLine(catalog),
    '',
    ...catalog.tracks.flatMap((track) => trackLines(catalog, track)),
    `Missing roadmaps: ${listOrNone(catalog.missingRoadmaps.map(({ trackId, variant }) => `${trackId} ${variant}`))}`,
    `Draft tracks: ${listOrNone(catalog.tracks.filter((track) => track.status === 'draft').map((track) => track.id))}`,
    `Draft items: ${listOrNone(drafts)}`,
  ].join('\n')
}
