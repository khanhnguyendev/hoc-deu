import { describe, expect, it } from 'vitest'
import { parseMdx } from './parse'

const FILE = 'content/tracks/dsa/lessons/two-pointers.mdx'

describe('parseMdx', () => {
  it('returns the syntax tree with the frontmatter as a yaml node', async () => {
    const result = await parseMdx(FILE, '---\ntitle: T\n---\n\n### Hello\n')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tree.type).toBe('root')
    expect(result.tree.children.map((node) => node.type)).toEqual(['yaml', 'heading'])
    expect(result.tree.children[0]?.value).toBe('title: T')
  })

  it('reports an unclosed component with its line', async () => {
    const result = await parseMdx(FILE, '---\ntitle: T\n---\n\n<Section kind="signals">\n\nText.\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issue.file).toBe(FILE)
    expect(result.issue.line).toBe(5)
    expect(result.issue.column).toBe(1)
    expect(result.issue.message).toContain('Section')
  })

  it('reports an unbalanced brace with its line and column', async () => {
    const result = await parseMdx(FILE, 'Hello\n\nThis { is open\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issue).toMatchObject({ file: FILE, line: 3, column: 15 })
    expect(result.issue.message).toContain('{')
  })

  it('reports a mismatched closing tag at the closing tag', async () => {
    const result = await parseMdx(FILE, '<Callout tone="info">\n\nx\n\n</Section>\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issue).toMatchObject({ line: 5, column: 1 })
  })
})
