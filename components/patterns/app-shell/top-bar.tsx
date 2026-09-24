import { AccountMenu } from './account-menu'

/** < 1024 px: sticky bar with the page title and the account menu (DESIGN_SYSTEM §5). */
export function TopBar({
  title,
  name,
  isAdmin,
  onSignOut,
}: {
  title: string
  name: string
  isAdmin: boolean
  onSignOut?: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface px-4 md:px-6 lg:hidden">
      <p className="truncate text-lg font-semibold">{title}</p>
      <AccountMenu name={name} isAdmin={isAdmin} onSignOut={onSignOut} />
    </header>
  )
}
