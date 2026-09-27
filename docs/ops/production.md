# Production launch runbook

The task 5.8b checklist, in order — run once, by the controller and the owner together, right
after the owner merges the M5 pull request. No secrets, project refs or e-mail addresses live in
this file; every value below is a placeholder filled in by hand, the same style as
`docs/ops/staging.md`.

See also: `docs/ops/staging.md` (the environment this runbook grows out of),
`docs/ops/backups.md` (the backup and restore-test workflows — this file only points at it),
`docs/ops/dogfooding.md` (step 5, the owner's two weeks after this runbook finishes),
`docs/adr/0038-release-boundary.md` (the rollout this runbook executes) and platform design §2.5
(environment variables and admin bootstrap).

**Every step below stops for the owner's review before the next one starts.** Nothing here runs
unattended: the owner reads what the controller did, confirms it, and only then is the next step
started. Each step below is marked **[owner]** or **[controller]** for who does the work; a step
marked both has the controller act and the owner confirm.

**Out of scope here:** backlog row **L2** (email sign-in enabled on the **staging** project only,
for one synthetic user, so e2e can run against previews) is a could-have, not part of launch — it
is not a step of this runbook, and production keeps email sign-in off regardless (ADR-0003).

## Order of operations

1. **Staging:** push M5's migrations to the staging project and run the staging smoke checklist.
2. **Backups on staging** — right after the merge, before any other step below: create the backup
   environment, dispatch both backup workflows once each, confirm both green, then the owner's
   re-link drill.
3. **Required check:** add `sim` to the `main` branch ruleset's required checks.
4. **Production:** create the project, push migrations, set the environment, deploy, smoke-test.
5. **Dogfooding:** the owner uses production for two weeks, then the pace check decides on
   inviting learners (`docs/ops/dogfooding.md`).

---

## 1. Staging: push M5's migrations **[controller, owner confirms]**

M5 adds four migrations (`supabase/migrations/20260927000100_*`, `…000200_*`, `…000300_*`,
`…000400_*` — the last one is 5.7c's `backup` schema with the two auth functions the backup reads
the accounts through). Push them to the staging project — **permanently `hoc-deu`, never a
separate `hoc-deu-staging` project** (`docs/ops/staging.md` "Current state" (M2), decision R18):

```bash
pnpm exec supabase link --project-ref <staging ref>
pnpm exec supabase db push
pnpm exec supabase migration list
```

**Before pushing:** run the decision-30 precheck against the **staging** project first (§4 step 3,
below) — it already carries real usage, so it is not automatically `0` the way a brand-new project
is.

Then, the **rolled-back DB smoke** (controller, in the staging project's SQL editor or via `psql`,
inside a transaction that is always rolled back — never committed against staging's real data):
onboarding → `plan.generated` → `mark_plan_seen` → check-in → `plan.extra_added` → auto check-in →
reset. This exercises the full M5 write path once against the real (pushed) schema without leaving
synthetic rows behind.

**The time-zone sweep against staging first (M10):** before running it against production (§4
step 5), run `pnpm db:tz-sweep`'s query against **staging** through the Management API — the same
way, the same two numbers checked. The local dry run (`psql`, task 5.8a) never exercised the
Management API's database-query endpoint at this query's real size (tens of thousands of `VALUES`
rows: every option × 25 day starts × the points around each 2026–27 transition); staging is where a
body-size or statement-time limit there would first show up, with no learner data at stake. If it
is rejected: split the list by zone prefix (several smaller queries) or run it as `psql` against
staging's session pooler from the owner's machine instead (the same statement, just not through the
API) — either fallback works the same way against production in §4 step 5.

Finally, the **owner's staging smoke checklist** (decision 28) on the staging preview: OAuth
sign-in, onboarding, `/today`, a check-in, an item result, `/review`, `/progress`, `/admin`.

## 2. Backups on staging **[owner creates the environment; controller sets the password and checks; both dispatch; owner drills]**

Right after §1 (staging's migrations are pushed — the callable check below needs
`20260927000400_backup_auth.sql`) and before any other step of this runbook that follows,
including production: backups must work before there is anything in production worth losing. The
steps live in `docs/ops/backups.md`; this file does not repeat them.

1. **[owner]** Creates the GitHub environment `backup` and its variables/secrets
   (`SUPABASE_BACKUP_DB_URL`, `BACKUP_RESTORE_KEY`, `BACKUP_AGE_RECIPIENTS`) — `docs/ops/backups.md`
   §2 steps 1–2. **(M1)** GitHub creates an environment the first time a workflow references it, with
   **no** deployment-branch rule — so `backup` may already be listed (from the first scheduled
   `backup.yml` after the merge, 22:17 UTC, or `restore-test.yml` on the next Saturday, both failing
   with an empty URL until this step runs): "create **or open**" `backup`, then confirm
   **Selected branches and tags: `main`** either way, before adding the secrets. Those daily
   failures until this step is done are expected — never "fixed" by loosening the rule.
2. **[controller]** Sets `backup_reader`'s password (§2 step 3), then runs §2 step 4's read-only
   checks through the Management API, as `postgres`, booleans only: `backup_reader` may call both
   auth functions, no API role (nor `public`) may use schema `backup` or call them, the functions
   return every account, and the project's exposed schemas (`GET /v1/projects/{ref}/postgrest`,
   printing `.db_schema` only — the response also holds the JWT secret) do not list `backup`.
   **No `auth` grants:** the accounts are read through the functions migration
   `20260927000400_backup_auth.sql` created (§1 pushed it; ADR-0029). If a check fails, the
   migration is missing or changed — push it; never grant anything on `auth` by hand. Nobody signs
   in as `backup_reader` from a workstation: the first backup (item 3) proves its login.
3. **[owner or controller]** Dispatch `backup.yml`, then `restore-test.yml`, once each via
   `workflow_dispatch` on `main`. **Both must go green before step 4 (production) starts.**
4. **[owner] Once: the re-link drill** (`docs/ops/backups.md` §8): a fresh backup and its green
   restore test, the owner key's decrypt and verify, and a read-only preflight on the target —
   all before anything is emptied; then staging (or a throwaway project) is emptied and loaded **in
   one transaction, by the owner**, who alone holds the decrypted files — no separate step by
   another actor, and nobody signs in between; sign in with Google and with GitHub, and confirm the
   same `profiles.id` and the same history (events, plans, streak, the number of accounts) — before
   and after written down. The weekly restore test proves every account loads in GoTrue, not an
   OAuth sign-in. Any difference stops the launch until the owner decides.

## 3. Required check: `sim` **[controller]**

Add `sim` to the `main` branch ruleset's required checks (decision 29 — not done before the merge,
because a required check `main` does not run yet would block every other open pull request).

