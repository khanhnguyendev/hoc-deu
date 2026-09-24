import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { purityViolations } from './domain-purity'

describe('purityViolations', () => {
  it('flags an import from outside lib/domain and zod', () => {
    expect(
      purityViolations('lib/domain/time/localDay.ts', "import { z } from 'date-fns'"),
    ).toHaveLength(1)
  })

  it('flags a node: import', () => {
    expect(
      purityViolations('lib/domain/time/localDay.ts', "import { readFileSync } from 'node:fs'"),
    ).toHaveLength(1)
  })

  it('flags a .tsx file', () => {
    expect(purityViolations('lib/domain/time/localDay.tsx', 'export const x = 1')).toHaveLength(1)
  })

  it('flags Date.now()', () => {
    expect(purityViolations('lib/domain/time/localDay.ts', 'const t = Date.now()')).toHaveLength(1)
  })

  it('flags Date() called without new', () => {
    expect(purityViolations('lib/domain/time/localDay.ts', 'const t = Date()')).toHaveLength(1)
  })

  it('flags an argument-less new Date()', () => {
    expect(purityViolations('lib/domain/time/localDay.ts', 'const t = new Date()')).toHaveLength(1)
  })

  it('flags a local-time getter', () => {
    expect(
      purityViolations('lib/domain/time/localDay.ts', 'const h = someDate.getHours()'),
    ).toHaveLength(1)
  })

  it('flags a local-time setter', () => {
    expect(purityViolations('lib/domain/time/localDay.ts', 'someDate.setHours(4)')).toHaveLength(1)
  })

  it('flags toLocaleDateString', () => {
    expect(
      purityViolations('lib/domain/time/localDay.ts', 'const s = someDate.toLocaleDateString()'),
    ).toHaveLength(1)
  })

  it('flags performance.now()', () => {
    expect(
      purityViolations('lib/domain/time/localDay.ts', 'const t = performance.now()'),
    ).toHaveLength(1)
  })

  it('flags Math.random()', () => {
    expect(purityViolations('lib/domain/time/localDay.ts', 'const r = Math.random()')).toHaveLength(
      1,
    )
  })

  it('flags fetch()', () => {
    expect(
      purityViolations('lib/domain/time/localDay.ts', "const r = fetch('https://x')"),
    ).toHaveLength(1)
  })

  it('accepts a clean snippet', () => {
    const source = `
      import { z } from 'zod'
      import { addDays } from '@/lib/domain/time/localDay'
      import { helper } from './helper'

      export function f(now: Date): number {
        return now.getTime()
      }
    `
    expect(purityViolations('lib/domain/time/localDay.ts', source)).toHaveLength(0)
  })

  it('allows vitest and fast-check imports in a test file, but not in a source file', () => {
    expect(
      purityViolations('lib/domain/time/localDay.test.ts', "import { it } from 'vitest'"),
    ).toHaveLength(0)
    expect(
      purityViolations('lib/domain/time/localDay.ts', "import { it } from 'vitest'"),
    ).toHaveLength(1)
  })
})

describe('the real lib/domain tree', () => {
  it('has no purity violations', () => {
    const root = process.cwd()
    const violations: string[] = []
    let files: string[]
    try {
      files = readdirSync(join(root, 'lib/domain'), { recursive: true, encoding: 'utf8' })
    } catch {
      files = []
    }
    for (const entry of files) {
      if (!/\.tsx?$/.test(entry)) continue
      const file = `lib/domain/${entry.split(sep).join('/')}`
      const source = readFileSync(join(root, file), 'utf8')
      violations.push(...purityViolations(file, source))
    }
    expect(violations).toEqual([])
  })
})
