import { FocusLayout } from '@/components/patterns/focus-layout'
import { LoadingState } from '@/components/patterns/loading-state'

export default function AccountLoading() {
  return (
    <FocusLayout>
      <LoadingState variant="page" rows={1} />
    </FocusLayout>
  )
}
