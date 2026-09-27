import type * as React from 'react'

/**
 * A catalog entry (platform design §7.7): `file` must match the component's path —
 * tools/guards/component-catalog.test.ts checks both directions, and e2e/components.spec.ts runs
 * axe over the rendered page in light and dark mode. `registry.tsx` and `entries/*.tsx` hold them.
 */
export type Demo = { title: string; render: () => React.ReactNode }
export type Entry = {
  name: string
  layer: 'ui' | 'patterns' | 'features'
  file: string
  demos: Demo[]
}
