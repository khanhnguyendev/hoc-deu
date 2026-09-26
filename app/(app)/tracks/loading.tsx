import { LoadingState } from '@/components/patterns/loading-state'

/**
 * `/tracks` never 404s (task 5.1c), so it keeps its own segment `loading.tsx` — the group-level
 * one was removed because it stopped `notFound()` on `/t/**` from ever reaching a real 404 (it
 * streamed a 200 first). Same skeleton the group's used to show.
 */
export default function TracksLoading() {
  return <LoadingState variant="page" />
}
