import { readdirSync, readFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUARD_NAMES, SYNC_GUARD_NAMES } from '@/lib/auth/guards'
import { guardViolations, supabaseClientViolations } from './server-guards'

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
export const d = async () => await requireUser()
export const e = async () => 3`
    const violations = guardViolations(ACTIONS, source)
    expect(violations).toHaveLength(3)
    expect(violations.join('\n')).toMatch(/\bb\b[\s\S]*\bc\b[\s\S]*\be\b/)
  })

  it('requires await for an async guard (fix round 1, controller ruling)', () => {
    const source = `'use server'
import { requireActive } from '@/lib/auth/dal'
export async function bare() {
  requireActive()
  await write()
}
export async function assigned() {
  const user = requireActive()
  return user
}
export const returned = async () => requireActive()
export async function awaited() {
  const user = await requireActive()
  return user
}`
    const flagged = guardViolations(ACTIONS, source).map((v) => /`(\w+)`/.exec(v)?.[1])
    expect(flagged).toEqual(['bare', 'assigned', 'returned'])
  })

  it('accepts `return await requireX()` as the first statement (M2 carry-over)', () => {
    const source = `'use server'
import { requireAdmin } from '@/lib/auth/dal'
export async function whoAmI() {
  return await requireAdmin()
}
export async function parenthesised() {
  return (await requireAdmin())
}`
    expect(guardViolations(ACTIONS, source)).toEqual([])
  })

  it('accepts a parenthesised `(await requireX())`, alone or read from', () => {
    const source = `'use server'
import { requireActive, requireUser } from '@/lib/auth/dal'
export async function statement() {
  ;(await requireUser())
  return 1
}
export async function assigned() {
  const user = (await requireActive())
  return user
}
export async function readFrom() {
  const id = (await requireActive()).id
  return id
}
export async function innerParens() {
  const user = await (requireActive())
  return user
}
export const arrow = async () => (await requireUser()).email`
    expect(guardViolations(ACTIONS, source)).toEqual([])
  })

  it('still flags an un-awaited guard, returned or parenthesised', () => {
    const source = `'use server'
import { requireActive } from '@/lib/auth/dal'
export async function returned() {
  return requireActive()
}
export async function parenthesised() {
  const user = (requireActive())
  return user
}
export async function readFromPromise() {
  const id = (requireActive() as unknown as { id: string }).id
  return id
}
export async function notAGuard() {
  return await write()
}`
    const flagged = guardViolations(ACTIONS, source).map((v) => /`(\w+)`/.exec(v)?.[1])
    expect(flagged).toEqual(['returned', 'parenthesised', 'readFromPromise', 'notAGuard'])
  })

  it("finds 'use server' anywhere in the directive prologue", () => {
    const source = `'use strict'
'use server'
export async function save() {
  return 1
}`
    expect(guardViolations(ACTIONS, source)).toHaveLength(1)
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

  it('only unwraps cache() imported from react', () => {
    const source = `import { cache } from './not-react'
import { publicRoute } from '@/lib/auth/guards'
export const GET = cache(async () => {
  publicRoute()
  return new Response(null)
})`
    expect(guardViolations(ROUTE, source)).toHaveLength(1)
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

  it.each([
    [
      'React.cache',
      `import React from 'react'
export const loadX = React.cache(async () => {
  return 1
})`,
    ],
    [
      'an aliased cache',
      `import { cache as memo } from 'react'
export const loadX = memo(async () => {
  return 1
})`,
    ],
    [
      'unstable_cache',
      `import { unstable_cache } from 'next/cache'
export const loadX = unstable_cache(async () => {
  return 1
})`,
    ],
    [
      'a guarded function inside a wrapper the check cannot see into',
      `import { requireUser } from '@/lib/auth/dal'
import { memoize } from './memoize'
export const loadX = memoize(async () => {
  await requireUser()
})`,
    ],
    [
      'an imported name',
      `import { impl } from './impl'
export const loadX = impl`,
    ],
    [
      'an imported name in an export list',
      `import { impl } from './impl'
export { impl as loadX }`,
    ],
    [
      'a local const holding an opaque value',
      `import { build } from './build'
const impl = build()
export const loadX = impl
export { impl as loadY }`,
    ],
  ])('flags a loader it cannot see into: %s', (_, source) => {
    expect(guardViolations(QUERIES, source).length).toBeGreaterThanOrEqual(1)
  })

  it('ignores plain values and follows local cache() loaders', () => {
    const source = `import { cache } from 'react'
