import { MapIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/patterns/empty-state'
import { renderItemRow } from '@/features/items'
import { getTrackPage, roadmapSlots, RoadmapView, TrackOverview } from '@/features/roadmap'
import { vi } from '@/lib/i18n/vi'

const copy = vi.roadmap.noContent

/** `?variant=` when it is a single value; the loader checks it against the manifest. */
async function load({ params, searchParams }: PageProps<'/t/[trackId]'>) {
  const { trackId } = await params
  const { variant } = await searchParams
  const data = await getTrackPage(trackId, typeof variant === 'string' ? variant : undefined)
  if (data === null) notFound()
  return data
}

export async function generateMetadata(props: PageProps<'/t/[trackId]'>): Promise<Metadata> {
  const { track } = await load(props)
  return { title: `${track.title} — Học Đều` }
}

/**
 * A track (§2.4): its overview — title, variants, weekly template — and the chosen variant's
 * roadmap, week by week. The page renders each row through the registry and hands the slots to
 * RoadmapView (fix 5). A variant without its roadmap file yet shows an empty state (decision 4,
 * RF-4). Progress and weak items arrive with task 5.4 (decision 25).
 *
 * Task 5.1c: `load()` (and its `notFound()`) run before anything else, and this segment has no
 * `loading.tsx` (`(app)`'s group-level one was removed), so an unknown, draft-for-a-learner or
 * un-followed retired track answers a real HTTP 404 (`app/(app)/not-found.tsx`) instead of a
 * streamed 200. RoadmapView needs no `<Suspense>` split: its slots are already built by the time
 * this renders.
 */
export default async function TrackPage(props: PageProps<'/t/[trackId]'>) {
  const data = await load(props)
  const slots =
    data.view === null
      ? null
      : roadmapSlots(data.view, (item, { mode }) =>
          renderItemRow(item, { state: null, mode: mode ?? undefined }),
        )
  return (
    <TrackOverview
      track={data.track}
      enrollment={data.enrollment}
      variants={data.variants}
      template={data.template}
      throttle={data.throttle}
    >
      {slots === null ? (
        <EmptyState
          icon={MapIcon}
          title={copy.title}
          description={copy.description}
          action={{ label: copy.action, href: '/tracks' }}
        />
      ) : (
        <RoadmapView slots={slots} />
      )}
    </TrackOverview>
  )
}
