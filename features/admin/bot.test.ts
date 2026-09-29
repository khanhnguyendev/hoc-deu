import { describe, expect, it } from 'vitest'
import {
  adminBotRunsSchema,
  adminBotSettingsSchema,
  botRunLog,
  buildAdminBotPage,
  CAP_MAX,
  deferredWarning,
  type AdminBotRun,
  type AdminBotSettings,
} from './bot'

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
    expect(
      buildAdminBotPage({ settings: SETTINGS, apiEnabled: false, runs: [], now: NOW }),
    ).toEqual({
      apiEnabled: false,
      controls: {
        enabled: false,
        dryRun: true,
        contentProposals: false,
        perRunUserCap: 10,
        capMax: CAP_MAX,
      },
      token: { state: 'none' },
      runLog: { state: 'empty' },
      deferredWarning: null,
    })
    expect(CAP_MAX).toBe(100)
  })

  it('shows when the current token was made, in Asia/Ho_Chi_Minh', () => {
    const page = buildAdminBotPage({
      settings: { ...SETTINGS, hasToken: true, rotatedAt: '2026-09-28T02:30:00Z' },
      apiEnabled: true,
      runs: [],
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
    expect(buildAdminBotPage({ settings, apiEnabled: true, runs: [], now: NOW }).token).toEqual({
      state: 'set',
      createdAt: '09:30, 28 tháng 9, 2026',
      previousValidUntil: '09:30, 29 tháng 9, 2026',
    })
    const later = new Date('2026-09-29T02:30:00Z')
    expect(buildAdminBotPage({ settings, apiEnabled: true, runs: [], now: later }).token).toEqual({
      state: 'set',
      createdAt: '09:30, 28 tháng 9, 2026',
      previousValidUntil: null,
    })
  })

  it('shows a token without a creation time as "set" without a time', () => {
    const page = buildAdminBotPage({
      settings: { ...SETTINGS, hasToken: true },
      apiEnabled: true,
      runs: [],
      now: NOW,
    })
    expect(page.token).toEqual({ state: 'set', createdAt: null, previousValidUntil: null })
  })
})

// ---------------------------------------------------------------------------------------------
// The run log and the deferred-users warning (task 6.4a, §2.4, §6.2)
// ---------------------------------------------------------------------------------------------

const RUN: AdminBotRun = {
  runKey: 'run_2026-09-28',
  kind: 'plan',
  mode: 'dry_run',
  status: 'completed',
  failureReason: null,
  usersEligible: 14,
  usersDeferred: 3,
  outcomes: {
    pending: 1,
    applied: 2,
    dry_run: 4,
    skipped_plan_in_use: 1,
    skipped_gate_closed: 2,
    skipped_unseen: 1,
    invalid: 1,
    error: 1,
  },
  contentPrUrl: 'https://github.com/khanhnguyendev/hoc-deu/pull/41',
  summary: '10 users: 7 plans; PR #41',
  startedAt: '2026-09-27T22:30:00.123+00:00',
  finishedAt: '2026-09-27T23:10:00+00:00',
}
const PUBLISH: AdminBotRun = {
  ...RUN,
  runKey: 'run_2026-09-28_publish-2',
  kind: 'publish',
  mode: 'live',
  status: 'failed',
  failureReason: 'timeout',
  usersEligible: 0,
  usersDeferred: 0,
  outcomes: {},
  contentPrUrl: null,
  summary: null,
  startedAt: '2026-09-28T02:00:00Z',
  finishedAt: null,
}

describe('adminBotRunsSchema (admin_bot_runs(), 6.2b)', () => {
  it('parses the function’s JSON: counts, no user id or ref', () => {
    expect(adminBotRunsSchema.parse([RUN, PUBLISH])).toEqual([RUN, PUBLISH])
    expect(adminBotRunsSchema.safeParse([{ ...RUN, usersEligible: -1 }]).success).toBe(false)
    expect(adminBotRunsSchema.safeParse([{ ...RUN, status: 'queued' }]).success).toBe(false)
  })
})

