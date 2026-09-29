import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The brand kit (`docs/design/brand-kit/`) is the source of truth (task 6.0b, README "Wiring it
 * into the app"): each of these app-level files must be a byte-for-byte copy of its brand-kit
 * source, so a regenerated kit that is not re-copied here fails CI instead of drifting silently.
 */
const COPIES: ReadonlyArray<readonly [string, string]> = [
  ['app/icon.svg', 'docs/design/brand-kit/svg/app-icon/favicon.svg'],
  ['app/favicon.ico', 'docs/design/brand-kit/png/favicon.ico'],
  ['app/apple-icon.png', 'docs/design/brand-kit/png/apple-touch-icon.png'],
  ['app/opengraph-image.png', 'docs/design/brand-kit/png/og-image.png'],
  ['public/icon-192.png', 'docs/design/brand-kit/png/icon-192.png'],
  ['public/icon-512.png', 'docs/design/brand-kit/png/icon-512.png'],
  ['public/icon-maskable-512.png', 'docs/design/brand-kit/png/icon-maskable-512.png'],
]

describe('brand kit copies stay byte-for-byte in sync', () => {
  it.each(COPIES)('%s matches %s', (copy, source) => {
    const copyBytes = readFileSync(join(process.cwd(), copy))
    const sourceBytes = readFileSync(join(process.cwd(), source))
    expect(copyBytes.equals(sourceBytes)).toBe(true)
  })
})
