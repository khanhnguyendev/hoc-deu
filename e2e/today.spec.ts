import { readFileSync } from 'node:fs'
import type { Locator, Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import {
  addDays,
  formatViDay,
  newBlock,
  plansOf,
  seedBlockState,
  seedItemStates,
  seedPlan,
  setEnrollmentStatus,
  snapshot,
  stableSchedule,
  type StableSchedule,
} from './support/plans'
import { blockCheckIn, itemEvents } from './support/results'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup, type TestUser } from './support/users'

/**
 * `/today` (tasks 5.1b, 5.4; §2.4, §5.2, §5.4, §5.8; RF-4, RF-5; decision 32 of M4; M-5 A;
 * ADR-0039; decision 19: card blocks graded inline).
 * Every test creates its own learner with a UTC schedule whose day start is far from now
 * (`stableSchedule`), so the local day the test seeds is the app's; cleanup deletes the user —
 * never a plan (decision 35 of M4).
 */

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

type CatalogItemJson = {
  id: string
  type: string
  trackId: string
  localId: string
  status: string
  title: string
  content: { note?: { status: string } | null }
}

/**
 * The first active DSA problem a learner sees without a note (none yet, or a draft — §5.9, RF-4),
 * read from `.generated/catalog.json` (`pnpm test:e2e` runs content:build first), so the RF-4 case
 * never depends on one problem staying note-less (M5-R26).
 */
function noteLessProblem(): CatalogItemJson {
  const catalog = JSON.parse(readFileSync('.generated/catalog.json', 'utf8')) as {
    items: Record<string, CatalogItemJson>
  }
  const problem = Object.values(catalog.items).find(
    (item) =>
      item.type === 'problem' &&
      item.trackId === 'dsa' &&
      item.status === 'active' &&
      (item.content.note === null ||
        item.content.note === undefined ||
        item.content.note.status === 'draft'),
  )
  if (problem === undefined) {
    throw new Error('The RF-4 case needs an active DSA problem without a visible note.')
  }
  return problem
}

const DSA = 'Cấu trúc dữ liệu & Giải thuật'
const ENGLISH = 'Tiếng Anh cho môi trường IT'
const PAUSED = 'Lộ trình đang tạm dừng — hoàn thành ít nhất một phần để tiếp tục.'
const RESUMED = 'Bạn đã tiếp tục lộ trình hôm nay — kế hoạch mới có vào ngày mai.'
const RESUME = 'Học tiếp hôm nay'

type Track = 'dsa' | 'english'

/** An onboarded learner with the stable schedule and `tracks` starting on `start` (default today). */
async function learner(
  tracks: readonly Track[],
  start?: (today: string) => string,
): Promise<{ user: TestUser; schedule: StableSchedule; today: string }> {
  const schedule = stableSchedule()
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  const startDate = start?.(schedule.today) ?? schedule.today
  await seedLearnerSetup(user.id, {
    schedule,
    tracks: tracks.map((trackId) => ({
      trackId,
      roadmapVariant: trackId === 'dsa' ? '8w' : '10w',
      budgetMinutes: trackId === 'dsa' ? 60 : 25,
      startDate,
    })),
  })
  return { user, schedule, today: schedule.today }
}

async function openToday(page: Page, user: TestUser): Promise<void> {
  await signIn(page, user, '/today')
  await expect(page).toHaveURL((url) => url.pathname === '/today')
  await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()
}

const planRegion = (page: Page, name: string) => page.getByRole('region', { name, exact: true })
const blocksOf = (scope: Locator, trackTitle: string) =>
  scope.getByRole('article').filter({ hasText: trackTitle })
const rowsFor = async (userId: string, planDate: string) =>
  (await plansOf(userId)).filter((row) => row.plan_date === planDate)

/** A seen DSA plan of `planDate` whose one new block holds Contains Duplicate. */
async function seenDsaPlan(userId: string, planDate: string): Promise<string> {
  return seedPlan(userId, {
    planDate,
    blocks: [newBlock(planDate, 'dsa', [{ itemId: 'dsa:lc-0217', minutes: 20 }])],
    tracks: { dsa: snapshot('8w') },
    seenAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  })
}

