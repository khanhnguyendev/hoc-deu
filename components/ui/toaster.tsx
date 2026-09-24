'use client'

import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { Toaster as Sonner, toast } from 'sonner'
import { vi } from '@/lib/i18n/vi'

const DESKTOP = '(min-width: 768px)'
/** From 1024 px the AppShell uses a sidebar; below it a bottom navigation that toasts must clear. */
const SIDEBAR = '(min-width: 1024px)'
const ABOVE_BOTTOM_NAV = { bottom: 'var(--spacing-above-bottom-nav)' }

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * Toasts (DESIGN_SYSTEM §9): bottom-centre on mobile, bottom-right on desktop, 4 s, announced in a
 * polite live region, clear of the bottom navigation. Never the only feedback for a failed save.
 */
function Toaster() {
  const { resolvedTheme } = useTheme()
  const desktop = useMedia(DESKTOP)
  const sidebar = useMedia(SIDEBAR)
  return (
    <Sonner
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position={desktop ? 'bottom-right' : 'bottom-center'}
      duration={4000}
      offset={sidebar ? undefined : ABOVE_BOTTOM_NAV}
      mobileOffset={ABOVE_BOTTOM_NAV}
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
