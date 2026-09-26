/**
 * Guards the backup and restore-test workflows (task 5.7b, ADR-0005, ADR-0029). They run only on
 * `main` (the `backup` environment), so no pull request ever runs them: this file is their only
 * check before the merge. The repository is public — anyone can read the logs and download the
 * artifacts — so most checks here are about what must never be printed or uploaded.
 */
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '..', '..')

type Step = {
  id?: string
  name?: string
  if?: string
  uses?: string
  run?: string
  shell?: string
  with?: Record<string, string | number | boolean>
  env?: Record<string, string>
}
type Job = {
  name?: string
  'runs-on': string
  'timeout-minutes': number
  environment: string
  permissions?: unknown
  env?: Record<string, string>
  'continue-on-error'?: unknown
  steps: Step[]
}
type Workflow = {
  on: Record<string, unknown>
  permissions: Record<string, string>
  concurrency: { group: string; 'cancel-in-progress': boolean }
  env?: unknown
  jobs: Record<string, Job>
}

function load(file: string): { text: string; workflow: Workflow; job: Job; steps: Step[] } {
  const text = readFileSync(join(ROOT, '.github', 'workflows', file), 'utf8')
  const workflow = parseYaml(text) as Workflow
  const jobs = Object.values(workflow.jobs)
  if (jobs.length !== 1) throw new Error(`${file}: expected one job`)
  const job = jobs[0] as Job
  return { text, workflow, job, steps: job.steps }
}

const backup = load('backup.yml')
const restore = load('restore-test.yml')

const stepNamed = (steps: Step[], name: string): Step => {
  const found = steps.find((step) => step.name === name)
  if (found === undefined) throw new Error(`no step "${name}"`)
  return found
}
const indexOf = (steps: Step[], predicate: (step: Step) => boolean, label: string): number => {
  const index = steps.findIndex(predicate)
  if (index === -1) throw new Error(`no step: ${label}`)
  return index
}
const named = (name: string) => (step: Step) => step.name === name
/** A script's commands: continuation lines joined, comment lines dropped, indentation trimmed. */
const commands = (step: Step): string[] =>
  (step.run ?? '')
    .replace(/\s*\\\n\s*/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))

// Step names, shared by the tests below and the workflows.
const B = {
  install: 'Install postgresql-client-17 (PGDG) and age',
  meta: 'Backup kind and date (UTC; Sunday’s backup is the weekly one)',
  dump: 'Dump the database as backup_reader, in one snapshot',
  manifest: 'Write the manifest',
  encrypt: 'Compress and encrypt for every recipient',
  check: 'Every expected file is present, encrypted and not empty',
  weekly: 'Upload the weekly backup (kept 90 days)',
  daily: 'Upload the daily backup (kept 14 days)',
  uploaded: 'The backup artifact was uploaded',
  cleanup: 'Remove the plaintext',
}
const R = {
  install: 'Install postgresql-client-17 (PGDG) and age',
  find: 'Find the newest backup (a successful scheduled or dispatched backup.yml run on main)',
  download: 'Download it and check its files',
  decrypt: 'Decrypt with the restore-test key, then decompress',
  verify: 'Check the manifest and every file’s SHA-256',
  checkout: 'Check out the backup’s commit (its migrations are the backup’s schema)',
  reset: 'Apply that commit’s migrations without seed.sql',
  load: 'Load the data, auth first, with triggers and foreign keys off',
  compare: 'Compare every table’s row count with the manifest',
  cleanup: 'Remove the plaintext',
}

/** Steps that handle backup data or the key: they create files only their user can read. */
const DATA_STEPS = {
  backup: [B.meta, B.dump, B.manifest, B.encrypt, B.check],
  restore: [R.find, R.download, R.decrypt, R.verify, R.load, R.compare],
}

