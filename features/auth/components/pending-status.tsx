import { LogOut } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { Button } from '@/components/ui/button'
import { vi } from '@/lib/i18n/vi'
import type { AccountStatus } from '@/lib/auth/dal'

type PendingAccountStatus = Exclude<AccountStatus, 'active'>

/** `/pending`'s copy for a non-active account status (§2.4): pending, rejected or suspended. */
function PendingStatus({ status }: { status: PendingAccountStatus }) {
  const copy = vi.account[status]
  return <PageHeader title={copy.title} description={copy.description} />
}

/** Signs out from `/pending`'s `headerActions`, since the page carries no `components/ui`. */
function SignOutButton({ signOut }: { signOut: () => Promise<void> }) {
  return (
    <form action={signOut}>
      <Button type="submit" variant="outline">
        <LogOut aria-hidden="true" strokeWidth={1.75} />
        {vi.nav.signOut}
      </Button>
    </form>
  )
}

export { PendingStatus, SignOutButton }
