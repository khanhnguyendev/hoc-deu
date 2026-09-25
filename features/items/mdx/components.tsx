import { Square, SquareCheck } from 'lucide-react'
import type { MDXComponents } from 'mdx/types'
import type { ComponentProps, ComponentType, CSSProperties } from 'react'
import type { MdxComponentName } from '@/lib/content/mdx-components'
import { vi } from '@/lib/i18n/vi'
import { cn } from '@/lib/utils'
import { Bilingual } from '../components/mdx/bilingual'
import { Callout } from '../components/mdx/callout'
import { CodePre } from '../components/mdx/code-pre'
import { Complexity } from '../components/mdx/complexity'
import { ContentImage } from '../components/mdx/content-image'
import { ExternalLink } from '../components/mdx/external-link'
import { Choice, Question, Quiz } from '../components/mdx/quiz'
import { Reveal } from '../components/mdx/reveal'
import { Section } from '../components/mdx/section'
import { Step, Steps } from '../components/mdx/steps'
import { Term } from '../components/mdx/term'
import { contentHeading, TABLE_FRAME } from '../components/mdx/typography'
import { VarTable } from '../components/mdx/var-table'

/** `<Solution />` and `<Practice>` need the page's data: nothing until `mdxComponentsFor` binds them. */
function Unbound(): null {
  return null
}

/**
 * A Markdown table: its own focusable scroll region ("Bảng"), unless a `VarTable` already frames
 * it (`framed={false}`).
 */
function Table({ framed = true, ...props }: ComponentProps<'table'> & { framed?: boolean }) {
  const table = <table className="w-full border-collapse text-sm" {...props} />
  if (!framed) return table
  return (
    <div role="region" tabIndex={0} aria-label={vi.content.table} className={TABLE_FRAME}>
      {table}
    </div>
  )
}

/** GFM marks a task list's `ul` / `ol` with this class (MDX output, not a Tailwind class). */
const TASK_LIST = 'contains-task-list'

type ListProps = ComponentProps<'ul'> & ComponentProps<'ol'>

/** A list's classes: bullets or numbers, none for a task list (its items carry a marker). */
function listClass(className: string | undefined, marker: 'list-disc' | 'list-decimal'): string {
  const task = className?.split(' ').includes(TASK_LIST) ?? false
  return cn('space-y-1 pl-6 marker:text-muted-foreground', task ? 'list-none pl-1' : marker)
}

/**
 * A GFM task-list checkbox (`- [x] …`): MDX renders a disabled, unlabelled `<input>`; show a
 * marker instead — an icon plus visually hidden "Đã xong" / "Chưa xong" — never a control.
 */
function TaskMarker({ type, checked }: ComponentProps<'input'>) {
  if (type !== 'checkbox') return null
  const Icon = checked ? SquareCheck : Square
  return (
    <span data-slot="task-marker" className="mr-2 inline-flex align-text-bottom">
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      <span className="sr-only">{checked ? vi.content.task.done : vi.content.task.todo}</span>
    </span>
  )
}

/** GFM column alignment arrives as `style={{ textAlign }}`; map it to token classes, drop the style. */
const ALIGN: Readonly<Record<string, string>> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

function alignClass(style: CSSProperties | undefined): string | undefined {
  const align = style?.textAlign
  return typeof align === 'string' && Object.hasOwn(ALIGN, align) ? ALIGN[align] : undefined
}

/**
 * The global MDX component map (`mdx-components.tsx`): every allow-listed component (MDX throws
 * on an undefined one) and the Markdown elements content uses, styled with token classes only.
 * Server-safe: no `server-only` import, so the catalog can render the parts too.
 */
export const mdxComponents = {
  Section,
  Callout,
  Steps,
  Step,
  VarTable,
  Complexity,
  Bilingual,
  Solution: Unbound,
  Practice: Unbound,
  Quiz,
  Question,
  Choice,
  Reveal,
  Term,
  h2: (props: ComponentProps<'h2'>) => <h2 {...props} className={contentHeading({ level: 2 })} />,
  h3: (props: ComponentProps<'h3'>) => <h3 {...props} className={contentHeading({ level: 3 })} />,
  h4: (props: ComponentProps<'h4'>) => <h4 {...props} className={contentHeading({ level: 4 })} />,
  p: (props: ComponentProps<'p'>) => <p {...props} />,
  ul: ({ className, ...props }: ListProps) => (
    <ul {...props} className={listClass(className, 'list-disc')} />
  ),
  ol: ({ className, ...props }: ListProps) => (
    <ol {...props} className={listClass(className, 'list-decimal')} />
  ),
  li: (props: ComponentProps<'li'>) => <li {...props} className="pl-1" />,
  a: ExternalLink,
  img: ContentImage,
  blockquote: (props: ComponentProps<'blockquote'>) => (
    <blockquote {...props} className="space-y-2 border-l-4 border-border-strong pl-4" />
  ),
  code: (props: ComponentProps<'code'>) => (
    <code {...props} className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-sm" />
  ),
  // Unbound pages still render fences through the CodeBlock pattern (plain text).
  pre: ({ children }: ComponentProps<'pre'>) => <CodePre code={null}>{children}</CodePre>,
  table: Table,
  thead: (props: ComponentProps<'thead'>) => (
    <thead {...props} className="border-b border-border-strong" />
  ),
  tbody: (props: ComponentProps<'tbody'>) => <tbody {...props} />,
  tr: (props: ComponentProps<'tr'>) => (
    <tr {...props} className="border-b border-border last:border-b-0" />
  ),
  th: ({ style, ...props }: ComponentProps<'th'>) => (
    <th
      {...props}
      className={cn('px-3 py-2 text-left font-semibold whitespace-nowrap', alignClass(style))}
    />
  ),
  td: ({ style, ...props }: ComponentProps<'td'>) => (
    <td {...props} className={cn('px-3 py-2 align-top', alignClass(style))} />
  ),
  hr: (props: ComponentProps<'hr'>) => <hr {...props} className="border-border" />,
  strong: (props: ComponentProps<'strong'>) => <strong {...props} className="font-semibold" />,
  em: (props: ComponentProps<'em'>) => <em {...props} className="italic" />,
  input: TaskMarker,
} satisfies MDXComponents & { [K in MdxComponentName]: ComponentType<never> }
