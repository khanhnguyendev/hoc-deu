import { useSyncExternalStore } from 'react'

/**
 * The media queries of the layout breakpoints (DESIGN_SYSTEM §5): Tailwind's own `md` (48rem,
 * 768 px) and `lg` (64rem, 1024 px), so a component that must switch in script — the check-in
 * sheet's Sheet / Dialog, the toasts' position — flips exactly where the `md:` / `lg:` utilities
 * do. The one place a breakpoint is written outside the CSS.
 */
export const MEDIA = {
  /** From `md`: the desktop layout (dialogs instead of bottom sheets, toasts bottom-right). */
  md: '(min-width: 48rem)',
  /** From `lg`: the AppShell's sidebar replaces the bottom navigation. */
  lg: '(min-width: 64rem)',
} as const

/**
 * Whether `query` matches, kept in sync with the viewport. False on the server and during
 * hydration (the server snapshot), so the first client render matches the server HTML.
 */
export function useMediaQuery(query: string): boolean {
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
