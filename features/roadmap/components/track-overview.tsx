import Link from 'next/link'
import type * as React from 'react'
import { Banner } from '@/components/patterns/banner'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { WeeklyTemplatePreview } from '@/features/tracks'
import type { TemplateDay } from '@/lib/content/weekly-template'
import { vi } from '@/lib/i18n/vi'
import type { Enrollment, TrackSummary, VariantLink } from '../queries'
import { VariantLinks } from './variant-links'

const copy = vi.roadmap

type TrackOverviewProps = {
  track: TrackSummary
  /** The learner's active or paused enrollment, or null. */
  enrollment: Enrollment | null
  variants: readonly VariantLink[]
  /** `describeWeeklyTemplate` / `describeThrottle` of the manifest. */
  template: TemplateDay[]
  throttle: string[]
  /** The roadmap (RoadmapView) or its empty state. */
  children: React.ReactNode
}

/** The learner's status, or — for an active track they do not follow — the way to add it. */
function headerAction({
  track,
  enrollment,
}: Pick<TrackOverviewProps, 'track' | 'enrollment'>): React.ReactNode {
  if (enrollment !== null && enrollment.status !== 'removed') {
    return (
      <Badge tone={enrollment.status === 'active' ? 'primary' : 'warning'}>
        {copy.status[enrollment.status]}
      </Badge>
    )
  }
  if (track.status !== 'active') return null
  return (
    <Link href="/settings" className={buttonVariants({ variant: 'outline' })}>
      {copy.addInSettings}
    </Link>
  )
}

/**
 * The top of a track page (platform design §2.4): the title (the page `h1`) with the English
 * title, a draft or retired notice, the roadmap variants and the weekly template; then the
 * roadmap. Everything sits in the track's `data-accent` context; the wrapper is `contents`, so the
 * parts keep the page's section spacing.
 */
function TrackOverview({
  track,
  enrollment,
  variants,
  template,
  throttle,
  children,
}: TrackOverviewProps) {
  return (
    <div data-slot="track-overview" data-accent={track.accent} className="contents">
      <PageHeader
        title={track.title}
        description={<span lang="en">{track.titleEn}</span>}
        actions={headerAction({ track, enrollment })}
      />
      {track.status === 'draft' && <Banner tone="info">{copy.draft}</Banner>}
      {track.status === 'retired' && <Banner tone="warning">{copy.retired}</Banner>}
      <VariantLinks variants={variants} />
      <Section title={copy.template}>
        <WeeklyTemplatePreview
          title={track.title}
          accent={track.accent}
          days={template}
          throttle={throttle}
        />
      </Section>
      {children}
    </div>
  )
}

export { TrackOverview }
export type { TrackOverviewProps }
