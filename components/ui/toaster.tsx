'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, toast } from 'sonner'
import { vi } from '@/lib/i18n/vi'
import { MEDIA, useMediaQuery } from './use-media-query'

const ABOVE_BOTTOM_NAV = { bottom: 'var(--spacing-above-bottom-nav)' }

/**
 * Toasts (DESIGN_SYSTEM §9): bottom-centre on mobile, bottom-right on desktop, 4 s, announced in a
 * polite live region, clear of the bottom navigation. Never the only feedback for a failed save.
 */
function Toaster() {
  const { resolvedTheme } = useTheme()
  const desktop = useMediaQuery(MEDIA.md)
  // From `lg` the AppShell uses a sidebar; below it a bottom navigation that toasts must clear.
  const sidebar = useMediaQuery(MEDIA.lg)
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
