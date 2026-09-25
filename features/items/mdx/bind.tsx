import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import type { CodeBundle } from '@/lib/content/code-tokens'
import type { CodeLanguage } from '@/lib/content/schemas/common'
import { CodePre } from '../components/mdx/code-pre'
import { PracticeCard, type PracticeTarget } from '../components/mdx/practice-card'
import { SolutionTabs } from '../components/mdx/solution-tabs'

export type { PracticeTarget }

/** What one page binds its MDX body to: its highlighted code and how to resolve practice links. */
export type MdxBindings = {
  /** The item's build-time highlighted code (content:build), or null when it has none. */
  code: CodeBundle | null
  /** The viewer's solution language: the tab `<Solution />` opens on. */
  codeLanguage: CodeLanguage
  /** A `<Practice problem>` ID → its card, or null when the catalog does not know it. */
  resolvePractice: (itemId: string) => PracticeTarget | null
}

/**
 * Per-page components merged over the global map (`<Body components={mdxComponentsFor(…)} />`;
 * MDX spreads `props.components` last): `Solution`, `Practice` and `pre`. Server-safe — the page
 * calls it while rendering; only serialisable data reaches the client `SolutionTabs`.
 */
export function mdxComponentsFor(bindings: MdxBindings): MDXComponents {
  const { code, codeLanguage, resolvePractice } = bindings

  function Solution() {
    if (code === null) return null
    return <SolutionTabs solutions={code.solutions} defaultLanguage={codeLanguage} />
  }

  function Practice({ problem }: { problem: string }) {
    const target = resolvePractice(problem)
    return target === null ? null : <PracticeCard {...target} />
  }

  function Pre({ children }: { children?: ReactNode }) {
    return <CodePre code={code}>{children}</CodePre>
  }

  return { Solution, Practice, pre: Pre }
}
