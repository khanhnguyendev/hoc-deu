/**
 * Reads a plain, data-only pg_dump file once (task 5.7b, ADR-0029): its SHA-256, its size and the
 * rows of every `COPY … FROM stdin;` block. In COPY's text format a row is always one line —
 * newlines, tabs and backslashes inside values are escaped — so counting lines counts rows. Inside
 * COPY data psql reads lines as data until `\.`, never as meta-commands.
 *
 * The same pass accepts only what pg_dump writes in a data-only dump, so the file can make psql do
 * nothing but load data. Outside COPY data:
 * - the first statement must be pg_dump's `\restrict <key>` (17.6+) and the last
 *   `\unrestrict <the same key>`, with nothing after it (a truncated dump fails here);
 * - any other backslash — at the start of a line, in the middle of one, even in a comment — is
 *   rejected (psql would read a meta-command such as `\!`);
 * - the only other lines allowed are blank lines, `--` comments, `SET <name> = <value>;`,
 *   `SELECT pg_catalog.set_config(…);`, `SELECT pg_catalog.setval(…);` and the COPY lines.
 * The restore test scans every file before psql loads it, so even a forged artifact could not run
 * a shell command on the runner. Errors give line numbers, never line contents.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { StringDecoder } from 'node:string_decoder'

export type DumpScan = {
  /** Hex SHA-256 of the file's bytes. */
  sha256: string
  bytes: number
  /** Rows per `<schema>.<table>`, in the order the COPY blocks appear. */
  rows: Record<string, number>
}

const COPY_START = /^COPY ([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*) (?:\([^)]*\) )?FROM stdin;$/
const RESTRICT = /^\\restrict ([A-Za-z0-9]+)$/
const UNRESTRICT = /^\\unrestrict ([A-Za-z0-9]+)$/
/** The statements a data-only pg_dump writes outside COPY data (besides the COPY lines). */
const STATEMENTS = [
  /^SET [a-z_]+ = (?:[a-z0-9_]+|'[^'\\]*');$/,
  /^SELECT pg_catalog\.set_config\('[a-z_]+', '[^'\\]*', (?:true|false)\);$/,
  /^SELECT pg_catalog\.setval\('[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*', \d+, (?:true|false)\);$/,
]

export async function scanDump(path: string): Promise<DumpScan> {
  const hash = createHash('sha256')
  const decoder = new StringDecoder('utf8')
  const rows: Record<string, number> = {}
  let bytes = 0
  let lineNumber = 0
  /** The table whose COPY data is being read, or null outside COPY data. */
  let table: string | null = null
  /** \restrict's key once seen; the line of \unrestrict once seen. */
  let key: string | null = null
  let unrestrictedAt: number | null = null
  let pending = ''

  const fail = (message: string): never => {
    throw new Error(`dump: line ${lineNumber} ${message}`)
  }

  const line = (text: string): void => {
    lineNumber += 1
    if (table !== null) {
      if (text === '\\.') table = null
      else rows[table] = (rows[table] ?? 0) + 1
      return
    }
    if (text === '') return
    if (text.startsWith('--')) {
      if (text.includes('\\')) fail('has a backslash outside COPY data (a psql meta-command)')
      return
    }
    if (key === null) {
      key =
        RESTRICT.exec(text)?.[1] ?? fail('is the first statement, and it is not \\restrict <key>')
      return
    }
    if (text.includes('\\')) {
      const unrestrict = unrestrictedAt === null ? UNRESTRICT.exec(text) : null
      if (unrestrict === null) fail('has a backslash outside COPY data (a psql meta-command)')
      if (unrestrict?.[1] !== key) fail('is \\unrestrict with another key than \\restrict’s')
      unrestrictedAt = lineNumber
      return
    }
    if (unrestrictedAt !== null) fail(`comes after \\unrestrict (line ${unrestrictedAt})`)
    if (text.startsWith('COPY')) {
      const name = COPY_START.exec(text)?.[1]
      if (name === undefined) fail('is a COPY statement pg_dump does not write here')
      if (Object.hasOwn(rows, name as string)) {
        throw new Error(`dump: ${name} is copied twice`)
      }
      rows[name as string] = 0
      table = name as string
      return
    }
    if (!STATEMENTS.some((statement) => statement.test(text))) {
      fail('is not something pg_dump writes in a data-only dump')
    }
  }

  for await (const chunk of createReadStream(path)) {
    const buffer = chunk as Buffer
    hash.update(buffer)
    bytes += buffer.length
    const lines = (pending + decoder.write(buffer)).split('\n')
    pending = lines.pop() ?? ''
    for (const text of lines) line(text)
  }
  pending += decoder.end()
  if (pending !== '') line(pending)
  if (table !== null) throw new Error(`dump: the COPY block of ${table} never ends`)
  if (unrestrictedAt === null) {
    throw new Error('dump: the file does not end with \\unrestrict <key> (a truncated dump?)')
  }
  return { sha256: hash.digest('hex'), bytes, rows }
}
