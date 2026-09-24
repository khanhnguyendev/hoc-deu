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
}

export default nextConfig
