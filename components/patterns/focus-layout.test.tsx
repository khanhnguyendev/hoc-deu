import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FocusLayout } from './focus-layout'

describe('FocusLayout', () => {
  it('renders the wordmark link and a landmark main#main', () => {
    render(
      <FocusLayout>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    const link = screen.getByRole('link', { name: 'Học Đều' })
    expect(link.getAttribute('href')).toBe('/')
    const main = screen.getByRole('main')
    expect(main.getAttribute('id')).toBe('main')
    expect(main.textContent).toContain('Nội dung')
  })

  it('renders header actions when given', () => {
    render(
      <FocusLayout headerActions={<button type="button">Trợ giúp</button>}>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    expect(screen.getByRole('button', { name: 'Trợ giúp' })).toBeTruthy()
  })

  it('switches the main max-width between narrow (default) and wide', () => {
    const { rerender } = render(
      <FocusLayout>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    expect(screen.getByRole('main').className).toContain('max-w-md')
    rerender(
      <FocusLayout width="wide">
        <p>Nội dung</p>
      </FocusLayout>,
    )
    expect(screen.getByRole('main').className).toContain('max-w-2xl')
  })

  it('stacks the page sections with the section spacing (DESIGN_SYSTEM §5)', () => {
    render(
      <FocusLayout>
        <p>Tiêu đề</p>
        <p>Nội dung</p>
      </FocusLayout>,
    )
    const main = screen.getByRole('main')
    for (const token of ['flex-col', 'gap-6', 'md:gap-8', 'lg:gap-10']) {
      expect(main.className.split(' ')).toContain(token)
    }
  })
})
