/**
 * The day's template and block IDs (platform design §5.4 steps 1 and 8): which blocks a track's
 * weekly template gives for a weekday at a roadmap week, and the deterministic ID of each block.
 */
import type { PlanTemplateBlock, PlanWeeklyTemplate, Weekday } from '../catalog'
import type { LocalDay } from '../time/localDay'
import type { BlockKind } from './types'

/** The weekdays the template's `mon-fri` key covers. */
const MON_FRI: ReadonlySet<Weekday> = new Set(['mon', 'tue', 'wed', 'thu', 'fri'])

/** The day's blocks (§5.4 step 1): the weekday's own key wins over 'mon-fri'; blocks whose
 *  fromWeek > roadmapWeek are left out. [] when the template has nothing for the day. */
export function dayTemplate(
  template: PlanWeeklyTemplate,
  weekday: Weekday,
  roadmapWeek: number,
): PlanTemplateBlock[] {
  const blocks = template[weekday] ?? (MON_FRI.has(weekday) ? template['mon-fri'] : undefined)
  return (blocks ?? []).filter(
    (block) => block.fromWeek === undefined || block.fromWeek <= roadmapWeek,
  )
}

/** `<planDate>:<trackId>:<kind>:<n>` (§5.4 step 8). */
export function planBlockId(
  planDate: LocalDay,
  trackId: string,
  kind: BlockKind,
  n: number,
): string {
  return `${planDate}:${trackId}:${kind}:${n}`
}
