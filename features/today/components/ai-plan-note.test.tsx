import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AiPlanNote } from './ai-plan-note'

const RATIONALE = 'Ôn lại Group Anagrams vì lần trước chưa làm được, sau đó học tiếp Stack.'

describe('AiPlanNote (spec §2.4, decision 16)', () => {
  it('shows the badge — an icon and words, never colour alone — and the rationale as plain text', () => {
    const { container } = render(<AiPlanNote view={{ rationale: RATIONALE }} />)
    const group = screen.getByRole('group', { name: 'Kế hoạch hôm nay do AI cá nhân hoá' })
    const badge = group.querySelector('[data-slot="badge"]')!
    expect(badge.textContent).toBe('Cá nhân hoá bởi AI')
    expect(badge.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText(RATIONALE).tagName).toBe('P')
    expect(container.querySelector('a')).toBeNull()
  })

  it('renders markup in a rationale as text, never as HTML', () => {
    const { container } = render(<AiPlanNote view={{ rationale: '<b>Ôn</b> lại' }} />)
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText('<b>Ôn</b> lại')).toBeTruthy()
  })

  it('the empty state: an AI plan without a rationale shows the badge alone', () => {
    const { container } = render(<AiPlanNote view={{ rationale: null }} />)
    expect(screen.getByText('Cá nhân hoá bởi AI')).toBeTruthy()
    expect(container.querySelector('p')).toBeNull()
  })

  it('a long rationale wraps: a long word breaks instead of overflowing', () => {
    render(<AiPlanNote view={{ rationale: 'a'.repeat(280) }} />)
    expect(screen.getByText('a'.repeat(280)).className).toContain('break-words')
  })

  it('uses theme tokens only, so dark mode follows the tokens (no fixed colours)', () => {
    const { container } = render(<AiPlanNote view={{ rationale: RATIONALE }} />)
    expect(container.querySelector('[data-slot="badge"]')?.getAttribute('data-tone')).toBe(
      'primary',
    )
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}|rgb\(|oklch\(/i)
    expect(screen.getByText(RATIONALE).className).toContain('text-muted-foreground')
  })
})
