import { compile } from '@mdx-js/mdx'
import { describe, expect, it } from 'vitest'
import { remarkPlugins } from '../content/mdx/plugins.ts'

/**
 * `vitest.config.ts`'s `.mdx` transform must compile with the shared `remarkPlugins` from
 * `tools/content/mdx/plugins` — not a hand-rolled or drifted list — so a test that imports real
 * content MDX (`tools/content/runtime-maps.test.ts`, review M5) parses exactly like `@next/mdx`
 * does (task 3.3b, 3.2a security review).
 */

type MdxTransformPlugin = {
  name: string
  transform: (source: string, id: string) => Promise<{ code: string } | null>
}

/** Depth-first flatten: Vite plugin entries may be arrays (`@vitejs/plugin-react` returns one). */
function flatten(value: unknown): unknown[] {
  return Array.isArray(value) ? value.flatMap(flatten) : [value]
}

const isMdxTransformPlugin = (value: unknown): value is MdxTransformPlugin =>
  typeof value === 'object' &&
  value !== null &&
  'name' in value &&
  value.name === 'content-mdx' &&
  'transform' in value &&
  typeof value.transform === 'function'

/** `vitest.config.ts`'s own `content-mdx` plugin, from its (possibly nested) `plugins` array. */
async function contentMdxPlugin(): Promise<MdxTransformPlugin> {
  const { default: config } = (await import('../../vitest.config')) as {
    default: { plugins?: unknown }
  }
  const found = flatten(config.plugins).find(isMdxTransformPlugin)
  if (found === undefined) throw new Error('vitest.config.ts lost its content-mdx plugin')
  return found
}

describe('vitest.config.ts MDX transform (guard, M3-R16 m3)', () => {
  it('compiles .mdx exactly as compile() does with the shared remarkPlugins', async () => {
    const plugin = await contentMdxPlugin()
    const source = '# Heading\n\nText with GFM ~~strike~~ and a table:\n\n| a | b |\n| - | - |\n'
    const fromConfig = await plugin.transform(source, 'x.mdx')
    const direct = String(await compile({ value: source, path: 'x.mdx' }, { remarkPlugins }))
    expect(fromConfig).toEqual({ code: direct })
  })

  it('leaves non-.mdx files alone', async () => {
    const plugin = await contentMdxPlugin()
    expect(await plugin.transform('export const x = 1\n', 'x.ts')).toBeNull()
  })
})
