import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { planOf } from './support/extra'
import { addDays, newBlock, seedPlan, snapshot, stableSchedule } from './support/plans'
import { blockCheckIn } from './support/results'
import { expect, test } from './support/test'
import {
  countEvents,
  createTestUser,
  deleteTestUser,
  seedLearnerSetup,
  type TestUser,
} from './support/users'

/**
 * "Học thêm" (task 5.4; §5.9; decisions 15, 20, 22). Every test creates its
 * own DSA learner with a UTC schedule whose day start is far from now (`stableSchedule`), so the
 * local day the test seeds is the app's. What the server wrote is read back with the secret key.
 * Cleanup deletes users, never plans (decision 35 of M4).
 */

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
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
