import { readFileSync } from 'node:fs'
import { expectNoAxeViolations } from './support/axe'
import { gotoHydrated } from './support/hydration'
import { expect, test } from './support/test'

/**
 * /dev/content renders the sample lesson and note through `@next/mdx` with the content components
 * (task 3.3b) — the MDX build proven before any content exists. No images: e2e stays offline.
 */
const PAGE = '/dev/content'

// The section kinds straight from the sample, so the order is checked against the source.
const SECTION_KINDS = [
  ...readFileSync('app/dev/content/sample-lesson.mdx', 'utf8').matchAll(/<Section kind="([^"]+)"/g),
].map((m) => m[1] ?? '')

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${PAGE} (${colorScheme})`, () => {
    test.use({ colorScheme })

    test('renders the samples with no WCAG 2.1 AA violations', async ({ page }) => {
      await gotoHydrated(page, PAGE)
      await expect(page.getByRole('heading', { level: 1, name: 'Nội dung mẫu' })).toBeVisible()
      await expectNoAxeViolations(page)
    })

    test('passes axe with the quiz checked and the solution open', async ({ page }) => {
      await gotoHydrated(page, PAGE)
      await page.getByRole('button', { name: 'Kiểm tra', exact: true }).click()
      await page.getByRole('button', { name: 'Xem lời giải' }).click()
      await page.getByRole('button', { name: 'Gợi ý' }).click()
      await expect(page.getByRole('tablist', { name: 'Ngôn ngữ lời giải' })).toBeVisible()
      await expectNoAxeViolations(page)
    })
  })
}

test.describe(`${PAGE} lesson`, () => {
  test('renders the sections in the sample’s order', async ({ page }) => {
    await page.goto(PAGE)
    expect(SECTION_KINDS.length).toBe(9)
    const lesson = page.getByRole('article', { name: 'Bài học mẫu' })
    const kinds = await lesson
      .locator('[data-section]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-section')))
    expect(kinds).toEqual(SECTION_KINDS)
    await expect(
      lesson.getByRole('heading', { level: 2, name: 'Dấu hiệu nhận biết' }),
    ).toBeVisible()
  })

  test('wraps the Term in lang="en" and keeps the gloss Vietnamese', async ({ page }) => {
    await page.goto(PAGE)
    const term = page.locator('[lang="en"]', { hasText: 'two pointers' }).first()
    await expect(term).toBeVisible()
    await expect(term).toHaveText('two pointers')
  })

  test('highlights the fenced code at build time (token classes, no client highlighter)', async ({
    page,
  }) => {
    await page.goto(PAGE)
    const code = page.getByRole('region', { name: 'Đoạn code Python' })
    await expect(code).toContainText('while left < right')
    await expect(code.locator('.text-primary').first()).toHaveText('def')
  })

  test('the quiz flow scores the answers and resets', async ({ page }) => {
    await gotoHydrated(page, PAGE)
    const quiz = page.locator('[data-slot="quiz"]')
    const questions = quiz.getByRole('group')
    await expect(questions).toHaveCount(2)
    await questions.nth(0).getByRole('radio').nth(1).check()
    await questions.nth(1).getByRole('radio').nth(1).check()
    await quiz.getByRole('button', { name: 'Kiểm tra', exact: true }).click()

    await expect(quiz.getByRole('status')).toHaveText('Đúng 1/2')
    await expect(questions.nth(0)).toContainText('Chính xác')
    await expect(questions.nth(1)).toContainText('Chưa đúng — đáp án:')

    await quiz.getByRole('button', { name: 'Làm lại' }).click()
    await expect(quiz.getByRole('status')).toHaveText('')
    await expect(questions.nth(0).getByRole('radio').nth(1)).not.toBeChecked()
  })

  test('arrow keys move the choice within one question', async ({ page }) => {
    await gotoHydrated(page, PAGE)
    const first = page.locator('[data-slot="quiz"]').getByRole('group').nth(0)
    await first.getByRole('radio').nth(0).check()
    await page.keyboard.press('ArrowDown')
    await expect(first.getByRole('radio').nth(1)).toBeChecked()
    await expect(first.getByRole('radio').nth(1)).toBeFocused()
  })

  test('the VarTable is a keyboard-focusable region', async ({ page }) => {
    await gotoHydrated(page, PAGE)
    const table = page.getByRole('region', { name: 'nums = [1, 3, 4, 6], target = 9' })
    await expect(table).toHaveAttribute('tabindex', '0')
    await expect(table.getByRole('table')).toBeVisible()
    // Tab from the element just before it lands on the region.
    await page.getByRole('heading', { level: 2, name: 'Minh hoạ' }).click()
    await page.keyboard.press('Tab')
    await expect(table).toBeFocused()
  })

  test('the practice card links to the resolved problem', async ({ page }) => {
    await page.goto(PAGE)
    const card = page.getByRole('link', { name: /Bài luyện tập/ })
    await expect(card).toHaveAttribute('href', '/t/dsa/items/lc-0015')
    await expect(card).toContainText('3Sum')
  })
})

test.describe(`${PAGE} note`, () => {
  test('"Xem lời giải" reveals the tabs; Java shows class Solution', async ({ page }) => {
    await gotoHydrated(page, PAGE)
    const note = page.getByRole('article', { name: 'Ghi chú mẫu' })
    await expect(note.locator('pre')).toHaveCount(1) // the text fence only: no solution yet
    await note.getByRole('button', { name: 'Xem lời giải' }).click()

    const tabs = note.getByRole('tablist', { name: 'Ngôn ngữ lời giải' })
    await expect(tabs.getByRole('tab')).toHaveText(['Python', 'Java', 'Go'])
    await expect(tabs.getByRole('tab', { name: 'Python' })).toHaveAttribute('aria-selected', 'true')
    await tabs.getByRole('tab', { name: 'Java' }).click()
    await expect(note.getByRole('region', { name: 'Lời giải Java' })).toContainText(
      'class Solution',
    )
  })

  test('external links open in a new tab and say so', async ({ page }) => {
    await page.goto(PAGE)
    const link = page.getByRole('link', { name: /\(mở trong tab mới\)/ }).first()
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(await link.getAttribute('href')).toMatch(/^https:\/\//)
  })
})
