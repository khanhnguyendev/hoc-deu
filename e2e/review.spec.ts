import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { addDays, seedItemStates, stableSchedule } from './support/plans'
import { itemStateOf } from './support/review'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup, type TestUser } from './support/users'

/**
 * `/review` (§2.4, §5.4 step 3, §5.5, §5.7; RF-4; task 5.3): the cross-track review queue (Weak
 * first), `?track=` filtering and the inline card session for due flashcards. Every test creates
 * its own learner with a UTC schedule whose day start is far from now (`stableSchedule`), so the
 * local day the test seeds is the app's; cleanup deletes the user, never an item state (decision
 * 35 of M4).
 */

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH = 'Tiếng Anh cho môi trường IT'

type Track = 'dsa' | 'english'

/** An onboarded learner of `tracks`, started 30 days ago, with the stable schedule. */
async function learner(tracks: readonly Track[]): Promise<{ user: TestUser; today: string }> {
  const schedule = stableSchedule()
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await seedLearnerSetup(user.id, {
    schedule,
    tracks: tracks.map((trackId) => ({
      trackId,
      roadmapVariant: trackId === 'dsa' ? '8w' : '10w',
      budgetMinutes: trackId === 'dsa' ? 60 : 25,
      startDate: addDays(schedule.today, -30),
    })),
  })
  return { user, today: schedule.today }
}

async function openReview(page: Page, user: TestUser): Promise<void> {
  await signIn(page, user, '/review')
  await expect(page).toHaveURL((url) => url.pathname === '/review')
  await expect(page.getByRole('heading', { level: 1, name: 'Ôn tập' })).toBeVisible()
}

const filterChip = (page: Page, name: string) => page.getByRole('link', { name })
const itemsSection = (page: Page) => page.getByRole('region', { name: 'Bài cần ôn' })
const cardsSection = (page: Page) => page.getByRole('region', { name: 'Thẻ' })

test('the due queue: Weak first within a track, cross-track chip counts, a due card in "Thẻ"', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa', 'english'])
  await seedItemStates(user.id, [
    {
      itemId: 'dsa:lc-0002',
      trackId: 'dsa',
      topicId: 'linked-list',
      itemType: 'problem',
      introducedOn: addDays(today, -20),
      dueOn: today,
      status: 'weak',
    },
    {
      itemId: 'dsa:lc-0005',
      trackId: 'dsa',
      topicId: 'dp-1d',
      itemType: 'problem',
      introducedOn: addDays(today, -20),
      dueOn: addDays(today, -10),
      status: 'ok',
    },
    {
      itemId: 'english:w01-blocker',
      trackId: 'english',
      topicId: 'standup',
      itemType: 'flashcard',
      introducedOn: addDays(today, -20),
      dueOn: today,
      status: 'weak',
    },
  ])
  await openReview(page, user)

  await expect(page.getByText('3 mục cần ôn hôm nay')).toBeVisible()
  await expect(filterChip(page, `Tất cả 3`)).toBeVisible()
  await expect(filterChip(page, `${DSA} 2`)).toBeVisible()
  await expect(filterChip(page, `${ENGLISH} 1`)).toBeVisible()

  // Weak (lc-0002) sorts before a non-Weak item ten days more overdue (lc-0005).
  const rows = itemsSection(page).getByRole('link')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Add Two Numbers')
  await expect(rows.nth(1)).toContainText('Longest Palindromic Substring')

  await expect(cardsSection(page).getByRole('heading', { level: 2, name: 'blocker' })).toBeVisible()

  await expectNoAxeViolationsInBothThemes(page)
})

test('?track=english filters to the English due items only', async ({ page }) => {
  const { user, today } = await learner(['dsa', 'english'])
  await seedItemStates(user.id, [
    {
      itemId: 'dsa:lc-0002',
      trackId: 'dsa',
      topicId: 'linked-list',
      itemType: 'problem',
      introducedOn: addDays(today, -20),
      dueOn: today,
    },
    {
      itemId: 'english:w01-blocker',
      trackId: 'english',
      topicId: 'standup',
      itemType: 'flashcard',
      introducedOn: addDays(today, -20),
      dueOn: today,
    },
  ])
  await openReview(page, user)
  await filterChip(page, `${ENGLISH} 1`).click()
  await expect(page).toHaveURL((url) => url.searchParams.get('track') === 'english')
  await expect(filterChip(page, `${ENGLISH} 1`)).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('1 mục cần ôn hôm nay')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'blocker' })).toBeVisible()
  await expect(itemsSection(page)).toHaveCount(0)
})

test('grading the first card "Biết" moves to the next card; its item_state moves to a later due_on', async ({
  page,
}) => {
  const { user, today } = await learner(['english'])
  await seedItemStates(user.id, [
    {
      itemId: 'english:w01-blocker',
      trackId: 'english',
      topicId: 'standup',
      itemType: 'flashcard',
      introducedOn: addDays(today, -20),
      dueOn: today,
      status: 'weak',
    },
    {
      itemId: 'english:w01-eod',
      trackId: 'english',
      topicId: 'standup',
      itemType: 'flashcard',
      introducedOn: addDays(today, -20),
      dueOn: today,
      status: 'weak',
    },
  ])
  await openReview(page, user)

  const card = cardsSection(page)
  await expect(card.getByRole('heading', { level: 2, name: 'blocker' })).toBeVisible()
  await card.getByRole('button', { name: 'Xem nghĩa' }).click()
  await card.getByRole('button', { name: 'Biết', exact: true }).click()

  await expect(card.getByRole('heading', { level: 2, name: 'EOD' })).toBeVisible()

  const state = await itemStateOf(user.id, 'english:w01-blocker')
  expect(state?.due_on).not.toBeNull()
  expect(state!.due_on! > today).toBe(true)
})

test('[RF-4] nothing due today: the empty state, linking to /today', async ({ page }) => {
  const { user } = await learner(['dsa', 'english'])
  await openReview(page, user)
  await expect(page.getByText('Không có bài nào cần ôn hôm nay')).toBeVisible()
  const link = page.locator('#main').getByRole('link', { name: 'Hôm nay' })
  await expect(link).toHaveAttribute('href', '/today')
  await expectNoAxeViolationsInBothThemes(page)
})
