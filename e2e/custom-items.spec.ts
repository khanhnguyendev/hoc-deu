import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { setAiFlagOff } from './support/bot'
import { customItemStatus, seedCustomCards, setAiFlagOn } from './support/custom-items'
import { addDays, stableSchedule } from './support/plans'
import { itemStateOf } from './support/review'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup, type TestUser } from './support/users'

/**
 * Custom items (task 6.6a; §2.4, §5.12, §6.4.4; Part B-M6 decisions 17, 39): an AI learner's
 * custom cards — seeded straight into `user_items` with the secret key (`support/custom-items.ts`
 * says why) — on the track page's "Mục riêng" tab, their own item page (rendered through the
 * registry, graded like any card), "Ẩn", and another learner's 404. Every test creates its own
 * learners and deletes them; the AI flag is turned off first (6.8 counts eligible users).
 */

const created: string[] = []
test.afterEach(async () => {
  const ids = created.splice(0)
  await Promise.all(ids.map((id) => setAiFlagOff(id)))
  await Promise.all(ids.map((id) => deleteTestUser(id)))
})

/** An onboarded AI learner of the English track (10w, started 10 days ago), stable schedule. */
async function aiLearner(): Promise<{ user: TestUser; today: string }> {
  const schedule = stableSchedule()
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await seedLearnerSetup(user.id, {
    schedule,
    tracks: [
      {
        trackId: 'english',
        roadmapVariant: '10w',
        budgetMinutes: 25,
        startDate: addDays(schedule.today, -10),
      },
    ],
  })
  await setAiFlagOn(user.id)
  return { user, today: schedule.today }
}

const CARDS = [
  { slug: 'on-hold', trackId: 'english', topicId: 'standup', front: 'on hold', back: 'tạm dừng' },
  {
    slug: 'heads-down',
    trackId: 'english',
    topicId: 'standup',
    front: 'heads-down',
    back: 'tập trung làm, không bị làm phiền',
  },
]

const customTab = (page: Page) => page.getByRole('tab', { name: 'Mục riêng' })
const customList = (page: Page) => page.getByRole('list', { name: 'Mục riêng' })

test('the "Mục riêng" tab lists the custom items; a card’s own page renders and grades it', async ({
  page,
}) => {
  const { user, today } = await aiLearner()
  const [onHold] = await seedCustomCards(user.id, CARDS, today)

  await signIn(page, user, '/t/english')
  await expect(page.getByRole('tab', { name: 'Lộ trình', selected: true })).toBeVisible()
  await customTab(page).click()
  const list = customList(page)
  await expect(list.getByRole('link', { name: 'on hold' })).toBeVisible()
  await expect(list.getByRole('link', { name: 'heads-down' })).toBeVisible()
  await expect(list.getByRole('button', { name: 'Ẩn on hold' })).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)

  await list.getByRole('link', { name: 'on hold' }).click()
  await expect(page).toHaveURL(
    (url) => url.pathname === `/t/english/items/${encodeURIComponent(onHold!)}`,
  )
  await expect(page.getByRole('heading', { level: 1, name: 'on hold' })).toBeVisible()
  await expect(page.getByText('Mục riêng của bạn')).toBeVisible()
  await page.getByRole('button', { name: 'Xem nghĩa' }).click()
  const grades = page.getByRole('group', { name: 'Bạn nhớ thẻ này không?' })
  await expect(grades).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)

  await grades.getByRole('button', { name: 'Biết', exact: true }).click()
  await expect(
    page.locator('[data-slot="outcome-message"]').filter({ hasText: 'Đã lưu kết quả' }),
  ).toBeVisible()
  // The track's card SRS (§5.7): a first "Biết" is due again tomorrow.
  await expect
    .poll(() => itemStateOf(user.id, onHold!))
    .toMatchObject({ level: 1, due_on: addDays(today, 1) })
})

test('"Ẩn" asks, hides the item from the next plan on; after a reload it says "Đã ẩn"', async ({
  page,
}) => {
  const { user, today } = await aiLearner()
  const [, headsDown] = await seedCustomCards(user.id, CARDS, today)

  await signIn(page, user, '/t/english?tab=custom')
  const list = customList(page)
  await list.getByRole('button', { name: 'Ẩn heads-down' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Ẩn mục này?' })
  await expect(dialog).toContainText('Mục này sẽ không xuất hiện trong kế hoạch từ ngày mai.')
  await expectNoAxeViolationsInBothThemes(page, { disableRules: ['aria-hidden-focus'] })
  await dialog.getByRole('button', { name: 'Ẩn' }).click()
  await expect(dialog).toBeHidden()
  await expect.poll(() => customItemStatus(user.id, headsDown!)).toBe('hidden')

  await page.reload()
  await customTab(page).click()
  const item = customList(page).getByRole('listitem').filter({ hasText: 'heads-down' })
  await expect(item.getByText('Đã ẩn')).toBeVisible()
  await expect(item.getByRole('button')).toHaveCount(0)
  await expect(customList(page).getByRole('button', { name: 'Ẩn on hold' })).toBeVisible()
})

test.describe('another learner', () => {
  // The 404 response logs as a failed resource load in Chromium.
  test.use({ allowedConsoleErrors: [/status of 404/] })

  test('opening a learner’s custom item URL gets the 404; the owner gets the page', async ({
    page,
  }) => {
    const { user, today } = await aiLearner()
    const [onHold] = await seedCustomCards(user.id, CARDS, today)
    const other = await createTestUser({ onboarded: true })
    created.push(other.id)
    await seedLearnerSetup(other.id, {
      tracks: [{ trackId: 'english', roadmapVariant: '10w', budgetMinutes: 25, startDate: today }],
    })

    const path = `/t/english/items/${encodeURIComponent(onHold!)}`
    await signIn(page, other, '/tracks')
    const response = await page.goto(path)
    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' }),
    ).toBeVisible()
    // The other learner has no custom items: their track page has no tab.
    await page.goto('/t/english')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(0)
  })
})
