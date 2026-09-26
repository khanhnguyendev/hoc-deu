import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compareCounts, describeDifferences, parseCounts } from './counts'

describe('parseCounts (psql -A -t -F <tab> output of counts.sql)', () => {
  it('reads one `<schema>.<table>\\t<count>` line per table', () => {
    expect(parseCounts('auth.users\t3\npublic.events\t120\npublic.profiles\t0\n')).toEqual({
      'auth.users': 3,
      'public.events': 120,
      'public.profiles': 0,
    })
  })

  it('accepts output without a trailing newline, and empty output', () => {
    expect(parseCounts('public.events\t1')).toEqual({ 'public.events': 1 })
    expect(parseCounts('')).toEqual({})
  })

  it.each([
    ['a header line', 'table\tcount\npublic.events\t1\n'],
    ['a negative count', 'public.events\t-1\n'],
    ['a non-integer count', 'public.events\t1.5\n'],
    ['a missing count', 'public.events\n'],
    ['a schema other than public or auth', 'storage.objects\t4\n'],
    ['a quoted name', 'public."Events"\t4\n'],
    ['a blank line in the middle', 'public.events\t1\n\npublic.profiles\t2\n'],
    ['an unsafe integer', 'public.events\t9007199254740993\n'],
  ])('rejects %s', (_label, output) => {
    expect(() => parseCounts(output)).toThrow(/line \d+/)
  })

  it('rejects a table listed twice', () => {
    expect(() => parseCounts('public.events\t1\npublic.events\t1\n')).toThrow(/twice/)
  })

  it('never echoes the offending line (it could be anything psql printed)', () => {
    let message = ''
    try {
      parseCounts('public.events\tsomeone@example.test\n')
    } catch (error) {
      message = String(error)
    }
    expect(message).toMatch(/line 1/)
    expect(message).not.toContain('someone')
  })
})

describe('compareCounts (expected, e.g. the manifest, against actual, e.g. the restore)', () => {
  const manifest = { 'auth.users': 3, 'public.events': 120, 'public.profiles': 3 }

  it('finds no difference when every table has the same count', () => {
    expect(compareCounts(manifest, { ...manifest })).toEqual([])
  })

  it('reports a table missing from the actual counts', () => {
    const restored = Object.fromEntries(
      Object.entries(manifest).filter(([table]) => table !== 'public.events'),
    )
    expect(compareCounts(manifest, restored)).toEqual([
      { table: 'public.events', problem: 'missing' },
    ])
  })

  it('reports a different count', () => {
    expect(compareCounts(manifest, { ...manifest, 'public.events': 119 })).toEqual([
      { table: 'public.events', problem: 'different' },
    ])
  })

  it('reports a table the expected counts do not list', () => {
    expect(compareCounts(manifest, { ...manifest, 'public.ops_metrics': 0 })).toEqual([
      { table: 'public.ops_metrics', problem: 'unexpected' },
    ])
  })

  it('lists several differences sorted by table name', () => {
    expect(
      compareCounts(manifest, { 'public.profiles': 2, 'public.zeta': 1, 'auth.users': 3 }),
    ).toEqual([
      { table: 'public.events', problem: 'missing' },
      { table: 'public.profiles', problem: 'different' },
      { table: 'public.zeta', problem: 'unexpected' },
    ])
  })
})

describe('describeDifferences', () => {
  it('names the tables and the problem, never the counts', () => {
    const text = describeDifferences(
      [
        { table: 'public.events', problem: 'missing' },
        { table: 'public.profiles', problem: 'different' },
        { table: 'public.zeta', problem: 'unexpected' },
      ],
      { expected: 'the manifest', actual: 'the restored database' },
    )
    expect(text).toBe(
      [
        'public.events: in the manifest, missing from the restored database',
        'public.profiles: the row count in the restored database differs from the manifest',
        'public.zeta: in the restored database, not in the manifest',
      ].join('\n'),
    )
    expect(text).not.toMatch(/\d/)
  })
})

describe('counts.sql', () => {
  const sql = readFileSync(join(import.meta.dirname, 'counts.sql'), 'utf8')
  const statements = sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')

  it('turns off row security, so a count RLS would filter fails instead of coming back short', () => {
    expect(statements).toMatch(/^set row_security = off;$/m)
  })

  it('counts every ordinary public table except event_quota, skipping extension members like pg_dump', () => {
    expect(statements).toContain("c.relkind = 'r'")
    expect(statements).toContain("(n.nspname = 'public' and c.relname <> 'event_quota')")
    expect(statements).toContain("d.deptype = 'e'")
  })

  it('adds auth.users and auth.identities only when psql’s with_auth variable is true', () => {
    expect(statements).toContain(
      "(:'with_auth' = 'true' and n.nspname = 'auth' and c.relname in ('users', 'identities'))",
    )
  })

  it('runs one count(*) per table through \\gexec, labelled schema.table', () => {
    expect(statements).toContain(
      "format('select %L, count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)",
    )
    expect(statements.trimEnd().endsWith('\\gexec')).toBe(true)
  })

  it('holds no other psql meta-command (the dump step runs it with the database URL in its env)', () => {
    const metaCommands = statements.split('\n').filter((line) => line.trimStart().startsWith('\\'))
    expect(metaCommands).toEqual(['\\gexec'])
  })
})
