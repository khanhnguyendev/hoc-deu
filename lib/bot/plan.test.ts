import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATALOG as GENERATED } from '@/.generated/catalog'
import { toPlanCatalog } from '@/lib/content/plan-catalog'
import type { AiPlanAllowance } from '@/lib/domain/plan/ai'
import type { TrackSnapshot } from '@/lib/domain/plan/types'
import { EventError } from '@/lib/events/apply'
import { deriveEventId } from '@/lib/events/ids'
import { planRequest, planResponse, type PlanRequest } from './contract/plan'
import { fakeDb, type FakeDb, type Row } from './__fixtures__/fake-db'
import type { RunUser } from './runs'

const state = vi.hoisted(() => ({
  db: undefined as unknown as FakeDb,
  userDay: undefined as unknown,
  allowance: undefined as unknown,
  settingsDryRun: false,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => state.db.client }))
vi.mock('./context', () => ({
  loadUserDay: vi.fn(async () => state.userDay),
  allowanceOf: vi.fn(() => state.allowance),
  activeCustomItemIds: vi.fn(() => []),
}))
vi.mock('./settings', () => ({
  readBotSettings: vi.fn(async () => ({ settings: { dryRun: state.settingsDryRun } })),
}))
vi.mock('@/lib/events/plans', () => ({ storeAiPlan: vi.fn(), AI_RATIONALE_MAX_CHARS: 280 }))

const { putPlan, writePlan } = await import('./plan')
const { storeAiPlan } = await import('@/lib/events/plans')
const { allowanceOf } = await import('./context')

const USER_ID = '00000000-0000-4000-8000-000000000001'
const TODAY = '2026-10-05'
const NOW = new Date('2026-10-05T03:00:00.000Z')
const PLAN_ID = '00000000-0000-4000-8000-000000000300'
const RUN_USER: RunUser = {
  runUuid: '00000000-0000-4000-8000-000000000100',
  runKey: 'run_2026-10-05',
  mode: 'live',
  runUserId: '00000000-0000-4000-8000-000000000200',
  userId: USER_ID,
  userRef: 'u_aaaaaaaaaaaaaaaa',
}
const EVENT_ID = deriveEventId(RUN_USER.runUuid, `${RUN_USER.userRef}:plan`)

const REVIEW = 'dsa:lc-0001'
const NEW = 'dsa:lc-0003'
/** The baseline build's snapshots (decision 15): what an AI plan stores as its roadmap_weeks. */
const BASELINE_TRACKS: Record<string, TrackSnapshot> = {
  dsa: {
    variant: '8w',
    week: 2,
    dueCount: 1,
    newPerDay: 2,
    throttled: false,
    reviewDebt: false,
  },
}

const BODY: PlanRequest = {
  targetDate: TODAY,
  blocks: [
    { trackId: 'dsa', kind: 'review', itemIds: [REVIEW], mode: 'recall' },
    { trackId: 'dsa', kind: 'new', itemIds: [NEW] },
  ],
  rationale: '<b>Ôn lại</b> Two Sum trước, sau đó học tiếp https://evil.example nhé.',
}

type Resolution =
  | { kind: 'today'; read: { row: Row } }
  | { kind: 'open' }
  | { kind: 'paused' }
  | { kind: 'resumed' }
  | { kind: 'noTracks' }

function setup(
  options: { resolution?: Resolution; plans?: Row[]; events?: Row[]; mode?: RunUser['mode'] } = {},
) {
  state.settingsDryRun = false
  state.userDay = {
    day: { today: TODAY, userItems: [] },
    resolution: options.resolution ?? { kind: 'open' },
    baseline: { planDate: TODAY, mode: 'baseline', blocks: [], tracks: BASELINE_TRACKS },
  }
  const allowance: AiPlanAllowance = {
    today: TODAY,
    catalog: toPlanCatalog(GENERATED),
    activeTrackIds: new Set(['dsa']),
    budgets: { dsa: 60 },
    allowedNew: new Set([NEW]),
    allowedReview: new Set([REVIEW]),
    ownCustomItems: new Set(),
    openDeepDives: new Set(),
  }
  state.allowance = allowance
  state.db = fakeDb({
    day_plans: options.plans ?? [],
    events: options.events ?? [],
    bot_run_users: [
      {
        id: RUN_USER.runUserId,
        run_id: RUN_USER.runUuid,
        user_id: USER_ID,
        user_ref: RUN_USER.userRef,
        outcome: null,
        writes: {},
        detail: { plan: { invalidAttempts: 1 } },
        processed_at: null,
      },
    ],
  })
  vi.mocked(storeAiPlan).mockReset()
  vi.mocked(storeAiPlan).mockResolvedValue({ outcome: 'applied', planId: PLAN_ID, version: 2 })
  return { ...RUN_USER, mode: options.mode ?? 'live' }
}

