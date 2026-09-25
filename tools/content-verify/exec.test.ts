/**
 * `execCommand` against a child it may not signal: in sandbox mode the child is a root-owned
 * `sudo`, and `kill()` fails with EPERM (Node reports that as an 'error' event).
 */
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, spawn: vi.fn() }
})

const { spawn } = await import('node:child_process')
const { execCommand } = await import('./orchestrator')

class UnkillableChild extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  stdin = new PassThrough()
  signals: string[] = []
  kill(signal: string): boolean {
    this.signals.push(signal)
    queueMicrotask(() =>
      this.emit('error', Object.assign(new Error('kill EPERM'), { code: 'EPERM' })),
    )
    return false
  }
}

describe('execCommand — a child it cannot signal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps escalating, reports the timeout after the grace period and leaves no timer behind', async () => {
    const child = new UnkillableChild()
    vi.mocked(spawn).mockReturnValue(child as never)
    let settled = false
    const pending = execCommand(
      { cmd: '/usr/bin/sudo', args: [], env: {} },
      { cwd: '/', timeoutMs: 1000 },
    ).then((result) => {
      settled = true
      return result
    })

    await vi.advanceTimersByTimeAsync(1000)
    expect(child.signals).toEqual(['SIGTERM'])
    expect(settled).toBe(false) // a failed kill is not the end of the case

    await vi.advanceTimersByTimeAsync(1000)
    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL'])
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1000)
    const result = await pending
    expect(result).toMatchObject({ timedOut: true, exitCode: null })
    expect(vi.getTimerCount()).toBe(0)

    child.emit('close', null) // the sandbox fences end it later: nothing happens twice
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears every timer when the child closes after SIGTERM', async () => {
    const child = new UnkillableChild()
    child.kill = (signal: string) => {
      child.signals.push(signal)
      queueMicrotask(() => child.emit('close', null))
      return true
    }
    vi.mocked(spawn).mockReturnValue(child as never)
    const pending = execCommand(
      { cmd: '/usr/bin/sudo', args: [], env: {} },
      { cwd: '/', timeoutMs: 500 },
    )
    await vi.advanceTimersByTimeAsync(500)
    const result = await pending
    expect(result.timedOut).toBe(true)
    expect(child.signals).toEqual(['SIGTERM'])
    expect(vi.getTimerCount()).toBe(0)
  })
})
