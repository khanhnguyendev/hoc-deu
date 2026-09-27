# Backups runbook

The daily encrypted backup and the weekly restore test (tasks 5.7b and 5.7c; platform design §2.3,
§8.4 item 1; ADR-0005, ADR-0029). This file has the one-time setup (§2), what to check on the first
runs (§3), retention (§4), rotation (§5), switching the target project (§6), restoring by hand (§7)
and the owner's one-time re-link drill (§8).
No secrets, project refs, keys or e-mail addresses live in this file; every value below is a
placeholder filled in by hand, the same style as `docs/ops/staging.md`.

See also: `.github/workflows/backup.yml` and `restore-test.yml` (guarded by
`tools/backup/workflows.test.ts`), `tools/backup/` (manifest, counts, artifact checks),
`supabase/migrations/20260927000200_ops.sql` (the `backup_reader` role),
`supabase/migrations/20260927000400_backup_auth.sql` (the two functions it reads the auth accounts
through; the column allow-list is `tools/backup/auth-columns.ts`), `docs/ops/production.md` §2
and §4 step 10 (when these steps run during the launch).

## 1. What runs

| Workflow | When | What |
| --- | --- | --- |
| `backup.yml` | daily 22:17 UTC (05:17 in Viet Nam) and by hand | As `backup_reader`, in one snapshot: a data-only dump of `public` (minus `event_quota`), and the accounts — `auth.users` + `auth.identities`, the allow-listed columns only, copied out of `backup.auth_users()` / `backup.auth_identities()`; a manifest (commit, row counts, SHA-256s); gzip; `age` for every recipient; one artifact |
| `restore-test.yml` | Saturday 03:17 UTC and by hand | Decrypts the newest backup with the restore-test key, checks it against its manifest, starts the local Supabase stack at the backup's commit, applies the migrations without `seed.sql`, loads the data (the accounts normalised for GoTrue), compares every table's row count, then asks the local auth server (GoTrue) for every restored account by id |

