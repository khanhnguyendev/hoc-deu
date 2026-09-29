import { LoadingState } from '@/components/patterns/loading-state'

/** `/admin/bot` while the bot settings load. */
export default function AdminBotLoading() {
  return <LoadingState variant="page" />
}
