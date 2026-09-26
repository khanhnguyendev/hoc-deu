import 'server-only'
import { getSessionUser } from '@/lib/auth/dal'

/**
 * Part B-M5 decision 5: every `lib/plans` entry point takes the user id from a guarded caller and
 * first checks that it is the signed-in user's (`getSessionUser`, cached per request) — so a
 * caller's mistake can never read or write another learner's plan, least of all with the secret
 * key. A mismatch is a bug: it throws, before any read.
 */
export async function assertSessionUser(userId: string): Promise<void> {
  const user = await getSessionUser()
  if (user?.id !== userId) {
    throw new Error('lib/plans: the user id is not the signed-in user')
  }
}
