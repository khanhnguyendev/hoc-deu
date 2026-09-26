# Backups runbook

The daily encrypted backup and the weekly restore test (task 5.7b; platform design §2.3, §8.4
item 1; ADR-0005, ADR-0029). This file has the one-time setup (§2), what to check on the first runs
(§3), retention (§4), rotation (§5), switching the target project (§6) and restoring by hand (§7).
No secrets, project refs, keys or e-mail addresses live in this file; every value below is a
placeholder filled in by hand, the same style as `docs/ops/staging.md`.

See also: `.github/workflows/backup.yml` and `restore-test.yml` (guarded by
`tools/backup/workflows.test.ts`), `tools/backup/` (manifest, counts, artifact checks),
`supabase/migrations/20260927000200_ops.sql` (the `backup_reader` role), `docs/ops/production.md`
§2 and §4 step 10 (when these steps run during the launch).

## 1. What runs

| Workflow | When | What |
| --- | --- | --- |
| `backup.yml` | daily 22:17 UTC (05:17 in Viet Nam) and by hand | Data-only dump of `public` (minus `event_quota`) and of `auth.users` + `auth.identities`, as `backup_reader`, in one snapshot; a manifest (commit, row counts, SHA-256s); gzip; `age` for every recipient; one artifact |
| `restore-test.yml` | Saturday 03:17 UTC and by hand | Decrypts the newest backup with the restore-test key, checks it against its manifest, starts the local Supabase stack at the backup's commit, applies the migrations without `seed.sql`, loads the data, compares every table's row count |

