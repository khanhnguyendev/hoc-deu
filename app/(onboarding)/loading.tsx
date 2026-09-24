import { FocusLayout } from '@/components/patterns/focus-layout'
import { LoadingState } from '@/components/patterns/loading-state'

export default function OnboardingLoading() {
  return (
    <FocusLayout width="wide">
      <LoadingState variant="page" rows={2} />
    </FocusLayout>
  )
}
