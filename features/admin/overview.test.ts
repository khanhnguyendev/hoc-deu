import { describe, expect, it } from 'vitest'
import type { CoverageWarning } from './content'
import {
  buildAdminOverview,
  dbSizeLevel,
  MB,
  type AdminCounts,
  type MetricReading,
  type OpsMetrics,
} from './overview'

const NOW = new Date('2026-09-27T12:00:00Z')
const HOUR = 3_600_000
const DAY = 24 * HOUR

const COUNTS: AdminCounts = {
  users: { pending: 2, active: 5, suspended: 1, rejected: 0 },
  learnersCompleted7d: 3,
  plansCreated7d: 14,
}

/** A reading recorded `checkedAgo` before NOW, of an instant `age` older than that check. */
const instant = (age: number, checkedAgo = 0): MetricReading => {
  const recordedAt = NOW.getTime() - checkedAgo
  return { value: (recordedAt - age) / 1000, recordedAt: new Date(recordedAt).toISOString() }
}
const size = (mb: number): MetricReading => ({ value: mb * MB, recordedAt: NOW.toISOString() })

const NO_METRICS: OpsMetrics = {
  'db.size_bytes': null,
  'backup.last_success_at': null,
  'restore_test.last_success_at': null,
  'cron.last_run_at': null,
}
const HEALTHY: OpsMetrics = {
  'db.size_bytes': size(40),
  'backup.last_success_at': instant(23 * HOUR),
  'restore_test.last_success_at': instant(2 * DAY),
  'cron.last_run_at': instant(0, 2 * HOUR),
}

const build = (metrics: Partial<OpsMetrics> = {}, coverage: readonly CoverageWarning[] = []) =>
  buildAdminOverview({ counts: COUNTS, metrics: { ...HEALTHY, ...metrics }, coverage, now: NOW })

describe('dbSizeLevel (§8.4 item 5, ADR-0031)', () => {
  it.each([
    [99, 'ok'],
    [100, 'incremental'],
    [349, 'incremental'],
    [350, 'warn'],
    [449, 'warn'],
    [450, 'critical'],
    [520, 'critical'],
  ] as const)('%i MB → %s', (mb, level) => {
    expect(dbSizeLevel(mb * MB)).toBe(level)
  })

  it('reads a size just under a threshold as the lower level', () => {
    expect(dbSizeLevel(100 * MB - 1)).toBe('ok')
    expect(dbSizeLevel(350 * MB - 1)).toBe('incremental')
    expect(dbSizeLevel(450 * MB - 1)).toBe('warn')
  })
})

