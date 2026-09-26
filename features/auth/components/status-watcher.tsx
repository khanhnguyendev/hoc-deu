'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const REFRESH_INTERVAL_MS = 30_000

/**
 * `/pending`'s client leaf (§2.4): refreshes the server page every 30 s while the tab is visible,
 * on `focus` and when the tab becomes visible again, so the redirect to the user's home path fires
 * as soon as an admin approves the account — no manual reload needed. A hidden tab never refreshes
 * on the interval (M2 minor): the check is on the interval tick itself, not only on the
 * `visibilitychange` event, so a tab that starts hidden and stays hidden never calls it either.
 * `paused` stops the interval and every listener — the catalog demo uses it, so `/dev/components`
 * runs no live 30 s interval in the background (M2 minor). Renders nothing.
 */
function StatusWatcher({ paused = false }: { paused?: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (paused) return undefined

    const refresh = () => router.refresh()
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const interval = setInterval(refreshIfVisible, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refreshIfVisible)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [router, paused])

  return null
}

export { StatusWatcher }
