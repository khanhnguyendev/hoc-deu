'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const REFRESH_INTERVAL_MS = 30_000

/**
 * `/pending`'s client leaf (§2.4): refreshes the server page every 30 s, on `focus` and when the
 * tab becomes visible again, so the redirect to the user's home path fires as soon as an admin
 * approves the account — no manual reload needed. Renders nothing.
 */
function StatusWatcher() {
  const router = useRouter()

  useEffect(() => {
    const refresh = () => router.refresh()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [router])

  return null
}

export { StatusWatcher }
