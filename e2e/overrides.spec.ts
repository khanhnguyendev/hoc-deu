import { expectNoAxeViolationsInBothThemes } from './support/axe'
import { signIn } from './support/auth'
import { setAiFlagOff } from './support/bot'
import { setAiFlagOn } from './support/custom-items'
import { overrideState, planTags, seedInsertBlock } from './support/overrides'
import { addDays, seedItemStates, stableSchedule } from './support/plans'
import { expect, test } from './support/test'
import { createTestUser, deleteTestUser, seedLearnerSetup } from './support/users'

/**
 * "Điều chỉnh lộ trình bởi AI" (task 6.6c; §2.4, §5.9, §5.12): an AI learner's `insert_block` —
 * seeded straight into `roadmap_overrides` (`support/overrides.ts` says why) for every weekday, so
 * the fixture day always matches — shapes today's plan (a `topic-practice` block), is listed in
 * /settings and revoked with "Thu hồi"; today's plan keeps its block (§5.9: from the next plan).
 * Every test creates its own learner, turns the AI flag off and deletes it.
 */

const created: string[] = []
test.afterEach(async () => {
  const ids = created.splice(0)
  await Promise.all(ids.map((id) => setAiFlagOff(id)))
  await Promise.all(ids.map((id) => deleteTestUser(id)))
})

const LINE = 'Thêm 30 phút luyện Arrays & Hashing vào T2, T3, T4, T5, T6, T7, CN'

test('an AI adjustment shapes today, is listed in /settings and revoked from the next plan', async ({
  page,
}) => {
  const schedule = stableSchedule()
  const { today } = schedule
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await seedLearnerSetup(user.id, {
    schedule,
    tracks: [
      { trackId: 'dsa', roadmapVariant: '8w', budgetMinutes: 120, startDate: addDays(today, -3) },
    ],
  })
  await setAiFlagOn(user.id)
  await seedItemStates(user.id, [
    {
      itemId: 'dsa:lc-0217',
      trackId: 'dsa',
      topicId: 'arrays-hashing',
      itemType: 'problem',
      introducedOn: addDays(today, -2),
      dueOn: today,
    },
  ])
  const until = addDays(today, 7)
  await seedInsertBlock(user.id, {
    key: 'ah-extra-practice',
    trackId: 'dsa',
    topicId: 'arrays-hashing',
    weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    minutes: 30,
    until,
    startLocalDay: today,
  })

  // Today's plan is built with the override block.
  await signIn(page, user, '/today')
  await expect.poll(() => planTags(user.id, today)).toContain('topic-practice')

  await page.goto('/settings')
  const section = page.getByRole('region', { name: 'Điều chỉnh lộ trình bởi AI' })
  const line = `${LINE} đến ${until.slice(8, 10)}/${until.slice(5, 7)}`
  await expect(section.getByText(line)).toBeVisible()
  await expect(section.getByText('Cấu trúc dữ liệu & Giải thuật')).toBeVisible()
  await expectNoAxeViolationsInBothThemes(page)

  await section.getByRole('button', { name: `Thu hồi: ${line}` }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Thu hồi điều chỉnh này?' })
  await expect(dialog).toContainText('Thay đổi có hiệu lực từ kế hoạch ngày mai.')
  await expectNoAxeViolationsInBothThemes(page, { disableRules: ['aria-hidden-focus'] })
  await dialog.getByRole('button', { name: 'Thu hồi' }).click()
  await expect(dialog).toBeHidden()
  await expect
    .poll(() => overrideState(user.id, 'dsa', 'ah-extra-practice'))
    .toEqual({ status: 'revoked', revoked_by: 'learner' })

  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Điều chỉnh lộ trình bởi AI' })).toHaveCount(0)

  // §5.9: today's plan is kept as it is; the block leaves from the next plan.
  await page.goto('/today')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await planTags(user.id, today)).toContain('topic-practice')
})

test('a learner without an override sees no "Điều chỉnh lộ trình bởi AI"', async ({ page }) => {
  const user = await createTestUser({ onboarded: true })
  created.push(user.id)
  await signIn(page, user, '/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Điều chỉnh lộ trình bởi AI' })).toHaveCount(0)
})
