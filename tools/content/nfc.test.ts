import { describe, expect, it } from 'vitest'
import { bomIssue, nfcIssues, nfcSourceIssue } from './nfc'

const FILE = 'content/tracks/english/decks/w01-standup.yaml'
const NFD = 'Tiếng Việt'.normalize('NFD')
const NFC = 'Tiếng Việt'.normalize('NFC')

describe('nfcIssues — [RF-3] every YAML string is NFC', () => {
  it('reports a decomposed deck back at its path', () => {
    expect(NFD).not.toBe(NFC)
    const deck = { id: 'english:deck-w01-standup', cards: [{ front: 'blocker', back: NFD }] }
    expect(nfcIssues(FILE, deck)).toEqual([
      {
        file: FILE,
        path: 'cards.0.back',
        message: 'is not NFC — save the file with composed (NFC) Unicode characters',
      },
    ])
  })

  it('accepts the NFC form', () => {
    expect(nfcIssues(FILE, { cards: [{ front: 'blocker', back: NFC }] })).toEqual([])
  })

  it('checks keys, nested lists and a path prefix', () => {
    const value = { [NFD]: 1, list: [['ok', NFD]] }
    expect(nfcIssues(FILE, value, 'root').map((issue) => issue.path)).toEqual([
      `root.${NFD}`,
      'root.list.0.1',
    ])
  })

  it('ignores numbers, booleans and null', () => {
    expect(nfcIssues(FILE, { a: 1, b: true, c: null })).toEqual([])
  })
})

describe('nfcSourceIssue — every MDX source is NFC', () => {
  const NOTE = 'content/tracks/dsa/problems/lc-0001-two-sum/note.mdx'

  it('reports one issue at the first line that is not NFC', () => {
    const source = `---\nstatus: active\n---\n\n## ${NFD}\n\n${NFD} again\n`
    expect(nfcSourceIssue(NOTE, source)).toEqual({
      file: NOTE,
      line: 5,
      message: 'is not NFC — save the file with composed (NFC) Unicode characters',
    })
  })

  it('accepts an NFC source', () => {
    expect(nfcSourceIssue(NOTE, `## ${NFC}\n`)).toBeNull()
  })
})

describe('bomIssue', () => {
  it('rejects a leading byte order mark', () => {
    expect(bomIssue(FILE, '﻿id: x\n')).toEqual({
      file: FILE,
      line: 1,
      column: 1,
      message: 'starts with a byte order mark (U+FEFF) — save the file as UTF-8 without a BOM',
    })
  })

  it('accepts a file without one', () => {
    expect(bomIssue(FILE, 'id: x\n')).toBeNull()
  })
})
