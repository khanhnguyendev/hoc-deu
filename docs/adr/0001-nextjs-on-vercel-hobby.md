# ADR-0001: Next.js 16 App Router on Vercel Hobby, non-commercial; offline-safe build

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §2, §2.1, §6.8

## Context

Học Đều is a non-commercial learning platform that must run on free tiers. It needs server-side
auth checks, server actions for writes, cron, and build-time content processing. The daily bot
(v1.1) runs `pnpm verify` inside a Claude Code Routine whose Custom network allows only the app
domain and the package registries, so the build cannot fetch anything else — `next/font/google`
downloads fonts from `fonts.googleapis.com` at build time.

## Decision

- Next.js 16 App Router (React Server Components, server actions, `proxy.ts` instead of
  middleware) deployed on **Vercel Hobby**, used non-commercially per Vercel's fair-use terms.
- **The build is offline-safe.** Fonts (Be Vietnam Pro, JetBrains Mono) are subset to latin +
  vietnamese, committed as `woff2` under `app/fonts/` with their OFL licenses and loaded with
  `next/font/local`; code highlighting runs at build time from bundled grammars (ADR-0011).
  `next/font/google` is banned by ESLint and `tools/guards/offline-build.test.ts`, and the CI
  `verify` job builds with `fonts.googleapis.com` and `fonts.gstatic.com` blocked in `/etc/hosts`.

## Consequences

- Hosting costs nothing; the Hobby limits (§8) bound usage, and any commercial use would need a
  paid plan.
- The bot can run the full `pnpm verify` gate before opening content PRs.
- Font updates are manual: re-run the subset command in `app/fonts/README.md` from a newer
  `google/fonts` commit. The repository carries about 170 KB of font files.
