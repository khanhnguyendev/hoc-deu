import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/lib/supabase/database.types'

const env = vi.hoisted(() => ({ adminEmails: [] as string[] }))
const createAdminClient = vi.hoisted(() => vi.fn())

vi.mock('@/lib/env', () => ({ serverEnv: () => ({ adminEmails: env.adminEmails }) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))

const { bootstrapAdminIfListed } = await import('./bootstrap')

type RpcResult = { data: boolean | null; error: { message: string } | null }

function fakeAdmin(result: RpcResult = { data: true, error: null }) {
  const rpc = vi.fn<(name: string, args: unknown) => Promise<RpcResult>>(async () => result)
  return { admin: { rpc } as unknown as SupabaseClient<Database>, rpc }
}

const CONFIRMED = '2026-09-24T01:00:00Z'
const user = (email: string | null | undefined, emailConfirmedAt: string | null | undefined) => ({
  id: '11111111-1111-4111-8111-111111111111',
  email,
  emailConfirmedAt,
})

beforeEach(() => {
  env.adminEmails = []
  createAdminClient.mockReset()
})

describe('bootstrapAdminIfListed (§2.5, decision 23)', () => {
  it('calls admin_bootstrap for a listed, provider-verified e-mail and returns its result', async () => {
    const { admin, rpc } = fakeAdmin({ data: true, error: null })
    const promoted = await bootstrapAdminIfListed(user('owner@example.test', CONFIRMED), {
      adminEmails: ['owner@example.test'],
      admin,
    })
    expect(promoted).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('admin_bootstrap', {
      p_user_id: '11111111-1111-4111-8111-111111111111',
    })
  })

  it('returns false when admin_bootstrap refuses (a processed profile, or an active admin exists)', async () => {
    const { admin, rpc } = fakeAdmin({ data: false, error: null })
    const promoted = await bootstrapAdminIfListed(user('owner@example.test', CONFIRMED), {
      adminEmails: ['owner@example.test'],
      admin,
    })
    expect(promoted).toBe(false)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it.each([null, undefined, ''])(
    'never calls admin_bootstrap for a listed but unconfirmed e-mail (%s)',
    async (emailConfirmedAt) => {
      const { admin, rpc } = fakeAdmin()
      const promoted = await bootstrapAdminIfListed(user('owner@example.test', emailConfirmedAt), {
        adminEmails: ['owner@example.test'],
        admin,
      })
      expect(promoted).toBe(false)
      expect(rpc).not.toHaveBeenCalled()
    },
  )

  it('never calls admin_bootstrap for an e-mail that is not listed', async () => {
    const { admin, rpc } = fakeAdmin()
    const promoted = await bootstrapAdminIfListed(user('learner@example.test', CONFIRMED), {
      adminEmails: ['owner@example.test'],
      admin,
    })
    expect(promoted).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([null, undefined, '', '   '])(
    'never calls admin_bootstrap without an e-mail (%s)',
    async (email) => {
      const { admin, rpc } = fakeAdmin()
      const promoted = await bootstrapAdminIfListed(user(email, CONFIRMED), {
        adminEmails: ['owner@example.test', ''],
        admin,
      })
      expect(promoted).toBe(false)
      expect(rpc).not.toHaveBeenCalled()
    },
  )

  it('matches the list case-insensitively, ignoring surrounding spaces', async () => {
    const first = fakeAdmin()
    await expect(
      bootstrapAdminIfListed(user('Owner@Example.TEST', CONFIRMED), {
        adminEmails: ['owner@example.test'],
        admin: first.admin,
      }),
    ).resolves.toBe(true)
    expect(first.rpc).toHaveBeenCalledTimes(1)

    const second = fakeAdmin()
    await expect(
      bootstrapAdminIfListed(user('owner@example.test', CONFIRMED), {
        adminEmails: [' OWNER@example.Test '],
        admin: second.admin,
      }),
    ).resolves.toBe(true)
    expect(second.rpc).toHaveBeenCalledTimes(1)
  })

  it('does not match a listed address as a substring or domain', async () => {
    const { admin, rpc } = fakeAdmin()
    for (const email of ['xowner@example.test', 'owner@example.test.evil', 'example.test']) {
      await expect(
        bootstrapAdminIfListed(user(email, CONFIRMED), {
          adminEmails: ['owner@example.test'],
          admin,
        }),
      ).resolves.toBe(false)
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('throws when admin_bootstrap fails, never reporting a promotion', async () => {
    const { admin } = fakeAdmin({ data: null, error: { message: 'permission denied' } })
    await expect(
      bootstrapAdminIfListed(user('owner@example.test', CONFIRMED), {
        adminEmails: ['owner@example.test'],
        admin,
      }),
    ).rejects.toThrow(/admin_bootstrap/)
  })

  it('defaults to ADMIN_EMAILS and the secret-key client', async () => {
    env.adminEmails = ['owner@example.test']
    const { admin, rpc } = fakeAdmin()
    createAdminClient.mockReturnValue(admin)
    await expect(bootstrapAdminIfListed(user('owner@example.test', CONFIRMED))).resolves.toBe(true)
    expect(createAdminClient).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('creates no secret-key client for an e-mail that is not listed', async () => {
    env.adminEmails = ['owner@example.test']
    await expect(bootstrapAdminIfListed(user('learner@example.test', CONFIRMED))).resolves.toBe(
      false,
    )
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
