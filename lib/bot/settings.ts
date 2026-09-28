/**
 * `bot_settings` for the bot's server side (§4.2, §6.2): the single row, read with the secret-key
 * client — the table has no grant to `authenticated`, and a bot request has no session (Part B-M6
 * decision 6). Admins read their view through `admin_bot_settings()` instead (features/admin),
 * which never returns a hash.
 */
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { effectiveLimits, type BotLimits } from './limits'
import type { TokenState } from './token'

export type { TokenState } from './token'

export type BotSettings = {
  enabled: boolean
  dryRun: boolean
  contentProposals: boolean
  perRunUserCap: number
  /** The stored limits clamped to the hard maxima (`effectiveLimits`, decision 33). */
  limits: BotLimits
}

const COLUMNS =
  'enabled, dry_run, content_proposals, per_run_user_cap, limits, token_hash, token_prev_hash, token_prev_valid_until'

/** The row as the bot sees it. A read error throws: it must never read as "off" or "no token". */
export async function readBotSettings(): Promise<{ settings: BotSettings; token: TokenState }> {
  const { data, error } = await createAdminClient().from('bot_settings').select(COLUMNS).single()
  if (error || !data) throw new Error('Could not read the bot settings', { cause: error })
  return {
    settings: {
      enabled: data.enabled,
      dryRun: data.dry_run,
      contentProposals: data.content_proposals,
      perRunUserCap: data.per_run_user_cap,
      limits: effectiveLimits(data.limits),
    },
    token: {
      hash: data.token_hash,
      prevHash: data.token_prev_hash,
      prevValidUntil:
        data.token_prev_valid_until === null ? null : new Date(data.token_prev_valid_until),
    },
  }
}
