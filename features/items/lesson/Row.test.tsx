import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { lessonItem } from '../fixtures'
import { LessonRow } from './Row'

const HREF = '/t/dsa/items/lesson-two-pointers'

describe('LessonRow', () => {
  it('is one link: the title and "Pattern · 25 phút" (the manifest estimate)', () => {
    render(<LessonRow item={lessonItem()} state={null} href={HREF} />)
    const row = screen.getByRole('link')
    expect(row.getAttribute('href')).toBe(HREF)
    expect(within(row).getByText('Two pointers')).toBeTruthy()
    expect(row.querySelector('[data-slot="link-row-meta"]')?.textContent).toBe('Pattern · 25 phút')
  })

  it('shows "Chưa học" with showStatus, and the draft badge for a draft', () => {
    render(<LessonRow item={lessonItem({ status: 'draft' })} state={null} href={HREF} showStatus />)
    const row = screen.getByRole('link')
    expect(within(row).getByText('Chưa học')).toBeTruthy()
    expect(within(row).getByText('Bản nháp')).toBeTruthy()
  })
})
