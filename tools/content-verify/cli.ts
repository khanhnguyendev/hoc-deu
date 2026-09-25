/**
 * `pnpm content:verify [--problem <id>]… [--lang <python|java|go>] [--jobs <n>] [--root <dir>]`
 * (platform design §3.7): runs every solution against its `tests.yaml` and prints the report,
 * whose last line holds the counts.
 *
 * Exit codes: 0 everything verified · 1 a problem failed or a `tests.yaml` is invalid · 2 it cannot
 * run (bad arguments, a missing or too old toolchain, or GitHub Actions without a sandbox user —
 * CI fails closed, ADR-0012).
 */
import { mkdtempSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { CODE_LANGUAGES, type CodeLanguage } from '@/lib/content/schemas/common'
import { discoverProblems } from './discover'
import { verifyProblems } from './orchestrator'
import { formatReport } from './report'
import { assertSandboxPolicy, removeWorkRoot, workRootParent } from './sandbox'
import { resolveToolchains } from './toolchains'

const USAGE =
  'usage: pnpm content:verify [--problem <track:lc-NNNN>]… [--lang python|java|go] [--jobs <n>] [--root <tracks dir>]'

class UsageError extends Error {}

function parseOptions() {
  let values
  try {
    ;({ values } = parseArgs({
      options: {
        problem: { type: 'string', multiple: true },
        lang: { type: 'string' },
        jobs: { type: 'string' },
        root: { type: 'string' },
      },
      allowPositionals: false,
    }))
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }
  const lang = values.lang
  if (lang !== undefined && !CODE_LANGUAGES.some((known) => known === lang)) {
    throw new UsageError(`--lang must be one of ${CODE_LANGUAGES.join(', ')}`)
  }
  const jobs =
    values.jobs === undefined
      ? Math.max(1, Math.floor(availableParallelism() / 2))
      : Number(values.jobs)
  if (!Number.isInteger(jobs) || jobs < 1) {
    throw new UsageError('--jobs must be a positive integer')
  }
  return {
    ids: values.problem,
    lang: lang as CodeLanguage | undefined,
    jobs,
    root: resolve(values.root ?? join('content', 'tracks')),
  }
}

async function main(): Promise<number> {
  const sandbox = assertSandboxPolicy(process.env)
  const options = parseOptions()
  const languages = options.lang === undefined ? CODE_LANGUAGES : [options.lang]
  const toolchains = resolveToolchains(languages, sandbox)

  const { problems, issues } = discoverProblems(options.root, {
    ...(options.ids === undefined ? {} : { ids: options.ids }),
    ...(options.lang === undefined ? {} : { lang: options.lang }),
  })
  const jobs = sandbox === null ? options.jobs : 1
  const where = sandbox === null ? 'no sandbox' : `sandbox ${sandbox.user}`
  const header = `${toolchains.summary} · ${jobs} job${jobs === 1 ? '' : 's'} (${where})`

  const workRoot = mkdtempSync(join(workRootParent(sandbox), 'content-verify-'))
  try {
    const results = await verifyProblems(problems, {
      jobs,
      workRoot,
      sandbox,
      tools: toolchains.tools,
    })
    console.log(formatReport(results, header, issues))
    return results.every((result) => result.ok) && issues.length === 0 ? 0 : 1
  } finally {
    removeWorkRoot(sandbox, workRoot)
  }
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    console.error(`content:verify: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof UsageError) console.error(USAGE)
    process.exitCode = 2
  },
)
