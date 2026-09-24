import { describe, expect, it } from 'vitest'
import { TOKEN_GUARD_ALLOW } from './token-guard.allow'
import { findTokenViolations, scanRepo } from './token-guard'

const rules = (file: string, source: string) => findTokenViolations(file, source).map((v) => v.rule)

describe('findTokenViolations', () => {
  it('flags hex colours', () => {
    expect(rules('components/patterns/a.tsx', 'const c = "#1C1917"')).toEqual(['hex-colour'])
  })

  it('flags colour functions', () => {
    expect(rules('features/x/b.tsx', "style={{ color: 'oklch(0.5 0.1 180)' }}")).toContain(
      'colour-function',
    )
  })

  it('flags literal units in style props', () => {
    expect(rules('components/ui/c.tsx', '<div style={{ padding: 12px }} />')).toEqual([
      'style-literal-unit',
    ])
  })

  it('allows CSS custom properties that carry data', () => {
    expect(
      rules('components/patterns/ring.tsx', "<div style={{ '--progress': value }} />"),
    ).toEqual([])
  })

  it('flags !important and inline style tags', () => {
    expect(rules('app/x/page.tsx', '<style>{`a { color: red !important }`}</style>')).toEqual([
      'important',
      'inline-style-tag',
    ])
  })

  it('flags any CSS file except the token file', () => {
    expect(rules('components/patterns/extra.css', '.a {}')).toEqual(['css-file'])
    expect(rules('app/globals.css', ':root { --x: #fff !important; }')).toEqual([])
  })
})

describe('repository', () => {
  it('has no hard-coded visual values outside app/globals.css', () => {
    expect(scanRepo(process.cwd(), TOKEN_GUARD_ALLOW)).toEqual([])
  })
})
