import { createElement, Fragment, type ReactNode } from 'react'

/**
 * Keyed copy for a value that comes from content (`kind`, `tone`, a language): only the record's
 * own keys, so `kind="constructor"` never reaches `Object.prototype` (3.2a review).
 */
export function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined
}

/** A `vi.ts` message with its `{name}` placeholders filled in literally (a replacer function). */
export function fill(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  )
}

/** A message with one placeholder replaced by a node (e.g. a quiz answer that holds code). */
export function fillNode(text: string, placeholder: string, node: ReactNode): ReactNode {
  const at = text.indexOf(placeholder)
  if (at === -1) return text
  // Static children (not an array), so React needs no keys.
  return createElement(Fragment, null, text.slice(0, at), node, text.slice(at + placeholder.length))
}
