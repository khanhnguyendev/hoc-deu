'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { vi } from '@/lib/i18n/vi'

const subscribe = () => () => {}

/** Light / dark / system (next-themes); the chosen value appears after hydration. */
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  return (
    <ToggleGroup
      type="single"
      aria-label={vi.theme.label}
      value={hydrated ? (theme ?? 'system') : ''}
      onValueChange={(value) => value && setTheme(value)}
    >
      <ToggleGroupItem value="light">
        <Sun aria-hidden="true" strokeWidth={1.75} />
        {vi.theme.light}
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <Moon aria-hidden="true" strokeWidth={1.75} />
        {vi.theme.dark}
      </ToggleGroupItem>
      <ToggleGroupItem value="system">
        <Monitor aria-hidden="true" strokeWidth={1.75} />
        {vi.theme.system}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export { ThemeToggle }
