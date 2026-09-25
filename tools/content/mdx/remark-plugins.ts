/**
 * The remark plugins content MDX is parsed with — by the safety check (`parse.ts`, through
 * `plugins.ts`) and by `@next/mdx` (`next.config.ts`). One list, so the renderer parses exactly
 * like the checker: without `remark-gfm`, `https://x.test/{alert(1)}` would compile to an
 * expression; without `remark-frontmatter`, so would a `{…}` in the YAML (3.2a security review).
 *
 * Names, not functions: Turbopack hands loader options to Node as data, so `next.config.ts` cannot
 * hold plugin functions (Next 16 MDX guide). `next.config.ts` imports this file, so it has no
 * imports of its own.
 */
export const REMARK_PLUGIN_NAMES = ['remark-frontmatter', 'remark-gfm'] as const

export type RemarkPluginName = (typeof REMARK_PLUGIN_NAMES)[number]
