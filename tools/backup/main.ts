/**
 * `pnpm exec tsx tools/backup/cli.ts <command> …` — the Node half of the backup and restore-test
 * workflows (task 5.7b, ADR-0029; `cli.ts` only calls `main`). The workflows' bash steps run
 * pg_dump, psql and age; these commands never touch the database, a secret or the network:
 *
 * - `manifest --work <dir> --counts <file> --commit <sha> --kind daily|weekly --taken-at <iso>
 *   --pg-dump <version> --server <version> --with-auth true|false` — scans `<dir>/public.sql` (and
 *   `auth.sql`), checks them against the snapshot's counts and writes `<dir>/manifest.json` (0600).
 * - `check-artifact --dir <dir> --auth required|absent|optional` — the artifact holds exactly the
 *   expected age-encrypted, non-empty files.
 * - `verify --dir <dir>` — a decrypted backup matches its manifest; prints `commit=…`,
 *   `includes_auth=…`, `kind=…` and `taken_at=…` for `$GITHUB_OUTPUT`.
 * - `compare --manifest <file> --counts <file>` — the restored database's counts (counts.sql
 *   output) equal the manifest's.
 *
 * Output names files and tables, never a row or a count. Exit codes: 0 fine · 1 the check failed
 * or a file is unreadable · 2 bad arguments.
 */
import { access, chmod, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { checkArtifactDir, type AuthExpectation } from './artifact'
import { compareCounts, describeDifferences, parseCounts } from './counts'
import { scanDump } from './dump'
import {
  AUTH_FILE,
  MANIFEST_FILE,
  PUBLIC_FILE,
  buildManifest,
  parseManifest,
  verifyBackupDir,
  type ManifestInput,
} from './manifest'

export type Io = { out: (line: string) => void; err: (line: string) => void }

const USAGE = [
  'usage: tsx tools/backup/cli.ts manifest --work <dir> --counts <file> --commit <sha> --kind daily|weekly',
  '         --taken-at <iso> --pg-dump <version> --server <version> --with-auth true|false',
  '       tsx tools/backup/cli.ts check-artifact --dir <dir> --auth required|absent|optional',
  '       tsx tools/backup/cli.ts verify --dir <dir>',
  '       tsx tools/backup/cli.ts compare --manifest <file> --counts <file>',
].join('\n')

class UsageError extends Error {}

const COMMANDS = {
  manifest: [
    'work',
    'counts',
    'commit',
    'kind',
    'taken-at',
    'pg-dump',
    'server',
    'with-auth',
  ] as const,
  'check-artifact': ['dir', 'auth'] as const,
  verify: ['dir'] as const,
  compare: ['manifest', 'counts'] as const,
}
type Command = keyof typeof COMMANDS

/** Every option of the command, each required, each given once. */
function options<C extends Command>(
  command: C,
  argv: readonly string[],
): Record<(typeof COMMANDS)[C][number], string> {
  const names = COMMANDS[command]
  let values: Record<string, string | undefined>
  try {
    ;({ values } = parseArgs({
      args: [...argv],
      options: Object.fromEntries(names.map((name) => [name, { type: 'string' as const }])),
      allowPositionals: false,
      strict: true,
    }) as { values: Record<string, string | undefined> })
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error))
  }
  for (const name of names) {
    if (values[name] === undefined || values[name] === '') {
      throw new UsageError(`${command}: --${name} is required`)
    }
  }
  return values as Record<(typeof COMMANDS)[C][number], string>
}

function oneOf<T extends string>(value: string, allowed: readonly T[], option: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new UsageError(`--${option} must be ${allowed.join(' or ')}`)
  }
  return value as T
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  )
}

async function manifestCommand(argv: readonly string[], io: Io): Promise<number> {
  const given = options('manifest', argv)
  const kind = oneOf(given.kind, ['daily', 'weekly'], 'kind')
  const includesAuth = oneOf(given['with-auth'], ['true', 'false'], 'with-auth') === 'true'
  const scans: ManifestInput['scans'] = {
    [PUBLIC_FILE]: await scanDump(join(given.work, PUBLIC_FILE)),
  }
  // An auth.sql is scanned whenever it exists, so a stray one is refused, not silently left out.
  const authPath = join(given.work, AUTH_FILE)
  if (includesAuth || (await exists(authPath))) scans[AUTH_FILE] = await scanDump(authPath)
  const manifest = buildManifest({
    commit: given.commit,
    takenAt: given['taken-at'],
    kind,
    includesAuth,
    pgDump: given['pg-dump'],
    server: given.server,
    counts: parseCounts(await readFile(given.counts, 'utf8')),
    scans,
  })
  const path = join(given.work, MANIFEST_FILE)
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  await chmod(path, 0o600)
  const tables = Object.keys(manifest.counts).length
  const files = Object.keys(manifest.files).length
  io.out(`${MANIFEST_FILE}: ${tables} tables in ${files} files`)
  return 0
}

async function checkArtifactCommand(argv: readonly string[], io: Io): Promise<number> {
  const given = options('check-artifact', argv)
  const auth = oneOf<AuthExpectation>(given.auth, ['required', 'absent', 'optional'], 'auth')
  const problems = await checkArtifactDir(given.dir, auth)
  if (problems.length > 0) {
    io.err(`the backup artifact is not as expected:\n${problems.join('\n')}`)
    return 1
  }
  io.out(`${(await readdir(given.dir)).length} encrypted files, none empty`)
  return 0
}

async function verifyCommand(argv: readonly string[], io: Io): Promise<number> {
  const given = options('verify', argv)
  const manifest = await verifyBackupDir(given.dir)
  io.out(
    [
      `commit=${manifest.commit}`,
      `includes_auth=${manifest.includesAuth}`,
      `kind=${manifest.kind}`,
      `taken_at=${manifest.takenAt}`,
    ].join('\n'),
  )
  return 0
}

async function compareCommand(argv: readonly string[], io: Io): Promise<number> {
  const given = options('compare', argv)
  const manifest = parseManifest(await readFile(given.manifest, 'utf8'))
  const restored = parseCounts(await readFile(given.counts, 'utf8'))
  const differences = compareCounts(manifest.counts, restored)
  if (differences.length > 0) {
    io.err(
      `row counts differ from the manifest:\n${describeDifferences(differences, {
        expected: 'the manifest',
        actual: 'the restored database',
      })}`,
    )
    return 1
  }
  io.out(`row counts match the manifest for ${Object.keys(manifest.counts).length} tables`)
  return 0
}

const HANDLERS: Record<Command, (argv: readonly string[], io: Io) => Promise<number>> = {
  manifest: manifestCommand,
  'check-artifact': checkArtifactCommand,
  verify: verifyCommand,
  compare: compareCommand,
}

export async function main(argv: readonly string[], io: Io): Promise<number> {
  const [command, ...rest] = argv
  try {
    if (command === undefined || !Object.hasOwn(HANDLERS, command)) {
      throw new UsageError(command === undefined ? 'no command' : `unknown command ${command}`)
    }
    return await HANDLERS[command as Command](rest, io)
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`${error.message}\n${USAGE}`)
      return 2
    }
    io.err(error instanceof Error ? error.message : String(error))
    return 1
  }
}
