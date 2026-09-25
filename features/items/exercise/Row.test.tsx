import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fillBlankItem, respondItem, rewriteItem } from '../fixtures'
import { ExerciseRow } from './Row'

describe('ExerciseRow', () => {
  it.each([
    ['fill-blank', fillBlankItem, 'Điền từ còn thiếu', 'Điền từ'],
    ['respond', respondItem, 'Trả lời đồng nghiệp một cách lịch sự', 'Trả lời'],
    ['rewrite', rewriteItem, 'Viết lại cho lịch sự và rõ ràng', 'Viết lại'],
  ] as const)('%s: the instruction and the kind label', (_kind, make, title, label) => {
    render(<ExerciseRow item={make()} state={null} href="/x" />)
    const row = screen.getByRole('link')
    expect(within(row).getByText(title)).toBeTruthy()
    expect(row.querySelector('[data-slot="link-row-meta"]')?.textContent).toBe(label)
  })

  it('shows "Chưa học" with showStatus', () => {
    render(<ExerciseRow item={fillBlankItem()} state={null} href="/x" showStatus />)
    expect(within(screen.getByRole('link')).getByText('Chưa học')).toBeTruthy()
  })
})
