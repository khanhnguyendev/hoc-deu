/**
 * The module stand-ins the `lib/plans` entry-point tests install with `vi.mock` (task 5.1a): the
 * session user, the session and secret-key clients (one fake, two labels — `session`, `admin`),
 * the engine catalog, and an optional stub of `buildPlan`'s result. Each test file gets its own
 * copy of this module (Vitest isolates files); `resetEnv` starts a test from empty tables.
 */
import { CATALOG } from '@/lib/domain/plan/__tests__/fixtures'
import type { DayPlan } from '@/lib/domain/plan/types'
import { createFakeSupabase, type FakeRows, type FakeSupabase } from '@/lib/testing/fake-supabase'
import { USER_ID } from './fixtures'

export const env: {
  sessionUserId: string | null
  fake: FakeSupabase
  /** Replaces `buildPlan`'s result (a stubbed engine), when set. */
  stubPlan: ((plan: DayPlan) => DayPlan) | null
} = { sessionUserId: USER_ID, fake: createFakeSupabase(), stubPlan: null }

export function resetEnv(rows: FakeRows = {}): FakeSupabase {
  env.sessionUserId = USER_ID
  env.fake = createFakeSupabase(rows)
  env.stubPlan = null
  return env.fake
}

export const dalMock = {
  getSessionUser: async () => (env.sessionUserId === null ? null : { id: env.sessionUserId }),
}
export const serverMock = { createClient: async () => env.fake.client('session') }
export const adminMock = { createAdminClient: () => env.fake.client('admin') }
export const catalogMock = { planCatalog: () => CATALOG }
