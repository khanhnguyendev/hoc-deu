import { publicRoute } from '@/lib/auth/guards'
import { databaseIsHealthy } from '@/lib/ops/health'

/**
 * `GET /api/health` — public on purpose (§2.2, §2.3): `200 {"ok":true}` when the database answers
 * its cheap query, `503 {"ok":false}` otherwise. No versions or dependency details; never cached.
 */
export async function GET(): Promise<Response> {
  publicRoute()
  const ok = await databaseIsHealthy()
  return Response.json({ ok }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
