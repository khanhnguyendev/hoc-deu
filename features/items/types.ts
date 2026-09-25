/**
 * The UI half of an item type (platform design §3.2, §7.6; decision 25): what a Page and a Row
 * receive, and the registry entry that joins them with the type's core
 * (`lib/content/item-types`). Types only, so client components may `import type` them.
 */
import type { MDXContent } from 'mdx/types'
import type * as React from 'react'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { CodeBundle } from '@/lib/content/code-tokens'
import type { AuthoredByType, ItemTypeCore, Mode } from '@/lib/content/item-types'
import type { Difficulty } from '@/lib/content/item-types/problem'
import type { CodeLanguage, ItemType } from '@/lib/content/schemas/common'

export type { CatalogItem, ItemType, Mode }

/** A learner's state for one item (§4.1 `item_state`); `null` until item state exists (4.9/M5). */
export type ItemStateView = {
  status: 'weak' | 'ok' | 'strong' | 'mastered' | 'skipped'
  level: number
  dueOn: string | null
}

/** Who is looking: the solution tab to open, and whether drafts show. */
export type ItemViewer = { codeLanguage: CodeLanguage; isAdmin: boolean }

/** Another item as a link (practice, anchor, deep-dive, recap). */
export type ItemLink = {
  id: string
  type: ItemType
  title: string
  href: string
  leetcode: number | null
  difficulty: Difficulty | null
}

/** Loaded by the type's `load` before the Page renders: the MDX body and highlighted code. */
export type ItemPageData = { Body: MDXContent | null; code: CodeBundle | null }

/** Records a result (§4.4); arrives with task 5.2. */
export type RecordResultAction = (input: {
  itemId: string
  result: string
  mode?: Mode
}) => Promise<{ ok: boolean; message: string }>

export type ItemPageProps<K extends ItemType> = {
  item: CatalogItem<K>
  /** `null` until item state exists (decision 25). */
  state: ItemStateView | null
  context: { planBlockId?: string; mode?: Mode }
  viewer: ItemViewer
  /** Preloaded by the route through the type's `load`. */
  data: ItemPageData
  /** Practice, anchor, deep-dive and recap links; `null` for an unknown or hidden item. */
  resolveItem: (id: string) => ItemLink | null
  recordResult?: RecordResultAction
}

export type ItemRowProps<K extends ItemType> = {
  item: CatalogItem<K>
  state: ItemStateView | null
  mode?: Mode
  href: string
  /** Show the learner's status pill ("Chưa học" when `state` is null). */
  showStatus?: boolean
}

export type ItemTypeDef<K extends ItemType> = ItemTypeCore<AuthoredByType[K]> & {
  Page: React.ComponentType<ItemPageProps<K>>
  Row: React.ComponentType<ItemRowProps<K>>
  /** problem: note MDX + code; lesson: MDX + code; others: `{ Body: null, code: null }`. */
  load(item: CatalogItem<K>): Promise<ItemPageData>
}
