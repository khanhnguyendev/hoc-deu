import { describe, expect, it, vi } from 'vitest'
import { pendingPublishTargets } from './publish-requests'

type Rpc = (name: string) => Promise<{ data: unknown; error: { message: string } | null }>
/** A client whose `rpc(name)` resolves through `.abortSignal()`, as PostgREST's builder does. */
const client = (rpc: Rpc) =>
  ({
    rpc: vi.fn((name: string) => ({ abortSignal: () => rpc(name) })),
  }) as unknown as Parameters<typeof pendingPublishTargets>[0]

describe('pendingPublishTargets (publish_request_targets, the publishable key)', () => {
  it('calls publish_request_targets() and returns the targets', async () => {
    const fake = client(async () => ({ data: ['dsa:lc-0049#note'], error: null }))
    expect(await pendingPublishTargets(fake)).toEqual(['dsa:lc-0049#note'])
    expect((fake as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      'publish_request_targets',
    )
  })

  it('drops anything that is not a target string', async () => {
    const fake = client(async () => ({
      data: ['dsa:lc-0001', 42, null, 'Not a target', 'english:ex-w01-fill-1'],
      error: null,
    }))
    expect(await pendingPublishTargets(fake)).toEqual(['dsa:lc-0001', 'english:ex-w01-fill-1'])
  })

  it('throws on a database error', async () => {
    const fake = client(async () => ({ data: null, error: { message: 'boom' } }))
    await expect(pendingPublishTargets(fake)).rejects.toThrow('publish request targets')
  })
})
