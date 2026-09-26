/**
 * Event keys for `checkInBlock` and `recordOutcome` (Part B-M5 decision 16; M2 RF-2 "digest
 * keys" minor). `deriveEventId` mixes each key with the page's `requestId`: the same tap twice
 * sends the same id and the database records the event once, while a different grade, status,
 * minutes or note in the same render digests differently — a second event, never a no-op
 * `duplicate` that would keep the first submission's values. The digest is `lib/events/ids.ts`'s
 * (controller ruling M5-R22), over the payload exactly as it is sent (`./schema` builds it with
 * its keys in one fixed order).
 *
 * Server-side (`node:crypto`, through `digest`); a "use server" module may only export async
 * functions, so `./actions` imports these as a plain module (precedent:
 * `features/onboarding/event-keys.ts`).
 */
import 'server-only'
import type { PlanBlock } from '@/lib/domain/plan/types'
import { digest } from '@/lib/events/ids'
import { checkInPayload, outcomeEvent, type CheckInInput, type OutcomeInput } from './schema'

/** `<type>:<itemId>:<payload digest>` (decision 16). */
export function outcomeKey(input: OutcomeInput): string {
  const { type, payload } = outcomeEvent(input.outcome)
  return `${type}:${input.itemId}:${digest(payload)}`
}

/** `block.checked_in:<planId>:<blockId>:<payload digest>` (decision 16). */
export function checkInKey(input: CheckInInput & { readonly minutes: number }): string {
  return `block.checked_in:${input.planId}:${input.blockId}:${digest(checkInPayload(input))}`
}

/**
 * The server's auto check-in (decision 16): `auto:<planId>:<blockId>:<minutes>:<itemCount>` — the
 * same work repeats the key, and a re-send after the `extra` block grew is a new event.
 */
export function autoCheckInKey(planId: string, block: PlanBlock, minutes: number): string {
  return `auto:${planId}:${block.id}:${minutes}:${block.items.length}`
}
