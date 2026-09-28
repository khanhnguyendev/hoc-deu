import { beforeEach, describe, expect, it, vi } from 'vitest'
import { vi as copy } from '@/lib/i18n/vi'
import { __resetMemoryWindows } from '@/lib/rate-limit'

const ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'

const fake = vi.hoisted(() => ({
  admin: true,
  adminId: 'admin-id',
  rpc: { data: null, error: null } as {
    data: unknown
    error: { message: string; code?: string } | null
  },
  calls: [] as unknown[][],
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => fake.calls.push(['revalidatePath', path]),
}))
vi.mock('@/lib/auth/dal', () => ({
  requireAdmin: async () => {
    fake.calls.push(['requireAdmin'])
    if (!fake.admin) throw new Error('NOT_FOUND')
    return { id: fake.adminId }
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (name: string, args: unknown) => {
      fake.calls.push(['rpc', name, args])
      return fake.rpc
    },
  }),
}))

const TOKEN = `hdb_${'T'.repeat(43)}`
const HASH = 'f'.repeat(64)
vi.mock('@/lib/bot/token', () => ({
  newBotToken: () => {
    fake.calls.push(['newBotToken'])
    return { token: TOKEN, hash: HASH }
  },
}))

/** The deployed catalog: a draft problem, a problem with a draft note, an active lesson. */
vi.mock('@/lib/content/catalog', () => ({
  getCatalog: () => ({
    items: {
      'dsa:lc-0146': {
        id: 'dsa:lc-0146',
        type: 'problem',
        status: 'draft',
        content: { note: null },
      },
      'dsa:lc-0206': {
        id: 'dsa:lc-0206',
        type: 'problem',
        status: 'active',
        content: { note: { status: 'draft' } },
      },
      'dsa:lc-0001': {
        id: 'dsa:lc-0001',
        type: 'problem',
        status: 'active',
        content: { note: { status: 'active' } },
      },
      'dsa:lesson-trees': { id: 'dsa:lesson-trees', type: 'lesson', status: 'active', content: {} },
    },
  }),
}))

const {
  cancelPublish,
  requestPublish,
  rotateBotToken,
  setAiFlag,
  setUserRole,
  setUserStatus,
  updateBotSettings,
} = await import('./actions')

beforeEach(() => {
  fake.admin = true
  fake.adminId = 'admin-id'
  fake.rpc = { data: null, error: null }
  fake.calls = []
  // The adminAction in-memory window is module state, shared across every test in this file
  // (fix round 1, item 4): start each test with a clean slate.
  __resetMemoryWindows()
})

