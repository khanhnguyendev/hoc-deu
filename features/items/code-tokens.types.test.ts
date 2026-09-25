// Type-level pin (task 3.3a brief, gate-review fix 1): `components/patterns/code-block.tsx`
// declares its own token types (a pattern may import only components/ui, lib/utils, lib/i18n —
// never lib/content), and `lib/content/code-tokens.ts` declares identical ones for the content
// pipeline. `features/*` may import both, so this file is the single place that keeps them equal.
// These `expectTypeOf` assertions are checked by `pnpm typecheck` (they are no-ops at runtime).
import { describe, expectTypeOf, it } from 'vitest'
import type {
  CodeLine as PatternCodeLine,
  CodeTokenKind as PatternCodeTokenKind,
  HighlightedCode as PatternHighlightedCode,
} from '@/components/patterns/code-block'
import type {
  CodeLine as ContentCodeLine,
  CodeTokenKind as ContentCodeTokenKind,
  HighlightedCode as ContentHighlightedCode,
} from '@/lib/content/code-tokens'

describe('CodeBlock and lib/content declare identical token types', () => {
  it('CodeTokenKind', () => {
    expectTypeOf<ContentCodeTokenKind>().toEqualTypeOf<PatternCodeTokenKind>()
  })

  it('CodeLine', () => {
    expectTypeOf<ContentCodeLine>().toEqualTypeOf<PatternCodeLine>()
  })

  it('HighlightedCode', () => {
    expectTypeOf<ContentHighlightedCode>().toEqualTypeOf<PatternHighlightedCode>()
  })
})
