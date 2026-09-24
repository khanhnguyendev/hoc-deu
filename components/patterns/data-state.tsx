import type * as React from 'react'
import { ErrorState } from './error-state'
import { LoadingState } from './loading-state'

/** The four states every client data-driven component renders (platform design §7.5). */
type DataState<T> =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; data: T }

function DataState<T>({
  state,
  loading = <LoadingState />,
  empty,
  children,
}: {
  state: DataState<T>
  loading?: React.ReactNode
  empty: React.ReactNode
  children: (data: T) => React.ReactNode
}) {
  switch (state.status) {
    case 'loading':
      return <>{loading}</>
    case 'empty':
      return <>{empty}</>
    case 'error':
      return <ErrorState onRetry={state.retry} />
    case 'ready':
      return <>{children(state.data)}</>
  }
}

export { DataState }
