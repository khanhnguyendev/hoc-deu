# ADR-0006: `proxy.ts` only refreshes the session; access checks in layouts + DAL

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §2.1, §2.2

## Context

Next.js 16 renames Middleware to Proxy (`proxy.ts`, a `proxy` export and `config.matcher`; Node
runtime by default). It runs before every matched request, so it is the place where Supabase can
refresh an expired session and write the new cookies — Server Components cannot set cookies.

It is not a good place for authorisation. A matcher change or a moved Server Function silently
removes its coverage (Next's own docs warn about this), server actions are POSTs to whatever page
uses them, and a database query there would run before every page view. Access rules also depend
on the profile (pending, active, admin, onboarded), which lives in the database.

## Decision

- **`proxy.ts`** calls `updateSession()` (`lib/supabase/proxy.ts`) and does nothing else:
  - it builds a server client from the request cookies with the publishable key and calls
    `auth.getClaims()`; refreshed cookies are written to the request (so this request's Server
    Components see them) and to the response, together with the `Cache-Control: private,
    no-store` headers that `@supabase/ssr` hands to `setAll`, so a CDN never caches a response
    that sets auth cookies;
  - a signed-out request for a private page is redirected to `/sign-in?next=<path + query>`,
    keeping any cleared cookies and the no-store headers;
  - **no database queries**;
  - public without a session: exactly `/`, `/sign-in` and `/auth/callback`, plus `/dev` and
    `/dev/**` when `VERCEL_ENV` is not `production` (the component catalog stays open for e2e and
    previews). It reads `process.env.VERCEL_ENV` directly and the Supabase values through
    `publicSupabaseEnv()`;
  - the matcher covers pages only: not `/api/*`, `/_next/static`, `/_next/image`, `favicon.ico`
    or a path whose last segment has a file extension — except `.rsc`, because some platforms
    match React Server Component requests as `/page.rsc` or `/page.segments/….segment.rsc`, and
    those must refresh the session too.
- **Layouts and the DAL decide access.** `lib/auth/dal.ts` exposes `getSessionUser()` (React
  `cache()`: `getClaims()` plus one read of the caller's own profile per request; a missing row
  reads as a pending learner) and the guards:

  | Guard | Passes | Otherwise |
  | --- | --- | --- |
  | `requireUser()` | any signed-in user | `redirect('/sign-in')` |
  | `requireActive()` | `status = 'active'` | `redirect('/pending')` |
  | `requireOnboarded()` | active and onboarded — the `(app)` group | `redirect('/onboarding')` |
  | `requireAdmin()` | active and `role = 'admin'` | `notFound()` (a suspended admin → `/pending`) |
  | `requireDevAccess()` | anyone outside production; an admin in production | as `requireAdmin()` |

  `requireDevAccess()` reads `process.env.VERCEL_ENV` directly: `/dev/*` is prerendered at build
  time, where no runtime secrets exist (decision 10). `lib/auth/paths.ts` holds `homePathFor()`
  (`/pending`, `/onboarding` or `/today`) and `safeNextPath()`, the open-redirect guard for
  `next`: a same-origin path only — no `//`, backslash, control character or space, never
  `/sign-in` or `/auth/…`.
- **Every server action, route handler and feature loader calls a guard first.** Guards:
  `requireUser`, `requireActive`, `requireOnboarded`, `requireAdmin`, `requireDevAccess`,
  `requireBotToken` (bot API), `requireCronSecret` (maintenance cron) and the explicit
  `publicRoute()` marker for handlers that are public on purpose (`lib/auth/guards.ts`,
  `GUARD_NAMES`). The architecture test `tools/guards/server-guards.ts` parses every `*.ts` /
  `*.tsx` file under `app`, `features`, `lib` and `components` with the TypeScript compiler API
  and fails when the first statement of one of these is not a (possibly awaited or assigned) call
  to a guard:
  - every export of a module whose first statement is `'use server'`;
  - every exported `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD` or `OPTIONS` in
    `app/**/route.ts`;
  - every exported async function (also inside `cache()`) in `features/<name>/queries.ts`;
  - every inline server action (a function whose body starts with `'use server'`).

  A re-export or wrapped export it cannot see into counts as a violation.
- **RLS remains the data backstop** (§4.5): a missed guard still cannot read another user's rows.

## Consequences

- Easier: the proxy is small, cheap and stateless; access rules live next to the code they
  protect and are tested with the DAL mocked (`lib/auth/dal.test.ts`).
- Easier: forgetting a guard fails `pnpm verify`, for people and the bot alike.
- Harder: every new action, handler or loader must start with a guard, even a trivial one; public
  handlers must say so with `publicRoute()`.
- Accepted: a signed-out prefetch of a private route is answered with the sign-in redirect; the
  guard check is syntactic (it trusts that a function named `requireUser` is the DAL's).
