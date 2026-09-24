import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShellPage from '../app-shell/page'
import ComponentsPage from './page'

// requireDevAccess itself (open outside production, admin-only in production) is covered in
// lib/auth/dal.test.ts; here: every /dev page awaits it before rendering (§2.4, task 2.8).
const access = vi.hoisted(() => ({ allowed: true, calls: 0 }))
vi.mock('@/lib/auth/dal', () => ({
  requireDevAccess: async () => {
    access.calls += 1
    await Promise.resolve()
    if (!access.allowed) throw new Error('NEXT_HTTP_ERROR_FALLBACK;404')
  },
}))

beforeEach(() => {
  access.allowed = true
  access.calls = 0
})

describe.each([
  ['/dev/components', ComponentsPage],
  ['/dev/app-shell', AppShellPage],
])('%s', (_path, Page) => {
  it('renders once requireDevAccess() lets the visitor in', async () => {
    await expect(Page()).resolves.toBeTruthy()
    expect(access.calls).toBe(1)
  })

  it('renders nothing when requireDevAccess() refuses (a non-admin in production)', async () => {
    access.allowed = false
    await expect(Page()).rejects.toThrow('404')
  })
})
