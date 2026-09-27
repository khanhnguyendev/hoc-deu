import { requireCronSecret } from '@/lib/auth/cron'
import { runMaintenance } from '@/lib/ops/maintenance'

/**
 * `GET /api/cron/maintenance` — the daily Vercel cron (`vercel.json`, 21:00 UTC; §2.3,
 * ADR-0034). `Authorization: Bearer CRON_SECRET` first (401 otherwise, before any work), then
 * every maintenance step; answers 200 with the step outcomes only (no data), never cached.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await requireCronSecret(request)
  if (denied) return denied
  const report = await runMaintenance()
  return Response.json(report, { headers: { 'Cache-Control': 'no-store' } })
}
