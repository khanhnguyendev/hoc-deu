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

describe('parseMdx — unclosed inline tags', () => {
  it('points at the opening tag, not the paragraph', async () => {
    const result = await parseMdx(FILE, 'Text <Term vi="x">word here.\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issue).toMatchObject({ line: 1, column: 6 })
    expect(result.issue.message).toContain('Term')
  })
})

describe('parseMdx — nesting (final review M1)', () => {
  const quotes = (depth: number) => `${'> '.repeat(depth)}deep\n`
  const callouts = (depth: number) =>
    `${'<Callout tone="info">\n\n'.repeat(depth)}deep\n\n${'</Callout>\n\n'.repeat(depth)}`

  it.each([
    ['3000 nested `>`', quotes(3000)],
    ['3000 nested <Callout>', callouts(3000)],
  ])('reports %s as one issue for the file instead of overflowing the stack', async (_, source) => {
    const result = await parseMdx(FILE, source)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issue).toMatchObject({
      file: FILE,
      message: 'nesting too deep (more than 64 levels)',
    })
    expect(result.issue.line).toBeGreaterThanOrEqual(1)
  })

  it('accepts nesting deeper than any lesson needs', async () => {
    for (const source of [quotes(30), callouts(30)]) {
      const result = await parseMdx(FILE, source)
      expect(result.ok).toBe(true)
    }
  })
})
