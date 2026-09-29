import type * as React from 'react'
import { Banner } from '@/components/patterns/banner'
import { Badge } from '@/components/ui/badge'
import { vi } from '@/lib/i18n/vi'
import { LandingFooter } from './landing-footer'
import { MissedDayGrid } from './missed-day-grid'
import { StartLink } from './sign-in-link'
import { TodayPreview } from './today-preview'

const copy = vi.landing

/** A titled band of the page; screen readers list it by its heading. */
function Band({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 md:gap-8">
      <h2 id={id} className="text-3xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

/** A track sheet: hairline border, the 4 px track stripe, a title and its facts. */
function TrackSheet({
  accent,
  badge,
  title,
  facts,
}: {
  accent: 'track-1' | 'track-2'
  badge: string
  title: string
  facts: readonly string[]
}) {
  return (
    <article
      data-slot="track-sheet"
      data-accent={accent}
      className="flex overflow-hidden rounded-lg border border-border bg-surface"
    >
      <span aria-hidden="true" className="w-1 shrink-0 bg-track" />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-semibold">{title}</h3>
          <Badge tone="track">{badge}</Badge>
        </div>
        <ul className="flex flex-col divide-y divide-border">
          {facts.map((fact) => (
            <li key={fact} className="py-2 text-base first:pt-0 last:pb-0">
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}

/**
 * The signed-out landing page (§2.4, DESIGN_SYSTEM §15): a split hero (headline, lead, "Bắt đầu
 * học", and an example day), how a day works, the two tracks, "a missed day costs one day" over a
 * static heat grid, and a close. The `?account=deleted` notice (§4.6) sits above everything.
 */
function Landing({ deleted = false }: { deleted?: boolean }) {
  return (
    <div data-slot="landing" className="flex flex-col gap-16 md:gap-24">
      {deleted && <Banner tone="info">{copy.deletedBanner}</Banner>}
      <section className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <h1 className="text-4xl font-bold text-balance md:text-5xl lg:text-6xl">
            <span className="block">{copy.headline.first}</span>{' '}
            <span className="block">{copy.headline.second}</span>
          </h1>
          <p className="text-lg text-muted-foreground">{copy.lead}</p>
          <div className="flex flex-col items-start gap-3">
            <StartLink />
            <p className="text-sm text-muted-foreground">{copy.ctaNote}</p>
          </div>
        </div>
        <div className="lg:col-span-7">
          <TodayPreview />
        </div>
      </section>

      <Band id="landing-day" title={copy.day.title}>
        <ol className="grid md:grid-cols-3">
          {copy.day.steps.map((step) => (
            <li
              key={step.title}
              className="flex flex-col gap-2 border-l border-muted-foreground pb-8 pl-5 last:pb-0 md:border-t md:border-l-0 md:pt-5 md:pr-8 md:pb-0 md:pl-0"
            >
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-base text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </Band>

      <Band id="landing-tracks" title={copy.tracks.title}>
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <TrackSheet accent="track-1" {...copy.tracks.dsa} />
          <TrackSheet accent="track-2" {...copy.tracks.english} />
        </div>
      </Band>

      <section
        aria-labelledby="landing-missed"
        className="grid items-center gap-8 rounded-xl border border-border bg-surface-sunken p-5 md:p-8 lg:grid-cols-12 lg:gap-12"
      >
        <div className="flex flex-col gap-4 lg:col-span-5">
          <h2 id="landing-missed" className="text-3xl font-semibold">
            {copy.missed.title}
          </h2>
          <p className="text-lg text-muted-foreground">{copy.missed.body}</p>
        </div>
        <div className="lg:col-span-7">
          <MissedDayGrid />
        </div>
      </section>

      <section
        aria-labelledby="landing-close"
        className="flex flex-col items-start gap-6 border-t border-border-strong pt-10"
      >
        <h2 id="landing-close" className="text-3xl font-semibold">
          {copy.close.title}
        </h2>
        <StartLink />
        <p className="text-sm text-muted-foreground">{copy.close.ai}</p>
      </section>
      <LandingFooter />
    </div>
  )
}

export { Landing }
