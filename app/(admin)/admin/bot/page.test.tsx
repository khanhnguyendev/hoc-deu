import { render, screen } from '@testing-library/react'
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
    ).toEqual(['Điều khiển', 'Token truy cập'])
    expect(screen.getByRole('switch', { name: 'Bật bot' })).toBeTruthy()
    expect(screen.getByText('Chưa có token')).toBeTruthy()
    expect(screen.queryByText(/Chưa bật API bot/)).toBeNull()
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