const runUserRow = () => state.db.tables.bot_run_users![0] as Row

beforeEach(() => {
  setup()
})

describe('putPlan (PUT …/plan, §6.4.3)', () => {
  it('applies a valid plan: the validated blocks, the cleaned rationale, the baseline’s snapshots, the run’s event id', async () => {
    const answer = await putPlan(RUN_USER, BODY, NOW)
    expect(answer).toEqual({
      status: 200,
      body: { outcome: 'applied', planVersion: 2 },
      outcome: 'applied',
    })
    expect(planResponse.parse(answer.body)).toEqual(answer.body)
    expect(storeAiPlan).toHaveBeenCalledTimes(1)
    const [, userId, input] = vi.mocked(storeAiPlan).mock.calls[0]!
    expect(userId).toBe(USER_ID)
    expect(input).toMatchObject({
      eventId: EVENT_ID,
      runKey: RUN_USER.runKey,
      runUuid: RUN_USER.runUuid,
      localDay: TODAY,
      rationale: 'Ôn lại Two Sum trước, sau đó học tiếp nhé.',
    })
    expect(input.plan.planDate).toBe(TODAY)
    expect(input.plan.tracks).toEqual(BASELINE_TRACKS)
    expect(input.plan.blocks.map((block) => block.id)).toEqual([
      `${TODAY}:dsa:review:1`,
      `${TODAY}:dsa:new:1`,
    ])
    expect(input.plan.blocks[0]!.items).toEqual([
      expect.objectContaining({ itemId: REVIEW, mode: 'recall' }),
    ])
  })

  it('validates against allowanceOf(the day, the learner’s active custom items)', async () => {
    await putPlan(RUN_USER, BODY, NOW)
    expect(allowanceOf).toHaveBeenCalledWith(state.userDay, [])
  })

  it('a touched or resume plan (plan_in_use) → skipped_plan_in_use', async () => {
    vi.mocked(storeAiPlan).mockResolvedValue({
      outcome: 'plan_in_use',
      planId: PLAN_ID,
      version: null,
    })
    expect(await putPlan(RUN_USER, BODY, NOW)).toEqual({
      status: 200,
      body: { outcome: 'skipped_plan_in_use' },
      outcome: 'skipped_plan_in_use',
    })
  })

  it.each<[string, Row, object]>([
    [
      'plan.ai_applied → applied with its planVersion',
      {
        type: 'plan.ai_applied',
        payload: { runId: RUN_USER.runKey, outcome: 'applied', planVersion: 3 },
      },
      { outcome: 'applied', planVersion: 3 },
    ],
    [
      'plan.ai_skipped → skipped_plan_in_use',
      {
        type: 'plan.ai_skipped',
        payload: { runId: RUN_USER.runKey, outcome: 'skipped_plan_in_use' },
      },
      { outcome: 'skipped_plan_in_use' },
    ],
  ])('a duplicate is answered from the stored event: %s', async (_, event, body) => {
    vi.mocked(storeAiPlan).mockImplementation(async () => {
      // A concurrent attempt with the same event id stored it first.
      state.db.tables.events!.push({ id: EVENT_ID, user_id: USER_ID, ...event })
      return { outcome: 'duplicate', planId: null, version: null }
    })
    expect(await putPlan(RUN_USER, BODY, NOW)).toMatchObject({ status: 200, body })
  })

  it('a retry after a crash between the write and the record is answered from the stored event — before the unseen re-check its own plan would fail', async () => {
    const run = setup({
      resolution: { kind: 'today', read: { row: { source: 'ai', seen_at: null } } },
      events: [
        {
          id: EVENT_ID,
          user_id: USER_ID,
          type: 'plan.ai_applied',
          payload: { runId: RUN_USER.runKey, outcome: 'applied', planVersion: 2 },
        },
      ],
    })
    expect(await putPlan(run, BODY, NOW)).toEqual({
      status: 200,
      body: { outcome: 'applied', planVersion: 2 },
      outcome: 'applied',
    })
    expect(storeAiPlan).not.toHaveBeenCalled()
  })

  it.each<Resolution['kind']>(['paused', 'resumed'])(
    'the gate re-check: %s (decision 9 — a learner who resumed today) → skipped_gate_closed, nothing written',
    async (kind) => {
      const run = setup({ resolution: { kind } as Resolution })
      expect(await putPlan(run, BODY, NOW)).toEqual({
        status: 200,
        body: { outcome: 'skipped_gate_closed' },
        outcome: 'skipped_gate_closed',
      })
      expect(storeAiPlan).not.toHaveBeenCalled()
    },
  )

  it('the unseen re-check: today’s plan is an unseen AI plan → skipped_unseen', async () => {
    const run = setup({
      resolution: { kind: 'today', read: { row: { source: 'ai', seen_at: null } } },
    })
    expect(await putPlan(run, BODY, NOW)).toMatchObject({
      body: { outcome: 'skipped_unseen' },
      outcome: 'skipped_unseen',
    })
    expect(storeAiPlan).not.toHaveBeenCalled()
  })

  it('the unseen re-check: no plan today, the latest plan (yesterday) an unseen AI plan → skipped_unseen', async () => {
    const run = setup({
      plans: [
        {
          user_id: USER_ID,
          plan_date: '2026-10-03',
          source: 'baseline',
          seen_at: '2026-10-03T01:00:00Z',
        },
        { user_id: USER_ID, plan_date: '2026-10-04', source: 'ai', seen_at: null },
      ],
    })
    expect(await putPlan(run, BODY, NOW)).toMatchObject({ outcome: 'skipped_unseen' })
  })

  it.each<[string, Resolution, Row[]]>([
    [
      'today’s seen AI plan',
      { kind: 'today', read: { row: { source: 'ai', seen_at: '2026-10-05T01:00:00Z' } } },
      [],
    ],
    [
      'today’s unseen baseline plan',
      { kind: 'today', read: { row: { source: 'baseline', seen_at: null } } },
      [],
    ],
    [
      'a seen AI plan yesterday',
      { kind: 'open' },
      [
        {
          user_id: USER_ID,
          plan_date: '2026-10-04',
          source: 'ai',
          seen_at: '2026-10-04T01:00:00Z',
        },
      ],
    ],
  ])('%s is not unseen: the plan is written', async (_, resolution, plans) => {
    const run = setup({ resolution, plans })
    expect(await putPlan(run, BODY, NOW)).toMatchObject({ outcome: 'applied' })
  })

  it('a plan the allowance refuses → 422 invalid with every issue, nothing written', async () => {
    const answer = await putPlan(
      RUN_USER,
      {
        ...BODY,
        targetDate: '2026-10-04',
        blocks: [{ trackId: 'dsa', kind: 'review', itemIds: [NEW], mode: 'recall' }],
      },
      NOW,
    )
    expect(answer.status).toBe(422)
    expect(answer.outcome).toBe('invalid')
    expect(answer.body).toEqual({
      outcome: 'invalid',
      details: [
        { path: 'targetDate', code: 'wrong_date' },
        expect.objectContaining({ code: 'not_allowed_review', itemId: NEW }),
      ],
    })
    expect(storeAiPlan).not.toHaveBeenCalled()
  })

  it('a rationale of 280 graphemes but more characters than the database’s 280 → invalid', async () => {
    const answer = await putPlan(RUN_USER, { ...BODY, rationale: '👍🏽'.repeat(200) }, NOW)
    expect(answer.body).toEqual({
      outcome: 'invalid',
      details: [{ path: 'rationale', code: 'rationale' }],
    })
    expect(storeAiPlan).not.toHaveBeenCalled()
  })

  it('a dry run validates, stores the proposal in detail.plan and calls no write', async () => {
    const run = setup({ mode: 'dry_run' })
    expect(await putPlan(run, BODY, NOW)).toEqual({
      status: 200,
      body: { outcome: 'dry_run' },
      outcome: 'dry_run',
    })
    expect(storeAiPlan).not.toHaveBeenCalled()
    expect(runUserRow().detail).toEqual({
      plan: {
        invalidAttempts: 1,
        proposal: {
          targetDate: TODAY,
          blocks: BODY.blocks,
          rationale: 'Ôn lại Two Sum trước, sau đó học tiếp nhé.',
        },
      },
    })
    expect(state.db.tables.events).toEqual([])
    expect(state.db.tables.day_plans).toEqual([])
  })

  it('a dry run of an invalid plan is invalid, and stores no proposal', async () => {
    const run = setup({ mode: 'dry_run' })
    const answer = await putPlan(run, { ...BODY, targetDate: '2026-10-04' }, NOW)
    expect(answer.outcome).toBe('invalid')
    expect(runUserRow().detail).toEqual({ plan: { invalidAttempts: 1 } })
  })

  it('day_changed (the request crossed the learner’s day start) → invalid, retryable', async () => {
    vi.mocked(storeAiPlan).mockRejectedValue(new EventError('day_changed'))
    expect(await putPlan(RUN_USER, BODY, NOW)).toEqual({
      status: 422,
      body: { outcome: 'invalid', details: [{ code: 'day_changed', retryable: true }] },
      outcome: 'invalid',
    })
  })

  it('ai_off (the AI flag turned off mid-run) → invalid', async () => {
    vi.mocked(storeAiPlan).mockRejectedValue(new EventError('ai_off'))
    expect(await putPlan(RUN_USER, BODY, NOW)).toEqual({
      status: 422,
      body: { outcome: 'invalid', details: [{ code: 'ai_off' }] },
      outcome: 'invalid',
    })
  })

  it('inactive (the account deactivated mid-run) → invalid, not a 500', async () => {
    vi.mocked(storeAiPlan).mockRejectedValue(new EventError('inactive'))
    expect(await putPlan(RUN_USER, BODY, NOW)).toEqual({
      status: 422,
      body: { outcome: 'invalid', details: [{ code: 'inactive' }] },
      outcome: 'invalid',
    })
  })

  it('invalid_event while bot_settings.dry_run is now on (turned on mid-write) → invalid, retryable', async () => {
    vi.mocked(storeAiPlan).mockRejectedValue(new EventError('invalid_event'))
    state.settingsDryRun = true
    expect(await putPlan(RUN_USER, BODY, NOW)).toMatchObject({
      status: 422,
      body: { outcome: 'invalid', details: [{ code: 'dry_run_started', retryable: true }] },
    })
  })

  it('any other failure is thrown (the route’s 500)', async () => {
    vi.mocked(storeAiPlan).mockRejectedValue(new EventError('invalid_event'))
    await expect(putPlan(RUN_USER, BODY, NOW)).rejects.toBeInstanceOf(EventError)
  })
})

