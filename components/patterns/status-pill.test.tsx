import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { STATUS_PILL, StatusPill, type PillStatus } from './status-pill'

/** DESIGN_SYSTEM §3.3 — icon (lucide class) and label per status. */
const EXPECTED: Record<PillStatus, [icon: string, label: string]> = {
  'not-started': ['lucide-circle', 'Chưa học'],
  weak: ['lucide-triangle-alert', 'Yếu'],
  ok: ['lucide-circle-dot', 'Ổn'],
  strong: ['lucide-circle-check', 'Vững'],
  mastered: ['lucide-star', 'Thành thạo'],
  skipped: ['lucide-skip-forward', 'Đã bỏ qua'],
  'block-done': ['lucide-check', 'Xong'],
  'block-partial': ['lucide-clock', 'Một phần'],
  'block-skipped': ['lucide-skip-forward', 'Bỏ qua'],
}

describe('StatusPill', () => {
  it('covers every status', () => {
    expect(Object.keys(STATUS_PILL).sort()).toEqual(Object.keys(EXPECTED).sort())
  })

  it.each(Object.entries(EXPECTED))('%s shows its icon and label', (status, [icon, label]) => {
    render(<StatusPill status={status as PillStatus} />)
    const pill = screen.getByText(label).closest('[data-slot="status-pill"]')
    const svg = pill?.querySelector('svg')
    expect(svg?.classList.contains(icon)).toBe(true)
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(pill?.getAttribute('data-status')).toBe(status)
  })

  it.each([
    ['sm', 'h-6'],
    ['md', 'h-8'],
  ] as const)('size %s is %s tall', (size, cls) => {
    render(<StatusPill status="ok" size={size} />)
    expect(screen.getByText('Ổn').closest('[data-slot="status-pill"]')?.className).toContain(cls)
  })
})
