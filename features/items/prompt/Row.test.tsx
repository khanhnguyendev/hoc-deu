import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { promptItem, weeklyPromptItem } from '../fixtures'
import { PromptRow } from './Row'

describe('PromptRow', () => {
  it('is one link: the instruction and "tag · minutes"', () => {
    render(<PromptRow item={promptItem()} state={null} href="/x" />)
    const row = screen.getByRole('link')
    expect(
      within(row).getByText('Phỏng vấn thử: giải một bài trong 30 phút và nói to cách làm'),
    ).toBeTruthy()
    expect(row.querySelector('[data-slot="link-row-meta"]')?.textContent).toBe(
      'Phỏng vấn thử · 45 phút',
    )
  })

  it('a weekly prompt without its own length: the manifest estimate', () => {
    render(<PromptRow item={weeklyPromptItem()} state={null} href="/x" />)
    expect(screen.getByRole('link').querySelector('[data-slot="link-row-meta"]')?.textContent).toBe(
      'Nhiệm vụ cuối tuần · 10 phút',
    )
  })

  it('shows "Chưa học" with showStatus and "Bản nháp" for a draft', () => {
    render(<PromptRow item={promptItem({ status: 'draft' })} state={null} href="/x" showStatus />)
    const row = screen.getByRole('link')
    expect(within(row).getByText('Chưa học')).toBeTruthy()
    expect(within(row).getByText('Bản nháp')).toBeTruthy()
  })
})
