# ADR-0019: Cache Components off in v1

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §2.3

## Context

Next.js 16 offers Cache Components (`cacheComponents: true`, `'use cache'`, Partial
Prerendering): pages are prerendered with static shells, and dynamic data must sit behind
`<Suspense>` or be marked cacheable explicitly. That pays off when many visitors share the same
content.

Học Đều is the opposite case. Every screen after sign-in — today's plan, reviews, tracks,
progress, settings, admin — is built from the signed-in user's own rows, read with their JWT
through RLS, on every request. The DAL reads cookies and the profile per request (ADR-0006), and
today's plan depends on the user's day boundary (§5.1). The only shared pages are the landing
page, sign-in and the `/dev` catalog, which are small and already prerendered as ordinary static
routes.

## Decision

- `next.config.ts` does **not** enable `cacheComponents`; no `'use cache'`, `cacheLife` or
  `cacheTag` in v1.
- Per-request deduplication uses React `cache()` (e.g. `getSessionUser()`), which lives for one
  request only. After a write, a server action calls `revalidatePath()` for the affected route so
  the page reloads its data (decision 9).
- Revisit when a shared, content-heavy surface exists whose data is the same for every user
  (e.g. public track catalogues from the generated content bundle).

## Consequences

- Easier: no risk of one user's data landing in a shared cache entry; no Suspense boundaries
  needed only to satisfy prerendering; data flow stays "read on request, write through
  `apply_event`, revalidate".
- Harder: signed-in pages are rendered on every request; this is fine at our scale (1–100
  learners, Vercel Hobby) and costs about what the per-request profile read costs anyway.
- Accepted: turning Cache Components on later is a migration (Next's guide covers it) that must
  audit every `cookies()` / DAL call site.
