import { describe, expect, it } from 'vitest'
import { vi } from './vi'

/** Every key the components and lib/events read. */
const USED = [
  'common.close',
  'common.openMenu',
  'common.loading',
  'common.retry',
  'common.cancel',
  'common.confirm',
  'common.skipToContent',
  'common.notifications',
  'nav.main',
  'nav.today',
  'nav.review',
  'nav.roadmap',
  'nav.progress',
  'nav.settings',
  'nav.admin',
  'nav.adminUsers',
  'nav.adminContent',
  'nav.account',
  'nav.signOut',
  'nav.collapse',
  'nav.expand',
  'theme.label',
  'theme.light',
  'theme.dark',
  'theme.system',
  'status.notStarted',
  'status.weak',
  'status.ok',
  'status.strong',
  'status.mastered',
  'status.skipped',
  'block.done',
  'block.partial',
  'block.skipped',
  'streak.suffix',
  'heatmap.legend',
  'heatmap.levels',
  'heatmap.weekdays',
  'heatmap.showTable',
  'heatmap.hideTable',
  'heatmap.previousMonth',
  'heatmap.nextMonth',
  'heatmap.day',
  'heatmap.minutes',
  'heatmap.noActivity',
  'heatmap.pickDay',
  'states.errorTitle',
  'states.errorBody',
  'states.notFoundTitle',
  'states.notFoundBody',
  'states.backHome',
  'states.globalErrorTitle',
  'states.globalErrorBody',
  'errors.quotaExceeded',
  'errors.saveFailed',
  'errors.notAllowed',
  'errors.invalidTransition',
  'errors.invalidTimezone',
  'forms.required',
  'forms.errorSummaryTitle',
  'forms.step',
  'auth.signInTitle',
  'auth.signInDescription',
  'auth.continueWithGoogle',
  'auth.continueWithGitHub',
  'auth.signInFailed',
  'auth.testLoginTitle',
  'auth.testLoginDescription',
  'auth.email',
  'auth.password',
  'auth.submit',
  'auth.wrongCredentials',
  'auth.testLoginDisabled',
  'account.pending.title',
  'account.pending.description',
  'account.rejected.title',
  'account.rejected.description',
  'account.suspended.title',
  'account.suspended.description',
  'onboarding.pageTitle',
  'onboarding.title',
  'onboarding.description',
  'onboarding.comingSoonTitle',
  'onboarding.comingSoonBody',
  'today.comingSoonTitle',
  'today.comingSoonBody',
  'template.days.mon-fri',
  'template.days.mon',
  'template.days.tue',
  'template.days.wed',
  'template.days.thu',
  'template.days.fri',
  'template.days.sat',
  'template.days.sun',
  'template.review',
  'template.reviewMax',
  'template.newItems',
  'template.recap',
  'template.fromWeek',
  'template.tags.exercise',
  'template.tags.shadowing',
  'template.tags.mock-interview',
  'template.tags.weekend-task',
  'template.throttle.newPerDay',
  'template.throttle.rule',
  'template.throttle.paused',
]

function lookup(path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], vi)
}

function strings(node: unknown, path = 'vi'): [string, string][] {
  if (typeof node === 'string') return [[path, node]]
  if (Array.isArray(node)) return node.flatMap((item, i) => strings(item, `${path}[${i}]`))
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, `${path}.${k}`),
  )
}

describe('lib/i18n/vi.ts', () => {
  it.each(USED)('has %s', (path) => {
    expect(lookup(path)).toBeDefined()
  })

  it('has five heatmap level labels and seven weekday labels (Monday first)', () => {
    expect(vi.heatmap.levels).toHaveLength(5)
    expect(vi.heatmap.weekdays).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])
  })

  it('stores every string non-empty, trimmed and in NFC (RF-3)', () => {
    for (const [path, value] of strings(vi)) {
      expect(value, path).not.toBe('')
      expect(value, path).toBe(value.trim())
      expect(value, path).toBe(value.normalize('NFC'))
    }
  })
})
