import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

const VARIANTS = ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const
const SIZES = [
  ['sm', 'h-9'],
  ['md', 'h-11'],
  ['lg', 'h-12'],
  ['icon', 'size-11'],
] as const

describe('Button', () => {
  it('defaults to a 44 px primary button that does not submit forms', () => {
    render(<Button>Bắt đầu</Button>)
    const button = screen.getByRole('button', { name: 'Bắt đầu' })
    expect(button.dataset.variant).toBe('primary')
    expect(button.dataset.size).toBe('md')
    expect(button.className).toContain('h-11')
    expect(button.getAttribute('type')).toBe('button')
  })

  it.each(VARIANTS)('renders the %s variant', (variant) => {
    render(<Button variant={variant}>Nút</Button>)
    expect(screen.getByRole('button').dataset.variant).toBe(variant)
  })

  it.each(SIZES)('size %s uses %s', (size, cls) => {
    render(<Button size={size}>Nút</Button>)
    expect(screen.getByRole('button').className).toContain(cls)
  })

  it('can be disabled', () => {
    render(<Button disabled>Nút</Button>)
    expect(screen.getByRole('button')).toHaveProperty('disabled', true)
  })

  it('keeps its label and width while loading, and reports busy', () => {
    render(<Button loading>Lưu</Button>)
    const button = screen.getByRole('button', { name: 'Lưu' })
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button).toHaveProperty('disabled', true)
    const spinner = button.querySelector('svg')
    expect(spinner?.getAttribute('aria-hidden')).toBe('true')
    expect(button.textContent).toBe('Lưu')
  })

  it('renders a link with button styling through asChild', () => {
    render(
      <Button asChild variant="outline">
        <a href="/today">Hôm nay</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Hôm nay' })
    expect(link.className).toContain('h-11')
    expect(link.hasAttribute('type')).toBe(false)
  })

  it.each(VARIANTS)('keeps the global focus ring for %s', (variant) => {
    render(<Button variant={variant}>Nút</Button>)
    expect(screen.getByRole('button').className).not.toMatch(/outline-none|outline-hidden/)
  })
})
