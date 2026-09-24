import { describe, expect, it } from 'vitest'
import type { AccountStatus } from './dal'
import { homePathFor, safeNextPath, signInErrorPath } from './paths'

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

describe('signInErrorPath', () => {
  it('flags the failed sign-in', () => {
    expect(signInErrorPath(null)).toBe('/sign-in?error=oauth')
    expect(signInErrorPath(undefined)).toBe('/sign-in?error=oauth')
  })

  it('keeps a safe next, encoded', () => {
    expect(signInErrorPath('/today?block=a&b=1')).toBe(
      '/sign-in?error=oauth&next=%2Ftoday%3Fblock%3Da%26b%3D1',
    )
  })

  it.each(['//evil.test', 'https://evil.test', '/sign-in', ''])(
    'drops an unsafe next %j',
    (next) => {
      expect(signInErrorPath(next)).toBe('/sign-in?error=oauth')
    },
  )
})
