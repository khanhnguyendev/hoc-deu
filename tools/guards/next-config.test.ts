import { compile, evaluate } from '@mdx-js/mdx'
import type { NextConfig } from 'next'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as runtime from 'react/jsx-runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { contentImageRemotePatterns } from '../content/allowlist'
import { REMARK_PLUGIN_NAMES } from '../content/mdx/remark-plugins'

/**
 * `next.config.ts` (task 3.3b): the image hosts come from the one allow-listed base URL (OD3), and
 * `@next/mdx` compiles content with exactly the remark plugins the MDX safety check parses with —
 * the check is only valid if the renderer parses like the checker (3.2a security review).
 */

type LoaderOptions = { remarkPlugins?: unknown[] }
type Loader = { loader: string; options: LoaderOptions }
type TurbopackRule = { loaders: Loader[]; as: string }

const TURBOPACK_RULE = '{*,next-mdx-rule}'
const EXPECTED_PLUGINS = ['remark-frontmatter', 'remark-gfm']

/** `next.config.ts` as Next loads it, with or without Turbopack (`@next/mdx` branches on it). */
async function loadConfig(turbopack: boolean): Promise<NextConfig> {
  vi.resetModules()
  if (turbopack) vi.stubEnv('TURBOPACK', '1')
  else vi.stubEnv('TURBOPACK', '')
  return (await import('../../next.config')).default
}

/** The MDX loader options Turbopack runs `.mdx` files through. */
async function turbopackMdxOptions(): Promise<LoaderOptions> {
  const config = await loadConfig(true)
  const rules = config.turbopack?.rules?.[TURBOPACK_RULE] as TurbopackRule[] | undefined
  const mdx = rules?.find((rule) => rule.as === '*.tsx')
  expect(mdx, 'the @next/mdx Turbopack rule').toBeDefined()
  return mdx!.loaders[0]!.options
}

/** The MDX loader options webpack runs `.mdx` files through (`next build --webpack`). */
async function webpackMdxOptions(): Promise<LoaderOptions> {
  const config = await loadConfig(false)
  const base = { resolve: { alias: {} }, module: { rules: [] as { use: unknown[] }[] } }
  const webpack = config.webpack as (c: typeof base, o: unknown) => typeof base
  const result = webpack(base, { defaultLoaders: { babel: 'babel-loader' } })
  const use = result.module.rules.at(-1)?.use ?? []
  return (use.at(-1) as Loader).options
}

/** Plugins resolved by name, exactly as `@next/mdx`'s loader does (`import(name)`, default export). */
async function resolvePlugins(names: readonly unknown[]) {
  return Promise.all(
    names.map(async (name) => {
      if (typeof name !== 'string') throw new Error(`plugins must be names: ${String(name)}`)
      const mod = (await import(name)) as { default: (...args: never[]) => void }
      return mod.default
    }),
  )
}

const EXPRESSION_TYPES = new Set(['mdxTextExpression', 'mdxFlowExpression', 'mdxjsEsm'])

type Node = { type: string; children?: Node[] }

/** The node types left in the tree `compile` turns into JavaScript. */
async function compiledNodeTypes(source: string, plugins: readonly unknown[]): Promise<string[]> {
  const types: string[] = []
  const collect = () => (tree: Node) => {
    const walk = (node: Node) => {
      types.push(node.type)
      node.children?.forEach(walk)
    }
    walk(tree)
  }
  await compile(source, {
    remarkPlugins: [...((await resolvePlugins(plugins)) as never[]), collect],
  })
  return types
}

/** 3.2a review probes: each must compile to text, never to an expression that runs on render. */
const PROBES = {
  autolink: 'See https://x.test/{alert(1)} now',
  frontmatter: '---\ntitle: {globalThis.pwned = 1}\n---\n# x',
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  delete (globalThis as { pwned?: unknown }).pwned
})

describe('next.config.ts images (OD3)', () => {
  it('allows exactly the content-images bucket, from CONTENT_IMAGE_BASE_URL', async () => {
    const config = await loadConfig(true)
    expect(config.images?.remotePatterns).toEqual(contentImageRemotePatterns())
    expect(config.images?.remotePatterns).toEqual([
      {
        protocol: 'https',
        hostname: 'oelgwbxukbgaqqvociwi.supabase.co',
        pathname: '/storage/v1/object/public/content-images/**',
      },
    ])
  })

  it('keeps the M2 settings', async () => {
    const config = await loadConfig(true)
    expect(config.reactStrictMode).toBe(true)
    expect(config.outputFileTracingIncludes).toEqual({ '/**': ['content/tracks/*/track.yaml'] })
    expect(await config.redirects?.()).toEqual([
      { source: '/admin', destination: '/admin/users', permanent: false },
    ])
  })
})

describe('next.config.ts MDX: the renderer parses like the safety check', () => {
  it('shares one plugin list with the checker', () => {
    expect([...REMARK_PLUGIN_NAMES]).toEqual(EXPECTED_PLUGINS)
  })

  it('gives Turbopack the shared plugins, by name', async () => {
    expect((await turbopackMdxOptions()).remarkPlugins).toEqual(EXPECTED_PLUGINS)
  })

  it('gives webpack the shared plugins, by name', async () => {
    expect((await webpackMdxOptions()).remarkPlugins).toEqual(EXPECTED_PLUGINS)
  })

  it('the probes would compile to expressions without the plugins (the detector works)', async () => {
    for (const probe of Object.values(PROBES)) {
      const types = await compiledNodeTypes(probe, [])
      expect(
        types.some((type) => EXPRESSION_TYPES.has(type)),
        probe,
      ).toBe(true)
    }
  })

  it.each(Object.entries(PROBES))(
    'compiles the %s probe with no expression (real plugin config)',
    async (_name, probe) => {
      const plugins = (await turbopackMdxOptions()).remarkPlugins ?? []
      const types = await compiledNodeTypes(probe, plugins)
      expect(types.filter((type) => EXPRESSION_TYPES.has(type))).toEqual([])
    },
  )

  it('renders the probes as inert text: nothing runs', async () => {
    const alert = vi.fn()
    vi.stubGlobal('alert', alert)
    const plugins = (await turbopackMdxOptions()).remarkPlugins ?? []
    const remarkPlugins = (await resolvePlugins(plugins)) as never[]

    const autolink = await evaluate(PROBES.autolink, { ...runtime, remarkPlugins })
    const linkHtml = renderToStaticMarkup(createElement(autolink.default))
    expect(linkHtml).toContain('https://x.test/{alert(1)}')
    expect(alert).not.toHaveBeenCalled()

    const frontmatter = await evaluate(PROBES.frontmatter, { ...runtime, remarkPlugins })
    const frontmatterHtml = renderToStaticMarkup(createElement(frontmatter.default))
    expect(frontmatterHtml).toBe('<h1>x</h1>')
    expect((globalThis as { pwned?: unknown }).pwned).toBeUndefined()
  })
})
