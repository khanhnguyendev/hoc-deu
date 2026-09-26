# ADR-0003: Google + GitHub OAuth only; env-gated test login for local and CI

- **Status:** accepted
- **Date:** 2026-09-24
- **Spec:** platform design §2.2, §2.3, §2.4, §2.5; decisions 4, 14, 20, 23

## Context

Học Đều is a small, non-commercial learning platform whose learners are software developers. It
must not store passwords or run e-mail flows (confirmation, reset) it would have to secure and pay
for, and sign-up is open but gated: a new account waits for an admin's approval. The first admin
cannot be approved by anyone, so the platform needs a bootstrap that the owner controls.

End-to-end tests and local development need to sign in without a real Google or GitHub account,
and CI runs a **production build** against a local Supabase stack, so `NODE_ENV` cannot tell a
test run from production.

## Decision

- **Providers: Google and GitHub only.** `/sign-in` offers "Tiếp tục với Google" and "Tiếp tục
  với GitHub"; each is a form that posts to the `signInWithProvider` server action, which calls
  `signInWithOAuth` with `redirectTo = <site URL>/auth/callback?next=<safe next>` and redirects to
  the provider. The flow is **PKCE**: `@supabase/ssr` keeps the code verifier in a cookie, only
  its challenge leaves the browser. The site URL is `NEXT_PUBLIC_SITE_URL`, or
  `https://$VERCEL_BRANCH_URL` on previews (decision 20).
- **Callback.** `GET /auth/callback` (a `publicRoute()` handler) exchanges `code` for a session.
  No code (the user cancelled, the provider sent `?error=`) or a failed exchange returns to
  `/sign-in?error=oauth` — keeping a safe `next`, so another try still ends where the user was
  going — and the page shows "Đăng nhập không thành công. Bạn thử lại nhé." On success, the
  sign-in is completed (below).
- **Completing a sign-in** (`lib/auth/sign-in.ts`, shared by the callback and the test login):
  1. **Admin bootstrap** (§2.5, `lib/auth/bootstrap.ts`): if the account's e-mail is
     **provider-verified** (`email_confirmed_at` set) and in `ADMIN_EMAILS` (exact match after
     trimming and lower-casing), the secret-key client calls `admin_bootstrap(user_id)`. That
     function promotes only a **never-processed** profile — learner, pending, `approved_at` null —
     and only while **no active admin exists**, to an active admin and records
     `admin.bootstrapped`; otherwise it is a no-op (decision 23, ADR-0004). So a rejection,
     suspension or demotion by an admin is never overridden by the env list — not even after the
     listed account deletes itself and signs up again — and removing an address demotes no one.
  2. **Where next:** the `next` parameter if `safeNextPath()` accepts it (same-origin path, never
     `/sign-in` or `/auth/…`), else the home path from the profile **read fresh** through the
     session client — not the request-cached DAL, which may predate the bootstrap: `/pending`
     (not active), `/onboarding` (active, not onboarded) or `/today`.
  3. **A failure here** (the bootstrap RPC, or the profile read) happens *after* the code exchange
     already created a session: the callback signs it out locally (`scope: 'local'`, cookies only)
     and returns to `/sign-in?error=oauth` the same way a failed exchange does, instead of a bare
     500 — route handlers bypass `error.tsx` (M2 minor).
- **Approval happens in the app only.** Every new account is a pending learner (the
  `on_auth_user_created` trigger). An admin approves, rejects or suspends it in `/admin/users`
  (task 2.8). There is no invite list, domain allow-list or provider-side gate.
- **Test login, locked twice.** `AUTH_TEST_LOGIN=true` adds a "Đăng nhập thử nghiệm" e-mail/password
  form to `/sign-in` for synthetic users (`signInWithTestLogin` → `signInWithPassword` → the same
  completion as OAuth). The locks:
  1. `lib/env.ts` throws at startup when `AUTH_TEST_LOGIN=true` and `VERCEL_ENV=production`, and
     the server action itself refuses unless `serverEnv().authTestLogin` — hiding the form is not
     the lock.
  2. The hosted Supabase projects (staging and production) have the **e-mail provider disabled**,
     so a password sign-in fails there even if the flag were set.
  A wrong e-mail or password shows "Email hoặc mật khẩu không đúng."
- **Test users are synthetic.** `supabase/seed.sql` seeds three users for manual local use only
  (`admin@`, `learner@`, `pending@example.test`, password `test-password-123`). End-to-end tests
  create their own users through the local stack's admin API — one per test, so the parallel
  desktop and mobile projects never race — and delete them afterwards (decision 14). The e2e
  environment lists one `ADMIN_EMAILS` address per bootstrap scenario.
- **Route groups decide access after sign-in** (§2.2, ADR-0006): `(public)` has no guard;
  `(account)` → `requireUser()`; `(onboarding)` → `requireActive()`, and an onboarded user goes
  to `/today`; `(app)` → `requireOnboarded()` and the AppShell. A signed-in user who opens
  `/sign-in` goes to their home path.
- **Sign-out stays global scope by default** (`signOut`, `features/auth/actions.ts`) — an owner
  decision left open at M2, recorded here as a ruling the owner can overturn. A failed global
  sign-out falls back to a local one (cookies only), so the browser's own session is cleared
  either way; a failure there too throws (nothing more local left to fall back to), and the
  account menu awaits the action and shows a toast on a genuine rejection (M2 minor) — calling a
  redirecting action directly (not through `useActionState`) still rejects the promise with a
  `NEXT_REDIRECT`-digest error on the *ordinary, successful* path too (the navigation itself
  already happened by then), so the handler recognises and ignores that shape rather than
  toasting it. `deleteAccount` (§4.6) checks its own local sign-out's error too, but never blocks
  the redirect on it (ruling): the account row is already gone by then, so a thrown error there
  would be misleading (auth-js has already cleared the session client-side for most error cases
  regardless) — it redirects to the deleted notice either way.

## Consequences

- Easier: no passwords, password resets or confirmation e-mails in production; the provider
  verifies the e-mail that the bootstrap relies on.
- Easier: CI and local runs exercise the real session, cookies, guards and bootstrap with the
  same code path as OAuth after the provider step.
- Harder: the real Google and GitHub round trip cannot run in CI. The e2e suite checks that each
  button starts the provider flow with the right callback URL and `next`; signing in with the real
  providers on a staging preview is an **owner check** at the PR stop (decision 4).
- Harder: a learner without a Google or GitHub account cannot join. Accepted for the audience.
- Accepted: the env list only ever promotes a brand-new account. If no active admin remains, the
  runbook's break-glass SQL restores one (task 2.2, ADR-0004).
