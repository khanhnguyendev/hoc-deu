import createMDX from '@next/mdx'
import type { NextConfig } from 'next'
import { contentImageRemotePatterns } from './tools/content/allowlist'
import { REMARK_PLUGIN_NAMES } from './tools/content/mdx/remark-plugins'

// Content MDX (ADR-0011): compiled with exactly the remark plugins the MDX safety check parses with
// (one shared list), by name — Turbopack cannot take plugin functions. No `pageExtensions`: there
// are no MDX routes; pages import MDX through the generated import map.
const withMDX = createMDX({
  extension: /\.mdx$/,
  options: { remarkPlugins: [...REMARK_PLUGIN_NAMES] },
})

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No `outputFileTracingIncludes`: the track manifests come from the generated catalog bundled
  // into the server build (`lib/content/tracks.ts`, decision 6), so no route reads track.yaml.
  // OD3: MDX images come from the one allow-listed Supabase Storage bucket; the pattern is built
  // from the same constant the MDX safety check enforces (tools/content/allowlist.ts).
  images: { remotePatterns: contentImageRemotePatterns() },
  // No redirects: M2's `/admin` → `/admin/users` (decision 13, ruling R12) ended with the admin
  // overview page (task 5.6); the `(admin)` layout decides access there, a non-admin gets the 404.
}

export default withMDX(nextConfig)
