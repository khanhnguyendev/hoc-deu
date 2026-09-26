'use client'

import { useEffect, useRef } from 'react'

export type MarkPlanSeenAction = (planId: string) => Promise<void>

/**
 * ADR-0039 (§5.2): marks the plan seen once `/today` has rendered it **in the browser** — a
 * `useEffect` after mount, which a prefetch never runs. Renders nothing. The action comes from the
 * page as an unbound prop (`markPlanSeen`, idempotent on the server). Once per plan id: a
 * re-render, a new action identity or StrictMode's second effect run sends nothing more; a failed
 * call is swallowed (never a console error) and the next effect run or render of `/today` marks
 * the plan again.
 */
function MarkPlanSeen({
  planId,
  markPlanSeen,
}: {
  planId: string
  markPlanSeen: MarkPlanSeenAction
}) {
  const marked = useRef<string | null>(null)
  useEffect(() => {
    if (marked.current === planId) return
    marked.current = planId
    markPlanSeen(planId).catch(() => {
      if (marked.current === planId) marked.current = null
    })
  }, [planId, markPlanSeen])
  return null
}

export { MarkPlanSeen }
