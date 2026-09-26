/**
 * `pnpm typecheck` and `pnpm test` read `.generated/` (the catalog, MDX and code maps), so on a
 * clean checkout they build the content first (final review M2) — and `pnpm verify` still builds it
 * only once.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO = path.resolve(import.meta.dirname, '../..')
const { scripts } = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}

const BUILD = 'pnpm content:build'

/** A script with every `pnpm <script>` step replaced by that script's own steps. */
function expand(name: string): string[] {
  return (scripts[name] ?? '').split(' && ').flatMap((step) => {
    const called = /^pnpm (\S+)$/.exec(step)?.[1]
    return called !== undefined && called !== 'content:build' && called in scripts
      ? expand(called)
      : [step]
  })
}

describe('package scripts', () => {
  it.each(['typecheck', 'test', 'dev', 'build', 'test:e2e'])(
    '%s builds the content first (a clean checkout has no .generated/)',
    (name) => {
      expect(expand(name)[0]).toBe(BUILD)
    },
  )

  it('verify builds the content once, before the typecheck, and runs every check', () => {
    const steps = expand('verify')
    expect(steps.filter((step) => step === BUILD)).toHaveLength(1)
    expect(steps[0]).toBe(BUILD)
    expect(steps).toEqual([
      BUILD,
      'next typegen',
      'tsc --noEmit',
      'eslint . --max-warnings=0',
      'prettier --check .',
      'vitest run',
      'next build',
    ])
  })

  it('test:sim runs the full §5.10 simulation (200 seeds; CI job sim), which pnpm test reduces', () => {
    expect(scripts['test:sim']).toBe('SIM_FULL=1 vitest run lib/domain/plan/__tests__/simulation')
  })

  it('verify:full runs verify, test:sim, test:db and test:e2e', () => {
    expect(scripts['verify:full']?.split(' && ')).toEqual([
      'pnpm verify',
      'pnpm test:sim',
      'pnpm test:db',
      'pnpm test:e2e',
    ])
  })
})
