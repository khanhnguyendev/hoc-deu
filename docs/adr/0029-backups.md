# ADR-0029: Backups — daily data-only dumps and a weekly restore test in v1.0; the incremental chain from 100 MB

- **Status:** accepted
- **Date:** 2026-09-26
- **Spec:** platform design §2.3 (Backups), §2.5, §8.3, §8.4 items 1 and 5, §9.3; implementation
  plan Part B-M5 decisions 26 and 27 (task 5.7b); ADR-0005, ADR-0034

## Context

The learners' history — events, plans, progress — lives in one Supabase project. The spec asks
for a daily encrypted backup and a weekly test that the backup really restores (§2.3), in a public
repository (ADR-0005), on free plans. At 1–10 learners the database is small, so v1.0 dumps it
whole every day; the spec's incremental, derived-free chain (§8.4 item 1) waits until the
database passes 100 MB, when daily full dumps would start to cost real egress (§8.3).

## Decision

**What is dumped.** A plain, data-only `pg_dump` of `public` except `event_quota` (a two-day
counter, §4.5), and of `auth.users` and `auth.identities` (so learners keep their accounts). The
schema is not dumped: it is the migrations of the commit the backup ran at, recorded in the
manifest. A full dump would carry Supabase's own schemas, roles and extensions, which a fresh
project already has and cannot re-create; migrations are the schema's source of truth.

**Who dumps it.** `backup_reader` (migration `20260927000200_ops.sql`): `NOLOGIN` in git,
`BYPASSRLS` (every public table has RLS), `SELECT` on every public table but `event_quota`; its
login and password are set out of band (docs/ops/backups.md §2 step 3). The job connects through
the pooler's session mode (pg_dump does not work through transaction mode; the direct host is
IPv6-only) over TLS, and refuses to run as any other role. `event_quota` is left out with
`--exclude-table`, not `--exclude-table-data`: pg_dump locks every table it selects, and
`backup_reader` may not lock a table it cannot read (the dry run failed exactly so).

**One snapshot.** A psql session opens a repeatable-read, read-only transaction and exports its
snapshot; both pg_dump runs import it, and the same session then counts every dumped table
(`tools/backup/counts.sql`). Learners do write at 05:00 in Viet Nam: without one snapshot the
counts would disagree with the dumps. The manifest step then counts the rows of every `COPY` block
in the dumps (`tools/backup/dump.ts`) and refuses to write the manifest unless they equal the
database's counts. The dry run proved it with a writer adding 400 rows during the backup.

**The manifest** (`tools/backup/manifest.ts`, format 1, strict): the commit, the snapshot time,
daily or weekly, whether auth is included, the pg_dump and server versions, each dump's SHA-256
and size, every table's row count. No personal data, and encrypted with the dumps.

