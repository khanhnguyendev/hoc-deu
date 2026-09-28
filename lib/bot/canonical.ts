/**
 * Canonical JSON (Part B-M6 decisions 10, 21): object keys sorted by UTF-16 code unit at every
 * depth, arrays in order, no whitespace, values serialised as `JSON.stringify` does (`undefined`
 * properties left out). The bot's request-body hashes and the catalog version use it, so it is
 * plain TypeScript with no server-only import (`tools/content` runs it at build time).
 */
import { createHash } from 'node:crypto'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    // Default sort compares UTF-16 code units: the same order on every machine and locale.
    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) sorted[key] = canonical(record[key])
    }
    return sorted
  }
  return value
}

/** `value` as canonical JSON text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonical(value))
}

/** The SHA-256 (64 lowercase hex digits) of `value`'s canonical JSON. */
export function bodyHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex')
}
