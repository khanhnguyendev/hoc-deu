# ADR-0002: Supabase with publishable/secret keys; `getClaims()` on the server

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §2.1, §2.3, §2.5

## Context

Supabase replaces the legacy `anon` / `service_role` JWT keys (deprecated by the end of 2026)
with a **publishable** key (`sb_publishable_…`, safe in a browser, RLS applies) and a **secret**
key (`sb_secret_…`, server-only, bypasses RLS). The repository is public and contributors include
an AI bot, so a secret that leaks into a client bundle or a query that runs with the wrong key
must be hard to write by accident.

On the server, the session arrives in cookies that the browser controls. `auth.getSession()`
returns what the cookie says without checking it, so it must not decide who the user is.

## Decision

- **Two keys, two clients.**
  - `lib/supabase/server.ts` — `createClient()`: the per-request client with the user's session
    cookies and the **publishable** key. Every read and learner write goes through it, so RLS
    always applies. The proxy (`lib/supabase/proxy.ts`) builds the same kind of client from the
    request cookies. Both read the URL and key through `publicSupabaseEnv()`, never
    `serverEnv()`.
  - `lib/supabase/admin.ts` — `createAdminClient()`: the **only** app code that uses the secret
    key (`serverEnv().supabaseSecretKey`), behind `import 'server-only'`, with no session
    persistence or refresh (test tooling reads the local stack's key separately, decision 14). It is for system, bot and admin writes (e.g. `apply_system_event`) and never for
    work done on a learner's behalf.
- **Client modules cannot reach server configuration (owner review SF7).** `lib/env.ts` is not
  `server-only` (the proxy and `instrumentation.ts` import it; decision 11), so the ESLint rule
  `layers/imports` rejects any import that resolves to `lib/env` or `lib/supabase/admin` from a
  module whose first statement is `'use client'`. Next.js inlines only `NEXT_PUBLIC_*` values
  into client bundles in any case.
- **`getClaims()`, never `getSession()`, on the server.** The DAL (`lib/auth/dal.ts`) and the
  proxy call `supabase.auth.getClaims()`. It refreshes an expired session, then verifies the
  access token: with asymmetric signing keys, locally against the project's cached JWKS; with a
  symmetric (HS) key, by asking the Auth server (`getUser`). An error or missing claims means
  "signed out". The user's id is `claims.sub`; role and status come from their own `profiles`
  row, read through RLS — never from JWT metadata.
- **No browser Supabase client in M2** (decision 11). Nothing client-side talks to Supabase yet;
  `lib/supabase/client.ts` arrives with its first consumer.

## Consequences

- Easier: RLS is the default path; the secret key has one import site to audit, and a lint error
  stops it — or the env module — from being pulled into a client component.
- Easier: identity checks cost no network round trip once asymmetric keys are on (the JWKS is
  cached).
- Harder: every server entry point must create its own per-request client (`createClient()` is
  async because it awaits `cookies()`); a client is never cached across requests.
- Accepted: role and status changes take effect on the next request (the profile is read per
  request), while the JWT itself stays valid until it expires — access decisions never rely on
  JWT claims beyond `sub`.
