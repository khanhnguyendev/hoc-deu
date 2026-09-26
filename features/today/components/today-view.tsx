import { Banner } from '@/components/patterns/banner'
import { ErrorState } from '@/components/patterns/error-state'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import { fill, formatDay, formatDayLong, formatMinutes, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TodayState } from '@/lib/plans/today'
import { EMPTY_BLOCK_SLOTS, type TodaySlots } from '../slots'
import type { BlockView, TodayPage } from '../view-model'
import { MarkPlanSeen, type MarkPlanSeenAction } from './mark-plan-seen'
import { PausedBanner } from './paused-banner'
import { PlanBlockCard } from './plan-block-card'
import type { ResumeAction } from './resume-button'
import { ThrottleNotice } from './throttle-notice'
import { TodayEmpty } from './today-empty'
import { TodayStats } from './today-stats'
import { WeakAreas } from './weak-areas'

const copy = vi.today

type TodayViewProps = {
  page: TodayPage
  /** Each block's registry rows and shadowing sentences (`todaySlots(page)`, built by the page). */
  slots: TodaySlots
  /** `markPlanSeen` and `resumeTodayAction`, unbound, from the page. */
  markPlanSeen: MarkPlanSeenAction
  resumeToday: ResumeAction
}

type PlanState = Extract<TodayState, { kind: 'plan' | 'resumed' | 'paused' }>

/** The plan section's title: today's plan, the paused plan's leftovers, or the resumed plan. */
function sectionTitle(state: PlanState): string {
  switch (state.kind) {
    case 'plan':
      return copy.plan.today
    case 'paused':
      return copy.paused.unfinished
    case 'resumed':
      return fill(copy.plan.ofDate, { date: formatDay(state.plan.planDate) })
  }
}

function summary(blocks: readonly BlockView[]): string {
  const minutes = blocks.reduce((sum, view) => sum + view.minutes, 0)
  return fill(copy.plan.summary, {
    blocks: formatNumber(blocks.length),
    minutes: formatMinutes(minutes),
  })
}

/**
 * The plan, resumed and paused states (DESIGN_SYSTEM §5 dashboard order): the paused banner or the
 * resumed header, the throttle notices, then the blocks in a 2/3 column and the stats and weak
 * areas in a 1/3 column (one column below 1024 px).
 */
function Dashboard({
  page,
  state,
  slots,
  resumeToday,
}: Omit<TodayViewProps, 'markPlanSeen'> & { state: PlanState }) {
  return (
    <>
      {state.kind === 'paused' && (
        <PausedBanner
          planDate={state.plan.planDate}
          offerResume={state.offerResume}
          resume={resumeToday}
        />
      )}
      {state.kind === 'resumed' && <Banner tone="info">{copy.resumed}</Banner>}
      {page.tracks.map((track) => (
        <ThrottleNotice key={track.trackId} track={track} />
      ))}
      <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Section
            title={sectionTitle(state)}
            description={page.blocks.length > 0 ? summary(page.blocks) : undefined}
          >
            {page.blocks.length === 0 ? (
              <TodayEmpty kind="noBlocks" />
            ) : (
              <ul role="list" className="flex flex-col gap-3 md:gap-4">
                {page.blocks.map((view) => (
                  <li key={view.block.id}>
                    <PlanBlockCard view={view} slots={slots[view.block.id] ?? EMPTY_BLOCK_SLOTS} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <TodayStats streak={page.streak} tracks={page.tracks} />
          <WeakAreas topics={page.weakTopics} />
        </div>
      </div>
    </>
  )
}

/**
 * `/today` (§2.4, §5.2, §5.4): the page header with today's date, then per state — the dashboard
 * (plan, resumed, paused), "Bắt đầu vào {date}", the no-track empty state, or the error state of
 * an unreadable plan. `<MarkPlanSeen>` marks today's plan once the browser has rendered it
 * (ADR-0039). No mode badge in v1.0 (decision 12). Server-compatible: its client leaves
 * (MarkPlanSeen, ResumeButton) take the actions as props.
 */
function TodayView({ page, slots, markPlanSeen, resumeToday }: TodayViewProps) {
  const { state } = page.data
  return (
    <>
      <PageHeader title={vi.nav.today} description={formatDayLong(page.data.today)} />
      {state.kind === 'notStarted' && <TodayEmpty kind="notStarted" startDate={state.startDate} />}
      {state.kind === 'noTracks' && <TodayEmpty kind="noTracks" />}
      {state.kind === 'unreadable' && (
        <ErrorState
          title={copy.empty.unreadable.title}
          description={copy.empty.unreadable.description}
        />
      )}
      {(state.kind === 'plan' || state.kind === 'resumed' || state.kind === 'paused') && (
        <Dashboard page={page} state={state} slots={slots} resumeToday={resumeToday} />
      )}
      {page.markSeenPlanId !== null && (
        <MarkPlanSeen planId={page.markSeenPlanId} markPlanSeen={markPlanSeen} />
      )}
    </>
  )
}

export { TodayView }
export type { TodayViewProps }
