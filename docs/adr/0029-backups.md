# ADR-0029: Backups — daily data-only dumps and a weekly restore test in v1.0; the incremental chain from 100 MB

- **Status:** accepted; amended 2026-09-27 (task 5.7c: the auth accounts through allow-listed
  functions — owner ruling 2026-09-27, ledger M5-R29 and M5-R30)
- **Date:** 2026-09-26
- **Spec:** platform design §2.3 (Backups), §2.5, §8.3, §8.4 items 1 and 5, §9.3; implementation
  plan Part B-M5 decisions 26 and 27 (tasks 5.7b, 5.7c); ADR-0005, ADR-0034

## Context

The learners' history — events, plans, progress — lives in one Supabase project. The spec asks
for a daily encrypted backup and a weekly test that the backup really restores (§2.3), in a public
repository (ADR-0005), on free plans. At 1–10 learners the database is small, so v1.0 dumps it
whole every day; the spec's incremental, derived-free chain (§8.4 item 1) waits until the
database passes 100 MB, when daily full dumps would start to cost real egress (§8.3).

## Decision

**What is dumped.** A plain, data-only `pg_dump` of `public` except `event_quota` (a two-day
counter, §4.5), and the learners' accounts — `auth.users` and `auth.identities`, only the
allow-listed columns (below, "The auth accounts"), so a restored project keeps every account under
its id. The schema is not dumped: it is the migrations of the commit the backup ran at, recorded
in the manifest. A full dump would carry Supabase's own schemas, roles and extensions, which a
fresh project already has and cannot re-create; migrations are the schema's source of truth.

**Who dumps it.** `backup_reader` (migration `20260927000200_ops.sql`): `NOLOGIN` in git,
`BYPASSRLS` (every public table has RLS), `SELECT` on every public table but `event_quota`, and —
since task 5.7c — `EXECUTE` on the two auth functions (migration `20260927000400_backup_auth.sql`),
nothing on schema `auth`; its login and password are set out of band (docs/ops/backups.md §2
step 3). The job connects through
the pooler's session mode (pg_dump does not work through transaction mode; the direct host is
IPv6-only) over TLS, and refuses to run as any other role. `event_quota` is left out with
`--exclude-table`, not `--exclude-table-data`: pg_dump locks every table it selects, and
`backup_reader` may not lock a table it cannot read (the dry run failed exactly so).

**One snapshot.** A psql session opens a repeatable-read, read-only transaction and exports its
snapshot; the pg_dump of `public` imports it, and the same session then copies the auth accounts
out of the two functions (`tools/backup/auth-dump.sql`) and counts every dumped table
(`tools/backup/counts.sql`, the auth counts through the same functions). Learners do write at 05:00 in Viet Nam: without one snapshot the
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
load order does not matter), with `tools/backup/normalise-auth.sql` right after `auth.sql` in the
same transaction; every table's row count compared with the manifest; then every restored account
asked for by id from the local stack's GoTrue (below). The spec said
"a Postgres service container": the migrations need Supabase's roles, `auth` schema and
`supautils`, so the test uses the stack CI already runs for pgTAP (decision 27). It never prints a
row.

**The auth accounts (task 5.7c, amending the first version).** On hosted Supabase `postgres`
holds `SELECT WITH GRANT OPTION` on `auth.users` and `auth.identities` but no grantable `USAGE` on
schema `auth` (controller finding on hosted staging, 2026-09-26; the local stack behaves the
same), so `backup_reader` cannot be granted the tables. Of the options docs/ops/backups.md then
listed, the owner chose (b) — keep the accounts in the backup — **through functions, not views**
(ruling 2026-09-27):

- **Why not grants:** they cannot be given (above), and a grant on the whole table would hand
  `backup_reader` every column, passwords and tokens included.
- **Why not views:** a view pins the columns it names — a GoTrue migration that drops or retypes
  one of them would fail on hosted, blocking Supabase's own auth upgrades.
