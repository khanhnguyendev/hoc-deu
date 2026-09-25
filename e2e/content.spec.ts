import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Browser, WorkerInfo } from '@playwright/test'
import { expectNoAxeViolations, expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { expect, test as base } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup, type TestUser } from './support/users'

/**
 * The content smoke test (decision 4, task 3.4b): every item page a learner can reach renders from
 * the generated catalog — every active lesson, every active problem with an active note, and the
 * first and last active item of each type. Items are read from `.generated/catalog.json`
 * (`pnpm test:e2e` runs content:build first). With no content yet (PR A) the spec skips.
 *
 * axe: light on desktop for every item; dark, and the mobile project, for the first item of each
 * type only.
 */

type CatalogItemJson = {
  id: string
  type: string
  trackId: string
  localId: string
  status: string
  title: string
  content: {
    sections?: string[]
    note?: { status: string; verification: string; languages: string[] } | null
  }
}
type CatalogJson = {
  tracks: { id: string; status: string }[]
  items: Record<string, CatalogItemJson>
}

const catalog = JSON.parse(readFileSync('.generated/catalog.json', 'utf8')) as CatalogJson
const activeTracks = new Set(
  catalog.tracks.filter((track) => track.status === 'active').map((track) => track.id),
)
/** What a learner can open: active items of active tracks, in catalog (ID) order. */
const reachable = Object.values(catalog.items).filter(
  (item) => item.status === 'active' && activeTracks.has(item.trackId),
)

const hasActiveNote = (item: CatalogItemJson) =>
  item.type === 'problem' && item.content.note?.status === 'active'

/** The items to open; `first` marks the first item of its type (dark + mobile axe). */
function targets(): { item: CatalogItemJson; first: boolean }[] {
  const byType = new Map<string, CatalogItemJson[]>()
  for (const item of reachable) byType.set(item.type, [...(byType.get(item.type) ?? []), item])
  const firsts = new Set([...byType.values()].map((items) => items[0]?.id))
  const lasts = new Set([...byType.values()].map((items) => items.at(-1)?.id))
  return reachable
    .filter(
      (item) =>
        item.type === 'lesson' || hasActiveNote(item) || firsts.has(item.id) || lasts.has(item.id),
    )
    .map((item) => ({ item, first: firsts.has(item.id) }))
}

const TARGETS = targets()
const LANGUAGE_NAMES: Record<string, string> = { python: 'Python', java: 'Java', go: 'Go' }
const DAY_MS = 86_400_000

/** Signs `user` in once in a fresh context and saves the session for the worker's tests. */
async function saveSession(
  browser: Browser,
  user: TestUser,
  workerInfo: WorkerInfo,
): Promise<string> {
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
  const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL })
  try {
    const page = await context.newPage()
    await signIn(page, user, '/tracks')
    const file = path.join(
      workerInfo.project.outputDir,
      '.auth',
      `content-learner-${workerInfo.workerIndex}.json`,
    )
    await context.storageState({ path: file })
    return file
  } finally {
    await context.close()
  }
}

/**
 * One onboarded learner per worker, signed in once (a worker-scoped fixture); every test reuses
 * the saved session through `storageState`. (`provide` is Playwright's `use`, renamed so the React
 * hooks lint rule does not mistake it for React's `use`.)
 */
const test = base.extend<object, { learnerStorage: string }>({
  learnerStorage: [
    async ({ browser }, provide, workerInfo) => {
      const user = await createTestUser({ onboarded: true })
      const file = await saveSession(browser, user, workerInfo).catch(async (error: unknown) => {
        await deleteTestUser(user.id)
        throw error
      })
      await provide(file)
      await deleteTestUser(user.id)
    },
    { scope: 'worker' },
  ],
  storageState: async ({ learnerStorage }, provide) => {
    await provide(learnerStorage)
  },
})

if (TARGETS.length === 0) {
  test('content smoke test', () => {
    test.skip(true, 'no content items yet')
  })
}

for (const { item, first } of TARGETS) {
  test(`${item.id} (${item.type}) renders its page`, async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile'
    test.skip(mobile && !first, 'mobile runs the first item of each type')

    const response = await page.goto(`/t/${item.trackId}/items/${encodeURIComponent(item.localId)}`)
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(item.title)

    if (item.type === 'lesson') {
      // Top-level <Section>s only, in order (the catalog's `sections`).
      const kinds = await page
        .locator('[data-slot="item-page"] [data-section]:not([data-section] [data-section])')
        .evaluateAll((sections) => sections.map((section) => section.getAttribute('data-section')))
      expect(kinds).toEqual(item.content.sections)
    }

    const note = item.content.note
    if (hasActiveNote(item) && note) {
      await expect(
        page.locator(`[data-slot="verification-badge"][data-verification="${note.verification}"]`),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Xem lời giải' }).first().click()
      const tabs = page.getByRole('tablist', { name: 'Ngôn ngữ lời giải' }).first()
      await expect(tabs.getByRole('tab')).toHaveText(
        note.languages.map((language) => LANGUAGE_NAMES[language] ?? language),
      )
    }

    if (first) await expectNoAxeViolationsInBothThemes(page)
    else await expectNoAxeViolations(page)
  })
}
