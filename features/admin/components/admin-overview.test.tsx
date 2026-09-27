import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildAdminOverview, MB, type OpsMetrics } from '../overview'
import { AdminOverview } from './admin-overview'

const NOW = new Date('2026-09-27T12:00:00Z')

const COUNTS = {
  users: { pending: 2, active: 5, suspended: 1, rejected: 3 },
  learnersCompleted7d: 4,
  plansCreated7d: 21,
}

const NO_METRICS: OpsMetrics = {
  'db.size_bytes': null,
  'backup.last_success_at': null,
  'restore_test.last_success_at': null,
  'cron.last_run_at': null,
}

const page = (metrics: Partial<OpsMetrics> = {}, withCoverage = false) =>
  buildAdminOverview({
    counts: COUNTS,
    metrics: { ...NO_METRICS, ...metrics },
    coverage: withCoverage
      ? [{ trackId: 'dsa', trackTitle: 'DSA', variant: '10w', weeks: [4, 5] }]
      : [],
    now: NOW,
  })

const statValue = (region: HTMLElement, label: string) =>
  within(region).getByText(label).closest('[data-slot="stat-card"]')?.textContent

describe('AdminOverview', () => {
  it('has one h1 "Quản trị" and the sections in order: warnings, counts, system, links', () => {
    render(<AdminOverview page={page()} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Quản trị' })).toBeTruthy()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Cảnh báo', 'Tài khoản và hoạt động', 'Hệ thống', 'Trang quản trị'])
  })

  it('shows the accounts by status and the last 7 days’ activity', () => {
    render(<AdminOverview page={page()} />)
    const counts = screen.getByRole('region', { name: 'Tài khoản và hoạt động' })
    expect(statValue(counts, 'Chờ duyệt')).toContain('2')
    expect(statValue(counts, 'Đang hoạt động')).toContain('5')
    expect(statValue(counts, 'Tạm khoá')).toContain('1')
    expect(statValue(counts, 'Bị từ chối')).toContain('3')
    expect(statValue(counts, 'Học viên hoàn thành ngày học')).toContain('4')
    expect(statValue(counts, 'Kế hoạch được tạo')).toContain('21')
    expect(within(counts).getAllByText('Trong 7 ngày qua')).toHaveLength(2)
  })

  it('shows "chưa có dữ liệu" for every metric before the first cron run, and no warning', () => {
    render(<AdminOverview page={page()} />)
    const system = screen.getByRole('region', { name: 'Hệ thống' })
    expect(within(system).getAllByText('chưa có dữ liệu')).toHaveLength(4)
    expect(screen.getByText('Không có cảnh báo nào.')).toBeTruthy()
  })

  it('shows the DB size and its warning, and the red coverage warning first', () => {
    const recordedAt = NOW.toISOString()
    const { container } = render(
      <AdminOverview page={page({ 'db.size_bytes': { value: 360 * MB, recordedAt } }, true)} />,
    )
    const system = screen.getByRole('region', { name: 'Hệ thống' })
    expect(statValue(system, 'Dung lượng cơ sở dữ liệu')).toContain('360 MB')
    const tones = [...container.querySelectorAll('[data-slot="banner"]')].map((banner) =>
      banner.getAttribute('data-tone'),
    )
    expect(tones).toEqual(['danger', 'warning'])
    expect(screen.getByText(/đã dùng 360 MB/)).toBeTruthy()
  })

  it('links to /admin/users and /admin/content with a one-line summary each', () => {
    render(<AdminOverview page={page({}, true)} />)
    const links = screen.getByRole('region', { name: 'Trang quản trị' })
    const users = within(links).getByRole('link', { name: /Người dùng/ })
    expect(users.getAttribute('href')).toBe('/admin/users')
    expect(users.textContent).toContain('2 tài khoản chờ duyệt')
    const content = within(links).getByRole('link', { name: /Nội dung/ })
    expect(content.getAttribute('href')).toBe('/admin/content')
    expect(content.textContent).toContain('2 tuần cần bổ sung nội dung')
  })
})
