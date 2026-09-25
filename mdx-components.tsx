/// <reference types="mdx" />
import type { MDXComponents } from 'mdx/types'
import { mdxComponents } from '@/features/items/mdx/components'

/**
 * Required by `@next/mdx` with the App Router: the component map every MDX body renders with.
 * Imported from the components module, not `features/items/index.ts` (which re-exports the
 * server-only registry, task 3.4a). Pages add their bindings with `mdxComponentsFor`.
 */
export function useMDXComponents(): MDXComponents {
  return mdxComponents
}
