import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GradeButtons, OutcomeMessage } from './grade-buttons'

const GRADES = [
  { value: 'solved', label: 'Tự giải được' },
  { value: 'hint', label: 'Cần gợi ý' },
  { value: 'failed', label: 'Chưa giải được' },
] as const

describe('GradeButtons', () => {
  it('is a named group of three 44 px buttons, none pressed and none primary by default', () => {
    render(<GradeButtons label="Bạn giải bài này thế nào?" grades={GRADES} onGrade={() => {}} />)
    const group = screen.getByRole('group', { name: 'Bạn giải bài này thế nào?' })
    const buttons = screen.getAllByRole('button')
    expect(group.contains(buttons[0]!)).toBe(true)
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Tự giải được',
      'Cần gợi ý',
      'Chưa giải được',
    ])
    for (const button of buttons) {
      expect(button.getAttribute('aria-pressed')).toBe('false')
      expect(button.dataset.variant).toBe('outline')
      expect(button.dataset.size).toBe('md')
    }
  })

  it('marks the selected grade pressed and primary — the one primary of the group', () => {
    render(<GradeButtons label="Kết quả" grades={GRADES} selected="hint" onGrade={() => {}} />)
    const hint = screen.getByRole('button', { name: 'Cần gợi ý' })
    expect(hint.getAttribute('aria-pressed')).toBe('true')
    expect(hint.dataset.variant).toBe('primary')
    expect(
      screen.getAllByRole('button').filter((button) => button.dataset.variant === 'primary'),
    ).toHaveLength(1)
  })

  it('calls onGrade with the value — the selected one included', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()
    render(<GradeButtons label="Kết quả" grades={GRADES} selected="hint" onGrade={onGrade} />)
    await user.click(screen.getByRole('button', { name: 'Chưa giải được' }))
    await user.click(screen.getByRole('button', { name: 'Cần gợi ý' }))
    expect(onGrade.mock.calls).toEqual([['failed'], ['hint']])
  })

  it('while one grade saves: it shows busy, the others are disabled, clicks are ignored', async () => {
    const user = userEvent.setup()
    const onGrade = vi.fn()
    render(<GradeButtons label="Kết quả" grades={GRADES} pending="solved" onGrade={onGrade} />)
    const solved = screen.getByRole('button', { name: 'Tự giải được' })
    expect(solved.getAttribute('aria-busy')).toBe('true')
    expect((screen.getByRole('button', { name: 'Cần gợi ý' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    await user.click(solved)
    expect(onGrade).not.toHaveBeenCalled()
  })

  it('names keyboard shortcuts (aria-keyshortcuts) and describes the group', () => {
    render(
      <GradeButtons
        label="Kết quả"
        grades={GRADES.map((grade, index) => ({ ...grade, shortcut: String(index + 1) }))}
        description="Phím tắt: 1, 2, 3"
        onGrade={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: /Cần gợi ý/ }).getAttribute('aria-keyshortcuts'),
    ).toBe('2')
    const group = screen.getByRole('group', { name: 'Kết quả' })
    const described = document.getElementById(group.getAttribute('aria-describedby') ?? '')
    expect(described?.textContent).toBe('Phím tắt: 1, 2, 3')
  })

  it('can be disabled as a whole', () => {
    render(<GradeButtons label="Kết quả" grades={GRADES} disabled onGrade={() => {}} />)
    for (const button of screen.getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true)
    }
  })
})

describe('OutcomeMessage', () => {
  it('is an empty polite live region until there is something to say', () => {
    render(<OutcomeMessage result={null} />)
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe('')
  })

  it('says what was saved, or what failed — icon and text, never colour alone', () => {
    const { rerender } = render(
      <OutcomeMessage result={{ ok: true, message: 'Đã lưu kết quả.' }} />,
    )
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('Đã lưu kết quả.')
    expect(region.dataset.tone).toBe('saved')
    expect(region.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    rerender(<OutcomeMessage result={{ ok: false, message: 'Chưa lưu được kết quả.' }} />)
    expect(region.textContent).toBe('Chưa lưu được kết quả.')
    expect(region.dataset.tone).toBe('failed')
  })
})
