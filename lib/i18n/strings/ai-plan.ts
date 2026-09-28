/**
 * The AI plan note on `/today` (spec §2.4, Part B-M6 decision 16, task 6.5b): the mode badge of a
 * plan the bot wrote, and its rationale under it. Part B-M6 decision 3: only task 6.5b edits this
 * file, in its wave.
 */
export const aiPlan = {
  /** The mode badge (an icon and these words — never colour alone). */
  badge: 'Cá nhân hoá bởi AI',
  /** The note's accessible name: the badge and the rationale read as one group. */
  label: 'Kế hoạch hôm nay do AI cá nhân hoá',
} as const
