import { describe, expect, it } from 'vitest'
import { formatIssue, sortIssues, type ContentIssue } from './issues'

describe('formatIssue', () => {
  it('prints an MDX position as file:line:column', () => {
    const issue = { file: 'content/tracks/dsa/lessons/x.mdx', line: 12, column: 3, message: 'm' }
    expect(formatIssue(issue)).toBe('content/tracks/dsa/lessons/x.mdx:12:3: m')
  })

  it('prints a YAML path after the file', () => {
    const issue = { file: 'content/tracks/dsa/decks/w01.yaml', path: 'cards.3.front', message: 'm' }
    expect(formatIssue(issue)).toBe('content/tracks/dsa/decks/w01.yaml: cards.3.front: m')
  })

  it('prints a line without a column, and a file-level issue', () => {
    expect(formatIssue({ file: 'a.mdx', line: 4, message: 'm' })).toBe('a.mdx:4: m')
    expect(formatIssue({ file: 'a.mdx', message: 'm' })).toBe('a.mdx: m')
  })
})

describe('sortIssues', () => {
  it('orders by file, line, column, then path, without mutating the input', () => {
    const issues: ContentIssue[] = [
      { file: 'b.mdx', line: 1, column: 1, message: 'b1' },
      { file: 'a.mdx', line: 3, column: 2, message: 'a3:2' },
      { file: 'a.yaml', path: 'cards.10.front', message: 'cards.10' },
      { file: 'a.mdx', line: 3, column: 1, message: 'a3:1' },
      { file: 'a.yaml', path: 'cards.3.front', message: 'cards.3' },
      { file: 'a.mdx', message: 'a-file' },
      { file: 'a.mdx', line: 1, column: 9, message: 'a1:9' },
    ]
    const copy = [...issues]
    expect(sortIssues(issues).map((issue) => issue.message)).toEqual([
      'a-file',
      'a1:9',
      'a3:1',
      'a3:2',
      'cards.3',
      'cards.10',
      'b1',
    ])
    expect(issues).toEqual(copy)
  })
})
