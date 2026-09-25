import type { Metadata } from 'next'
import { ThemeToggle } from '@/components/patterns/theme-toggle'
import { mdxComponentsFor } from '@/features/items/mdx/bind'
import { requireDevAccess } from '@/lib/auth/dal'
import { vi } from '@/lib/i18n/vi'
import { HydrationMarker } from '../hydration-marker'
import { SAMPLE_BINDINGS } from './fixtures'
import SampleLesson from './sample-lesson.mdx'
import SampleNote from './sample-note.mdx'

export const metadata: Metadata = { title: `${vi.dev.contentTitle} — Học Đều` }

/**
 * The MDX samples through `@next/mdx` and the content components (task 3.3b) — imported directly,
 * not through the catalog, so the pipeline PR proves the MDX build without content. Like the
 * other /dev pages: open in development and on previews, admin-only in production (§2.4).
 */
export default async function ContentSamplesPage() {
  await requireDevAccess()
  const components = mdxComponentsFor(SAMPLE_BINDINGS)
  return (
    <main className="mx-auto flex w-full max-w-prose flex-col gap-10 px-4 py-6 md:px-6">
      <HydrationMarker />
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold md:text-3xl">{vi.dev.contentTitle}</h1>
        <ThemeToggle />
      </header>
      <article aria-label={vi.dev.sampleLesson} className="flex flex-col gap-10">
        <SampleLesson components={components} />
      </article>
      <article aria-label={vi.dev.sampleNote} className="space-y-4">
        <SampleNote components={components} />
      </article>
    </main>
  )
}
