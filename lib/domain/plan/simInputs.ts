/**
 * The DSA simulation's inputs (platform design §5.10, §5.11; Part B-M4 decision 20): what
 * `tools/sim/inputs.ts` extracts from content into `sim-inputs.generated.json`, and the **planned**
 * content the simulation runs on — one pattern lesson per topic, every listed problem, one
 * repeatable prompt per practice tag — so publishing lessons, notes or prompts never changes it.
 * `lib/domain` never reads the catalog; the hash check lives in `tools/sim`.
 */
import type {
  Difficulty,
  ItemMode,
  PlanCatalog,
  PlanItem,
  PlanRoadmap,
  PlanTrack,
  PlanWeeklyTemplate,
  SrsParams,
} from '../catalog'
import type { LocalDay } from '../time/localDay'
import { SHADOWING_TAG } from './practice'
import type { Enrollment } from './types'

/** What the DSA simulation reads (§5.11 projection inputs), extracted from content by tools/sim. */
export type SimInputs = {
  readonly rulesVersion: number
  readonly trackId: string
  readonly srs: SrsParams
  readonly estimates: {
    readonly lesson: number
    readonly problem: Readonly<Record<Difficulty, number>>
  }
  readonly review: { readonly recallMinutes: number; readonly redoFactor: number }
  readonly weeklyTemplate: PlanWeeklyTemplate
  readonly defaults: PlanTrack['defaults']
  readonly roadmaps: Readonly<Record<string, PlanRoadmap>>
  /** Every problem a roadmap lists → its difficulty and topic. */
  readonly problems: Readonly<
    Record<string, { readonly difficulty: Difficulty; readonly topic: string }>
  >
}

/** The simulations' day 0 (tests and `pnpm sim:projections`): a Monday, so the realistic
 *  learner's 7-day blocks are calendar weeks. */
export const SIM_START_DATE: LocalDay = '2026-09-28'

/** Every mode costs `minutes`. */
const flat = (minutes: number): Record<ItemMode, number> => ({
  new: minutes,
  review: minutes,
  recall: minutes,
  redo: minutes,
  'explain-aloud': minutes,
})

/** A planned item: active, with neutral defaults for what its type does not carry. */
function plannedItem(
  item: Pick<PlanItem, 'id' | 'trackId' | 'itemType' | 'minutes'> & Partial<PlanItem>,
): PlanItem {
  return {
    topicId: null,
    week: null,
    status: 'active',
    srs: null,
    reviewModes: false,
    difficulty: null,
    tier: null,
    deckId: null,
    derivedFrom: null,
    about: null,
    deepDiveId: null,
    tag: null,
    repeatable: false,
    hasExample: false,
    ...item,
  }
}

/** Topics in roadmap order (variants in key order, weeks, then `topics`), each once. */
function listedTopics(inputs: SimInputs): string[] {
  const topics = Object.values(inputs.roadmaps).flatMap((roadmap) =>
    roadmap.weeks.flatMap((week) => week.topics),
  )
  return [...new Set(topics)]
}

/** Every problem the roadmaps reference (core, bonus, recap), each once. */
function listedProblems(inputs: SimInputs): string[] {
  const ids = Object.values(inputs.roadmaps).flatMap((roadmap) =>
    roadmap.weeks.flatMap((week) => [
      ...week.core,
      ...week.bonus,
      ...week.recap.map((entry) => entry.item),
    ]),
  )
  return [...new Set(ids)]
}

/** The template's practice tags with the first block's minutes (template order); shadowing reads
 *  cards, not an item, and an `itemType` block picks authored items — neither gets a prompt. */
function practiceTags(template: PlanWeeklyTemplate): Map<string, number> {
  const tags = new Map<string, number>()
  for (const blocks of Object.values(template)) {
    for (const block of blocks ?? []) {
      if (block.kind !== 'practice' || block.tag === undefined) continue
      if (block.tag === SHADOWING_TAG || tags.has(block.tag)) continue
      tags.set(block.tag, block.minutes)
    }
  }
  return tags
}

function problemItem(inputs: SimInputs, id: string): PlanItem {
  const problem = inputs.problems[id]
  if (problem === undefined) {
    throw new Error(`simCatalog: the roadmaps list ${id}, which SimInputs.problems lacks`)
  }
  const fresh = inputs.estimates.problem[problem.difficulty]
  const { recallMinutes, redoFactor } = inputs.review
  return plannedItem({
    id,
    trackId: inputs.trackId,
    itemType: 'problem',
    topicId: problem.topic,
    srs: inputs.srs,
    // Quick recall, a review and explaining aloud cost the same; redo re-solves (§5.4, §5.5).
    minutes: {
      new: fresh,
      review: recallMinutes,
      recall: recallMinutes,
      redo: Math.round(fresh * redoFactor),
      'explain-aloud': recallMinutes,
    },
    reviewModes: true,
    difficulty: problem.difficulty,
  })
}

/** The planned content (§5.11): one active pattern lesson per topic a roadmap week lists
 *  (`<trackId>:lesson-<topic>`), every listed problem active with its difficulty's minutes
 *  (redo = round(new × redoFactor), recall / review / explain-aloud = recallMinutes), and one
 *  repeatable prompt `<trackId>:prompt-<tag>` per practice `tag` in `weeklyTemplate`, with that
 *  block's minutes — prompt files are not inputs, so they are not hashed (bots may edit them). */
export function simCatalog(inputs: SimInputs): PlanCatalog {
  const { trackId } = inputs
  const lessons = listedTopics(inputs).map((topic) =>
    plannedItem({
      id: `${trackId}:lesson-${topic}`,
      trackId,
      itemType: 'lesson',
      topicId: topic,
      minutes: flat(inputs.estimates.lesson),
    }),
  )
  const problems = listedProblems(inputs).map((id) => problemItem(inputs, id))
  const prompts = [...practiceTags(inputs.weeklyTemplate)].map(([tag, minutes]) =>
    plannedItem({
      id: `${trackId}:prompt-${tag}`,
      trackId,
      itemType: 'prompt',
      tag,
      repeatable: true,
      minutes: flat(minutes),
    }),
  )
  const track: PlanTrack = {
    id: trackId,
    status: 'active',
    weeklyTemplate: inputs.weeklyTemplate,
    defaults: inputs.defaults,
    roadmaps: inputs.roadmaps,
  }
  return {
    tracks: { [trackId]: track },
    items: Object.fromEntries([...lessons, ...problems, ...prompts].map((item) => [item.id, item])),
    decks: {},
  }
}

/** An active enrollment on `variant` at `budgetMinutes`, every other setting the track default,
 *  starting on `SIM_START_DATE`. */
export function simEnrollment(
  inputs: SimInputs,
  variant: string,
  budgetMinutes: number,
): Enrollment {
  return {
    trackId: inputs.trackId,
    variant,
    status: 'active',
    startDate: SIM_START_DATE,
    budgetMinutes,
    newPerDay: inputs.defaults.newPerDay,
    throttle: inputs.defaults.throttle,
    weeklyTemplate: inputs.weeklyTemplate,
    includeBonus: false,
    resetOn: null,
  }
}
