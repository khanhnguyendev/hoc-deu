/**
 * Active tracks as plain, serialisable options for the forms that enroll a learner: onboarding
 * (task 2.10) and settings (task 2.11). Client components import only the type (`import type`);
 * the loader reads the manifests from the generated catalog (server-only, decision 6).
 */
import 'server-only'
import type { CodeLanguage } from './schemas/common'
import type { TrackManifest } from './schemas/manifest'
import { activeTracks } from './tracks'
import { describeThrottle, describeWeeklyTemplate, type TemplateDay } from './weekly-template'

export type TrackOption = {
  id: string
  /** The Vietnamese title. */
  title: string
  /** `track-1`…`track-8` (DESIGN_SYSTEM §3.2), for `data-accent`. */
  accent: string
  defaultBudgetMinutes: number
  roadmaps: { id: string; recommendedBelowMinutes?: number }[]
  /** The languages the track's solutions come in; empty when it has none (English). */
  codeLanguages: CodeLanguage[]
  /** The weekly template as Vietnamese text (`describeWeeklyTemplate`). */
  template: TemplateDay[]
  /** The new-item throttle as Vietnamese lines (`describeThrottle`); empty when none. */
  throttle: string[]
}

function toOption(track: TrackManifest): TrackOption {
  return {
    id: track.id,
    title: track.title.vi,
    accent: track.accent,
    defaultBudgetMinutes: track.defaults.budgetMinutes,
    roadmaps: track.roadmaps.map(({ id, recommendedBelowMinutes }) =>
      recommendedBelowMinutes === undefined ? { id } : { id, recommendedBelowMinutes },
    ),
    codeLanguages: [...(track.codeLanguages ?? [])],
    template: describeWeeklyTemplate(track.weeklyTemplate),
    throttle: describeThrottle(track.defaults),
  }
}

/**
 * Active tracks as plain, serialisable options (vi titles, template text), in manifest order. No
 * guard: its callers are guarded loaders (`getOnboardingData`, `getSettingsData`).
 */
export function loadTrackOptions(): TrackOption[] {
  return activeTracks().map(toOption)
}
