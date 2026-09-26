import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminOverviewPage } from '@/features/admin'
import AdminPage, { metadata } from './page'

const state = vi.hoisted(() => ({ calls: 0 }))

const PAGE: AdminOverviewPage = {
  warnings: [],
  counts: {
    users: { pending: 1, active: 2, suspended: 0, rejected: 0 },
    learnersCompleted7d: 1,
    plansCreated7d: 3,
  },
  system: [],
  links: [],
}

vi.mock('@/features/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin')>()),
  getAdminOverview: async () => {
    state.calls += 1
    return PAGE
  },
}))

beforeEach(() => {
  state.calls = 0
})

describe('/admin', () => {
  it('is titled "Quản trị — Học Đều"', () => {
    expect(metadata.title).toBe('Quản trị — Học Đều')
  })

  it('renders the admin overview from getAdminOverview', async () => {
    render(await AdminPage())
    expect(state.calls).toBe(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Quản trị' })).toBeTruthy()
    expect(screen.getByText('Không có cảnh báo nào.')).toBeTruthy()
  })
})
