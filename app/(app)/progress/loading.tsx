import { LoadingState } from '@/components/patterns/loading-state'

/**
 * `/progress` never 404s (task 5.1c), so it keeps its own segment `loading.tsx` — the group-level
 * one was removed so `notFound()` on `/t/**` could reach a real 404 instead of streaming a 200.
 */
export default function ProgressLoading() {
  return <LoadingState variant="page" />
}
