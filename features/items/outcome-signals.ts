'use client'

import { createContext } from 'react'

/**
 * What an item's body tells its result controls (task 5.2c): the note's `<Solution />` was
 * revealed (the nudge, decision 18) and the lesson's `<Quiz>` was scored (`lesson.completed
 * { quizScore }`). The body is server-rendered MDX, so a callback cannot reach it as a prop: the
 * controls that wrap it (ProblemOutcome, LessonComplete) provide this context, and SolutionTabs and
 * Quiz report through it when it is there. Outside such a page it is null and nothing is reported.
 */
export type OutcomeSignals = {
  readonly solutionRevealed: () => void
  /** The checked score, 0–100 (Quiz's rounded percent). */
  readonly quizScored: (percent: number) => void
}

export const OutcomeSignalsContext = createContext<OutcomeSignals | null>(null)
