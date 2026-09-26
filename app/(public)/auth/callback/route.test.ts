import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  exchange: { data: { user: { id: 'u1' } as { id: string } | null }, error: null as null | Error },
  completeSignIn: null as null | (() => Promise<string>) | (() => never),
  calls: [] as unknown[][],
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async (code: string) => {
        fake.calls.push(['exchangeCodeForSession', code])
        return fake.exchange
      },
      signOut: async (options: unknown) => {
        fake.calls.push(['signOut', options])
        return { error: null }
      },
    },
  }),
}))
vi.mock('@/lib/auth/sign-in', () => ({
  completeSignIn: async () => {
    fake.calls.push(['completeSignIn'])
    if (fake.completeSignIn) return fake.completeSignIn()
    return '/today'
  },
}))

const { GET } = await import('./route')

const request = (search: string) => new NextRequest(`https://hocdeu.example/auth/callback${search}`)
const location = (response: Response) => new URL(response.headers.get('location')!).pathname

beforeEach(() => {
  fake.exchange = { data: { user: { id: 'u1' } }, error: null }
  fake.completeSignIn = null
  fake.calls = []
})

describe('GET /auth/callback', () => {
  it('exchanges the code and goes where completeSignIn says', async () => {
    const response = await GET(request('?code=abc123'))
    expect(location(response)).toBe('/today')
    expect(fake.calls).toEqual([['exchangeCodeForSession', 'abc123'], ['completeSignIn']])
  })

  it('returns to sign-in with the error when there is no code', async () => {
    const response = await GET(request(''))
    const url = new URL(response.headers.get('location')!)
    expect(url.pathname).toBe('/sign-in')
    expect(url.searchParams.get('error')).toBe('oauth')
    expect(fake.calls).toEqual([])
  })

  it('returns to sign-in with the error when the exchange fails', async () => {
    fake.exchange = { data: { user: null }, error: new Error('bad code') }
    const response = await GET(request('?code=abc123'))
    expect(location(response)).toBe('/sign-in')
    expect(fake.calls).toEqual([['exchangeCodeForSession', 'abc123']])
  })

  it('keeps a safe next through the error redirect', async () => {
    const response = await GET(request('?next=%2Ftoday'))
    const url = new URL(response.headers.get('location')!)
    expect(url.searchParams.get('next')).toBe('/today')
  })

  it('drops an unsafe next through the error redirect', async () => {
    const response = await GET(request('?next=%2F%2Fevil.test'))
    const url = new URL(response.headers.get('location')!)
    expect(url.searchParams.has('next')).toBe(false)
  })

  it(
    'signs out locally and returns to sign-in with the error when completeSignIn fails after the ' +
      'exchange succeeded (bootstrap or profile read, M2 minor) — never a bare 500',
    async () => {
      fake.completeSignIn = () => {
        throw new Error('Could not read the profile after sign-in')
      }
      const response = await GET(request('?code=abc123&next=%2Ftoday'))
      const url = new URL(response.headers.get('location')!)
      expect(url.pathname).toBe('/sign-in')
      expect(url.searchParams.get('error')).toBe('oauth')
      expect(url.searchParams.get('next')).toBe('/today')
      expect(fake.calls).toEqual([
        ['exchangeCodeForSession', 'abc123'],
        ['completeSignIn'],
        ['signOut', { scope: 'local' }],
      ])
    },
  )
})
