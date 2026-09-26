import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { seedDailyActivity } from './support/activity'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { activityOf } from './support/check-in'
import { itemStateCount, planOf, seedResultEvent } from './support/extra'
import { addDays, seedItemStates, stableSchedule } from './support/plans'
import { expect, test } from './support/test'
import {
  countEvents,
  createTestUser,
  deleteTestUser,
  seedLearnerSetup,
  type TestUser,
} from './support/users'

/**
 * /tracks, /t/[trackId] and the item route's 404 (task 3.4b); the learner's progress, Weak items
 * and "Bắt đầu lại" on the track page (task 5.4). One onboarded learner per test:
 * DSA 8w at 60 min/day and English 10w at 25 min/day (as the settings spec, 2.11). The roadmap
 * part reads `.generated/catalog.json` (`pnpm test:e2e` runs content:build first): with a DSA 8w
 * roadmap the page shows week 1 and its first core problem, without one the empty state (PR A,
 * decision 4).
 */

type CatalogJson = {
  roadmaps: Record<string, Record<string, { weeks: { week: number; core: string[] }[] }>>
  items: Record<string, { title: string; status: string }>
}
const catalog = JSON.parse(readFileSync('.generated/catalog.json', 'utf8')) as CatalogJson
const DSA_8W = catalog.roadmaps.dsa?.['8w'] ?? null
/** The first active core problem of DSA 8w week 1 (a learner sees no drafts), if any. */
const FIRST_CORE =
  DSA_8W?.weeks[0]?.core
    .map((id) => catalog.items[id])
    .find((item) => item !== undefined && item.status === 'active') ?? null

/** DSA 8w's active core items (DSA has no decks): what the track page's progress counts. */
const CORE_TOTAL = new Set(
  (DSA_8W?.weeks ?? [])
    .flatMap((week) => week.core)
    .filter((id) => catalog.items[id]?.status === 'active'),
).size

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH = 'Tiếng Anh cho môi trường IT'
const DAY_MS = 86_400_000

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

/** An onboarded learner (VN schedule, DSA 8w/60 + English 10w/25), signed in on `path`. */
async function signInLearner(page: Page, path: string): Promise<void> {
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await seedLearnerSetup(user.id, {
    schedule: {
      timezone: 'Asia/Ho_Chi_Minh',
      dayStartsAt: '04:00',
      effectiveAt: new Date(Date.now() - 30 * DAY_MS).toISOString(),
    },
    tracks: [
      { trackId: 'dsa', roadmapVariant: '8w', budgetMinutes: 60, startDate: '2026-09-01' },
      { trackId: 'english', roadmapVariant: '10w', budgetMinutes: 25, startDate: '2026-09-01' },
    ],
  })
  await signIn(page, user, path)
  await expect(page).toHaveURL((url) => url.pathname === path)
}

/** The visible main navigation's "Lộ trình" item (the sidebar on desktop, the bottom nav on a phone). */
const roadmapNavItem = (page: Page) =>
  page
    .locator('nav[aria-label="Điều hướng chính"]:visible')
    .getByRole('link', { name: 'Lộ trình', exact: true })

const card = (page: Page, title: string) => page.getByRole('article', { name: title, exact: true })

test('/tracks lists both enrolled tracks with their variants', async ({ page }) => {
  await signInLearner(page, '/tracks')
  await expect(page).toHaveTitle('Lộ trình — Học Đều')
  await expect(page.getByRole('heading', { level: 1, name: 'Lộ trình' })).toBeVisible()
  await expect(roadmapNavItem(page)).toHaveAttribute('aria-current', 'page')

  const mine = page.getByRole('region', { name: 'Lộ trình của bạn' })
  await expect(mine.getByRole('article')).toHaveCount(2)
  await expect(card(page, DSA).getByText('8 tuần', { exact: true })).toBeVisible()
  await expect(card(page, DSA).getByText('Đang học', { exact: true })).toBeVisible()
  await expect(card(page, ENGLISH).getByText('10 tuần', { exact: true })).toBeVisible()
  await expect(card(page, DSA).getByRole('link', { name: /^Xem lộ trình/ })).toHaveAttribute(
    'href',
    '/t/dsa',
  )
  // Both active tracks are enrolled: nothing else to add.
  await expect(
    page
      .getByRole('region', { name: 'Lộ trình khác' })
      .getByText('Bạn đang học tất cả lộ trình hiện có.'),
  ).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)

  // The card opens the roadmap.
  await card(page, DSA)
    .getByRole('link', { name: /^Xem lộ trình/ })
    .click()
  await expect(page).toHaveURL((url) => url.pathname === '/t/dsa')
  await expect(page.getByRole('heading', { level: 1, name: DSA })).toBeVisible()
})

