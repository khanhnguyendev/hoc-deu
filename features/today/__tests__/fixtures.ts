/**
 * Builders for the `features/today` tests (task 5.1b): TodayData over the plan engine's hand-built
 * catalog (`lib/domain/plan/__tests__/fixtures.ts` — DSA 8w and English 10w), and TodayPage parts
 * for the component tests. Tests copy and change them; they never mutate them.
 */
import type { PlanCatalog } from '@/lib/domain/catalog'
import { CATALOG, enrollment } from '@/lib/domain/plan/__tests__/fixtures'
import type { PlanBlock, StoredPlan, TrackSnapshot } from '@/lib/domain/plan/types'
import type { BlockState } from '@/lib/domain/state'
import type { ScheduleVersion } from '@/lib/domain/time/localDay'
import type { TodayData, TodayState } from '@/lib/plans/today'
import type { BlockView, TodayPage, TrackProgressView } from '../view-model'

/** Monday 2026-09-28 (the engine fixtures' start date). */
export const TODAY = '2026-09-28'
export const PLAN_ID = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'
export const OLD_PLAN_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
export const REQUEST_ID = 'c0ffee00-1234-4abc-8def-0123456789ab'

export const DSA_TITLE = 'Cấu trúc dữ liệu & Giải thuật'
export const ENGLISH_TITLE = 'Tiếng Anh cho môi trường IT'

/** The track manifests the view model reads titles, accents and topic titles from. */
export const TRACK_MANIFESTS: Readonly<
  Record<
    string,
    {
      id: string
      title: { vi: string; en: string }
      accent: string
      topics: { id: string; title: { vi: string; en: string } }[]
    }
  >
> = {
  dsa: {
    id: 'dsa',
    title: { vi: DSA_TITLE, en: 'Data Structures & Algorithms' },
    accent: 'track-1',
    topics: [
      { id: 'arrays', title: { vi: 'Arrays & Hashing', en: 'Arrays & Hashing' } },
      { id: 'two-pointers', title: { vi: 'Two Pointers', en: 'Two Pointers' } },
    ],
  },
  english: {
    id: 'english',
    title: { vi: ENGLISH_TITLE, en: 'English for IT workplaces' },
    accent: 'track-2',
    topics: [{ id: 'standup', title: { vi: 'Họp stand-up', en: 'Stand-up meetings' } }],
  },
}

export const VERSIONS: readonly ScheduleVersion[] = [
  { timezone: 'Asia/Ho_Chi_Minh', dayStartsAt: '04:00', effectiveAt: '2026-01-01T00:00:00.000Z' },
]

export const SNAPSHOT: TrackSnapshot = {
  variant: '8w',
  week: 1,
  dueCount: 0,
  newPerDay: null,
  throttled: false,
  reviewDebt: false,
}

export function block(
  id: string,
  change: Partial<PlanBlock> & Pick<PlanBlock, 'kind' | 'trackId'>,
): PlanBlock {
  return { id, estMinutes: 10, items: [], ...change }
}

export function storedPlan(change: Partial<StoredPlan> = {}): StoredPlan {
  return {
    id: PLAN_ID,
    planDate: TODAY,
    version: 1,
    source: 'baseline',
    seenAt: null,
    blocks: [],
    tracks: {},
    ...change,
  }
}

export function blockState(
  planId: string,
  blockId: string,
  change: Partial<BlockState> = {},
): BlockState {
  return {
    planId,
    blockId,
    trackId: blockId.split(':')[1] ?? 'dsa',
    status: 'done',
    minutes: 20,
    note: null,
    auto: false,
    checkedInOn: TODAY,
    ...change,
  }
}

export function todayData(
  state: TodayState,
  change: Partial<Omit<TodayData, 'state'>> = {},
): TodayData {
  return {
    today: TODAY,
    now: '2026-09-28T03:00:00.000Z',
    state,
    catalog: CATALOG as PlanCatalog,
    enrollments: [enrollment('dsa'), enrollment('english')],
    items: {},
    versions: VERSIONS,
    ...change,
  }
}

// ---------------------------------------------------------------------------------------------
// TodayPage parts for the component tests
// ---------------------------------------------------------------------------------------------

export function blockView(change: Partial<BlockView> = {}): BlockView {
  const planBlock = change.block ?? block(`${TODAY}:dsa:new:1`, { kind: 'new', trackId: 'dsa' })
  return {
    block: planBlock,
    trackTitle: DSA_TITLE,
    accent: 'track-1',
    kindLabel: 'Bài mới',
    minutes: planBlock.estMinutes,
    overBudget: false,
    checkIn: null,
    items: [],
    ...change,
  }
}

export function trackView(change: Partial<TrackProgressView> = {}): TrackProgressView {
  return {
    trackId: 'dsa',
    title: DSA_TITLE,
    accent: 'track-1',
    week: 2,
    weeks: 8,
    progress: 0.25,
    dueCount: 3,
    throttleMessage: null,
    ...change,
  }
}

export function todayPage(
  state: TodayState,
  change: Partial<Omit<TodayPage, 'data'>> = {},
): TodayPage {
  return {
    data: todayData(state),
    blocks: [],
    tracks: [],
    streak: 0,
    weakTopics: [],
    markSeenPlanId: null,
    requestId: REQUEST_ID,
    ...change,
  }
}
