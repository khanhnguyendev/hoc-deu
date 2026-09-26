import 'server-only'
import { getCatalog } from '@/lib/content/catalog'
import { toPlanCatalog } from '@/lib/content/plan-catalog'
import type { PlanCatalog } from '@/lib/domain/catalog'

let catalog: PlanCatalog | undefined

/** The engine's catalog (`toPlanCatalog(getCatalog())`), built once per server process. */
export function planCatalog(): PlanCatalog {
  catalog ??= toPlanCatalog(getCatalog())
  return catalog
}
