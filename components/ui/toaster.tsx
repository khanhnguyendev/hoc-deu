'use client'

import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { Toaster as Sonner, toast } from 'sonner'
import { vi } from '@/lib/i18n/vi'

const DESKTOP = '(min-width: 768px)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/**
 * Toasts (DESIGN_SYSTEM §9): bottom-centre on mobile, bottom-right on desktop, 4 s, announced in a
 * polite live region. Never the only feedback for a failed save.
 */
function Toaster() {
  const { resolvedTheme } = useTheme()
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  )
  return (
    <Sonner
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position={desktop ? 'bottom-right' : 'bottom-center'}
      duration={4000}
      containerAriaLabel={vi.common.notifications}
      style={{
        '--normal-bg': 'var(--surface)',
        '--normal-text': 'var(--foreground)',
        '--normal-border': 'var(--border)',
        '--border-radius': 'var(--radius)',
      }}
    />
  )
}

export { Toaster, toast }
