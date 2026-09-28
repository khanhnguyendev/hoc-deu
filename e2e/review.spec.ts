import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { seedCustomCards } from './support/custom-items'
import { addDays, seedItemStates, stableSchedule } from './support/plans'
import { itemStateOf } from './support/review'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup, type TestUser } from './support/users'

/**
 * `/review` (§2.4, §5.4 step 3, §5.5, §5.7; RF-4; task 5.3; review round 1 findings I2, I3, M8,
 * M9): the cross-track review queue (Weak first), `?track=` filtering and the inline card session
 * for due flashcards. Every test creates its own learner with a UTC schedule whose day start is
 * far from now (`stableSchedule`), so the local day the test seeds is the app's; cleanup deletes
 * the user, never an item state (decision 35 of M4).
 *
 * Cross-track Weak-first ordering is genuinely cross-track (`reviewQueue`'s unit tests prove it
 * directly, including a shared-topic-id regression), but it cannot be observed adjacent in this
 * UI: only `problem` (dsa) and `flashcard` (english, in this content) items carry `srs`, so every
 * due DSA item is a row and every due English item is a card — the two never sit in the same list
 * (M9). What the e2e proves instead: Weak-first *within* a track's row list, the cross-track chip
 * counts, and that switching `?track=` correctly changes which session shows.
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
const itemsSection = (page: Page) => page.getByRole('region', { name: 'Mục cần ôn' })
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

  const card = cardsSection(page)
  // headingLevel={3} under the "Thẻ" section's own h2 (task 5.3 review, finding M8).
  await expect(card.getByRole('heading', { level: 3, name: 'blocker' })).toBeVisible()

  await expectNoAxeViolationsInBothThemes(page)

  // The revealed card, with its grade buttons, is its own state (finding M9).
  await card.getByRole('button', { name: 'Xem nghĩa' }).click()
  await expect(card.getByRole('button', { name: 'Biết', exact: true })).toBeVisible()
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
  await expect(page.getByRole('heading', { level: 3, name: 'blocker' })).toBeVisible()
  await expect(itemsSection(page)).toHaveCount(0)
})

test('switching filters with different card sets shows the right session each time (review round 1, I2)', async ({
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
  // All: the English card shows in "Thẻ".
  await expect(cardsSection(page)).toBeVisible()
  await expect(page.getByRole('heading', { level: 3, name: 'blocker' })).toBeVisible()

  // DSA only: no flashcards for this track — "Thẻ" must not still show the English card.
  await filterChip(page, `${DSA} 1`).click()
  await expect(page).toHaveURL((url) => url.searchParams.get('track') === 'dsa')
  await expect(page.getByRole('region', { name: 'Thẻ' })).toHaveCount(0)
  await expect(itemsSection(page).getByRole('link')).toHaveCount(1)

  // Back to all: the card session is there again (a fresh mount for this filter).
  await filterChip(page, 'Tất cả 2').click()
  await expect(page).toHaveURL((url) => url.searchParams.get('track') === null)
  await expect(page.getByRole('heading', { level: 3, name: 'blocker' })).toBeVisible()
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
  await expect(card.getByRole('heading', { level: 3, name: 'blocker' })).toBeVisible()
  await card.getByRole('button', { name: 'Xem nghĩa' }).click()
  await card.getByRole('button', { name: 'Biết', exact: true }).click()

  await expect(card.getByRole('heading', { level: 3, name: 'EOD' })).toBeVisible()

  const state = await itemStateOf(user.id, 'english:w01-blocker')
  expect(state?.due_on).not.toBeNull()
  expect(state!.due_on! > today).toBe(true)
})

test('grading the only (last) due card keeps the session’s end state and its focus (review round 1, I3)', async ({
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
  ])
  await openReview(page, user)

  const card = cardsSection(page)
  await card.getByRole('button', { name: 'Xem nghĩa' }).click()
  await card.getByRole('button', { name: 'Biết', exact: true }).click()

  // The server revalidates `/review` after every grade (recordOutcome's revalidatePath calls
  // carry a fresh render of the calling page). With nothing left due, this must still show the
  // card session's own end state — never the RF-4 empty state, which would wrongly claim nothing
  // was ever due and would drop the save announcement and focus.
  const done = page.getByRole('heading', { level: 3, name: 'Đã ôn xong' })
  await expect(done).toBeVisible()
  await expect(page.getByText('Không có mục nào cần ôn hôm nay')).toHaveCount(0)
  const endState = page.locator('div[tabindex="-1"]').filter({ has: done })
  await expect(endState).toBeFocused()
})

test('[RF-4] nothing due today: the empty state, linking to /today', async ({ page }) => {
  const { user } = await learner(['dsa', 'english'])
  await openReview(page, user)
  await expect(page.getByText('Không có mục nào cần ôn hôm nay')).toBeVisible()
  const link = page.locator('#main').getByRole('link', { name: 'Hôm nay' })
  await expect(link).toHaveAttribute('href', '/today')
  await expectNoAxeViolationsInBothThemes(page)
})

test('task 6.6a: a due custom card is reviewed like any card (the catalog overlay, §5.12)', async ({
  page,
}) => {
  const { user, today } = await learner(['english'])
  // The AI flag is not needed: custom items stay reviewable with it off (§5.12).
  const [custom] = await seedCustomCards(
    user.id,
    [
      {
        slug: 'on-hold',
        trackId: 'english',
        topicId: 'standup',
        front: 'on hold',
        back: 'tạm dừng',
      },
    ],
    addDays(today, -3),
  )
  await seedItemStates(user.id, [
    {
      itemId: custom!,
      trackId: 'english',
      topicId: 'standup',
      itemType: 'flashcard',
      introducedOn: addDays(today, -3),
      dueOn: today,
      status: 'ok',
    },
  ])
  await openReview(page, user)

  const card = cardsSection(page)
  await expect(card.getByRole('heading', { level: 3, name: 'on hold' })).toBeVisible()
  await card.getByRole('button', { name: 'Xem nghĩa' }).click()
  await card.getByRole('button', { name: 'Biết', exact: true }).click()
  await expect(page.getByRole('heading', { level: 3, name: 'Đã ôn xong' })).toBeVisible()
  await expect.poll(async () => (await itemStateOf(user.id, custom!))?.due_on).not.toBe(today)
})
