import { expectNoAxeViolations } from './support/axe'
import { gotoHydrated } from './support/hydration'
import { expect, test } from './support/test'

/**
 * /dev/items renders every item type's Page and Row from fixture catalog items (task 3.4a) — the
 * registry proven before any content exists. Both Playwright projects run it (desktop, mobile).
 */
const PAGE = '/dev/items'

/** The h1 of each type's main demo Page (the item title; LeetCode and card fronts in English). */
const PAGE_HEADINGS = [
  'Two Sum',
  'Encode and Decode Strings',
  'Two pointers',
  'blocker',
  'Explain the optimal approach for Two Sum in English.',
  'Điền từ còn thiếu',
  'Trả lời đồng nghiệp một cách lịch sự',
  'Viết lại cho lịch sự và rõ ràng',
  'Phỏng vấn thử: giải một bài trong 30 phút và nói to cách làm',
  'Ghi âm một bản cập nhật stand-up dài 1 phút',
]

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${PAGE} (${colorScheme})`, () => {
    test.use({ colorScheme })

    test('renders every type’s Page and Row with no WCAG 2.1 AA violations', async ({ page }) => {
      await gotoHydrated(page, PAGE)
      await expect(page.getByRole('heading', { level: 1, name: 'Loại mục học' })).toBeVisible()
      for (const name of PAGE_HEADINGS) {
        await expect(
          page.getByRole('heading', { level: 1, name, exact: true }).first(),
        ).toBeVisible()
      }
      const rows = page.locator('[data-slot="link-row"]')
      expect(await rows.count()).toBeGreaterThanOrEqual(10)
      await expectNoAxeViolations(page)
    })

    test('passes axe with the card, the hint, the samples and the solution open', async ({
      page,
    }) => {
      await gotoHydrated(page, PAGE)
      await page.getByRole('button', { name: 'Xem nghĩa' }).first().click()
      await page.getByRole('button', { name: 'Xem gợi ý' }).first().click()
      await page.getByRole('button', { name: 'Xem câu trả lời mẫu' }).first().click()
      await page.getByRole('button', { name: 'Xem lời giải' }).first().click()
      await expect(page.getByRole('tablist', { name: 'Ngôn ngữ lời giải' }).first()).toBeVisible()
      await expectNoAxeViolations(page)
    })
  })
}

test.describe(`${PAGE} interactions`, () => {
  test('"Xem nghĩa" reveals the back of the vocabulary card', async ({ page }) => {
    await gotoHydrated(page, PAGE)
    const card = page.getByRole('article', { name: 'blocker', exact: true })
    await expect(card.getByText('vấn đề đang chặn, khiến bạn chưa làm tiếp được')).toBeHidden()
    await card.getByRole('button', { name: 'Xem nghĩa' }).click()
    await expect(card.getByText('vấn đề đang chặn, khiến bạn chưa làm tiếp được')).toBeVisible()
    await expect(card.getByText(/still waiting for access/)).toHaveAttribute('lang', 'en')
    await expect(card.getByRole('button', { name: 'Ẩn nghĩa' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  test('the fill-blank flow: miss, then pass; close after the hint', async ({ page }) => {
    await gotoHydrated(page, PAGE)
    const exercise = page.getByRole('article', { name: 'Điền từ còn thiếu', exact: true })
    const blank = exercise.getByRole('textbox', { name: 'Từ còn thiếu' })
    const check = exercise.getByRole('button', { name: 'Kiểm tra' })
    const verdict = exercise.getByRole('status')

    await blank.fill('stuck')
    await check.click()
    await expect(verdict).toHaveText('Chưa đúng — đáp án: blocked')

    await blank.fill('  Blocked ')
    await check.click()
    await expect(verdict).toHaveText('Chính xác')

    await exercise.getByRole('button', { name: 'Xem gợi ý' }).click()
    await expect(exercise.getByText(/bị chặn, không làm tiếp được/)).toBeVisible()
    await check.click()
    await expect(verdict).toHaveText('Gần đúng — bạn đã xem gợi ý')
  })

  test('"Xem lời giải" on the noted problem reveals the three languages', async ({ page }) => {
    await gotoHydrated(page, PAGE)
    const problem = page.getByRole('article', { name: 'Two Sum', exact: true })
    await expect(problem.getByText('Đã kiểm thử')).toBeVisible()
    await expect(problem.getByRole('link', { name: /Mở trên LeetCode/ })).toHaveAttribute(
      'href',
      'https://leetcode.com/problems/two-sum/',
    )
    await problem.getByRole('button', { name: 'Xem lời giải' }).click()
    const tabs = problem.getByRole('tablist', { name: 'Ngôn ngữ lời giải' })
    await expect(tabs.getByRole('tab')).toHaveText(['Python', 'Java', 'Go'])
    await tabs.getByRole('tab', { name: 'Go' }).click()
    await expect(problem.getByRole('region', { name: 'Lời giải Go' })).toContainText('func')
  })

  test('the premium problem has no note and links its free alternative', async ({ page }) => {
    await page.goto(PAGE)
    const problem = page.getByRole('article', { name: 'Encode and Decode Strings', exact: true })
    await expect(problem.getByRole('heading', { name: 'Chưa có ghi chú' })).toBeVisible()
    await expect(problem.getByRole('link', { name: /LintCode 659/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    )
  })

  test('every row is one link of at least 44 px', async ({ page }) => {
    await page.goto(PAGE)
    const rows = page.locator('[data-slot="link-row"]')
    const count = await rows.count()
    for (let index = 0; index < count; index += 1) {
      const box = await rows.nth(index).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })
})
