import type { Metadata } from 'next'
import type * as React from 'react'
import { ThemeToggle } from '@/components/patterns/theme-toggle'
import { Badge } from '@/components/ui/badge'
import { ExercisePage } from '@/features/items/exercise/Page'
import { pagePropsFor } from '@/features/items/fixtures'
import { FlashcardPage } from '@/features/items/flashcard/Page'
import { LessonPage } from '@/features/items/lesson/Page'
import { ProblemPage } from '@/features/items/problem/Page'
import { PromptPage } from '@/features/items/prompt/Page'
import { renderItemRow } from '@/features/items/render'
import type { ItemStateView } from '@/features/items/types'
import { requireDevAccess } from '@/lib/auth/dal'
import type { CatalogItem } from '@/lib/content/catalog-types'
import { vi } from '@/lib/i18n/vi'
import SampleLesson from '../content/sample-lesson.mdx'
import SampleNote from '../content/sample-note.mdx'
import { HydrationMarker } from '../hydration-marker'
import {
  ADMIN,
  DERIVED_CARD,
  DRAFT_CARD,
  DRAFT_NOTE_PROBLEM,
  FILL_BLANK,
  NOTED_PROBLEM,
  PATTERN_LESSON,
  PREMIUM_PROBLEM,
  REPEATABLE_PROMPT,
  RESPOND,
  REWRITE,
  ROWS,
  SAMPLE_BINDINGS,
  VOCABULARY_CARD,
  WEEKLY_PROMPT,
} from './fixtures'

export const metadata: Metadata = { title: `${vi.dev.itemsTitle} — Học Đều` }

type Demo = { title: string; render: () => React.ReactNode }
/** Like the catalog registry: `file` is checked by tools/guards/component-catalog.test.ts. */
type Entry = { name: string; file: string; demos: Demo[] }

/** Learner states cycled over a Row list: none yet ("Chưa học"), then weak, strong, mastered. */
const STATES: readonly (ItemStateView | null)[] = [
  null,
  { status: 'weak', level: 1, dueOn: '2026-10-02' },
  { status: 'strong', level: 3, dueOn: '2026-11-01' },
  { status: 'mastered', level: 4, dueOn: null },
]

/** A Page demo, named by its item so e2e can find it. */
function PageDemo({ item, children }: { item: CatalogItem; children: React.ReactNode }) {
  return (
    <article aria-label={item.title} className="w-full max-w-prose">
      {children}
    </article>
  )
}

/** One type's gallery rows, through the registry (`renderItemRow`, real hrefs). */
function RowList({ type, showStatus }: { type: string; showStatus: boolean }) {
  return (
    <ul
      role="list"
      className="flex w-full max-w-prose flex-col divide-y divide-border rounded-lg border border-border bg-surface p-1"
    >
      {(ROWS[type] ?? []).map((item, index) => (
        <li key={item.id}>
          {renderItemRow(item, {
            state: STATES[index % STATES.length] ?? null,
            showStatus,
          })}
        </li>
      ))}
    </ul>
  )
}

const rowDemos = (type: string): Demo[] => [
  { title: 'Trong danh sách', render: () => <RowList type={type} showStatus={false} /> },
  {
    title: 'Kèm trạng thái học (showStatus): Chưa học, Yếu, Vững, Thành thạo',
    render: () => <RowList type={type} showStatus />,
  },
]

const NOTE_DATA = { Body: SampleNote, code: SAMPLE_BINDINGS.code }

