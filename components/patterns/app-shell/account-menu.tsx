'use client'

import { LogOut, ShieldCheck } from 'lucide-react'
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
import { vi } from '@/lib/i18n/vi'

/** The given name comes last in Vietnamese names: "Nguyễn Văn An" → "A". */
function initial(name: string): string {
  const given = name.trim().split(/\s+/).at(-1) ?? ''
  return given.charAt(0).toLocaleUpperCase('vi-VN')
}

/** Name, theme, "Quản trị" (admins only) and "Đăng xuất" (DESIGN_SYSTEM §5). */
export function AccountMenu({
  name,
  isAdmin,
  onSignOut,
}: {
  name: string
  isAdmin: boolean
  onSignOut?: () => void
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
            {initial(name)}
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
        <DropdownMenuItem disabled={!onSignOut} onSelect={onSignOut}>
          <LogOut aria-hidden="true" strokeWidth={1.75} />
          {vi.nav.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
