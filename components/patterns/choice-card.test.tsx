import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Checkbox } from '@/components/ui/checkbox'
import { ChoiceCard } from './choice-card'

function Example() {
  const [checked, setChecked] = useState(false)
  return (
    <ChoiceCard
      htmlFor="dsa"
      control={
        <Checkbox id="dsa" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
      }
      title="DSA"
      description="Cấu trúc dữ liệu và giải thuật"
    />
  )
}

describe('ChoiceCard', () => {
  it('toggles the control when the card text is clicked', async () => {
    render(<Example />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    await userEvent.setup().click(screen.getByText('Cấu trúc dữ liệu và giải thuật'))
    expect(checkbox.getAttribute('aria-checked')).toBe('true')
  })

  it('shows the selected state on the card when the control is checked', () => {
    render(<ChoiceCard htmlFor="x" control={<Checkbox id="x" checked />} title="DSA" />)
    const card = screen.getByRole('checkbox').closest('label')
    expect(card?.className).toContain('has-data-[state=checked]:border-primary')
    expect(card?.className).toContain('has-data-[state=checked]:bg-primary-soft')
  })
})
