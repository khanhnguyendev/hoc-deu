# ADR-0005: Public repository — every artifact encrypted, no data in logs, security features on

- **Status:** accepted
- **Date:** 2026-09-26
- **Spec:** platform design §0.1 (Q7), §2.3 (backups), §2.5, §8 risk R9; implementation plan task
  0.10 (security settings) and task 5.7b (backups)

## Context

The repository is public (Q7): the code, the content under its own licence (ADR-0033), and
everything GitHub Actions produces. That last part matters most:

- **Workflow logs** of a public repository can be read by anyone.
- **Artifacts** can be downloaded by anyone signed in to GitHub.
- **Pull requests from forks** run the repository's `pull_request` workflows — with the fork's
  version of the workflow files — and can upload artifacts under any name.
- A secret committed once is public for good.

The backups (ADR-0029) are the first workflows that handle learner data: a dump of the whole
database, a key that decrypts it, and a database URL with a password.

## Decision

- **Every artifact that holds data is encrypted before the upload** — `age`, for at least two
  recipients: the owner's offline key and the restore-test key (docs/ops/backups.md). The backup
  job gzips and encrypts each dump and the manifest, then checks that its upload directory holds
  exactly the expected `age`-encrypted, non-empty files (`tools/backup/artifact.ts`) before the
  upload step runs: plaintext can never reach an artifact.
- **Logs never show data.** No `set -x`; no `cat` / `head` / `tail` / `tee` of any file; psql's
  output is discarded and its errors are shown as SQLSTATE codes only (a server message can quote
  a row); tools print table and file names, never a row or a count. Row counts and checksums live
  in the encrypted manifest. `tools/backup/workflows.test.ts` guards all of it — these workflows
  run only on `main`, so that test is their only check before a merge.
- **Secrets live in environments limited to `main`** — `backup` now, `bot` in v1.1 — or in Vercel;
  no pull-request branch (`claude/*` included) can read them. Inside a job, only the step that
  needs a secret gets it (step-level `env`, never workflow- or job-level), values reach scripts
  through `env` only (no `${{ }}` inside a script), and the secret-bearing steps run no Node code.
- **Nothing a pull request can create is trusted.** The restore test takes the newest artifact of a
  successful `backup.yml` run on `main` of this repository, started by its schedule or by hand —
  never the newest artifact by name — checks the manifest's commit is on `main` before checking it
  out, and scans every dump for psql meta-commands before `psql` loads it.
- **GitHub's security features stay on** (task 0.10): secret scanning with push protection,
  Dependabot alerts and version updates (`.github/dependabot.yml`), CodeQL for
  JavaScript/TypeScript and Actions (`.github/workflows/codeql.yml`), and the `main` ruleset.
- What never enters git is listed in `CLAUDE.md` ("Safety"): `.env*` but `.env.example`,
  `docs/credentials/`, any secret, any per-user data (`seed.sql` is synthetic).

## Consequences

- Easier: anyone can read and review the code and the workflows; the backups need no private
  storage.
- Harder: every workflow that touches data needs the same discipline, and a test that pins it.
- Accepted: an artifact's metadata is public — its name (kind and date), size and the run that
  made it: roughly how big the database is and when it is backed up, nothing more.
- Accepted: the restore-test key sits in GitHub's secrets. Anyone who can run a job in the
  `backup` environment — only code merged to `main` — could decrypt every artifact. That is the
  same trust as the database URL beside it.
- Accepted: losing both private keys loses every backup; the owner keeps the offline key in two
  places (docs/ops/backups.md §2 step 1).
