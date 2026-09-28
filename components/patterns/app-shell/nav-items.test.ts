import { describe, expect, it } from 'vitest'
import { ADMIN_ITEMS, isCurrent } from './nav-items'

describe('ADMIN_ITEMS (§2.4)', () => {
  it('lists the admin pages, "Bot AI" after "Nội dung" (task 6.3)', () => {
    expect(ADMIN_ITEMS.map((item) => [item.href, item.label])).toEqual([
      ['/admin', 'Quản trị'],
      ['/admin/users', 'Người dùng'],
      ['/admin/content', 'Nội dung'],
      ['/admin/bot', 'Bot AI'],
    ])
  })

  it('marks /admin/bot current on its own path only', () => {
    const bot = ADMIN_ITEMS.find((item) => item.href === '/admin/bot')!
    expect(isCurrent(bot, '/admin/bot')).toBe(true)
    expect(isCurrent(bot, '/admin/bot/runs')).toBe(true)
    expect(isCurrent(bot, '/admin/botx')).toBe(false)
    expect(isCurrent(bot, '/admin')).toBe(false)
    const overview = ADMIN_ITEMS.find((item) => item.href === '/admin')!
    expect(isCurrent(overview, '/admin/bot')).toBe(false)
  })
})
