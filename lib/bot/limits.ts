/**
 * The bot's hard maxima (Part B-M6 decision 33; spec §4.2 `bot_settings.limits`): custom items 10
 * new per user per local day and 200 active; overrides 3 active per track, an `insert_block` at
 * most 25 % of the budget and 14 days, an `extra_week` at most 5 study days with a 21-day
 * cooldown. They live in code; `bot_settings.limits` may only lower them — a stored higher value is
 * clamped here, and `/admin/bot` refuses to store one (`botLimitsInput`). SQL enforces the counts
 * (6.2b) under a per-user lock, TypeScript the bounds that need the catalog. Plain constants, no
 * server-only: the admin form shows the maxima.
 */
import { z } from 'zod'

export const HARD_LIMITS = {
  customItemsPerDay: 10,
  customItemsActive: 200,
  overridesPerTrack: 3,
  insertBlockShare: 0.25,
  insertBlockDays: 14,
  extraWeekDays: 5,
  extraWeekCooldownDays: 21,
} as const

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

const limitValue = (key: LimitKey) => {
  const base = z.number().min(0).max(HARD_LIMITS[key])
  return (isShare(key) ? base : base.int()).optional()
}

/**
 * What `/admin/bot` may store in `bot_settings.limits`: known keys only, each at or under its hard
 * maximum (decision 33: a higher value is refused, not clamped, at the door).
 */
export const botLimitsInput = z.strictObject(
  Object.fromEntries(LIMIT_KEYS.map((key) => [key, limitValue(key)])) as {
    [K in LimitKey]: ReturnType<typeof limitValue>
  },
)
