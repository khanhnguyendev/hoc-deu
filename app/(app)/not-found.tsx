import { FileQuestion } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import { vi } from '@/lib/i18n/vi'

/**
 * The Vietnamese 404 for `notFound()` inside the `(app)` group — an unknown track or item, a
 * draft for a learner (task 3.4b). It renders inside the AppShell, whose `main` holds it, so it is
 * the inline EmptyState (the root `app/not-found.tsx` is a whole page with its own `main`). The
 * group's `loading.tsx` streams these pages, so the response is already 200 when `notFound()`
 * runs; Next marks the page `noindex`.
 */
export default function AppNotFound() {
  return (
    <EmptyState
      titleAs="h1"
      icon={FileQuestion}
      title={vi.states.notFoundTitle}
      description={vi.states.notFoundBody}
      action={{ label: vi.states.backHome, href: '/' }}
    />
  )
}
