import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StatusWatcher } from './status-watcher'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

beforeEach(() => {
  vi.useFakeTimers()
  refresh.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('StatusWatcher', () => {
  it('renders nothing', () => {
    const { container } = render(<StatusWatcher />)
    expect(container.innerHTML).toBe('')
  })

  it('refreshes every 30 seconds', () => {
    render(<StatusWatcher />)
    expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(30_000)
    expect(refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30_000)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('refreshes when the window regains focus', () => {
    render(<StatusWatcher />)
    window.dispatchEvent(new Event('focus'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes when the tab becomes visible again', () => {
    render(<StatusWatcher />)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('stops watching after it unmounts', () => {
    const { unmount } = render(<StatusWatcher />)
    unmount()
    vi.advanceTimersByTime(60_000)
    window.dispatchEvent(new Event('focus'))
    expect(refresh).not.toHaveBeenCalled()
  })
})
