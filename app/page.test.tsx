import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import Home from './page'

it('renders the home page heading in jsdom', () => {
  render(<Home />)
  expect(screen.getByRole('heading', { level: 1, name: 'Học Đều' })).toBeTruthy()
})
