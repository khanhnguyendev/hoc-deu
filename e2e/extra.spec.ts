import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { activityOf } from './support/check-in'
import { planOf } from './support/extra'
import { addDays, newBlock, seedPlan, snapshot, stableSchedule } from './support/plans'
import { blockCheckIn, itemEvents } from './support/results'
import { expect, test } from './support/test'
import {
  countEvents,
  createTestUser,
  deleteTestUser,
  seedLearnerSetup,
  type TestUser,
} from './support/users'

/**
 * "Học thêm" and off-plan study (task 5.4; §5.9; decisions 15, 20–22; RF-5). Every test creates its
 * own DSA learner with a UTC schedule whose day start is far from now (`stableSchedule`), so the
 * local day the test seeds is the app's. What the server wrote is read back with the secret key.
 * Cleanup deletes users, never plans (decision 35 of M4).
 */

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const RESUMED = 'Bạn đã tiếp tục lộ trình hôm nay — kế hoạch mới có vào ngày mai.'
const AUTO_SAVED = 'Đã lưu kết quả. Khối học đã được tự động check-in.'

/** An onboarded DSA (8w) learner who started `startDaysAgo` days ago. */
async function learner(startDaysAgo = 10): Promise<{ user: TestUser; today: string }> {
  const schedule = stableSchedule()
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await seedLearnerSetup(user.id, {
    schedule,
    tracks: [
      {
        trackId: 'dsa',
        roadmapVariant: '8w',
        budgetMinutes: 60,
        startDate: addDays(schedule.today, -startDaysAgo),
      },
    ],
  })
  return { user, today: schedule.today }
}

/** Today's plan: the queue's first two items (the week-1 lesson, Contains Duplicate). */
async function todaysPlan(userId: string, today: string): Promise<string> {
  return seedPlan(userId, {
    planDate: today,
    blocks: [
      newBlock(today, 'dsa', [
        { itemId: 'dsa:lesson-arrays-hashing', minutes: 25 },
        { itemId: 'dsa:lc-0217', minutes: 20 },
      ]),
    ],
    tracks: { dsa: snapshot('8w') },
  })
}

async function solve(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Tự giải được' }).click()
  await expect(
    page.locator('[data-slot="outcome-message"]').filter({ hasText: AUTO_SAVED }),
  ).toBeVisible()
}

const extraCard = (page: Page) => page.getByRole('article', { name: `Học thêm ${DSA}` })

test('"Học thêm" adds the next problem to an extra block; solving it on its page — /today shows "Xong · tự động"', async ({
  page,
}) => {
  const { user, today } = await learner()
  const planId = await todaysPlan(user.id, today)
  await signIn(page, user, '/today')
  await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()

  const offer = page.getByRole('region', { name: 'Học thêm', exact: true })
  await offer.getByRole('button', { name: `Học thêm ${DSA}` }).click()
  const card = extraCard(page)
  await expect(card.getByRole('link', { name: /Valid Anagram/ })).toBeVisible()
  const extraId = `${today}:dsa:extra:1`
  const plan = await planOf(user.id, today)
  expect(plan?.id).toBe(planId)
  expect(plan?.version).toBe(2)
  expect(plan?.blocks.find((block) => block.kind === 'extra')).toMatchObject({
    id: extraId,
    items: [{ itemId: 'dsa:lc-0242', mode: 'new' }],
  })
  expect(await countEvents(user.id, { type: 'plan.extra_added' })).toBe(1)
  await expectNoAxeViolationsInBothThemes(page)

  await card.getByRole('link', { name: /Valid Anagram/ }).click()
  await expect(page).toHaveURL(
    (url) => url.pathname === '/t/dsa/items/lc-0242' && url.searchParams.get('block') === extraId,
  )
  await solve(page)
  expect(await blockCheckIn(user.id, planId, extraId)).toMatchObject({
    status: 'done',
    auto: true,
  })

  // 5.2c's dashboard assertion: back on /today the extra block is "Xong · tự động".
  await page.goto('/today')
  const status = extraCard(page).locator('[data-slot="check-in-status"]')
  await expect(status).toHaveAttribute('data-status', 'done')
  await expect(status).toContainText('Xong')
  await expect(status).toContainText('tự động')
})

test('a week-3 problem opened from the track page and solved: attached to today’s extra block, checked in, counted once', async ({
  page,
}) => {
  const { user, today } = await learner()
  const planId = await todaysPlan(user.id, today)
  await signIn(page, user, '/t/dsa')
  const week3 = page.getByRole('region', { name: 'Tuần 3', exact: true })
  await week3
    .getByRole('list', { name: 'Bài chính' })
    .getByRole('link', { name: /Valid Parentheses/ })
    .click()
  await expect(page).toHaveURL((url) => url.pathname === '/t/dsa/items/lc-0020')
  await expect(page.getByRole('heading', { level: 1, name: 'Valid Parentheses' })).toBeVisible()
  await solve(page)

  const extraId = `${today}:dsa:extra:1`
  expect(await itemEvents(user.id, 'dsa:lc-0020', 'item.result')).toEqual([
    {
      type: 'item.result',
      payload: { result: 'solved' },
      plan_id: planId,
      block_id: extraId,
      source: 'learner',
    },
  ])
  const extra = (await planOf(user.id, today))?.blocks.find((block) => block.id === extraId)
  expect(extra?.items.map((item) => item.itemId)).toEqual(['dsa:lc-0020'])
  const minutes = Math.ceil(extra?.estMinutes ?? 0)
  expect(minutes).toBeGreaterThan(0)
  expect(await blockCheckIn(user.id, planId, extraId)).toEqual({
    status: 'done',
    auto: true,
    minutes,
  })
  // Counted once: the extra block's minutes are the day's DSA minutes, nothing added twice.
  expect(await activityOf(user.id, today)).toMatchObject({
    completed: true,
    minutes_by_track: { dsa: minutes },
  })

  await page.goto('/today')
  await expect(extraCard(page).locator('[data-slot="check-in-status"]')).toHaveAttribute(
    'data-status',
    'done',
  )
})

test('[RF-5] the gate closed: an off-plan result lands in the paused plan’s extra block, done — resumed, no plan today', async ({
  page,
}) => {
  const { user, today } = await learner(30)
  const yesterday = addDays(today, -1)
  const pausedId = await seedPlan(user.id, {
    planDate: yesterday,
    blocks: [newBlock(yesterday, 'dsa', [{ itemId: 'dsa:lc-0217', minutes: 20 }])],
    tracks: { dsa: snapshot('8w') },
    seenAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  })
  await signIn(page, user, '/t/dsa/items/lc-0242')
  await expect(page.getByRole('heading', { level: 1, name: 'Valid Anagram' })).toBeVisible()
  await solve(page)

  const extraId = `${yesterday}:dsa:extra:1`
  const paused = await planOf(user.id, yesterday)
  expect(paused?.blocks.find((block) => block.id === extraId)?.items).toEqual([
    expect.objectContaining({ itemId: 'dsa:lc-0242' }),
  ])
  expect(await blockCheckIn(user.id, pausedId, extraId)).toMatchObject({
    status: 'done',
    auto: true,
  })
  expect(await planOf(user.id, today)).toBeNull()

  // The done extra block reopened the gate today: the resumed header, and no plan for today.
  await page.goto('/today')
  await expect(page.getByText(RESUMED)).toBeVisible()
  await expect(extraCard(page).locator('[data-slot="check-in-status"]')).toHaveAttribute(
    'data-status',
    'done',
  )
  expect(await planOf(user.id, today)).toBeNull()
})
