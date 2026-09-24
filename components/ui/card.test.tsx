import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card'
import { Separator } from './separator'
import { Skeleton } from './skeleton'

describe('Card', () => {
  it('renders every slot on a bordered surface', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Two Pointers</CardTitle>
          <CardDescription>Tuần 2</CardDescription>
          <CardAction>…</CardAction>
        </CardHeader>
        <CardContent>Nội dung</CardContent>
        <CardFooter>Chân</CardFooter>
      </Card>,
    )
    const card = screen.getByTestId('card')
    expect(card.className).toContain('bg-surface')
    expect(card.className).toContain('rounded-lg')
    for (const text of ['Two Pointers', 'Tuần 2', 'Nội dung', 'Chân']) {
      expect(screen.getByText(text)).toBeTruthy()
    }
  })

  it('shows a hover shadow only when interactive', () => {
    render(
      <>
        <Card data-testid="plain" />
        <Card data-testid="interactive" interactive />
      </>,
    )
    expect(screen.getByTestId('plain').className).not.toContain('hover:shadow-sm')
    expect(screen.getByTestId('interactive').className).toContain('hover:shadow-sm')
  })
})

describe('Badge', () => {
  it.each(['neutral', 'primary', 'success', 'warning', 'danger', 'track', 'outline'] as const)(
    'renders the %s tone',
    (tone) => {
      render(<Badge tone={tone}>DSA</Badge>)
      expect(screen.getByText('DSA').dataset.tone).toBe(tone)
    },
  )
})

describe('Separator and Skeleton', () => {
  it('renders a decorative separator', () => {
    const { container } = render(<Separator />)
    const separator = container.querySelector('[data-slot="separator"]')
    expect(separator?.getAttribute('data-orientation')).toBe('horizontal')
  })

  it('hides skeletons from assistive technology', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />)
    const skeleton = container.querySelector('[data-slot="skeleton"]')
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true')
    expect(skeleton?.className).toContain('animate-pulse')
  })
})
