import { LoadingState } from '@/components/patterns/loading-state'

/** `/admin` and the pages below it while their loaders run: skeletons shaped like the page. */
export default function AdminOverviewLoading() {
  return <LoadingState variant="page" />
}
