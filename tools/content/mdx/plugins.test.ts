import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { describe, expect, it } from 'vitest'
import { remarkPlugins } from './plugins'
import { REMARK_PLUGIN_NAMES } from './remark-plugins'

describe('the shared remark plugin list', () => {
  it('names frontmatter and GFM, in that order', () => {
    expect(REMARK_PLUGIN_NAMES).toEqual(['remark-frontmatter', 'remark-gfm'])
  })

  it('resolves each name to the package @next/mdx loads for it', async () => {
    expect(remarkPlugins).toEqual([remarkFrontmatter, remarkGfm])
    for (const [index, name] of REMARK_PLUGIN_NAMES.entries()) {
      expect(remarkPlugins[index]).toBe(((await import(name)) as { default: unknown }).default)
    }
  })
})
