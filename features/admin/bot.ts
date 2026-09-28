/**
 * `/admin/bot`'s view model (§2.4, §6.2, §6.3; task 6.3): pure — the loader (`queries.ts`) reads
 * `admin_bot_settings()` and `BOT_API_ENABLED`, and passes `now`. Times read in Asia/Ho_Chi_Minh,
 * like the rest of `/admin`. The run log and the deferred-users warning arrive with 6.4a.
 */
import { z } from 'zod'
import { fill, formatDayTimeIn } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'

/** The per-run user cap's range (`bot_settings.per_run_user_cap` check: 1–100). */
export const CAP_MAX = 100

const ADMIN_TIME_ZONE = 'Asia/Ho_Chi_Minh'

/** `admin_bot_settings()` (20260928000200_bot_functions.sql `bot_settings_json`): never a hash. */
export const adminBotSettingsSchema = z.object({
  enabled: z.boolean(),
  dryRun: z.boolean(),
  contentProposals: z.boolean(),
  perRunUserCap: z.number().int(),
  limits: z.record(z.string(), z.unknown()),
  hasToken: z.boolean(),
  prevValidUntil: z.string().nullable(),
  rotatedAt: z.string().nullable(),
  updatedAt: z.string(),
})
export type AdminBotSettings = z.infer<typeof adminBotSettingsSchema>

export type BotControlsView = {
  enabled: boolean
  dryRun: boolean
  contentProposals: boolean
  perRunUserCap: number
  /** The hard maximum of the cap, shown beside the field. */
  capMax: number
}

/** Times are already formatted (`{time}, {day}`); a token itself is never part of a render. */
export type BotTokenView =
  { state: 'none' } | { state: 'set'; createdAt: string | null; previousValidUntil: string | null }

export type AdminBotPage = {
  /** `BOT_API_ENABLED` — env only; the page can say so, not change it. */
  apiEnabled: boolean
  controls: BotControlsView
  token: BotTokenView
}

const at = (instant: string) => fill(vi.adminBot.at, formatDayTimeIn(instant, ADMIN_TIME_ZONE))

function tokenView(settings: AdminBotSettings, now: Date): BotTokenView {
  if (!settings.hasToken) return { state: 'none' }
  const overlap =
    settings.prevValidUntil !== null && Date.parse(settings.prevValidUntil) > now.getTime()
  return {
    state: 'set',
    createdAt: settings.rotatedAt === null ? null : at(settings.rotatedAt),
    previousValidUntil: overlap && settings.prevValidUntil ? at(settings.prevValidUntil) : null,
  }
}

export function buildAdminBotPage(input: {
  settings: AdminBotSettings
  apiEnabled: boolean
  now: Date
}): AdminBotPage {
  const { settings } = input
  return {
    apiEnabled: input.apiEnabled,
    controls: {
      enabled: settings.enabled,
      dryRun: settings.dryRun,
      contentProposals: settings.contentProposals,
      perRunUserCap: settings.perRunUserCap,
      capMax: CAP_MAX,
    },
    token: tokenView(settings, input.now),
  }
}