Both run at minute 17, not on the hour: GitHub delays, and under load drops, scheduled runs at
the top of the hour (ruling M5-R20; the spec's 22:00 UTC became 22:17). Both run only on `main`,
in the GitHub environment `backup` (limited to `main`, so no other branch can read its secrets). The repository is public: anyone can read the logs and download the
artifacts, so every artifact is encrypted before the upload and neither job ever prints a row
(ADR-0005). `/admin` shows the age of the last successful run of each, read once a day by the
maintenance cron (ADR-0034).

**Not in a backup:** the schema (it comes from the migrations of the manifest's commit), the
other `auth` tables (sessions, refresh tokens, MFA factors, audit log — after a restore every
learner signs in again, and their identities map them back to the same accounts), `event_quota`
(§4.5 of the platform design: a two-day counter) and Storage objects (the `content-images`
bucket, `docs/ops/content-images.md`).

## 2. One-time setup, per target project

Staging first, right after the M5 merge (`docs/ops/production.md` §2); production later (§6 below).
Steps 1–2 are the owner's; steps 3–4 the controller's; step 5 both.

### Step 1 — two `age` key pairs **[owner]**

On the owner's own machine (`brew install age`; never on a shared machine):

```bash
age-keygen -o hoc-deu-backup-owner.key        # the owner's key: stays offline
age-keygen -o hoc-deu-backup-restore-test.key # the restore-test key: goes into GitHub only
```

Each command prints the key's public half (`Public key: age1…`), also written in the file's
`# public key:` line.

- **Owner key:** keep the file offline (a password manager's secure file or an encrypted USB
  stick, plus a second copy elsewhere). It is the only way to decrypt a backup by hand (§7): the
  restore-test key cannot be read back out of GitHub. Losing it loses every backup the day GitHub
  does.
- **Restore-test key:** stored as the secret `BACKUP_RESTORE_KEY` in step 2, then deleted locally.

### Step 2 — the `backup` environment **[owner]**

GitHub → repository Settings → Environments → **New environment** `backup`:

- **Deployment branches and tags:** "Selected branches and tags" → add the rule `main` (branch).
  Nothing else: no required reviewers (a reviewer would hold every scheduled run), no wait timer.
- **Environment secrets:**
  - `BACKUP_RESTORE_KEY` — the whole content of `hoc-deu-backup-restore-test.key`:
    `gh secret set BACKUP_RESTORE_KEY --env backup < hoc-deu-backup-restore-test.key`, then
    delete the file.
  - `SUPABASE_BACKUP_DB_URL` — set by the controller in step 3 (the owner never sees it).
- **Environment variables:**
  - `BACKUP_AGE_RECIPIENTS` — both public keys (`age1…`), separated by a space or a new line:
    `gh variable set BACKUP_AGE_RECIPIENTS --env backup --body "age1<owner> age1<restore-test>"`.
    The backup refuses to run with fewer than two distinct keys, or with anything but native
    `age1…` X25519 keys (no SSH or plugin recipients: the runner has no plugins).
  - `BACKUP_INCLUDE_AUTH` — **leave it unset.** Only the owner's decision in step 4 sets it (to
    `false`).

### Step 3 — `backup_reader`'s password and login **[controller]**

The migration creates `backup_reader` as `NOLOGIN` (read-only, `BYPASSRLS`, `SELECT` on every
`public` table but `event_quota`); its login and password are set out of band, with one SQL
statement on the target project through the Management API's database query endpoint. The
password is generated locally, sent to Postgres only as its SCRAM-SHA-256 verifier (so no query
log or history ever holds it), and written straight into the environment secret — never printed,
never in git or the chat:

```bash
(
set -euo pipefail
ref=<project ref>
pooler_host=<the Session pooler host: dashboard → Connect → Session pooler, aws-…pooler.supabase.com>
: "${SUPABASE_ACCESS_TOKEN:?export a Management API token first}"
work="$(mktemp -d)"   # 0700; kept when a step fails, removed at the end
echo "work dir: $work"
python3 - "$work" <<'PY'
import base64, hashlib, hmac, json, os, secrets, sys
work = sys.argv[1]
password = secrets.token_hex(32)          # hex: nothing to URL-encode
salt, iterations = os.urandom(16), 4096
salted = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, iterations)
stored = hashlib.sha256(hmac.new(salted, b'Client Key', 'sha256').digest()).digest()
server = hmac.new(salted, b'Server Key', 'sha256').digest()
b64 = lambda raw: base64.b64encode(raw).decode()
verifier = f'SCRAM-SHA-256${iterations}:{b64(salt)}${b64(stored)}:{b64(server)}'
os.umask(0o077)
open(f'{work}/password', 'w').write(password)
open(f'{work}/body.json', 'w').write(json.dumps(
    {'query': f"alter role backup_reader with login password '{verifier}'"}))
PY
# 1. The role first: one statement, so a failure changes nothing.
curl -fsS -X POST "https://api.supabase.com/v1/projects/$ref/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  --data-binary @"$work/body.json" > /dev/null
# 2. Only then the secret, with the password the role now has.
printf 'postgresql://backup_reader.%s:%s@%s:5432/postgres?sslmode=require' \
  "$ref" "$(< "$work/password")" "$pooler_host" \
  | gh secret set SUPABASE_BACKUP_DB_URL --env backup --repo khanhnguyendev/hoc-deu
# 3. Only after both: the local copy goes.
rm -rf "$work"
echo "backup_reader can sign in; SUPABASE_BACKUP_DB_URL is set"
)
```

The subshell stops at the first failing command (`set -euo pipefail`), so the secret never gets a
password the role did not, and the password file is never deleted before the secret holds it:

- **`curl` failed** (token, ref, or the statement): nothing changed. Delete the printed work dir
  and run the block again.
- **`gh secret set` failed** after `curl` succeeded: the role already has the new password, and
  the work dir still holds it. Either run the block again (a fresh password replaces it), or fix
  `gh` and re-run only its `printf … | gh secret set` pipeline with the same values; then delete
  the work dir.

- The URL is the pooler's **session mode** (port **5432**, user `backup_reader.<ref>`): pg_dump
  does not work through transaction mode (6543, which the job refuses), and the direct host
  (`db.<ref>.supabase.co`) is IPv6-only, which GitHub's runners cannot reach. The job also
  refuses a URL without `sslmode=require` (or `verify-ca` / `verify-full`).
- The same verifier computation set the local password in the task's dry run (2026-09-26): psql
  then signed in as `backup_reader` with it, and `postgres` could alter the role as the
  migration's creator — as on the hosted project, where `supabase db push` ran that migration.

### Step 4 — `auth.users` and `auth.identities` **[controller; stops for the owner if refused]**

Run on the target project (the dashboard's SQL editor, or the query endpoint as in step 3):

```sql
grant usage on schema auth to backup_reader;
grant select on auth.users, auth.identities to backup_reader;
select has_schema_privilege('backup_reader', 'auth', 'usage') as auth_usage,
       has_table_privilege('backup_reader', 'auth.users', 'select') as users,
       has_table_privilege('backup_reader', 'auth.identities', 'select') as identities;
```

**Read the check, not the `GRANT`'s result:** a grant the granting role may not give only prints
`WARNING: no privileges were granted for "auth"` — it does not fail. All three columns must be
`true`.

**Known limit (controller finding on hosted staging, 2026-09-26, read-only):** `postgres` holds
`SELECT WITH GRANT OPTION` on `auth.users` and `auth.identities` but no *grantable* `USAGE` on the
schema `auth`, so on the hosted project `auth_usage` will probably be `false`. The local stack
behaves the same (reproduced in the task's dry run: the table grants go through, the schema grant
only warns).

**If `auth_usage` (or either table) is `false`: stop here and ask the owner.** Do not work around
it. Until the owner decides, every backup fails with "backup_reader cannot read auth.users and
auth.identities … No backup was made" — never a silent partial backup. The owner's options:

- **(a) The fallback: back up `public` only.** The owner sets the environment variable
  `BACKUP_INCLUDE_AUTH=false`. Every backup then holds `public` only, says so in its manifest
  (`includesAuth: false`) and warns in each run's log; the restore test loads and checks `public`
  only. **What a restore from such a backup loses — precisely:** the link between each learner's
  old profile and their new sign-in. All learning data comes back (profiles, events, plans,
  progress), still keyed by each learner's old user id; but the restored project has no
  `auth.users` rows, so when a learner signs in again with Google or GitHub, the auth server
  creates a **new** user with a **new** id, and the sign-up trigger creates a new, pending, empty
  profile for it. Nothing ties that new id to the old profile — `profiles` holds no e-mail — so
  every learner starts over, the owner included (bootstrapped admin again by `ADMIN_EMAILS`),
  while their history sits orphaned under the old ids (rows that violate the `profiles → auth.users`
  foreign key, loaded with it switched off). Getting it back means remapping old ids to new ones by
  hand, learner by learner (asking each one which profile was theirs), across every per-user table.
- **(b) Keep auth without the schema grant** (needs a change the owner approves first, not built
  by task 5.7b): a migration gives `backup_reader` the two tables through objects `postgres`
  owns — e.g. a `postgres`-owned view per table in a schema the API does not expose, over which
  `postgres` can grant `SELECT` — and the backup dumps them with `COPY (SELECT …) TO STDOUT`
  instead of `pg_dump --table`. ADR-0029 records the choice either way.

### Step 5 — first runs **[owner or controller]**

On `main`: Actions → **backup** → Run workflow; when it is green, Actions → **restore-test** → Run
workflow. **Both must be green before any production step** (`docs/ops/production.md` §2).

On the first staging run, check the one thing the local dry run could not: whether the hosted
auth server's `auth.users` / `auth.identities` have columns the local stack's (the Supabase CLI
version pinned in `package.json`) lacks. If they do, the restore test's load fails on `auth.sql`
with `ERROR: 42703` (undefined column); compare the column lists
(`select table_name, column_name from information_schema.columns where table_schema = 'auth' and
table_name in ('users', 'identities') order by 1, 2`, hosted vs `pnpm db:start`). The fix
(ADR-0029): dump those two tables as `COPY (SELECT <the local stack's columns, pinned in
tools/backup/auth-columns.ts> …) TO STDOUT` instead of `pg_dump --table`, so the restore loads.

## 3. Reading a run

- **backup:** the log shows the kind (daily / weekly), `pg_dump` and server versions, the
  snapshot time, `manifest.json: N tables in M files`, `Encrypted …`, the file check and the
  artifact id. A failure names its reason (URL, role, auth, snapshot, a count that disagrees with
  the dump — named by table, never with numbers). Nothing else is printed.
- **restore-test:** the artifact and run it restored, the checks, `Loaded.` and
  `row counts match the manifest for N tables`. A load failure shows only `psql` SQLSTATE lines
  (`ERROR:  23505`); a count failure names the tables and whether each is missing, unexpected or
  different — never a row or a count.

## 4. Retention and storage

- **Daily** (Monday–Saturday, UTC): artifact `db-backup-daily-<date>`, kept **14 days**.
  **Sunday's** (UTC): `db-backup-weekly-<date>`, kept **90 days** (owner-approved 2026-09-26,
  decision 27). At most about 12 dailies and 13 weeklies exist at once — 25 artifacts.
- **The 500 MB question (spec §9.3):** GitHub's billing page (checked 2026-09-26) makes Actions
  free for public repositories on standard runners and describes the artifact-storage quota for
  private repositories, so it most likely does not apply here. If it ever does: 25 × the artifact
  size must stay under 500 MB (each run's log and the artifact list show the size — a compressed,
  data-only dump is far smaller than the database's size on `/admin`). Past that, the owner
  decides: fewer days (spec §9.3's example, 7 daily + 4 weekly) or a private store.
- **The switch to the incremental chain:** when `/admin` warns that the database passed
  **100 MB**, the daily full dump is replaced by the incremental, derived-free chain (spec §2.3,
  §8.4 item 1; ADR-0029): Sunday full + daily incrementals, derived tables rebuilt by replay,
  dailies kept 30 days, a restore test over the whole chain. That is a new task, not a setting.

## 5. Rotation

- **`backup_reader`'s password:** repeat step 3 (the old password stops working at once).
- **The restore-test key:** a new pair (step 1); replace `BACKUP_RESTORE_KEY` and its public key in
  `BACKUP_AGE_RECIPIENTS`; run backup, then restore-test. Older artifacts stay readable with the
  owner key; the restore test only ever reads the newest.
- **The owner key** (lost or exposed): a new pair; replace its public key in
  `BACKUP_AGE_RECIPIENTS`. Artifacts made before stay encrypted to the old key until they expire
  (≤ 90 days); if it was exposed, delete them (`gh api -X DELETE
  repos/khanhnguyendev/hoc-deu/actions/artifacts/<id>`) once a new backup exists.
- **Postgres 18 on the hosted project:** pg_dump refuses to dump a newer server. Bump
  `postgresql-client-17` and `PG_BIN` (`/usr/lib/postgresql/17/bin`) in both workflows and in
  `tools/backup/workflows.test.ts`, and the local stack's `major_version`.

## 6. Switching the target (staging → production)

`docs/ops/production.md` §4 step 10: run §2 steps 3–4 on the **production** project (the grant
check decides `BACKUP_INCLUDE_AUTH` there too — ask the owner again if it is refused), which
replaces `SUPABASE_BACKUP_DB_URL`; then run backup and restore-test once more, both green.
Staging's remaining artifacts expire by retention; the restore test always takes the newest.

## 7. Restoring by hand

On a trusted machine with the owner key, `age`, `psql` ≥ 17 and this repository:

1. **Pick the backup** the way the restore test does — a successful `backup.yml` run on `main`
   of this repository, started by its schedule or by hand. Never pick one by artifact name alone
   (or from `gh run list`, which does not show the head repository): a pull request from a fork
   can upload an artifact named `db-backup-…` (ADR-0005).

   ```bash
   gh api 'repos/khanhnguyendev/hoc-deu/actions/workflows/backup.yml/runs?branch=main&status=success&per_page=50' \
     --jq '.workflow_runs[] | select(.event == "schedule" or .event == "workflow_dispatch")
           | select(.head_repository.full_name == "khanhnguyendev/hoc-deu")
           | "\(.id)  \(.event)  \(.created_at)"'
   gh run download <run id> --repo khanhnguyendev/hoc-deu --name db-backup-<kind>-<date> \
     --dir backup-encrypted
   ```
2. **Decrypt and check** (plaintext in a `0700` directory; delete it when done):

   ```bash
   umask 077; mkdir backup
   for f in backup-encrypted/*.age; do age --decrypt -i hoc-deu-backup-owner.key \
     -o "backup/$(basename "$f" .age)" "$f"; done
   gunzip backup/*.gz
   pnpm exec tsx tools/backup/cli.ts verify --dir backup   # prints commit=… includes_auth=…
   ```

3. **A fresh target project** (a new Supabase project is the safe default; restoring into the
   damaged one means emptying its `public` tables and `auth.users` first — the owner decides).
   Check out the manifest's `commit`, `supabase link --project-ref <target>`, `supabase db push`
   (that commit's migrations; never the seed).
4. **Load** as `postgres` through the target's session pooler, auth first, in one transaction
   with triggers and foreign keys off:

   ```bash
   psql "<postgres session-pooler URL of the target>" -X -v ON_ERROR_STOP=1 --single-transaction \
     -c 'set session_replication_role = replica' -f backup/auth.sql -f backup/public.sql
   ```

   (Without `auth.sql` for a public-only backup — see §2 step 4 (a) for what that loses.) An
   `ERROR: 42703` in `auth.sql` means the target's auth columns differ: §2 step 5.
5. **Compare the counts:**

   ```bash
   psql "<the same URL>" -X -q -A -t -F $'\t' -v ON_ERROR_STOP=1 -v with_auth=true \
     -f tools/backup/counts.sql > restored-counts.tsv
   pnpm exec tsx tools/backup/cli.ts compare --manifest backup/manifest.json --counts restored-counts.tsv
   ```

6. **Point the app at it:** the Vercel variables, OAuth providers and redirect allow-list as for a
   new production project (`docs/ops/production.md` §4 steps 2 and 6); then a new backup
   environment target (§6). Learners sign in again; their identities bring them back to their
   accounts. Delete `backup/` and `restored-counts.tsv`.
