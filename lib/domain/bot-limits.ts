/**
 * The bot's hard maxima (Part B-M6 decision 33; spec §4.2 `bot_settings.limits`): custom items 10
 * new per user per local day and 200 active; overrides 3 active per track, an `insert_block` at
 * most 25 % of the budget and 14 days, an `extra_week` at most 5 study days with a 21-day
 * cooldown. Pure data in `lib/domain`, so the plan service's bounded reads (`lib/plans/reads.ts`)
 * use them without importing `lib/bot`; `lib/bot/limits.ts` re-exports them with the stored
 * limits' clamping (`effectiveLimits`).
 */
export const HARD_LIMITS = {
  customItemsPerDay: 10,
  customItemsActive: 200,
  overridesPerTrack: 3,
  insertBlockShare: 0.25,
  insertBlockDays: 14,
  extraWeekDays: 5,
  extraWeekCooldownDays: 21,
} as const
