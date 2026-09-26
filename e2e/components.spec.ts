import { readdirSync, readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expectNoAxeViolations } from './support/axe'
import { gotoHydrated } from './support/hydration'
import { expect, test } from './support/test'

// Entry names straight from the catalog sources (registry.tsx and entries/*.tsx, Part B-M5
// decision 3), so a new entry is checked without editing this file.
const CATALOG_FILES = [
  'app/dev/components/registry.tsx',
  ...readdirSync('app/dev/components/entries')
    .filter((name) => name.endsWith('.tsx'))
    .map((name) => `app/dev/components/entries/${name}`),
]
const NAMES = CATALOG_FILES.flatMap((file) =>
  [...readFileSync(file, 'utf8').matchAll(/name: '([^']+)'/g)].map((m) => m[1] ?? ''),
)

// M1 deferred #19: an open overlay hides the rest of the page with aria-hidden (focus trapped
// inside, not `inert`), which axe reports as aria-hidden-focus — scanned as a full page with only
// that rule disabled, so everything else on the page stays checked.
const OVERLAYS: { name: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: 'Dialog',
    open: async (page) => {
      await page.getByRole('button', { name: 'Mở hộp thoại' }).click()
      await expect(page.getByRole('dialog', { name: 'Check-in khối học' })).toBeVisible()
    },
  },
  {
    name: 'Sheet',
    open: async (page) => {
      await page.getByRole('button', { name: 'Mở sheet dưới' }).click()
      await expect(page.getByRole('dialog', { name: 'Bộ lọc' })).toBeVisible()
    },
  },
  {
    name: 'ConfirmDialog',
    open: async (page) => {
      await page.getByRole('button', { name: 'Xoá tài khoản' }).click()
      await expect(page.getByRole('alertdialog', { name: 'Xoá tài khoản?' })).toBeVisible()
    },
  },
  {
    name: 'DropdownMenu',
    open: async (page) => {
      await page.getByRole('button', { name: 'Mở menu mẫu' }).click()
      await expect(page.getByRole('menu')).toBeVisible()
    },
  },
  {
    name: 'Tooltip',
    open: async (page) => {
      await page.getByRole('button', { name: 'Thông tin' }).hover()
      await expect(page.getByRole('tooltip', { name: '24 thẻ đến hạn hôm nay' })).toBeVisible()
    },
  },
]

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`/dev/components (${colorScheme})`, () => {
    test.use({ colorScheme })

    test('renders every catalog entry with no WCAG 2.1 AA violations', async ({ page }) => {
      await page.goto('/dev/components')
      expect(NAMES.length).toBeGreaterThanOrEqual(30)
      for (const name of NAMES) {
        await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeAttached()
      }
      await expectNoAxeViolations(page)
    })

    for (const overlay of OVERLAYS) {
      test(`${overlay.name} open passes axe (full page, aria-hidden-focus disabled)`, async ({
        page,
      }) => {
        await gotoHydrated(page, '/dev/components')
        await overlay.open(page)
        await expectNoAxeViolations(page, { disableRules: ['aria-hidden-focus'] })
      })
    }
  })
}

test.describe('dialog footer on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('tab order follows the visual order of the footer buttons (WCAG 2.4.3)', async ({
    page,
  }) => {
    await gotoHydrated(page, '/dev/components')
    await page.getByRole('button', { name: 'Mở hộp thoại' }).click()
    const boxes = await page
      .locator('[data-slot="dialog-footer"] button')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))
    expect(boxes.length).toBeGreaterThan(1)
    for (let i = 1; i < boxes.length; i++) {
      const [a, b] = [boxes[i - 1]!, boxes[i]!]
      const later = b.top > a.top + 1 || (Math.abs(b.top - a.top) <= 1 && b.left > a.left)
      expect(later, `button ${i} is placed before button ${i - 1}`).toBe(true)
    }
  })
})

test.describe('theme toggle on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('each option stays on one line and the page never scrolls sideways', async ({ page }) => {
    await page.goto('/dev/components')
    // Two instances render on this page: the catalog header's own ThemeToggle and the
    // ThemeToggle entry's demo — either is representative for this layout check.
    const group = page.getByRole('radiogroup', { name: 'Giao diện' }).first()
    const heights = await group
      .getByRole('radio')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
    expect(heights).toHaveLength(3)
    for (const height of heights) expect(height).toBeLessThanOrEqual(48)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBe(0)
  })
})

test.describe('RadioGroup keyboard selection', () => {
  test('ArrowDown moves selection to the next item, ArrowUp moves it back', async ({ page }) => {
    await gotoHydrated(page, '/dev/components')
    const group = page.getByRole('radiogroup', { name: 'Mức độ ưu tiên' })
    const low = group.getByRole('radio', { name: 'Thấp' })
    const medium = group.getByRole('radio', { name: 'Vừa' })

    await expect(low).toHaveAttribute('aria-checked', 'true')
    await low.focus()
    // Radix defers the roving-focus move to a macrotask and tracks "was this an arrow key" via a
    // keydown/keyup pair on document; a zero-delay key tap can release before that deferred move
    // runs. A short delay between keydown and keyup mimics an actual key press.
    await page.keyboard.press('ArrowDown', { delay: 50 })
    await expect(medium).toHaveAttribute('aria-checked', 'true')
    await expect(low).toHaveAttribute('aria-checked', 'false')
    await expect(medium).toBeFocused()

    await page.keyboard.press('ArrowUp', { delay: 50 })
    await expect(low).toHaveAttribute('aria-checked', 'true')
    await expect(medium).toHaveAttribute('aria-checked', 'false')
    await expect(low).toBeFocused()
  })
})

test.describe('filter chips', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('are 32 px tall, hit-testable over 44 px, and never overlap (DESIGN_SYSTEM §5)', async ({
    page,
  }) => {
    await page.goto('/dev/components')
    const chips = page.getByRole('group', { name: 'Lọc theo trạng thái' }).getByRole('button')
    expect(await chips.count()).toBeGreaterThanOrEqual(4)
    const result = await chips.evaluateAll((els) => {
      const hit = (el: Element, x: number, y: number) => {
        const target = document.elementFromPoint(x, y)
        return target !== null && (target === el || el.contains(target))
      }
      // Scroll once so every rect shares one coordinate space.
      els[0]?.parentElement?.scrollIntoView({ block: 'center' })
      return els.map((el) => {
        const r = el.getBoundingClientRect()
        const x = r.left + r.width / 2
        return {
          height: r.height,
          // >= 44 px: 32 px + 6 px each side (probe just inside 6 px).
          top: hit(el, x, r.top - 5.9),
          bottom: hit(el, x, r.bottom + 5.9),
          // The largest possible hit area (8 px each side) for the overlap check.
          rect: { left: r.left, right: r.right, top: r.top - 8, bottom: r.bottom + 8 },
        }
      })
    })
    for (const chip of result) {
      expect(chip.height).toBeCloseTo(32, 0)
      expect(chip.top && chip.bottom).toBe(true)
    }
    // Expanded hit areas of different chips never intersect (>= 8 px apart in a row).
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const [a, b] = [result[i]!.rect, result[j]!.rect]
        const apart =
          a.right + 8 <= b.left || b.right + 8 <= a.left || a.bottom <= b.top || b.bottom <= a.top
        expect(apart, `chips ${i} and ${j} overlap`).toBe(true)
      }
    }
  })
})
