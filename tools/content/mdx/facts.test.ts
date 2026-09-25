import { evaluate } from '@mdx-js/mdx'
import { createElement, isValidElement, type ReactNode } from 'react'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { codeBlockKey, plainCode } from '@/lib/content/code-tokens'
import { createHighlighter, type Highlighter } from '../highlight'
import { mdxFacts } from './facts'
import { parseMdx } from './parse'
import { remarkPlugins } from './plugins'

const BASE = 'https://ref.supabase.co/storage/v1/object/public/content-images/'

const SOURCE = [
  '---', //                                                          1
  'id: dsa:lesson-two-pointers',
  'title: Two pointers',
  '---',
  '',
  '<Section kind="signals">', //                                    6
  '',
  'Text with <Term vi="con trỏ">pointer</Term>.',
  '',
  '</Section>',
  '',
  '<Section kind="code">One-line section.</Section>', //           12
  '',
  '```python',
  'def f() -> int:',
  '    return 1',
  '```',
  '',
  `![Walk](${BASE}dsa/lesson-two-pointers/walk.svg "640x360")`, // 19
  '',
  '<Callout tone="info">',
  '',
  '<Section kind="nested">',
  '',
  'Not top level.',
  '',
  '</Section>',
  '',
  '<Complexity time="O(n)" space="O(1)" />',
  '',
  '</Callout>',
  '',
  '<Bilingual vi="Hai con trỏ." en="Two pointers." />',
  '',
  '<Practice problem="dsa:lc-0167" />',
  '',
  '<Practice problem="dsa:lc-0015" />',
  '',
  '<Quiz>',
  '<Question prompt="p" answer="a">',
  '<Choice id="a">x</Choice>',
  '<Choice id="b">y</Choice>',
  '</Question>',
  '<Question prompt="q" answer="b">',
  '<Choice id="a">x</Choice>',
  '<Choice id="b">y</Choice>',
  '</Question>',
  '</Quiz>',
  '',
  '```text',
  'plain',
  '```',
  '',
  '<Solution />',
  '',
].join('\n')

describe('mdxFacts', () => {
  it('collects the facts content:build cross-checks', async () => {
    const parsed = await parseMdx('x.mdx', SOURCE)
    if (!parsed.ok) throw new Error(parsed.issue.message)
    expect(mdxFacts(parsed.tree)).toEqual({
      frontmatter: 'id: dsa:lesson-two-pointers\ntitle: Two pointers',
      sections: [
        { kind: 'signals', line: 6 },
        { kind: 'code', line: 12 },
      ],
      bilingual: [{ vi: 'Hai con trỏ.', en: 'Two pointers.' }],
      complexity: [{ time: 'O(n)', space: 'O(1)' }],
      solutionCount: 1,
      practice: [
        { problem: 'dsa:lc-0167', line: 35 },
        { problem: 'dsa:lc-0015', line: 37 },
      ],
      codeBlocks: [
        { lang: 'python', value: 'def f() -> int:\n    return 1\n' },
        { lang: 'text', value: 'plain\n' },
      ],
      images: [
        {
          url: `${BASE}dsa/lesson-two-pointers/walk.svg`,
          alt: 'Walk',
          width: 640,
          height: 360,
          line: 19,
        },
      ],
      questions: 2,
    })
  })

  it('reports no frontmatter and empty lists for a bare file', async () => {
    const parsed = await parseMdx('x.mdx', '## Heading\n\nText.\n')
    if (!parsed.ok) throw new Error(parsed.issue.message)
    expect(mdxFacts(parsed.tree)).toEqual({
      frontmatter: null,
      sections: [],
      bilingual: [],
      complexity: [],
      solutionCount: 0,
      practice: [],
      codeBlocks: [],
      images: [],
      questions: 0,
    })
  })
})

/** The fences as the bound `pre` (CodePre) receives them: `language-<lang>` and the text. */
async function renderedFences(source: string): Promise<{ lang: string; text: string }[]> {
  const fences: { lang: string; text: string }[] = []
  const pre = ({ children }: { children?: ReactNode }) => {
    if (isValidElement<{ className?: string; children?: ReactNode }>(children)) {
      const lang = /language-(\S+)/.exec(children.props.className ?? '')?.[1] ?? 'text'
      fences.push({ lang, text: String(children.props.children ?? '') })
    }
    return null
  }
  const { default: Content } = await evaluate(source, { ...runtime, remarkPlugins })
  renderToStaticMarkup(createElement(Content, { components: { pre } }))
  return fences
}

describe('fence keys: content:build and the renderer agree (final review M3)', () => {
  let highlighter: Highlighter
  beforeAll(async () => {
    highlighter = await createHighlighter()
  })
  afterAll(() => highlighter.dispose())

  it.each([
    ['a plain fence', '```python\nx = 1\n```\n'],
    ['a fence ending with a blank line', '```python\nx = 1\n\n```\n'],
    ['a fence ending with two blank lines', '```python\nx = 1\n\n\n```\n'],
    ['a fence starting with a blank line', '```python\n\nx = 1\n```\n'],
    ['a text fence ending with a blank line', '```text\n[1] -> [1]\n\n```\n'],
    ['an empty fence', '```go\n```\n'],
    ['a CRLF fence', '```python\r\nx = 1\r\n```\r\n'],
    ['a fence with no newline at EOF', '```python\nx = 1\n```'],
  ])(
    '%s: build key = render key, and the highlighted lines match the plain ones',
    async (_, source) => {
      const parsed = await parseMdx('x.mdx', source)
      if (!parsed.ok) throw new Error(parsed.issue.message)
      const built = mdxFacts(parsed.tree).codeBlocks
      const rendered = await renderedFences(source)
      expect(built).toHaveLength(1)
      // content:build (build.ts) keys and highlights each block from its facts.
      expect(built.map((block) => codeBlockKey(block.lang, block.value))).toEqual(
        rendered.map((fence) => codeBlockKey(fence.lang, fence.text)),
      )
      for (const [index, block] of built.entries()) {
        const fence = rendered[index]!
        expect(highlighter.highlight(block.value, block.lang).lines).toHaveLength(
          plainCode(fence.lang, fence.text).lines.length,
        )
      }
    },
  )
})
