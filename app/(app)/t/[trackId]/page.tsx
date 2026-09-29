import { MapIcon } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EmptyState } from '@/components/patterns/empty-state'
import { renderItemRow, type CatalogItem, type Mode } from '@/features/items'
import {
  CustomItemsTab,
  customItemSlots,
  getTrackPage,
  hideCustomItem,
  ResetTrackButton,
  roadmapSlots,
  RoadmapView,
  TrackOverview,
  TrackProgress,
  TrackTabs,
  WeakItems,
} from '@/features/roadmap'
import { resetTrack } from '@/features/settings'
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

/** `?tab=custom` opens the "Mục riêng" tab (task 6.6a). */
async function initialTab({ searchParams }: PageProps<'/t/[trackId]'>) {
  const { tab } = await searchParams
  return tab === 'custom' ? 'custom' : 'roadmap'
}

export async function generateMetadata(props: PageProps<'/t/[trackId]'>): Promise<Metadata> {
  const { track } = await load(props)
  return { title: `${track.title} — Học Đều` }
}

/**
 * A track (§2.4): its overview — title, variants, weekly template — and the chosen variant's
 * roadmap, week by week. The page renders each row through the registry with the learner's state
 * (and, for an enrolled learner, the status pill) and hands the slots to RoadmapView (fix 5). A
 * variant without its roadmap file yet shows an empty state (decision 4, RF-4). Task 5.4 (Part
 * B-M3 decision 25): an active or paused enrollment adds the learner's progress with "Bắt đầu lại"
 * (`resetTrack`, passed unbound; the page's request id) and the track's Weak items.
 *
 * Task 5.1c: `load()` (and its `notFound()`) run before anything else, and this segment has no
 * `loading.tsx` (`(app)`'s group-level one was removed), so an unknown, draft-for-a-learner or
 * un-followed retired track answers a real HTTP 404 (`app/(app)/not-found.tsx`) instead of a
 * streamed 200. RoadmapView needs no `<Suspense>` split: its slots are already built by the time
 * this renders.
 *
 * Task 6.6a (§2.4): when the learner has custom items of the track — whatever the AI flag — the
 * roadmap and the "Mục riêng" tab (CustomItemsTab: each item's registry row, "Ẩn" through
 * `hideCustomItem`, passed unbound, with the page's request id) sit in TrackTabs.
 */
export default async function TrackPage(props: PageProps<'/t/[trackId]'>) {
  const data = await load(props)
  const row = (item: CatalogItem, mode?: Mode) =>
    renderItemRow(item, {
      state: data.states[item.id] ?? null,
      mode,
      showStatus: data.enrollment !== null,
    })
  const slots =
    data.view === null
      ? null
      : roadmapSlots(data.view, (item, { mode }) => row(item, mode ?? undefined))
  const custom =
    data.customItems === null ? null : (
      <CustomItemsTab
        data={customItemSlots(data.customItems, (item) => row(item))}
        hide={hideCustomItem}
        requestId={data.requestId}
      />
    )
  const roadmap =
    slots === null ? (
      <EmptyState
        icon={MapIcon}
        title={copy.title}
        description={copy.description}
        action={{ label: copy.action, href: '/tracks' }}
      />
    ) : (
      <RoadmapView slots={slots} />
    )
  const learner =
    data.progress === null ? undefined : (
      <>
        <TrackProgress
          title={data.track.title}
          progress={data.progress}
          actions={
            <ResetTrackButton
              action={resetTrack}
              requestId={data.requestId}
              trackId={data.track.id}
            />
          }
        />
        <WeakItems rows={data.weakItems.map((item) => row(item))} />
      </>
    )
  return (
    <TrackOverview
      track={data.track}
      enrollment={data.enrollment}
      variants={data.variants}
      template={data.template}
      throttle={data.throttle}
      learner={learner}
    >
      {custom === null ? (
        roadmap
      ) : (
        <TrackTabs roadmap={roadmap} custom={custom} initial={await initialTab(props)} />
      )}
    </TrackOverview>
  )
}
