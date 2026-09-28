import type { MetadataRoute } from 'next'
import brandTokens from '@/docs/design/brand-kit/brand-tokens.json'

/**
 * `app_icon.tile` reads `"heat-4 (light) #042F2E"` (brand-tokens.json, generated from
 * `docs/design/assets/palette.py`): the app icon's tile colour, also used as the manifest's
 * `theme_color` and `background_color` so the install splash matches the icon exactly. Extracted
 * at runtime, never written as a literal, so the token guard's hex rule never has to allow this
 * file (task 6.0b).
 */
const TILE_HEX = /#[0-9a-fA-F]{6}/.exec(brandTokens.app_icon.tile)?.[0]
if (!TILE_HEX) throw new Error('brand-tokens.json: app_icon.tile has no hex colour')

/** The installable web app manifest, served at `/manifest.webmanifest` (README "Wiring it into the app"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brandTokens.name,
    short_name: brandTokens.name,
    description: brandTokens.tagline,
    start_url: '/today',
    display: 'standalone',
    lang: 'vi',
    theme_color: TILE_HEX,
    background_color: TILE_HEX,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
