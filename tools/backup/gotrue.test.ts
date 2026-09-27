import { describe, expect, it } from 'vitest'
import { checkUsersLoad, describeProblems, loopbackUrl, parseUserIds } from './gotrue'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const HEX = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const API = { url: 'http://127.0.0.1:54321', key: 'sb_secret_local-test-only' }

type Call = { url: string; headers: Record<string, string> }

/** A fetch that answers GoTrue's admin "get user" per id, recording each call. */
function fakeFetch(answer: (id: string) => Response | Error): {
  fetch: typeof fetch
  calls: Call[]
} {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) })
    const result = answer(url.slice(url.lastIndexOf('/') + 1))
    if (result instanceof Error) throw result
    return result
  }) as typeof fetch
  return { fetch: fetchImpl, calls }
}

const user = (id: string): Response =>
  Response.json({ id, email: `${id}@example.test`, aud: 'authenticated' })

describe('parseUserIds (psql -A -t output of `select id from auth.users order by id`)', () => {
  it('reads one id per line', () => {
    expect(parseUserIds(`${A}\n${B}\n`)).toEqual([A, B])
    expect(parseUserIds(`${A}\n${B}`)).toEqual([A, B])
  })

  it('reads no ids from empty output', () => {
    expect(parseUserIds('')).toEqual([])
  })

  it.each([
    ['a blank line', `${A}\n\n${B}\n`],
    ['an e-mail address', 'someone@example.test\n'],
    ['an upper-case id', `${HEX.toUpperCase()}\n`],
    ['a header', `id\n${A}\n`],
  ])('rejects %s, naming the line but never its text', (_label, text) => {
    let message = ''
    try {
      parseUserIds(text)
    } catch (error) {
      message = String(error)
    }
    expect(message).toMatch(/line \d+/)
    expect(message).not.toContain('someone')
    expect(message).not.toContain(HEX.toUpperCase())
  })

  it('rejects an id listed twice', () => {
    expect(() => parseUserIds(`${A}\n${A}\n`)).toThrow(/twice/)
  })
})

describe('loopbackUrl (the check talks to the local stack only)', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321', 'http://127.0.0.1:54321/'])(
    'accepts %s',
    (url) => {
      expect(loopbackUrl(url).pathname).toBe('/')
    },
  )

  it.each(['https://abcdefgh.supabase.co', 'http://10.0.0.5:54321', 'not a url', 'file:///x'])(
    'refuses %s',
    (url) => {
      expect(() => loopbackUrl(url)).toThrow(/loopback/)
    },
  )
})

describe('checkUsersLoad', () => {
  it('asks GoTrue’s admin API for every user by id, with the local secret key', async () => {
    const { fetch, calls } = fakeFetch(user)
    const result = await checkUsersLoad([A, B], API, fetch)
    expect(result).toEqual({ total: 2, loaded: 2, problems: {} })
    expect(calls.map((call) => call.url)).toEqual([
      `http://127.0.0.1:54321/auth/v1/admin/users/${A}`,
      `http://127.0.0.1:54321/auth/v1/admin/users/${B}`,
    ])
    for (const call of calls) {
      expect(call.headers).toMatchObject({
        apikey: API.key,
        authorization: `Bearer ${API.key}`,
      })
    }
  })

  it('counts a user GoTrue cannot load, a missing one, another id and no answer — by kind', async () => {
    const { fetch } = fakeFetch((id) => {
      if (id === A) return Response.json({ msg: 'Database error finding user' }, { status: 500 })
      if (id === B) return user(C)
      if (id === C) return new TypeError('fetch failed')
      return Response.json({ msg: 'User not found' }, { status: 404 })
    })
    const D = '44444444-4444-4444-8444-444444444444'
    const result = await checkUsersLoad([A, B, C, D], API, fetch)
    expect(result).toEqual({
      total: 4,
      loaded: 0,
      problems: { 'HTTP 500': 1, 'another id': 1, 'no answer': 1, 'HTTP 404': 1 },
    })
  })

  it('counts an answer that is not a user as unreadable', async () => {
    const { fetch } = fakeFetch(() => new Response('<html>', { status: 200 }))
    expect((await checkUsersLoad([A], API, fetch)).problems).toEqual({ 'unreadable answer': 1 })
  })

  it('refuses a non-loopback API before asking anything', async () => {
    const { fetch, calls } = fakeFetch(user)
    await expect(
      checkUsersLoad([A], { ...API, url: 'https://abcdefgh.supabase.co' }, fetch),
    ).rejects.toThrow(/loopback/)
    expect(calls).toEqual([])
  })
})

describe('describeProblems', () => {
  it('lists the kinds, sorted — never how many users, never an id', () => {
    expect(describeProblems({ 'another id': 1, 'HTTP 500': 3 })).toBe('HTTP 500, another id')
  })
})
