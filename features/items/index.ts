/**
 * The item types' public API (platform design §7.6), for pages and `features/roadmap`; the card
 * session (`CardSession`, task 5.2c) for /review and /today. **Not for client components:** it
 * re-exports the server-only registry. Client code imports what it needs
 * from the component files directly; `mdx-components.tsx` imports `./mdx/components`.
 */
export { CardSession } from './components/outcome/card-session'
export { itemHref, itemIdFromRoute } from './href'
export { mdxComponents } from './mdx/components'
export { mdxComponentsFor, type MdxBindings, type PracticeTarget } from './mdx/bind'
export { isItemOfType } from './narrow'
export { getItemType, ITEM_REGISTRY } from './registry'
export { flashcardSides } from './outcome'
export type {
  CardSessionCard,
  CardSessionProps,
  FlashcardSides,
  OutcomeBinding,
  OutcomeContext,
  RecordOutcome,
} from './outcome'
export { renderItemPage, renderItemRow } from './render'
export type {
  CatalogItem,
  ItemLink,
  ItemPageData,
  ItemPageProps,
  ItemRowProps,
  ItemStateView,
  ItemType,
  ItemTypeDef,
  ItemViewer,
  Mode,
} from './types'
