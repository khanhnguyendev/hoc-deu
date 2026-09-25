import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import { MDX_COMPONENT_NAMES } from '../../../lib/content/mdx-components'
import type { MdxContext } from '../allowlist'
import { mdxFacts } from './facts'
import { isJsxElement, parseMdx, type MdxNode, type MdxRoot } from './parse'
import { checkMdx } from './safety'

/**
 * The /dev/content samples (task 3.3b) prove the MDX build before any content exists (PR A), so
 * they must stay valid content: the same safety check `content:build` runs on `content/**`.
 */
const SAMPLES: Record<MdxContext, string> = {
  lesson: 'app/dev/content/sample-lesson.mdx',
  note: 'app/dev/content/sample-note.mdx',
}

async function tree(file: string): Promise<MdxRoot> {
  const parsed = await parseMdx(file, readFileSync(file, 'utf8'))
  if (!parsed.ok) throw new Error(`${file} does not parse: ${parsed.issue.message}`)
  return parsed.tree
}

function componentNames(node: MdxNode, names = new Set<string>()): Set<string> {
  if (isJsxElement(node) && node.name) names.add(node.name)
  for (const child of node.children ?? []) componentNames(child, names)
  return names
}

describe('/dev/content samples', () => {
  it.each(Object.entries(SAMPLES) as [MdxContext, string][])(
    'the %s sample passes the MDX safety check',
    async (context, file) => {
      expect(checkMdx(file, await tree(file), context)).toEqual([])
    },
  )

  it('the lesson has the DSA pattern format’s sections, in order', async () => {
    const manifest = parseYaml(readFileSync('content/tracks/dsa/track.yaml', 'utf8')) as {
      lessonFormats: { pattern: { sections: string[] } }
    }
    const kinds = mdxFacts(await tree(SAMPLES.lesson)).sections.map((section) => section.kind)
    expect(kinds).toEqual(manifest.lessonFormats.pattern.sections)
  })

  it('together they use every allow-listed component', async () => {
    const used = new Set<string>()
    for (const file of Object.values(SAMPLES)) componentNames(await tree(file), used)
    expect([...used].sort()).toEqual([...MDX_COMPONENT_NAMES].sort())
  })

  it('hold no images: e2e stays offline (ContentImage has a unit test and a catalog entry)', async () => {
    for (const file of Object.values(SAMPLES)) {
      expect(mdxFacts(await tree(file)).images, file).toEqual([])
    }
  })

  it('hold fenced code in a solution language and in text', async () => {
    const lesson = mdxFacts(await tree(SAMPLES.lesson)).codeBlocks.map((block) => block.lang)
    const note = mdxFacts(await tree(SAMPLES.note)).codeBlocks.map((block) => block.lang)
    expect(lesson).toContain('python')
    expect(note).toContain('text')
  })
})