describe('setUserStatus', () => {
  it.each([
    ['pending', 'active', 'Đã duyệt tài khoản.'],
    ['pending', 'rejected', 'Đã từ chối tài khoản.'],
    ['active', 'suspended', 'Đã tạm khoá tài khoản.'],
    ['suspended', 'active', 'Đã kích hoạt lại tài khoản.'],
    ['rejected', 'active', 'Đã kích hoạt lại tài khoản.'],
  ] as const)('%s → %s: "%s", then the list re-renders', async (from, to, message) => {
    fake.rpc = { data: { from, to }, error: null }
    await expect(setUserStatus(ID, to, from)).resolves.toEqual({ ok: true, message })
    expect(fake.calls).toEqual([
      ['requireAdmin'],
      ['rpc', 'admin_set_status', { p_user_id: ID, p_status: to, p_expected_from: from }],
      ['revalidatePath', '/admin/users'],
    ])
  })

  it('refuses a non-admin before touching the database', async () => {
    fake.admin = false
    await expect(setUserStatus(ID, 'active', 'pending')).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it.each([
    ['not-a-uuid', 'active', 'pending'],
    [ID, 'pending', 'active'],
    [ID, 'deleted', 'active'],
    [ID, 'active', 'deleted'],
    [ID, 'active', undefined],
  ])('rejects invalid input (%s, %s, from %s) without an RPC', async (id, status, from) => {
    const result = await setUserStatus(id, status as 'active', from as 'pending')
    expect(result).toEqual({ ok: false, message: 'Yêu cầu không hợp lệ.' })
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it.each([
    ['forbidden', 'Bạn không có quyền thực hiện thao tác này.'],
    ['cannot_change_self', 'Bạn không thể thay đổi tài khoản của chính mình.'],
    ['something else', 'Không thực hiện được thao tác. Bạn thử lại nhé.'],
  ])('maps the RPC error %j to Vietnamese, without re-rendering', async (code, message) => {
    fake.rpc = { data: null, error: { message: code } }
    await expect(setUserStatus(ID, 'active', 'pending')).resolves.toEqual({ ok: false, message })
    expect(fake.calls.map((call) => call[0])).toEqual(['requireAdmin', 'rpc'])
  })

  it.each([
    ['not_found', 'Không tìm thấy tài khoản này. Bạn tải lại trang nhé.'],
    ['invalid_transition', 'Tài khoản đã đổi trạng thái. Bạn tải lại trang nhé.'],
    // Task 5.6 (the M2 2.8 minor): the row was rendered pending, another admin rejected it since.
    ['status_changed', 'Tài khoản đã đổi trạng thái. Bạn tải lại trang nhé.'],
  ])('maps %j, marks the result stale and re-renders the list', async (code, message) => {
    fake.rpc = { data: null, error: { message: code } }
    await expect(setUserStatus(ID, 'active', 'pending')).resolves.toEqual({
      ok: false,
      message,
      stale: true,
    })
    expect(fake.calls.map((call) => call[0])).toEqual(['requireAdmin', 'rpc', 'revalidatePath'])
    expect(fake.calls.at(-1)).toEqual(['revalidatePath', '/admin/users'])
  })
})

describe('setUserRole', () => {
  it.each([
    ['admin', 'Đã đặt làm quản trị viên.'],
    ['learner', 'Đã bỏ quyền quản trị.'],
  ] as const)('→ %s: "%s", then the list re-renders', async (role, message) => {
    fake.rpc = { data: { from: role === 'admin' ? 'learner' : 'admin', to: role }, error: null }
    await expect(setUserRole(ID, role)).resolves.toEqual({ ok: true, message })
    expect(fake.calls).toEqual([
      ['requireAdmin'],
      ['rpc', 'admin_set_role', { p_user_id: ID, p_role: role }],
      ['revalidatePath', '/admin/users'],
    ])
  })

  it('rejects an unknown role without an RPC', async () => {
    const result = await setUserRole(ID, 'owner' as 'admin')
    expect(result).toEqual({ ok: false, message: 'Yêu cầu không hợp lệ.' })
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it('maps no_change and re-renders the stale list', async () => {
    fake.rpc = { data: null, error: { message: 'no_change' } }
    await expect(setUserRole(ID, 'admin')).resolves.toEqual({
      ok: false,
      message: 'Tài khoản đã có quyền này. Bạn tải lại trang nhé.',
      stale: true,
    })
    expect(fake.calls.at(-1)).toEqual(['revalidatePath', '/admin/users'])
  })

  it('does not re-render after forbidden', async () => {
    fake.rpc = { data: null, error: { message: 'forbidden' } }
    await setUserRole(ID, 'admin')
    expect(fake.calls.map((call) => call[0])).toEqual(['requireAdmin', 'rpc'])
  })
})

describe('admin actions — rate limit (§2.3, decision 22: 60 / min per admin)', () => {
  it('answers vi.rateLimit.tooMany on the 61st admin action in a minute, before validating input', async () => {
    fake.adminId = 'admin-rate-limit-test'
    for (let i = 0; i < 60; i++) {
      const result = await setUserStatus(ID, 'active', 'pending')
      expect(result.ok).toBe(true)
    }
    fake.calls = []
    const result = await setUserStatus(ID, 'active', 'pending')
    expect(result).toEqual({ ok: false, message: copy.rateLimit.tooMany })
    // The rate check runs right after the guard, before the input is even parsed.
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it('shares one budget across setUserStatus and setUserRole for the same admin', async () => {
    fake.adminId = 'admin-rate-limit-shared'
    for (let i = 0; i < 60; i++) {
      await setUserRole(ID, 'admin')
    }
    const result = await setUserStatus(ID, 'active', 'pending')
    expect(result).toEqual({ ok: false, message: copy.rateLimit.tooMany })
  })

  it('does not rate-limit a different admin', async () => {
    fake.adminId = 'admin-rate-limit-untouched'
    const result = await setUserStatus(ID, 'active', 'pending')
    expect(result.ok).toBe(true)
  })
})

/** Spends the admin's 60 actions of this minute (decision 22) with `action`. */
async function exhaust(action: () => Promise<unknown>) {
  for (let i = 0; i < 60; i++) await action()
  fake.calls = []
}

describe('updateBotSettings (§6.2: each switch and the cap saved on its own)', () => {
  const SAVED = { ok: true, message: 'Đã lưu cài đặt bot.' }

  it.each([
    [{ enabled: true }, { p_enabled: true }],
    [{ dryRun: false }, { p_dry_run: false }],
    [{ contentProposals: true }, { p_content_proposals: true }],
    [{ perRunUserCap: 25 }, { p_per_run_user_cap: 25 }],
  ])(
    'saves %j (every other argument null: unchanged), then /admin/bot re-renders',
    async (input, args) => {
      await expect(updateBotSettings(input)).resolves.toEqual(SAVED)
      expect(fake.calls).toEqual([
        ['requireAdmin'],
        [
          'rpc',
          'admin_update_bot_settings',
          {
            p_enabled: null,
            p_dry_run: null,
            p_content_proposals: null,
            p_per_run_user_cap: null,
            p_limits: null,
            ...args,
          },
        ],
        ['revalidatePath', '/admin/bot'],
      ])
    },
  )

  it('refuses a non-admin before touching the database', async () => {
    fake.admin = false
    await expect(updateBotSettings({ enabled: true })).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it.each([
    [{}],
    [{ perRunUserCap: 0 }],
    [{ perRunUserCap: 101 }],
    [{ perRunUserCap: 2.5 }],
    [{ enabled: 'yes' }],
    [{ limits: { customItemsPerDay: 4 } }],
    [{ tokenHash: 'x' }],
  ])('refuses %j without an RPC (limits included: no UI sets them)', async (input) => {
    const result = await updateBotSettings(input as never)
    expect(result).toEqual({ ok: false, message: 'Cài đặt bot không hợp lệ.' })
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it.each([
    ['invalid_settings', 'Cài đặt bot không hợp lệ.'],
    ['forbidden', copy.errors.notAllowed],
    ['boom', 'Không lưu được cài đặt bot. Bạn thử lại nhé.'],
  ])('maps the RPC error %s', async (code, message) => {
    fake.rpc = { data: null, error: { message: code } }
    await expect(updateBotSettings({ enabled: true })).resolves.toEqual({ ok: false, message })
    expect(fake.calls.map((call) => call[0])).toEqual(['requireAdmin', 'rpc'])
  })

  it('is rate limited after the guard, before the input is parsed', async () => {
    fake.adminId = 'admin-bot-settings-rate'
    await exhaust(() => updateBotSettings({ enabled: true }))
    await expect(updateBotSettings({ enabled: true })).resolves.toEqual({
      ok: false,
      message: copy.rateLimit.tooMany,
    })
    expect(fake.calls).toEqual([['requireAdmin']])
  })
})

describe('rotateBotToken (§6.3, ADR-0026)', () => {
  it('sends only the hash and returns the token once; /admin/bot re-renders', async () => {
    fake.rpc = { data: { rotatedAt: 'x', prevValidUntil: null }, error: null }
    await expect(rotateBotToken()).resolves.toEqual({
      ok: true,
      token: TOKEN,
      message: 'Đã tạo token mới.',
    })
    expect(fake.calls).toEqual([
      ['requireAdmin'],
      ['newBotToken'],
      ['rpc', 'admin_rotate_bot_token', { p_token_hash: HASH }],
      ['revalidatePath', '/admin/bot'],
    ])
  })

  it('never logs the token, also when the RPC fails', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    )
    try {
      await rotateBotToken()
      fake.rpc = { data: null, error: { message: 'boom' } }
      await rotateBotToken()
      for (const spy of spies) {
        for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(TOKEN)
      }
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })

  it.each([
    ['invalid_token', 'Không tạo được token mới. Bạn thử lại nhé.'],
    ['forbidden', copy.errors.notAllowed],
    ['boom', 'Không tạo được token mới. Bạn thử lại nhé.'],
  ])('maps the RPC error %s, and returns no token', async (code, message) => {
    fake.rpc = { data: null, error: { message: code } }
    const result = await rotateBotToken()
    expect(result).toEqual({ ok: false, message })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(fake.calls.map((call) => call[0])).toEqual(['requireAdmin', 'newBotToken', 'rpc'])
  })

  it('refuses a non-admin before making a token', async () => {
    fake.admin = false
    await expect(rotateBotToken()).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it('is rate limited before a token is made', async () => {
    fake.adminId = 'admin-rotate-rate'
    await exhaust(() => rotateBotToken())
    await expect(rotateBotToken()).resolves.toEqual({
      ok: false,
      message: copy.rateLimit.tooMany,
    })
    expect(fake.calls).toEqual([['requireAdmin']])
  })
})

describe('setAiFlag (§2.4 /admin/users, decision 34)', () => {
  it.each([
    [true, 'Đã bật cá nhân hoá AI.'],
    [false, 'Đã tắt cá nhân hoá AI.'],
  ])('on=%s: "%s", then the list re-renders', async (on, message) => {
    fake.rpc = { data: { from: on ? 'off' : 'on', to: on ? 'on' : 'off' }, error: null }
    await expect(setAiFlag(ID, on)).resolves.toEqual({ ok: true, message })
    expect(fake.calls).toEqual([
      ['requireAdmin'],
      ['rpc', 'admin_set_ai_flag', { p_user_id: ID, p_on: on }],
      ['revalidatePath', '/admin/users'],
    ])
  })

  it('works on the admin’s own account (the owner is the first AI learner)', async () => {
    fake.adminId = ID
    await expect(setAiFlag(ID, true)).resolves.toMatchObject({ ok: true })
  })

  it.each([
    ['not-a-uuid', true],
    [ID, 'yes'],
    [ID, undefined],
  ])('refuses invalid input (%s, %s) without an RPC', async (id, on) => {
    await expect(setAiFlag(id, on as boolean)).resolves.toEqual({
      ok: false,
      message: 'Yêu cầu không hợp lệ.',
    })
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it.each([
    ['invalid_transition', copy.admin.errors.changed, true],
    ['no_change', copy.adminBot.aiFlag.changed, true],
    ['not_found', copy.admin.errors.notFound, true],
    ['forbidden', copy.errors.notAllowed, false],
    ['boom', copy.admin.errors.failed, false],
  ])(
    'maps %s (stale: %s — the list re-renders with the current state)',
    async (code, message, stale) => {
      fake.rpc = { data: null, error: { message: code } }
      const result = await setAiFlag(ID, true)
      expect(result).toEqual(stale ? { ok: false, message, stale: true } : { ok: false, message })
      expect(fake.calls.some((call) => call[0] === 'revalidatePath')).toBe(stale)
    },
  )

  it('refuses a non-admin before touching the database', async () => {
    fake.admin = false
    await expect(setAiFlag(ID, true)).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it('shares the admin action budget', async () => {
    fake.adminId = 'admin-ai-flag-rate'
    await exhaust(() => setUserRole(ID, 'admin'))
    await expect(setAiFlag(ID, true)).resolves.toEqual({
      ok: false,
      message: copy.rateLimit.tooMany,
    })
    expect(fake.calls).toEqual([['requireAdmin']])
  })
})

describe('requestPublish (§6.6 "Xuất bản"; decision 20)', () => {
  it.each(['dsa:lc-0146', 'dsa:lc-0206#note'])(
    'records a request for the draft %s, then /admin/content re-renders',
    async (target) => {
      fake.rpc = { data: { id: 7, target, status: 'pending' }, error: null }
      await expect(requestPublish(target)).resolves.toEqual({
        ok: true,
        message: 'Đã ghi yêu cầu xuất bản.',
      })
      expect(fake.calls).toEqual([
        ['requireAdmin'],
        ['rpc', 'admin_request_publish', { p_target: target }],
        ['revalidatePath', '/admin/content'],
      ])
    },
  )

  it.each([
    ['an active item', 'dsa:lc-0001'],
    ['an active note', 'dsa:lc-0001#note'],
    ['an active lesson', 'dsa:lesson-trees'],
    ['an unknown item', 'dsa:lc-9999'],
    ['a problem without a note', 'dsa:lc-0146#note'],
    ['a malformed target', 'DSA LC 1'],
  ])('refuses %s before the RPC', async (_, target) => {
    await expect(requestPublish(target)).resolves.toEqual({
      ok: false,
      message: copy.publish.errors.notDraft,
    })
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it('refuses a non-admin before anything else', async () => {
    fake.admin = false
    await expect(requestPublish('dsa:lc-0146')).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it('a database error says so and does not re-render', async () => {
    fake.rpc = { data: null, error: { message: 'boom' } }
    await expect(requestPublish('dsa:lc-0146')).resolves.toEqual({
      ok: false,
      message: copy.publish.errors.failed,
    })
    fake.rpc = { data: null, error: { message: 'forbidden' } }
    await expect(requestPublish('dsa:lc-0146')).resolves.toEqual({
      ok: false,
      message: copy.errors.notAllowed,
    })
    expect(fake.calls.some(([name]) => name === 'revalidatePath')).toBe(false)
  })
})

describe('cancelPublish (§6.6 "Huỷ")', () => {
  it('cancels a pending request, then /admin/content re-renders', async () => {
    fake.rpc = { data: { id: 7, status: 'cancelled' }, error: null }
    await expect(cancelPublish(7)).resolves.toEqual({
      ok: true,
      message: 'Đã huỷ yêu cầu xuất bản.',
    })
    expect(fake.calls).toEqual([
      ['requireAdmin'],
      ['rpc', 'admin_cancel_publish', { p_id: 7 }],
      ['revalidatePath', '/admin/content'],
    ])
  })

  it.each(['not_found', 'invalid_transition'])(
    '%s: the request changed — stale, and the page re-renders',
    async (code) => {
      fake.rpc = { data: null, error: { message: code } }
      await expect(cancelPublish(7)).resolves.toEqual({
        ok: false,
        message: copy.publish.errors.changed,
        stale: true,
      })
      expect(fake.calls).toContainEqual(['revalidatePath', '/admin/content'])
    },
  )

  it('refuses an id that is not a positive integer before the RPC', async () => {
    for (const id of [0, -1, 1.5, Number.NaN]) {
      await expect(cancelPublish(id)).resolves.toEqual({
        ok: false,
        message: copy.admin.errors.invalid,
      })
    }
    expect(fake.calls.every(([name]) => name === 'requireAdmin')).toBe(true)
  })
})

describe('publish actions — rate limit (decision 22)', () => {
  it('the 61st admin action in a minute is refused before the RPC', async () => {
    fake.rpc = { data: { id: 7 }, error: null }
    for (let i = 0; i < 60; i += 1) await requestPublish('dsa:lc-0146')
    fake.calls = []
    await expect(cancelPublish(7)).resolves.toEqual({ ok: false, message: copy.rateLimit.tooMany })
    expect(fake.calls).toEqual([['requireAdmin']])
  })
})
