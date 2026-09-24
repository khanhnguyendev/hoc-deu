# Staging runbook

Sets up the staging environment — a Supabase project plus Vercel Preview deployments — that PRs
are checked against before merging to `main`. No secrets, project refs or e-mail addresses live in
this file or in the repo; every value below is a placeholder the owner fills in by hand. This is
the repo part of task 2.2 (implementation plan, Part B-M2); the clicks it describes are the
owner's, done once and re-used by every later PR.

See also: `docs/adr/0003-oauth-and-test-login.md` (OAuth and test-login design), decision 20
(`docs/plans/2026-09-24-implementation-plan.md`, site URL on previews), decision 23 (admin
bootstrap only touches a never-processed profile, and only while no active admin exists) and
platform design §2.5 (environment variables and admin bootstrap).

## 1. Environments

| Environment | Where | Auth |
| --- | --- | --- |
| Local | Docker (`pnpm db:start`), `next dev` | Test login on (`AUTH_TEST_LOGIN=true`) |
| Staging | Vercel **Preview** deployments — every branch, `main` included — + Supabase project `hoc-deu-staging` | Google/GitHub OAuth only — hosted e-mail provider disabled |
| Production | Vercel **Production** deployment + a separate Supabase project — none until task 5.8 (§5 step 2) | Google/GitHub OAuth only (task 5.8) |

## 2. Create the Supabase staging project

1. Create a project named `hoc-deu-staging` in region `ap-southeast-1` (Singapore), on
   Postgres **16 or later** (Supabase's default, 17, is right; local runs 17 —
   `supabase/config.toml`). The migrations call `pg_input_is_valid`, which Postgres 15 lacks, so
   `db push` fails on an older project.
2. Note the project URL and the **publishable** and **secret** keys (Settings → API) — never the
   legacy `anon` / `service_role` keys; the app reads `sb_publishable_…` and `sb_secret_…`.
3. Auth → Providers: **disable Email.** This is the second lock on the test login (ADR-0003):
   `AUTH_TEST_LOGIN` can never be set to `true` on a hosted deployment, but even if it were, a
   password sign-in against a hosted project with Email disabled still fails.
4. Link the local CLI and push the schema:

   ```bash
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   pnpm exec supabase migration list
   ```

   The last command must show local and remote at the same version. **Never** run
   `db push --include-seed`: `supabase/seed.sql` seeds synthetic users for the local stack only —
   it must never run against a hosted project.

## 3. Auth URLs

In the staging project's Auth → URL Configuration:

- **Site URL:** the stable preview alias of the `main` branch,
  `https://hoc-deu-git-main-<vercel-scope>.vercel.app` — `main` builds as a Preview until task 5.8
  (§5 step 2), so this alias always serves the latest `main` with the staging variables.
- **Redirect allow-list:**
  - `https://hoc-deu-*-<vercel-scope>.vercel.app/**`
  - `http://localhost:3000/**`

Every branch-specific preview URL matches the wildcard, so a fresh preview needs no allow-list
change. If the allow-list is missing an entry, GoTrue silently falls back to the Site URL and the
OAuth code lands on `/` instead of `/auth/callback` — no error is shown, so check the allow-list
first when a staging sign-in ends up on the wrong page (§6a below).

## 4. Google and GitHub OAuth apps

**Google** (Google Cloud console → APIs & Services → Credentials):

1. Configure the OAuth consent screen as **External**, in **Testing**, with the owner's Google
   account as a test user.
2. Create an OAuth client; set its authorised redirect URI to
   `https://<ref>.supabase.co/auth/v1/callback` (the staging project's own callback, not the
   Vercel URL).
3. Paste the client ID and secret into the staging project's Auth → Providers → Google.

**GitHub** (GitHub → Settings → Developer settings → OAuth Apps):

1. Create an OAuth app whose callback URL is the same Supabase URL as above.
2. Paste the client ID and secret into the staging project's Auth → Providers → GitHub.

## 5. Create the Vercel project

1. Import the GitHub repo as a Vercel project named `hoc-deu` (claims `hoc-deu.vercel.app`,
   platform design §9.3). Node version 22.
2. Settings → Git → **Production Branch: `production`** — a placeholder name; no such branch
   exists. Until task 5.8, every push to `main` then builds as a **Preview** with the staging
   variables below, like every other branch. Why: with `main` as the production branch, each
   merge would build a Production deployment, which has no environment variables yet;
   `instrumentation-node.ts` validates the server environment at startup and exits, so
   `hoc-deu.vercel.app` would return 500. With the placeholder, `hoc-deu.vercel.app` serves no
   deployment until 5.8 sets the Production Branch back to `main` together with the production
   variables.
3. Settings → General: turn on "Automatically expose System Environment Variables" — the app
   reads `VERCEL_ENV` and `VERCEL_BRANCH_URL` at runtime (decision 20, `lib/env.ts`).
