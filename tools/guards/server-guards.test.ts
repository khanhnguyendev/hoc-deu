import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUARD_NAMES } from '@/lib/auth/guards'
import { guardViolations } from './server-guards'

const ACTIONS = 'features/x/actions.ts'
const ROUTE = 'app/api/x/route.ts'
const QUERIES = 'features/x/queries.ts'

describe('guardViolations — server actions', () => {
  it('accepts a guarded action', () => {
    const source = `'use server'
import { requireActive } from '@/lib/auth/dal'
export async function save(form: FormData) {
  const user = await requireActive()
  return { user, form }
}`
    expect(guardViolations(ACTIONS, source)).toEqual([])
  })

  it('flags an unguarded action', () => {
    const source = `'use server'
export async function save(form: FormData) {
  return form.get('x')
}`
    expect(guardViolations(ACTIONS, source)).toHaveLength(1)
  })

  it('flags a guard that is not the first statement', () => {
    const source = `'use server'
import { requireUser } from '@/lib/auth/dal'
export async function save(form: FormData) {
  const x = form.get('x')
  await requireUser()
  return x
}`
    expect(guardViolations(ACTIONS, source)).toHaveLength(1)
  })

  it('checks exported arrow and function expressions', () => {
    const source = `'use server'
import { requireUser } from '@/lib/auth/dal'
export const a = async () => {
  await requireUser()
}
export const b = async () => {
  return 1
}
export const c = async function () {
  return 2
}
export const d = async () => requireUser()
export const e = async () => 3`
    const violations = guardViolations(ACTIONS, source)
    expect(violations).toHaveLength(3)
    expect(violations.join('\n')).toMatch(/\bb\b[\s\S]*\bc\b[\s\S]*\be\b/)
  })

  it('ignores a non-exported helper', () => {
    const source = `'use server'
import { requireUser } from '@/lib/auth/dal'
async function helper() {
  return 1
}
export async function save() {
  await requireUser()
  return helper()
}`
    expect(guardViolations(ACTIONS, source)).toEqual([])
  })

  it('checks default exports and export lists', () => {
    const source = `'use server'
async function hidden() {
  return 1
}
export default async function () {
  return 2
}
export { hidden as visible }`
    expect(guardViolations(ACTIONS, source)).toHaveLength(2)
  })

  it('flags re-exports and wrapped exports it cannot check', () => {
    const source = `'use server'
import { wrap } from './wrap'
export { save } from './other'
export * from './more'
export const wrapped = wrap(async () => 1)`
    expect(guardViolations(ACTIONS, source)).toHaveLength(3)
  })

  it('ignores type-only exports and follows local aliases', () => {
    const source = `'use server'
import { requireUser } from '@/lib/auth/dal'
export type { Result } from './types'
export type Input = { x: string }
async function guarded() {
  await requireUser()
}
export const save = guarded`
    expect(guardViolations(ACTIONS, source)).toEqual([])
  })

  it('ignores modules without the directive at the top', () => {
    const source = `import x from 'y'
'use server'
export async function helper() {
  return x
}`
    expect(guardViolations('lib/x.ts', source)).toEqual([])
  })

  it('checks inline server actions in any module', () => {
    const source = `import { requireUser } from '@/lib/auth/dal'
export default function Page() {
  async function guarded() {
    'use server'
    await requireUser()
  }
  async function open() {
    'use server'
    return 1
  }
  return [guarded, open]
}`
    const violations = guardViolations('app/(app)/x/page.tsx', source)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('open')
  })
})

describe('guardViolations — route handlers', () => {
  it('flags a handler without a guard', () => {
    const source = `export async function GET() {
  return Response.json({ ok: true })
}`
    expect(guardViolations(ROUTE, source)).toHaveLength(1)
  })

  it('accepts publicRoute() and other guards', () => {
    const source = `import { publicRoute } from '@/lib/auth/guards'
import { requireCronSecret } from '@/lib/auth/cron'
export async function GET() {
  publicRoute()
  return Response.json({ ok: true })
}
export const POST = async (request: Request) => {
  await requireCronSecret(request)
  return Response.json({ ok: true })
}`
    expect(guardViolations(ROUTE, source)).toEqual([])
  })

  it('checks every HTTP method and only those', () => {
    const source = `export const dynamic = 'force-dynamic'
export function helper() {
  return 1
}
${['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
  .map((method) => `export async function ${method}() {\n  return new Response(null)\n}`)
  .join('\n')}`
    expect(guardViolations('app/auth/callback/route.ts', source)).toHaveLength(7)
  })

  it('checks a handler exported under a method name', () => {
    const source = `async function handler() {
  return new Response(null)
}
export { handler as GET }`
    expect(guardViolations(ROUTE, source)).toHaveLength(1)
  })

  it('ignores the same exports outside app/**/route.ts', () => {
    const source = `export async function GET() {
  return new Response(null)
}`
    expect(guardViolations('lib/http/route.ts', source)).toEqual([])
    expect(guardViolations('app/api/x/handler.ts', source)).toEqual([])
  })
})

describe('guardViolations — feature loaders', () => {
  it('flags a loader without a guard as its first statement', () => {
    const source = `import 'server-only'
import { createClient } from '@/lib/supabase/server'
export async function loadToday() {
  const supabase = await createClient()
  return supabase.from('day_plans').select()
}`
    expect(guardViolations(QUERIES, source)).toHaveLength(1)
  })

  it('accepts guarded loaders, including cache()-wrapped ones, and ignores sync helpers', () => {
    const source = `import 'server-only'
import { cache } from 'react'
import { requireOnboarded } from '@/lib/auth/dal'
export async function loadToday() {
  const user = await requireOnboarded()
  return user
}
export const loadTracks = cache(async () => {
  const { id } = await requireOnboarded()
  return id
})
export function label(x: string) {
  return x
}`
    expect(guardViolations(QUERIES, source)).toEqual([])
  })

  it('flags an unguarded cache()-wrapped loader', () => {
    const source = `import { cache } from 'react'
export const loadTracks = cache(async () => {
  return []
})`
    expect(guardViolations(QUERIES, source)).toHaveLength(1)
  })

  it('only treats features/<name>/queries.ts as a loader module', () => {
    const source = `export async function load() {
  return 1
}`
    expect(guardViolations('features/x/lib/queries.ts', source)).toEqual([])
    expect(guardViolations('lib/queries.ts', source)).toEqual([])
  })
})

describe('GUARD_NAMES', () => {
  it('lists every guard (CLAUDE.md, decision 10)', () => {
    expect([...GUARD_NAMES].sort()).toEqual(
      [
        'requireUser',
        'requireActive',
        'requireOnboarded',
        'requireAdmin',
        'requireDevAccess',
        'requireBotToken',
        'requireCronSecret',
        'publicRoute',
      ].sort(),
    )
  })
})

describe('the real source tree', () => {
  it('has no unguarded server actions, route handlers or feature loaders', () => {
    const root = process.cwd()
    const violations: string[] = []
    let scanned = 0
    for (const dir of ['app', 'features', 'lib', 'components']) {
      let entries: string[]
      try {
        entries = readdirSync(join(root, dir), { recursive: true, encoding: 'utf8' })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!/\.tsx?$/.test(entry) || entry.split(sep).includes('node_modules')) continue
        const file = `${dir}/${entry.split(sep).join('/')}`
        violations.push(...guardViolations(file, readFileSync(join(root, file), 'utf8')))
        scanned += 1
      }
    }
    expect(scanned).toBeGreaterThan(50)
    expect(violations).toEqual([])
  })
})
