import { render } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MarkPlanSeen } from './mark-plan-seen'

const PLAN = '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f'
const OTHER = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

describe('MarkPlanSeen (§5.2, ADR-0039)', () => {
  it('renders nothing and calls the action once after mount', () => {
    const action = vi.fn(async () => {})
    const { container } = render(<MarkPlanSeen planId={PLAN} markPlanSeen={action} />)
    expect(container.innerHTML).toBe('')
    expect(action.mock.calls).toEqual([[PLAN]])
  })

  it('calls it once, also after a re-render with a new action identity and in StrictMode', () => {
    const first = vi.fn(async () => {})
    const second = vi.fn(async () => {})
    const { rerender } = render(
      <StrictMode>
        <MarkPlanSeen planId={PLAN} markPlanSeen={first} />
      </StrictMode>,
    )
    rerender(
      <StrictMode>
        <MarkPlanSeen planId={PLAN} markPlanSeen={second} />
      </StrictMode>,
    )
    expect(first.mock.calls).toEqual([[PLAN]])
    expect(second).not.toHaveBeenCalled()
  })

  it('marks a new plan when the plan changes (after "Học tiếp hôm nay")', () => {
    const action = vi.fn(async () => {})
    const { rerender } = render(<MarkPlanSeen planId={PLAN} markPlanSeen={action} />)
    rerender(<MarkPlanSeen planId={OTHER} markPlanSeen={action} />)
    expect(action.mock.calls).toEqual([[PLAN], [OTHER]])
  })

  it('swallows a failed call; a later effect run marks the plan again', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline')
    })
    const next = vi.fn(async () => {})
    const { rerender } = render(<MarkPlanSeen planId={PLAN} markPlanSeen={failing} />)
    expect(failing).toHaveBeenCalledTimes(1)
    // Let the rejection settle: an unhandled one would fail the run.
    await new Promise((resolve) => setTimeout(resolve, 0))
    rerender(<MarkPlanSeen planId={PLAN} markPlanSeen={next} />)
    expect(next.mock.calls).toEqual([[PLAN]])
  })
})
