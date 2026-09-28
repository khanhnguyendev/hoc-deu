import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import brandTokens from '@/docs/design/brand-kit/brand-tokens.json'
import manifest from './manifest'

// The manifest's colours come from brand-tokens.json (task 6.0b): the token guard's hex rule
// would flag a literal here, so `manifest.ts` extracts the hex out of the JSON at runtime and
// this test recomputes it independently, the same way, to check the two agree.
const TILE_HEX = /#[0-9a-fA-F]{6}/.exec(brandTokens.app_icon.tile)?.[0]

describe('app/manifest.ts', () => {
  it('extracted a hex colour from brand-tokens.json', () => {
    expect(TILE_HEX).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('names the app and starts at /today, standalone, in Vietnamese', () => {
    const result = manifest()
    expect(result.name).toBe('Học Đều')
    expect(result.short_name).toBe('Học Đều')
    expect(result.start_url).toBe('/today')
    expect(result.display).toBe('standalone')
    expect(result.lang).toBe('vi')
  })

  it('sets theme_color and background_color from brand-tokens.json (the app icon tile)', () => {
    const result = manifest()
    expect(result.theme_color).toBe(TILE_HEX)
    expect(result.background_color).toBe(TILE_HEX)
  })

  it('lists the 192, 512 and maskable 512 icons, each present under public/', () => {
    const result = manifest()
    const icons = result.icons ?? []
    expect(icons).toHaveLength(3)
    for (const icon of icons) {
      expect(existsSync(join(process.cwd(), 'public', icon.src.replace(/^\//, '')))).toBe(true)
    }
    expect(icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512', '512x512'])
    expect(icons.map((icon) => icon.purpose)).toEqual([undefined, undefined, 'maskable'])
    expect(icons.every((icon) => icon.type === 'image/png')).toBe(true)
  })
})
