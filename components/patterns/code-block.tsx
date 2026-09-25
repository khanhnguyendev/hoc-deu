/**
 * Renders build-time-highlighted code as a focusable, horizontally scrollable region
 * (DESIGN_SYSTEM §9 "Code tabs"; task 3.3a). Server-compatible: no hooks, no `'use client'`.
 *
 * A pattern may import only `components/ui`, `lib/utils` and `lib/i18n` (platform design §7.2),
 * so the token types below are this component's own copy — `lib/content/code-tokens.ts` declares
 * an identical set for the content pipeline, and `features/items/code-tokens.types.test.ts` keeps
 * the two equal (`pnpm typecheck`).
 */
import { cn } from '@/lib/utils'

export type CodeTokenKind = 'keyword' | 'string' | 'constant' | 'comment'

/** Plain runs are strings; highlighted runs are [text, kind]; adjacent runs of one kind are merged. */
export type CodeLine = ReadonlyArray<string | readonly [text: string, kind: CodeTokenKind]>

export type HighlightedCode = { lang: string; lines: readonly CodeLine[] }

export type CodeBlockProps = {
  code: HighlightedCode
  /** Accessible name for the scroll region, e.g. "Lời giải Python". */
  label: string
  className?: string
}

/** Decision 13: syntax colours reuse already-verified text tokens, no new design tokens. */
export const CODE_TOKEN_CLASS: Readonly<Record<CodeTokenKind, string>> = {
  keyword: 'text-primary',
  string: 'text-success',
  constant: 'text-warning',
  comment: 'text-muted-foreground italic',
}

/** A zero-width space so an empty line still renders with the line height of a real line. */
const EMPTY_LINE = '​'

function CodeBlock({ code, label, className }: CodeBlockProps) {
  return (
    <pre
      tabIndex={0}
      role="region"
      aria-label={label}
      data-slot="code-block"
      className={cn(
        'overflow-x-auto rounded-md bg-surface-muted p-4 font-mono text-sm whitespace-pre',
        className,
      )}
    >
      {code.lines.map((line, lineIndex) => (
        <span key={lineIndex} className="block">
          {line.length === 0
            ? EMPTY_LINE
            : line.map((run, runIndex) =>
                typeof run === 'string' ? (
                  <span key={runIndex}>{run}</span>
                ) : (
                  <span key={runIndex} className={CODE_TOKEN_CLASS[run[1]]}>
                    {run[0]}
                  </span>
                ),
              )}
        </span>
      ))}
    </pre>
  )
}

export { CodeBlock }
