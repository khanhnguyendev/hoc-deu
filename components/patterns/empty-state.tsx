import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type * as React from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type StateAction = { label: string; href: string } | { label: string; onClick: () => void }
type StateLayout = 'inline' | 'page'

/** Inline: inside a section. Page: the whole page (a centred `main`), e.g. the root 404. */
function StateFrame({ layout, children }: { layout: StateLayout; children: React.ReactNode }) {
  if (layout === 'page') {
    return (
      <main
        id="main"
        className="mx-auto flex min-h-dvh w-full max-w-app items-center justify-center px-4 md:px-6 lg:px-8"
      >
        {children}
      </main>
    )
  }
  return <>{children}</>
}

function StateAction({ action }: { action: StateAction }) {
  if ('href' in action) {
    return (
      <Link href={action.href} className={buttonVariants({ variant: 'primary' })}>
        {action.label}
      </Link>
    )
  }
  return <Button onClick={action.onClick}>{action.label}</Button>
}

/** Icon, one line of what happened, one action (DESIGN_SYSTEM §9). */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  titleAs: Title = 'h2',
  layout = 'inline',
  className,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: StateAction
  titleAs?: 'h1' | 'h2' | 'h3'
  layout?: StateLayout
  className?: string
}) {
  return (
    <StateFrame layout={layout}>
      <div
        data-slot="empty-state"
        className={cn(
          'flex w-full flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong px-4 py-10 text-center',
          className,
        )}
      >
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-8 text-subtle-foreground" />
        <Title className="text-lg font-semibold">{title}</Title>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
        {action && <StateAction action={action} />}
      </div>
    </StateFrame>
  )
}

export { EmptyState, StateFrame }
export type { StateAction, StateLayout }
