import type { NextConfig } from 'next'

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
  // Decision 13: `/admin` is the approval queue until the admin overview (task 5.6). A routing
  // redirect, not a page that calls `redirect()`: the AppShell prefetches its "Quản trị" link, and
  // a prefetched page that redirects kept its render open until the tab closed ("The destination
  // stream closed early", task 2.8). Access is still decided by the `(admin)` layout at
  // `/admin/users`: a non-admin gets the 404 there.
  redirects: async () => [{ source: '/admin', destination: '/admin/users', permanent: false }],
}

export default nextConfig
