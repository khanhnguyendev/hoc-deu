import { afterEach, describe, expect, it, vi } from 'vitest'
import ComponentsPage from './page'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('/dev/components', () => {
  it('is not served in production until it becomes admin-only (task 2.8)', () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(() => ComponentsPage()).toThrow()
  })

  it('renders in development and previews', () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect(ComponentsPage()).toBeTruthy()
  })
})
