import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminBotPage } from '@/features/admin'
import AdminBotRoute, { metadata } from './page'

const state = vi.hoisted(() => ({ page: null as unknown }))

vi.mock('@/features/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin')>()),
  getAdminBot: async () => state.page,
}))

const PAGE: AdminBotPage = {
  apiEnabled: true,
  controls: {
    enabled: false,
    dryRun: true,
    contentProposals: false,
    perRunUserCap: 10,
    capMax: 100,
  },
  token: { state: 'none' },
  runLog: { state: 'empty' },
  deferredWarning: null,
}

beforeEach(() => {
  state.page = PAGE
})

describe('/admin/bot', () => {
  it('is titled "Bot AI — Học Đều"', () => {
    expect(metadata.title).toBe('Bot AI — Học Đều')
  })

  it('renders the header, the controls and the token', async () => {
    render(await AdminBotRoute())
    expect(screen.getByRole('heading', { level: 1, name: 'Bot AI' })).toBeTruthy()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Điều khiển', 'Token truy cập', 'Nhật ký chạy'])
    expect(screen.getByRole('switch', { name: 'Bật bot' })).toBeTruthy()
    expect(screen.getByText('Chưa có token')).toBeTruthy()
    expect(screen.queryByText(/Chưa bật API bot/)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Chưa có lần chạy nào' })).toBeTruthy()
  })

  it('shows the run log, with the deferred-users warning above it (task 6.4a)', async () => {
    state.page = {
      ...PAGE,
      runLog: {
        state: 'ready',
        rows: [
          {
            key: 'run_2026-09-28',
            day: '28 tháng 9, 2026',
            startedAt: '05:30',
            kind: 'Kế hoạch',
            mode: 'dry_run',
            modeLabel: 'Chạy thử',
            status: 'running',
            statusLabel: 'Đang chạy',
            counts: {
              eligible: 13,
              pending: 10,
              applied: 0,
              dryRun: 0,
              skipped: 0,
              invalid: 0,
              error: 0,
              deferred: 3,
            },
            pr: null,
            summary: null,
          },
        ],
      },
      deferredWarning:
        '3 người dùng AI không được xử lý hôm nay — tăng giới hạn hoặc giảm số người dùng AI.',
    }
    render(await AdminBotRoute())
    const log = screen.getByRole('region', { name: 'Nhật ký chạy' })
    expect(within(log).getByText(/^3 người dùng AI không được xử lý hôm nay/)).toBeTruthy()
    expect(within(log).getByRole('region', { name: 'Các lần chạy gần nhất của bot' })).toBeTruthy()
    expect(within(log).getByText('Đang chạy')).toBeTruthy()
  })

  it('warns "Chưa bật API bot" while BOT_API_ENABLED is off', async () => {
    state.page = { ...PAGE, apiEnabled: false }
    const { container } = render(await AdminBotRoute())
    expect(screen.getByText(/^Chưa bật API bot/)).toBeTruthy()
    expect(container.querySelector('[data-slot="banner"]')?.getAttribute('data-tone')).toBe(
      'warning',
    )
    // The switch still works: the row lock is the admin's, the env lock is not.
    expect(screen.getByRole('switch', { name: 'Bật bot' })).toBeTruthy()
  })
})
