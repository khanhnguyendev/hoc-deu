/**
 * `pnpm content:build [--check]` — exit 0 when the content builds and print the report (counts,
 * verification, week sizes, coverage, drafts; report.ts), 1 with every issue, 2 on a usage error or
 * a crash. Check mode also follows `CI` (see `isCheckMode`).
 */
import path from 'node:path'
import { buildContent, isCheckMode } from './build'

const USAGE = 'usage: pnpm content:build [--check]'

async function main(argv: readonly string[]): Promise<number> {
  const unknown = argv.filter((arg) => arg !== '--check')
  if (unknown.length > 0) {
    console.error(`content:build: unknown argument ${unknown.join(' ')}\n${USAGE}`)
    return 2
  }
  const result = await buildContent({
    repoRoot: path.resolve(import.meta.dirname, '../..'),
    check: isCheckMode(argv, process.env),
  })
  if (result.ok) console.log(result.report)
  else console.error(result.report)
  return result.ok ? 0 : 1
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    console.error('content:build crashed:', error)
    process.exitCode = 2
  },
)
