import { Banner } from '@/components/patterns/banner'
import { PageHeader } from '@/components/patterns/page-header'
import { Section } from '@/components/patterns/section'
import { CheckInButton, CheckInSheet, type CheckInAction } from '@/features/checkin'
import type { RecordOutcome } from '@/features/items/outcome'
import { fill, formatDay, formatDayLong, formatMinutes, formatNumber } from '@/lib/i18n/format'
import { vi } from '@/lib/i18n/vi'
import type { TodayState } from '@/lib/plans/today'
import { EMPTY_BLOCK_SLOTS, type TodaySlots } from '../slots'
import type { BlockView, TodayPage } from '../view-model'
import { CardBlock } from './card-block'
import { ExtraButton, type AddExtraAction } from './extra-button'
import { MarkPlanSeen, type MarkPlanSeenAction } from './mark-plan-seen'
import { PausedBanner } from './paused-banner'
import { blockLabel, PlanBlockCard } from './plan-block-card'
import type { ResumeAction } from './resume-button'
import { ThrottleNotice } from './throttle-notice'
import { TodayEmpty } from './today-empty'
import { TodayStats } from './today-stats'
import { UnreadablePlan } from './unreadable-plan'
import { WeakAreas } from './weak-areas'

const copy = vi.today

type TodayViewProps = {
  page: TodayPage
  /** Each block's registry rows and shadowing sentences (`todaySlots(page)`, built by the page). */
  slots: TodaySlots
  /** `markPlanSeen`, `resumeTodayAction`, `checkInBlock`, `addExtraAction` and `recordOutcome`,
   *  unbound, from the page. */
  markPlanSeen: MarkPlanSeenAction
  resumeToday: ResumeAction
  checkIn: CheckInAction
  addExtra: AddExtraAction
  record: RecordOutcome
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
 * resumed header, the throttle notices, then the blocks — and under them "Học thêm" per track in
 * the plan and resumed states (task 5.4) — in a 2/3 column and the stats and weak areas in a 1/3
 * column (one column below 1024 px). Each block without a check-in gets the one-tap button;
 * check-ins go to the plan shown (decision 13 — the paused plan while the gate is closed). A
 * card-only block grades its cards inline (CardBlock, decision 19). `?block=` opens that block's
 * check-in sheet (§2.4).
 */
function Dashboard({
  page,
  state,
  slots,
  resumeToday,
  checkIn,
  addExtra,
  record,
}: Omit<TodayViewProps, 'markPlanSeen'> & { state: PlanState }) {
  const planId = state.plan.id
  const open = page.blocks.find((view) => view.block.id === page.openBlockId)
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
                {page.blocks.map((view) => {
                  const blockSlots = slots[view.block.id] ?? EMPTY_BLOCK_SLOTS
                  return (
                    <li key={view.block.id}>
                      <PlanBlockCard
                        view={view}
                        slots={blockSlots}
                        cards={
                          blockSlots.cards === null ? undefined : (
                            <CardBlock
                              cards={blockSlots.cards}
                              items={blockSlots.items}
                              requestId={page.requestId}
                              record={record}
                            />
                          )
                        }
                        paused={state.kind === 'paused'}
                        actions={
                          view.checkIn === null ? (
                            <CheckInButton
                              action={checkIn}
                              requestId={page.requestId}
                              planId={planId}
                              blockId={view.block.id}
                              blockLabel={blockLabel(view)}
                            />
                          ) : undefined
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </Section>
          {page.extra.length > 0 && (
            <Section title={vi.extra.add.title} description={vi.extra.add.description}>
              <ul role="list" className="flex flex-col gap-3">
                {page.extra.map((extra) => (
                  <li key={extra.trackId}>
                    <ExtraButton view={extra} requestId={page.requestId} action={addExtra} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <TodayStats streak={page.streak} tracks={page.tracks} />
          <WeakAreas topics={page.weakTopics} />
        </div>
      </div>
      {open !== undefined && (
        <CheckInSheet
          key={open.block.id}
          action={checkIn}
          requestId={page.requestId}
          planId={planId}
          block={{
            id: open.block.id,
            kindLabel: open.kindLabel,
            trackTitle: open.trackTitle,
            estMinutes: open.minutes,
            defaultMinutes: open.defaultMinutes,
            checkIn: open.checkIn,
          }}
        />
      )}
    </>
  )
}

/**
 * `/today` (§2.4, §5.2, §5.4): the page header with today's date, then per state — the dashboard
 * (plan, resumed, paused), "Bắt đầu vào {date}", the no-track empty state, or the error state of
 * an unreadable plan (UnreadablePlan, with "Thử lại"). `<MarkPlanSeen>` marks today's plan once
 * the browser has rendered it (ADR-0039). No mode badge in v1.0 (decision 12). Server-compatible:
 * its client leaves (MarkPlanSeen, ResumeButton, CheckInButton, CheckInSheet, ExtraButton,
 * CardBlock) take the actions as props.
 */
function TodayView({
  page,
  slots,
  markPlanSeen,
  resumeToday,
  checkIn,
  addExtra,
  record,
}: TodayViewProps) {
  const { state } = page.data
  return (
    <>
      <PageHeader title={vi.nav.today} description={formatDayLong(page.data.today)} />
      {state.kind === 'notStarted' && <TodayEmpty kind="notStarted" startDate={state.startDate} />}
      {state.kind === 'noTracks' && <TodayEmpty kind="noTracks" />}
      {state.kind === 'unreadable' && <UnreadablePlan />}
      {(state.kind === 'plan' || state.kind === 'resumed' || state.kind === 'paused') && (
        <Dashboard
          page={page}
          state={state}
          slots={slots}
          resumeToday={resumeToday}
          checkIn={checkIn}
          addExtra={addExtra}
          record={record}
        />
      )}
      {page.markSeenPlanId !== null && (
        <MarkPlanSeen planId={page.markSeenPlanId} markPlanSeen={markPlanSeen} />
      )}
    </>
  )
}

export { TodayView }
export type { TodayViewProps }
