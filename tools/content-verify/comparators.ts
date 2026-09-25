/**
 * Comparators (platform design §3.5, §3.7): pure functions from a `tests.yaml` `compare` spec plus
 * an actual/expected pair to a pass/fail verdict. No execution — the runners (3.5b) call these
 * after running a solution.
 */
import type { CompareSpec } from '@/lib/content/schemas/tests'
import { VALIDATORS } from './validators/index'

export type Comparison = { ok: true } | { ok: false; reason: string }

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, canonicalize(item)] as const)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(entries)
  }
  return value
}

const canonicalJson = (value: unknown): string => JSON.stringify(canonicalize(value))

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const aRecord = a as Record<string, unknown>
    const bRecord = b as Record<string, unknown>
    const aKeys = Object.keys(aRecord)
    if (aKeys.length !== Object.keys(bRecord).length) return false
    return aKeys.every((key) => key in bRecord && deepEqual(aRecord[key], bRecord[key]))
  }
  return false
}

function multiset(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.map(canonicalJson).sort()
}

function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index])
}

function unorderedCompare(actual: unknown, expected: unknown): Comparison {
  const a = multiset(actual)
  const b = multiset(expected)
  if (a === null || b === null) {
    return { ok: false, reason: 'expected an array for an unordered comparison' }
  }
  return sameMultiset(a, b) ? { ok: true } : { ok: false, reason: 'values differ (unordered)' }
}

function sortedInnerJson(value: unknown): string {
  if (!Array.isArray(value)) return canonicalJson(value)
  return JSON.stringify(
    value.map(canonicalize).sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b))),
  )
}

function unorderedNestedCompare(actual: unknown, expected: unknown): Comparison {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    return { ok: false, reason: 'expected an array of arrays for an unordered-nested comparison' }
  }
  const a = actual.map(sortedInnerJson).sort()
  const b = expected.map(sortedInnerJson).sort()
  return sameMultiset(a, b)
    ? { ok: true }
    : { ok: false, reason: 'values differ (unordered-nested)' }
}

function floatEqual(actual: unknown, expected: unknown, tolerance: number): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) <= tolerance
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return (
      actual.length === expected.length &&
      actual.every((item, index) => floatEqual(item, expected[index], tolerance))
    )
  }
  return deepEqual(actual, expected)
}

/** Compares a runner's `actual` output against `expected` per `spec`. `input` is the case's raw
 * input, passed through to `validator` comparators only — `exact`/`unordered`/`unordered-nested`/
 * `float`/`in-place` never need it. */
export function compare(
  spec: CompareSpec,
  actual: unknown,
  expected: unknown,
  input: Readonly<Record<string, unknown>>,
): Comparison {
  switch (spec.kind) {
    case 'exact':
      return deepEqual(actual, expected) ? { ok: true } : { ok: false, reason: 'values differ' }
    case 'unordered':
      return unorderedCompare(actual, expected)
    case 'unordered-nested':
      return unorderedNestedCompare(actual, expected)
    case 'float':
      return floatEqual(actual, expected, spec.tolerance)
        ? { ok: true }
        : { ok: false, reason: `values differ by more than ${spec.tolerance}` }
    case 'in-place':
      // The runner reports the mutated argument as `actual`; only the nested compare is left.
      return compare({ kind: spec.compare }, actual, expected, input)
    case 'validator': {
      const validator = VALIDATORS[spec.name]
      if (validator === undefined) {
        return { ok: false, reason: `unknown validator "${spec.name}"` }
      }
      const result = validator(input, actual, expected)
      return result === true ? { ok: true } : { ok: false, reason: result }
    }
  }
}