describe.each([
  ['backup.yml', backup, { cron: '0 22 * * *', permissions: { contents: 'read' } }],
  [
    'restore-test.yml',
    restore,
    { cron: '0 3 * * 6', permissions: { contents: 'read', actions: 'read' } },
  ],
] as const)('%s', (_file, { text, workflow, job, steps }, expected) => {
  it('runs on its schedule and by hand only — never for a push or a pull request', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['schedule', 'workflow_dispatch'])
    expect(workflow.on.schedule).toEqual([{ cron: expected.cron }])
  })

  it('uses the backup environment (limited to main) with the least permissions', () => {
    expect(job.environment).toBe('backup')
    expect(workflow.permissions).toEqual(expected.permissions)
    expect(job.permissions).toBeUndefined()
    expect(job['continue-on-error']).toBeUndefined()
  })

  it('runs one job at a time on the pinned image, for at most 30 minutes', () => {
    expect(workflow.concurrency['cancel-in-progress']).toBe(false)
    expect(job['runs-on']).toBe('ubuntu-24.04')
    expect(job['timeout-minutes']).toBe(30)
  })

  it('checks out without keeping the token', () => {
    const checkout = steps[0] as Step
    expect(checkout.uses).toBe('actions/checkout@v7')
    expect(checkout.with?.['persist-credentials']).toBe(false)
  })

  it('never traces a script (set -x would print every secret-bearing command)', () => {
    expect(text).not.toMatch(
      /set -[a-z]*x|set -o xtrace|bash -[a-z]*x|set -[a-z]*v\b|set -o verbose/,
    )
  })

  it('never prints a file: no cat, head, tail, less, more, tee or hex dumpers anywhere', () => {
    const printers =
      /(?:^|[|;&(]|\$\(|\bsudo)\s*(cat|head|tail|less|more|tee|xxd|od|hexdump|strings)\b/
    for (const step of steps) {
      for (const line of commands(step)) expect(line, step.name).not.toMatch(printers)
    }
  })

  it('never reads a .sql file with grep, sed or awk (they print what they match)', () => {
    for (const step of steps) {
      for (const line of commands(step)) {
        if (/\bgrep\b|\bsed\b|\bawk\b/.test(line)) expect(line, step.name).not.toContain('.sql')
      }
    }
  })

  it('runs psql without psqlrc and never echoes the input it runs', () => {
    const psql = steps.flatMap(commands).filter((line) => line.includes('$PG_BIN/psql" --dbname='))
    expect(psql.length).toBeGreaterThan(0)
    for (const line of psql) {
      expect(line).toContain(' -X ')
      expect(line).not.toMatch(/--echo|\s-[a-zA-Z]*[aeb]\s/)
    }
  })

  it('never interpolates an expression into a script: values reach bash through env only', () => {
    for (const step of steps) expect(step.run ?? '', step.name).not.toContain('${{')
  })

  it('keeps secrets out of workflow- and job-level env', () => {
    expect(workflow.env).toBeUndefined()
    expect(JSON.stringify(job.env ?? {})).not.toContain('secrets.')
  })

  it('runs every multi-line script under bash with set -euo pipefail', () => {
    const scripts = steps.filter((step) => (step.run ?? '').includes('\n'))
    expect(scripts.length).toBeGreaterThan(4)
    for (const step of scripts) {
      expect(step.shell, step.name).toBe('bash')
      expect(step.run?.startsWith('set -euo pipefail\n'), step.name).toBe(true)
    }
  })

  it('installs postgresql-client-17 from PGDG (key fingerprint checked) and age', () => {
    expect(job.env?.PG_BIN).toBe('/usr/lib/postgresql/17/bin')
    const install = stepNamed(steps, B.install).run ?? ''
    expect(install).toContain('https://www.postgresql.org/media/keys/ACCC4CF8.asc')
    expect(install).toContain('B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8')
    expect(install).toContain('https://apt.postgresql.org/pub/repos/apt')
    expect(install).toMatch(/apt-get install .*postgresql-client-17 age/)
  })

  it('removes the plaintext at the end, whatever happened', () => {
    const cleanup = steps.at(-1) as Step
    expect(cleanup.name).toBe('Remove the plaintext')
    expect(cleanup.if).toBe('always()')
  })
})

