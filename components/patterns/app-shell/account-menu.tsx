'use client'

import { LogOut, ShieldCheck, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toaster'
import { vi } from '@/lib/i18n/vi'
import { initial } from './initial'

/**
 * A successful `signOut()` still rejects the promise we get back from calling it directly (not
 * through `useActionState`): Next's client action runtime settles a redirecting action's promise
 * with a `NEXT_REDIRECT`-digest error so a `RedirectBoundary` can perform the navigation — the
 * navigation itself already happened by the time this rejection reaches us, regardless of what we
 * do with it (`server-action-reducer.js`). Recognising that shape here (never `unstable_rethrow`,
 * which would only turn it into an unhandled rejection with no boundary to catch it) keeps the
 * ordinary sign-out path silent.
 */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}

/** Name, theme, "Quản trị" (admins only) and "Đăng xuất" (DESIGN_SYSTEM §5). */
export function AccountMenu({
  name,
  isAdmin,
  onSignOut,
}: {
  name: string
  isAdmin: boolean
  onSignOut?: () => Promise<void>
}) {
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${vi.nav.account}: ${name}`}>
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-soft-foreground"
          >
            {initial(name) ?? <User strokeWidth={1.75} className="size-5" />}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-foreground">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{vi.theme.label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">{vi.theme.light}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{vi.theme.dark}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{vi.theme.system}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck aria-hidden="true" strokeWidth={1.75} />
              {vi.nav.admin}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={!onSignOut}
          // Radix's onSelect passes a non-serializable Event; onSignOut takes none. Awaited (not
          // fire-and-forget, M2 minor): a genuine rejection shows a toast, since the menu has
          // otherwise already closed with no other sign of failure — a redirect-shaped rejection
          // (the ordinary, successful path) never does.
          onSelect={() => {
            onSignOut?.().catch((error: unknown) => {
              if (!isRedirectError(error)) toast.error(vi.account.signOutFailed)
            })
          }}
        >
          <LogOut aria-hidden="true" strokeWidth={1.75} />
          {vi.nav.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
