import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HARD_LIMITS } from './limits'

const fake = vi.hoisted(() => ({
  result: { data: null, error: null } as { data: unknown; error: { message: string } | null },
  calls: [] as unknown[][],
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: (columns: string) => ({
        single: async () => {
          fake.calls.push(['from', table, columns])
          return fake.result
        },
      }),
    }),
  }),
}))

const { readBotSettings } = await import('./settings')

const ROW = {
  enabled: true,
  dry_run: false,
  content_proposals: true,
  per_run_user_cap: 25,
  limits: { customItemsPerDay: 3, customItemsActive: 999 },
  token_hash: 'a'.repeat(64),
  token_prev_hash: 'b'.repeat(64),
  token_prev_valid_until: '2026-09-29T10:00:00+00:00',
}

beforeEach(() => {
  fake.result = { data: ROW, error: null }
  fake.calls = []
})

describe('readBotSettings (the secret-key client: bot_settings has no grant to authenticated)', () => {
  it('reads the single row and maps it, clamping the stored limits', async () => {
    await expect(readBotSettings()).resolves.toEqual({
      settings: {
        enabled: true,
        dryRun: false,
        contentProposals: true,
        perRunUserCap: 25,
        limits: { ...HARD_LIMITS, customItemsPerDay: 3 },
      },
      token: {
        hash: 'a'.repeat(64),
        prevHash: 'b'.repeat(64),
        prevValidUntil: new Date('2026-09-29T10:00:00Z'),
      },
    })
    expect(fake.calls).toEqual([
      [
        'from',
        'bot_settings',
        'enabled, dry_run, content_proposals, per_run_user_cap, limits, token_hash, token_prev_hash, token_prev_valid_until',
      ],
    ])
  })

  it('reads no token as nulls', async () => {
    fake.result = {
      data: { ...ROW, token_hash: null, token_prev_hash: null, token_prev_valid_until: null },
      error: null,
    }
    expect((await readBotSettings()).token).toEqual({
      hash: null,
      prevHash: null,
      prevValidUntil: null,
    })
  })

  it('throws on a read error (never "off" or "no token" for a failure)', async () => {
    fake.result = { data: null, error: { message: 'boom' } }
    await expect(readBotSettings()).rejects.toThrow('Could not read the bot settings')
  })
})