describe('writePlan (the body, then putPlan)', () => {
  it('a body the strict contract refuses → 422 invalid with the issues, nothing read', async () => {
    const answer = await writePlan(RUN_USER, { ...BODY, extra: 1 }, NOW)
    expect(answer.status).toBe(422)
    expect(answer.outcome).toBe('invalid')
    expect(answer.body).toMatchObject({
      outcome: 'invalid',
      details: [expect.objectContaining({ code: 'unrecognized_keys' })],
    })
    expect(storeAiPlan).not.toHaveBeenCalled()
  })

  it('a valid body is put', async () => {
    expect(await writePlan(RUN_USER, BODY, NOW)).toMatchObject({ outcome: 'applied' })
  })
})

describe('the plan contract (§6.4.3)', () => {
  it('refuses a malformed date, an empty block, an unknown kind and a long rationale', () => {
    for (const body of [
      { ...BODY, targetDate: '2026-02-30' },
      { ...BODY, blocks: [{ trackId: 'dsa', kind: 'review', itemIds: [], mode: 'recall' }] },
      { ...BODY, blocks: [{ trackId: 'dsa', kind: 'extra', itemIds: [NEW] }] },
      { ...BODY, rationale: 'a'.repeat(2001) },
      { ...BODY, blocks: [] },
    ]) {
      expect(planRequest.safeParse(body).success).toBe(false)
    }
    expect(planRequest.parse(BODY)).toEqual(BODY)
  })
})