test('[RF-4] a new learner: blocks of both tracks, streak 0; the plan is built once', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa', 'english'])
  await openToday(page, user)
  const plan = planRegion(page, 'Kế hoạch hôm nay')
  await expect(plan).toBeVisible()
  await expect(blocksOf(plan, DSA).first()).toBeVisible()
  await expect(blocksOf(plan, ENGLISH).first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Tiến độ' })).toContainText('0 ngày liên tiếp')
  expect(await rowsFor(user.id, today)).toHaveLength(1)
  await expectNoAxeViolationsInBothThemes(page)
})

test('[RF-4] a learner starting in 5 days: "Bắt đầu vào …" and no plan', async ({ page }) => {
  const { user, today } = await learner(['dsa', 'english'], (day) => addDays(day, 5))
  await openToday(page, user)
  await expect(
    page.getByRole('heading', { name: `Bắt đầu vào ${formatViDay(addDays(today, 5))}` }),
  ).toBeVisible()
  expect(await plansOf(user.id)).toEqual([])
  await expectNoAxeViolationsInBothThemes(page)
  expect(await plansOf(user.id)).toEqual([])
})

test('[RF-4] a seeded plan: a problem without a note says so; rows link with ?block= and ?mode=', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'], (day) => addDays(day, -10))
  const noteLess = noteLessProblem()
  const block = newBlock(today, 'dsa', [{ itemId: noteLess.id, minutes: 35 }])
  await seedPlan(user.id, { planDate: today, blocks: [block], tracks: { dsa: snapshot('8w') } })
  // Two Weak problems of one topic: a weak area (§5.7).
  await seedItemStates(
    user.id,
    ['dsa:lc-0001', 'dsa:lc-0217'].map((itemId) => ({
      itemId,
      trackId: 'dsa',
      topicId: 'arrays-hashing',
      itemType: 'problem',
      introducedOn: addDays(today, -5),
      dueOn: addDays(today, -2),
    })),
  )
  await openToday(page, user)
  const card = page.getByRole('article', { name: `Bài mới ${DSA}` })
  await expect(card).toBeVisible()
  const row = card.getByRole('link', { name: noteLess.title })
  await expect(row).toBeVisible()
  const href = new URL((await row.getAttribute('href'))!, 'http://localhost')
  expect(href.pathname).toBe(`/t/dsa/items/${noteLess.localId}`)
  expect(href.searchParams.get('block')).toBe(block.id)
  expect(href.searchParams.get('mode')).toBe('new')
  await expect(card.getByText('Chưa có ghi chú')).toBeVisible()
  const weak = page.getByRole('region', { name: 'Chủ đề cần củng cố' })
  await expect(weak.getByRole('link', { name: /Arrays & Hashing/ })).toHaveAttribute(
    'href',
    '/t/dsa',
  )
  // Both Weak problems are due: the due-review card links to /review.
  const due = page.getByRole('link', { name: /Cần ôn hôm nay/ })
  await expect(due).toHaveAttribute('href', '/review')
  await expect(due.locator('[data-slot="stat-card"] > p').nth(1)).toHaveText('2')

  // m-9: an item opened from the plan offers the way back to the dashboard.
  await row.click()
  await expect(page).toHaveURL((url) => url.pathname === `/t/dsa/items/${noteLess.localId}`)
  const back = page.getByRole('link', { name: 'Về Hôm nay' })
  await expect(back).toHaveAttribute('href', '/today')
  await back.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()
})

test('[RF-5] paused 3 days: "Học tiếp hôm nay" builds one plan for today, also when clicked again', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'], (day) => addDays(day, -30))
  const stale = addDays(today, -3)
  await seenDsaPlan(user.id, stale)
  await openToday(page, user)
  await expect(page.getByText(PAUSED)).toBeVisible()
  await expect(page.getByText(`Kế hoạch ngày ${formatViDay(stale)}`)).toBeVisible()
  await expect(planRegion(page, 'Phần còn dang dở').getByRole('article')).toHaveCount(1)
  await expectNoAxeViolationsInBothThemes(page)
  expect(await rowsFor(user.id, today)).toEqual([])

  await page.getByRole('button', { name: RESUME }).click()
  await expect(planRegion(page, 'Kế hoạch hôm nay')).toBeVisible()
  await expect(page.getByText(PAUSED)).toHaveCount(0)
  await expect.poll(async () => (await rowsFor(user.id, today)).length).toBe(1)

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()
  const again = page.getByRole('button', { name: RESUME })
  if (await again.isVisible()) await again.click()
  await expect(planRegion(page, 'Kế hoạch hôm nay')).toBeVisible()
  expect(await rowsFor(user.id, today)).toHaveLength(1)
  expect((await plansOf(user.id)).map((row) => row.plan_date)).toEqual([stale, today])
})

