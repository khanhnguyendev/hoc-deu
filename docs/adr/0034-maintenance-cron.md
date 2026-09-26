# ADR-0034: Daily maintenance cron — one idempotent Vercel cron behind `CRON_SECRET`

- **Status:** accepted
- **Date:** 2026-09-26
- **Spec:** platform design §2.3, §2.5, §4.2, §4.5, §8.4 items 3 and 5; implementation plan
  Part B-M5 decision 26 (task 5.7a)

## Context

Some housekeeping cannot wait for a learner to open a page: the learner write quota's
`event_quota` rows pile up one per user per day (ADR-0030), `/admin` must warn about the database
size (100 MB: switch backups to the incremental chain; 350 MB warn; 450 MB critical) and about
the age of the last backup and restore test (§8.4 item 5). Those two ages live in GitHub Actions,
not in the database.

Constraints:

- **Vercel Hobby** allows one cron invocation a day per job, and runs it anywhere within the
  scheduled hour, so the job may run late, twice (a retry) or not at all on a given day.
- The route is a public URL: anyone can call it.
- The unauthenticated GitHub API allows 60 requests an hour per IP address, and Vercel functions
  share addresses — a GitHub call on every `/admin` render would hit the limit (decision 26).
- Plans are built lazily by `ensureToday` on the learner's first visit (§2.3); the spec rules out
  generating plans in a cron.

## Decision

- **One daily Vercel cron**, `vercel.json`: `GET /api/cron/maintenance` at `0 21 * * *` (21:00
  UTC = 04:00 in Viet Nam, the default day start, and about an hour before the 22:17 UTC backup
  job — the backup crons sit off the top of the hour, ruling M5-R20).
- **`CRON_SECRET`** (§2.5, at least 32 characters). Vercel sends `Authorization: Bearer
  <CRON_SECRET>`; `requireCronSecret` (`lib/auth/cron.ts`) hashes both sides with SHA-256 and
  compares them with `timingSafeEqual`, and returns a 401 response to send — no secret
  configured, a missing or a wrong header — or null. It returns rather than throws, so the route
  starts with `const denied = await requireCronSecret(request)` and `if (denied) return denied`;
  the architecture test (`tools/guards/server-guards.ts`) accepts `requireCronSecret` only in that
  form, since a discarded denial would leave the route open. `lib/env.ts` requires the secret when
  `VERCEL_ENV=production` (the server refuses to start without it) and treats it as optional, an
  empty value included, elsewhere: the route then answers 401 to everyone.
- **Every step is idempotent and runs on its own** (`lib/ops/maintenance.ts`, each in its own
  `try`/`catch`; one failing step never stops the others):
  1. `dbSize` — `ops_record_db_size()` records `pg_database_size(current_database())`.
  2. `prune` — `ops_prune()` deletes `event_quota` rows with `local_day < current_date − 2` (a
     learner's local day is at most one day off the database's date, so the current counter is
     never touched) and `ops_metrics` rows older than 400 days.
  3. `backups` — the latest successful **trusted** run of `backup.yml` and `restore-test.yml` (event
     `schedule` or `workflow_dispatch`, head branch `main`, head repository this one — a fork's
     pull-request run on a branch named `main` never counts; task 5.7b), from
     the public GitHub API (`lib/ops/github.ts`; the repository is a constant, no token, two
     requests a day), recorded as `backup.last_success_at` and `restore_test.last_success_at`.
     The step fails when either run cannot be read — an API error, a rate limit or no successful
     run yet — and still records the one it could read.

  Then `cron.last_run_at` records the run itself, so `/admin` can tell a silent cron from a quiet
  one. Running twice records the same values twice; skipping a day only leaves one more day of
  quota rows and a staler timestamp, which `/admin` shows as its age.
- **`ops_metrics`** (§4.2): `key` (checked against the four keys above), `value numeric`,
  `recorded_at`; timestamps as Unix epoch seconds, sizes in bytes; indexed by `(key, recorded_at
  desc)` so a reader takes the latest row per key. RLS on; admins read it (`is_admin()`); nobody
  writes it but the three `SECURITY DEFINER` functions, which only `service_role` (the secret key)
  may execute. `/admin` (task 5.6) reads the database only.
- **The response** is `200` with the step outcomes and nothing else
  (`{ ok, steps: { dbSize, prune, backups } }`), `Cache-Control: no-store`. Failures are logged by
  step name, never with a secret.
- **It never builds plans** — plans stay lazy (§2.3, §8.4 item 3).
- **`/api/health`** is the cron's public sibling: `publicRoute()`, then `health()` (`select true`,
  `SECURITY INVOKER`, the only function `anon` may execute) through PostgREST with the publishable
  key and no session, with a 5 s limit; `200 {"ok":true}` or `503 {"ok":false}`, nothing else.
- **v1.1 adds** the bot and publish sweeps to the same cron (§2.3): timed-out bot runs marked
  failed, `bot_run_users.detail` pruned after 30 days, merged publish requests marked, `pr_url`
  cleared for PRs closed unmerged. The event compaction job (ADR-0031) joins it only when the
  350 MB warning fires.

## Consequences

- Easier: one route, one secret, one schedule; a missed or doubled run needs no repair. `/admin`
  renders from the database alone, so it never waits on or is rate-limited by GitHub.
- Harder: the backup and restore-test ages on `/admin` are up to a day stale (they are read once a
  day, about an hour before the backup runs, so the newest backup shows up the next evening).
- Accepted: Hobby's timing means the cron runs somewhere between 21:00 and 21:59 UTC; nothing in
  it depends on the exact minute.
- Accepted: until the first restore test has run on `main` (5.8b), every report says
  `backups: failed` and `ok: false`. That is accurate: there is no restore-test age to record,
  and `/admin` has none to show either.
- Accepted: `CRON_SECRET` is a production launch step (5.8b's runbook): a production deployment
  without it does not start. Rotating it is a Vercel variable change and a redeploy.
- The `backup_reader` role created by the same migration belongs to the backups (ADR-0029,
  task 5.7b).
