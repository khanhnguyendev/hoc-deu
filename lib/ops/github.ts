import { z } from 'zod'

/** The repository whose workflow runs are read — a constant, never taken from input. */
const REPOSITORY = 'khanhnguyendev/hoc-deu'
const WORKFLOW_FILES = ['backup.yml', 'restore-test.yml'] as const
export type WorkflowFile = (typeof WORKFLOW_FILES)[number]

/** A slow API must not hold the cron's function open. */
const TIMEOUT_MS = 10_000

const RunsSchema = z.object({
  workflow_runs: z.array(z.object({ updated_at: z.iso.datetime({ offset: true }) })),
})

/**
 * The latest successful run of `.github/workflows/<file>` on `main` (Part B-M5 decision 26), from
 * the public GitHub API with no token (60 requests an hour per address; the maintenance cron makes
 * two a day), or null: no successful run yet, a non-200 answer (rate limit, outage) or a body it
 * cannot read. A network error or the time limit rejects. Its `updated_at` is when the run
 * finished.
 */
export async function lastSuccessfulRun(
  file: WorkflowFile,
  fetchImpl: typeof fetch = fetch,
): Promise<Date | null> {
  if (!WORKFLOW_FILES.includes(file)) throw new Error('lastSuccessfulRun: unknown workflow file')
  const url = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${file}/runs?branch=main&status=success&per_page=1`
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'hoc-deu-maintenance',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (response.status !== 200) return null
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return null
  }
  const parsed = RunsSchema.safeParse(body)
  const updatedAt = parsed.success ? parsed.data.workflow_runs[0]?.updated_at : undefined
  return updatedAt === undefined ? null : new Date(updatedAt)
}
