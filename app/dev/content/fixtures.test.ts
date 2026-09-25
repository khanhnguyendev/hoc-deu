import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { codeBlockKey } from '@/lib/content/code-tokens'
import { mdxFacts } from '@/tools/content/mdx/facts'
import { parseMdx } from '@/tools/content/mdx/parse'
import { SAMPLE_BINDINGS } from './fixtures'

/** The fixtures stand in for content:build output, so they must match the samples they bind. */
async function facts(file: string) {
  const parsed = await parseMdx(file, readFileSync(file, 'utf8'))
  if (!parsed.ok) throw new Error(parsed.issue.message)
  return mdxFacts(parsed.tree)
}

describe('/dev/content fixtures', () => {
  it('highlight every solution-language fence of the samples, keyed like content:build', async () => {
    const blocks = SAMPLE_BINDINGS.code?.blocks ?? {}
    for (const file of ['app/dev/content/sample-lesson.mdx', 'app/dev/content/sample-note.mdx']) {
      for (const block of (await facts(file)).codeBlocks) {
        if (block.lang === 'text') continue
        const key = codeBlockKey(block.lang, block.value)
        expect(Object.hasOwn(blocks, key), `${file}: ${block.lang} block`).toBe(true)
        expect(blocks[key]?.lang).toBe(block.lang)
      }
    }
  })

  it('carry a solution in every language, so the tabs show Python, Java and Go', () => {
    expect(Object.keys(SAMPLE_BINDINGS.code?.solutions ?? {})).toEqual(['python', 'java', 'go'])
  })

  it('resolve every Practice problem of the lesson', async () => {
    const { practice } = await facts('app/dev/content/sample-lesson.mdx')
    expect(practice.length).toBeGreaterThan(0)
    for (const id of practice) expect(SAMPLE_BINDINGS.resolvePractice(id), id).not.toBeNull()
  })
})
