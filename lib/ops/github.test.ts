import { describe, expect, it, vi } from 'vitest'
import { lastSuccessfulRun } from './github'

const RUNS_URL = (file: string) =>
  `https://api.github.com/repos/khanhnguyendev/hoc-deu/actions/workflows/${file}/runs?branch=main&status=success&per_page=50`

function fakeFetch(response: Response | (() => Promise<Response>)) {
  return vi.fn<typeof fetch>(async () =>
    typeof response === 'function' ? response() : response.clone(),
  )
}

type Run = {
  updated_at: string
  event: string
  head_branch: string | null
  head_repository: { full_name: string } | null
}

/** A run of this repository's own workflow on main, started by its schedule (or by hand). */
const trusted = (updatedAt: string, event = 'schedule'): Run => ({
  updated_at: updatedAt,
  event,
  head_branch: 'main',
  head_repository: { full_name: 'khanhnguyendev/hoc-deu' },
})

/** The API's answer, newest run first. */
const runs = (...list: (Run | string)[]) =>
  Response.json({
    total_count: list.length,
    workflow_runs: list.map((run, index) => ({
      id: index + 1,
      ...(typeof run === 'string' ? trusted(run) : run),
    })),
  })

describe('lastSuccessfulRun (decision 26: the public GitHub API, once a day)', () => {
  it("parses the latest successful run's updated_at", async () => {
    const fetchImpl = fakeFetch(runs('2026-09-26T22:07:41Z', '2026-09-25T22:06:02Z'))
    const at = await lastSuccessfulRun('backup.yml', fetchImpl)
    expect(at).toEqual(new Date('2026-09-26T22:07:41Z'))
  })

  it.each(['backup.yml', 'restore-test.yml'] as const)(
    'asks only the fixed repository, main, successful runs, 50 per page (%s)',
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

  it('skips a newer pull_request run from a fork’s main and returns the older scheduled run', async () => {
    // A fork PR from its own `main` that adds a pull_request trigger to backup.yml shows up in
    // this list with head_branch "main": it must never refresh /admin's backup age.
    const fetchImpl = fakeFetch(
      runs(
        {
          ...trusted('2026-09-27T09:00:00Z'),
          event: 'pull_request',
          head_repository: { full_name: 'evil/hoc-deu' },
        },
        trusted('2026-09-26T22:07:41Z'),
      ),
    )
    expect(await lastSuccessfulRun('backup.yml', fetchImpl)).toEqual(
      new Date('2026-09-26T22:07:41Z'),
    )
  })

  it('trusts a run started by hand (workflow_dispatch)', async () => {
    const fetchImpl = fakeFetch(runs(trusted('2026-09-26T08:00:00Z', 'workflow_dispatch')))
    expect(await lastSuccessfulRun('restore-test.yml', fetchImpl)).toEqual(
      new Date('2026-09-26T08:00:00Z'),
    )
  })

  it('returns null when every run is untrusted', async () => {
    const at = '2026-09-27T09:00:00Z'
    const fetchImpl = fakeFetch(
      runs(
        { ...trusted(at), event: 'pull_request' },
        { ...trusted(at), event: 'push' },
        { ...trusted(at), head_repository: { full_name: 'evil/hoc-deu' } },
        { ...trusted(at), head_repository: null },
        { ...trusted(at), head_branch: 'feature' },
        { ...trusted(at), head_branch: null },
      ),
    )
    expect(await lastSuccessfulRun('backup.yml', fetchImpl)).toBeNull()
  })

  it('skips a run it cannot read and keeps looking', async () => {
    const noEvent = Object.fromEntries(
      Object.entries(trusted('2026-09-27T09:00:00Z')).filter(([key]) => key !== 'event'),
    ) as Run
    const fetchImpl = fakeFetch(runs(noEvent, trusted('2026-09-26T22:07:41Z')))
    expect(await lastSuccessfulRun('backup.yml', fetchImpl)).toEqual(
      new Date('2026-09-26T22:07:41Z'),
    )
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
