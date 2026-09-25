import type { Metadata } from 'next'
import { PageHeader } from '@/components/patterns/page-header'
import { getTracksOverview, TrackList } from '@/features/roadmap'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.roadmap} — Học Đều` }

/**
 * Lộ trình (§2.4): the tracks the learner follows and the others they could add in Settings —
 * drafts too for admins; an empty state when there is no track at all (RF-4).
 */
export default async function TracksPage() {
  const { mine, others } = await getTracksOverview()
  return (
    <>
      <PageHeader title={vi.nav.roadmap} description={vi.roadmap.description} />
      <TrackList mine={mine} others={others} />
    </>
  )
}