## 4. Production **[owner: 1, 2, 6, 7, 8 — new-project billing and secret-bearing clicks; controller: 3, 4, 5; both: 9–12]**

Steps 1, 2, 6, 7 and 8 are the owner's alone (M3): a billing decision, new Google/GitHub OAuth apps
in the owner's own accounts (pasting client secrets nobody else should hold), and the Vercel
production variables (`SUPABASE_SECRET_KEY`, `CRON_SECRET`) and Production Branch. The controller
never asks for those secrets in chat "to do the setup" (CLAUDE.md Safety) — it runs 3, 4 and 5
(the precheck, the migration push, the tz sweep, none of which touch a secret); steps 9–12 are the
read-only checks, split between them as marked (the owner's sign-in, everything else either can
read).

1. **[owner]** **Supabase project.** The Free plan allows two active projects; staging already uses
   one (`hoc-deu`), so **the owner decides** whether to pause another project or upgrade before a
   second one can be created. Create the production project on **Postgres 16 or later** (Supabase's
   current default is fine; local runs 17 — the migrations use `pg_input_is_valid`, which
   Postgres 15 lacks). Pick the region closest to the learner base (today, `ap-southeast-1`,
   matching staging, unless the owner says otherwise).
2. **[owner]** **Auth settings**, in the production project's Auth → Providers / URL Configuration:
   - Disable **Email** (the second lock on the test login, ADR-0003 — the same as staging §3).
   - **Site URL:** the production domain (`https://<production-domain>`, Vercel's assigned or
     custom domain — never a preview URL).
   - **Redirect allow-list:** the production domain's `/auth/callback` path only — production has
     one fixed URL, unlike staging's preview wildcard (`docs/ops/staging.md` §3).
   - **Google and GitHub providers**, each with its own **production** OAuth app and callback
     (`https://<production ref>.supabase.co/auth/v1/callback`) — never reuse staging's OAuth apps,
     so a staging credential leak can never grant access to production.
3. **[controller]** **Before the first push — the decision-30 precheck** (M-13): in the production project's SQL
   editor (or `psql`), before `supabase db push`:

   ```sql
   select count(*) from public.events where plan_id is not null;
   ```

   On a brand-new project this is `0` — nothing to check. **If it is ever non-zero** (a push to a
   project that already has data): stop, list those rows' `type` and `occurred_at` **without their
   `payload`**, and ask the owner whether to delete those learner-crafted events or to add the new
   `(plan_id, user_id)` foreign key as `NOT VALID` instead (M-13; the same precheck the staging
   push above also runs, since staging is not new).
