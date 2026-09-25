/**
 * `pnpm sim:projections` (platform design §5.11, §7.9; ADR-0014, ADR-0037): regenerates the
 * simulated-finish table the onboarding and settings screens show. For DSA variants 8w and 10w ×
 * budgets 45, 60, 75, 90, 120 it runs 200 realistic learners (seeds 0…199) for 182 days on the
 * planned content, and writes `lib/domain/plan/projections.generated.json` (the table, keyed by
 * the projection inputs hash) and `lib/domain/plan/sim-inputs.generated.json` (the inputs, which
 * the simulation tests read). A run that does not finish within 182 days is rerun for 364 days;
 * one that still does not finish exits 1 and writes nothing.
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { CATALOG } from '@/.generated/catalog'
import { RULES_VERSION } from '@/lib/domain/rules'
import { inputsHash, SIM_TRACK_ID, simInputs } from './inputs'
import { projectionRow, type TableRow } from './table'

const VARIANTS = ['8w', '10w'] as const
const BUDGETS = [45, 60, 75, 90, 120] as const
const RUNS = 200
const DAYS = 182
const RERUN_DAYS = 364

const REPO = path.resolve(import.meta.dirname, '../..')
const OUT_DIR = path.join(REPO, 'lib/domain/plan')

function main(): number {
  const inputs = simInputs(CATALOG)
  const table: Record<string, TableRow[]> = {}
  let failed = false

  for (const variant of VARIANTS) {
    if (inputs.roadmaps[variant] === undefined) {
      console.error(`sim:projections: no ${SIM_TRACK_ID} roadmap "${variant}"`)
      return 1
    }
    const rows: TableRow[] = []
    for (const budget of BUDGETS) {
      const started = performance.now()
      const result = projectionRow(inputs, variant, budget, {
        runs: RUNS,
        days: DAYS,
        rerunDays: RERUN_DAYS,
      })
      const seconds = ((performance.now() - started) / 1000).toFixed(1)
      const scenario = `${SIM_TRACK_ID} ${variant} @ ${budget} min`
      if (result.row === null) {
        failed = true
        console.error(
          `${scenario}: seeds ${result.unfinished.join(', ')} do not finish within ${RERUN_DAYS} days`,
        )
        continue
      }
      rows.push(result.row)
      const reruns = result.reruns > 0 ? `, ${result.reruns} rerun for ${RERUN_DAYS} days` : ''
      console.log(
        `${scenario}: median ${result.row[1]} weeks, p90 ${result.row[2]} (${RUNS} runs${reruns}, ${seconds} s)`,
      )
    }
    table[variant] = rows
  }
  if (failed) return 1

  const hash = inputsHash(inputs)
  const projections = {
    inputsHash: hash,
    rulesVersion: RULES_VERSION,
    runs: RUNS,
    days: DAYS,
    table: { [SIM_TRACK_ID]: table },
  }
  writeFileSync(
    path.join(OUT_DIR, 'projections.generated.json'),
    `${JSON.stringify(projections, null, 2)}\n`,
  )
  writeFileSync(
    path.join(OUT_DIR, 'sim-inputs.generated.json'),
    `${JSON.stringify(inputs, null, 2)}\n`,
  )
  console.log(`sim:projections: wrote the table and its inputs (hash ${hash.slice(0, 12)}…)`)
  return 0
}

try {
  process.exitCode = main()
} catch (error: unknown) {
  console.error('sim:projections crashed:', error)
  process.exitCode = 2
}