- **Functions:** schema `backup` (owned by `postgres`, the migration role; `USAGE` for
  `backup_reader` only, not in the Data API's exposed schemas) holds `backup.auth_users()` and
  `backup.auth_identities()` — `language plpgsql` (a `begin atomic` SQL body is
  dependency-tracked like a view; a plpgsql body is not), `stable`, `security definer`,
  `set search_path = ''`, `set row_security = off` (auth.users has RLS on and `postgres` bypasses
  it; should it ever stop, the functions fail instead of returning fewer rows), owned by
  `postgres`, `EXECUTE` revoked from `public`, `anon`, `authenticated` and `service_role` and
  granted to `backup_reader` only. Each returns a `returns table (…)` **allow-list** — never
  `select *`, so a column GoTrue adds never leaks in — each column cast to its declared type (a
  compatible retype keeps the backup working), named as `pg_catalog`'s (`::pg_catalog.uuid`,
  `jsonb`, `text`: with `search_path = ''` the caller's `pg_temp` is still searched first for type
  names; keyword types always mean `pg_catalog`'s). A dropped or renamed column fails the backup loudly;
  the fix is a new migration re-creating the function (docs/ops/backups.md §2 step 5).
- **The allow-list** (`tools/backup/auth-columns.ts`, written once; a Vitest compares the
  migration, `auth-dump.sql`, `normalise-auth.sql` and pgTAP `081` with it; the types are the
  local stack's GoTrue, the Supabase CLI pinned in `package.json`):
  `auth.users` — `id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, last_sign_in_at, is_anonymous`, plus **`instance_id`**, the one column the
  local round trip proved GoTrue needs beyond that list: GoTrue looks every user up by the nil
  instance id it writes, and a user restored with a null `instance_id` is "not found" (HTTP 404);
  `auth.identities` — `id, user_id, provider, provider_id, identity_data, created_at, updated_at,
  last_sign_in_at`. **`identities.email` is not returned:** it is `GENERATED ALWAYS` from
  `identity_data`, so a restore cannot load it and gets it back anyway.
- **The never-list:** `encrypted_password` and every `*_token`, `confirmation_*`, `recovery_*`,
  `email_change*`, `phone_change*` and `reauthentication_*` column — a password, a one-time token or
  a pending change is never in a backup, whatever a later GoTrue adds under those names (the Vitest
  and pgTAP `081` check the returned columns against it; `081` also plants values in them and
  checks none comes out).
- **The dump** runs in the backup's snapshot session: `COPY (SELECT <the allow-list> FROM
  backup.auth_users() ORDER BY id) TO STDOUT` (the same for identities), written as
  `COPY auth.users (<the allow-list>) FROM stdin;` … `\.` blocks between a `\restrict` /
  `\unrestrict` pair — what pg_dump would write — so `tools/backup/dump.ts` counts the rows and the
  restore loads those columns only. The `\restrict` key is random and made on the runner (`openssl
  rand`), as pg_dump makes its key on the client: the server being dumped never learns it. The
  snapshot session reads the accounts, so its errors reach the public log as SQLSTATE codes only
  (`VERBOSITY=sqlstate`, no context): a server message could otherwise quote a value. The job counts the auth rows through the same functions
  (reported as `auth.users` / `auth.identities`); the restore counts the tables. Before dumping,
  the job checks that `backup_reader` can call both functions (the error names the migration, not
  a grant); any error from either function stops the snapshot session and fails the job before
  anything is encrypted or uploaded — never a partial backup; the `/admin` backup-age warning
  (36 h, decision 26) then surfaces it within a day.
- **The `''` normalisation:** GoTrue reads eight `auth.users` columns as non-null strings
  (`confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`,
  `email_change_token_current`, `phone_change`, `phone_change_token`, `reauthentication_token`):
  the local round trip set each one null in turn, and GoTrue then failed to load the user
  (HTTP 500, "converting NULL to string is unsupported"). A backup holds none of them, so a
  restore leaves the first four null (no default) and the last four `''` (their default).
  `tools/backup/normalise-auth.sql` — run by the restore test and by a restore by hand
  (docs/ops/backups.md §7), right after `auth.sql`, in the load's transaction — sets every one of
  them that is null to `''`: no pending confirmation, recovery or change survives a restore, never
  an old value, and no reliance on a default GoTrue may drop. Restored accounts have no password
  (`encrypted_password` is null): sign-in is OAuth only (ADR-0003).
- **The weekly GoTrue check:** the restore test restores into the local Supabase stack, GoTrue
  included, so after the counts it asks the local GoTrue's admin API for every restored user by id
  (`tools/backup/cli.ts check-gotrue`, loopback only, with the local key from `supabase status`)
  and fails unless each comes back under the same id. It prints the kinds of failure only — no
  id, and no count: the weekly public log never tracks how many learners there are.
  A GoTrue or CLI change that breaks loading restored accounts fails the weekly test before a real
  restore needs it. It cannot prove a Google or GitHub sign-in.
- **The re-link drill:** so the owner proves that once, on staging (5.8b step 2,
  docs/ops/backups.md §8): a fresh backup, its green restore test, the owner key's decrypt and
  verify and a read-only preflight of the target (the `postgres` privileges, `session_replication_role
  = replica`) first; only then an emptied staging (or a throwaway project with its own OAuth
  clients) loaded at once; then a Google and a GitHub sign-in land on the same `profiles.id` with
  the same history — before and after written down.
- **The hosted checks** (docs/ops/backups.md §2 step 4) are read-only Management API queries as
  `postgres`, booleans only: `backup_reader` may call both functions; no API role nor `public` may
  use schema `backup` or call them (what pgTAP proves locally, proven on the hosted project too);
  the functions return every account; the exposed schemas do not list `backup`. Nobody signs in as
  `backup_reader` from a workstation: the first dispatched backup proves its login.
- **The local round trip** (task 5.7c's report): accounts created through the local GoTrue's admin
  API, each with a profile and history; a backup as `backup_reader` through the functions (no
  planted secret reached the files); `supabase db reset --no-seed`; load and normalise; every
  account loaded in GoTrue under its old id, and a magic-link sign-in came back as the same user
  with its profile and history.

**`BACKUP_INCLUDE_AUTH`** stays, fail-closed, as the owner-only fallback: unset or `true` — the
accounts are required, and a project where `backup_reader` cannot call both functions fails the
job with no backup; `false` — only after the owner has chosen it: `public` only, recorded in the
manifest (`includesAuth: false`, which the restore test follows) and warned in every run's log.
**A restore from such a backup loses the link between each learner's old profile and their new
sign-in:** the learning data comes back under the old user ids, but each sign-in creates a new
auth user with a new id and a new empty profile, and nothing ties the two together — every learner
starts over unless ids are remapped by hand. A variable, not a code change, because the decision
is the owner's and would fall in the middle of the launch runbook (5.8b step 2), where a code
change would mean another pull request and review before production.

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
- A restore loses every session and whatever lives outside `public` and the two auth tables'
  allow-listed columns: learners sign in once more (their identities bring them back to their
  accounts — no re-sign-up), pending confirmations, recoveries and e-mail changes are dropped, and
  Storage objects are not in the backup.
- The auth allow-list follows GoTrue by hand: a GoTrue release that drops, renames or retypes an
  allow-listed column fails the backup, and one whose accounts need another column to load fails
  the weekly GoTrue check — each fixed by a new migration re-creating the function, with the
  allow-list, its SQL and this ADR in the same change. Neither can go unnoticed for more than a
  day (backup) or a week (restore test).
- `backup_reader` can read the allow-listed columns of every account — e-mails, names, provider
  ids, sign-in times — but no password, token or pending change, and nothing else in `auth`; the
  functions answer no other role (pgTAP `001`, `081`).
- The restore test proves that the newest backup decrypts, matches its manifest, loads into its
  commit's schema, holds every row and that every account loads in GoTrue under its id — not that
  the app behaves on top of it, nor an OAuth sign-in (the one-time re-link drill).
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
