import type { Page } from '@playwright/test'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import {
  addDays,
  newBlock,
  plansOf,
  seedItemStates,
  seedPlan,
  snapshot,
  stableSchedule,
} from './support/plans'
import { blockCheckIn, itemEvents } from './support/results'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup, type TestUser } from './support/users'

/**
 * Item results on item pages (task 5.2c; §4.4, §5.5–§5.7; decisions 14–19; ADR-0036). Every test
 * creates its own learner with a UTC schedule whose day start is far from now (`stableSchedule`),
 * so the local day the test seeds is the app's. What the server recorded is read back with the
 * secret key — the events and, for the auto check-in, the block's `plan_block_state` row (the
 * dashboard's "Xong · tự động" is 5.2b's, asserted in 5.4). Cleanup deletes users, never rows.
 */

const DSA = 'Cấu trúc dữ liệu & Giải thuật'

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

type Track = 'dsa' | 'english'

/** An onboarded learner of `tracks`, started 10 days ago, with the stable schedule. */
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
      startDate: addDays(schedule.today, -10),
    })),
  })
  return { user, today: schedule.today }
}

/** Signs in straight to the item page and waits for its result controls to be interactive. */
async function openItem(page: Page, user: TestUser, path: string, h1?: string): Promise<void> {
  await signIn(page, user, path)
  await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === path)
  if (h1 !== undefined) {
    await expect(page.getByRole('heading', { level: 1, name: h1 })).toBeVisible()
  }
}

const saved = (page: Page, text = 'Đã lưu kết quả.') =>
  expect(page.locator('[data-slot="outcome-message"]').filter({ hasText: text })).toBeVisible()

test('[auto check-in] a new problem’s block item: "Tự giải được" records solved on the block’s plan and checks the block in', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'])
  const block = newBlock(today, 'dsa', [{ itemId: 'dsa:lc-0002', minutes: 35 }])
  const planId = await seedPlan(user.id, {
    planDate: today,
    blocks: [block],
    tracks: { dsa: snapshot('8w') },
  })
  const path = `/t/dsa/items/lc-0002?${new URLSearchParams({ block: block.id, mode: 'new' })}`
  await openItem(page, user, path, 'Add Two Numbers')

  const meta = page.locator('[data-slot="item-meta"]')
  await expect(meta.getByText('Chưa học')).toBeVisible()
  await expect(meta.getByText('Trong kế hoạch hôm nay')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Bạn giải bài này thế nào?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bỏ qua mục này' })).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)

  await page.getByRole('button', { name: 'Tự giải được' }).click()
  await saved(page, 'Đã lưu kết quả. Khối học đã được tự động check-in.')

  const results = await itemEvents(user.id, 'dsa:lc-0002', 'item.result')
  expect(results).toEqual([
    {
      type: 'item.result',
      payload: { result: 'solved' },
      plan_id: planId,
      block_id: block.id,
      source: 'learner',
    },
  ])
  // The block's only item has a result: the server checked it in, done and automatic (§5.5).
  expect(await blockCheckIn(user.id, planId, block.id)).toEqual({
    status: 'done',
    auto: true,
    minutes: 35,
  })
  // The page re-rendered with the learner's new state: introduced, not due, so no skip.
  await expect(meta.getByText('Ổn')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bỏ qua mục này' })).toBeHidden()
})

test('a due problem opened with ?mode=recall: the prompt, "Xem ghi chú", then "Nhớ một phần" → hint, recall', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'])
  await seedItemStates(user.id, [
    {
      itemId: 'dsa:lc-0217',
      trackId: 'dsa',
      topicId: 'arrays-hashing',
      itemType: 'problem',
      introducedOn: addDays(today, -7),
      dueOn: today,
      status: 'ok',
    },
  ])
  await openItem(page, user, '/t/dsa/items/lc-0217?mode=recall', 'Contains Duplicate')
  await expect(
    page.getByRole('heading', { name: 'Nêu pattern, cách làm và độ phức tạp' }),
  ).toBeVisible()
  await expect(page.locator('[data-slot="problem-note"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem ghi chú' }).click()
  await expect(page.locator('[data-slot="problem-note"]')).toBeVisible()
  await page.getByRole('button', { name: 'Nhớ một phần' }).click()
  await saved(page)

  const results = await itemEvents(user.id, 'dsa:lc-0217', 'item.result')
  expect(results.map((event) => event.payload)).toEqual([{ result: 'hint', mode: 'recall' }])
  // No plan today yet: the result builds today's plan first and names a block of it — the review
  // block listing the due problem, or the extra block it is attached to (task 5.4, decision 21).
  const plan = (await plansOf(user.id)).find((row) => row.plan_date === today)
  expect(results[0]?.plan_id).toBe(plan?.id)
  expect(results[0]?.block_id).toMatch(new RegExp(`^${today}:dsa:`))
})

test('the nudge: revealing the solution before grading preselects "Cần gợi ý", which records hint', async ({
  page,
}) => {
  const { user } = await learner(['dsa'])
  await openItem(page, user, '/t/dsa/items/lc-0001', 'Two Sum')
  const hint = page.getByRole('button', { name: 'Cần gợi ý' })
  await expect(hint).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Xem lời giải' }).click()
  await expect(page.getByRole('tablist', { name: 'Ngôn ngữ lời giải' })).toBeVisible()
  await expect(hint).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/Bạn đã xem lời giải nên "Cần gợi ý" được chọn sẵn/)).toBeVisible()
  await hint.click()
  await saved(page)
  const results = await itemEvents(user.id, 'dsa:lc-0001', 'item.result')
  expect(results.map((event) => event.payload)).toEqual([{ result: 'hint' }])
})

