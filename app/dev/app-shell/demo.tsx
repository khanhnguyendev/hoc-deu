'use client'

import { AppShell } from '@/components/patterns/app-shell'
import { CalendarHeatmap, type HeatmapDay } from '@/components/patterns/calendar-heatmap'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import { Button } from '@/components/ui/button'
import { Toaster, toast } from '@/components/ui/toaster'

const TODAY = '2026-02-04'
const DAYS: HeatmapDay[] = Array.from({ length: 120 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 1, 4 - i)).toISOString().slice(0, 10),
  minutes: (i * 23) % 90,
}))

/**
 * The real, uncontained AppShell on a long page — the catalog demo is boxed in, so fixed and
 * sticky layers are only exercised here (e2e/app-shell.spec.ts).
 */
export function AppShellDemo() {
  return (
    <AppShell user={{ name: 'Nguyễn Văn An' }} isAdmin title="Hôm nay">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Hôm nay học gì?"
          actions={
            <Button variant="outline" onClick={() => toast('Đã lưu tiến độ')}>
              Hiện thông báo
            </Button>
          }
        />
        <Section title="Lịch học">
          <CalendarHeatmap days={DAYS} today={TODAY} label="Lịch học" />
        </Section>
        <Section title="Danh sách dài">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 30 }, (_, i) => (
              <Button key={i} variant="secondary" className="self-start">
                Mục {i + 1}
              </Button>
            ))}
          </div>
        </Section>
      </div>
      <Toaster />
    </AppShell>
  )
}
