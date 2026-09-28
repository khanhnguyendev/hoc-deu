import { publicRoute } from '@/lib/auth/guards'
import { pendingPublishTargets } from '@/lib/ops/publish-requests'

/**
 * `GET /api/content/publish-requests` — public on purpose (§2.4, §6.6; Part B-M6 decision 20): the
 * targets (item IDs, or `<itemId>#note`) of pending admin publish requests, for the
 * `bot-content-policy` CI check — `200 {"targets":[…]}`, nothing else. Only public data, so it may
 * be cached for a minute; a database error is `503 {"ok":false}` (never cached).
 */
export async function GET(): Promise<Response> {
  publicRoute()
  let targets: string[]
  try {
    targets = await pendingPublishTargets()
  } catch {
    console.error('[publish-requests] the targets could not be read')
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json({ targets }, { headers: { 'Cache-Control': 'public, max-age=60' } })
}
