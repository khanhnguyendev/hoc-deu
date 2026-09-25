/**
 * Event builders for the projection and replay tests (task 4.2). Test-local: the shared plan
 * fixtures (`plan/__tests__/fixtures.ts`) stay untouched.
 */
import type { EventType } from '../../events'
import { MONDAY } from '../../plan/__tests__/fixtures'
import { RULES_VERSION } from '../../rules'
import type { DomainEvent } from '../project'

const START = Date.parse('2026-09-28T00:00:00Z')
const MINUTE = 60_000

export type EventFields = Partial<Omit<DomainEvent, 'id' | 'type' | 'occurredAt'>>
export type EventBuilder = (type: EventType, fields?: EventFields) => DomainEvent

/**
 * A fresh `event(type, fields)` builder: ids `e-001`, `e-002`, … and `occurredAt` one minute apart,
 * in call order. `localDay` defaults to `MONDAY`, the keys to null and the payload to `{}`.
 */
export function eventBuilder(): EventBuilder {
  let count = 0
  return (type, fields = {}) => {
    count += 1
    return deepFreeze({
      id: `e-${String(count).padStart(3, '0')}`,
      type,
      occurredAt: new Date(START + count * MINUTE).toISOString(),
      localDay: MONDAY,
      trackId: null,
      itemId: null,
      planId: null,
      blockId: null,
      payload: {},
      rulesVersion: RULES_VERSION,
      ...fields,
    })
  }
}

/** Freezes `value` and everything it reaches, so any write throws (ES modules are strict). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}
