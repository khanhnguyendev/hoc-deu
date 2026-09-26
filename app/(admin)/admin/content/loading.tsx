import { LoadingState } from '@/components/patterns/loading-state'

/** `/admin/content` while the catalog and the track positions load. */
export default function AdminContentLoading() {
  return <LoadingState variant="page" />
}