test('a flashcard: "Xem nghĩa", then key 2 grades it "unsure"', async ({ page }) => {
  const { user } = await learner(['english'])
  await openItem(page, user, '/t/english/items/w01-blocker', 'blocker')
  await page.getByRole('button', { name: 'Xem nghĩa' }).click()
  const grades = page.getByRole('group', { name: 'Bạn nhớ thẻ này không?' })
  await expect(grades).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)

  await page.keyboard.press('2')
  await saved(page)
  await expect(grades.getByRole('button', { name: 'Chưa chắc' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const results = await itemEvents(user.id, 'english:w01-blocker', 'item.result')
  expect(results.map((event) => event.payload)).toEqual([{ result: 'unsure' }])
})

test('a lesson: "Hoàn thành bài học" records lesson.completed', async ({ page }) => {
  const { user } = await learner(['dsa'])
  await openItem(page, user, '/t/dsa/items/lesson-arrays-hashing')
  const complete = page.getByRole('button', { name: 'Hoàn thành bài học' })
  await expect(complete).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)

  await complete.click()
  await saved(page)
  const done = await itemEvents(user.id, 'dsa:lesson-arrays-hashing', 'lesson.completed')
  expect(done.map((event) => event.payload)).toEqual([{}])
})

test('an exercise: the fill-blank check submits exercise.submitted { kind, grade }', async ({
  page,
}) => {
  const { user } = await learner(['english'])
  await openItem(page, user, '/t/english/items/ex-w01-fill-1', 'Điền từ còn thiếu')
  await page.getByRole('textbox', { name: 'Từ còn thiếu' }).fill('hold')
  await page.getByRole('button', { name: 'Kiểm tra' }).click()
  await expect(page.getByText('Chính xác')).toBeVisible()
  await saved(page)
  const submitted = await itemEvents(user.id, 'english:ex-w01-fill-1', 'exercise.submitted')
  expect(submitted.map((event) => event.payload)).toEqual([{ kind: 'fill-blank', grade: 'pass' }])
})

test('the mock interview: its Medium problem, then "Đã làm xong" with rating 3', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'])
  await seedItemStates(user.id, [
    {
      itemId: 'dsa:lc-0002',
      trackId: 'dsa',
      topicId: 'linked-list',
      itemType: 'problem',
      introducedOn: addDays(today, -9),
      dueOn: addDays(today, 5),
      status: 'ok',
    },
  ])
  await openItem(page, user, '/t/dsa/items/prompt-mock-interview')
  await expect(page.getByRole('link', { name: /Add Two Numbers/ })).toHaveAttribute(
    'href',
    '/t/dsa/items/lc-0002',
  )
  await page.getByRole('radio', { name: '3 — Tốt' }).click()
  await page.getByRole('button', { name: 'Đã làm xong' }).click()
  await saved(page)
  const done = await itemEvents(user.id, 'dsa:prompt-mock-interview', 'prompt.completed')
  expect(done.map((event) => event.payload)).toEqual([{ selfRating: 3 }])
})

test('"Bỏ qua mục này" asks first, then records item.skipped — a skip is not a result: no auto check-in', async ({
  page,
}) => {
  const { user, today } = await learner(['dsa'])
  // The block's only item: the skip handles it, but nothing was studied, so the server checks
  // nothing in (decision 15 as amended, ruling M5-R36) — the learner checks the block in.
  const block = newBlock(today, 'dsa', [{ itemId: 'dsa:lc-0003', minutes: 35 }])
  const planId = await seedPlan(user.id, {
    planDate: today,
    blocks: [block],
    tracks: { dsa: snapshot('8w') },
  })
  const path = `/t/dsa/items/lc-0003?${new URLSearchParams({ block: block.id, mode: 'new' })}`
  await openItem(page, user, path, 'Longest Substring Without Repeating Characters')
  await page.getByRole('button', { name: 'Bỏ qua mục này' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Bỏ qua mục này?' })
  await expect(dialog).toBeVisible()
  expect(await itemEvents(user.id, 'dsa:lc-0003')).toEqual([])
  await dialog.getByRole('button', { name: 'Bỏ qua' }).click()
  await expect(dialog).toBeHidden()
  await saved(page)
  await expect(
    page.locator('[data-slot="outcome-message"]').filter({ hasText: 'tự động' }),
  ).toHaveCount(0)
  const skipped = await itemEvents(user.id, 'dsa:lc-0003', 'item.skipped')
  expect(skipped).toEqual([
    { type: 'item.skipped', payload: {}, plan_id: planId, block_id: block.id, source: 'learner' },
  ])
  expect(await blockCheckIn(user.id, planId, block.id)).toBeNull()
  await expect(page.locator('[data-slot="item-meta"]').getByText('Đã bỏ qua')).toBeVisible()

  // /today: the block is not checked in — no "Xong · tự động"; its one-tap check-in is offered.
  await page.goto('/today')
  const card = page.getByRole('article', { name: `Bài mới ${DSA}` })
  await expect(card.getByRole('button', { name: `Check-in: Bài mới · ${DSA}` })).toBeVisible()
  await expect(card.locator('[data-slot="check-in-status"]')).toHaveCount(0)
  await expect(card.getByText('tự động')).toHaveCount(0)
})
