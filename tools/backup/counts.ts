/**
 * Row counts of a backup (task 5.7b, ADR-0029). `counts.sql` prints them from a database — the
 * backup job inside its dump's snapshot, the restore test from the restored database — and this
 * file reads that output and compares two sets of counts: the database's with the dump's rows
 * when the manifest is written, the manifest's with the restored database's in the restore test.
 *
 * The repository is public and so are the workflow logs: messages name tables and the kind of
 * difference, never a count, and never echo a line they could not read.
 */

/** `<schema>.<table>`, unquoted: the only names counts.sql and pg_dump's COPY lines produce here. */
export const TABLE_NAME = /^(public|auth)\.[a-z_][a-z0-9_]*$/

/** The auth tables a backup holds when it includes auth (ADR-0029). */
export const AUTH_TABLES = ['auth.identities', 'auth.users'] as const

export type Counts = Readonly<Record<string, number>>

export type CountDifference = {
  table: string
  /** missing: expected but not in the actual counts; unexpected: the reverse; different: both. */
  problem: 'missing' | 'unexpected' | 'different'
}

/** Reads `psql -A -t -F '\t'` output of counts.sql: one `<schema>.<table>\t<count>` per line. */
export function parseCounts(output: string): Counts {
  const counts: Record<string, number> = {}
  const lines = output.endsWith('\n') ? output.slice(0, -1).split('\n') : output.split('\n')
  if (output === '') return counts
  lines.forEach((line, index) => {
    const match = /^([^\t]+)\t(\d+)$/.exec(line)
    const table = match?.[1]
    const count = Number(match?.[2])
    if (table === undefined || !TABLE_NAME.test(table) || !Number.isSafeInteger(count)) {
      throw new Error(`counts: line ${index + 1} is not "<schema>.<table><tab><count>"`)
    }
    if (Object.hasOwn(counts, table)) throw new Error(`counts: ${table} is listed twice`)
    counts[table] = count
  })
  return counts
}

/** The tables whose counts differ between `expected` and `actual`, sorted by name. */
export function compareCounts(expected: Counts, actual: Counts): CountDifference[] {
  const tables = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
  const differences: CountDifference[] = []
  for (const table of tables) {
    const inExpected = Object.hasOwn(expected, table)
    const inActual = Object.hasOwn(actual, table)
    if (!inActual) differences.push({ table, problem: 'missing' })
    else if (!inExpected) differences.push({ table, problem: 'unexpected' })
    else if (expected[table] !== actual[table]) differences.push({ table, problem: 'different' })
  }
  return differences
}

/** One line per difference, naming the table — never a count. */
export function describeDifferences(
  differences: readonly CountDifference[],
  labels: { expected: string; actual: string },
): string {
  return differences
    .map(({ table, problem }) => {
      switch (problem) {
        case 'missing':
          return `${table}: in ${labels.expected}, missing from ${labels.actual}`
        case 'unexpected':
          return `${table}: in ${labels.actual}, not in ${labels.expected}`
        case 'different':
          return `${table}: the row count in ${labels.actual} differs from ${labels.expected}`
      }
    })
    .join('\n')
}
