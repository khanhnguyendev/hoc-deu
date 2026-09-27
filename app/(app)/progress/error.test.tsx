import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from '@/lib/i18n/vi'
import ProgressError from './error'

describe('(app)/progress/error', () => {
  it('shows the error state and calls retry', () => {
    let retried = false
    render(<ProgressError error={new Error('boom')} retry={() => (retried = true)} />)
    expect(screen.getByRole('heading', { level: 1, name: vi.states.errorTitle })).toBeTruthy()
    screen.getByRole('button', { name: vi.common.retry }).click()
    expect(retried).toBe(true)
  })
})
