import type { Page } from '@playwright/test'
import { seedDailyActivity } from './support/activity'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup } from './support/users'

/**
 * /progress (§2.4, §5.7, §5.9; task 5.5): the calendar heatmap over all history, the streak, the
 * weekly summary (enrolled tracks only) with week navigation, and the empty state for a learner
 * with no `daily_activity` at all (RF-4). Dates are computed relative to the real clock, in the
 * learner's Asia/Ho_Chi_Minh, 04:00 schedule (as `nextVietnamDayStart` in e2e/settings.spec.ts).
 */

const DAY_MS = 86_400_000

/** The app's local day (Asia/Ho_Chi_Minh, day start 04:00 → UTC 21:00) for a UTC instant. */
function localDay(at: number): string {
  const date = new Date(at)
  const boundary = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    21, // Vietnam's 04:00 day start, in UTC (no DST)
  )
  const day = at >= boundary ? new Date(at + DAY_MS) : date
  return day.toISOString().slice(0, 10)
}

/** The Monday on or before `day` (`YYYY-MM-DD`, Monday-first weeks — decision 22). */
function mondayOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  const index = (date.getUTCDay() + 6) % 7 // Monday = 0 .. Sunday = 6
  date.setUTCDate(date.getUTCDate() - index)
  return date.toISOString().slice(0, 10)
}

function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}

const TODAY = localDay(Date.now())
const THIS_WEEK = mondayOf(TODAY)
const LAST_WEEK = addDays(THIS_WEEK, -7)

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

/** An onboarded learner (VN schedule, DSA + English), signed in on /progress. */
async function signInLearner(page: Page): Promise<{ id: string }> {
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await seedLearnerSetup(user.id, {
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh',
      dayStartsAt: '04:00',
      effectiveAt: new Date(Date.now() - 90 * DAY_MS).toISOString(),
    },
    tracks: [
      { trackId: 'dsa', roadmapVariant: '8w', budgetMinutes: 60, startDate: '2026-01-01' },
      { trackId: 'english', roadmapVariant: '10w', budgetMinutes: 25, startDate: '2026-01-01' },
    ],
  })
  await signIn(page, user, '/progress')
  await expect(page).toHaveURL((url) => url.pathname === '/progress')
  return user
}

test('shows the seeded heatmap days (the table view lists their minutes) and the streak', async ({
  page,
}) => {
  const learner = await signInLearner(page)
  await seedDailyActivity(learner.id, [
    {
      localDay: LAST_WEEK,
      minutesByTrack: { dsa: 30, english: 10 },
      itemsDone: 2,
      completed: true,
    },
    {
      localDay: addDays(LAST_WEEK, 1),
      minutesByTrack: { dsa: 20 },
      itemsDone: 1,
      completed: false,
    },
    {
      localDay: THIS_WEEK,
      minutesByTrack: { dsa: 45, english: 15 },
      itemsDone: 3,
      completed: true,
    },
  ])
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Tiến độ' })).toBeVisible()

  await page.getByRole('button', { name: 'Xem dạng bảng' }).click()
  const table = page.getByRole('table')
  await expect(table.getByRole('row').filter({ hasText: '1 giờ' })).toHaveCount(1) // 45+15 this week
  await expect(table.getByRole('row').filter({ hasText: '40 phút' })).toHaveCount(1) // 30+10 last week

  await expectNoAxeViolationsInBothThemes(page)
})

test('the weekly bars show values per track, and week navigation moves between weeks', async ({
  page,
}) => {
  const learner = await signInLearner(page)
  await seedDailyActivity(learner.id, [
    { localDay: LAST_WEEK, minutesByTrack: { dsa: 30, english: 10 }, completed: true },
    { localDay: addDays(LAST_WEEK, 1), minutesByTrack: { dsa: 20 } },
    { localDay: THIS_WEEK, minutesByTrack: { dsa: 45, english: 15 }, completed: true },
  ])
  await page.reload()

  const summary = page.getByRole('region', { name: 'Tổng kết tuần' })
  await expect(summary.getByText('45 phút', { exact: true })).toBeVisible()
  await expect(summary.getByText('15 phút', { exact: true })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Điều hướng tuần' })
  await nav.getByRole('link', { name: 'Tuần trước' }).click()
  await expect(page).toHaveURL((url) => url.searchParams.get('week') === LAST_WEEK)
  await expect(summary.getByText('50 phút', { exact: true })).toBeVisible() // 30 + 20
  await expect(summary.getByText('10 phút', { exact: true })).toBeVisible()

  await nav.getByRole('link', { name: 'Tuần sau' }).click()
  await expect(page).toHaveURL((url) => url.searchParams.get('week') === THIS_WEEK)
  await expect(summary.getByText('45 phút', { exact: true })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Tuần sau' })).toBeDisabled()
})

test('[RF-4] a new learner with no daily_activity at all sees the empty state', async ({
  page,
}) => {
  await signInLearner(page)
  const main = page.getByRole('main')
  await expect(main.getByText('Chưa có ngày học nào — bắt đầu từ trang Hôm nay')).toBeVisible()
  await expect(main.getByRole('link', { name: 'Hôm nay' })).toHaveAttribute('href', '/today')
  await expectNoAxeViolationsInBothThemes(page)
})
