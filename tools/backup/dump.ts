/**
 * Reads a plain, data-only pg_dump file once (task 5.7b, ADR-0029): its SHA-256, its size and the
 * rows of every `COPY … FROM stdin;` block. In COPY's text format a row is always one line —
 * newlines, tabs and backslashes inside values are escaped — so counting lines counts rows.
 *
 * The same pass refuses anything that would make psql do more than load data: outside COPY data,
 * the only psql meta-commands allowed are pg_dump's own `\restrict <key>` / `\unrestrict <key>`
 * pair (17.6+). The restore test scans every file before `psql` loads it, so even a forged
 * artifact could not run `\!` on the runner. Errors give line numbers, never line contents.
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
const RESTRICT = /^\\(?:restrict|unrestrict) [A-Za-z0-9]+$/

export async function scanDump(path: string): Promise<DumpScan> {
  const hash = createHash('sha256')
  const decoder = new StringDecoder('utf8')
  const rows: Record<string, number> = {}
  let bytes = 0
  let lineNumber = 0
  let table: string | null = null
  let pending = ''

  const line = (text: string): void => {
    lineNumber += 1
    if (table !== null) {
      if (text === '\\.') table = null
      else rows[table] = (rows[table] ?? 0) + 1
      return
    }
    if (text.startsWith('COPY')) {
      const name = COPY_START.exec(text)?.[1]
      if (name === undefined) {
        throw new Error(`dump: line ${lineNumber} is a COPY statement pg_dump does not write here`)
      }
      if (Object.hasOwn(rows, name)) throw new Error(`dump: ${name} is copied twice`)
      rows[name] = 0
      table = name
      return
    }
    if (text.startsWith('\\') && !RESTRICT.test(text)) {
      throw new Error(`dump: line ${lineNumber} is a psql meta-command pg_dump does not write`)
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
  return { sha256: hash.digest('hex'), bytes, rows }
}
