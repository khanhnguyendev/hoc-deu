import { describe, expect, it } from 'vitest'
import { isNavigationError } from './navigation-error'

const withDigest = (digest: unknown) => Object.assign(new Error('x'), { digest })

describe('isNavigationError (M1)', () => {
  it('knows Next’s redirect and not-found / forbidden rejections by their digest', () => {
    expect(isNavigationError(withDigest('NEXT_REDIRECT;replace;/sign-in;307;'))).toBe(true)
    expect(isNavigationError(withDigest('NEXT_HTTP_ERROR_FALLBACK;404'))).toBe(true)
    expect(isNavigationError(withDigest('NEXT_HTTP_ERROR_FALLBACK;403'))).toBe(true)
  })

  it('is false for any real failure', () => {
    expect(isNavigationError(new TypeError('Failed to fetch'))).toBe(false)
    expect(isNavigationError(withDigest('1234567890'))).toBe(false)
    expect(isNavigationError(withDigest(42))).toBe(false)
    expect(isNavigationError(null)).toBe(false)
    expect(isNavigationError('NEXT_REDIRECT')).toBe(false)
  })
})