test('[UI I-3, RF-2] tab B resumes; tab A’s check-in on the paused plan is refused — a toast, today’s plan, focus on its heading', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'], (day) => addDays(day, -30))
  const stale = addDays(today, -3)
  const planId = await seenDsaPlan(user.id, stale)
  await openToday(page, user)
  await expect(page.getByText(PAUSED)).toBeVisible()

  // Tab B (same session) takes "Học tiếp hôm nay": today now has its own plan.
  const tabB = await page.context().newPage()
  await tabB.goto('/today')
  await tabB.getByRole('button', { name: RESUME }).click()
  await expect(planRegion(tabB, 'Kế hoạch hôm nay')).toBeVisible()
  await tabB.close()

  // Tab A still shows the paused plan: its check-in is stale. The re-render swaps in today's plan
  // and removes the button, so the answer is a toast — never silence — and focus is not lost.
  await page.getByRole('button', { name: `Check-in: Bài mới · ${DSA}` }).click()
  await expect(
    page
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Kế hoạch vừa thay đổi. Trang đã được làm mới.' }),
  ).toBeVisible()
  await expect(planRegion(page, 'Kế hoạch hôm nay')).toBeVisible()
  await expect(page.getByText(PAUSED)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 2, name: 'Kế hoạch hôm nay' })).toBeFocused()
  expect(await blockCheckIn(user.id, planId, `${stale}:dsa:new:1`)).toBeNull()
})

test('[RF-5] paused 2 days: the banner, no "Học tiếp hôm nay"', async ({ page }) => {
  const { user, today } = await learner(['dsa'], (day) => addDays(day, -30))
  const stale = addDays(today, -2)
  await seenDsaPlan(user.id, stale)
  await openToday(page, user)
  await expect(page.getByText(PAUSED)).toBeVisible()
  await expect(page.getByText(`Kế hoạch ngày ${formatViDay(stale)}`)).toBeVisible()
  await expect(page.getByRole('button', { name: RESUME })).toHaveCount(0)
  expect(await rowsFor(user.id, today)).toEqual([])
})

test('decision 32: yesterday’s plan checked in done today — resumed, no plan for today', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'], (day) => addDays(day, -30))
  const yesterday = addDays(today, -1)
  const planId = await seenDsaPlan(user.id, yesterday)
  await seedBlockState(user.id, planId, {
    blockId: `${yesterday}:dsa:new:1`,
    trackId: 'dsa',
    status: 'done',
    minutes: 20,
    checkedInOn: today,
  })
  await openToday(page, user)
  await expect(page.getByText(RESUMED)).toBeVisible()
  const plan = planRegion(page, `Kế hoạch ngày ${formatViDay(yesterday)}`)
  await expect(plan.getByRole('article')).toHaveCount(1)
  await expect(plan.getByText('Đã check-in')).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)
  expect(await rowsFor(user.id, today)).toEqual([])
})

test('M-5 A: yesterday’s seen plan held only DSA blocks and DSA is removed — today’s plan is built', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa', 'english'], (day) => addDays(day, -30))
  await seenDsaPlan(user.id, addDays(today, -1))
  await setEnrollmentStatus(user.id, 'dsa', 'removed')
  await openToday(page, user)
  const plan = planRegion(page, 'Kế hoạch hôm nay')
  await expect(blocksOf(plan, ENGLISH).first()).toBeVisible()
  await expect(blocksOf(plan, DSA)).toHaveCount(0)
  await expect(page.getByText(PAUSED)).toHaveCount(0)
  await expect.poll(async () => (await rowsFor(user.id, today)).length).toBe(1)
})

