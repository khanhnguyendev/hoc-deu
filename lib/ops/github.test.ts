import { describe, expect, it, vi } from 'vitest'
import { lastSuccessfulRun } from './github'

const RUNS_URL = (file: string) =>
  `https://api.github.com/repos/khanhnguyendev/hoc-deu/actions/workflows/${file}/runs?branch=main&status=success&per_page=1`

function fakeFetch(response: Response | (() => Promise<Response>)) {
  return vi.fn<typeof fetch>(async () =>
    typeof response === 'function' ? response() : response.clone(),
  )
}

const runs = (...updatedAt: string[]) =>
  Response.json({
    total_count: updatedAt.length,
    workflow_runs: updatedAt.map((at, index) => ({ id: index + 1, updated_at: at })),
  })

describe('lastSuccessfulRun (decision 26: the public GitHub API, once a day)', () => {
  it("parses the latest successful run's updated_at", async () => {
    const fetchImpl = fakeFetch(runs('2026-09-26T22:07:41Z', '2026-09-25T22:06:02Z'))
    const at = await lastSuccessfulRun('backup.yml', fetchImpl)
    expect(at).toEqual(new Date('2026-09-26T22:07:41Z'))
  })

  it.each(['backup.yml', 'restore-test.yml'] as const)(
    'asks only the fixed repository, main, successful runs, one per page (%s)',
    async (file) => {
      const fetchImpl = fakeFetch(runs('2026-09-26T22:07:41Z'))
      await lastSuccessfulRun(file, fetchImpl)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      const [url, init] = fetchImpl.mock.calls[0] ?? []
      expect(url).toBe(RUNS_URL(file))
      // Public API, no token.
      const headers = new Headers(init?.headers)
      expect(headers.has('authorization')).toBe(false)
      expect(headers.get('accept')).toBe('application/vnd.github+json')
      expect(init?.cache).toBe('no-store')
    },
  )

  it('never builds a URL from an unexpected file name', async () => {
    const fetchImpl = fakeFetch(runs('2026-09-26T22:07:41Z'))
    for (const file of ['../../../other/repo', 'backup.yml?x=1', 'ci.yml']) {
      await expect(lastSuccessfulRun(file as 'backup.yml', fetchImpl)).rejects.toThrow()
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([403, 404, 500])('returns null for a %i', async (status) => {
    const fetchImpl = fakeFetch(Response.json({ message: 'nope' }, { status }))
    expect(await lastSuccessfulRun('backup.yml', fetchImpl)).toBeNull()
  })

  it('returns null when the workflow has no successful run yet', async () => {
    expect(await lastSuccessfulRun('restore-test.yml', fakeFetch(runs()))).toBeNull()
  })

  it.each([
    ['not JSON', new Response('<html>', { status: 200 })],
    ['no workflow_runs', Response.json({ total_count: 0 })],
    ['an invalid date', runs('yesterday')],
  ])('returns null for an unexpected body: %s', async (_, response) => {
    expect(await lastSuccessfulRun('backup.yml', fakeFetch(response))).toBeNull()
  })

  it('lets a network error through (the caller counts the step as failed)', async () => {
    const fetchImpl = fakeFetch(() => Promise.reject(new TypeError('fetch failed')))
    await expect(lastSuccessfulRun('backup.yml', fetchImpl)).rejects.toThrow('fetch failed')
  })
})