const ENTRIES: Entry[] = [
  {
    name: 'ProblemPage',
    file: 'features/items/problem/Page.tsx',
    demos: [
      {
        title: 'Có ghi chú đã kiểm thử (sample-note.mdx) và bài học chuyên sâu — người học',
        render: () => (
          <PageDemo item={NOTED_PROBLEM}>
            <ProblemPage {...pagePropsFor(NOTED_PROBLEM, { data: NOTE_DATA })} />
          </PageDemo>
        ),
      },
      {
        title: 'Premium, chưa có ghi chú: bản miễn phí',
        render: () => (
          <PageDemo item={PREMIUM_PROBLEM}>
            <ProblemPage {...pagePropsFor(PREMIUM_PROBLEM)} />
          </PageDemo>
        ),
      },
      {
        title: 'Ghi chú bản nháp, chỉ biên dịch — quản trị viên (người học thấy "Chưa có ghi chú")',
        render: () => (
          <PageDemo item={DRAFT_NOTE_PROBLEM}>
            <ProblemPage
              {...pagePropsFor(DRAFT_NOTE_PROBLEM, { data: NOTE_DATA, viewer: ADMIN })}
            />
          </PageDemo>
        ),
      },
    ],
  },
  { name: 'ProblemRow', file: 'features/items/problem/Row.tsx', demos: rowDemos('problem') },
  {
    name: 'LessonPage',
    file: 'features/items/lesson/Page.tsx',
    demos: [
      {
        title: 'Bài học pattern (sample-lesson.mdx): bài mẫu và bài luyện tập',
        render: () => (
          <PageDemo item={PATTERN_LESSON}>
            <LessonPage
              {...pagePropsFor(PATTERN_LESSON, {
                data: { Body: SampleLesson, code: SAMPLE_BINDINGS.code },
              })}
            />
          </PageDemo>
        ),
      },
    ],
  },
  { name: 'LessonRow', file: 'features/items/lesson/Row.tsx', demos: rowDemos('lesson') },
  {
    name: 'FlashcardPage',
    file: 'features/items/flashcard/Page.tsx',
    demos: [
      {
        title: 'Thẻ từ vựng cốt lõi',
        render: () => (
          <PageDemo item={VOCABULARY_CARD}>
            <FlashcardPage {...pagePropsFor(VOCABULARY_CARD)} />
          </PageDemo>
        ),
      },
      {
        title: 'Thẻ "Giải thích code" (tạo từ ghi chú Two Sum)',
        render: () => (
          <PageDemo item={DERIVED_CARD}>
            <FlashcardPage {...pagePropsFor(DERIVED_CARD)} />
          </PageDemo>
        ),
      },
      {
        title: 'Thẻ bản nháp — quản trị viên',
        render: () => (
          <PageDemo item={DRAFT_CARD}>
            <FlashcardPage {...pagePropsFor(DRAFT_CARD, { viewer: ADMIN })} />
          </PageDemo>
        ),
      },
    ],
  },
  { name: 'FlashcardRow', file: 'features/items/flashcard/Row.tsx', demos: rowDemos('flashcard') },
  {
    name: 'ExercisePage',
    file: 'features/items/exercise/Page.tsx',
    demos: [FILL_BLANK, RESPOND, REWRITE].map((item) => ({
      title: `${vi.items.exercise.kind[item.content.kind]} (${item.content.kind})`,
      render: () => (
        <PageDemo item={item}>
          <ExercisePage {...pagePropsFor(item)} />
        </PageDemo>
      ),
    })),
  },
  { name: 'ExerciseRow', file: 'features/items/exercise/Row.tsx', demos: rowDemos('exercise') },
  {
    name: 'PromptPage',
    file: 'features/items/prompt/Page.tsx',
    demos: [
      {
        title: 'Lặp lại được, có thời lượng riêng (phỏng vấn thử)',
        render: () => (
          <PageDemo item={REPEATABLE_PROMPT}>
            <PromptPage {...pagePropsFor(REPEATABLE_PROMPT)} />
          </PageDemo>
        ),
      },
      {
        title: 'Theo tuần, thời lượng từ estimates.prompt',
        render: () => (
          <PageDemo item={WEEKLY_PROMPT}>
            <PromptPage {...pagePropsFor(WEEKLY_PROMPT)} />
          </PageDemo>
        ),
      },
    ],
  },
  { name: 'PromptRow', file: 'features/items/prompt/Row.tsx', demos: rowDemos('prompt') },
]

const slug = (name: string) => name.toLowerCase()

/**
 * Every item type's Page and Row from fixture catalog items (task 3.4a): server components that
 * read the catalog, so they live here rather than in the client catalog at /dev/components. Like
 * the other /dev pages: open in development and on previews, admin-only in production (§2.4).
 */
export default async function ItemsGalleryPage() {
  await requireDevAccess()
  return (
    <main className="mx-auto flex w-full max-w-app flex-col gap-10 px-4 py-6 md:px-6 lg:px-8">
      <HydrationMarker />
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold md:text-3xl">{vi.dev.itemsTitle}</h1>
        <ThemeToggle />
      </header>
      {ENTRIES.map((entry) => (
        <section
          key={entry.name}
          id={slug(entry.name)}
          aria-labelledby={`${slug(entry.name)}-title`}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${slug(entry.name)}-title`} className="text-xl font-semibold">
              {entry.name}
            </h2>
            <Badge tone="outline">features</Badge>
            <code className="font-mono text-xs text-muted-foreground">{entry.file}</code>
          </div>
          {entry.demos.map((demo) => (
            <div key={demo.title} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">{demo.title}</h3>
              <div className="rounded-lg border border-border bg-background p-4">
                {demo.render()}
              </div>
            </div>
          ))}
        </section>
      ))}
    </main>
  )
}
