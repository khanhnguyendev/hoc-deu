import { describe, expect, it } from 'vitest'
import { mdxFacts } from './facts'
import { parseMdx } from './parse'

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
        { lang: 'python', value: 'def f() -> int:\n    return 1' },
        { lang: 'text', value: 'plain' },
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
