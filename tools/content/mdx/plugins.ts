import type { CompileOptions } from '@mdx-js/mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { REMARK_PLUGIN_NAMES, type RemarkPluginName } from './remark-plugins'

type PluginList = NonNullable<CompileOptions['remarkPlugins']>

const BY_NAME: { readonly [K in RemarkPluginName]: PluginList[number] } = {
  'remark-frontmatter': remarkFrontmatter,
  'remark-gfm': remarkGfm,
}

/** `REMARK_PLUGIN_NAMES` resolved to the functions `@next/mdx` loads for them, in order. */
export const remarkPlugins: PluginList = REMARK_PLUGIN_NAMES.map((name) => BY_NAME[name])
