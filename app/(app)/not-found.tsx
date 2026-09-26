import { FileQuestion } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import { vi } from '@/lib/i18n/vi'

/**
 * The Vietnamese 404 for `notFound()` inside the `(app)` group — an unknown track or item, a
 * draft for a learner (task 3.4b). It renders inside the AppShell, whose `main` holds it, so it is
 * the inline EmptyState (the root `app/not-found.tsx` is a whole page with its own `main`).
 *
 * Task 5.1c: a real HTTP 404, not a streamed 200. The rule: a route that can answer 404 (`/t/**`)
 * has no `loading.tsx` on its own segment or above it inside `(app)` — there is no group-level
 * `loading.tsx` any more — and its page validates the route params and calls `notFound()` before
 * anything suspends. Slow parts (the item page's MDX and code) render inside their own
 * `<Suspense>` boundary instead (`ItemView` around `ItemBody`), never wrapping the `notFound()`
 * check itself. Routes that never 404 (`/today`, `/tracks`, `/settings`) keep their own segment
 * `loading.tsx`.
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
