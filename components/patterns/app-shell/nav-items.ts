import {
  BookOpen,
  ChartColumn,
  type LucideIcon,
  MapIcon,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react'
import { vi } from '@/lib/i18n/vi'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Path prefixes that make the item current; `exact` matches `href` only. */
  match: readonly string[] | 'exact'
}

/** The five learner destinations (DESIGN_SYSTEM §5, §8). */
const NAV_ITEMS: readonly NavItem[] = [
  { href: '/today', label: vi.nav.today, icon: Sun, match: ['/today'] },
  { href: '/review', label: vi.nav.review, icon: RotateCcw, match: ['/review'] },
  { href: '/tracks', label: vi.nav.roadmap, icon: MapIcon, match: ['/tracks', '/t'] },
  { href: '/progress', label: vi.nav.progress, icon: ChartColumn, match: ['/progress'] },
  { href: '/settings', label: vi.nav.settings, icon: Settings, match: ['/settings'] },
]

/** Admin pages, listed in the desktop sidebar for admins only. */
const ADMIN_ITEMS: readonly NavItem[] = [
  { href: '/admin', label: vi.nav.admin, icon: ShieldCheck, match: 'exact' },
  { href: '/admin/users', label: vi.nav.adminUsers, icon: Users, match: ['/admin/users'] },
  { href: '/admin/content', label: vi.nav.adminContent, icon: BookOpen, match: ['/admin/content'] },
]

function isCurrent(item: NavItem, pathname: string): boolean {
  if (item.match === 'exact') return pathname === item.href
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export { ADMIN_ITEMS, isCurrent, NAV_ITEMS }
export type { NavItem }
