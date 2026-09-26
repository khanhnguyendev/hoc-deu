import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { expect, test } from './support/test'
import {
  countEvents,
  createTestUser,
  deleteTestUser,
  getProfile,
  getScheduleVersions,
  getUserTracks,
  type TestUser,
} from './support/users'

/** The onboarding wizard (task 2.10, §2.4, §5.11, decisions 5, 6, 9, 22). */

// The browser reports the legacy ID, as Node's ICU does (decision 6); the wizard must still
// preselect the canonical Asia/Ho_Chi_Minh.
test.use({ timezoneId: 'Asia/Saigon' })

const created: string[] = []
async function user(options?: Parameters<typeof createTestUser>[0]): Promise<TestUser> {
  const testUser = await createTestUser(options)
  created.push(testUser.id)
  return testUser
}
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

const expectPath = (page: Page, path: string) =>
  expect(page).toHaveURL((url) => url.pathname === path)
const stepHeading = (page: Page, name: string) =>
  page.getByRole('heading', { level: 2, name, exact: true })
const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục' }).click()
const back = (page: Page) => page.getByRole('button', { name: 'Quay lại' }).click()

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH = 'Tiếng Anh cho môi trường IT'

test('a new learner picks DSA and English, sets the schedule and lands on /today', async ({
  page,
}) => {
  const learner = await user()
  await signIn(page, learner)
  await expectPath(page, '/onboarding')

  // Step 1 — the manifests reached the server build (both tracks are offered).
  await expect(stepHeading(page, 'Chọn lộ trình')).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)
  await page.getByRole('checkbox', { name: new RegExp(`^${DSA}`) }).click()
  await page.getByRole('checkbox', { name: new RegExp(`^${ENGLISH}`) }).click()
  await next(page)

  // Step 2 — minutes per track, defaulted from the manifests.
  await expect(stepHeading(page, 'Thời gian mỗi ngày')).toBeVisible()
  const dsaMinutes = page.getByRole('spinbutton', { name: DSA })
  await expect(dsaMinutes).toHaveValue('60')
  await expect(page.getByRole('spinbutton', { name: ENGLISH })).toHaveValue('25')
  await next(page)

  // Step 3 — 60 min/day: "8 tuần" by default, with the simulated finish (§5.11).
  await expect(stepHeading(page, 'Phiên bản lộ trình')).toBeVisible()
  await expect(page.getByRole('radio', { name: /^8 tuần/ })).toBeChecked()
  const eightWeeks = page.getByText(/lộ trình 8 tuần thường hoàn thành sau/)
  await expect(eightWeeks).toContainText('~11 tuần')
  await expect(eightWeeks).toContainText('11,4')

  // Back to the minutes: 75 min/day moves the default to "10 tuần".
  await back(page)
  await dsaMinutes.fill('75')
  await next(page)
  await expect(page.getByRole('radio', { name: /^10 tuần/ })).toBeChecked()
  await next(page)

  // Step 4 — the browser's Asia/Saigon shows as Asia/Ho_Chi_Minh; day start 04:00; today.
  await expect(stepHeading(page, 'Lịch học')).toBeVisible()
  await expect(page.getByLabel('Múi giờ', { exact: true })).toHaveValue('Asia/Ho_Chi_Minh')
  await expect(page.getByLabel('Ngày mới bắt đầu lúc', { exact: true })).toHaveValue('04:00')
  const startDate = await page.getByLabel('Ngày bắt đầu', { exact: true }).inputValue()
  expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  await next(page)

  // Step 5 — Python by default.
  await expect(stepHeading(page, 'Ngôn ngữ lập trình')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Python' })).toBeChecked()
  await next(page)

  // Step 6 — the weekly template preview.
  await expect(stepHeading(page, 'Xem trước tuần học')).toBeVisible()
  await expect(page.getByText('Thứ 2 – Thứ 6').first()).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)
  await page.getByRole('button', { name: 'Bắt đầu học' }).click()
  await expectPath(page, '/today')

  // The database holds exactly what was chosen, through five events.
  expect(await getUserTracks(learner.id)).toEqual([
    {
      track_id: 'dsa',
      roadmap_variant: '10w',
      budget_minutes: 75,
      start_date: startDate,
      status: 'active',
    },
    {
      track_id: 'english',
      roadmap_variant: '10w',
      budget_minutes: 25,
      start_date: startDate,
      status: 'active',
    },
  ])
  const versions = await getScheduleVersions(learner.id)
  expect(versions.map(({ timezone, day_starts_at }) => ({ timezone, day_starts_at }))).toEqual([
    { timezone: 'Asia/Ho_Chi_Minh', day_starts_at: '04:00:00' },
  ])
  const profile = await getProfile(learner.id)
  expect(profile.code_language).toBe('python')
  expect(profile.onboarded_at).not.toBeNull()
  // Onboarding writes five events; landing on /today then builds today's plan (task 5.1b), which
  // adds one `plan.generated`.
  expect(await countEvents(learner.id)).toBe(6)
  expect(await countEvents(learner.id, { type: 'plan.generated' })).toBe(1)
})