test('/t/dsa shows the track, its variants, the weekly template and its roadmap', async ({
  page,
}) => {
  await signInLearner(page, '/t/dsa')
  await expect(page).toHaveTitle(`${DSA} — Học Đều`)
  await expect(page.getByRole('heading', { level: 1, name: DSA })).toBeVisible()
  await expect(page.getByText('Data Structures & Algorithms', { exact: true })).toHaveAttribute(
    'lang',
    'en',
  )
  await expect(roadmapNavItem(page)).toHaveAttribute('aria-current', 'page')

  const variants = page.getByRole('navigation', { name: 'Phiên bản lộ trình' })
  await expect(variants.getByRole('link', { name: '8 tuần' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(variants.getByRole('link', { name: '10 tuần' })).not.toHaveAttribute('aria-current')

  const template = page.getByRole('region', { name: 'Mẫu tuần' })
  await expect(template.getByText('Thứ 2 – Thứ 6', { exact: true })).toBeVisible()
  await expect(template.getByText('Ôn tập (tối đa 15 phút)', { exact: true })).toBeVisible()

  if (DSA_8W === null) {
    // PR A: no roadmap file yet (decision 4) → the empty state, with a way back (RF-4).
    await expect(
      page.getByRole('heading', { level: 2, name: 'Lộ trình này chưa có nội dung.' }),
    ).toBeVisible()
    await expect(page.getByText('Nội dung đang được bổ sung.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Xem các lộ trình' })).toHaveAttribute(
      'href',
      '/tracks',
    )
  } else {
    const week1 = page.getByRole('region', { name: 'Tuần 1', exact: true })
    await expect(week1).toBeVisible()
    if (FIRST_CORE !== null) {
      const core = week1.getByRole('list', { name: 'Bài chính' })
      await expect(core.getByRole('link').first()).toContainText(FIRST_CORE.title)
    }
  }
  await expectNoAxeViolationsInBothThemes(page)
})

test('?variant picks a listed roadmap and falls back to the enrolled one', async ({ page }) => {
  await signInLearner(page, '/t/dsa')
  const variants = page.getByRole('navigation', { name: 'Phiên bản lộ trình' })

  await variants.getByRole('link', { name: '10 tuần' }).click()
  await expect(page).toHaveURL((url) => url.searchParams.get('variant') === '10w')
  await expect(variants.getByRole('link', { name: '10 tuần' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(variants.getByRole('link', { name: '8 tuần' })).not.toHaveAttribute('aria-current')

  await page.goto('/t/dsa?variant=nope')
  await expect(variants.getByRole('link', { name: '8 tuần' })).toHaveAttribute(
    'aria-current',
    'true',
  )
  await expect(variants.getByRole('link', { name: '10 tuần' })).not.toHaveAttribute('aria-current')
})

// The real 404 for an unknown track / item / track-mismatched item moved to
// e2e/not-found.spec.ts (task 5.1c: `(app)/loading.tsx` was removed, so `notFound()` now answers
// a genuine HTTP 404 instead of streaming a 200 with `noindex`).

test('on a phone the bottom navigation marks "Lộ trình" on /t/dsa', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'the bottom navigation is the mobile layout')
  await signInLearner(page, '/t/dsa')
  const nav = page.locator('nav[aria-label="Điều hướng chính"]:visible')
  await expect(nav).toHaveCount(1)
  // The visible main navigation sits at the bottom of the viewport.
  const box = await nav.boundingBox()
  const viewport = page.viewportSize()
  expect(box && viewport && Math.round(box.y + box.height)).toBe(viewport?.height)
  await expect(nav.getByRole('link', { name: 'Lộ trình', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

// ---------------------------------------------------------------------------------------------
// Task 5.4: the learner's progress, Weak items and "Bắt đầu lại"
// ---------------------------------------------------------------------------------------------

/**
 * An onboarded DSA (8w) learner with a UTC schedule whose day start is far from now
 * (`stableSchedule`), started 10 days ago, with three week-1 core problems introduced — Two Sum
 * Weak — and signed in on `path`.
 */
async function studiedLearner(
  page: Page,
  path: string,
): Promise<{ user: TestUser; today: string }> {
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
        startDate: addDays(schedule.today, -10),
      },
    ],
  })
  const introduced = addDays(schedule.today, -5)
  const due = addDays(schedule.today, 5)
  await seedItemStates(user.id, [
    {
      itemId: 'dsa:lc-0001',
      trackId: 'dsa',
      topicId: 'arrays-hashing',
      itemType: 'problem',
      introducedOn: introduced,
      dueOn: due,
    },
    {
      itemId: 'dsa:lc-0217',
      trackId: 'dsa',
      topicId: 'arrays-hashing',
      itemType: 'problem',
      introducedOn: introduced,
      dueOn: due,
      status: 'ok',
    },
    {
      itemId: 'dsa:lc-0242',
      trackId: 'dsa',
      topicId: 'arrays-hashing',
      itemType: 'problem',
      introducedOn: introduced,
      dueOn: due,
      status: 'ok',
    },
  ])
  await signIn(page, user, path)
  await expect(page).toHaveURL((url) => url.pathname === path)
  return { user, today: schedule.today }
}

const progressRegion = (page: Page) => page.getByRole('region', { name: 'Tiến độ của bạn' })

test('task 5.4: the track page shows the learner’s week, progress and a Weak item; axe with "Bắt đầu lại" open', async ({
  page,
}) => {
  test.skip(DSA_8W === null, 'needs the DSA 8w roadmap')
  const { user } = await studiedLearner(page, '/t/dsa')
  const progress = progressRegion(page)
  await expect(progress.getByText(`Tuần 1/${DSA_8W!.weeks.length}`)).toBeVisible()
  await expect(progress.getByText(`3/${CORE_TOTAL} bài chính đã học`)).toBeVisible()
  await expect(progress.getByRole('progressbar', { name: `Tiến độ ${DSA}` })).toHaveAttribute(
    'aria-valuenow',
    String(Math.round((3 / CORE_TOTAL) * 100)),
  )
  const weak = page.getByRole('region', { name: 'Bài yếu' })
  const twoSum = weak.getByRole('link', { name: /Two Sum/ })
  await expect(twoSum).toBeVisible()
  await expect(twoSum.getByText('Yếu', { exact: true })).toBeVisible()
  // The roadmap's rows show the learner's status too.
  const week1 = page.getByRole('region', { name: 'Tuần 1', exact: true })
  await expect(
    week1
      .getByRole('list', { name: 'Bài chính' })
      .getByRole('link', { name: /Contains Duplicate/ }),
  ).toContainText('Ổn')
  await expectNoAxeViolationsInBothThemes(page)

  await progress.getByRole('button', { name: 'Bắt đầu lại' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Xoá tiến độ của lộ trình này?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Lịch sử học và chuỗi ngày vẫn được giữ.')
  // An open overlay: axe's aria-hidden-focus is disabled (M1 deferred #19).
  await expectNoAxeViolationsInBothThemes(page, { disableRules: ['aria-hidden-focus'] })
  await dialog.getByRole('button', { name: 'Huỷ' }).click()
  await expect(dialog).toBeHidden()
  expect(await itemStateCount(user.id, 'dsa')).toBe(3)
})

test('task 5.4: "Bắt đầu lại" → confirm — item states gone, events and daily_activity kept, today’s untouched plan rebuilt', async ({
  page,
}) => {
  test.skip(DSA_8W === null, 'needs the DSA 8w roadmap')
  const { user, today } = await studiedLearner(page, '/today')
  await seedResultEvent(user.id, 'dsa:lc-0001', 3)
  const yesterday = addDays(today, -1)
  await seedDailyActivity(user.id, [
    { localDay: yesterday, minutesByTrack: { dsa: 30 }, itemsDone: 1, completed: true },
  ])
  // /today built today's plan; nothing touched it.
  await expect(page.getByRole('region', { name: 'Kế hoạch hôm nay', exact: true })).toBeVisible()
  await expect.poll(async () => (await planOf(user.id, today))?.version).toBe(1)

  await page.goto('/t/dsa')
  await progressRegion(page).getByRole('button', { name: 'Bắt đầu lại' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Xoá tiến độ của lộ trình này?' })
  await dialog.getByRole('button', { name: 'Bắt đầu lại' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('[data-slot="reset-track-button"]').getByRole('status')).toHaveText(
    `Đã bắt đầu lại lộ trình ${DSA}.`,
  )

  expect(await itemStateCount(user.id, 'dsa')).toBe(0)
  // History stays: the events (the reset one added) and the day's activity.
  expect(await countEvents(user.id, { type: 'item.result' })).toBe(1)
  expect(await countEvents(user.id, { type: 'track.reset', trackId: 'dsa' })).toBe(1)
  expect(await activityOf(user.id, yesterday)).toMatchObject({
    completed: true,
    minutes_by_track: { dsa: 30 },
  })
  // Today's untouched plan was rebuilt from the reset track (decision 11).
  expect((await planOf(user.id, today))?.version).toBe(2)
  // The page re-rendered: nothing introduced, nothing Weak.
  await expect(progressRegion(page).getByText(`0/${CORE_TOTAL} bài chính đã học`)).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Bài yếu' })
      .getByText('Chưa có bài yếu nào trong lộ trình này.'),
  ).toBeVisible()
})
