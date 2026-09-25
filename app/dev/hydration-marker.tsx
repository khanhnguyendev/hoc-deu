'use client'

import { useEffect } from 'react'

/**
 * These catalog pages are large client trees (every UI/pattern component at once); on a slow
 * runner React can take a while to hydrate them, so a Playwright click can land before Radix's
 * handlers are attached and the click is lost (M2 CI flake). Rendered once per dev page, this
 * flips a marker `useEffect` runs after the whole tree has committed and hydration is done — e2e
 * specs wait for it via `gotoHydrated` (e2e/support/hydration.ts) instead of interacting blind.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true'
  }, [])
  return null
}
