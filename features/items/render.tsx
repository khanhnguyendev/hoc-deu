/**
 * How pages turn catalog items into registry elements (gate-review fix 5): screens hand an item
 * to these and never look at its type (§7.2). Server-only, like the registry.
 */
import 'server-only'
import type * as React from 'react'
import type { CatalogItem } from '@/lib/content/catalog-types'
import type { ItemType } from '@/lib/content/schemas/common'
import { itemHref } from './href'
import { getItemType } from './registry'
import type { ItemPageProps, ItemRowProps, ItemStateView, ItemTypeDef, Mode } from './types'

/**
 * The definition of the item's own type, typed for any item. Sound because the registry maps
 * each type to the definition of that type (`ITEM_REGISTRY`'s mapped type), so the Row and Page
 * returned here always receive an item of their own type.
 */
function definitionOf(item: CatalogItem): Pick<ItemTypeDef<ItemType>, 'Page' | 'Row' | 'load'> {
  return getItemType(item.type) as unknown as Pick<ItemTypeDef<ItemType>, 'Page' | 'Row' | 'load'>
}

/** `<Row item state href={itemHref(item)} …/>` of the item's type, keyed by the item ID. */
export function renderItemRow(
  item: CatalogItem,
  props: { state?: ItemStateView | null; mode?: Mode; showStatus?: boolean },
): React.ReactNode {
  const { Row } = definitionOf(item)
  const rowProps: ItemRowProps<ItemType> = {
    item,
    state: props.state ?? null,
    mode: props.mode,
    href: itemHref(item),
    showStatus: props.showStatus,
  }
  return <Row key={item.id} {...rowProps} />
}

/** Awaits the type's `load(item)`, then renders its Page with the loaded data. */
export async function renderItemPage(
  item: CatalogItem,
  props: Omit<ItemPageProps<ItemType>, 'item' | 'data'>,
): Promise<React.ReactNode> {
  const { Page, load } = definitionOf(item)
  const data = await load(item)
  return <Page {...props} item={item} data={data} />
}