4. Deployment Protection: leave at its default.
5. Settings → Environment Variables, scoped to **Preview**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (mark **Sensitive**)
   - `ADMIN_EMAILS` — **only the owner's e-mail**. While no active admin exists, any listed
     e-mail becomes an active admin on its next sign-in (the automatic break-glass, decision 23,
     ADR-0004), so every address here is trusted as much as the owner. Another admin is made in
     `/admin/users`, never by listing them.

   **Never** set `AUTH_TEST_LOGIN` on Vercel, in any environment — `lib/env.ts` throws at startup
   if it is `true` while `VERCEL_ENV=production`, and staging must not carry it either.
   `NEXT_PUBLIC_SITE_URL` is a **Production**-only variable (task 5.8); previews derive their site
   URL from `VERCEL_BRANCH_URL` instead (decision 20).

## 6. Checks on the preview's branch URL

Run every check below on the preview's **branch URL** — the stable
`hoc-deu-git-<branch>-<vercel-scope>.vercel.app` address — never on a deployment-hash URL
(`hoc-deu-<hash>-<vercel-scope>.vercel.app`). The PKCE code-verifier cookie belongs to whichever
host started the sign-in, and `redirectTo` is built from `VERCEL_BRANCH_URL`, so a sign-in started
on the hash URL exchanges its code against the wrong host and always ends at
`/sign-in?error=oauth` (§6b).

1. The branch URL returns `200`.
2. "Tiếp tục với Google" and "Tiếp tục với GitHub" both complete a sign-in.
3. **(§6a)** Confirm the redirect allow-list (§3) accepts
   `<branch URL>/auth/callback?next=…` — not just the bare origin. If it only allow-lists the
   origin, or omits the wildcard, GoTrue falls back to the Site URL and the code lands on `/`
   instead of the callback route, with no visible error.
4. **(§6b)** Start a sign-in from a deployment-hash URL instead of the branch URL and confirm it
   ends at `/sign-in?error=oauth` — the expected failure, because the PKCE cookie is per-host.
   Always share and test the branch URL, never a hash URL.
5. The owner's account (its e-mail listed in `ADMIN_EMAILS`) becomes an active admin on first
   sign-in — the fresh staging project has no active admin yet (bootstrap, decision 23) — and
   lands on `/onboarding`; its first step **lists both tracks** — this proves `next.config.ts`'s
   `outputFileTracingIncludes` shipped `content/tracks/*/track.yaml` into the deployed function
   (only a real Vercel deployment proves this; `next start` reads the repo directly and would
   pass even if this were missing).
6. `/admin/users` lists the account.
7. A second Google (or GitHub) account signs in and lands on `/pending` until an admin approves
   it in `/admin/users`.
8. **(§6c)** While signed out, load the branch URL and confirm prefetches of `/` and `/dev/*`
   behave — including Next's segment-prefetch requests (`/page.segments/….segment.rsc`, e.g.
   `/sign-in.segments/….segment.rsc`) — rather than erroring or redirect-looping; the proxy's
   public-path check must treat these the same as the pages they prefetch.

## 7. Migrations after merging (owner review SF6)

Until task 5.8 automates this, after merging any PR that adds a migration:

```bash
pnpm exec supabase db push
pnpm exec supabase migration list
```

Run both against the linked staging project (§2) and confirm `migration list` shows local and
remote at the same version before the next PR is opened against staging.

## 8. Break glass — no active admin left (decision 23, ADR-0004)

While no active admin exists, the owner's listed e-mail is the automatic break-glass: its next
sign-in bootstraps it, if its profile was never processed (e.g. a new account after the last
admin deleted theirs). Use the SQL below when the account to restore already has a processed
profile (suspended, rejected or demoted) or is not in `ADMIN_EMAILS`.

First confirm no active admin remains:

```sql
select count(*) from public.profiles where role = 'admin' and status = 'active';
```

If that count is `0`, run the following in the staging project's SQL editor (it runs as
`postgres`), substituting the owner's e-mail for `<owner e-mail>`:

```sql
-- Restore one admin when no active admin remains. Leaves an audit event.
with target as (select id from auth.users where email = '<owner e-mail>')
update public.profiles p
   set role = 'admin', status = 'active', approved_at = coalesce(p.approved_at, now())
  from target where p.id = target.id;
insert into public.events (id, user_id, actor_id, source, type, payload)
select gen_random_uuid(), id, id, 'system', 'admin.bootstrapped',
       jsonb_build_object('targetUserId', id, 'to', 'active')
  from auth.users where email = '<owner e-mail>';
```

Afterwards, confirm the account can open `/admin/users`.

## 9. Rotation and leaks

If a key leaks or needs rotating: rotate it in Supabase (Settings → API → regenerate), update
the matching Vercel environment variable, then redeploy. The repo never holds a key at any point
in this process — only Vercel's environment-variable store and the Supabase dashboard do.
