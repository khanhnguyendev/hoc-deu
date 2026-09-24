import { FileQuestion } from 'lucide-react'
import { EmptyState } from '@/components/patterns/empty-state'
import { vi } from '@/lib/i18n/vi'

export default function NotFound() {
  return (
    <EmptyState
      layout="page"
      titleAs="h1"
      icon={FileQuestion}
      title={vi.states.notFoundTitle}
      description={vi.states.notFoundBody}
      action={{ label: vi.states.backHome, href: '/' }}
    />
  )
}