describe('backup.yml', () => {
  const { steps } = backup
  const step = (name: string) => stepNamed(steps, name)
  const script = (name: string) => step(name).run ?? ''

  it('creates every file of backup data readable by its user only (umask 077)', () => {
    for (const name of DATA_STEPS.backup) {
      expect(script(name).startsWith('set -euo pipefail\numask 077\n'), name).toBe(true)
    }
  })

  it('hands the database URL to the dump step only, which runs no Node code', () => {
    const holders = steps.filter((candidate) => JSON.stringify(candidate).includes('secrets.'))
    expect(holders.map((holder) => holder.name)).toEqual([B.dump])
    expect(step(B.dump).env).toEqual({
      SUPABASE_BACKUP_DB_URL: '${{ secrets.SUPABASE_BACKUP_DB_URL }}',
      BACKUP_INCLUDE_AUTH: '${{ vars.BACKUP_INCLUDE_AUTH }}',
    })
    expect(script(B.dump)).not.toMatch(/\b(pnpm|node|npx|npm|tsx)\b/)
  })

  it('dumps as backup_reader through TLS, refusing the transaction-mode pooler', () => {
    const dump = script(B.dump)
    expect(dump).toContain("-c 'select current_user'")
    expect(dump).toContain('!= backup_reader')
    expect(dump).toContain('*:6543/*')
    expect(dump).toContain('sslmode=require')
  })

  it('includes auth unless BACKUP_INCLUDE_AUTH=false, and fails clearly when auth is unreadable', () => {
    const dump = script(B.dump)
    expect(dump).toContain('case "${BACKUP_INCLUDE_AUTH:-true}" in')
    expect(dump).toMatch(/\*\) echo "::error::BACKUP_INCLUDE_AUTH must be/)
    expect(dump).toContain("has_schema_privilege('auth', 'usage')")
    const unreadable = dump
      .split('\n')
      .find((line) =>
        line.includes('::error::backup_reader cannot read auth.users and auth.identities'),
      )
    expect(unreadable).toContain('docs/ops/backups.md')
    expect(unreadable).toContain('BACKUP_INCLUDE_AUTH=false')
    expect(unreadable).toContain('No backup was made')
    expect(dump).toMatch(/::warning::BACKUP_INCLUDE_AUTH=false/)
  })

  it('dumps public (minus event_quota) and auth in one exported snapshot, and counts in it', () => {
    const lines = commands(step(B.dump))
    expect(script(B.dump)).toContain('begin isolation level repeatable read, read only;')
    expect(script(B.dump)).toContain('pg_export_snapshot()')
    const publicDump = lines.find((line) => line.includes('--file="$work/public.sql"'))
    const authDump = lines.find((line) => line.includes('--file="$work/auth.sql"'))
    for (const dump of [publicDump, authDump]) {
      expect(dump).toMatch(
        /^"\$PG_BIN\/pg_dump" --dbname="\$db" --snapshot="\$snapshot" --data-only --no-owner --no-privileges /,
      )
    }
    expect(publicDump).toContain('--schema=public --exclude-table=public.event_quota')
    expect(authDump).toContain('--table=auth.users --table=auth.identities')
    // The snapshot session reads its SQL from a FIFO this shell holds open; it must not inherit
    // that descriptor, or it never sees the end of its input and the job hangs (dry run, 5.7b).
    expect(lines).toContain('exec 3<> "$work/holder.sql"')
    expect(lines).toContain(
      '"$PG_BIN/psql" --dbname="$db" -X -q -A -t -F $\'\\t\' -v ON_ERROR_STOP=1 -v with_auth="$with_auth" -f "$work/holder.sql" 3>&- &',
    )
    expect(lines).toContain('exec 3>&-')
    // The same session that exported the snapshot runs counts.sql, then commits.
    expect(script(B.dump)).toContain('"\\\\i \'$GITHUB_WORKSPACE/tools/backup/counts.sql\'"')
    expect(lines.findIndex((line) => line.includes('counts.sql'))).toBeGreaterThan(
      lines.findIndex((line) => line.includes('--file="$work/auth.sql"')),
    )
  })

  it('writes the manifest with the commit that ran (the restore applies its migrations)', () => {
    expect(commands(step(B.manifest))).toContainEqual(
      expect.stringMatching(
        /^pnpm exec tsx tools\/backup\/cli\.ts manifest .*--commit "\$GITHUB_SHA"/,
      ),
    )
  })

  it('makes Sunday’s (UTC) backup the weekly one', () => {
    const meta = script(B.meta)
    expect(meta).toContain(`read -r day weekday <<< "$(date -u '+%F %u')"`)
    expect(meta).toContain('if [ "$weekday" = 7 ]; then kind=weekly; else kind=daily; fi')
  })

  it('gzips and age-encrypts every file for every recipient — at least two distinct keys', () => {
    const encrypt = script(B.encrypt)
    expect(encrypt).toContain('gzip -n "$work/$name"')
    expect(encrypt).toContain('recipients+=(-r "$key")')
    expect(encrypt).toContain(
      'age --encrypt "${recipients[@]}" --output "$upload/$name.gz.age" "$work/$name.gz"',
    )
    expect(encrypt).toContain(
      'age --encrypt "${recipients[@]}" --output "$upload/manifest.json.age" "$work/manifest.json"',
    )
    expect(encrypt).toMatch(/if \[ "\$\{#seen\[@\]\}" -lt 2 \]; then\n\s+echo "::error::/)
    expect(step(B.encrypt).env?.BACKUP_AGE_RECIPIENTS).toBe('${{ vars.BACKUP_AGE_RECIPIENTS }}')
  })

  it('encrypts, then checks the files, then uploads — never the plaintext', () => {
    const encryptAt = indexOf(steps, named(B.encrypt), B.encrypt)
    const checkAt = indexOf(steps, named(B.check), B.check)
    const uploads = steps.filter((candidate) =>
      candidate.uses?.startsWith('actions/upload-artifact'),
    )
    expect(uploads).toHaveLength(2)
    expect(encryptAt).toBeLessThan(checkAt)
    for (const upload of uploads) {
      expect(steps.indexOf(upload)).toBeGreaterThan(checkAt)
      expect(upload.uses).toBe('actions/upload-artifact@v7')
      expect(upload.with?.path).toBe('${{ runner.temp }}/backup-upload')
      expect(upload.with?.['if-no-files-found']).toBe('error')
    }
    expect(script(B.check)).toContain(
      'pnpm exec tsx tools/backup/cli.ts check-artifact --dir "$RUNNER_TEMP/backup-upload" --auth "$auth"',
    )
  })

  it('keeps Sunday’s artifact 90 days and the others 14 (decision 27)', () => {
    expect(step(B.weekly)).toMatchObject({
      if: "steps.meta.outputs.kind == 'weekly'",
      with: { name: 'db-backup-weekly-${{ steps.meta.outputs.date }}', 'retention-days': 90 },
    })
    expect(step(B.daily)).toMatchObject({
      if: "steps.meta.outputs.kind == 'daily'",
      with: { name: 'db-backup-daily-${{ steps.meta.outputs.date }}', 'retention-days': 14 },
    })
  })

  it('fails when no artifact was uploaded', () => {
    const uploadedAt = indexOf(steps, named(B.uploaded), B.uploaded)
    expect(uploadedAt).toBeGreaterThan(indexOf(steps, named(B.daily), B.daily))
    expect(step(B.uploaded).env).toEqual({
      WEEKLY_ID: '${{ steps.upload-weekly.outputs.artifact-id }}',
      DAILY_ID: '${{ steps.upload-daily.outputs.artifact-id }}',
    })
    expect(script(B.uploaded)).toMatch(
      /if \[ -z "\$WEEKLY_ID\$DAILY_ID" \]; then\n\s+echo "::error::/,
    )
  })
})

describe('restore-test.yml', () => {
  const { steps } = restore
  const step = (name: string) => stepNamed(steps, name)
  const script = (name: string) => step(name).run ?? ''

  it('checks out the whole history, so the manifest’s commit is reachable', () => {
    expect((steps[0] as Step).with?.['fetch-depth']).toBe(0)
  })

  it('creates every file of backup data readable by its user only (umask 077)', () => {
    for (const name of DATA_STEPS.restore) {
      expect(script(name).startsWith('set -euo pipefail\numask 077\n'), name).toBe(true)
    }
  })

  it('trusts only artifacts of successful scheduled or dispatched backup.yml runs on main', () => {
    const find = script(R.find)
    expect(find).toContain('actions/workflows/backup.yml/runs?branch=main&status=success')
    expect(find).toContain('select(.event == "schedule" or .event == "workflow_dispatch")')
    expect(find).toContain('select(.head_branch == "main")')
    expect(find).toContain('select(.head_repository.full_name == env.REPOSITORY)')
    expect(find).toContain('test("^db-backup-(daily|weekly)-[0-9]{4}-[0-9]{2}-[0-9]{2}$")')
    expect(step(R.find).env).toEqual({
      GH_TOKEN: '${{ github.token }}',
      REPOSITORY: '${{ github.repository }}',
    })
  })

  it('checks the downloaded files before decrypting them', () => {
    const lines = commands(step(R.download))
    const download = lines.findIndex((line) => line.startsWith('gh run download "$RUN_ID"'))
    const check = lines.findIndex((line) =>
      line.startsWith(
        'pnpm exec tsx tools/backup/cli.ts check-artifact --dir "$RUNNER_TEMP/restore/encrypted" --auth optional',
      ),
    )
    expect(download).toBeGreaterThanOrEqual(0)
    expect(check).toBeGreaterThan(download)
  })

  it('hands the restore key to the decrypt step only, as a 0600 file removed right after', () => {
    const holders = steps.filter((candidate) => JSON.stringify(candidate).includes('secrets.'))
    expect(holders.map((holder) => holder.name)).toEqual([R.decrypt])
    expect(step(R.decrypt).env).toEqual({ BACKUP_RESTORE_KEY: '${{ secrets.BACKUP_RESTORE_KEY }}' })
    const decrypt = script(R.decrypt)
    expect(decrypt).not.toMatch(/\b(pnpm|node|npx|npm|tsx)\b/)
    expect(decrypt).toContain('key="$RUNNER_TEMP/restore-key.txt"')
    expect(decrypt).toContain('trap \'rm -f "$key"\' EXIT')
    expect(decrypt).toContain('printf \'%s\\n\' "${BACKUP_RESTORE_KEY:-}" > "$key"')
    expect(decrypt).toContain('age --decrypt --identity "$key"')
    // Removed before anything decrypted is used, not only when the step ends.
    const lines = commands(step(R.decrypt))
    expect(lines.indexOf('rm -f "$key"')).toBeGreaterThan(
      lines.findIndex((line) => line.startsWith('age --decrypt')),
    )
  })

  it('restores in order: verify, check out the commit, install, start, reset without seed, load, compare', () => {
    const at = (predicate: (candidate: Step) => boolean, label: string) =>
      indexOf(steps, predicate, label)
    const order = [
      at(named(R.find), R.find),
      at(named(R.download), R.download),
      at(named(R.decrypt), R.decrypt),
      at(named(R.verify), R.verify),
      at(named(R.checkout), R.checkout),
      at(
        (candidate) =>
          candidate.run === 'pnpm install --frozen-lockfile' &&
          steps.indexOf(candidate) > steps.findIndex(named(R.checkout)),
        'pnpm install after the checkout',
      ),
      at((candidate) => candidate.run === 'pnpm db:start', 'pnpm db:start'),
      at(named(R.reset), R.reset),
      at(named(R.load), R.load),
      at(named(R.compare), R.compare),
    ]
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(step(R.reset).run).toBe('pnpm exec supabase db reset --no-seed')
  })

  it('checks out only a commit on main, named by a verified manifest', () => {
    expect(script(R.verify)).toContain(
      'pnpm exec tsx tools/backup/cli.ts verify --dir "$RUNNER_TEMP/restore/plain"',
    )
    expect(step(R.checkout).env).toEqual({ COMMIT: '${{ steps.verify.outputs.commit }}' })
    const checkout = script(R.checkout)
    expect(checkout).toContain('[[ ! "$COMMIT" =~ ^[0-9a-f]{40}$ ]]')
    expect(checkout).toContain('git merge-base --is-ancestor "$COMMIT" refs/remotes/origin/main')
    expect(checkout).toContain('git checkout --quiet --detach "$COMMIT"')
  })

  it('loads auth, then public, in one transaction with session_replication_role = replica', () => {
    const load = commands(step(R.load)).join('\n')
    expect(load).toContain(
      '"$PG_BIN/psql" --dbname="$LOCAL_DB_URL" -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -v SHOW_CONTEXT=never --single-transaction -c \'set session_replication_role = replica\' "${files[@]}"',
    )
    const script = step(R.load).run ?? ''
    expect(script.indexOf('files+=(-f "$plain/auth.sql")')).toBeGreaterThan(-1)
    expect(script.indexOf('files+=(-f "$plain/auth.sql")')).toBeLessThan(
      script.indexOf('files+=(-f "$plain/public.sql")'),
    )
    expect(restore.job.env?.LOCAL_DB_URL).toBe(
      'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
    )
  })

  it('never prints what psql says while loading, only its SQLSTATE lines', () => {
    const load = commands(step(R.load)).join('\n')
    expect(load).toContain('> /dev/null 2> "$RUNNER_TEMP/restore/load.err" || status=$?')
    expect(load).toContain(
      'grep -E \'^(psql:[^ ]+:[0-9]+: )?(ERROR|FATAL): +[0-9A-Z]{5}$\' "$RUNNER_TEMP/restore/load.err"',
    )
  })

  it('counts every restored table with counts.sql and compares with the manifest', () => {
    const lines = commands(step(R.compare))
    expect(lines).toContainEqual(
      expect.stringMatching(
        /^"\$PG_BIN\/psql" --dbname="\$LOCAL_DB_URL" -X -q -A -t -F \$'\\t' -v ON_ERROR_STOP=1 -v with_auth="\$INCLUDES_AUTH" -f tools\/backup\/counts\.sql > "\$restore\/restored-counts\.tsv"$/,
      ),
    )
    expect(lines).toContain(
      'pnpm exec tsx tools/backup/cli.ts compare --manifest "$restore/plain/manifest.json" --counts "$restore/restored-counts.tsv"',
    )
    expect(step(R.compare).env).toEqual({
      INCLUDES_AUTH: '${{ steps.verify.outputs.includes_auth }}',
    })
  })
})
