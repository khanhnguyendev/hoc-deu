import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NOTE, premiumProblemItem, problemItem } from '../fixtures'
import { ProblemRow } from './Row'

const HREF = '/t/dsa/items/lc-0001'

describe('ProblemRow', () => {
  it('is one link: the English title and "#1 · Easy · Arrays & Hashing"', () => {
    render(<ProblemRow item={problemItem()} state={null} href={HREF} />)
    const row = screen.getByRole('link')
    expect(row.getAttribute('href')).toBe(HREF)
    expect(within(row).getByText('Two Sum').getAttribute('lang')).toBe('en')
    expect(row.querySelector('[data-slot="link-row-meta"]')?.textContent).toBe(
      '#1 · Easy · Arrays & Hashing',
    )
  })

  it('has a readable accessible name: title, facts, badges and status as words', () => {
    render(<ProblemRow item={premiumProblemItem()} state={null} href={HREF} showStatus />)
    expect(
      screen.getByRole('link', {
        name: 'Encode and Decode Strings #271 Medium Arrays & Hashing Premium Chưa học',
      }),
    ).toBeTruthy()
    render(<ProblemRow item={problemItem({ status: 'draft' })} state={null} href={HREF} />)
    expect(
      screen.getByRole('link', {
        name: 'Two Sum #1 Easy Arrays & Hashing Đã kiểm thử Bản nháp',
      }),
    ).toBeTruthy()
  })

  it('shows the verification icon for a visible note, with its label for screen readers', () => {
    render(<ProblemRow item={problemItem()} state={null} href={HREF} />)
    expect(within(screen.getByRole('link')).getByText('Đã kiểm thử').className).toContain('sr-only')
  })

  it('shows no verification icon without a note or with a draft note', () => {
    const { rerender } = render(<ProblemRow item={premiumProblemItem()} state={null} href={HREF} />)
    expect(screen.queryByText('Đã kiểm thử')).toBeNull()
    const draftNote = problemItem({ content: { note: { ...NOTE, status: 'draft' } } })
    rerender(<ProblemRow item={draftNote} state={null} href={HREF} />)
    expect(screen.queryByText('Đã kiểm thử')).toBeNull()
  })

  it('marks a premium problem', () => {
    render(<ProblemRow item={premiumProblemItem()} state={null} href={HREF} />)
    expect(within(screen.getByRole('link')).getByText('Premium')).toBeTruthy()
  })

  it('shows the status pill only with showStatus: "Chưa học" for no state, else the state', () => {
    const { rerender } = render(<ProblemRow item={problemItem()} state={null} href={HREF} />)
    expect(screen.queryByText('Chưa học')).toBeNull()
    rerender(<ProblemRow item={problemItem()} state={null} href={HREF} showStatus />)
    expect(within(screen.getByRole('link')).getByText('Chưa học')).toBeTruthy()
    rerender(
      <ProblemRow
        item={problemItem()}
        state={{ status: 'weak', level: 1, dueOn: '2026-10-01' }}
        href={HREF}
        showStatus
      />,
    )
    expect(within(screen.getByRole('link')).getByText('Yếu')).toBeTruthy()
  })

  it('badges drafts "Bản nháp" and retired items "Đã ngừng"', () => {
    const { rerender } = render(
      <ProblemRow item={problemItem({ status: 'draft' })} state={null} href={HREF} />,
    )
    expect(within(screen.getByRole('link')).getByText('Bản nháp')).toBeTruthy()
    rerender(<ProblemRow item={problemItem({ status: 'retired' })} state={null} href={HREF} />)
    expect(within(screen.getByRole('link')).getByText('Đã ngừng')).toBeTruthy()
  })
})
