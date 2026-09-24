import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(path, 'utf8')
const SPEC = 'docs/design/tokens.css'
const GLOBALS = 'app/globals.css'

/** The token spec without its leading review comment. */
function specBody(): string {
  const css = read(SPEC)
  return css.slice(css.indexOf('*/') + 2).trim()
}

describe('design tokens (docs/design/DESIGN_SYSTEM.md)', () => {
  it('app/globals.css contains the token spec verbatim', () => {
    expect(read(GLOBALS)).toContain(specBody())
  })

  it('imports Tailwind before the tokens', () => {
    const globals = read(GLOBALS)
    expect(globals.indexOf('@import "tailwindcss";')).toBeGreaterThanOrEqual(0)
    expect(globals.indexOf('@import "tailwindcss";')).toBeLessThan(globals.indexOf(':root {'))
  })

  it.each([
    'background',
    'surface',
    'surface-muted',
    'surface-sunken',
    'foreground',
    'muted-foreground',
    'subtle-foreground',
    'border',
    'border-strong',
    'ring',
    'primary',
    'primary-foreground',
    'success',
    'warning',
    'danger',
    'track-1',
    'track-8',
    'heat-0',
    'heat-4',
  ])('defines --%s for light and dark', (token) => {
    const globals = read(GLOBALS)
    const light = globals.slice(globals.indexOf(':root {'), globals.indexOf('.dark {'))
    const dark = globals.slice(globals.indexOf('.dark {'))
    expect(light).toContain(`--${token}:`)
    expect(dark).toContain(`--${token}:`)
  })
})
