import {
  Ban,
  CalendarCheck,
  CalendarClock,
  Database,
  HardDriveDownload,
  Inbox,
  ListChecks,
  type LucideIcon,
  RotateCcw,
  UserCheck,
  UserX,
} from 'lucide-react'
import { LinkRow } from '@/components/patterns/link-row'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import { StatCard } from '@/components/patterns/stat-card'
import { vi } from '@/lib/i18n/vi'
import type { AdminOverviewPage, SystemCard } from '../overview'
import { AdminWarnings } from './admin-warnings'

const copy = vi.adminOverview

const SYSTEM_ICONS: Readonly<Record<SystemCard['id'], LucideIcon>> = {
  'db-size': Database,
  backup: HardDriveDownload,
  'restore-test': RotateCcw,
  cron: CalendarClock,
}

/**
 * `/admin` (platform design §2.4, §8.4 item 5; task 5.6): PageHeader; the warnings first
 * (AdminWarnings); the accounts by status and the last 7 days' activity (`admin_overview()`); the
 * latest ops metrics — DB size, last backup, last restore test, last cron run, "chưa có dữ liệu"
 * before the first cron run; and links to `/admin/users` and `/admin/content`. Counts only: no
 * learner is named (§4.5).
 */
function AdminOverview({ page }: { page: AdminOverviewPage }) {
  const { users, learnersCompleted7d, plansCreated7d } = page.counts
  return (
    <div data-slot="admin-overview" className="contents">
      <PageHeader title={vi.nav.admin} description={copy.description} />
      <AdminWarnings warnings={page.warnings} />
      <Section title={copy.counts.title}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label={copy.counts.pending} value={users.pending} icon={Inbox} />
          <StatCard label={copy.counts.active} value={users.active} icon={UserCheck} />
          <StatCard label={copy.counts.suspended} value={users.suspended} icon={Ban} />
          <StatCard label={copy.counts.rejected} value={users.rejected} icon={UserX} />
          <StatCard
            label={copy.counts.learnersCompleted}
            value={learnersCompleted7d}
            hint={copy.counts.last7Days}
            icon={CalendarCheck}
          />
          <StatCard
            label={copy.counts.plansCreated}
            value={plansCreated7d}
            hint={copy.counts.last7Days}
            icon={ListChecks}
          />
        </div>
      </Section>
      <Section title={copy.system.title}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {page.system.map((card) => (
            <StatCard
              key={card.id}
              label={card.label}
              value={card.value}
              hint={card.hint}
              icon={SYSTEM_ICONS[card.id]}
            />
          ))}
        </div>
      </Section>
      <Section title={copy.links.title}>
        <ul
          role="list"
          className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-2"
        >
          {page.links.map((link) => (
            <li key={link.href}>
              <LinkRow href={link.href} title={link.title} meta={[link.meta]} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

export { AdminOverview }
