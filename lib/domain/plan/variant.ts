/** The default roadmap variant for a track, by budget (platform design §5.11, decision A). */

export type RoadmapChoice = { id: string; recommendedBelowMinutes?: number }

/**
 * The first roadmap whose `recommendedBelowMinutes` is strictly above `budgetMinutes`, else the
 * last roadmap (e.g. DSA: `8w` below 75 min/day, `10w` at 75 min/day or more).
 */
export function defaultVariant(roadmaps: readonly RoadmapChoice[], budgetMinutes: number): string {
  const match = roadmaps.find(
    (roadmap) =>
      roadmap.recommendedBelowMinutes !== undefined &&
      budgetMinutes < roadmap.recommendedBelowMinutes,
  )
  const chosen = match ?? roadmaps[roadmaps.length - 1]
  if (chosen === undefined) throw new Error('defaultVariant: roadmaps must not be empty')
  return chosen.id
}
