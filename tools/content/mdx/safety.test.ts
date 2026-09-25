import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { MdxContext } from '../allowlist'
import type { ContentIssue } from '../issues'
import { mdxFacts } from './facts'
import { parseMdx } from './parse'
import { checkMdx, type CheckOptions } from './safety'

const FILE = 'content/tracks/dsa/lessons/two-pointers.mdx'
const fixture = (name: string) =>
  readFileSync(new URL(`../__fixtures__/mdx/${name}`, import.meta.url), 'utf8')

async function check(source: string, context: MdxContext, options?: CheckOptions) {
  const parsed = await parseMdx(FILE, source)
  if (!parsed.ok) throw new Error(`fixture does not parse: ${parsed.issue.message}`)
  return checkMdx(FILE, parsed.tree, context, options)
}

/** A lesson body after four lines of frontmatter: the body starts on line 5. */
const LESSON_HEAD = '---\ntitle: T\n---\n\n'
const lesson = (body: string, options?: CheckOptions) =>
  check(LESSON_HEAD + body, 'lesson', options)

/** A valid note tail (one Complexity, Bilingual and Solution each); the body starts on line 1. */
const COMPLEXITY = '<Complexity time="O(n)" space="O(1)" />'
const BILINGUAL = '<Bilingual vi="Một câu." en="One sentence." />'
const SOLUTION = '<Solution />'
const noteTail = (parts = [COMPLEXITY, BILINGUAL, SOLUTION]) => parts.join('\n\n')
const note = (body: string) => check(`${body}\n\n${noteTail()}\n`, 'note')

function expectOne(issues: ContentIssue[], line: number | undefined, text: string) {
  expect(issues, JSON.stringify(issues, null, 2)).toHaveLength(1)
  expect(issues[0]?.file).toBe(FILE)
  expect(issues[0]?.line).toBe(line)
  expect(issues[0]?.message).toContain(text)
}

describe('checkMdx — valid files', () => {
  it('accepts a lesson with every lesson component, nested correctly', async () => {
    expect(await check(fixture('lesson-ok.mdx'), 'lesson')).toEqual([])
  })

  it('accepts a note with every note component', async () => {
    expect(await check(fixture('note-ok.mdx'), 'note')).toEqual([])
  })

  it('accepts one-line steps and choices after blank lines or each other (unravel)', async () => {
    const steps = '<Steps>\n\n<Step title="a">x</Step>\n\n<Step title="b">y</Step>\n\n</Steps>\n'
    expect(await lesson(steps)).toEqual([])
    const adjacent = '<Steps>\n\n<Step title="a">x</Step>\n<Step title="b">y</Step>\n\n</Steps>\n'
    expect(await lesson(adjacent)).toEqual([])
    const quiz = [
      '<Quiz>',
      '',
      '<Question prompt="p" answer="a">',
      '',
      '<Choice id="a">x</Choice>',
      '',
      '<Choice id="b">y</Choice>',
      '<Choice id="c">z</Choice>',
      '',
      '</Question>',
      '',
      '</Quiz>',
      '',
    ].join('\n')
    expect(await lesson(quiz)).toEqual([])
    const oneLine = '<Steps><Step title="a">x</Step><Step><Term vi="t">y</Term></Step></Steps>\n'
    expect(await lesson(oneLine)).toEqual([])
  })
})

describe('checkMdx — code and expressions', () => {
  it('rejects import and export', async () => {
    expectOne(await lesson("import x from 'y'\n"), 5, 'import/export is not allowed')
    expectOne(await lesson('export const a = 1\n'), 5, 'import/export is not allowed')
  })

  it('rejects expressions, comments and a {} table cell', async () => {
    expectOne(await lesson('{1 + 1}\n'), 5, '`{…}` expressions are not allowed')
    expectOne(await lesson('{/* c */}\n'), 5, '`{…}` expressions are not allowed')
    expectOne(await lesson('| a | b |\n| - | - |\n| {} | x |\n'), 7, 'expressions are not allowed')
  })
})

