import { beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => ({
  admin: true,
  rpc: { data: [], error: null } as { data: unknown[] | null; error: { message: string } | null },
  calls: [] as unknown[][],
}))

vi.mock('@/lib/auth/dal', () => ({
  requireAdmin: async () => {
    fake.calls.push(['requireAdmin'])
    if (!fake.admin) throw new Error('NOT_FOUND')
    return { id: 'me' }
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (name: string) => {
      fake.calls.push(['rpc', name])
      return fake.rpc
    },
  }),
}))

const { listUsers } = await import('./queries')

const dbRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@example.test`,
  display_name: `Người ${id}`,
  avatar_url: null,
  role: 'learner',
  status: 'active',
  created_at: '2026-01-10T03:00:00+00:00',
  approved_at: '2026-01-11T03:00:00+00:00',
  onboarded_at: null,
  ...overrides,
})

beforeEach(() => {
  fake.admin = true
  fake.rpc = { data: [], error: null }
  fake.calls = []
})

describe('listUsers', () => {
  it('reads admin_list_users as the admin and keeps its order, marking the admin’s own row', async () => {
    fake.rpc = {
      data: [
        dbRow('p1', { status: 'pending', approved_at: null, display_name: null }),
        dbRow('me', { role: 'admin' }),
      ],
      error: null,
    }
    await expect(listUsers()).resolves.toEqual([
      {
        id: 'p1',
        email: 'p1@example.test',
        displayName: null,
        role: 'learner',
        status: 'pending',
        createdAt: '2026-01-10T03:00:00+00:00',
        approvedAt: null,
        onboardedAt: null,
        isSelf: false,
      },
      {
        id: 'me',
        email: 'me@example.test',
        displayName: 'Người me',
        role: 'admin',
        status: 'active',
        createdAt: '2026-01-10T03:00:00+00:00',
        approvedAt: '2026-01-11T03:00:00+00:00',
        onboardedAt: null,
        isSelf: true,
      },
    ])
    expect(fake.calls).toEqual([['requireAdmin'], ['rpc', 'admin_list_users']])
  })

  it('refuses a non-admin before touching the database', async () => {
    fake.admin = false
    await expect(listUsers()).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it('throws on an RPC error, so the route’s error boundary shows "Thử lại"', async () => {
    fake.rpc = { data: null, error: { message: 'forbidden' } }
    await expect(listUsers()).rejects.toThrow()
  })
})
