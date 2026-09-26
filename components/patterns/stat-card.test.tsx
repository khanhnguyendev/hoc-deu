import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatCard } from './stat-card'

describe('StatCard — M1 #15 (DESIGN_SYSTEM §4.3)', () => {
  it('tightens the tracking of a number only', () => {
    render(<StatCard label="Thẻ đã thuộc" value={1234} hint="Tuần này" />)
    const value = screen.getByText('1.234')
    expect(value.className).toContain('tracking-tight')
    expect(screen.getByText('Thẻ đã thuộc').className).not.toContain('tracking-tight')
    expect(screen.getByText('Tuần này').className).not.toContain('tracking-tight')
  })

  it('never tightens a text value: Vietnamese diacritics must not collide', () => {
    render(<StatCard label="Dự kiến xong" value="12,4 tuần" />)
    const value = screen.getByText('12,4 tuần')
    expect(value.className).not.toContain('tracking-tight')
    expect(value.className).toContain('tabular-nums')
  })
})
