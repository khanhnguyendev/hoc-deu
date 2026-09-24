import type { Metadata } from 'next'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import { ThemeToggle } from '@/components/patterns/theme-toggle'
import {
  AddTrackForm,
  AdminLink,
  CodeLanguageForm,
  enrollTrack,
  getSettingsData,
  ScheduleForm,
  setTrackStatus,
  TrackSettings,
  updateCodeLanguage,
  updateSchedule,
  updateTrack,
} from '@/features/settings'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.settings} — Học Đều` }

const copy = vi.settings

/**
 * Cài đặt (§2.4): the "Quản trị" row for admins, the schedule (changes take effect at the next day
 * start, §5.9), the tracks (minutes, variant, pause / resume / remove, add), the code language
 * and the theme (client-side, decision 7). Every render brings a fresh `requestId` (decision 9).
 */
export default async function SettingsPage() {
  const data = await getSettingsData()
  return (
    <>
      <PageHeader title={vi.nav.settings} description={copy.description} />
      <AdminLink isAdmin={data.user.isAdmin} />
      <Section title={copy.schedule.title} description={copy.schedule.description}>
        <ScheduleForm
          schedule={data.schedule}
          pendingSchedule={data.pendingSchedule}
          timeZones={data.timeZones}
          requestId={data.requestId}
          updateSchedule={updateSchedule}
        />
      </Section>
      <Section title={copy.tracks.title} description={copy.tracks.description}>
        <TrackSettings
          tracks={data.tracks}
          requestId={data.requestId}
          updateTrack={updateTrack}
          setTrackStatus={setTrackStatus}
        />
      </Section>
      <Section title={copy.add.title} description={copy.add.description}>
        <AddTrackForm
          tracks={data.tracks}
          schedule={data.schedule}
          now={data.now}
          requestId={data.requestId}
          enrollTrack={enrollTrack}
        />
      </Section>
      <Section title={copy.codeLanguage.title} description={copy.codeLanguage.description}>
        <CodeLanguageForm
          codeLanguage={data.user.codeLanguage}
          requestId={data.requestId}
          updateCodeLanguage={updateCodeLanguage}
        />
      </Section>
      <Section title={copy.theme.title} description={copy.theme.description}>
        <ThemeToggle />
      </Section>
    </>
  )
}
