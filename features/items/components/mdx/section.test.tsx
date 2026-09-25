import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Section } from './section'

describe('Section', () => {
  it('is a region labelled by an h2 from the kind (decision 33)', () => {
    render(
      <Section kind="signals">
        <p>Mảng đã sắp xếp.</p>
      </Section>,
    )
    const region = screen.getByRole('region', { name: 'Dấu hiệu nhận biết' })
    expect(region.tagName).toBe('SECTION')
    expect(region.dataset.section).toBe('signals')
    const heading = screen.getByRole('heading', { level: 2, name: 'Dấu hiệu nhận biết' })
    expect(region.getAttribute('aria-labelledby')).toBe(heading.id)
    expect(region?.contains(screen.getByText('Mảng đã sắp xếp.'))).toBe(true)
  })

  it.each([
    ['analogy', 'Ví dụ đời thường'],
    ['quiz', 'Kiểm tra nhanh'],
  ])('labels %s as %s', (kind, label) => {
    render(<Section kind={kind}>x</Section>)
    expect(screen.getByRole('heading', { level: 2, name: label })).toBeTruthy()
  })

  it('falls back to the kind ID for a kind without a label', () => {
    render(<Section kind="deep-dive-notes">x</Section>)
    expect(screen.getByRole('region', { name: 'deep-dive-notes' }).dataset.section).toBe(
      'deep-dive-notes',
    )
  })

  it('never reads a label from Object.prototype', () => {
    render(<Section kind="constructor">x</Section>)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('constructor')
  })

  it('gives each section its own heading ID', () => {
    render(
      <>
        <Section kind="code">a</Section>
        <Section kind="code">b</Section>
      </>,
    )
    const [first, second] = screen.getAllByRole('heading', { level: 2 })
    expect(first?.id).toBeTruthy()
    expect(first?.id).not.toBe(second?.id)
  })
})
