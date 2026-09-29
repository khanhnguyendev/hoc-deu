import type { APIRequestContext } from '@playwright/test'
import type { BotContext } from '@/lib/bot/contract/context'
import {
  MALICIOUS_NOTE,
  MALICIOUS_NOTE_KEPT,
  maliciousCustomItems,
  maliciousOverrides,
  maliciousPlans,
} from './fixtures/malicious-note'
import { makeAiPlan } from './support/ai-plan'
import {
  call,
  countTodayRuns,
  customItemsOf,
  deleteTodayRuns,
  localDayIn,
  markPlanSeen,
  opsDay,
  overridesOf,
  planOn,
  publishClearPr,
  publishMarkMerged,
  publishRequestRow,
  readBotControl,
  readBotSettingsRow,
  readRunUserCap,
  requestPublishAs,
  runRow,
  runUserOf,
  runUsers,
  seedNote,
  seedResult,
  setAiFlag,
  setBotSettings,
  setCustomItemStatus,
  signalResultOf,
  updateRunRow,
  writeBotToken,
  type BotAnswer,
  type BotControl,
} from './support/bot'
import { seedCustomCards } from './support/custom-items'
import {
  addDays,
  newBlock,
  seedBlockState,
  seedItemStates,
  seedPlan,
  snapshot,
  stableSchedule,
} from './support/plans'
import { deletePublishRequest, uniqueTarget } from './support/publish'
import { expect, test } from './support/test'
import { countEvents, createTestUser, deleteTestUser, seedLearnerSetup } from './support/users'

/**
 * The bot API contract suite (platform design §6.10; task 6.8; Part B-M6 decisions 7–13, 18, 22,
 * 23, 32): request-level specs against the local stack and the production build, in their own
 * Playwright project `bot-api` and their own CI job `bot-contract` (owner answer Q2). Every route
 * also has Vitest unit tests with fakes; this file checks what only the real stack exercises — the
 * SQL and TypeScript halves of each rule together.
 *
 * **Isolation** (decision 23): serial; `bot_settings.enabled`, `dry_run` and the token belong to
 * this file alone — read in `beforeAll`, restored in `afterAll`; `content_proposals` and
 * `per_run_user_cap` are admin-bot.spec's and are only read here. Only today's run keys are
 * deleted. Eligibility is global (other specs may flag an account briefly), so every assertion is
 * about this file's own learners, mapped from refs to user ids through `bot_run_users` with the
 * secret key. Each case writes a fresh token (the 120 / 10 min limit is per token).
 *
 * **It flips global bot settings** (the kill switch, dry-run, the token) for as long as it runs,
 * so it never runs alongside the browser projects: CI runs it in its own job, and `pnpm
 * verify:full` runs `--project=desktop --project=mobile` first, then `--project=bot-api` apart.
 *
 * **The rate limit** (429, fail open) is not in this suite: a case makes far fewer than 120
 * requests and the server has no test-only knob (decision 22) — 6.1's and 6.3's unit tests cover
 * it.
 */
test.describe.configure({ mode: 'serial' })

const DAY_MS = 86_400_000
const PR_URL = 'https://github.com/khanhnguyendev/hoc-deu/pull/4242'
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

let control: BotControl
const created: string[] = []
const publishRequests: number[] = []

/** How close to the ops day's change (17:00 UTC = 00:00 in Asia/Ho_Chi_Minh) the suite waits. */
const DAY_CHANGE_MARGIN_MS = 2 * 60_000

/**
 * The milliseconds until the ops day changes when that is less than `DAY_CHANGE_MARGIN_MS` away,
 * else 0: a case that starts a run on one ops day and writes on the next would see its run key
 * change under it (§6.2).
 */
function msBeforeDayChange(now = new Date()): number {
  const change = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 17)
  const until = change - now.getTime()
  return until > 0 && until <= DAY_CHANGE_MARGIN_MS ? until : 0
}

test.beforeAll(async () => {
  const wait = msBeforeDayChange()
  if (wait > 0) {
    // Let the Asia/Ho_Chi_Minh day change pass (plus a little) before the first run starts.
    test.setTimeout(wait + 60_000)
    await new Promise((resolve) => setTimeout(resolve, wait + 5_000))
  }
  control = await readBotControl()
  await deleteTodayRuns()
})

