import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SignInPage from './page'

const state = vi.hoisted(() => ({
  user: null as null | {
    status: 'pending' | 'active' | 'rejected' | 'suspended'
    onboardedAt: string | null
  },
  authTestLogin: false,
}))
const redirectMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth/dal', () => ({ getSessionUser: async () => state.user }))
vi.mock('@/lib/env', () => ({ serverEnv: () => ({ authTestLogin: state.authTestLogin }) }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))

const props = (error?: string) => ({
  params: Promise.resolve({}),
  searchParams: Promise.resolve(error === undefined ? {} : { error }),
})

beforeEach(() => {
  state.user = null
  state.authTestLogin = false
  redirectMock.mockReset()
})

const OAUTH_ERROR = 'Đăng nhập không thành công. Bạn thử lại nhé.'
const RATE_LIMITED_ERROR = 'Bạn thao tác quá nhanh. Hãy thử lại sau ít phút.'

describe('/sign-in', () => {
  it('shows no error banner with no ?error', async () => {
    render(await SignInPage(props()))
    expect(screen.queryByText(OAUTH_ERROR)).toBeNull()
    expect(screen.queryByText(RATE_LIMITED_ERROR)).toBeNull()
  })

  it('shows the OAuth error for ?error=oauth', async () => {
    render(await SignInPage(props('oauth')))
    expect(screen.getByText(OAUTH_ERROR)).toBeTruthy()
    expect(screen.queryByText(RATE_LIMITED_ERROR)).toBeNull()
  })

  it(
    'shows vi.rateLimit.tooMany for ?error=rate_limited (the OAuth callback’s rate-limited ' +
      'redirect, §2.3, task 6.1, fix round 1 item 2)',
    async () => {
      render(await SignInPage(props('rate_limited')))
      expect(screen.getByText(RATE_LIMITED_ERROR)).toBeTruthy()
      expect(screen.queryByText(OAUTH_ERROR)).toBeNull()
    },
  )

  it('ignores an unknown ?error value', async () => {
    render(await SignInPage(props('something-else')))
    expect(screen.queryByText(OAUTH_ERROR)).toBeNull()
    expect(screen.queryByText(RATE_LIMITED_ERROR)).toBeNull()
  })

  it('sends a signed-in user to their home path instead', async () => {
    state.user = { status: 'active', onboardedAt: '2026-01-01T00:00:00Z' }
    redirectMock.mockImplementationOnce(() => {
      throw new Error('NEXT_REDIRECT')
    })
    await expect(SignInPage(props())).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectMock).toHaveBeenCalledWith('/today')
  })
})
