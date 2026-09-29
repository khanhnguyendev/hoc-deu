import { createRequire } from 'node:module'
import type * as Supabase from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, type TestUser } from './support/users'

/**
 * /settings — "Chia sẻ ghi chú với bot AI" (§4.5, §4.6, task 6.7b): the section shows only while
 * `ai_personalization` is on, and its switch saves as soon as it is flipped.
 */

// Same require-hack as e2e/support/users.ts (Node 22 + Playwright's ESM loader hooks fail on the
// circular CommonJS requires inside @supabase/auth-js): the secret-key client (bypasses RLS) sets
// `ai_personalization` directly, as `admin_set_ai_flag` would (task 6.3 owns that RPC's e2e).
const { createClient } = createRequire(import.meta.url)('@supabase/supabase-js') as typeof Supabase

let client: Supabase.SupabaseClient<Database> | undefined
function admin(): Supabase.SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secretKey = process.env.SUPABASE_SECRET_KEY
    if (!url || !secretKey) {
      throw new Error('The local Supabase env is missing — run e2e through playwright.config.ts.')
    }
    client = createClient<Database>(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

/** Sets `ai_personalization` directly (the secret key bypasses RLS, as `admin_set_ai_flag` does). */
async function setAiPersonalization(userId: string, on: boolean): Promise<void> {
  const { error } = await admin()
    .from('profiles')
    .update({ ai_personalization: on })
    .eq('id', userId)
  if (error) throw new Error(`setAiPersonalization(${userId}) failed: ${error.message}`)
}

async function getShareNotesWithAi(userId: string): Promise<boolean> {
  const { data, error } = await admin()
    .from('profiles')
    .select('share_notes_with_ai')
    .eq('id', userId)
    .single()
  if (error) throw new Error(`getShareNotesWithAi(${userId}) failed: ${error.message}`)
  return data.share_notes_with_ai
}

const created: string[] = []
test.afterEach(async () => {
  await Promise.all(created.splice(0).map((id) => deleteTestUser(id)))
})

const section = (page: import('@playwright/test').Page) =>
  page.getByRole('heading', { name: 'Chia sẻ ghi chú với bot AI' })

async function openSettings(page: import('@playwright/test').Page): Promise<TestUser> {
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await signIn(page, user, '/settings')
  await expect(page).toHaveURL((url) => url.pathname === '/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible()
  return user
}

test('a learner whose AI flag is off sees no notes-sharing section', async ({ page }) => {
  await openSettings(page)
  await expect(section(page)).toHaveCount(0)
  await expect(page.getByRole('switch')).toHaveCount(0)
  await expectNoAxeViolationsInBothThemes(page)
})

test('a learner whose AI flag is on turns sharing on; it survives a reload', async ({ page }) => {
  const learner = await openSettings(page)
  await setAiPersonalization(learner.id, true)
  await page.reload()

  await expect(section(page)).toBeVisible()
  await expect(
    page.getByText('Bot AI và người vận hành bot có thể xem ghi chú bạn chia sẻ.'),
  ).toBeVisible()
  const toggle = page.getByRole('switch', { name: 'Chia sẻ ghi chú với bot AI' })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expectNoAxeViolationsInBothThemes(page)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => getShareNotesWithAi(learner.id)).toBe(true)

  await page.reload()
  await expect(page.getByRole('switch', { name: 'Chia sẻ ghi chú với bot AI' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  // The checked state is scanned too (review item 1).
  await expectNoAxeViolationsInBothThemes(page)

  // Turning it back off saves too (always allowed, whatever the AI flag, §4.5).
  await page.getByRole('switch', { name: 'Chia sẻ ghi chú với bot AI' }).click()
  await expect.poll(() => getShareNotesWithAi(learner.id)).toBe(false)
})

test('the AI flag turning off after the page loaded refuses the save (§4.5)', async ({ page }) => {
  const learner = await openSettings(page)
  await setAiPersonalization(learner.id, true)
  await page.reload()
  const toggle = page.getByRole('switch', { name: 'Chia sẻ ghi chú với bot AI' })
  await expect(toggle).toBeVisible()

  // A stale page: the flag turned off in another tab (or by an admin) after this one loaded.
  await setAiPersonalization(learner.id, false)
  await toggle.click()
  await expect(
    page.getByText('Tính năng này chỉ dùng được khi tài khoản bật cá nhân hoá AI.'),
  ).toBeVisible()
  // A failed save never shows a consent that was not stored: back to off (review item 1).
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(await getShareNotesWithAi(learner.id)).toBe(false)
  await expectNoAxeViolationsInBothThemes(page)
})