test.afterEach(async () => {
  await deleteTodayRuns()
  await Promise.all(publishRequests.splice(0).map((id) => deletePublishRequest(id)))
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

test.afterAll(async () => {
  await deleteTodayRuns()
  await setBotSettings(control)
})

// ---------------------------------------------------------------------------------------------
// Learners
// ---------------------------------------------------------------------------------------------

type Learner = { id: string; email: string; name: string; today: string }

/**
 * An onboarded, AI-flagged learner of DSA 8w (60 minutes a day), started a week ago — by default
 * on a UTC schedule whose day start is hours away (`stableSchedule`), or in `timeZone` with a
 * 00:00 day start.
 */
async function aiLearner(
  options: { timeZone?: string; startInDays?: number; ai?: boolean; shareNotes?: boolean } = {},
): Promise<Learner> {
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  const stable = stableSchedule()
  const schedule =
    options.timeZone === undefined
      ? stable
      : {
          timezone: options.timeZone,
          dayStartsAt: '00:00',
          effectiveAt: new Date(Date.now() - 30 * DAY_MS).toISOString(),
          today: localDayIn(options.timeZone),
        }
  await seedLearnerSetup(user.id, {
    schedule,
    tracks: [
      {
        trackId: 'dsa',
        roadmapVariant: '8w',
        budgetMinutes: 60,
        startDate: addDays(schedule.today, options.startInDays ?? -7),
      },
    ],
  })
  if (options.ai !== false) await setAiFlag(user.id, options.shareNotes ?? false)
  return { id: user.id, email: user.email, name: user.name, today: schedule.today }
}

/** A seen baseline plan of `day` holding one new problem; its id. */
async function seenPlan(learner: Learner, day: string): Promise<string> {
  return seedPlan(learner.id, {
    planDate: day,
    blocks: [newBlock(day, 'dsa', [{ itemId: 'dsa:lc-0217', minutes: 20 }])],
    tracks: { dsa: snapshot('8w') },
    seenAt: new Date(Date.parse(`${day}T12:00:00Z`)).toISOString(),
  })
}

/** Item states (all of topic arrays-hashing, introduced three days ago). */
async function introduce(
  learner: Learner,
  items: { itemId: string; status: 'weak' | 'ok' | 'mastered'; dueOn?: string }[],
): Promise<void> {
  await seedItemStates(
    learner.id,
    items.map((item) => ({
      itemId: item.itemId,
      trackId: 'dsa',
      topicId: 'arrays-hashing',
      itemType: 'problem',
      introducedOn: addDays(learner.today, -3),
      dueOn: item.dueOn ?? addDays(learner.today, 10),
      status: item.status,
    })),
  )
}

// ---------------------------------------------------------------------------------------------
// The API
// ---------------------------------------------------------------------------------------------

type Api = ReturnType<typeof botApi>

function botApi(request: APIRequestContext, token: string) {
  const key = (runId: string, ref: string, kind: string) => `${runId}:${ref}:${kind}`
  const user = (runId: string, ref: string) => `/runs/${runId}/users/${ref}`
  return {
    start: (body?: unknown) => call(request, token, 'POST', '/runs', body ?? {}),
    finish: (runId: string, body: unknown) => call(request, token, 'PATCH', `/runs/${runId}`, body),
    context: (runId: string, ref: string) =>
      call(request, token, 'GET', `${user(runId, ref)}/context`),
    plan: (runId: string, ref: string, body: unknown, idempotencyKey = key(runId, ref, 'plan')) =>
      call(request, token, 'PUT', `${user(runId, ref)}/plan`, body, idempotencyKey),
    customItems: (runId: string, ref: string, body: unknown) =>
      call(
        request,
        token,
        'PUT',
        `${user(runId, ref)}/custom-items`,
        body,
        key(runId, ref, 'custom-items'),
      ),
    overrides: (runId: string, ref: string, body: unknown) =>
      call(
        request,
        token,
        'PUT',
        `${user(runId, ref)}/overrides`,
        body,
        key(runId, ref, 'overrides'),
      ),
    signals: (runId: string) => call(request, token, 'GET', `/runs/${runId}/content-signals`),
  }
}

/** A fresh token and its API (every case: the rate limit is per token). */
async function freshApi(request: APIRequestContext): Promise<Api> {
  return botApi(request, await writeBotToken())
}

type PlanRun = { runId: string; mode: string; users: string[]; deferredUsers: number }

/** Today's plan run started (or resumed) — 200 expected. */
async function startPlanRun(api: Api, body: unknown = {}): Promise<PlanRun> {
  const answer = await api.start(body)
  expect(answer.status, JSON.stringify(answer.body)).toBe(200)
  return answer.body as unknown as PlanRun
}

/** Today's runs deleted, then a new plan run. */
async function restartRun(api: Api, body: unknown = {}): Promise<PlanRun> {
  await deleteTodayRuns()
  return startPlanRun(api, body)
}

/** The learner's ref in the run (their `bot_run_users` row must exist). */
async function refOf(runId: string, learner: Learner): Promise<string> {
  const row = await runUserOf(runId, learner.id)
  expect(row, `no run user for ${learner.id}`).not.toBeNull()
  return row!.user_ref
}

async function contextOf(api: Api, runId: string, ref: string): Promise<BotContext> {
  const answer = await api.context(runId, ref)
  expect(answer.status, JSON.stringify(answer.body)).toBe(200)
  return answer.body as unknown as BotContext
}

/** The detail codes of an `invalid` answer. */
function codes(answer: BotAnswer): string[] {
  const details = (answer.body.details ?? []) as { code?: string }[]
  return details.map((detail) => detail.code ?? '')
}

function expectInvalid(answer: BotAnswer, code: string): void {
  expect(answer.status, JSON.stringify(answer.body)).toBe(422)
  expect(answer.body.outcome ?? answer.body.error).toBe('invalid')
  expect(codes(answer), JSON.stringify(answer.body)).toContain(code)
}

/** A valid plan for the learner's context: a quick recall of `review`, the first allowed new item. */
function validPlan(context: BotContext, review: string[] = [], rationale = 'Ôn lại rồi học tiếp.') {
  const blocks: unknown[] = []
  if (review.length > 0)
    blocks.push({ trackId: 'dsa', kind: 'review', itemIds: review, mode: 'recall' })
  const [next] = context.constraints.allowedNewItems
  if (next !== undefined) blocks.push({ trackId: 'dsa', kind: 'new', itemIds: [next] })
  return { targetDate: context.targetDate, blocks, rationale }
}

// ---------------------------------------------------------------------------------------------
// 1. Kill switch
// ---------------------------------------------------------------------------------------------

test('1. kill switch: bot_settings.enabled off → every route 503 disabled, nothing written', async ({
  request,
}) => {
  const token = await writeBotToken()
  await setBotSettings({ enabled: false, dry_run: true })
  const runId = `run_${opsDay()}`
  const ref = 'u_aaaaaaaaaaaaaaaa'
  const idem = (kind: string) => `${runId}:${ref}:${kind}`
  const routes: [string, Promise<BotAnswer>][] = [
    ['POST /runs', call(request, token, 'POST', '/runs', { kind: 'plan' })],
    ['POST /runs publish', call(request, token, 'POST', '/runs', { kind: 'publish' })],
    ['PATCH /runs', call(request, token, 'PATCH', `/runs/${runId}`, { status: 'completed' })],
    ['GET context', call(request, token, 'GET', `/runs/${runId}/users/${ref}/context`)],
    ['PUT plan', call(request, token, 'PUT', `/runs/${runId}/users/${ref}/plan`, {}, idem('plan'))],
    [
      'PUT custom-items',
      call(
        request,
        token,
        'PUT',
        `/runs/${runId}/users/${ref}/custom-items`,
        {},
        idem('custom-items'),
      ),
    ],
    [
      'PUT overrides',
      call(request, token, 'PUT', `/runs/${runId}/users/${ref}/overrides`, {}, idem('overrides')),
    ],
    ['GET content-signals', call(request, token, 'GET', `/runs/${runId}/content-signals`)],
  ]
  for (const [name, pending] of routes) {
    const answer = await pending
    expect(answer.status, name).toBe(503)
    expect(answer.body, name).toEqual({ error: 'disabled' })
    expect(answer.headers.get('cache-control'), name).toBe('no-store')
  }
  // Without a token too: the kill switch is checked before the token.
  const anonymous = await call(request, null, 'POST', '/runs', {})
  expect(anonymous.status).toBe(503)
  expect(await countTodayRuns()).toBe(0)
})

// ---------------------------------------------------------------------------------------------
// 2. Tokens
// ---------------------------------------------------------------------------------------------

test('2. tokens: none, wrong → 401; the previous one inside 24 h accepted, after its window 401', async ({
  request,
}) => {
  await setBotSettings({ enabled: true, dry_run: true })
  const previous = await writeBotToken()
  // A route that reads nothing for an unknown run: 404 means the token was accepted.
  const probe = (token: string | null, raw?: string) =>
    raw === undefined
      ? call(request, token, 'GET', '/runs/run_1999-01-01/users/u_aaaaaaaaaaaaaaaa/context')
      : request
          .fetch('/api/bot/v1/runs/run_1999-01-01/users/u_aaaaaaaaaaaaaaaa/context', {
            headers: { authorization: raw },
          })
          .then(async (response) => ({
            status: response.status(),
            body: (await response.json()) as Record<string, unknown>,
            headers: new Headers(response.headers()),
          }))

  const none = await probe(null)
  expect(none.status).toBe(401)
  expect(none.body).toEqual({ error: 'unauthorized' })
  expect(none.headers.get('www-authenticate')).toBe('Bearer')
  expect((await probe(`hdb_${'A'.repeat(43)}`)).status).toBe(401)
  expect((await probe(null, `bearer ${previous}`)).status).toBe(401)
  expect((await probe(previous)).status).toBe(404)

  // Rotation (§6.3): the new token, and the previous one for 24 hours.
  const current = await writeBotToken({ keepPreviousUntil: new Date(Date.now() + DAY_MS) })
  expect((await probe(current)).status).toBe(404)
  const inWindow = await probe(previous)
  expect(inWindow.status).toBe(404)
  expect(inWindow.body).toEqual({ error: 'not_found' })

  await setBotSettings({ token_prev_valid_until: new Date(Date.now() - 60_000).toISOString() })
  expect((await probe(previous)).status).toBe(401)
  expect((await probe(current)).status).toBe(404)
  expect(await countTodayRuns()).toBe(0)
})

// ---------------------------------------------------------------------------------------------
// 3. Run start
// ---------------------------------------------------------------------------------------------

test('3. run start: key, mode, resume, timeout, cap and deferred users, the pre-filter, dry-run mid-run', async ({
  request,
}) => {
  test.setTimeout(240_000)
  const api = await freshApi(request)
  await setBotSettings({ enabled: true, dry_run: true })
  await deleteTodayRuns()

  const pending = await aiLearner()
  const paused = await aiLearner()
  await seedPlan(paused.id, {
    planDate: addDays(paused.today, -1),
    blocks: [newBlock(addDays(paused.today, -1), 'dsa', [{ itemId: 'dsa:lc-0217', minutes: 20 }])],
    tracks: { dsa: snapshot('8w') },
    seenAt: new Date(Date.now() - DAY_MS).toISOString(),
  })
  const resumed = await aiLearner()
  const resumedPlan = await seedPlan(resumed.id, {
    planDate: addDays(resumed.today, -1),
    blocks: [newBlock(addDays(resumed.today, -1), 'dsa', [{ itemId: 'dsa:lc-0217', minutes: 20 }])],
    tracks: { dsa: snapshot('8w') },
    seenAt: new Date(Date.now() - DAY_MS).toISOString(),
  })
  await seedBlockState(resumed.id, resumedPlan, {
    blockId: `${addDays(resumed.today, -1)}:dsa:new:1`,
    trackId: 'dsa',
    status: 'done',
    minutes: 20,
    checkedInOn: resumed.today,
  })
  const unseen = await aiLearner()
  const unseenPlan = await seedPlan(unseen.id, {
    planDate: unseen.today,
    blocks: [newBlock(unseen.today, 'dsa', [{ itemId: 'dsa:lc-0217', minutes: 20 }])],
    tracks: { dsa: snapshot('8w') },
    seenAt: null,
  })
  await makeAiPlan(unseenPlan, 'Kế hoạch AI chưa xem.')
  const nextWeek = await aiLearner({ startInDays: 7 })

  // A live request while the setting is on: dry_run. Today's key (Asia/Ho_Chi_Minh).
  const first = await startPlanRun(api, { kind: 'plan', requestedMode: 'live' })
  const runId = `run_${opsDay()}`
  expect(first.runId).toBe(runId)
  expect(first.mode).toBe('dry_run')
  expect((await runRow(runId))?.mode).toBe('dry_run')
  const pendingRef = await refOf(runId, pending)
  expect(first.users).toContain(pendingRef)
  expect((await runUserOf(runId, paused.id))?.outcome).toBe('skipped_gate_closed')
  expect((await runUserOf(runId, resumed.id))?.outcome).toBe('skipped_gate_closed')
  expect((await runUserOf(runId, unseen.id))?.outcome).toBe('skipped_unseen')
  expect(await runUserOf(runId, nextWeek.id)).toBeNull()
  for (const learner of [paused, resumed, unseen]) {
    expect(first.users).not.toContain(await refOf(runId, learner))
  }

  // Again the same day: the same run and its pending users, no new row.
  const rowsBefore = (await runUsers(runId)).length
  const again = await startPlanRun(api)
  expect(again.runId).toBe(runId)
  expect([...again.users].sort()).toEqual([...first.users].sort())
  expect((await runUsers(runId)).length).toBe(rowsBefore)

  // A stored dry_run run resumed with live — even with the setting off now — stays dry_run.
  await setBotSettings({ dry_run: false })
  const strict = await startPlanRun(api, { requestedMode: 'live' })
  expect(strict.mode).toBe('dry_run')
  expect((await runRow(runId))?.mode).toBe('dry_run')

  // After failed (set with the secret key): resumed, running again.
  await updateRunRow(runId, { status: 'failed' })
  await startPlanRun(api)
  expect((await runRow(runId))?.status).toBe('running')

  // Started 2 h 1 min ago: the next run start times it out first (a publish run start sweeps
  // too, without resuming the plan run), then the plan run start resumes it the same day.
  await updateRunRow(runId, {
    started_at: new Date(Date.now() - (2 * 60 + 1) * 60_000).toISOString(),
  })
  const publish = await api.start({ kind: 'publish' })
  expect(publish.status).toBe(200)
  const timedOut = await runRow(runId)
  expect(timedOut?.status).toBe('failed')
  expect(timedOut?.failure_reason).toBe('timeout')
  const back = await startPlanRun(api)
  expect(back.runId).toBe(runId)
  const resumedRun = await runRow(runId)
  expect(resumedRun?.status).toBe('running')
  expect(resumedRun?.failure_reason).toBeNull()
  expect(Date.now() - Date.parse(resumedRun!.started_at)).toBeLessThan(10 * 60_000)

  // The cap: cap + 1 learners who can all be planned → `cap` users, the rest deferred.
  const cap = await readRunUserCap()
  const extra = await Promise.all(Array.from({ length: cap }, () => aiLearner()))
  const mine = [pending, ...extra]
  const capped = await restartRun(api)
  expect(capped.users).toHaveLength(cap)
  expect(capped.deferredUsers).toBeGreaterThanOrEqual(1)
  const cappedRow = await runRow(capped.runId)
  expect(cappedRow?.users_deferred).toBe(capped.deferredUsers)
  expect(cappedRow!.users_eligible).toBeGreaterThanOrEqual(mine.length + 4)
  const rows = await runUsers(capped.runId)
  const mineWithRow = mine.filter((learner) => rows.some((row) => row.user_id === learner.id))
  const mineInUsers = rows.filter(
    (row) =>
      mine.some((learner) => learner.id === row.user_id) && capped.users.includes(row.user_ref),
  )
  expect(mineInUsers.length).toBe(mineWithRow.length)
  expect(mine.length - mineWithRow.length).toBeGreaterThanOrEqual(1)
  for (const learner of [paused, resumed, unseen]) {
    const row = rows.find((candidate) => candidate.user_id === learner.id)
    if (row) expect(capped.users).not.toContain(row.user_ref)
  }

  // Decision 8: a live run, then dry-run turned on in the settings → the next write is dry_run,
  // nothing is written, and the run row says dry_run.
  await Promise.all(extra.map((learner) => deleteTestUser(learner.id)))
  await setBotSettings({ dry_run: false })
  const live = await restartRun(api, { requestedMode: 'live' })
  expect(live.mode).toBe('live')
  const ref = await refOf(live.runId, pending)
  const context = await contextOf(api, live.runId, ref)
  await setBotSettings({ dry_run: true })
  const eventsBefore = await countEvents(pending.id)
  // Combining marks: the rationale is bounded by 280 graphemes (the validation) and 280 code
  // points (the database's char_length, §6.4.3; 6.5b) — 280 letters with three marks each (840
  // code points after NFC) are an invalid answer, never a 500; 140 letters with two marks each
  // (280 code points) are accepted.
  const tooMany = 'e\u0301\u0302\u0303'.repeat(280)
  const refused = await api.plan(live.runId, ref, validPlan(context, [], tooMany))
  expect(refused.status, JSON.stringify(refused.body)).toBe(422)
  expect(refused.body).toEqual({
    outcome: 'invalid',
    details: [{ path: 'rationale', code: 'rationale' }],
  })
  const combining = 'e\u0301\u0302'.repeat(140)
  const write = await api.plan(live.runId, ref, validPlan(context, [], combining))
  expect(write.status, JSON.stringify(write.body)).toBe(200)
  expect(write.body).toEqual({ outcome: 'dry_run' })
  const stored = ((await runUserOf(live.runId, pending.id))?.detail as Record<string, unknown>)
    .plan as { proposal: { rationale: string } }
  expect(stored.proposal.rationale).toBe(combining.normalize('NFC'))
  expect([...stored.proposal.rationale].length).toBe(280)
  expect(await planOn(pending.id, pending.today)).toBeNull()
  expect(await countEvents(pending.id)).toBe(eventsBefore)
  expect((await runRow(live.runId))?.mode).toBe('dry_run')
})

// ---------------------------------------------------------------------------------------------
// 4. Context
// ---------------------------------------------------------------------------------------------

const CONTEXT_KEYS = [
  'baselinePlan',
  'constraints',
  'customItems',
  'deepDives',
  'due',
  'existingPlan',
  'gate',
  'newQueueHead',
  'overrides',
  'recent',
  'targetDate',
  'tracks',
  'untrusted',
  'weakTopics',
]

test('4. context: the allow-list, notes only when shared and sanitised, targetDate per time zone', async ({
  request,
}) => {
  const api = await freshApi(request)
  await setBotSettings({ enabled: true, dry_run: true })
  const learner = await aiLearner()
  const yesterday = addDays(learner.today, -1)
  const planId = await seenPlan(learner, yesterday)
  await seedNote(learner.id, planId, {
    blockId: `${yesterday}:dsa:new:1`,
    trackId: 'dsa',
    checkedInOn: yesterday,
    note: 'Hôm nay <b>khó</b> quá\u0007, xem https://example.com/cheat   nhé',
  })
  const east = await aiLearner({ timeZone: 'Pacific/Kiritimati' })
  const west = await aiLearner({ timeZone: 'Pacific/Pago_Pago' })

  const run = await restartRun(api)
  const ref = await refOf(run.runId, learner)
  const context = await contextOf(api, run.runId, ref)
  expect(Object.keys(context).every((key) => CONTEXT_KEYS.includes(key))).toBe(true)
  expect(context.untrusted).toBeUndefined()
  expect(context.targetDate).toBe(learner.today)
  expect(context.gate).toBe('open')
  const text = JSON.stringify(context)
  for (const secret of [learner.id, learner.email, learner.name, 'e2e-', '@example']) {
    expect(text).not.toContain(secret)
  }
  expect(text).not.toMatch(UUID)

  // Sharing on: the note, sanitised (no markup, no URL, no control character).
  await setAiFlag(learner.id, true)
  const shared = await contextOf(api, run.runId, ref)
  const notes = shared.untrusted?.notes ?? []
  expect(notes).toHaveLength(1)
  expect(notes[0]).toMatchObject({ localDay: yesterday, blockKind: 'new' })
  const note = notes[0]!.text
  expect(note).toContain('Hôm nay')
  expect(note).toContain('khó')
  expect(note).not.toMatch(/[<>]|\p{Cc}|https?:|example\.com|\s{2}/u)
  expect(JSON.stringify(shared)).not.toMatch(UUID)

  // Each learner's own local day.
  const eastContext = await contextOf(api, run.runId, await refOf(run.runId, east))
  const westContext = await contextOf(api, run.runId, await refOf(run.runId, west))
  expect(eastContext.targetDate).toBe(east.today)
  expect(westContext.targetDate).toBe(west.today)
  expect(eastContext.targetDate).not.toBe(westContext.targetDate)
})

// ---------------------------------------------------------------------------------------------
// 5. Plan
// ---------------------------------------------------------------------------------------------

test('5. plan: every §6.4.3 rule invalid, dry run writes nothing, applied v2, precedence, replay, 409', async ({
  request,
}) => {
  test.setTimeout(240_000)
  const api = await freshApi(request)
  await setBotSettings({ enabled: true, dry_run: true })

  const learner = await aiLearner()
  await introduce(learner, [
    { itemId: 'dsa:lc-0001', status: 'weak', dueOn: learner.today },
    { itemId: 'dsa:lc-0049', status: 'ok' },
    { itemId: 'dsa:lc-0347', status: 'ok' },
    { itemId: 'dsa:lc-0238', status: 'ok' },
    { itemId: 'dsa:lc-0036', status: 'ok' },
    { itemId: 'dsa:lc-0242', status: 'ok' },
    { itemId: 'dsa:lc-0217', status: 'ok' },
    { itemId: 'dsa:lc-0128', status: 'mastered' },
  ])
  const baselineId = await seenPlan(learner, learner.today)
  const baseline = await planOn(learner.id, learner.today)
  const [retiredId] = await seedCustomCards(
    learner.id,
    [{ slug: 'old-drill', trackId: 'dsa', topicId: 'arrays-hashing', front: 'Q', back: 'A' }],
    addDays(learner.today, -2),
  )
  await setCustomItemStatus(learner.id, retiredId!, 'retired')
  const other = await aiLearner({ ai: false })
  const [othersId] = await seedCustomCards(
    other.id,
    [{ slug: 'their-drill', trackId: 'dsa', topicId: 'arrays-hashing', front: 'Q', back: 'A' }],
    addDays(other.today, -2),
  )
  // A learner whose plan is touched by an item result (§2.3): the bot never replaces it.
  const touched = await aiLearner()
  const touchedPlan = await seenPlan(touched, touched.today)
  await seedResult(touched.id, {
    itemId: 'dsa:lc-0217',
    trackId: 'dsa',
    result: 'solved',
    planId: touchedPlan,
    blockId: `${touched.today}:dsa:new:1`,
  })

  let run = await restartRun(api)
  let ref = await refOf(run.runId, learner)
  const context = await contextOf(api, run.runId, ref)
  expect(context.existingPlan).toEqual({ source: 'baseline', checkedInBlocks: 0 })
  expect(context.constraints.allowedReviewItems).toContain('dsa:lc-0001')
  expect(context.constraints.allowedReviewItems).not.toContain('dsa:lc-0128')
  expect(context.constraints.allowedNewItems).not.toContain('dsa:lc-0079')
  const good = validPlan(context, ['dsa:lc-0001'])
  const withBlocks = (blocks: unknown[], rest: Record<string, unknown> = {}) => ({
    ...good,
    blocks,
    ...rest,
  })
  const review = (itemIds: string[], mode = 'recall') => ({
    trackId: 'dsa',
    kind: 'review',
    itemIds,
    mode,
  })

  // One invalid body per rule; at most 3 per kind and run user (M6-R18), so the run restarts.
  const rules: [string, unknown][] = [
    ['wrong_date', { ...good, targetDate: addDays(learner.today, 1) }],
    ['unknown_item', withBlocks([review(['dsa:lc-9999'])])],
    ['not_own_custom', withBlocks([review([retiredId!], 'review')])], // retired
    ['not_own_custom', withBlocks([review([othersId!], 'review')])], // another learner's
    ['not_allowed_new', withBlocks([{ trackId: 'dsa', kind: 'new', itemIds: ['dsa:lc-0079'] }])],
    ['not_allowed_review', withBlocks([review(['dsa:lc-0128'])])], // mastered
    ['duplicate_item', withBlocks([review(['dsa:lc-0001', 'dsa:lc-0001'])])],
    ['bad_mode', withBlocks([review(['dsa:lc-0001'], 'review')])],
    [
      'over_budget',
      withBlocks([
        review(
          [
            'dsa:lc-0001',
            'dsa:lc-0049',
            'dsa:lc-0347',
            'dsa:lc-0238',
            'dsa:lc-0036',
            'dsa:lc-0242',
            'dsa:lc-0217',
          ],
          'redo',
        ),
      ]),
    ],
    ['rationale', { ...good, rationale: 'ạ'.repeat(281) }],
  ]
  const eventsBefore = await countEvents(learner.id)
  for (const [index, [code, body]] of rules.entries()) {
    if (index > 0 && index % 3 === 0) {
      run = await restartRun(api)
      ref = await refOf(run.runId, learner)
    }
    const answer = await api.plan(run.runId, ref, body)
    expectInvalid(answer, code)
  }
  // `invalid` does not bind the key: after three invalid answers a valid body is accepted — a
  // dry run, the rationale's markup and URL stripped, and nothing written.
  run = await restartRun(api)
  ref = await refOf(run.runId, learner)
  for (const [, body] of rules.slice(0, 3))
    expect((await api.plan(run.runId, ref, body)).status).toBe(422)
  const markup = {
    ...good,
    rationale: 'Ôn lại <b>Two Sum</b> rồi học tiếp. Xem https://evil.example/x',
  }
  const dry = await api.plan(run.runId, ref, markup)
  expect(dry.status, JSON.stringify(dry.body)).toBe(200)
  expect(dry.body).toEqual({ outcome: 'dry_run' })
  const proposal = ((await runUserOf(run.runId, learner.id))?.detail as Record<string, unknown>)
    .plan as { proposal: { rationale: string }; invalidAttempts: number }
  expect(proposal.invalidAttempts).toBe(3)
  expect(proposal.proposal.rationale).toContain('Two Sum')
  expect(proposal.proposal.rationale).not.toMatch(/[<>]|https?:|evil/)
  expect(await planOn(learner.id, learner.today)).toEqual(baseline)
  expect(await countEvents(learner.id)).toBe(eventsBefore)
  expect((await runUserOf(run.runId, learner.id))?.outcome).toBe('dry_run')

  // The fourth invalid answer of a kind: 409 too_many_attempts.
  run = await restartRun(api)
  ref = await refOf(run.runId, learner)
  for (const [, body] of rules.slice(0, 3))
    expect((await api.plan(run.runId, ref, body)).status).toBe(422)
  const fourth = await api.plan(run.runId, ref, rules[3]![1])
  expect(fourth.status).toBe(409)
  expect(fourth.body).toEqual({ error: 'too_many_attempts' })

  // Live (dry-run off in the settings, a new run): applied as version 2 over the untouched
  // baseline plan, `seen_at` kept.
  await setBotSettings({ dry_run: false })
  run = await restartRun(api)
  expect(run.mode).toBe('live')
  ref = await refOf(run.runId, learner)
  const applied = await api.plan(run.runId, ref, markup)
  expect(applied.status, JSON.stringify(applied.body)).toBe(200)
  expect(applied.body).toEqual({ outcome: 'applied', planVersion: 2 })
  const replaced = await planOn(learner.id, learner.today)
  expect(replaced).toMatchObject({
    id: baselineId,
    version: 2,
    source: 'ai',
    seen_at: baseline!.seen_at,
  })
  expect(replaced?.rationale).toContain('Two Sum')
  expect(replaced?.rationale).not.toMatch(/[<>]|https?:/)
  expect(await countEvents(learner.id, { type: 'plan.ai_applied' })).toBe(1)
  expect(await countEvents(learner.id, { type: 'plan.ai_proposed' })).toBe(0)

  // The same request again: the stored response, nothing written again.
  const replay = await api.plan(run.runId, ref, markup)
  expect(replay.status).toBe(200)
  expect(replay.body).toEqual({ outcome: 'applied', planVersion: 2 })
  expect((await planOn(learner.id, learner.today))?.version).toBe(2)
  expect(await countEvents(learner.id, { type: 'plan.ai_applied' })).toBe(1)
  // The same key with another body: 409.
  const conflict = await api.plan(run.runId, ref, good)
  expect(conflict.status).toBe(409)
  expect(conflict.body).toEqual({ error: 'idempotency_conflict' })
  // A wrong key: 400, nothing read.
  const wrongKey = await api.plan(run.runId, ref, good, `${run.runId}:${ref}:overrides`)
  expect(wrongKey.status).toBe(400)
  expect(wrongKey.body).toEqual({ error: 'invalid_idempotency_key' })

  // A learner who recorded an item result on today's plan first: skipped_plan_in_use.
  const touchedRef = await refOf(run.runId, touched)
  const touchedContext = await contextOf(api, run.runId, touchedRef)
  const skipped = await api.plan(run.runId, touchedRef, validPlan(touchedContext))
  expect(skipped.status, JSON.stringify(skipped.body)).toBe(200)
  expect(skipped.body).toEqual({ outcome: 'skipped_plan_in_use' })
  expect(await planOn(touched.id, touched.today)).toMatchObject({ version: 1, source: 'baseline' })
  expect((await runUserOf(run.runId, touched.id))?.outcome).toBe('skipped_plan_in_use')
})

// ---------------------------------------------------------------------------------------------
// 6. Custom items
// ---------------------------------------------------------------------------------------------

const card = (slug: string, front = `Mặt trước ${slug}`) => ({
  slug,
  type: 'flashcard',
  trackId: 'dsa',
  topicId: 'arrays-hashing',
  payload: { front, back: 'Dùng hash map để tra cứu O(1).' },
})

test('6. custom items: a DSA exercise invalid, the 11th of a day invalid, the same slug a no-op, retire', async ({
  request,
}) => {
  const api = await freshApi(request)
  await setBotSettings({ enabled: true, dry_run: false })
  const learner = await aiLearner()

  let run = await restartRun(api)
  expect(run.mode).toBe('live')
  let ref = await refOf(run.runId, learner)
  const exercise = await api.customItems(run.runId, ref, {
    items: [
      {
        slug: 'ah-exercise',
        type: 'exercise',
        trackId: 'dsa',
        topicId: 'arrays-hashing',
        payload: { kind: 'free-text', prompt: 'Viết lại Two Sum.' },
      },
    ],
  })
  expectInvalid(exercise, 'type_not_in_track')
  expect(await customItemsOf(learner.id)).toEqual({})

  const ten = Array.from({ length: 10 }, (_, index) => card(`drill-${index + 1}`))
  const applied = await api.customItems(run.runId, ref, { items: ten })
  expect(applied.status, JSON.stringify(applied.body)).toBe(200)
  expect(applied.body.outcome).toBe('applied')
  const createdIds = applied.body.created as string[]
  expect(createdIds).toHaveLength(10)
  expect(createdIds.every((id) => /^user:[0-9a-f]{16}:drill-\d+$/.test(id))).toBe(true)
  expect(Object.values(await customItemsOf(learner.id))).toEqual(Array(10).fill('active'))
  expect(await countEvents(learner.id, { type: 'user_item.created' })).toBe(10)

  // A new run the same day: the 11th item of the day is invalid; the same slug and item again is
  // a no-op (listed, nothing written).
  run = await restartRun(api)
  ref = await refOf(run.runId, learner)
  expectInvalid(
    await api.customItems(run.runId, ref, { items: [card('drill-11')] }),
    'limit_reached',
  )
  const same = await api.customItems(run.runId, ref, { items: [card('drill-1')] })
  expect(same.status, JSON.stringify(same.body)).toBe(200)
  expect(same.body).toEqual({ outcome: 'applied', created: [createdIds[0]], retired: [] })
  expect(await countEvents(learner.id, { type: 'user_item.created' })).toBe(10)
  expect(Object.keys(await customItemsOf(learner.id))).toHaveLength(10)

  // Retire one (the learner's own).
  run = await restartRun(api)
  ref = await refOf(run.runId, learner)
  const retired = await api.customItems(run.runId, ref, { items: [], retire: [createdIds[1]] })
  expect(retired.status, JSON.stringify(retired.body)).toBe(200)
  expect(retired.body).toEqual({ outcome: 'applied', created: [], retired: [createdIds[1]] })
  expect((await customItemsOf(learner.id))[createdIds[1]!]).toBe('retired')
})

// ---------------------------------------------------------------------------------------------
// 7. Overrides
// ---------------------------------------------------------------------------------------------

test('7. overrides: a reorder breaking requires, a fourth active, extra_week then its cooldown, revoke', async ({
  request,
}) => {
  const api = await freshApi(request)
  await setBotSettings({ enabled: true, dry_run: false })
  const learner = await aiLearner()
  await introduce(learner, [{ itemId: 'dsa:lc-0001', status: 'weak', dueOn: learner.today }])
  const until = addDays(learner.today, 7)
  const block = (key: string) => ({
    key,
    kind: 'insert_block',
    trackId: 'dsa',
    params: {
      topicId: 'arrays-hashing',
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      minutes: 10,
      until,
    },
  })
  const extraWeek = (key: string) => ({
    key,
    kind: 'extra_week',
    trackId: 'dsa',
    params: { topicId: 'arrays-hashing', studyDays: 1 },
  })
  const active = (answer: BotAnswer) =>
    (answer.body.active as { trackId: string; key: string }[]).map((entry) => entry.key).sort()

  let run = await restartRun(api)
  let ref = await refOf(run.runId, learner)
  const context = await contextOf(api, run.runId, ref)
  const upcoming = context.tracks.find((track) => track.trackId === 'dsa')!.upcomingTopics
  expect(upcoming).toEqual(expect.arrayContaining(['trees', 'heap']))
  // heap requires trees: heap first breaks it.
  const order = ['heap', ...upcoming.filter((topic) => topic !== 'heap')]
  expectInvalid(
    await api.overrides(run.runId, ref, {
      set: [{ key: 'heap-first', kind: 'reorder_topics', trackId: 'dsa', params: { order } }],
    }),
    'breaks_requires',
  )
  const three = await api.overrides(run.runId, ref, {
    set: [block('ah-block-1'), block('ah-block-2'), block('ah-block-3')],
  })
  expect(three.status, JSON.stringify(three.body)).toBe(200)
  expect(three.body.outcome).toBe('applied')
  expect(active(three)).toEqual(['ah-block-1', 'ah-block-2', 'ah-block-3'])

  // A new run: a fourth one is invalid; revoking two makes room for an extra week.
  run = await restartRun(api)
  ref = await refOf(run.runId, learner)
  expectInvalid(
    await api.overrides(run.runId, ref, { set: [block('ah-block-4')] }),
    'limit_reached',
  )
  const week = await api.overrides(run.runId, ref, {
    set: [extraWeek('ah-extra-1')],
    revoke: [
      { trackId: 'dsa', key: 'ah-block-1' },
      { trackId: 'dsa', key: 'ah-block-2' },
    ],
  })
  expect(week.status, JSON.stringify(week.body)).toBe(200)
  expect(active(week)).toEqual(['ah-block-3', 'ah-extra-1'])
  const weekContext = await contextOf(api, run.runId, ref)
  expect(weekContext.overrides).toEqual(
    expect.arrayContaining([
      { trackId: 'dsa', key: 'ah-extra-1', kind: 'extra_week', studyDaysLeft: 1 },
    ]),
  )
  expect(weekContext.constraints.allowedNewItems).toEqual([])

  // Today's plan is an extra-week day (its snapshot names the key): with one study day, the
  // extra week is used up by the stored plan — counted by the PostgREST containment query on
  // `roadmap_weeks`, on the real stack.
  const plan = await api.plan(run.runId, ref, validPlan(weekContext, ['dsa:lc-0001']))
  expect(plan.status, JSON.stringify(plan.body)).toBe(200)
  expect(plan.body.outcome).toBe('applied')
  const stored = (await planOn(learner.id, learner.today))?.roadmap_weeks as Record<
    string,
    { extraWeek?: string }
  >
  expect(stored.dsa?.extraWeek).toBe('ah-extra-1')

  // A new run: another extra week within 21 days of the last start → cooldown (and only the
  // cooldown: the first one is no longer in force); then a revoke. The learner opens the AI plan
  // first: an unseen one would pre-filter them (skipped_unseen), and the run refuses writes for
  // a user it settled at start.
  await markPlanSeen(learner.id, learner.today)
  run = await restartRun(api)
  ref = await refOf(run.runId, learner)
  const cooldown = await api.overrides(run.runId, ref, { set: [extraWeek('ah-extra-2')] })
  expectInvalid(cooldown, 'cooldown')
  expect(codes(cooldown)).not.toContain('limit_reached')
  expect(active(cooldown)).toEqual(['ah-block-3'])
  const revoked = await api.overrides(run.runId, ref, {
    revoke: [{ trackId: 'dsa', key: 'ah-block-3' }],
  })
  expect(revoked.status, JSON.stringify(revoked.body)).toBe(200)
  expect(revoked.body).toEqual({ outcome: 'applied', active: [] })
  expect(await overridesOf(learner.id)).toMatchObject({
    'dsa:ah-block-1': { status: 'revoked', revokedBy: 'bot' },
    'dsa:ah-block-2': { status: 'revoked', revokedBy: 'bot' },
    'dsa:ah-block-3': { status: 'revoked', revokedBy: 'bot' },
    'dsa:ah-extra-1': { status: 'active', kind: 'extra_week' },
  })
  expect(await overridesOf(learner.id)).not.toHaveProperty('dsa:ah-extra-2')
  expect(await overridesOf(learner.id)).not.toHaveProperty('dsa:heap-first')
})

// ---------------------------------------------------------------------------------------------
// 8. Finish and the publish lifecycle
// ---------------------------------------------------------------------------------------------

test('8. finish and publish: PR URL on the run, pending → pr_url → merged; a closed PR is listed again', async ({
  request,
}) => {
  const api = await freshApi(request)
  await setBotSettings({ enabled: true, dry_run: true })

  const run = await restartRun(api)
  const finished = await api.finish(run.runId, {
    status: 'completed',
    summary: '0 users: 0 plans, 0 custom-item sets, 0 overrides; PR #4242',
    contentPrUrl: PR_URL,
  })
  expect(finished.status, JSON.stringify(finished.body)).toBe(200)
  expect(finished.body).toEqual({ ok: true })
  expect(await runRow(run.runId)).toMatchObject({ status: 'completed', content_pr_url: PR_URL })
  // A summary that carries learner data is refused.
  const leaky = await api.finish(run.runId, { status: 'completed', summary: 'hv@example.test' })
  expect(leaky.status).toBe(422)
  // A finished run is not finished again.
  const again = await api.finish(run.runId, { status: 'failed' })
  expect(again.status).toBe(409)
  expect(again.body).toEqual({ error: 'not_running' })
  // A completed plan run answers with no users.
  expect((await startPlanRun(api)).users).toEqual([])

  const adminUser = await createTestUser({ role: 'admin', onboarded: true })
  created.push(adminUser.id)
  const [merging, closing] = [uniqueTarget(), uniqueTarget()]
  const mergingId = await requestPublishAs(adminUser, merging)
  const closingId = await requestPublishAs(adminUser, closing)
  publishRequests.push(mergingId, closingId)

  const listed = (answer: BotAnswer) =>
    (answer.body.publishRequests as { requestId: number; target: string }[]) ?? []
  const publish = await api.start({ kind: 'publish' })
  expect(publish.status, JSON.stringify(publish.body)).toBe(200)
  expect(publish.body.runId).toMatch(new RegExp(`^run_${opsDay()}_publish-\\d+$`))
  expect(listed(publish)).toEqual(
    expect.arrayContaining([
      { requestId: mergingId, target: merging },
      { requestId: closingId, target: closing },
    ]),
  )

  const patched = await api.finish(publish.body.runId as string, {
    status: 'completed',
    summary: 'publish: 2 requests; PR #4242',
    contentPrUrl: PR_URL,
    publishRequestIds: [mergingId, closingId],
  })
  expect(patched.status, JSON.stringify(patched.body)).toBe(200)
  expect(patched.body).toEqual({ ok: true })
  expect(await publishRequestRow(mergingId)).toEqual({ status: 'pending', pr_url: PR_URL })
  expect(await publishRequestRow(closingId)).toEqual({ status: 'pending', pr_url: PR_URL })
  // In a PR: no longer listed.
  const inPr = await api.start({ kind: 'publish' })
  expect(listed(inPr).map((entry) => entry.requestId)).not.toContain(mergingId)
  expect(listed(inPr).map((entry) => entry.requestId)).not.toContain(closingId)

  // The cron's decisions (6.7a's unit tests), applied with the secret key as the cron does.
  expect(await publishMarkMerged([mergingId])).toBe(1)
  expect(await publishClearPr([closingId])).toBe(1)
  expect(await publishRequestRow(mergingId)).toEqual({ status: 'merged', pr_url: PR_URL })
  expect(await publishRequestRow(closingId)).toEqual({ status: 'pending', pr_url: null })
  const retry = await api.start({ kind: 'publish' })
  const ids = listed(retry).map((entry) => entry.requestId)
  expect(ids).toContain(closingId)
  expect(ids).not.toContain(mergingId)
})

// ---------------------------------------------------------------------------------------------
// 9. Content signals
// ---------------------------------------------------------------------------------------------

test('9. content signals: aggregates only from five learners; content proposals off → 409', async ({
  request,
}) => {
  const api = await freshApi(request)
  await setBotSettings({ enabled: true, dry_run: true })
  const itemId = 'dsa:lc-0124'
  const learners = await Promise.all(
    Array.from({ length: 5 }, async () => {
      const user = await createTestUser({ onboarded: true })
      created.push(user.id)
      return user
    }),
  )
  for (const user of learners.slice(0, 4)) {
    await seedResult(user.id, { itemId, trackId: 'dsa', result: 'failed' })
  }
  expect(await signalResultOf(itemId)).toBeNull()
  await seedResult(learners[4]!.id, { itemId, trackId: 'dsa', result: 'failed' })
  const row = await signalResultOf(itemId)
  expect(row).toMatchObject({ users: 5, fails: 5, attempts: 5 })
  expect(Object.keys(row!).sort()).toEqual(['attempts', 'fails', 'hints', 'item_id', 'users'])

  // content_proposals is admin-bot.spec's (decision 23): seeded off, read here, never changed.
  expect((await readBotSettingsRow()).content_proposals).toBe(false)
  const run = await restartRun(api)
  const off = await api.signals(run.runId)
  expect(off.status).toBe(409)
  expect(off.body).toEqual({ error: 'content_proposals_off' })
  expect(off.headers.get('cache-control')).toBe('no-store')
  expect((await api.signals('run_1999-01-01')).status).toBe(404)
})

// ---------------------------------------------------------------------------------------------
// 11. The malicious note (§6.10)
// ---------------------------------------------------------------------------------------------

test('11. malicious note: sanitised under untrusted.notes; every out-of-bounds body invalid, nothing written', async ({
  request,
}) => {
  const api = await freshApi(request)
  await setBotSettings({ enabled: true, dry_run: false })
  const learner = await aiLearner({ shareNotes: true })
  const yesterday = addDays(learner.today, -1)
  const planId = await seenPlan(learner, yesterday)
  await seedNote(learner.id, planId, {
    blockId: `${yesterday}:dsa:new:1`,
    trackId: 'dsa',
    checkedInOn: yesterday,
    note: MALICIOUS_NOTE,
  })

  const run = await restartRun(api)
  expect(run.mode).toBe('live')
  const ref = await refOf(run.runId, learner)
  const context = await contextOf(api, run.runId, ref)
  const notes = context.untrusted?.notes ?? []
  expect(notes).toHaveLength(1)
  expect(notes[0]!.text).toContain(MALICIOUS_NOTE_KEPT)
  expect(notes[0]!.text).not.toMatch(/[<>]|https?:|www\.|evil|script|fetch/)
  // The note appears nowhere else in the context.
  expect(JSON.stringify({ ...context, untrusted: null })).not.toContain('Bỏ qua')

  const eventsBefore = await countEvents(learner.id)
  // Each body is refused for the bound it pushes: its detail codes are among the expected ones.
  const refusedFor = (answer: BotAnswer, expected: readonly string[]) => {
    const got = codes(answer)
    expect(answer.status, JSON.stringify(answer.body).slice(0, 300)).toBe(422)
    expect(answer.body.outcome).toBe('invalid')
    expect(got.length, JSON.stringify(answer.body).slice(0, 300)).toBeGreaterThan(0)
    expect(
      got.filter((code) => !expected.includes(code)),
      JSON.stringify(got),
    ).toEqual([])
  }
  for (const { body, codes: expected } of maliciousPlans(context)) {
    refusedFor(await api.plan(run.runId, ref, body), expected)
  }
  for (const { body, codes: expected } of maliciousCustomItems()) {
    refusedFor(await api.customItems(run.runId, ref, body), expected)
  }
  for (const { body, codes: expected } of maliciousOverrides(context)) {
    refusedFor(await api.overrides(run.runId, ref, body), expected)
  }
  expect(await planOn(learner.id, learner.today)).toBeNull()
  expect(await customItemsOf(learner.id)).toEqual({})
  expect(await overridesOf(learner.id)).toEqual({})
  expect(await countEvents(learner.id)).toBe(eventsBefore)
  expect((await runUserOf(run.runId, learner.id))?.writes).toEqual({})
})
