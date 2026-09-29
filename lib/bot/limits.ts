/**
 * The bot's hard maxima (Part B-M6 decision 33; `lib/domain/bot-limits.ts`, re-exported here for
 * the bot's callers). They live in code; `bot_settings.limits` may only lower them — a stored
 * higher value is clamped here (`/admin/bot` has no limits form in M6). SQL enforces the counts
 * (6.2b) under a per-user lock, TypeScript the bounds that need the catalog. Plain constants, no
 * server-only.
 */
import { HARD_LIMITS } from '@/lib/domain/bot-limits'

export { HARD_LIMITS }

export type BotLimits = { -readonly [K in keyof typeof HARD_LIMITS]: number }

type LimitKey = keyof typeof HARD_LIMITS

const LIMIT_KEYS = Object.keys(HARD_LIMITS) as LimitKey[]

/** A share (0–1) may be fractional; every other limit is a whole count of items or days. */
const isShare = (key: LimitKey) => key === 'insertBlockShare'

const isValidValue = (key: LimitKey, value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  (isShare(key) || Number.isInteger(value))

/**
 * The limits in force: per key the stored value when it is valid, clamped to the hard maximum;
 * the hard maximum otherwise. Unknown keys (and anything that is not a plain object) are ignored.
 */
export function effectiveLimits(stored: unknown): BotLimits {
  const source =
    stored !== null && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {}
  const limits = { ...HARD_LIMITS } as BotLimits
  for (const key of LIMIT_KEYS) {
    const value = Object.hasOwn(source, key) ? source[key] : undefined
    if (isValidValue(key, value)) limits[key] = Math.min(value, HARD_LIMITS[key])
  }
  return limits
}
