import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomePage from './page'

const state = vi.hoisted(() => ({
  user: null as null | {
    status: 'pending' | 'active' | 'rejected' | 'suspended'
    onboardedAt: string | null
  },
}))
const redirectMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/dal', () => ({ getSessionUser: async () => state.user }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

beforeEach(() => {
  state.user = null
  redirectMock.mockReset()
})

describe('/', () => {
  it('renders the landing page when signed out', async () => {
    render(await HomePage())
    expect(screen.getByRole('heading', { level: 1, name: 'Học Đều' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Đăng nhập' }).getAttribute('href')).toBe('/sign-in')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('sends a signed-in user to their home path instead', async () => {
    state.user = { status: 'active', onboardedAt: '2026-01-01T00:00:00Z' }
    redirectMock.mockImplementationOnce(() => {
      throw new Error('NEXT_REDIRECT')
    })
    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/today')
  })

  it('sends a pending user to /pending', async () => {
    state.user = { status: 'pending', onboardedAt: null }
    redirectMock.mockImplementationOnce(() => {
      throw new Error('NEXT_REDIRECT')
    })
    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/pending')
  })
})
