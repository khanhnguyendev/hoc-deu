/**
 * Token types shared by the content pipeline and the `CodeBlock` pattern (task 3.3a).
 *
 * A pattern may import only `components/ui`, `lib/utils` and `lib/i18n` (platform design §7.2),
 * so `components/patterns/code-block.tsx` declares its own copy of `CodeTokenKind`, `CodeLine`
 * and `HighlightedCode` (gate-review fix 1); `features/items/code-tokens.types.test.ts` pins the
 * two declarations equal with `expectTypeOf(...).toEqualTypeOf(...)`, checked by `pnpm typecheck`.
 */
import type { CodeLanguage } from './schemas/common'

export const CODE_TOKEN_KINDS = ['keyword', 'string', 'constant', 'comment'] as const
export type CodeTokenKind = (typeof CODE_TOKEN_KINDS)[number]

/** Plain runs are strings; highlighted runs are [text, kind]; adjacent runs of one kind are merged. */
export type CodeLine = ReadonlyArray<string | readonly [text: string, kind: CodeTokenKind]>

export type HighlightedCode = { lang: string; lines: readonly CodeLine[] }

export type CodeBundle = {
  /** A problem's solution files, by language. */
  solutions: Partial<Record<CodeLanguage, HighlightedCode>>
  /** Fenced blocks of the item's MDX, keyed by `codeBlockKey`. */
  blocks: Readonly<Record<string, HighlightedCode>>
}

/** Removes one trailing `\n` from `code`, if present. */
function trimOneTrailingNewline(code: string): string {
  return code.endsWith('\n') ? code.slice(0, -1) : code
}

/** A 32-bit FNV-1a hash of `input`, as 8 lowercase hex digits. */
function fnv1a32(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * `code` as unhighlighted `HighlightedCode`: one trailing `\n` is removed, the rest is split on
 * `\n` into one plain run per line (an empty line is `[]`). Used for the `text` language and as a
 * fallback when a snippet cannot be highlighted.
 */
export function plainCode(lang: string, code: string): HighlightedCode {
  const lines = trimOneTrailingNewline(code)
    .split('\n')
    .map((line) => (line === '' ? [] : [line]))
  return { lang, lines }
}

/**
 * A stable, opaque key for `code` in `lang`: `${lang}:${fnv1a32 hex of the code without one
 * trailing '\n'}`. The MDX `pre` override gets the fenced block's text with the trailing newline
 * MDX adds (spike finding), and `content:build` keys the same text (`mdxFacts`), so both drop the
 * same newline — a fence whose code itself ends with a blank line keeps it on both sides.
 */
export function codeBlockKey(lang: string, code: string): string {
  return `${lang}:${fnv1a32(trimOneTrailingNewline(code))}`
}
