import type { Metadata } from 'next'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import { CatalogStats, ContentCoverage, DraftsList, getAdminContent } from '@/features/admin'
import { vi } from '@/lib/i18n/vi'

export const metadata: Metadata = { title: `${vi.nav.adminContent} — Học Đều` }

const copy = vi.adminOverview.content

/**
 * Nội dung (§2.4; task 5.6): per track its catalog stats and verification, then the coverage by
 * week of each roadmap variant with the red rows of decision 25; then the drafts (draft tracks,
 * items and notes — published in v1.0 by a `status` change in `content/**`).
 */
export default async function AdminContentPage() {
  const page = await getAdminContent()
  return (
    <>
      <PageHeader title={vi.nav.adminContent} description={copy.description} />
      {page.tracks.map((track) => (
        <Section key={track.id} title={track.title} description={track.statusLabel}>
          <CatalogStats stats={track.stats} />
          {track.roadmaps.map((roadmap) => (
            <ContentCoverage key={roadmap.variant} coverage={roadmap} />
          ))}
        </Section>
      ))}
      <Section title={copy.drafts.title}>
        <DraftsList drafts={page.drafts} />
      </Section>
    </>
  )
}
