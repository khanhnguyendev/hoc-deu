/**
 * Replay (platform design §4.7, ADR-0008): all derived state rebuilt from a user's events under the
 * current rules — the drift check's reference and the proof that derived rows are only a cache.
 */
import type { PlanCatalog } from '../catalog'
import { RULES_VERSION } from '../rules'
import { EMPTY_DERIVED_STATE, type DerivedState } from '../state'
import { projectEvent, type DomainEvent, type IgnoreReason } from './project'

export type ReplayResult = {
  readonly state: DerivedState
  readonly ignored: readonly { readonly eventId: string; readonly reason: IgnoreReason }[]
}

/**
 * `occurredAt` in epoch milliseconds. An unreadable one throws: it would make the order arbitrary.
 */
function instantOf(event: DomainEvent): number {
  const instant = Date.parse(event.occurredAt)
  if (Number.isNaN(instant)) {
    throw new Error(
      `event ${event.id} has an occurredAt that is not a timestamp: "${event.occurredAt}"`,
    )
  }
  return instant
}

/**
 * Rebuilds all derived state from the events, sorted by (Date.parse(occurredAt), id) — the input
 * order and the timestamp's text form (`Z` vs `+00:00`) do not matter. `rulesVersion` defaults to
 * RULES_VERSION and must equal it (only the current rules exist); an event stamped with a later
 * version throws.
 */
export function replay(
  events: readonly DomainEvent[],
  catalog: PlanCatalog,
  options: { readonly rulesVersion?: number } = {},
): ReplayResult {
  const rulesVersion = options.rulesVersion ?? RULES_VERSION
  if (rulesVersion !== RULES_VERSION) {
    throw new Error(
      `replay supports only the current rules version ${RULES_VERSION}, not ${rulesVersion}`,
    )
  }
  const newer = events.find((event) => event.rulesVersion > RULES_VERSION)
  if (newer !== undefined) {
    throw new Error(
      `event ${newer.id} has rules version ${newer.rulesVersion}, newer than the current ${RULES_VERSION}`,
    )
  }

  const ordered = events
    .map((event) => ({ event, instant: instantOf(event) }))
    .sort(
      (a, b) =>
        a.instant - b.instant || (a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0),
    )

  let state = EMPTY_DERIVED_STATE
  const ignored: { eventId: string; reason: IgnoreReason }[] = []
  for (const { event } of ordered) {
    const projection = projectEvent(state, event, catalog)
    state = projection.state
    if (projection.ignored !== null) ignored.push({ eventId: event.id, reason: projection.ignored })
  }
  return { state, ignored }
}