import { requireUser } from '@/lib/auth/dal'
export const PAGE_SIZE = 20
export const LABELS = { a: 'x' }
const impl = cache(async () => {
  await requireUser()
})
export const loadX = impl
export { impl as loadY, PAGE_SIZE as SIZE }`
    expect(guardViolations(QUERIES, source)).toEqual([])
  })

  it('only treats features/<name>/queries.ts as a loader module', () => {
    const source = `export async function load() {
  return 1
}`
    expect(guardViolations('features/x/lib/queries.ts', source)).toEqual([])
    expect(guardViolations('lib/queries.ts', source)).toEqual([])
  })
})

describe('supabaseClientViolations (M2 carry-over: only queries.ts / actions.ts create clients)', () => {
  const IMPORT_SERVER = `import { createClient } from '@/lib/supabase/server'
export async function read() {
  return (await createClient()).from('x').select()
}`

  it('flags a feature module other than queries.ts / actions.ts importing a client module', () => {
    const violations = supabaseClientViolations('features/settings/reads.ts', IMPORT_SERVER)
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatch(/features\/settings\/reads\.ts.*lib\/supabase\/server/)
    expect(
      supabaseClientViolations(
        'features/x/components/row.tsx',
        `import { createAdminClient } from '@/lib/supabase/admin'`,
      ),
    ).toHaveLength(1)
  })

  it('resolves relative paths and dynamic imports', () => {
    expect(
      supabaseClientViolations(
        'features/x/lib/load.ts',
        `import { createAdminClient } from '../../../lib/supabase/admin'`,
      ),
    ).toHaveLength(1)
    expect(
      supabaseClientViolations(
        'features/x/helpers.ts',
        `export async function f() { return import('@/lib/supabase/server') }`,
      ),
    ).toHaveLength(1)
    expect(
      supabaseClientViolations('features/x/helpers.ts', `import x from '@/lib/supabase/server.ts'`),
    ).toHaveLength(1)
  })

  it('allows queries.ts and actions.ts at the top of a feature, and type-only imports anywhere', () => {
    expect(supabaseClientViolations('features/x/queries.ts', IMPORT_SERVER)).toEqual([])
    expect(supabaseClientViolations('features/x/actions.ts', IMPORT_SERVER)).toEqual([])
    const typeOnly = `import type { Client } from '@/lib/supabase/server'
import { type Admin } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'`
    expect(supabaseClientViolations('features/x/reads.ts', typeOnly)).toEqual([])
  })

  it('only top-level queries.ts / actions.ts are exempt', () => {
    expect(supabaseClientViolations('features/x/lib/queries.ts', IMPORT_SERVER)).toHaveLength(1)
  })

  it('flags any re-export of a client module — from index.ts or even queries.ts', () => {
    const index = supabaseClientViolations(
      'features/x/index.ts',
      `export { createClient } from '@/lib/supabase/server'
export * from '@/lib/supabase/admin'`,
    )
    expect(index).toHaveLength(2)
    expect(index.join('\n')).toMatch(/re-export/)
    expect(
      supabaseClientViolations(
        'features/x/queries.ts',
        `export { createClient } from '@/lib/supabase/server'`,
      ),
    ).toHaveLength(1)
    expect(
      supabaseClientViolations(
        'features/x/index.ts',
        `export type { Client } from '@/lib/supabase/server'`,
      ),
    ).toEqual([])
  })

  it('ignores modules outside features/ and test files', () => {
    expect(supabaseClientViolations('lib/auth/dal.ts', IMPORT_SERVER)).toEqual([])
    expect(supabaseClientViolations('app/(public)/auth/callback/route.ts', IMPORT_SERVER)).toEqual(
      [],
    )
    expect(supabaseClientViolations('features/x/reads.test.ts', IMPORT_SERVER)).toEqual([])
  })

  it('ignores other lib/supabase modules', () => {
    expect(
      supabaseClientViolations(
        'features/x/reads.ts',
        `import { something } from '@/lib/supabase/proxy'`,
      ),
    ).toEqual([])
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

describe('SYNC_GUARD_NAMES', () => {
  it('lists the guards that may be called without await: only publicRoute today', () => {
    expect([...SYNC_GUARD_NAMES]).toEqual(['publicRoute'])
    for (const name of SYNC_GUARD_NAMES) expect(GUARD_NAMES).toContain(name)
  })
})

describe('the real source tree', () => {
  it('has no unguarded server actions, route handlers or loaders, nor stray client imports', () => {
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
        const source = readFileSync(join(root, file), 'utf8')
        violations.push(...guardViolations(file, source), ...supabaseClientViolations(file, source))
        scanned += 1
      }
    }
    expect(scanned).toBeGreaterThan(50)
    expect(violations).toEqual([])
  })
})
