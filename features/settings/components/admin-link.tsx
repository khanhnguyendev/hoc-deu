import { ChevronRight, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { vi } from '@/lib/i18n/vi'

const copy = vi.settings.admin

/**
 * The "Quản trị" row at the top of Cài đặt, for admins only (DESIGN_SYSTEM §5): the bottom
 * navigation has no admin item, so this keeps the admin pages reachable on a phone. Renders
 * nothing for a learner.
 */
function AdminLink({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return null
  return (
    <Link
      href="/admin"
      data-slot="admin-link"
      className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-surface p-4 text-foreground transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-muted"
    >
      <ShieldCheck aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0 text-primary" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-medium">{copy.title}</span>
        <span className="text-sm text-muted-foreground">{copy.description}</span>
      </span>
      <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
    </Link>
  )
}

export { AdminLink }