4. **[controller]** **Push migrations:**

   ```bash
   pnpm exec supabase link --project-ref <production ref>
   pnpm exec supabase db push
   pnpm exec supabase migration list
   ```

   The last command must show local and remote at the same version.
5. **[controller]** **The time-zone sweep** (`pnpm db:tz-sweep`) — against the **production** project, through the
   Management API's database query endpoint (never a direct hosted connection string on a
   contributor's machine): pipe the script's printed `select` into that endpoint. Two numbers come
   back: the count where TypeScript's `nextDayStart` is later than Postgres's reading (must be
   `0`), and the largest Postgres-minus-TypeScript gap in minutes (must be `≤ 65` everywhere
   except `Antarctica/Troll`, a 2-hour shift — see ADR-0017 and this task's report for the local
   run's numbers). **Re-run it whenever Node (the Vercel runtime) or Postgres (the Supabase
   project) changes its tzdata** — compare `process.versions.tz` of the Node version Vercel runs
   against the Postgres server version shown in the Supabase dashboard; a tzdata bump on either
   side is the trigger, not a fixed schedule. Already run once against staging in §1 (M10) — if
   the Management API rejected it there, use whichever fallback worked (split by zone prefix, or
   `psql` from the owner's machine) here too.
6. **[owner]** **Vercel Production environment variables** (Settings → Environment Variables, scoped to
   **Production** — the §2.5 list of platform design):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the production project's.
   - `SUPABASE_SECRET_KEY` (marked **Sensitive**) — the production project's.
   - `NEXT_PUBLIC_SITE_URL` — the production domain (a Production-only variable; previews keep
     deriving theirs from `VERCEL_BRANCH_URL`, decision 20).
   - `ADMIN_EMAILS` — only the owner's e-mail, as in staging §5.
   - `CRON_SECRET` — **new** for production: generate a fresh random value (≥ 32 characters,
     `openssl rand -hex 32`, the same as `.env.example`), never reused from staging or local.
   - **`AUTH_TEST_LOGIN` must be absent** — never set it on Vercel in any environment; `lib/env.ts`
     throws at startup if it is `"true"` while `VERCEL_ENV=production` (belt-and-suspenders: the
     variable should not exist here at all).
   - Turn on "Automatically expose System Environment Variables" if not already on (staging §5.3).
7. **[owner]** **Production Branch:** Settings → Git → Production Branch, back to **`main`** (the
   placeholder `production` branch's job, since staging §5 step 2, is done). Every future merge to
   `main` now builds a **Production** deployment with the variables above.
8. **[owner]** **First production deploy:** redeploy (or push to) `main`; confirm the deployment
   succeeds and the production domain serves it.
9. **Smoke** **[owner does the sign-in half]**:
   - `/api/health` returns `200`.
   - The owner signs in (Google or GitHub), is bootstrapped admin (their e-mail is in
     `ADMIN_EMAILS` and no active admin exists yet — decision 23), and completes onboarding.
   - `/today` builds a plan.
   - A check-in completes.
   - `/admin` shows no red warning **except** week coverage (expected until more content ships —
     the release-boundary week-4 constraint, ADR-0038, covers this).
10. **The first maintenance cron (I2)** — after the first 21:00 UTC following step 8: Vercel →
    Settings → Cron Jobs lists `/api/cron/maintenance`; its last invocation is `200` with `ok`
    (its `backups` step reads the repository's last successful `backup.yml` / `restore-test.yml`
    runs on `main`, whichever database they dumped: until step 11 those are **staging's** runs, so
    `backups: ok` here proves only that the cron runs — production is not backed up yet).
    `/admin`'s cron card shows that run, with no "Cron bảo trì chưa chạy lại kể từ …" warning
    (ADR-0034, I2). This is the first proof the cron is registered on production at all — nothing
    else in this runbook checks it.
11. **Backup environment → production:** point the `backup` GitHub environment's variables at the
    production project (following `docs/ops/backups.md`), then dispatch `backup.yml` and
    `restore-test.yml` once more via `workflow_dispatch` on `main`; both green. Once they are,
    lock staging's `backup_reader` login (`docs/ops/backups.md` §6, M7) — the switch above does not
    revoke it on its own.
12. **The next maintenance cron, after step 11** — the following 21:00 UTC: `/admin`'s backup and
    restore-test cards show the runs step 11 dispatched (not "chưa có dữ liệu" or a stale hint),
    and `ok: true` in the cron's last invocation.

## 5. Dogfooding **[owner]**

The owner uses production alone for one to two weeks; see `docs/ops/dogfooding.md` for what to
note daily and the pace check that follows. Only after that check does the owner decide whether to
open sign-ups.
