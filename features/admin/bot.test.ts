import { describe, expect, it } from 'vitest'
import { adminBotSettingsSchema, buildAdminBotPage, CAP_MAX, type AdminBotSettings } from './bot'

const NOW = new Date('2026-09-28T03:00:00Z')

const SETTINGS: AdminBotSettings = {
  enabled: false,
  dryRun: true,
  contentProposals: false,
  perRunUserCap: 10,
  limits: {},
  hasToken: false,
  prevValidUntil: null,
  rotatedAt: null,
  updatedAt: '2026-09-27T00:00:00+00:00',
}

describe('adminBotSettingsSchema (admin_bot_settings(), 6.2b)', () => {
  it('parses the function’s JSON (never a hash)', () => {
    const json = {
      ...SETTINGS,
      hasToken: true,
      rotatedAt: '2026-09-28T02:30:00.123456+00:00',
      prevValidUntil: '2026-09-29T02:30:00.123456+00:00',
    }
    expect(adminBotSettingsSchema.parse(json)).toEqual(json)
  })

  it('refuses a malformed answer', () => {
    expect(adminBotSettingsSchema.safeParse({ ...SETTINGS, perRunUserCap: '10' }).success).toBe(
      false,
    )
    expect(adminBotSettingsSchema.safeParse(null).success).toBe(false)
  })
})

describe('buildAdminBotPage', () => {
  it('shows the seeded row: every switch off but dry-run, cap 10 of 100, no token', () => {
    expect(buildAdminBotPage({ settings: SETTINGS, apiEnabled: false, now: NOW })).toEqual({
      apiEnabled: false,
      controls: {
        enabled: false,
        dryRun: true,
        contentProposals: false,
        perRunUserCap: 10,
        capMax: CAP_MAX,
      },
      token: { state: 'none' },
    })
    expect(CAP_MAX).toBe(100)
  })

  it('shows when the current token was made, in Asia/Ho_Chi_Minh', () => {
    const page = buildAdminBotPage({
      settings: { ...SETTINGS, hasToken: true, rotatedAt: '2026-09-28T02:30:00Z' },
      apiEnabled: true,
      now: NOW,
    })
    expect(page.apiEnabled).toBe(true)
    expect(page.token).toEqual({
      state: 'set',
      createdAt: '09:30, 28 tháng 9, 2026',
      previousValidUntil: null,
    })
  })

  it('shows the overlap while the previous token still works, and not after', () => {
    const settings = {
      ...SETTINGS,
      hasToken: true,
      rotatedAt: '2026-09-28T02:30:00Z',
      prevValidUntil: '2026-09-29T02:30:00Z',
    }
    expect(buildAdminBotPage({ settings, apiEnabled: true, now: NOW }).token).toEqual({
      state: 'set',
      createdAt: '09:30, 28 tháng 9, 2026',
      previousValidUntil: '09:30, 29 tháng 9, 2026',
    })
    const later = new Date('2026-09-29T02:30:00Z')
    expect(buildAdminBotPage({ settings, apiEnabled: true, now: later }).token).toEqual({
      state: 'set',
      createdAt: '09:30, 28 tháng 9, 2026',
      previousValidUntil: null,
    })
  })

  it('shows a token without a creation time as "set" without a time', () => {
    const page = buildAdminBotPage({
      settings: { ...SETTINGS, hasToken: true },
      apiEnabled: true,
      now: NOW,
    })
    expect(page.token).toEqual({ state: 'set', createdAt: null, previousValidUntil: null })
  })
})