**Encryption and retention.** gzip, then `age` for every recipient in `BACKUP_AGE_RECIPIENTS` (at
least the owner's offline key and the restore-test key; ADR-0005). One artifact per run:
`db-backup-weekly-<date>` on Sundays (UTC), kept 90 days; `db-backup-daily-<date>` otherwise,
kept 14 days (owner-approved 2026-09-26, decision 27). The job runs daily at **22:17 UTC** — the
spec's 22:00 moved off the top of the hour, when GitHub delays and under load drops scheduled runs
(controller ruling M5-R20) — and fails when an expected file is missing, empty or not encrypted,
or when no artifact was uploaded. The plaintext is deleted right after the encrypted files are
checked, before the upload.

**The restore test**, Saturday **03:17 UTC** (M5-R20 as well): the newest artifact of a successful
scheduled or dispatched `backup.yml` run on `main` of this repository (ADR-0005); decrypted with
the restore-test key; checked against its manifest (every SHA-256, every file's rows, nothing but
what a data-only pg_dump writes — no psql meta-command); the manifest's commit — only one on
`main` — checked out; the **local Supabase stack** started and that commit's migrations applied
**without `seed.sql`** (whose synthetic users would collide with the dumped ones); `auth.sql`, then `public.sql`, loaded in one transaction with
`session_replication_role = replica` (triggers and foreign keys off, so nothing is recomputed and
load order does not matter); every table's row count compared with the manifest. The spec said
"a Postgres service container": the migrations need Supabase's roles, `auth` schema and
`supautils`, so the test uses the stack CI already runs for pgTAP (decision 27). It never prints a
row.

**Auth on the hosted project.** On hosted staging `postgres` has grantable `SELECT` on the two
auth tables but no grantable `USAGE` on the schema `auth` (controller finding, 2026-09-26;
reproduced locally, where the `GRANT` only warns), so `backup_reader` may be unable to read them.
The environment variable **`BACKUP_INCLUDE_AUTH`** decides, fail-closed:

- unset or `true` — auth is required: when `backup_reader` cannot read both tables, the job fails
  with a message naming the fix and the variable, and makes no backup;
- `false` — only after the owner has chosen it (docs/ops/backups.md §2 step 4): `public` only,
  recorded in the manifest (`includesAuth: false`, which the restore test follows) and warned in
  every run's log. **A restore from such a backup loses the link between each learner's old
  profile and their new sign-in:** the learning data comes back under the old user ids, but each
  sign-in creates a new auth user with a new id and a new empty profile, and nothing ties the two
  together — every learner starts over unless ids are remapped by hand.

A variable, not a code change, because the decision is the owner's and falls in the middle of the
launch runbook (5.8b step 2), where a code change would mean another pull request and review
before production. The alternative that keeps auth without the schema grant — `postgres`-owned
views over the two tables, dumped with `COPY (SELECT …)` — needs a migration and the owner's
approval first.

**Auth columns.** The restore loads hosted `auth` rows into the local stack's auth schema (the
Supabase CLI's GoTrue version). If the hosted tables have columns the local ones lack — checked on
the first staging run — the load fails with `42703`, and the two tables are dumped as
`COPY (SELECT <the local columns, pinned in tools/backup/auth-columns.ts> …) TO STDOUT` instead.

**From 100 MB** (the `/admin` warning, §8.4 item 5): the incremental, derived-free chain of §2.3 —
Sunday full dumps of every non-derived table; daily incrementals of the small state tables in
full, `events` by `occurred_at` and `day_plans` by `updated_at` since the last watermark (one hour
of overlap); derived tables (`item_state`, `plan_block_state`, `daily_activity`) never dumped but
rebuilt by replay; dailies kept 30 days, weeklies 90; the restore test restores the whole chain.
A new task, same role, same environment, same encryption.

## Consequences

- Easier: one job, one artifact a day, restorable by hand with the owner key and `psql`
  (docs/ops/backups.md §7), tested every week end to end.
- Up to a day of data can be lost (the last backup is at most 24 hours old); a restore by hand
  takes hours, not minutes.
- A restore loses every session and whatever lives outside `public` and the two auth tables:
  learners sign in again (their identities bring them back to their accounts), and Storage objects
  are not in the backup.
- The restore test proves that the newest backup decrypts, matches its manifest, loads into its
  commit's schema and holds every row — not that the app behaves on top of it.
- The dump client is pinned to PostgreSQL 17: a hosted upgrade to 18 needs the workflows bumped
  (docs/ops/backups.md §5).
- The job gives `pg_dump` and `psql` the database URL as `--dbname`, visible to other processes of
  the runner — GitHub's single-tenant runner VM runs only this job's processes. Accepted.
- The workflows run only on `main` (the `backup` environment): before the merge they are checked by
  `tools/backup/workflows.test.ts` and the task's local dry run; their first real runs are
  5.8b step 2, both green before any production step.
- The daily connection also keeps a Free-plan project from pausing for inactivity (§8, R15); if
  GitHub disables the schedule after 60 days without repository activity (R16), `/admin`'s
  backup-age warning shows it.