describe('checkMdx — components', () => {
  it('rejects expression and spread attributes', async () => {
    expectOne(
      await lesson('<Callout tone={"tip"}>\n\nx\n\n</Callout>\n'),
      5,
      'attribute values must be literal strings',
    )
    expectOne(await lesson('<Section {...p} kind="a">\n\nx\n\n</Section>\n'), 5, '{...p}')
  })

  it('rejects HTML, unknown components and fragments', async () => {
    expectOne(
      await lesson('<script>alert(1)</script>\n'),
      5,
      '`<script>` is not an allowed component',
    )
    expectOne(await lesson('<Unknown />\n'), 5, '`<Unknown>` is not an allowed component')
    expectOne(await lesson('<img src="https://x.test/a.png" />\n'), 5, '`<img>` is not an allowed')
    expectOne(await lesson('<>x</>\n'), 5, '`<>` is not an allowed component')
    expectOne(await lesson('<toString />\n'), 5, '`<toString>` is not an allowed component')
  })

  it('rejects components outside their context', async () => {
    expectOne(await lesson('<Solution />\n'), 5, '`<Solution />` is only allowed in notes')
    expectOne(await note('<Section kind="a">\n\nx\n\n</Section>'), 1, 'only allowed in lessons')
  })

  it('checks attribute names, values and lengths', async () => {
    expectOne(await lesson('<Complexity time="O(n)" />\n'), 5, '`space`')
    expectOne(await lesson('<Callout tone="danger">\n\nx\n\n</Callout>\n'), 5, 'info, tip, warning')
    expectOne(await lesson('<Callout tone="tip" flag="x">\n\nx\n\n</Callout>\n'), 5, '`flag`')
    expectOne(await lesson('<Callout tone="tip" title>\n\nx\n\n</Callout>\n'), 5, 'bare')
    expectOne(
      await lesson('<Callout tone="tip" constructor="x">\n\nx\n\n</Callout>\n'),
      5,
      '`constructor`',
    )
    expectOne(await lesson('<Practice problem="dsa:two-sum" />\n'), 5, '`problem`')
    expectOne(await lesson(`<Complexity time="${'n'.repeat(41)}" space="1" />\n`), 5, '40')
    expectOne(await lesson('<Callout tone="tip" tone="info">\n\nx\n\n</Callout>\n'), 5, 'twice')
  })

  it('checks per-file counts in notes', async () => {
    expectOne(
      await check(`${noteTail()}\n\n<Solution />\n`, 'note'),
      7,
      'exactly one `<Solution />` (found 2)',
    )
    expectOne(
      await check(`${noteTail([COMPLEXITY, SOLUTION])}\n`, 'note'),
      undefined,
      'exactly one `<Bilingual />` (found 0)',
    )
  })

  it('checks parents, top level and children', async () => {
    expectOne(await lesson('<Choice id="a">x</Choice>\n'), 5, 'must be inside `<Question>`')
    expectOne(
      await lesson(
        '<Callout tone="info">\n\n<Section kind="a">\n\nx\n\n</Section>\n\n</Callout>\n',
      ),
      7,
      '`<Section>` must be at the top level',
    )
    expectOne(
      await lesson('Đọc <Term vi="x"><Callout tone="tip" /></Term> nhé.\n'),
      5,
      '`<Term>` may only contain text',
    )
    expectOne(await lesson('<Steps>\n\nx\n\n</Steps>\n'), 7, '`<Steps>` may only contain `<Step>`')
    expectOne(
      await lesson('<Steps>\n\n<Step>\n\n- a\n\n</Step>\n\n</Steps>\n'),
      9,
      'only contain text',
    )
    expectOne(await lesson('<VarTable>\n\nx\n\n</VarTable>\n'), 5, 'one GFM table')
    expectOne(await lesson('<Complexity time="1" space="1">x</Complexity>\n'), 5, 'no content')
  })

  it('checks the quiz answer and choices', async () => {
    const question = (answer: string, choices: string) =>
      `<Quiz>\n<Question prompt="p" answer="${answer}">\n${choices}\n</Question>\n</Quiz>\n`
    const ab = '<Choice id="a">x</Choice>\n<Choice id="b">y</Choice>'
    expectOne(await lesson(question('c', ab)), 6, '`answer` "c" is not one of its choices (a, b)')
    expectOne(await lesson(question('a', '<Choice id="a">x</Choice>')), 6, 'at least 2')
    expectOne(
      await lesson(question('a', '<Choice id="a">x</Choice>\n<Choice id="a">y</Choice>')),
      8,
      'duplicate',
    )
  })

  it('keeps block components on their own line and Term inside a sentence', async () => {
    const mixed = [
      '<Quiz>',
      '<Question prompt="p" answer="a">',
      'Chọn một: <Choice id="a">x</Choice>',
      '',
      '<Choice id="b">y</Choice>',
      '</Question>',
      '</Quiz>',
      '',
    ].join('\n')
    expectOne(
      await lesson(mixed),
      7,
      'put `<Choice>` on its own line — it shares a paragraph with text',
    )
    expectOne(await lesson('<Term vi="x">word</Term>\n'), 5, '`<Term>` must stay inside a sentence')
    expectOne(await lesson('<Steps>Do <Step>x</Step></Steps>\n'), 5, 'put `<Step>` on its own line')
  })
})

