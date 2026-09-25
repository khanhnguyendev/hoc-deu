import { z } from 'zod'

/**
 * The rules for what a learner chooses — code language, a track's minutes per day, its roadmap
 * variant and start date — in one place: onboarding, settings, the event payloads (§4.4) and the
 * content schemas import them, and `tools/db/sql-sync.test.ts` keeps the database's check
 * constraints equal to them.
 */

/** The languages solutions and sample code come in (§2.4); `profiles.code_language`. */
export const CODE_LANGUAGES = ['python', 'java', 'go'] as const
export type CodeLanguage = (typeof CODE_LANGUAGES)[number]

export const isCodeLanguage = (value: unknown): value is CodeLanguage =>
  CODE_LANGUAGES.some((language) => language === value)

/** Minutes per track per day: 10–240 in steps of 5 (decision 22, §5.9); `user_tracks.budget_minutes`. */
export const BUDGET_MINUTES = { min: 10, max: 240, step: 5 } as const

/** The budget rule as a Zod number schema; `message`, when given, is every broken check's error. */
export function budgetMinutesSchema(message?: string) {
  return z
    .number(message === undefined ? undefined : { error: message })
    .int(message)
    .min(BUDGET_MINUTES.min, message)
    .max(BUDGET_MINUTES.max, message)
    .multipleOf(BUDGET_MINUTES.step, message)
}

const anyBudget = budgetMinutesSchema()

export const isBudgetMinutes = (minutes: number): boolean => anyBudget.safeParse(minutes).success

/** A roadmap variant ID (`8w`, `10w`); `user_tracks.roadmap_variant`. */
export const ROADMAP_VARIANT_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

/** A future start date may be at most this many days ahead (decision 22). */
export const MAX_START_DAYS_AHEAD = 60
