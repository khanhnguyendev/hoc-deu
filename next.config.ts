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
  // `lib/content/tracks.ts` reads these at request time (decision 12); Next only traces files a
  // page's static analysis can see, and YAML read through the `yaml` package is invisible to
  // that trace, so every route needs them named explicitly. `next start` reads the repo folder
  // directly, so only a Vercel deployment (`output: 'standalone'`) proves this — owner check,
  // task 2.2.
  outputFileTracingIncludes: {
    '/**': ['content/tracks/*/track.yaml'],
  },
  // OD3: MDX images come from the one allow-listed Supabase Storage bucket; the pattern is built
  // from the same constant the MDX safety check enforces (tools/content/allowlist.ts).
  images: { remotePatterns: contentImageRemotePatterns() },
  // Decision 13: `/admin` is the approval queue until the admin overview (task 5.6). A routing
  // redirect, not a page that calls `redirect()`: the AppShell prefetches its "Quản trị" link, and
  // a prefetched page that redirects kept its render open until the tab closed ("The destination
  // stream closed early", task 2.8). Access is still decided by the `(admin)` layout at
  // `/admin/users`: a non-admin gets the 404 there.
  redirects: async () => [{ source: '/admin', destination: '/admin/users', permanent: false }],
}

export default withMDX(nextConfig)
