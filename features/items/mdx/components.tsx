import type { MDXComponents } from 'mdx/types'
import type { ComponentProps, ComponentType } from 'react'
import type { MdxComponentName } from '@/lib/content/mdx-components'
import { vi } from '@/lib/i18n/vi'
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
  ul: (props: ComponentProps<'ul'>) => (
    <ul {...props} className="list-disc space-y-1 pl-6 marker:text-muted-foreground" />
  ),
  ol: (props: ComponentProps<'ol'>) => (
    <ol {...props} className="list-decimal space-y-1 pl-6 marker:text-muted-foreground" />
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
  th: (props: ComponentProps<'th'>) => (
    <th {...props} className="px-3 py-2 text-left font-semibold whitespace-nowrap" />
  ),
  td: (props: ComponentProps<'td'>) => <td {...props} className="px-3 py-2 align-top" />,
  hr: (props: ComponentProps<'hr'>) => <hr {...props} className="border-border" />,
  strong: (props: ComponentProps<'strong'>) => <strong {...props} className="font-semibold" />,
  em: (props: ComponentProps<'em'>) => <em {...props} className="italic" />,
} satisfies MDXComponents & { [K in MdxComponentName]: ComponentType<never> }
