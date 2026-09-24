import { beforeEach, describe, expect, it, vi } from 'vitest'

const ID = '5b0c61a2-7f5e-4c3b-9a41-2f1d7c8e9a10'

const fake = vi.hoisted(() => ({
  admin: true,
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
    return { id: 'admin-id' }
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

const { setUserRole, setUserStatus } = await import('./actions')

beforeEach(() => {
  fake.admin = true
  fake.rpc = { data: null, error: null }
  fake.calls = []
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
    await expect(setUserStatus(ID, to)).resolves.toEqual({ ok: true, message })
    expect(fake.calls).toEqual([
      ['requireAdmin'],
      ['rpc', 'admin_set_status', { p_user_id: ID, p_status: to }],
      ['revalidatePath', '/admin/users'],
    ])
  })

  it('refuses a non-admin before touching the database', async () => {
    fake.admin = false
    await expect(setUserStatus(ID, 'active')).rejects.toThrow('NOT_FOUND')
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it.each([
    ['not-a-uuid', 'active'],
    [ID, 'pending'],
    [ID, 'deleted'],
  ])('rejects invalid input (%s, %s) without an RPC', async (id, status) => {
    const result = await setUserStatus(id, status as 'active')
    expect(result).toEqual({ ok: false, message: 'Yêu cầu không hợp lệ.' })
    expect(fake.calls).toEqual([['requireAdmin']])
  })

  it.each([
    ['forbidden', 'Bạn không có quyền thực hiện thao tác này.'],
    ['cannot_change_self', 'Bạn không thể thay đổi tài khoản của chính mình.'],
    ['something else', 'Không thực hiện được thao tác. Bạn thử lại nhé.'],
  ])('maps the RPC error %j to Vietnamese, without re-rendering', async (code, message) => {
    fake.rpc = { data: null, error: { message: code } }
    await expect(setUserStatus(ID, 'active')).resolves.toEqual({ ok: false, message })
    expect(fake.calls.map((call) => call[0])).toEqual(['requireAdmin', 'rpc'])
  })

  it.each([
    ['not_found', 'Không tìm thấy tài khoản này. Bạn tải lại trang nhé.'],
    ['invalid_transition', 'Tài khoản đã đổi trạng thái. Bạn tải lại trang nhé.'],
  ])('maps %j and re-renders the stale list', async (code, message) => {
    fake.rpc = { data: null, error: { message: code } }
    await expect(setUserStatus(ID, 'active')).resolves.toEqual({ ok: false, message })
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
    })
    expect(fake.calls.at(-1)).toEqual(['revalidatePath', '/admin/users'])
  })

  it('does not re-render after forbidden', async () => {
    fake.rpc = { data: null, error: { message: 'forbidden' } }
    await setUserRole(ID, 'admin')
    expect(fake.calls.map((call) => call[0])).toEqual(['requireAdmin', 'rpc'])
  })
})
