import { z } from 'zod'

/** The repository whose workflow runs are read — a constant, never taken from input. */
const REPOSITORY = 'khanhnguyendev/hoc-deu'
const WORKFLOW_FILES = ['backup.yml', 'restore-test.yml'] as const
export type WorkflowFile = (typeof WORKFLOW_FILES)[number]

/** Only runs its schedule or a person with write access started (ADR-0005). */
const TRUSTED_EVENTS: readonly string[] = ['schedule', 'workflow_dispatch']
/** Enough to look past a burst of untrusted runs; still one request. */
const PER_PAGE = 50

/** A slow API must not hold the cron's function open. */
const TIMEOUT_MS = 10_000

const RunsSchema = z.object({ workflow_runs: z.array(z.unknown()) })
const RunSchema = z.object({
  updated_at: z.iso.datetime({ offset: true }),
  event: z.string(),
  head_branch: z.string().nullable(),
  head_repository: z.object({ full_name: z.string() }).nullable(),
})

/**
 * The latest successful run of `.github/workflows/<file>` on `main` (Part B-M5 decision 26), from
 * the public GitHub API with no token (60 requests an hour per address; the maintenance cron makes
 * two a day), or null: no trusted successful run yet, a non-200 answer (rate limit, outage) or a
 * body it cannot read. A network error or the time limit rejects. Its `updated_at` is when the run
 * finished.
 *
 * Only a run of this repository, on `main`, started by its schedule or by hand is trusted: `branch=
 * main` matches a fork's pull request from the fork's own `main` too, and such a pull request can
 * add a `pull_request` trigger to the workflow (ADR-0005) — it must never refresh /admin's backup
 * age. Runs it cannot read are skipped.
 */
export async function lastSuccessfulRun(
  file: WorkflowFile,
  fetchImpl: typeof fetch = fetch,
): Promise<Date | null> {
  if (!WORKFLOW_FILES.includes(file)) throw new Error('lastSuccessfulRun: unknown workflow file')
  const url = `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${file}/runs?branch=main&status=success&per_page=${PER_PAGE}`
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
  if (!parsed.success) return null
  // Newest first: the first trusted run is the latest.
  for (const raw of parsed.data.workflow_runs) {
    const run = RunSchema.safeParse(raw)
    if (!run.success) continue
    const { event, head_branch: branch, head_repository: repository, updated_at } = run.data
    if (
      TRUSTED_EVENTS.includes(event) &&
      branch === 'main' &&
      repository?.full_name === REPOSITORY
    ) {
      return new Date(updated_at)
    }
  }
  return null
}
