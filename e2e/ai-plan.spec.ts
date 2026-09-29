import type { Page } from '@playwright/test'
import { makeAiPlan } from './support/ai-plan'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { addDays, newBlock, seedPlan, snapshot, stableSchedule } from './support/plans'
import { blockCheckIn } from './support/results'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup, type TestUser } from './support/users'

/**
 * AI plans on `/today` (task 6.5b; spec §2.3, §2.4; Part B-M6 decisions 16, 23, 36; ADR-0018): the
 * "Cá nhân hoá bởi AI" badge and the rationale for a plan with `source 'ai'`, none for a baseline
 * plan, and a page that showed the plan before the bot replaced it refused as stale. The AI plan
 * is written directly with the secret key (`support/ai-plan.ts` says why); no bot run, no
 * `bot_settings` change. Every test creates its own learner and deletes it — never a plan.
 */

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const BADGE = 'Cá nhân hoá bởi AI'
const NOTE = 'Kế hoạch do AI cá nhân hoá'
const STALE = 'Kế hoạch vừa thay đổi. Trang đã được làm mới.'
const RATIONALE = 'Ôn lại Contains Duplicate vì lần trước còn cần gợi ý, sau đó học tiếp.'

/** An onboarded DSA learner (8w, started 10 days ago) with today's seeded plan: one new block. */
async function learnerWithPlan(): Promise<{
  user: TestUser
  planId: string
  blockId: string
}> {
  const schedule = stableSchedule()
  const today = schedule.today
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await seedLearnerSetup(user.id, {
    schedule,
    tracks: [
      { trackId: 'dsa', roadmapVariant: '8w', budgetMinutes: 60, startDate: addDays(today, -10) },
    ],
  })
  const block = newBlock(today, 'dsa', [{ itemId: 'dsa:lc-0217', minutes: 20 }])
  const planId = await seedPlan(user.id, {
    planDate: today,
    blocks: [block],
    tracks: { dsa: snapshot('8w') },
  })
  return { user, planId, blockId: block.id }
}

async function openToday(page: Page, user: TestUser): Promise<void> {
  await signIn(page, user, '/today')
  await expect(page).toHaveURL((url) => url.pathname === '/today')
  await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()
}

test('an AI plan: the badge and its rationale under the header, the plan as usual', async ({
  page,
}) => {
  const { user, planId } = await learnerWithPlan()
  await makeAiPlan(planId, RATIONALE)
  await openToday(page, user)
  const note = page.getByRole('group', { name: NOTE })
  await expect(note).toBeVisible()
  await expect(note.getByText(BADGE)).toBeVisible()
  await expect(note.getByText(RATIONALE)).toBeVisible()
  await expect(page.getByRole('article', { name: `Bài mới ${DSA}` })).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)
})

test('a baseline plan shows no badge (v1.0 unchanged)', async ({ page }) => {
  const { user } = await learnerWithPlan()
  await openToday(page, user)
  await expect(page.getByRole('article', { name: `Bài mới ${DSA}` })).toBeVisible()
  await expect(page.getByText(BADGE)).toHaveCount(0)
})

test('[Review Focus 1, decision 36] the bot replaces the plan an open page shows: its check-in is stale, the AI plan appears, then checks in', async ({
  page,
}) => {
  const { user, planId, blockId } = await learnerWithPlan()
  await openToday(page, user)
  const oneTap = page.getByRole('button', { name: `Check-in: Bài mới · ${DSA}` })
  await expect(oneTap).toBeVisible()
  await expect(page.getByText(BADGE)).toHaveCount(0)

  // The bot's write lands while the page is open: same plan id, same block ids, version 2.
  await makeAiPlan(planId, RATIONALE)
  await oneTap.click()
  await expect(page.getByText(STALE).first()).toBeVisible()
  expect(await blockCheckIn(user.id, planId, blockId)).toBeNull()
  // The re-render shows the AI plan; its check-in now goes through.
  await expect(page.getByRole('group', { name: NOTE })).toBeVisible()
  await page.getByRole('button', { name: `Check-in: Bài mới · ${DSA}` }).click()
  await expect.poll(() => blockCheckIn(user.id, planId, blockId)).not.toBeNull()
})
