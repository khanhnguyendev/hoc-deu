import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The rule task 5.1c wrote into `app/(app)/not-found.tsx`: a route that can answer 404 (`/t/**`)
 * has no `loading.tsx` on its own segment or above it inside `(app)` — a `loading.tsx` there wraps
 * the page in a Suspense boundary, so the response starts streaming (200) before `notFound()` ever
 * runs. Pins the group-level file's removal and guards against a stray `loading.tsx` creeping back
 * under `/t/**`.
 */
function findLoadingFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return findLoadingFiles(path)
    return name === 'loading.tsx' ? [path] : []
  })
}

describe('the (app) group has no loading.tsx that would stream a 404 as 200 (task 5.1c)', () => {
  it('has no group-level app/(app)/loading.tsx', () => {
    expect(
      existsSync('app/(app)/loading.tsx'),
      'app/(app)/loading.tsx would wrap /t/** in Suspense again, streaming a 200 before ' +
        'notFound() runs — see the rule in app/(app)/not-found.tsx',
    ).toBe(false)
  })

  it('has no loading.tsx anywhere under app/(app)/t/', () => {
    expect(
      findLoadingFiles('app/(app)/t'),
      'a loading.tsx under app/(app)/t/** would make notFound() stream a 200 before it runs — ' +
        'see the rule in app/(app)/not-found.tsx',
    ).toEqual([])
  })
})
