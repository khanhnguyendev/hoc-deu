import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup } from './support/users'

/**
 * /tracks, /t/[trackId] and the item route's 404 (task 3.4b). One onboarded learner per test:
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
