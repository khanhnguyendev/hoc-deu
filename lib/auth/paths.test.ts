import { describe, expect, it } from 'vitest'
import type { AccountStatus } from './dal'
import { homePathFor, safeNextPath } from './paths'

describe('homePathFor', () => {
  it.each<[AccountStatus, string | null, string]>([
    ['pending', null, '/pending'],
    ['pending', '2026-09-24T00:00:00Z', '/pending'],
    ['rejected', null, '/pending'],
    ['rejected', '2026-09-24T00:00:00Z', '/pending'],
    ['suspended', null, '/pending'],
    ['suspended', '2026-09-24T00:00:00Z', '/pending'],
    ['active', null, '/onboarding'],
    ['active', '2026-09-24T00:00:00Z', '/today'],
  ])('%s with onboardedAt %s → %s', (status, onboardedAt, expected) => {
    expect(homePathFor({ status, onboardedAt })).toBe(expected)
  })
})

describe('safeNextPath (open-redirect guard)', () => {
  it.each(['/today', '/settings?tab=x', '/%09/x', '/t/dsa/lesson#top'])('keeps %j', (next) => {
    expect(safeNextPath(next)).toBe(next)
  })

  it.each([
    '//evil.test',
    'https://evil.test',
    '/\\evil',
    '/\t/evil.test',
    '/\n/evil.test',
    '/\r/evil.test',
    '/ /evil.test',
    '/\u007f/evil.test',
    'today',
    '',
    '/sign-in',
    '/sign-in?next=/today',
    '/auth/callback',
    '/auth/callback?code=x',
    '/x/../sign-in',
    '/%73ign-in',
    '/%61uth/callback?code=x',
    '/%E0%A4%A',
  ])('rejects %j', (next) => {
    expect(safeNextPath(next)).toBeNull()
  })

  it('rejects null and undefined', () => {
    expect(safeNextPath(null)).toBeNull()
    expect(safeNextPath(undefined)).toBeNull()
  })
})