describe('botRunLog', () => {
  it('turns each run into a row: date, time, kind, mode, status and reason, counts, PR', () => {
    const log = botRunLog([RUN, PUBLISH])
    expect(log).toEqual({
      state: 'ready',
      rows: [
        {
          key: 'run_2026-09-28',
          day: '28 tháng 9, 2026',
          startedAt: '05:30',
          kind: 'Kế hoạch',
          mode: 'dry_run',
          modeLabel: 'Chạy thử',
          status: 'completed',
          statusLabel: 'Hoàn tất',
          counts: {
            eligible: 14,
            pending: 1,
            applied: 2,
            dryRun: 4,
            skipped: 4,
            invalid: 1,
            error: 1,
            deferred: 3,
          },
          pr: { href: 'https://github.com/khanhnguyendev/hoc-deu/pull/41', label: 'PR #41' },
          summary: '10 users: 7 plans; PR #41',
        },
        {
          key: 'run_2026-09-28_publish-2',
          day: '28 tháng 9, 2026',
          startedAt: '09:00',
          kind: 'Xuất bản 2',
          mode: 'live',
          modeLabel: 'Chạy thật',
          status: 'failed',
          statusLabel: 'Thất bại (quá 2 giờ)',
          counts: {
            eligible: 0,
            pending: 0,
            applied: 0,
            dryRun: 0,
            skipped: 0,
            invalid: 0,
            error: 0,
            deferred: 0,
          },
          pr: null,
          summary: null,
        },
      ],
    })
  })

  it('names a failure the bot reported, and shows an unknown reason as its code', () => {
    const [reported, unknown] = (
      botRunLog([
        { ...PUBLISH, failureReason: 'reported' },
        { ...PUBLISH, failureReason: 'db_down' },
      ]) as { rows: { statusLabel: string }[] }
    ).rows
    expect(reported?.statusLabel).toBe('Thất bại (bot báo lỗi)')
    expect(unknown?.statusLabel).toBe('Thất bại (db_down)')
  })

  it('is empty without runs, and an error when the runs could not be read', () => {
    expect(botRunLog([])).toEqual({ state: 'empty' })
    expect(botRunLog(null)).toEqual({ state: 'error' })
  })
})

describe('deferredWarning (§6.2: today’s plan run left users out)', () => {
  const MORNING = new Date('2026-09-27T23:00:00Z') // 06:00 on 28 September in Viet Nam

  it('warns with the count while today’s plan run has deferred users', () => {
    expect(deferredWarning([PUBLISH, RUN], MORNING)).toBe(
      '3 người dùng AI không được xử lý hôm nay — tăng giới hạn hoặc giảm số người dùng AI.',
    )
  })

  it('is silent for yesterday’s run, a run without deferred users, publish runs and no data', () => {
    expect(deferredWarning([RUN], new Date('2026-09-28T17:00:00Z'))).toBeNull()
    expect(deferredWarning([{ ...RUN, usersDeferred: 0 }], MORNING)).toBeNull()
    expect(
      deferredWarning(
        [{ ...PUBLISH, runKey: 'run_2026-09-28_publish-1', usersDeferred: 3 }],
        MORNING,
      ),
    ).toBeNull()
    expect(deferredWarning([], MORNING)).toBeNull()
    expect(deferredWarning(null, MORNING)).toBeNull()
  })
})

describe('buildAdminBotPage — the run log', () => {
  it('carries the run log and the warning', () => {
    const page = buildAdminBotPage({
      settings: SETTINGS,
      apiEnabled: true,
      runs: [RUN],
      now: new Date('2026-09-27T23:00:00Z'),
    })
    expect(page.runLog.state).toBe('ready')
    expect(page.deferredWarning).toMatch(/^3 người dùng AI/)
  })

  it('a failed runs read keeps the controls and shows the log’s error state', () => {
    const page = buildAdminBotPage({ settings: SETTINGS, apiEnabled: true, runs: null, now: NOW })
    expect(page.runLog).toEqual({ state: 'error' })
    expect(page.deferredWarning).toBeNull()
    expect(page.controls.perRunUserCap).toBe(10)
  })
})
