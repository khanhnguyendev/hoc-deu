import { describe, expect, it } from 'vitest'
import type { AdminBotRun } from './bot'
import type { CoverageWarning } from './content'
import {
  buildAdminOverview,
  dbSizeLevel,
  MB,
  type AdminCounts,
  type MetricReading,
  type OpsMetrics,
  type RateLimitOverview,
} from './overview'

/** Upstash configured, no fail-open events: neither rate-limit warning or card fires by default. */
const RATE_LIMIT_OK: RateLimitOverview = { mode: 'upstash', failOpen7d: 0 }

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
  buildAdminOverview({
    counts: COUNTS,
    metrics: { ...HEALTHY, ...metrics },
    coverage,
    rateLimit: RATE_LIMIT_OK,
    vercelEnv: 'production',
    now: NOW,
  })

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

  it.each([
    [35, []],
    [37, ['cron']],
  ] as const)('the maintenance cron itself unrun for %i hours → %j (I2)', (hours, expected) => {
    expect(kinds({ 'cron.last_run_at': instant(0, hours * HOUR) })).toEqual(expected)
  })

  it('names the cron’s last run and links to ADR-0034 (I2)', () => {
    // 2026-09-25T23:00Z is 06:00 on 26 September in Asia/Ho_Chi_Minh (37 hours before NOW).
    const warning = build({ 'cron.last_run_at': instant(0, 37 * HOUR) }).warnings[0]!
    expect(warning).toEqual({
      key: 'cron',
      kind: 'cron',
      tone: 'warning',
      message: 'Cron bảo trì chưa chạy lại kể từ 06:00, 26 tháng 9, 2026.',
      action: {
        label: 'Xem ADR-0034',
        href: 'https://github.com/khanhnguyendev/hoc-deu/blob/main/docs/adr/0034-maintenance-cron.md',
      },
    })
  })

  it('a stale cron suppresses the misleading backup/restore-test staleness warnings, and warns about itself instead (I2)', () => {
    // The backup and restore-test readings were themselves fresh the last time the cron checked
    // (1 hour and 1 day old respectively) — only the check itself (37 hours ago) has gone stale.
    // Read as "backup" / "restore-test" stale, this would blame the wrong thing: the cron, not
    // either workflow, has stopped.
    const page = build({
      'backup.last_success_at': instant(HOUR, 37 * HOUR),
      'restore_test.last_success_at': instant(DAY, 37 * HOUR),
      'cron.last_run_at': instant(0, 37 * HOUR),
    })
    expect(page.warnings.map((w) => w.kind)).toEqual(['cron'])
  })

  it('still warns about a genuinely stale backup even while the cron itself is fresh', () => {
    // The cron ran recently, but the last confirmed backup was already 40 hours old when it did:
    // a real backup problem, not the cron's.
    expect(kinds({ 'backup.last_success_at': instant(40 * HOUR) })).toEqual(['backup'])
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
    rateLimit: RATE_LIMIT_OK,
    vercelEnv: 'production',
    now: NOW,
  })

  it('shows "chưa có dữ liệu" for every metric', () => {
    expect(page.system.map((card) => card.id)).toEqual([
      'db-size',
      'backup',
      'restore-test',
      'cron',
      'rate-limit-fail-open',
      'bot',
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
      [
        'Giới hạn tần suất mở khi lỗi',
        '0 lần',
        'Trong 7 ngày qua — Upstash lỗi hoặc quá thời gian, bộ nhớ quyết định thay.',
      ],
      ['Bot AI', 'Chưa chạy', 'Bot chưa chạy lần nào.'],
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
      rateLimit: RATE_LIMIT_OK,
      vercelEnv: 'production',
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
      rateLimit: RATE_LIMIT_OK,
      vercelEnv: 'production',
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

  it('also warns about the cron itself when that run is more than 36 hours old (I2)', () => {
    expect(noRuns(instant(0, 37 * HOUR)).warnings.map((w) => w.kind)).toEqual([
      'cron',
      'backup',
      'restore-test',
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

describe('buildAdminOverview — rate limits (§8.4 item 5, decision 22)', () => {
  it('shows the memory warning only in production, and only while in memory mode', () => {
    const memory: RateLimitOverview = { mode: 'memory', failOpen7d: 0 }
    const upstash: RateLimitOverview = { mode: 'upstash', failOpen7d: 0 }

    const inProduction = buildAdminOverview({
      counts: COUNTS,
      metrics: HEALTHY,
      coverage: [],
      rateLimit: memory,
      vercelEnv: 'production',
      now: NOW,
    })
    expect(inProduction.warnings.map((w) => w.kind)).toContain('rate-limit-memory')
    expect(inProduction.warnings.find((w) => w.kind === 'rate-limit-memory')).toMatchObject({
      tone: 'warning',
      message: 'Giới hạn tần suất đang chạy trong bộ nhớ (chưa cấu hình Upstash)',
    })

    const inPreview = buildAdminOverview({
      counts: COUNTS,
      metrics: HEALTHY,
      coverage: [],
      rateLimit: memory,
      vercelEnv: 'preview',
      now: NOW,
    })
    expect(inPreview.warnings.map((w) => w.kind)).not.toContain('rate-limit-memory')

    const upstashInProduction = buildAdminOverview({
      counts: COUNTS,
      metrics: HEALTHY,
      coverage: [],
      rateLimit: upstash,
      vercelEnv: 'production',
      now: NOW,
    })
    expect(upstashInProduction.warnings.map((w) => w.kind)).not.toContain('rate-limit-memory')
  })

  it('always shows the fail-open count as a system card, and warns only above 0', () => {
    const zero = build()
    expect(zero.system.find((c) => c.id === 'rate-limit-fail-open')?.value).toBe('0 lần')
    expect(zero.warnings.map((w) => w.kind)).not.toContain('rate-limit-fail-open')

    const some = buildAdminOverview({
      counts: COUNTS,
      metrics: HEALTHY,
      coverage: [],
      rateLimit: { mode: 'upstash', failOpen7d: 3 },
      vercelEnv: 'production',
      now: NOW,
    })
    expect(some.system.find((c) => c.id === 'rate-limit-fail-open')?.value).toBe('3 lần')
    const warning = some.warnings.find((w) => w.kind === 'rate-limit-fail-open')
    expect(warning).toMatchObject({
      tone: 'warning',
      message: 'Giới hạn tần suất đã mở khi lỗi 3 lần trong 7 ngày qua.',
    })
  })
})

describe('buildAdminOverview — the bot (task 6.4a, §2.4 "deferred AI users and bot health")', () => {
  // 12:00 UTC on 27 September = 19:00 in Viet Nam: today's plan run is run_2026-09-27.
  const run = (patch: Partial<AdminBotRun> = {}): AdminBotRun => ({
    runKey: 'run_2026-09-27',
    kind: 'plan',
    mode: 'dry_run',
    status: 'completed',
    failureReason: null,
    usersEligible: 12,
    usersDeferred: 2,
    outcomes: { dry_run: 10 },
    contentPrUrl: null,
    summary: null,
    startedAt: '2026-09-26T22:30:00Z',
    finishedAt: '2026-09-26T23:00:00Z',
    ...patch,
  })
  const withRuns = (botRuns: readonly AdminBotRun[] | null) =>
    buildAdminOverview({
      counts: COUNTS,
      metrics: HEALTHY,
      coverage: [],
      rateLimit: RATE_LIMIT_OK,
      vercelEnv: 'production',
      botRuns,
      now: NOW,
    })
  const botCard = (botRuns: readonly AdminBotRun[] | null) =>
    withRuns(botRuns).system.find((card) => card.id === 'bot')

  it('warns while today’s plan run has deferred users, with a link to /admin/bot', () => {
    const warning = withRuns([run()]).warnings.find((w) => w.kind === 'bot-deferred')
    expect(warning).toEqual({
      key: 'bot-deferred',
      kind: 'bot-deferred',
      tone: 'warning',
      message:
        '2 người dùng AI không được xử lý hôm nay — tăng giới hạn hoặc giảm số người dùng AI.',
      action: { label: 'Mở Bot AI', href: '/admin/bot' },
    })
    expect(withRuns([run({ usersDeferred: 0 })]).warnings).toEqual([])
    expect(withRuns([run({ runKey: 'run_2026-09-26' })]).warnings).toEqual([])
  })

  it('the Bot card shows the latest run’s status and date, or that it never ran', () => {
    expect(
      botCard([
        run({ runKey: 'run_2026-09-27_publish-1', kind: 'publish', status: 'running' }),
        run(),
      ]),
    ).toEqual({
      id: 'bot',
      label: 'Bot AI',
      value: 'Đang chạy',
      hint: 'Lần chạy gần nhất: 27 tháng 9, 2026',
    })
    expect(botCard([run({ status: 'failed', failureReason: 'timeout' })])?.value).toBe(
      'Thất bại (quá 2 giờ)',
    )
    expect(botCard([])).toEqual({
      id: 'bot',
      label: 'Bot AI',
      value: 'Chưa chạy',
      hint: 'Bot chưa chạy lần nào.',
    })
    // The run log could not be read: unknown, never "Chưa chạy", and no warning.
    expect(botCard(null)).toEqual({
      id: 'bot',
      label: 'Bot AI',
      value: 'Không đọc được',
      hint: 'Không đọc được nhật ký chạy của bot. Bạn tải lại trang để thử lại nhé.',
    })
    expect(withRuns(null).warnings).toEqual([])
  })
})