test('ADR-0039: a prefetch never marks a plan seen; opening /today does', async ({ page }) => {
  const { user, today } = await learner(['dsa', 'english'])
  // Not through /today: on /tracks the app shell's "Hôm nay" link prefetches /today (an RSC
  // request) up to its loading state.
  const prefetched = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.pathname === '/today' && url.searchParams.has('_rsc')
  })
  await signIn(page, user, '/tracks')
  await expect(page).toHaveURL((url) => url.pathname === '/tracks')
  expect((await prefetched).ok()).toBe(true)
  // The prefetch stopped at loading.tsx: it built nothing, and nothing is seen.
  expect(await plansOf(user.id)).toEqual([])

  await page.goto('/today')
  await expect(planRegion(page, 'Kế hoạch hôm nay')).toBeVisible()
  await expect
    .poll(async () => (await rowsFor(user.id, today)).map((row) => row.seen_at !== null))
    .toEqual([true])
})

test('decision 19: an English card-only block is graded inline, through its card session', async ({
  page,
}) => {
  const { user, today } = await learner(['english'], (day) => addDays(day, -10))
  const block = newBlock(today, 'english', [
    { itemId: 'english:w01-blocker', minutes: 1.5 },
    { itemId: 'english:w01-unblock', minutes: 1.5 },
  ])
  const planId = await seedPlan(user.id, {
    planDate: today,
    blocks: [block],
    tracks: { english: snapshot('10w') },
  })
  await openToday(page, user)
  const card = page.getByRole('article', { name: `Bài mới ${ENGLISH}` })
  await expect(card.getByText('Còn 2 thẻ')).toBeVisible()
  // The session replaces the rows: the cards are graded here, not on their pages.
  await expect(card.getByRole('link', { name: /blocker/ })).toHaveCount(0)
  await expectNoAxeViolationsInBothThemes(page)

  await card.getByRole('button', { name: 'Xem nghĩa' }).click()
  await card.getByRole('button', { name: /^Biết/ }).click()
  await expect(card.getByText('Còn 1 thẻ')).toBeVisible()
  await card.getByRole('button', { name: 'Xem nghĩa' }).click()
  // The grades are listening once they show; key 2 inside the card (focus is on its toggle):
  // "Chưa chắc".
  await expect(card.getByRole('group', { name: 'Bạn nhớ thẻ này không?' })).toBeVisible()
  await page.keyboard.press('2')
  await expect(card.getByRole('heading', { name: 'Đã ôn xong' })).toBeVisible()

  const recorded = async (itemId: string) => itemEvents(user.id, itemId, 'item.result')
  expect(await recorded('english:w01-blocker')).toEqual([
    {
      type: 'item.result',
      payload: { result: 'know' },
      plan_id: planId,
      block_id: block.id,
      source: 'learner',
    },
  ])
  expect((await recorded('english:w01-unblock')).map((event) => event.payload)).toEqual([
    { result: 'unsure' },
  ])
  // Both cards handled: the block's auto check-in (§5.5), and the finished session stays.
  expect(await blockCheckIn(user.id, planId, block.id)).toEqual({
    status: 'done',
    auto: true,
    minutes: 3,
  })
  await expect(card.locator('[data-slot="check-in-status"]')).toContainText('tự động')
  await expect(card.getByRole('heading', { name: 'Đã ôn xong' })).toBeVisible()
})

test('5.2c’s dashboard check: a block’s only item solved on its page — /today shows "Xong · tự động"', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'], (day) => addDays(day, -10))
  const block = newBlock(today, 'dsa', [{ itemId: 'dsa:lc-0001', minutes: 20 }])
  await seedPlan(user.id, { planDate: today, blocks: [block], tracks: { dsa: snapshot('8w') } })
  await openToday(page, user)
  const card = page.getByRole('article', { name: `Bài mới ${DSA}` })
  await card.getByRole('link', { name: /Two Sum/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Two Sum' })).toBeVisible()
  await page.getByRole('button', { name: 'Tự giải được' }).click()
  await expect(
    page
      .locator('[data-slot="outcome-message"]')
      .filter({ hasText: 'Đã lưu kết quả. Khối học đã được tự động check-in.' }),
  ).toBeVisible()

  await page.goto('/today')
  const status = card.locator('[data-slot="check-in-status"]')
  await expect(status).toHaveAttribute('data-status', 'done')
  await expect(status).toContainText('Xong')
  await expect(status).toContainText('tự động')
  // The one-tap button collapsed into the status row.
  await expect(card.getByRole('button', { name: /^Check-in/ })).toHaveCount(0)
})