describe('checkMdx — links, code blocks, headings, syntax', () => {
  it('allows https links only', async () => {
    expectOne(await lesson('[a](javascript:alert(1))\n'), 5, 'https://')
    expectOne(await lesson('[b](http://x.test)\n'), 5, 'https://')
    expectOne(await lesson('[c](data:text/html,x)\n'), 5, 'https://')
    expectOne(await lesson('[d](/t/dsa)\n'), 5, 'https://')
    expectOne(await lesson('[e](mailto:a@x.test)\n'), 5, 'https://')
    expectOne(await lesson('See www.x.test now.\n'), 5, 'https://')
    expectOne(await lesson('[go][r]\n\n[r]: javascript:x\n'), 7, 'https://')
    expect(
      await lesson('[ok](https://x.test/a) and <Term vi="x">[t](https://x.test)</Term>.\n'),
    ).toEqual([])
  })

  it('requires a supported language and no meta on fenced code', async () => {
    expectOne(await lesson('```\nx\n```\n'), 5, 'python, java, go, text')
    expectOne(await lesson('```rust\nfn main() {}\n```\n'), 5, '`rust`')
    expectOne(await lesson('```python title="a.py"\nx = 1\n```\n'), 5, 'meta')
  })

  it('limits heading levels per context', async () => {
    expectOne(await check(`# Title\n\n${noteTail()}\n`, 'note'), 1, '`##`')
    expectOne(await check(`##### Deep\n\n${noteTail()}\n`, 'note'), 1, '`##`')
    expectOne(await lesson('## Title\n'), 5, '`###`')
    expect(await lesson('### A\n\n#### B\n')).toEqual([])
  })

  it('requires lesson frontmatter', async () => {
    expectOne(await check('### Title\n', 'lesson'), 1, 'frontmatter')
    expect(await check(`${noteTail()}\n`, 'note')).toEqual([])
  })

  it('rejects syntax outside the known node types', async () => {
    expectOne(await lesson('[^1]: A footnote.\n'), 5, 'unsupported syntax')
  })
})

describe('checkMdx — images (OD3)', () => {
  const base = 'https://ref.supabase.co/storage/v1/object/public/content-images/'
  const options: CheckOptions = { imageBaseUrl: base, imagePathPrefix: 'dsa/lesson-two-pointers/' }
  const ok = `${base}dsa/lesson-two-pointers/walk.svg`
  const image = (markdown: string) => lesson(`${markdown}\n`, options)

  it('accepts a sized image from the bucket under the item prefix', async () => {
    const source = `![Two pointers](${ok} "640x360")\n`
    expect(await image(source)).toEqual([])
    const parsed = await parseMdx(FILE, LESSON_HEAD + source)
    if (!parsed.ok) throw new Error(parsed.issue.message)
    expect(mdxFacts(parsed.tree).images).toEqual([
      { url: ok, alt: 'Two pointers', width: 640, height: 360, line: 5 },
    ])
  })

  it('rejects other hosts, http, empty alt text and bad paths', async () => {
    expectOne(await image(`![x](https://evil.test/dsa/lesson-two-pointers/a.png "1x1")`), 5, base)
    const http = ok.replace('https://', 'http://')
    expectOne(await image(`![x](${http} "1x1")`), 5, base)
    expectOne(await image(`![](${ok} "640x360")`), 5, 'alt text')
    expectOne(await image(`![x](${base}dsa/lesson-two-pointers/a.gif "1x1")`), 5, '.svg')
    expectOne(await image(`![x](${base}dsa/lesson-two-pointers/../a.png "1x1")`), 5, '..')
    expectOne(
      await image(`![x](${base}dsa/lesson-other/a.png "1x1")`),
      5,
      'dsa/lesson-two-pointers/',
    )
    expectOne(await image(`![x](${base}dsa//lesson-two-pointers/a.png "1x1")`), 5, '//')
  })

  it('requires a WIDTHxHEIGHT title', async () => {
    expectOne(await image(`![x](${ok})`), 5, 'WIDTHxHEIGHT')
    expectOne(await image(`![x](${ok} "640")`), 5, 'WIDTHxHEIGHT')
  })

  it('rejects image references', async () => {
    expectOne(await image(`![x][ref]\n\n[ref]: ${ok}`), 5, 'use an inline image')
  })

  it('rejects every image when no base URL is configured', async () => {
    expectOne(
      await lesson(`![x](${ok} "640x360")\n`, { imageBaseUrl: '' }),
      5,
      'images need CONTENT_IMAGE_BASE_URL in tools/content/allowlist.ts — see docs/ops/content-images.md',
    )
  })
})