describe('buildAdminOverview — the DB-size warning', () => {
  it.each([
    [99, null, null],
    [100, 'warning', 'Cơ sở dữ liệu đã dùng 100 MB — chuyển sao lưu sang chuỗi gia tăng.'],
    [349, 'warning', 'Cơ sở dữ liệu đã dùng 349 MB — chuyển sao lưu sang chuỗi gia tăng.'],
    [350, 'warning', 'Cơ sở dữ liệu đã dùng 350 MB — đến lúc bật nén sự kiện cũ (ADR-0031).'],
    [449, 'warning', 'Cơ sở dữ liệu đã dùng 449 MB — đến lúc bật nén sự kiện cũ (ADR-0031).'],
    [450, 'danger', 'Cơ sở dữ liệu đã dùng 450 MB, sát giới hạn 500 MB — cần nén sự kiện ngay.'],
  ] as const)('%i MB → %s', (mb, tone, message) => {
    const warning = build({ 'db.size_bytes': size(mb) }).warnings.find((w) => w.kind === 'db-size')
    if (tone === null) {
      expect(warning).toBeUndefined()
      return
    }
    expect(warning).toMatchObject({ tone, message })
    expect(warning?.action.href).toMatch(/^https:\/\/github\.com\/khanhnguyendev\/hoc-deu\//)
  })

  it('links the 100 MB warning to the backups runbook and the 350 MB one to ADR-0031', () => {
    const incremental = build({ 'db.size_bytes': size(120) }).warnings[0]!
    expect(incremental.action).toEqual({
      label: 'Xem hướng dẫn sao lưu',
      href: 'https://github.com/khanhnguyendev/hoc-deu/blob/main/docs/ops/backups.md',
    })
    const warn = build({ 'db.size_bytes': size(360) }).warnings[0]!
    expect(warn.action).toEqual({
      label: 'Xem ADR-0031',
      href: 'https://github.com/khanhnguyendev/hoc-deu/blob/main/docs/adr/0031-event-compaction-deferred.md',
    })
  })

  it('shows a fraction of a MB without rounding up past a threshold', () => {
    const card = build({ 'db.size_bytes': { value: 99.97 * MB, recordedAt: NOW.toISOString() } })
      .system[0]!
    expect(card.value).toBe('99,9 MB')
  })
})

describe('buildAdminOverview — backup and restore-test age (decision 26)', () => {
  const kinds = (metrics: Partial<OpsMetrics>) => build(metrics).warnings.map((w) => w.kind)

  it.each([
    [35, []],
    [37, ['backup']],
  ] as const)('a backup %i hours old when the cron checked → %j', (hours, expected) => {
    expect(kinds({ 'backup.last_success_at': instant(hours * HOUR) })).toEqual(expected)
  })

  it.each([
    [7, []],
    [9, ['restore-test']],
  ] as const)('a restore test %i days old when the cron checked → %j', (days, expected) => {
    expect(kinds({ 'restore_test.last_success_at': instant(days * DAY) })).toEqual(expected)
  })

  it('measures the age when the cron checked, not now: the daily read lags the 22:17 backup', () => {
    // Checked 20 hours ago, when the backup was 23 hours old: 43 hours old now, and still fine.
    expect(kinds({ 'backup.last_success_at': instant(23 * HOUR, 20 * HOUR) })).toEqual([])
  })

  it('warns when no check confirmed a backup or restore test for 36 hours (cron or GitHub down)', () => {
    expect(
      kinds({
        'backup.last_success_at': instant(HOUR, 37 * HOUR),
        'restore_test.last_success_at': instant(DAY, 37 * HOUR),
      }),
    ).toEqual(['backup', 'restore-test'])
  })

  it('names the last success in Vietnam time and links to the workflow runs', () => {
    // 2026-09-25T22:17Z is 05:17 on 26 September in Asia/Ho_Chi_Minh.
    const at = Date.parse('2026-09-25T22:17:00Z') / 1000
    const warning = build({
      'backup.last_success_at': { value: at, recordedAt: NOW.toISOString() },
    }).warnings[0]!
    expect(warning).toEqual({
      key: 'backup',
      kind: 'backup',
      tone: 'warning',
      message:
        'Không có bản sao lưu thành công nào được xác nhận trong 36 giờ qua (gần nhất: 05:17, 26 tháng 9, 2026).',
      action: {
        label: 'Xem các lần sao lưu',
        href: 'https://github.com/khanhnguyendev/hoc-deu/actions/workflows/backup.yml',
      },
    })
    const restore = build({
      'restore_test.last_success_at': instant(10 * DAY),
    }).warnings[0]!
    expect(restore.action.href).toBe(
      'https://github.com/khanhnguyendev/hoc-deu/actions/workflows/restore-test.yml',
    )
  })
})

describe('buildAdminOverview — before the first cron run', () => {
  const page = buildAdminOverview({
    counts: COUNTS,
    metrics: NO_METRICS,
    coverage: [],
    now: NOW,
  })

  it('shows "chưa có dữ liệu" for every metric', () => {
    expect(page.system.map((card) => card.id)).toEqual([
      'db-size',
      'backup',
      'restore-test',
      'cron',
    ])
    expect(page.system.map((card) => [card.label, card.value, card.hint])).toEqual([
      ['Dung lượng cơ sở dữ liệu', 'chưa có dữ liệu', 'Có sau lần chạy đầu tiên của cron bảo trì.'],
      ['Sao lưu gần nhất', 'chưa có dữ liệu', 'Có sau lần chạy đầu tiên của cron bảo trì.'],
      [
        'Kiểm tra khôi phục gần nhất',
        'chưa có dữ liệu',
        'Có sau lần chạy đầu tiên của cron bảo trì.',
      ],
      [
        'Cron bảo trì chạy gần nhất',
        'chưa có dữ liệu',
        'Có sau lần chạy đầu tiên của cron bảo trì.',
      ],
    ])
  })

  it('raises no warning for a metric that does not exist yet', () => {
    expect(page.warnings).toEqual([])
  })
})

describe('buildAdminOverview — the system cards', () => {
  it('shows the size in MB and each instant as a day and a time in Vietnam', () => {
    const page = build({
      'db.size_bytes': size(360),
      'backup.last_success_at': {
        value: Date.parse('2026-09-26T22:17:00Z') / 1000,
        recordedAt: NOW.toISOString(),
      },
    })
    expect(page.system[0]).toEqual({
      id: 'db-size',
      label: 'Dung lượng cơ sở dữ liệu',
      value: '360 MB',
      hint: 'Giới hạn của gói miễn phí: 500 MB',
    })
    expect(page.system[1]).toEqual({
      id: 'backup',
      label: 'Sao lưu gần nhất',
      value: '27 tháng 9, 2026',
      hint: 'Lúc 05:17 (giờ Việt Nam)',
    })
  })
})

describe('buildAdminOverview — the coverage warning (decision 25) and the order', () => {
  it('shows one red warning per track variant with red weeks, linking to /admin/content', () => {
    const page = build({}, [
      {
        trackId: 'dsa',
        trackTitle: 'Cấu trúc dữ liệu & Giải thuật',
        variant: '10w',
        weeks: [4, 5],
      },
    ])
    expect(page.warnings).toEqual([
      {
        key: 'coverage:dsa:10w',
        kind: 'coverage',
        tone: 'danger',
        message:
          'Cấu trúc dữ liệu & Giải thuật (10 tuần): tuần 4, 5 thiếu bài học hoặc ghi chú, mà học viên sẽ học tới trong 14 ngày.',
        action: { label: 'Xem độ phủ nội dung', href: '/admin/content' },
      },
    ])
  })

  it('puts the red and critical warnings before the others', () => {
    const page = build(
      {
        'db.size_bytes': size(360),
        'backup.last_success_at': instant(40 * HOUR),
      },
      [{ trackId: 'dsa', trackTitle: 'DSA', variant: '8w', weeks: [4] }],
    )
    expect(page.warnings.map((w) => [w.kind, w.tone])).toEqual([
      ['coverage', 'danger'],
      ['db-size', 'warning'],
      ['backup', 'warning'],
    ])
    const critical = build({
      'db.size_bytes': size(470),
      'backup.last_success_at': instant(40 * HOUR),
    })
    expect(critical.warnings.map((w) => w.tone)).toEqual(['danger', 'warning'])
  })
})

describe('buildAdminOverview — counts and links', () => {
  it('passes the counts through and describes the two admin pages', () => {
    const page = buildAdminOverview({
      counts: COUNTS,
      metrics: HEALTHY,
      coverage: [
        { trackId: 'dsa', trackTitle: 'DSA', variant: '10w', weeks: [4, 5] },
        { trackId: 'dsa', trackTitle: 'DSA', variant: '8w', weeks: [4] },
      ],
      now: NOW,
    })
    expect(page.counts).toEqual(COUNTS)
    expect(page.links).toEqual([
      { href: '/admin/users', title: 'Người dùng', meta: '2 tài khoản chờ duyệt' },
      { href: '/admin/content', title: 'Nội dung', meta: '3 tuần cần bổ sung nội dung' },
    ])
    expect(build().links[1]!.meta).toBe('Không có tuần nào thiếu nội dung')
  })
})

describe('buildAdminOverview — the cron ran, but no backup or restore test ever succeeded', () => {
  const noRuns = (cron: MetricReading) =>
    buildAdminOverview({
      counts: COUNTS,
      metrics: { ...NO_METRICS, 'db.size_bytes': size(40), 'cron.last_run_at': cron },
      coverage: [],
      now: NOW,
    })

  it('warns "Chưa có lần sao lưu thành công" (and the restore-test equivalent), never silent', () => {
    const page = noRuns(instant(0, 2 * HOUR))
    expect(page.warnings.map((w) => [w.kind, w.tone, w.message, w.action.href])).toEqual([
      [
        'backup',
        'warning',
        'Chưa có lần sao lưu thành công nào, dù cron bảo trì đã chạy.',
        'https://github.com/khanhnguyendev/hoc-deu/actions/workflows/backup.yml',
      ],
      [
        'restore-test',
        'warning',
        'Chưa có lần kiểm tra khôi phục thành công nào, dù cron bảo trì đã chạy.',
        'https://github.com/khanhnguyendev/hoc-deu/actions/workflows/restore-test.yml',
      ],
    ])
  })

  it('does not tell the admin to wait for the first cron run any more', () => {
    const cards = noRuns(instant(0, 2 * HOUR)).system
    expect(cards.filter((card) => card.id === 'backup' || card.id === 'restore-test')).toEqual([
      {
        id: 'backup',
        label: 'Sao lưu gần nhất',
        value: 'chưa có dữ liệu',
        hint: 'Cron bảo trì đã chạy nhưng chưa thấy lần chạy thành công nào.',
      },
      {
        id: 'restore-test',
        label: 'Kiểm tra khôi phục gần nhất',
        value: 'chưa có dữ liệu',
        hint: 'Cron bảo trì đã chạy nhưng chưa thấy lần chạy thành công nào.',
      },
    ])
  })

  it('also warns when that cron run is more than 36 hours old', () => {
    expect(noRuns(instant(0, 37 * HOUR)).warnings.map((w) => w.kind)).toEqual([
      'backup',
      'restore-test',
    ])
  })

  it('a stale cron with old readings warns through the readings’ age', () => {
    const page = build({
      'backup.last_success_at': instant(HOUR, 37 * HOUR),
      'restore_test.last_success_at': instant(DAY, 37 * HOUR),
      'cron.last_run_at': instant(0, 37 * HOUR),
    })
    expect(page.warnings.map((w) => w.message)).toEqual([
      expect.stringContaining('Không có bản sao lưu thành công nào được xác nhận trong 36 giờ qua'),
      expect.stringContaining('Không có lần kiểm tra khôi phục thành công nào được xác nhận'),
    ])
  })
})

describe('buildAdminOverview — a DB size not measured for 36 hours', () => {
  const sizeCard = (checkedAgo: number) =>
    build({
      'db.size_bytes': {
        value: 40 * MB,
        recordedAt: new Date(NOW.getTime() - checkedAgo).toISOString(),
      },
    }).system[0]!

  it('says so in the card’s hint, with when it was measured', () => {
    // 37 hours before 2026-09-27T12:00Z is 2026-09-25T23:00Z: 06:00 on 26 September in Vietnam.
    expect(sizeCard(37 * HOUR)).toEqual({
      id: 'db-size',
      label: 'Dung lượng cơ sở dữ liệu',
      value: '40 MB',
      hint: 'Không có số liệu mới trong 36 giờ qua (đo lúc 06:00, 26 tháng 9, 2026).',
    })
  })

  it('keeps the plan limit as the hint while the size is fresh', () => {
    expect(sizeCard(35 * HOUR).hint).toBe('Giới hạn của gói miễn phí: 500 MB')
  })
})