Both run at minute 17, not on the hour: GitHub delays, and under load drops, scheduled runs at
the top of the hour (ruling M5-R20; the spec's 22:00 UTC became 22:17). Both run only on `main`,
in the GitHub environment `backup` (limited to `main`, so no other branch can read its secrets). The repository is public: anyone can read the logs and download the
artifacts, so every artifact is encrypted before the upload and neither job ever prints a row
(ADR-0005). `/admin` shows the age of the last successful run of each, read once a day by the
maintenance cron (ADR-0034).

**Not in a backup:** the schema (it comes from the migrations of the manifest's commit), every
`auth.users` column outside the allow-list — passwords, one-time tokens, pending e-mail or phone
changes (ADR-0029) — the other `auth` tables (sessions, refresh tokens, MFA factors, audit log —
after a restore every learner signs in once more, and their identities bring them back to the same
accounts), `event_quota` (§4.5 of the platform design: a two-day counter) and Storage objects (the
`content-images` bucket, `docs/ops/content-images.md`).

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

GitHub → repository Settings → Environments → **create or open** `backup`. **(M1)** GitHub creates
an environment the first time a workflow references it, with no deployment-branch rule at all — so
`backup` may already be listed here, from the first scheduled `backup.yml` after the merge (22:17
UTC) or `restore-test.yml` on the next Saturday, both failing with an empty URL until this step
sets the rule. Confirm the rule below whether the environment is new or already existed — never
skip it because it looks already set up:

- **Deployment branches and tags:** "Selected branches and tags" → add the rule `main` (branch).
  Nothing else: no required reviewers (a reviewer would hold every scheduled run), no wait timer.
  Optionally confirm it from the outside too: `gh api repos/khanhnguyendev/hoc-deu/environments/backup`
  prints the environment, including `deployment_branch_policy` — `null` means no rule yet.
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
  - `BACKUP_INCLUDE_AUTH` — **leave it unset.** Only the owner sets it (to `false`), and only as
    the fallback of step 4.

### Step 3 — `backup_reader`'s password and login **[controller]**

The migrations create `backup_reader` as `NOLOGIN` (read-only, `BYPASSRLS`, `SELECT` on every
`public` table but `event_quota`, `EXECUTE` on the two auth functions of step 4); its login and
password are set out of band, with one SQL statement on the target project through the Management
API's database query endpoint. The password is generated locally, sent to Postgres only as its
SCRAM-SHA-256 verifier (so no query log or history ever holds it), and written straight into the
environment secret — never printed, never in git or the chat:

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
- Nobody signs in as `backup_reader` from a workstation — it reads every account's e-mail and
  bypasses RLS. The first backup (step 5) is what proves the login, the URL and the pooler's user
  format; if it fails, it fails before anything is uploaded, and the fix is this step again.

### Step 4 — the auth accounts: nothing to grant, two checks **[controller]**

`backup_reader` never reads `auth.users` or `auth.identities` itself. On hosted Supabase `postgres`
holds `SELECT WITH GRANT OPTION` on the two tables but no grantable `USAGE` on schema `auth`
(controller finding on hosted staging, 2026-09-26), so no grant could give it the tables — and
none is needed: migration `20260927000400_backup_auth.sql`, pushed with M5's migrations
(`docs/ops/production.md` §1), creates schema `backup` with `backup.auth_users()` and
`backup.auth_identities()`. Both are `SECURITY DEFINER`, owned by `postgres`, executable by
`backup_reader` only, and return an allow-list of columns (`tools/backup/auth-columns.ts`) —
never a password, a token or a pending change (ADR-0029, which also says why functions and not
views or grants). The job copies the accounts out of them in its snapshot.

Two read-only checks, through the Management API (never a database connection from a
workstation), printing booleans and schema names only:

```bash
(
set -euo pipefail
ref=<project ref>
: "${SUPABASE_ACCESS_TOKEN:?export a Management API token first}"
query="$(cat <<'SQL'
select
  has_schema_privilege('backup_reader', 'backup', 'usage')
    and has_function_privilege('backup_reader', 'backup.auth_users()', 'execute')
    and has_function_privilege('backup_reader', 'backup.auth_identities()', 'execute')
    as reader_can_call,
  not exists (
    select from unnest(array['public', 'anon', 'authenticated', 'service_role', 'authenticator'])
      as r (name)
    where has_schema_privilege(r.name, 'backup', 'usage')
       or has_schema_privilege(r.name, 'backup', 'create')
       or has_function_privilege(r.name, 'backup.auth_users()', 'execute')
       or has_function_privilege(r.name, 'backup.auth_identities()', 'execute')
  ) as api_roles_shut_out,
  (select count(*) from backup.auth_users()) = (select count(*) from auth.users) as users_complete,
  (select count(*) from backup.auth_identities()) = (select count(*) from auth.identities)
    as identities_complete;
SQL
)"
# 1. The functions and who may call them: four booleans.
jq -n --arg query "$query" '{query: $query}' \
  | curl -fsS -X POST "https://api.supabase.com/v1/projects/$ref/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
      --data-binary @- \
  | jq -ec '.[0] | {reader_can_call, api_roles_shut_out, users_complete, identities_complete}'
# 2. The Data API's exposed schemas. This response also holds the project's JWT secret: never
#    print it whole — only .db_schema.
curl -fsS "https://api.supabase.com/v1/projects/$ref/postgrest" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | jq -er .db_schema
)
```

`pipefail` makes a failed `curl` fail the block rather than read as an empty answer.

1. **All four booleans must be `true`.** The functions are `SECURITY DEFINER`, so calling them as
   `postgres` (the owner) runs the same body with the same rights the job gets: `users_complete` /
   `identities_complete` prove they work on this project and return every account (rerun once if
   someone signed up between the two counts). `reader_can_call` is what the job's own check
   tests; `api_roles_shut_out` proves on the hosted project what pgTAP `001` / `081` prove locally —
   no API role (nor `public`) can use schema `backup` or call either function, whatever a
   dashboard click or a platform default did.
   - `reader_can_call` false, or an error that `backup.auth_users()` does not exist: the migration
     is missing or its grants changed — push it (`docs/ops/production.md` §1); never grant `auth`
     by hand.
   - `api_roles_shut_out` false: stop and ask the owner before the first backup; the fix is the
     migration's `revoke` statements, run again.
2. **The exposed schemas** (by default `public, graphql_public`) must not name `backup` (nor
   `auth`). If they do, remove it (dashboard → Project Settings → Data API → Exposed schemas)
   before the first backup. Locally, `supabase/config.toml`'s `[api].schemas` is checked by
   `tools/backup/auth-columns.test.ts`.

Whether `backup_reader` itself can sign in and call both functions is proven by step 5's first
backup: its callable check and the dump run as `backup_reader`, and it fails before anything is
uploaded otherwise.

**The owner-only fallback, `BACKUP_INCLUDE_AUTH=false`.** Only the owner sets this environment
variable, and only if the functions cannot be made to work on a project. Every backup then holds
`public` only, says so in its manifest (`includesAuth: false`) and warns in each run's log; the
restore test loads and checks `public` only. **What a restore from such a backup loses —
precisely:** the link between each learner's old profile and their new sign-in. All learning data
comes back (profiles, events, plans, progress), still keyed by each learner's old user id; but the
restored project has no `auth.users` rows, so when a learner signs in again with Google or GitHub,
the auth server creates a **new** user with a **new** id, and the sign-up trigger creates a new,
pending, empty profile for it. Nothing ties that new id to the old profile — `profiles` holds no
e-mail — so every learner starts over, the owner included (bootstrapped admin again by
`ADMIN_EMAILS`), while their history sits orphaned under the old ids (rows that violate the
`profiles → auth.users` foreign key, loaded with it switched off). Getting it back means remapping
old ids to new ones by hand, learner by learner (asking each one which profile was theirs), across
every per-user table.

### Step 5 — first runs **[owner or controller]**

On `main`: Actions → **backup** → Run workflow; when it is green, Actions → **restore-test** → Run
workflow. **Both must be green before any production step** (`docs/ops/production.md` §2).

The first backup is also the proof that `backup_reader` signs in through the session pooler and
calls both auth functions (step 4 checked everything else read-only). On the first staging run,
check the one thing the local round trip (task 5.7c) could not: the hosted auth server's columns
against the local stack's (the Supabase CLI version pinned in `package.json`). The backup selects
the allow-listed columns by name, so a column the hosted tables have and the local ones lack never
reaches the dump. Two mismatches still fail — loudly, never with a partial backup:

- **The backup fails** in its snapshot session, whose errors the public log shows as SQLSTATE
  codes only (`ERROR:  42703` — an allow-listed column was dropped or renamed; `ERROR:  42804` —
  retyped beyond what the casts absorb, "structure of query does not match function result
  type"), followed by `dumping auth or counting the rows in the snapshot failed`. Confirm with the
  column comparison below (hosted vs `pnpm db:start`). Fix: a new migration re-creating the
  function for the new columns (a function's result type cannot be replaced in place: `drop
  function` + `create function`, then the grants), with `tools/backup/auth-columns.ts`,
  `auth-dump.sql`, pgTAP `081` and ADR-0029 in the same change.
- **The restore test fails** loading `auth.sql` with `ERROR: 42703` (the local stack lacks a
  column), or its GoTrue check reports `HTTP 404` / `HTTP 500` for the restored users: the local
  GoTrue reads the accounts differently from the backup's. Compare the column lists
  (`select table_name, column_name from information_schema.columns where table_schema = 'auth' and
  table_name in ('users', 'identities') order by 1, 2`, hosted vs `pnpm db:start`); a column GoTrue
  now needs goes into the allow-list (with its reason in ADR-0029), a string column it reads as
  non-null into `tools/backup/normalise-auth.sql`.

## 3. Reading a run

- **backup:** the log shows the kind (daily / weekly), `pg_dump` and server versions, the
  snapshot time, `manifest.json: N tables in M files`, `Encrypted …`, the file check and the
  artifact id. A failure names its reason (URL, role, the auth functions, the snapshot session —
  `dumping auth or counting the rows in the snapshot failed`, after its SQLSTATE line — or a count
  that disagrees with the dump, named by table, never with numbers). Nothing else is printed.
- **restore-test:** the artifact and run it restored, the checks, `Loaded.`,
  `row counts match the manifest for N tables` and `every restored user loads in GoTrue under its
  own id`. A load failure shows only `psql` SQLSTATE lines (`ERROR:  23505`); a count failure
  names the tables and whether each is missing, unexpected or different; a GoTrue failure names
  the kinds (`some restored users do not load in GoTrue under their own id: HTTP 500, another
  id`) — never a row, an id or a count (not even of learners).
- **A restore-test failure right after a migration merges (M5) can be a false red, not a corrupt
  backup:** the manifest records the workflow's own commit, not what migrations the target database
  has actually had pushed to it — a merged migration reaches a hosted project only through the
  manual push (`docs/ops/staging.md` §7). If a backup ran in the gap between the merge and the
  push, its manifest names a commit whose schema the restore test's `db reset` then applies, but
  the data it loads is still the *old* schema's shape: expect `42703` (a column the new migration
  added or removed) or an `unexpected` count, not a real data problem. The fix is finishing the
  push (staging, then production) before the next 22:17 UTC backup — I3 — never re-running the
  restore test against the same stale-relative-to-schema backup.

## 4. Retention and storage

- **Daily** (Monday–Saturday, UTC): artifact `db-backup-daily-<date>`, kept **14 days**.
  **Sunday's** (UTC): `db-backup-weekly-<date>`, kept **90 days** (owner-approved 2026-09-26,
  decision 27). At most about 12 dailies and 13 weeklies exist at once — 25 artifacts.
- **If Sunday's scheduled backup fails, or runs late past 00:00 UTC** (GitHub does this under load
  — it decides daily vs. weekly from the UTC weekday at run time, M4): dispatch it by hand the same
  UTC Sunday (Actions → **backup** → Run workflow, before midnight UTC) so that week still gets its
  90-day artifact — a daily kept only 14 days is the sole record otherwise, and that week's
  long-term point is gone once it expires.
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

`docs/ops/production.md` §4 step 10: run §2 steps 3–4 on the **production** project (the
functions come with its migrations; step 4 checks who may call them, that they return every
account and that `backup` is not exposed), which replaces `SUPABASE_BACKUP_DB_URL`; then run
backup (it proves `backup_reader`'s login on production) and restore-test once more, both green.
Staging's remaining artifacts expire by retention; the restore test always takes the newest.

**Once production's first backup is green (M7):** `backup_reader` on **staging** still has the
login and password set in §2 step 3 — nothing above touches it, and switching the secret does not
revoke the role. Lock it, through the Management API's database query endpoint, the same way step
3 set it (one statement, printing nothing):

```bash
(
set -euo pipefail
ref=<staging project ref>
: "${SUPABASE_ACCESS_TOKEN:?export a Management API token first}"
curl -fsS -X POST "https://api.supabase.com/v1/projects/$ref/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  --data-binary '{"query": "alter role backup_reader nologin password null"}' > /dev/null
echo "backup_reader can no longer sign in on staging"
)
```

Re-enable it (step 3 again, a fresh password) only if staging ever becomes the backup target
again.

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
4. **Load** as `postgres` through the target's session pooler, auth first, then the accounts
   normalised for GoTrue (`tools/backup/normalise-auth.sql`: the token and pending-change columns
   a backup never holds become `''`, or GoTrue cannot load the users — ADR-0029), then public — in
   one transaction with triggers and foreign keys off:

   ```bash
   psql "<postgres session-pooler URL of the target>" -X -v ON_ERROR_STOP=1 --single-transaction \
     -c 'set session_replication_role = replica' -f backup/auth.sql \
     -f tools/backup/normalise-auth.sql -f backup/public.sql
   ```

   (Without `auth.sql` and `normalise-auth.sql` for a public-only backup — see §2 step 4 for what
   that loses.) An `ERROR: 42703` in `auth.sql` means the target's auth columns differ: §2 step 5.
5. **Compare the counts:**

   ```bash
   psql "<the same URL>" -X -q -A -t -F $'\t' -v ON_ERROR_STOP=1 -v with_auth=true \
     -v auth_from=tables -f tools/backup/counts.sql > restored-counts.tsv
   pnpm exec tsx tools/backup/cli.ts compare --manifest backup/manifest.json --counts restored-counts.tsv
   ```

6. **Point the app at it:** the Vercel variables, OAuth providers and redirect allow-list as for a
   new production project (`docs/ops/production.md` §4 steps 2 and 6); then a new backup
   environment target (§6). **A restore needs no re-sign-up:** every account comes back under its
   old id with its identities, so a learner's next Google or GitHub sign-in lands on their own
   profile and history (sessions are not in a backup, so everyone signs in once). The owner signs
   in first and checks their own history. Delete `backup/` and `restored-counts.tsv`.

## 8. The re-link drill — once, 5.8b step 2 **[owner; the controller assists]**

The restore test proves every week that each restored account loads in GoTrue under its old id,
and task 5.7c's local round trip proved that a sign-in (a magic link) lands on the same id with
its profile and history. Neither can prove a **Google or GitHub** sign-in: that needs the real
providers. So the owner runs this once, on staging, after `backup.yml` and `restore-test.yml` are
both green there (`docs/ops/production.md` §2) and before any production step.

**The target** — the owner picks one:

- **(A) Staging itself, emptied** (the default). What is lost: every staging row written after the
  backup's snapshot (take the backup right before the drill and write nothing in between) and all
  sessions; Storage is untouched. Staging already has the manifest commit's migrations, so §7
  step 3 (`db push` to a fresh project) is skipped — but `supabase migration list` against staging
  must show exactly the migrations of the manifest's commit.
- **(B) A throwaway project.** A new Supabase project (Free plan: at most two active — before
  production exists this fits), `supabase db push` of the manifest's commit (§7 step 3), and its
  own OAuth set-up: in the throwaway project's Auth → Providers, **enable Google and GitHub** with
  the client id and secret of the Google OAuth client (add `https://<throwaway
  ref>.supabase.co/auth/v1/callback` to its redirect URIs) and of a second GitHub OAuth app
  created for it (a GitHub app has one callback URL); plus the Site URL / redirect allow-list for a
  local app (`pnpm dev` with the throwaway project's URL and keys). The accounts still match:
  an identity's `provider_id` is Google's `sub` or GitHub's user id, which belong to the person's
  Google or GitHub account, not to the OAuth app, so a sign-in through the new clients finds the
  restored identity. Nothing on staging is lost; the project, the second GitHub app and the extra
  redirect URI are deleted afterwards.

**Nothing is emptied until everything that can be checked without writing has passed** (steps
1–5); then the target is emptied and loaded at once (step 6).

1. **Before — write it down.** On staging, for the owner's account (and one other learner's if
   there is one): the `profiles.id`, and the history the app shows — `/progress` (the streak, the
   heatmap's last weeks), `/today`'s plan — plus, as `postgres`, counts only:

   ```sql
   select p.id,
          (select count(*) from public.events e where e.user_id = p.id) as events,
          (select count(*) from public.day_plans d where d.user_id = p.id) as plans,
          (select string_agg(i.provider, ', ' order by i.provider)
             from auth.identities i where i.user_id = p.id) as providers,
          (select count(*) from auth.users) as accounts
   from public.profiles p join auth.users u on u.id = p.id
   where u.email = '<the owner''s e-mail>';
   ```

2. **Back up:** dispatch `backup.yml` on `main`; wait for green.
3. **Restore-test that backup:** dispatch `restore-test.yml` on `main`; wait for green, and check
   its log names the artifact of step 2's run (it takes the newest). The backup now decrypts,
   loads, counts and loads in GoTrue.
4. **Download, decrypt and verify it** with the owner key (§7 steps 1–2) — the owner key, `age`
   and `psql` ≥ 17.6 (`psql --version`; pg_dump's `\restrict` lines) at hand before anything is
   emptied.
5. **Preflight on the target, read-only**, through the very connection §7 step 4 will load
   through (as `postgres`, the target's session pooler):

   ```bash
   psql "<postgres session-pooler URL of the target>" -X -v ON_ERROR_STOP=1 -q -A -t \
     -c 'begin' -c 'set local session_replication_role = replica' -c 'rollback' \
     -c "select current_user,
           has_table_privilege('postgres', 'auth.users', 'insert')
             and has_table_privilege('postgres', 'auth.users', 'update')
             and has_table_privilege('postgres', 'auth.users', 'delete')
             and has_table_privilege('postgres', 'auth.identities', 'insert') as auth_writable,
           not exists (
             select from pg_catalog.pg_tables t
             where t.schemaname = 'public'
               and not (has_table_privilege('postgres', format('%I.%I', t.schemaname, t.tablename), 'insert')
                        and has_table_privilege('postgres', format('%I.%I', t.schemaname, t.tablename), 'delete'))
           ) as public_writable"
   ```

   It must print `postgres|t|t` and no error: `permission denied to set parameter
   "session_replication_role"` means the load cannot switch triggers and foreign keys off — stop
   and ask the owner. (One privilege per `has_table_privilege` call: a comma list is true when
   *any* of them is held. `set_config()` is no substitute for `set`: Supabase allows `postgres`
   the statement, not the function.)
6. **Empty and load at once, in one transaction** — **nobody signs in to the target between the
   delete and the load** (close every staging tab first): a sign-in creates a new account, and the
   load then fails on it (`23505`, the e-mail's unique index) and rolls back — delete the stray
   account the same way and start again from the delete. The person who holds the decrypted
   `backup/*.sql` files (step 4 — today, the owner; there is no separate "empties staging" step
   for someone else to run) runs this single command, for (A) **on staging only — never
   production**:

   ```bash
   psql "<postgres session-pooler URL of the target>" -X -v ON_ERROR_STOP=1 --single-transaction \
     -c 'delete from auth.users' -c 'delete from public.ops_metrics' \
     -c 'set session_replication_role = replica' \
     -f backup/auth.sql -f tools/backup/normalise-auth.sql -f backup/public.sql
   ```

   The deletes cascade to identities, sessions, profiles and every per-user table through their
   normal foreign-key triggers (`auth.users`), plus `public.ops_metrics` (the backup brings its own
   rows, under the same ids) — both **before** `set session_replication_role = replica`, which
   would otherwise switch those cascade triggers off along with everything else. Any error in the
   command rolls back the whole thing to the untouched, unemptied target: the delete and the load
   are one transaction, so staging is never left empty with nothing loaded. Continue straight to
   §7 step 5 (the counts must match).
7. **Sign in with Google.** Run the query of step 1 again: the **same `profiles.id`**, the same
   `events` and `plans` counts, and `accounts` equal to step 1's (no new account). `/progress` and
   `/today` show the same history as before.
8. **Sign out; sign in with GitHub.** The same checks. (Each provider lands on the account its
   identity belongs to: when the owner's Google and GitHub e-mails differ, they are two accounts,
   and each must come back as its own old id.)
9. **Write down after**, next to before, in the 5.8b notes. Any difference — a new id, a pending
   profile, a missing plan, another `accounts` count — stops the launch: the owner decides before
   any production step.
10. (B) Delete the throwaway project, the second GitHub OAuth app and the extra Google redirect URI.
